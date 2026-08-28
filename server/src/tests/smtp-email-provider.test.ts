import assert from "node:assert/strict";
import { test } from "node:test";
import { renderEmailMessage } from "../integrations/smtp-email-provider.js";

test("registration OTP email renders the code and escapes user content", () => {
  const rendered = renderEmailMessage({
    to: "learner@example.test",
    template: "registration-otp",
    variables: { name: "Learner <script>", code: "4821", expiresInMinutes: "15" },
    idempotencyKey: "registration:test:email",
  });

  assert.match(rendered.subject, /Verify/);
  assert.match(rendered.text, /4821/);
  assert.match(rendered.html, /4821/);
  assert.doesNotMatch(rendered.html, /Learner <script>/);
  assert.match(rendered.html, /Learner &lt;script&gt;/);
});

test("SMTP renderer rejects unknown templates", () => {
  assert.throws(() => renderEmailMessage({
    to: "learner@example.test",
    template: "unknown-template",
    variables: {},
    idempotencyKey: "unknown:test",
  }), /Unsupported SMTP email template/);
});

test("SMTP renderer supports security-sensitive account verification templates", () => {
  const emailChange = renderEmailMessage({ to: "new@example.com", template: "account-email-change-otp", variables: { name: "Learner", code: "1234", expiresInMinutes: "15" }, idempotencyKey: "email-change" });
  assert.match(emailChange.subject, /new Parallax Flow email/i);
  assert.match(emailChange.text, /1234/);
  const deletion = renderEmailMessage({ to: "user@example.com", template: "account-delete-otp", variables: { name: "Learner", code: "4321", expiresInMinutes: "15" }, idempotencyKey: "delete" });
  assert.match(deletion.subject, /deletion/i);
  assert.match(deletion.html, /4321/);
});
