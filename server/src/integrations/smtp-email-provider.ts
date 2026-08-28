import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider } from "./email-provider.js";

interface SmtpEmailProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export function renderEmailMessage(message: EmailMessage): { subject: string; text: string; html: string } {
  const templates = {
    "registration-otp": { subject: "Verify your Parallax Flow email", heading: "Verify your email", copy: "use this code to continue setting up your learning account" },
    "account-email-change-otp": { subject: "Confirm your new Parallax Flow email", heading: "Confirm your new email", copy: "use this code to make this your new sign-in email" },
    "account-delete-otp": { subject: "Confirm Parallax Flow account deletion", heading: "Confirm account deletion", copy: "use this code only if you requested permanent account deactivation" },
  } as const;
  const template = templates[message.template as keyof typeof templates];
  if (!template) {
    throw new Error(`Unsupported SMTP email template: ${message.template}.`);
  }

  const name = message.variables.name?.trim() || "learner";
  const code = message.variables.code ?? "";
  const expiresInMinutes = message.variables.expiresInMinutes ?? "15";
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);
  const safeExpiry = escapeHtml(expiresInMinutes);

  return {
    subject: template.subject,
    text: `Hi ${name},\n\nYour Parallax Flow verification code is ${code}. It expires in ${expiresInMinutes} minutes. Use it to ${template.copy}.\n\nIf you did not request this, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#101318;color:#f7f7f5;font-family:Arial,sans-serif"><div style="max-width:520px;margin:0 auto;padding:40px 24px"><p style="color:#f0ba58;font-size:12px;font-weight:700;letter-spacing:1.5px">PARALLAX FLOW</p><h1 style="font-size:26px;margin:18px 0 8px">${template.heading}</h1><p style="color:#b7bcc7;line-height:1.6">Hi ${safeName}, ${template.copy}.</p><div style="margin:28px 0;padding:22px;border:1px solid #343943;border-radius:18px;background:#171b21;text-align:center"><div style="font-size:38px;font-weight:800;letter-spacing:12px;color:#f0ba58">${safeCode}</div></div><p style="color:#b7bcc7">This code expires in ${safeExpiry} minutes. Never share it with anyone.</p></div></body></html>`,
  };
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpEmailProviderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
  }

  async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    const rendered = renderEmailMessage(message);
    const result = await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers: { "X-Idempotency-Key": message.idempotencyKey },
    });
    return { providerMessageId: result.messageId };
  }
}
