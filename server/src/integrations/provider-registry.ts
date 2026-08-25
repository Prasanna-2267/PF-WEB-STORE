import { getConfig } from "../config/env.js";
import { serviceUnavailable } from "../errors/api-error.js";
import { S3StorageProvider } from "./s3-storage-provider.js";
import type { EmailProvider } from "./email-provider.js";
import type { PaymentProvider } from "./payment-provider.js";
import type { StorageProvider } from "./storage-provider.js";
import { HttpEmailProvider } from "./http-email-provider.js";
import { HttpPaymentProvider } from "./http-payment-provider.js";

let storageOverride: StorageProvider | undefined;
let emailOverride: EmailProvider | undefined;
let paymentOverride: PaymentProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (storageOverride) return storageOverride;
  const config = getConfig().storage;
  if (config.driver !== "s3") throw serviceUnavailable("STORAGE_PROVIDER_NOT_CONFIGURED", "Durable object storage is not configured.");
  return new S3StorageProvider({
    endpoint: config.endpoint!, region: config.region, bucket: config.bucket!, accessKeyId: config.accessKeyId!,
    secretAccessKey: config.secretAccessKey!, signedUrlTtlSeconds: config.signedUrlTtlSeconds,
  });
}

export function getEmailProvider(): EmailProvider {
  if (emailOverride) return emailOverride;
  const config = getConfig().email;
  if (config.webhookUrl) return new HttpEmailProvider(config.webhookUrl, config.bearerToken);
  throw serviceUnavailable("EMAIL_PROVIDER_NOT_CONFIGURED", "Email delivery is not configured.");
}

export function getPaymentProvider(): PaymentProvider {
  if (paymentOverride) return paymentOverride;
  const config = getConfig().payment;
  if (config.checkoutUrl && config.webhookSecret) return new HttpPaymentProvider(config.checkoutUrl, config.webhookSecret, config.bearerToken);
  throw serviceUnavailable("PAYMENT_PROVIDER_NOT_CONFIGURED", "Payment processing is not configured.");
}

export const providerTestHooks = {
  setStorage(provider?: StorageProvider) { storageOverride = provider; },
  setEmail(provider?: EmailProvider) { emailOverride = provider; },
  setPayment(provider?: PaymentProvider) { paymentOverride = provider; },
  reset() { storageOverride = undefined; emailOverride = undefined; paymentOverride = undefined; },
};
