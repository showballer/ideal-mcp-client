import { IChatContext, IChatRequestMessage } from 'intellichat/types';
import { urlJoin } from 'utils/util';
import OpenAIChatService from './OpenAIChatService';
import DeepSeek from '../../providers/DeepSeek';
import INextChatService from './INextCharService';

export default class DeepSeekChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(name:string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = DeepSeek;
  }

  protected getSystemRoleName(): string {
    return 'system';
  }


  protected async makeRequest(
    messages: IChatRequestMessage[],
    msgId?: string,
  ): Promise<Response> {
    const provider = this.context.getProvider();
    const url = urlJoin('/chat/completions', provider.apiBase.trim());
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey.trim()}`,
      },
      body: JSON.stringify(await this.makePayload(messages, msgId)),
      signal: this.abortController.signal,
    });
    return response;
  }
}
