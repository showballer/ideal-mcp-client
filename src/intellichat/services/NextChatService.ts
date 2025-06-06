import Debug from 'debug';
import IChatReader, { ITool } from 'intellichat/readers/IChatReader';
import {
  IAnthropicTool,
  IChatContext,
  IChatRequestMessage,
  IChatRequestMessageContent,
  IChatRequestPayload,
  IGeminiChatRequestMessagePart,
  IGoogleTool,
  IMCPTool,
  IOpenAITool,
} from 'intellichat/types';
import OpenAI from 'providers/OpenAI';
import { IServiceProvider } from 'providers/types';
import useInspectorStore from 'stores/useInspectorStore';
import { raiseError, stripHtmlTags } from 'utils/util';

const debug = Debug('5ire:intellichat:NextChatService');

export default abstract class NextCharService {
  protected updateBuffer: string = '';

  protected reasoningBuffer: string = '';

  protected lastUpdateTime: number = 0;

  protected readonly UPDATE_INTERVAL: number = 100; // 100ms

  name: string;

  abortController: AbortController;

  context: IChatContext;

  provider: IServiceProvider;

  protected abstract getReaderType(): new (
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ) => IChatReader;

  protected onCompleteCallback: (result: any) => Promise<void>;

  protected onReadingCallback: (chunk: string, reasoning?: string) => void;

  protected onToolCallsCallback: (toolName: string) => void;

  protected onErrorCallback: (error: any, aborted: boolean) => void;

  protected usedToolNames: string[] = [];

  protected inputTokens: number = 0;

  protected outputTokens: number = 0;

  protected traceTool: (chatId: string, label: string, msg: string) => void;

  protected getSystemRoleName() {
    if (this.name === OpenAI.name) {
      return 'developer';
    }
    return 'system';
  }

  constructor({
    name,
    context,
    provider,
  }: {
    name: string;
    context: IChatContext;
    provider: IServiceProvider;
  }) {
    this.name = name;
    this.provider = provider;
    this.context = context;
    this.abortController = new AbortController();
    this.traceTool = useInspectorStore.getState().trace;

    this.onCompleteCallback = () => {
      throw new Error('onCompleteCallback is not set');
    };
    this.onToolCallsCallback = () => {
      throw new Error('onToolCallingCallback is not set');
    };
    this.onReadingCallback = () => {
      throw new Error('onReadingCallback is not set');
    };
    this.onErrorCallback = () => {
      throw new Error('onErrorCallback is not set');
    };
  }

  protected createReader(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): IChatReader {
    const ReaderType = this.getReaderType();
    return new ReaderType(reader);
  }

  protected abstract makeToolMessages(
    tool: ITool,
    toolResult: any,
    content?: string,
  ): IChatRequestMessage[];

  protected abstract makeTool(
    tool: IMCPTool,
  ): IOpenAITool | IAnthropicTool | IGoogleTool;

  protected abstract makePayload(
    messages: IChatRequestMessage[],
    msgId?: string,
  ): Promise<IChatRequestPayload>;

  protected abstract makeRequest(
    messages: IChatRequestMessage[],
    msgId?: string,
  ): Promise<Response>;

  protected getModelName() {
    const model = this.context.getModel();
    return model.name;
  }

  public onComplete(callback: (result: any) => Promise<void>) {
    this.onCompleteCallback = callback;
  }

  public onReading(callback: (chunk: string, reasoning?: string) => void) {
    this.onReadingCallback = callback;
  }

  public onToolCalls(callback: (toolName: string) => void) {
    this.onToolCallsCallback = callback;
  }

  public onError(callback: (error: any, aborted: boolean) => void) {
    this.onErrorCallback = callback;
  }

