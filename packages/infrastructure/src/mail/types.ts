export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface MailSendResult {
  providerMessageId: string | null;
}

/** A transactional e-mail provider. Implementations must be safe to call concurrently. */
export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<MailSendResult>;
  /** Optional connectivity check used by health endpoints. */
  verify?(): Promise<void>;
  close?(): Promise<void>;
}
