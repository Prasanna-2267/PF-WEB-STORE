import type { ContentAccessType, ContentValidityMode } from "../../generated/prisma/client.js";
import { badRequest } from "../errors/api-error.js";

export const MAX_VALIDITY_OFFSET_DAYS = 3650;

export type ResourceValidityPolicy = {
  accessType: ContentAccessType;
  validityMode: ContentValidityMode;
  validityOffsetDays: number | null;
};

export function normalizeValidityPolicy(input: {
  accessType: ContentAccessType;
  validityMode?: ContentValidityMode;
  validityOffsetDays?: number | null;
}): ResourceValidityPolicy {
  if (input.accessType === "FREE") {
    return { accessType: "FREE", validityMode: "PERMANENT", validityOffsetDays: null };
  }
  const validityMode = input.validityMode ?? "PERMANENT";
  if (validityMode === "PERMANENT") {
    return { accessType: "PAID", validityMode, validityOffsetDays: null };
  }
  const days = input.validityOffsetDays;
  if (!Number.isInteger(days) || days === undefined || days === null || days < 0 || days > MAX_VALIDITY_OFFSET_DAYS) {
    throw badRequest("INVALID_RESOURCE_VALIDITY", `Exam-relative validity requires a whole number from 0 to ${MAX_VALIDITY_OFFSET_DAYS} days.`);
  }
  return { accessType: "PAID", validityMode, validityOffsetDays: days };
}

/**
 * Returns an exclusive UTC expiry instant. An offset of 0 remains usable for
 * the complete canonical exam date and expires at the following UTC midnight.
 */
export function resolveResourceExpiry(policy: Pick<ResourceValidityPolicy, "validityMode" | "validityOffsetDays">, examDate: Date | null | undefined) {
  if (policy.validityMode === "PERMANENT") return null;
  if (!examDate) return undefined;
  const days = policy.validityOffsetDays ?? 0;
  return new Date(Date.UTC(examDate.getUTCFullYear(), examDate.getUTCMonth(), examDate.getUTCDate() + days + 1));
}

export function earliestExpiry(...values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date);
  return dates.length ? new Date(Math.min(...dates.map((value) => value.getTime()))) : null;
}

