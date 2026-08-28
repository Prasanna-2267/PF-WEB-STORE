import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { AccountVerificationPurpose, LearnerTheme } from "../../generated/prisma/client.js";
import { getConfig } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { ApiError, badRequest, conflict, notFound, serviceUnavailable } from "../errors/api-error.js";
import { getEmailProvider, getSmsProvider } from "../integrations/provider-registry.js";
import { patchPreferences } from "./learnerPreferenceService.js";

const TTL_MS = 15 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 5;

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const normalized = trimmed.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+91${digits}` : `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw badRequest("INVALID_PHONE", "Enter a valid mobile number including its country code.");
  return normalized;
};
const otpHash = (id: string, code: string) => createHmac("sha256", getConfig().auth.jwtSecret).update(`account:${id}:${code}`).digest("hex");
const otpMatches = (left: string, right: string) => {
  const a = Buffer.from(left, "hex"); const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
const newCode = (purpose: AccountVerificationPurpose) => purpose === "MOBILE_CHANGE" && getConfig().sms.developmentOtpBypassEnabled
  ? "0000" : randomInt(0, 10_000).toString().padStart(4, "0");
const masked = (purpose: AccountVerificationPurpose, target: string) => purpose === "MOBILE_CHANGE"
  ? `${target.slice(0, Math.max(2, target.length - 4)).replace(/\d/g, "*")}${target.slice(-4)}`
  : target.replace(/^(.{2}).*(@.*)$/, "$1***$2");

async function activeUser(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, status: "ACTIVE", deletedAt: null }, select: { id: true, email: true, phone: true, fullName: true } });
  if (!user) throw notFound("USER_NOT_FOUND", "The current account was not found.");
  return user;
}

export async function getStudentAccount(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, fullName: true, phone: true, createdAt: true, learnerPreference: { include: { selectedCourse: { select: { id: true, code: true, name: true, slug: true } } } }, learnerNotificationPreference: true },
  });
  if (!user) throw notFound("USER_NOT_FOUND", "The current account was not found.");
  return user;
}

export async function updateName(userId: string, fullName: string) {
  await activeUser(userId);
  return prisma.user.update({ where: { id: userId }, data: { fullName: fullName.trim() }, select: { id: true, fullName: true, email: true, phone: true, updatedAt: true } });
}

async function deliver(challenge: { id: string; purpose: AccountVerificationPurpose; targetValue: string }, fullName: string, code: string) {
  const config = getConfig();
  if (config.environment !== "production") {
    if (challenge.purpose === "MOBILE_CHANGE" && config.sms.developmentOtpBypassEnabled) return { developmentCode: "0000" };
    const configured = challenge.purpose === "MOBILE_CHANGE" ? Boolean(config.sms.webhookUrl) : config.email.driver === "smtp" || Boolean(config.email.webhookUrl);
    if (!configured) return { developmentCode: code };
  }
  try {
    if (challenge.purpose === "MOBILE_CHANGE") {
      await getSmsProvider().send({ to: challenge.targetValue, template: "account-mobile-change-otp", variables: { name: fullName, code, expiresInMinutes: "15" }, idempotencyKey: `account:${challenge.id}:${otpHash(challenge.id, code).slice(0, 16)}` });
    } else {
      await getEmailProvider().send({ to: challenge.targetValue, template: challenge.purpose === "DELETE_ACCOUNT" ? "account-delete-otp" : "account-email-change-otp", variables: { name: fullName, code, expiresInMinutes: "15" }, idempotencyKey: `account:${challenge.id}:${otpHash(challenge.id, code).slice(0, 16)}` });
    }
    return {};
  } catch {
    throw serviceUnavailable("OTP_DELIVERY_UNAVAILABLE", "The verification code could not be delivered. Try again.");
  }
}

export async function requestVerification(userId: string, purpose: AccountVerificationPurpose, rawTarget?: string) {
  const user = await activeUser(userId);
  const targetValue = purpose === "EMAIL_CHANGE" ? normalizeEmail(rawTarget ?? "") : purpose === "MOBILE_CHANGE" ? normalizePhone(rawTarget ?? "") : user.email;
  if (purpose === "EMAIL_CHANGE") {
    if (targetValue === user.email) throw conflict("EMAIL_UNCHANGED", "Enter an email different from your current email.");
    if (await prisma.user.findUnique({ where: { email: targetValue }, select: { id: true } })) throw conflict("EMAIL_ALREADY_REGISTERED", "An account already uses this email address.");
  }
  if (purpose === "MOBILE_CHANGE") {
    if (targetValue === user.phone) throw conflict("MOBILE_UNCHANGED", "Enter a mobile number different from your current number.");
    if (await prisma.user.findFirst({ where: { phone: targetValue, deletedAt: null }, select: { id: true } })) throw conflict("MOBILE_ALREADY_REGISTERED", "An account already uses this mobile number.");
  }
  const previous = await prisma.accountVerificationChallenge.findFirst({ where: { userId, purpose, consumedAt: null, cancelledAt: null }, orderBy: { createdAt: "desc" } });
  if (previous?.sentAt && previous.sentAt.getTime() + RESEND_COOLDOWN_MS > Date.now()) throw new ApiError(429, "OTP_RESEND_TOO_SOON", "Wait before requesting another verification code.");
  if (previous && previous.resendCount >= MAX_RESENDS) throw new ApiError(429, "OTP_RESEND_LIMIT_REACHED", "Too many verification codes were requested. Try again later.");
  const id = randomUUID(); const code = newCode(purpose); const now = new Date();
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.accountVerificationChallenge.updateMany({ where: { userId, purpose, consumedAt: null, cancelledAt: null }, data: { cancelledAt: now, otpHash: null } });
    return tx.accountVerificationChallenge.create({ data: { id, userId, purpose, targetValue, otpHash: otpHash(id, code), sentAt: now, resendCount: (previous?.resendCount ?? 0) + 1, expiresAt: new Date(now.getTime() + TTL_MS) } });
  });
  try {
    const delivery = await deliver(challenge, user.fullName, code);
    return { challengeId: challenge.id, purpose, maskedTarget: masked(purpose, targetValue), expiresAt: challenge.expiresAt, resendAfter: new Date(now.getTime() + RESEND_COOLDOWN_MS), ...delivery };
  } catch (error) {
    await prisma.accountVerificationChallenge.update({ where: { id }, data: { cancelledAt: new Date(), otpHash: null } });
    throw error;
  }
}

