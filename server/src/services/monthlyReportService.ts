import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { conflict, forbidden, notFound } from "../errors/api-error.js";
import { databaseDate, databaseDateKey, learnerDateKey, monthBounds } from "./learnerTime.js";

const ALGORITHM_VERSION = "monthly-report-v1";
const MAX_ARCHIVE_MONTHS = 60;

type ActivityRow = {
  localDate: Date;
  focusSeconds: number;
  readingSeconds: number;
  practiceSeconds: number;
  revisionSeconds: number;
  goalCompleted: boolean;
};

export function summarizeMonthlyActivity(rows: ActivityRow[]) {
  const weeklyStudySeconds = [0, 0, 0, 0, 0];
  let focusSeconds = 0;
  let readingSeconds = 0;
  let practiceSeconds = 0;
  let revisionSeconds = 0;
  let goalDays = 0;
  let activeDays = 0;
  for (const row of rows) {
    const total = row.focusSeconds + row.readingSeconds + row.practiceSeconds + row.revisionSeconds;
    const week = Math.min(4, Math.floor((row.localDate.getUTCDate() - 1) / 7));
    weeklyStudySeconds[week] += total;
    focusSeconds += row.focusSeconds;
    readingSeconds += row.readingSeconds;
    practiceSeconds += row.practiceSeconds;
    revisionSeconds += row.revisionSeconds;
    if (total > 0) activeDays += 1;
    if (row.goalCompleted) goalDays += 1;
  }
  return {
    totalStudySeconds: focusSeconds + readingSeconds + practiceSeconds + revisionSeconds,
    focusSeconds,
    readingSeconds,
    practiceSeconds,
    revisionSeconds,
    activeDays,
    goalDays,
    weeklyStudySeconds,
  };
}

