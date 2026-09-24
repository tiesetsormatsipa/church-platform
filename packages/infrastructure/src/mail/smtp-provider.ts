import { createTransport } from 'nodemailer';
import type { MailMessage, MailProvider, MailSendResult } from './types.js';

export interface SmtpConfig {
  host: string;
  port: number;
  /** Implicit TLS (port 465). STARTTLS is negotiated automatically otherwise. */
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpMailProvider implements MailProvider {
  readonly name = 'smtp';
  private readonly transport;

  constructor(private readonly config: SmtpConfig) {
    this.transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      pool: true,
      maxConnections: 3,
      ...(config.user ? { auth: { user: config.user, pass: config.password ?? '' } } : {}),
    });
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    const info = await this.transport.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    });
    return { providerMessageId: info.messageId ?? null };
  }

  async verify(): Promise<void> {
    await this.transport.verify();
  }

  async close(): Promise<void> {
    this.transport.close();
  }
}
