import assert from "node:assert/strict";
import test from "node:test";
import { earliestExpiry, normalizeValidityPolicy, resolveResourceExpiry } from "../services/resourceValidityService.js";

test("resource validity remains permanent by default and for free content", () => {
  assert.deepEqual(normalizeValidityPolicy({ accessType: "PAID" }), { accessType: "PAID", validityMode: "PERMANENT", validityOffsetDays: null });
  assert.deepEqual(normalizeValidityPolicy({ accessType: "FREE", validityMode: "EXAM_DATE_OFFSET", validityOffsetDays: 30 }), { accessType: "FREE", validityMode: "PERMANENT", validityOffsetDays: null });
  assert.equal(resolveResourceExpiry({ validityMode: "PERMANENT", validityOffsetDays: null }, new Date("2027-09-14T00:00:00.000Z")), null);
});

test("exam-relative validity expires after the complete final access date", () => {
  const examDate = new Date("2027-09-14T00:00:00.000Z");
  assert.equal(resolveResourceExpiry({ validityMode: "EXAM_DATE_OFFSET", validityOffsetDays: 0 }, examDate)?.toISOString(), "2027-09-15T00:00:00.000Z");
  assert.equal(resolveResourceExpiry({ validityMode: "EXAM_DATE_OFFSET", validityOffsetDays: 30 }, examDate)?.toISOString(), "2027-10-15T00:00:00.000Z");
  assert.equal(resolveResourceExpiry({ validityMode: "EXAM_DATE_OFFSET", validityOffsetDays: 30 }, null), undefined);
});

test("the earlier entitlement or resource expiry always wins", () => {
  const entitlement = new Date("2027-09-20T00:00:00.000Z");
  const resource = new Date("2027-10-15T00:00:00.000Z");
  assert.equal(earliestExpiry(entitlement, resource)?.toISOString(), entitlement.toISOString());
  assert.equal(earliestExpiry(null, resource)?.toISOString(), resource.toISOString());
  assert.equal(earliestExpiry(null, undefined), null);
});

test("invalid exam-relative offsets fail closed", () => {
  for (const days of [-1, 1.5, 3651]) {
    assert.throws(() => normalizeValidityPolicy({ accessType: "PAID", validityMode: "EXAM_DATE_OFFSET", validityOffsetDays: days }), /Exam-relative validity/);
  }
});