  // eslint-disable-next-line class-methods-use-this
  protected onReadingError(chunk: string) {
    try {
      const { error } = JSON.parse(chunk);
      console.error(error);
    } catch (err) {
      throw new Error(`Something went wrong`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  protected async convertPromptContent(
    content: string,
  ): Promise<
    | string
    | Partial<IChatRequestMessageContent>
    | IChatRequestMessageContent[]
    | IGeminiChatRequestMessagePart[]
  > {
    return stripHtmlTags(content);
  }

  public abort() {
    this.abortController?.abort();
  }

  public isToolsEnabled() {
    return this.context.getModel()?.capabilities?.tools?.enabled || false;
  }

  public async chat(messages: IChatRequestMessage[], msgId?: string) {
    const chatId = this.context.getActiveChat().id;
    this.abortController = new AbortController();
    let reply = '';
    let reasoning = '';
    let signal: any = null;
    try {
      signal = this.abortController.signal;
      const response = await this.makeRequest(messages, msgId);
      debug(
        `${this.name} Start Reading:`,
        response.status,
        response.statusText,
      );
      if (response.status !== 200) {
        const contentType = response.headers.get('content-type');
        let msg;
        let json;
        if (response.status === 404) {
          msg = `${response.url} not found, verify your API base.`;
        } else if (contentType?.includes('application/json')) {
          json = await response.json();
        } else {
          msg = await response.text();
        }
        raiseError(response.status, json, msg);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        this.onErrorCallback(new Error('No reader'), false);
        return;
      }
      const chatReader = this.createReader(reader);
      const readResult = await chatReader.read({
        onError: (err: any) => {
          this.onErrorCallback(err, !!signal?.aborted);
        },
        onProgress: (replyChunk: string, reasoningChunk?: string) => {
          const now = Date.now();
          reply += replyChunk;
          reasoning += reasoningChunk || '';

          // 将新内容添加到缓冲区
          this.updateBuffer += replyChunk;
          this.reasoningBuffer += reasoningChunk || '';

          // 检查是否需要更新
          if (now - this.lastUpdateTime >= this.UPDATE_INTERVAL) {
            // 发送缓冲区内容并清空
            if (this.updateBuffer || this.reasoningBuffer) {
              this.onReadingCallback(this.updateBuffer, this.reasoningBuffer);
              this.updateBuffer = '';
              this.reasoningBuffer = '';
              this.lastUpdateTime = now;
            }
          }
        },
        onToolCalls: this.onToolCallsCallback,
      });
      if (this.updateBuffer || this.reasoningBuffer) {
        this.onReadingCallback(this.updateBuffer, this.reasoningBuffer);
        this.updateBuffer = '';
        this.reasoningBuffer = '';
      }
      if (readResult?.inputTokens) {
        this.inputTokens += readResult.inputTokens;
      }
      if (readResult?.outputTokens) {
        this.outputTokens += readResult.outputTokens;
      }
      if (readResult.tool) {
        const [client, name] = readResult.tool.name.split('--');
        this.traceTool(chatId, name, '');
        const toolCallsResult = await window.electron.mcp.callTool({
          client,
          name,
          args: readResult.tool.args,
        });
        this.traceTool(
          chatId,
          'arguments',
          JSON.stringify(readResult.tool.args, null, 2),
        );
        if (toolCallsResult.isError) {
          const toolError =
            toolCallsResult.content.length > 0
              ? toolCallsResult.content[0]
              : { error: 'Unknown error' };
          this.traceTool(chatId, 'error', JSON.stringify(toolError, null, 2));
        } else {
          this.traceTool(
            chatId,
            'response',
            JSON.stringify(toolCallsResult, null, 2),
          );
        }
        const messagesWithTool = [
          ...messages,
          ...this.makeToolMessages(
            readResult.tool,
            toolCallsResult,
            readResult.content,
          ),
        ] as IChatRequestMessage[];
        await this.chat(messagesWithTool);
      } else {
        await this.onCompleteCallback({
          content: reply,
          reasoning,
          inputTokens: this.inputTokens,
          outputTokens: this.outputTokens,
        });
        this.inputTokens = 0;
        this.outputTokens = 0;
      }
    } catch (error: any) {
      this.onErrorCallback(error, !!signal?.aborted);
      await this.onCompleteCallback({
        content: reply,
        reasoning,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        error: {
          code: error.code || 500,
          message: error.message || error.toString(),
        },
      });
      this.inputTokens = 0;
      this.outputTokens = 0;
    }
  }
}