function shiftMonth(yearMonth: string, amount: number) {
  const date = databaseDate(`${yearMonth}-01`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return databaseDateKey(date).slice(0, 7);
}

function eventInMonth(date: Date, yearMonth: string, timezone: string) {
  return learnerDateKey(date, timezone).startsWith(`${yearMonth}-`);
}

async function paidAccess(userId: string) {
  const now = new Date();
  const active = await prisma.entitlement.findFirst({
    where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: [{ grantedAt: "asc" }, { id: "asc" }],
    select: { grantedAt: true },
  });
  if (!active) throw forbidden("PAID_REPORT_ACCESS_REQUIRED", "Monthly learning reports are available to Paid learners.");
  const earliest = await prisma.entitlement.findFirst({
    where: { userId },
    orderBy: [{ grantedAt: "asc" }, { id: "asc" }],
    select: { grantedAt: true },
  });
  return { reportAccessStartedAt: earliest?.grantedAt ?? active.grantedAt };
}

async function learnerContext(userId: string) {
  const preference = await prisma.learnerPreference.findUnique({
    where: { userId },
    select: {
      timezone: true,
      selectedCourse: { select: { id: true, code: true, name: true, status: true, deletedAt: true } },
    },
  });
  if (!preference?.selectedCourse || preference.selectedCourse.status !== "ACTIVE" || preference.selectedCourse.deletedAt) {
    throw conflict("COURSE_NOT_SELECTED", "Complete learner personalisation and select an active course first.");
  }
  return { timezone: preference.timezone, course: preference.selectedCourse };
}

const publishedPdfWhere = (courseId: string): Prisma.ContentItemWhereInput => ({
  courseId,
  kind: "FILE",
  mimeType: "application/pdf",
  status: "PUBLISHED",
  deletedAt: null,
});

async function aggregateMonth(userId: string, yearMonth: string, context: Awaited<ReturnType<typeof learnerContext>>) {
  const { start, end } = monthBounds(yearMonth);
  const coarseStart = new Date(start.getTime() - 2 * 86_400_000);
  const coarseEnd = new Date(end.getTime() + 2 * 86_400_000);
  const { timezone, course } = context;
  const [activities, streakDays, completedStates, revisionEvents, completedTasks, totalNotes, allCompletedStates] = await Promise.all([
    prisma.learnerDailyActivity.findMany({
      where: { userId, localDate: { gte: start, lt: end } },
      orderBy: { localDate: "asc" },
      select: { localDate: true, focusSeconds: true, readingSeconds: true, practiceSeconds: true, revisionSeconds: true, goalCompleted: true },
    }),
    prisma.learnerStreakDay.findMany({ where: { userId, localDate: { gte: start, lt: end } }, select: { status: true } }),
    prisma.learnerNoteState.findMany({
      where: { userId, completedAt: { gte: coarseStart, lt: coarseEnd }, contentItem: publishedPdfWhere(course.id) },
      select: { completedAt: true },
    }),
    prisma.noteRevisionEvent.findMany({
      where: { userId, revisedAt: { gte: coarseStart, lt: coarseEnd }, noteState: { contentItem: publishedPdfWhere(course.id) } },
      select: { revisedAt: true },
    }),
    prisma.learnerStudyTask.findMany({
      where: { userId, status: "COMPLETED", completedAt: { gte: coarseStart, lt: coarseEnd }, plan: { courseId: course.id } },
      select: { completedAt: true },
    }),
    prisma.contentItem.count({ where: publishedPdfWhere(course.id) }),
    prisma.learnerNoteState.findMany({
      where: { userId, completed: true, completedAt: { not: null }, contentItem: publishedPdfWhere(course.id) },
      select: { completedAt: true },
    }),
  ]);
  const activity = summarizeMonthlyActivity(activities);
  const notesCompleted = completedStates.filter((item) => item.completedAt && eventInMonth(item.completedAt, yearMonth, timezone)).length;
  const revisionsCompleted = revisionEvents.filter((item) => eventInMonth(item.revisedAt, yearMonth, timezone)).length;
  const studyTasksCompleted = completedTasks.filter((item) => item.completedAt && eventInMonth(item.completedAt, yearMonth, timezone)).length;
  const syllabusCompleted = allCompletedStates.filter((item) => item.completedAt && learnerDateKey(item.completedAt, timezone) < `${shiftMonth(yearMonth, 1)}-01`).length;
  return {
    ...activity,
    streakDays: streakDays.length,
    protectedDays: streakDays.filter((item) => item.status === "PROTECTED").length,
    notesCompleted,
    revisionsCompleted,
    studyTasksCompleted,
    totalNotes,
    syllabusCompleted,
    syllabusPercent: totalNotes ? Math.min(100, Math.round((syllabusCompleted / totalNotes) * 100)) : 0,
  };
}

function present(report: {
  id?: string | null;
  yearMonth: string;
  timezone: string;
  courseId: string;
  courseCodeSnapshot: string;
  courseNameSnapshot: string;
  totalStudySeconds: number;
  focusSeconds: number;
  readingSeconds: number;
  practiceSeconds: number;
  revisionSeconds: number;
  activeDays: number;
  goalDays: number;
  streakDays: number;
  protectedDays: number;
  notesCompleted: number;
  revisionsCompleted: number;
  studyTasksCompleted: number;
  totalNotes: number;
  syllabusCompleted: number;
  syllabusPercent: number;
  weeklyStudySeconds: unknown;
  generatedAt?: Date | null;
}, state: "LIVE" | "FROZEN") {
  const weekly = Array.isArray(report.weeklyStudySeconds) ? report.weeklyStudySeconds.map(Number).slice(0, 5) : [];
  while (weekly.length < 5) weekly.push(0);
  return {
    id: report.id ?? null,
    yearMonth: report.yearMonth,
    state,
    timezone: report.timezone,
    course: { id: report.courseId, code: report.courseCodeSnapshot, name: report.courseNameSnapshot },
    study: {
      totalSeconds: report.totalStudySeconds,
      focusSeconds: report.focusSeconds,
      readingSeconds: report.readingSeconds,
      practiceSeconds: report.practiceSeconds,
      revisionSeconds: report.revisionSeconds,
      weeklySeconds: weekly,
      activeDays: report.activeDays,
      goalDays: report.goalDays,
    },
    streak: { qualifiedDays: report.streakDays, protectedDays: report.protectedDays },
    learning: {
      notesCompleted: report.notesCompleted,
      revisionsCompleted: report.revisionsCompleted,
      studyTasksCompleted: report.studyTasksCompleted,
      totalNotes: report.totalNotes,
      syllabusCompleted: report.syllabusCompleted,
      syllabusPercent: report.syllabusPercent,
    },
    capabilities: { practiceAnalytics: false as const, practiceAnalyticsReason: "PRACTICE_BACKEND_PAUSED" as const },
    generatedAt: report.generatedAt ?? null,
  };
}

async function liveReport(userId: string, yearMonth: string, context: Awaited<ReturnType<typeof learnerContext>>) {
  const metrics = await aggregateMonth(userId, yearMonth, context);
  return present({
    id: null,
    yearMonth,
    timezone: context.timezone,
    courseId: context.course.id,
    courseCodeSnapshot: context.course.code,
    courseNameSnapshot: context.course.name,
    ...metrics,
    weeklyStudySeconds: metrics.weeklyStudySeconds,
    generatedAt: null,
  }, "LIVE");
}

async function freezeMonth(userId: string, yearMonth: string, context: Awaited<ReturnType<typeof learnerContext>>) {
  const existing = await prisma.learnerMonthlyReport.findUnique({ where: { userId_yearMonth: { userId, yearMonth } } });
  if (existing) return existing;
  const metrics = await aggregateMonth(userId, yearMonth, context);
  const { start, end } = monthBounds(yearMonth);
  try {
    return await prisma.learnerMonthlyReport.create({ data: {
      userId,
      courseId: context.course.id,
      yearMonth,
      timezone: context.timezone,
      courseCodeSnapshot: context.course.code,
      courseNameSnapshot: context.course.name,
      periodStart: start,
      periodEndExclusive: end,
      ...metrics,
      weeklyStudySeconds: metrics.weeklyStudySeconds,
      algorithmVersion: ALGORITHM_VERSION,
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.learnerMonthlyReport.findUniqueOrThrow({ where: { userId_yearMonth: { userId, yearMonth } } });
    }
    throw error;
  }
}

export async function listMonthlyReports(userId: string) {
  const [{ reportAccessStartedAt }, context] = await Promise.all([paidAccess(userId), learnerContext(userId)]);
  const currentMonth = learnerDateKey(new Date(), context.timezone).slice(0, 7);
  const accessMonth = learnerDateKey(reportAccessStartedAt, context.timezone).slice(0, 7);
  const months: string[] = [];
  for (let month = shiftMonth(currentMonth, -1); month >= accessMonth && months.length < MAX_ARCHIVE_MONTHS; month = shiftMonth(month, -1)) months.push(month);
  // Bound first-open database pressure while backfilling an existing Paid learner's archive.
  for (let index = 0; index < months.length; index += 3) {
    await Promise.all(months.slice(index, index + 3).map((month) => freezeMonth(userId, month, context)));
  }
  const [current, frozen] = await Promise.all([
    liveReport(userId, currentMonth, context),
    prisma.learnerMonthlyReport.findMany({ where: { userId }, orderBy: [{ periodStart: "desc" }, { id: "desc" }], take: MAX_ARCHIVE_MONTHS }),
  ]);
  return { items: [current, ...frozen.map((item) => present(item, "FROZEN"))], serverTime: new Date() };
}

export async function getMonthlyReport(userId: string, yearMonth: string) {
  const [{ reportAccessStartedAt }, context] = await Promise.all([paidAccess(userId), learnerContext(userId)]);
  const currentMonth = learnerDateKey(new Date(), context.timezone).slice(0, 7);
  const accessMonth = learnerDateKey(reportAccessStartedAt, context.timezone).slice(0, 7);
  if (yearMonth > currentMonth || yearMonth < accessMonth) throw notFound("MONTHLY_REPORT_NOT_FOUND", "This monthly report is not available.");
  if (yearMonth === currentMonth) return liveReport(userId, yearMonth, context);
  const report = await prisma.learnerMonthlyReport.findUnique({ where: { userId_yearMonth: { userId, yearMonth } } }) ?? await freezeMonth(userId, yearMonth, context);
  return present(report, "FROZEN");
}
