import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseDate } from "../services/learnerTime.js";
import { summarizeMonthlyActivity } from "../services/monthlyReportService.js";

test("monthly report combines persisted activity and groups it into calendar weeks", () => {
  const report = summarizeMonthlyActivity([
    { localDate: databaseDate("2026-08-02"), focusSeconds: 1800, readingSeconds: 600, practiceSeconds: 0, revisionSeconds: 0, goalCompleted: false },
    { localDate: databaseDate("2026-08-08"), focusSeconds: 1200, readingSeconds: 0, practiceSeconds: 300, revisionSeconds: 300, goalCompleted: true },
    { localDate: databaseDate("2026-08-31"), focusSeconds: 900, readingSeconds: 0, practiceSeconds: 0, revisionSeconds: 300, goalCompleted: true },
  ]);
  assert.equal(report.totalStudySeconds, 5400);
  assert.equal(report.activeDays, 3);
  assert.equal(report.goalDays, 2);
  assert.deepEqual(report.weeklyStudySeconds, [2400, 1800, 0, 0, 1200]);
});

test("monthly report does not count an empty persisted activity row as active", () => {
  const report = summarizeMonthlyActivity([
    { localDate: databaseDate("2026-08-12"), focusSeconds: 0, readingSeconds: 0, practiceSeconds: 0, revisionSeconds: 0, goalCompleted: false },
  ]);
  assert.equal(report.activeDays, 0);
  assert.equal(report.totalStudySeconds, 0);
});
