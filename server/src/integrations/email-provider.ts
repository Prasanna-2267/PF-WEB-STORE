export interface EmailMessage {
  to: string;
  template: string;
  variables: Record<string, string>;
  idempotencyKey: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}
