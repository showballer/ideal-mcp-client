import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
} from 'intellichat/types';

import Fire from 'providers/Fire';
import useAuthStore from 'stores/useAuthStore';
import FireReader from 'intellichat/readers/FireReader';
import { urlJoin } from 'utils/util';
import INextChatService from './INextCharService';
import OpenAIChatService from './OpenAIChatService';

const debug = Debug('5ire:intellichat:FireChatService');

export default class FireChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(name:string, context: IChatContext) {
    super(name, context);
    this.provider = Fire;
  }

  protected getSystemRoleName(): string {
    return 'system';
  }

  // eslint-disable-next-line class-methods-use-this
  protected getReaderType() {
    return FireReader;
  }

  private getUserId() {
    const { session } = useAuthStore.getState();
    return session?.user.id;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[],
    msgId?: string
  ): Promise<Response> {
    const payload = await this.makePayload(messages, msgId);
    debug('About to make a request, payload:\r\n', payload);
    const provider = this.context.getProvider();
    const key = this.getUserId();
    if (!key) {
      throw new Error('User is not authenticated');
    }
    const url = urlJoin(`/v1/chat/completions`, provider.apiBase.trim());
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    return response;
  }
}