export async function verifyChange(userId: string, challengeId: string, purpose: AccountVerificationPurpose, code: string) {
  const challenge = await prisma.accountVerificationChallenge.findFirst({ where: { id: challengeId, userId, purpose } });
  if (!challenge) throw notFound("ACCOUNT_CHALLENGE_NOT_FOUND", "The verification request was not found.");
  if (challenge.consumedAt) throw conflict("OTP_ALREADY_USED", "This verification code has already been used.");
  if (challenge.cancelledAt) throw new ApiError(410, "OTP_REPLACED", "This verification request was replaced by a newer one.");
  if (challenge.expiresAt <= new Date()) throw new ApiError(410, "OTP_EXPIRED", "This verification code has expired.");
  if (!challenge.otpHash) throw badRequest("OTP_NOT_SENT", "Request a verification code first.");
  if (challenge.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "OTP_ATTEMPT_LIMIT_REACHED", "Too many incorrect codes were entered.");
  if (!otpMatches(challenge.otpHash, otpHash(challenge.id, code))) {
    await prisma.accountVerificationChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    throw badRequest("OTP_INCORRECT", "The verification code is incorrect.");
  }
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.accountVerificationChallenge.updateMany({ where: { id: challenge.id, userId, purpose, consumedAt: null, cancelledAt: null }, data: { consumedAt: now, otpHash: null } });
    if (claimed.count !== 1) throw conflict("OTP_ALREADY_USED", "This verification code has already been used.");
    if (purpose === "DELETE_ACCOUNT") {
      await tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, refreshTokenHash: null } });
      await tx.user.update({ where: { id: userId }, data: { status: "DISABLED", deletedAt: now } });
      return { deleted: true, signedOut: true };
    }
    if (purpose === "EMAIL_CHANGE") {
      const duplicate = await tx.user.findUnique({ where: { email: challenge.targetValue }, select: { id: true } });
      if (duplicate && duplicate.id !== userId) throw conflict("EMAIL_ALREADY_REGISTERED", "An account already uses this email address.");
      const user = await tx.user.update({ where: { id: userId }, data: { email: challenge.targetValue }, select: { id: true, fullName: true, email: true, phone: true } });
      await tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, refreshTokenHash: null } });
      return { user, signedOut: true };
    }
    const duplicate = await tx.user.findFirst({ where: { phone: challenge.targetValue, deletedAt: null, NOT: { id: userId } }, select: { id: true } });
    if (duplicate) throw conflict("MOBILE_ALREADY_REGISTERED", "An account already uses this mobile number.");
    return { user: await tx.user.update({ where: { id: userId }, data: { phone: challenge.targetValue }, select: { id: true, fullName: true, email: true, phone: true } }), signedOut: false };
  });
}

export async function updateExam(userId: string, input: { examMonth: number; examYear: number; examDay?: number; expectedVersion?: number }) {
  return patchPreferences(userId, input);
}
export async function updateStudyTarget(userId: string, dailyTargetMinutes: number, expectedVersion?: number) {
  return patchPreferences(userId, { dailyTargetMinutes, expectedVersion });
}
export async function updateAppearance(userId: string, preferredTheme: LearnerTheme, expectedVersion?: number) {
  const existing = await prisma.learnerPreference.findUnique({ where: { userId }, select: { version: true } });
  if (!existing) throw conflict("PREFERENCES_NOT_INITIALIZED", "Complete learner personalisation first.");
  if (expectedVersion !== undefined && expectedVersion !== existing.version) throw conflict("STALE_PREFERENCES", "Your preferences changed elsewhere. Reload and try again.");
  return prisma.learnerPreference.update({ where: { userId }, data: { preferredTheme, version: { increment: 1 } }, include: { selectedCourse: { select: { id: true, code: true, name: true, slug: true } } } });
}
