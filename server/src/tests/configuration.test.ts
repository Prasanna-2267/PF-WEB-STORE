import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEnvironment } from "../config/env.js";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@localhost:5432/test",
  AUTH_JWT_SECRET: "a-test-secret-with-at-least-thirty-two-characters",
  CORS_ALLOWED_ORIGINS: "http://localhost:5173,https://example.test",
};

test("configuration parsing keeps explicit CORS origins and safe defaults", () => {
  const config = parseEnvironment(validEnvironment);
  assert.equal(config.server.port, 3000);
  assert.equal(config.corsOrigins.has("http://localhost:5173"), true);
  assert.equal(config.corsOrigins.has("https://example.test"), true);
  assert.equal(config.auth.passwordRegistrationEnabled, false);
  assert.equal(config.auth.stagedRegistrationEnabled, false);
});

test("configuration fails closed without database or signing secrets", () => {
  assert.throws(() => parseEnvironment({ NODE_ENV: "test", AUTH_JWT_SECRET: "x".repeat(32) }), /DATABASE_URL/);
  assert.throws(() => parseEnvironment({ NODE_ENV: "test", DATABASE_URL: validEnvironment.DATABASE_URL }), /AUTH_JWT_SECRET/);
});

test("production rejects insecure CORS origins", () => {
  assert.throws(() => parseEnvironment({
    ...validEnvironment,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "http://example.test",
  }), /HTTPS/);
});

test("production staged registration requires both email and SMS delivery", () => {
  assert.throws(() => parseEnvironment({
    ...validEnvironment,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://example.test",
    AUTH_STAGED_REGISTRATION_ENABLED: "true",
  }), /EMAIL_WEBHOOK_URL.*SMS_WEBHOOK_URL/);

  const config = parseEnvironment({
    ...validEnvironment,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://example.test",
    AUTH_STAGED_REGISTRATION_ENABLED: "true",
    EMAIL_WEBHOOK_URL: "https://providers.example.test/email",
    SMS_WEBHOOK_URL: "https://providers.example.test/sms",
  });
  assert.equal(config.auth.stagedRegistrationEnabled, true);
});

test("SMTP is a valid staged-registration email transport", () => {
  const config = parseEnvironment({
    ...validEnvironment,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://example.test",
    AUTH_STAGED_REGISTRATION_ENABLED: "true",
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "mailer@example.test",
    SMTP_PASSWORD: "provider-app-password",
    SMTP_FROM: "Parallax Flow <mailer@example.test>",
    SMS_WEBHOOK_URL: "https://providers.example.test/sms",
  });

  assert.equal(config.email.driver, "smtp");
  assert.equal(config.email.smtp.secure, true);
  assert.equal(config.email.smtp.port, 465);
});

test("mobile OTP development bypass is rejected in production", () => {
  assert.throws(() => parseEnvironment({
    ...validEnvironment,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://example.test",
    SMS_OTP_DEV_BYPASS_ENABLED: "true",
  }), /SMS_OTP_DEV_BYPASS_ENABLED.*must be false in production/);
});

test("fake payment is explicit in development and rejected in production", () => {
  const development = parseEnvironment({ ...validEnvironment, NODE_ENV: "development", FAKE_PAYMENT_ENABLED: "true" });
  assert.equal(development.payment.fakePaymentEnabled, true);
  assert.throws(() => parseEnvironment({
    ...validEnvironment,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://example.test",
    FAKE_PAYMENT_ENABLED: "true",
  }), /FAKE_PAYMENT_ENABLED.*must be false in production/);
});
