import type { MailMessage, MailProvider, MailSendResult } from './types.js';

/** Keeps messages in memory. Used by automated tests. */
export class MemoryMailProvider implements MailProvider {
  readonly name = 'memory';
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<MailSendResult> {
    this.sent.push(message);
    return { providerMessageId: `memory-${this.sent.length}` };
  }
}
