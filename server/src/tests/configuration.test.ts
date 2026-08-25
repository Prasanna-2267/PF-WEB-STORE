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
