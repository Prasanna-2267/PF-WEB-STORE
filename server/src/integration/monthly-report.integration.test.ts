import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../db/prisma.js";
import { databaseDate, databaseDateKey } from "../services/learnerTime.js";
import * as reports from "../services/monthlyReportService.js";
import { integrationDatabaseEnabled } from "../tests/integration-database-guard.js";

const enabled = integrationDatabaseEnabled("RUN_BACKEND_INTEGRATION");
const suffix = randomUUID().slice(0, 8);
let userId = "";
let courseId = "";
let noteId = "";
let previousMonth = "";

before(async () => {
  if (!enabled) return;
  const role = await prisma.role.upsert({ where: { key: "student" }, create: { key: "student", name: "Student", description: "Learner role" }, update: {}, select: { id: true } });
  userId = randomUUID(); courseId = randomUUID(); noteId = randomUUID();
  const previous = new Date(); previous.setUTCMonth(previous.getUTCMonth() - 1, 10); previousMonth = databaseDateKey(previous).slice(0, 7);
  await prisma.user.create({ data: { id: userId, email: `monthly-${suffix}@test.local`, fullName: "Paid Learner", roleId: role.id } });
  await prisma.course.create({ data: { id: courseId, slug: `monthly-${suffix}`, code: `M${suffix.slice(0, 6)}`, name: "Monthly Course" } });
  await prisma.contentItem.create({ data: { id: noteId, courseId, kind: "FILE", name: "Monthly Note", mimeType: "application/pdf" } });
  await prisma.learnerPreference.create({ data: { userId, selectedCourseId: courseId, timezone: "UTC", dailyTargetMinutes: 30 } });
  await prisma.entitlement.create({ data: { userId, courseId, resourceType: "COURSE", resourceTitle: "Monthly Course", grantedAt: previous } });
  await prisma.learnerDailyActivity.create({ data: { userId, localDate: databaseDate(`${previousMonth}-10`), timezone: "UTC", targetMinutes: 30, focusSeconds: 1800, readingSeconds: 600, focusSessionCount: 1, qualifiesStreak: true, goalCompleted: true, lastActivityAt: previous } });
  await prisma.learnerStreakDay.create({ data: { userId, localDate: databaseDate(`${previousMonth}-10`), timezone: "UTC", focusSeconds: 1800, targetMinutes: 30, qualifiedAt: previous } });
  await prisma.learnerNoteState.create({ data: { userId, contentItemId: noteId, completed: true, completedAt: previous, revisionCount: 1 } });
  await prisma.noteRevisionEvent.create({ data: { userId, contentItemId: noteId, source: "MANUAL", revisedAt: previous } });
});

after(async () => {
  if (!enabled) return;
  await prisma.learnerMonthlyReport.deleteMany({ where: { userId } });
  await prisma.entitlement.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.contentItem.delete({ where: { id: noteId } });
  await prisma.course.delete({ where: { id: courseId } });
  await prisma.$disconnect();
});

test("Paid report archive freezes completed months and keeps current month live", { skip: !enabled }, async () => {
  const first = await reports.listMonthlyReports(userId);
  assert.equal(first.items[0]?.state, "LIVE");
  const previous = first.items.find((item) => item.yearMonth === previousMonth);
  assert.equal(previous?.state, "FROZEN");
  assert.equal(previous?.study.totalSeconds, 2400);
  assert.equal(previous?.learning.notesCompleted, 1);
  assert.equal(previous?.learning.revisionsCompleted, 1);
  assert.equal(previous?.streak.qualifiedDays, 1);

  const frozenAt = previous?.generatedAt;
  await prisma.learnerDailyActivity.update({ where: { userId_localDate: { userId, localDate: databaseDate(`${previousMonth}-10`) } }, data: { focusSeconds: 7200 } });
  const replay = await reports.getMonthlyReport(userId, previousMonth);
  assert.equal(replay.generatedAt?.toISOString(), frozenAt?.toISOString());
  assert.equal(replay.study.totalSeconds, 2400);
});
