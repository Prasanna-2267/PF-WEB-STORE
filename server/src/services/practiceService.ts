import { Prisma, type PracticeAnswerFormat, type PracticeCollection, type QuestionKind } from "../../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../errors/api-error.js";
import { learnerDateKey } from "./learnerTime.js";

type SourceInput = { sourceKind: "ARCHIVE" };
type FilterInput = SourceInput & { subjectId?: string; chapterId?: string; lessonId?: string; topicId?: string; collection?: PracticeCollection; year?: number; answerFormat: PracticeAnswerFormat; questionCount: number; timerSeconds?: number };
type PracticeCandidate = {
  questionId: string;
  subQuestionId: string | null;
  kind: QuestionKind;
  difficulty: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";
  promptHtml: string;
  caseHtml: string;
  options: Array<{ optionLabel: string; html: string; displayOrder: number }>;
  correctOptionLabel: string | null;
  answerHtml: string;
  correctExplanationHtml: string;
  premiumWrongExplanationHtml: string;
  subjectId: string | null;
  chapterId: string | null;
  lessonId: string | null;
  topicId: string | null;
};

async function selectedCourse(userId: string) {
  const preference = await prisma.learnerPreference.findUnique({ where: { userId }, select: { selectedCourse: { select: { id: true, code: true, name: true, slug: true, academyId: true, status: true, deletedAt: true, academy: { select: { status: true, deletedAt: true } } } } } });
  const course = preference?.selectedCourse;
  if (!course || course.status !== "ACTIVE" || course.deletedAt || (course.academy && (course.academy.status !== "ACTIVE" || course.academy.deletedAt))) throw conflict("COURSE_NOT_SELECTED", "Select an active course before starting practice.");
  if (course.academyId && !await prisma.academyMembership.findFirst({ where: { userId, academyId: course.academyId, role: "ACADEMY_STUDENT", status: "ACTIVE" }, select: { id: true } })) throw forbidden("ACADEMY_MEMBERSHIP_REQUIRED", "This academy course is no longer available to your account.");
  return course;
}

const activeWindow = () => ({ status: "ACTIVE" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

async function hasPaidPracticePolicy(userId: string) {
  return Boolean(await prisma.entitlement.findFirst({
    where: {
      userId,
      ...activeWindow(),
      OR: [{ source: "SUBSCRIPTION" }, { source: "PURCHASE", order: { status: "PAID", isComplimentary: false, totalAmount: { gt: 0 } } }],
    },
    select: { id: true },
  }));
}

function questionWhere(courseId: string, academyId: string | null, input: FilterInput): Prisma.QuestionWhereInput {
  const kinds: QuestionKind[] = input.answerFormat === "MCQ" ? ["NORMAL_MCQ"] : input.answerFormat === "DESCRIPTIVE" ? ["NORMAL_DESCRIPTIVE"] : ["CASE_MCQ", "CASE_DESCRIPTIVE"];
  return {
    courseId,
    academyId,
    status: "PUBLISHED",
    deletedAt: null,
    kind: { in: kinds },
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.chapterId ? { chapterId: input.chapterId } : {}),
    ...(input.lessonId ? { lessonId: input.lessonId } : {}),
    ...(input.topicId ? { topicId: input.topicId } : {}),
    ...(input.collection ? { practiceCollection: input.collection } : {}),
    ...(input.year ? { practiceYear: input.year } : {}),
    ...(input.answerFormat === "MCQ" ? { correctOptionId: { not: null }, options: { some: {} } } : {}),
    ...(input.answerFormat === "CASE_STUDY" ? { subQuestions: { some: {} } } : {}),
  };
}

async function validateSource(userId: string, input: SourceInput) {
  const course = await selectedCourse(userId);
  return { course, policy: await hasPaidPracticePolicy(userId) ? "PAID" as const : "FREE" as const };
}

function validateFilterRules(input: FilterInput) {
  if (input.year !== undefined && (input.year < 1900 || input.year > 2100)) throw badRequest("INVALID_PRACTICE_YEAR", "Choose a valid Archive year.");
  if (input.questionCount < 1 || input.questionCount > 100) throw badRequest("INVALID_QUESTION_COUNT", "Choose between 1 and 100 questions.");
  if (input.timerSeconds !== undefined && (input.timerSeconds < 30 || input.timerSeconds > 86_400)) throw badRequest("INVALID_PRACTICE_TIMER", "Choose a timer between 30 seconds and 24 hours, or turn it off.");
}

export async function listPracticeSources(userId: string) {
  const course = await selectedCourse(userId);
  const [questionCount, years] = await Promise.all([
    prisma.question.count({ where: { courseId: course.id, academyId: course.academyId, status: "PUBLISHED", deletedAt: null } }),
    prisma.question.findMany({ where: { courseId: course.id, academyId: course.academyId, status: "PUBLISHED", deletedAt: null, practiceYear: { not: null } }, distinct: ["practiceYear"], orderBy: { practiceYear: "desc" }, select: { practiceYear: true }, take: 100 }),
  ]);
  return {
    course: { id: course.id, code: course.code, name: course.name },
    practice: { id: "practice", kind: "ARCHIVE" as const, title: "Practice questions", free: true, questionCount, years: years.flatMap((item) => item.practiceYear === null ? [] : [item.practiceYear]) },
  };
}

export async function getPracticeFilters(userId: string, input: SourceInput) {
  const source = await validateSource(userId, input);
  const base: Prisma.QuestionWhereInput = { courseId: source.course.id, academyId: source.course.academyId, status: "PUBLISHED", deletedAt: null };
  const [subjects, collections, years] = await Promise.all([
    prisma.subject.findMany({ where: { courseId: source.course.id, deletedAt: null, questions: { some: base } }, orderBy: { name: "asc" }, select: { id: true, name: true, taxonomyChapters: { where: { questions: { some: base } }, orderBy: { name: "asc" }, select: { id: true, name: true, lessons: { orderBy: { name: "asc" }, select: { id: true, name: true, topics: { orderBy: { name: "asc" }, select: { id: true, name: true } } } } } } } }),
    prisma.question.findMany({ where: base, distinct: ["practiceCollection"], select: { practiceCollection: true }, take: 10 }),
    prisma.question.findMany({ where: { ...base, practiceYear: { not: null } }, distinct: ["practiceYear"], orderBy: { practiceYear: "desc" }, select: { practiceYear: true }, take: 100 }),
  ]);
  return { sourceKind: input.sourceKind, accessPolicy: source.policy, subjects, collections: collections.map((item) => item.practiceCollection), years: years.flatMap((item) => item.practiceYear === null ? [] : [item.practiceYear]), capabilities: { yearFilter: true, retryWrong: source.policy === "PAID", explanationAfterWrong: source.policy === "PAID" } };
}

async function candidates(userId: string, input: FilterInput) {
  validateFilterRules(input);
  const source = await validateSource(userId, input);
  const questions = await prisma.question.findMany({
    where: questionWhere(source.course.id, source.course.academyId, input),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
    select: {
      id: true, kind: true, difficulty: true, questionHtml: true, caseHtml: true, answerHtml: true, correctOptionId: true, correctExplanationHtml: true, premiumWrongOptionsExplanationHtml: true, subjectId: true, chapterId: true, lessonId: true, topicId: true,
      options: { orderBy: { displayOrder: "asc" }, select: { optionLabel: true, html: true, displayOrder: true } },
      subQuestions: { orderBy: { displayOrder: "asc" }, select: { id: true, questionHtml: true, answerHtml: true, correctOptionId: true, correctExplanationHtml: true, premiumWrongOptionsExplanationHtml: true, subjectId: true, chapterId: true, lessonId: true, topicId: true, options: { orderBy: { displayOrder: "asc" }, select: { optionLabel: true, html: true, displayOrder: true } } } },
    },
  });
  const expanded: PracticeCandidate[] = [];
  for (const question of questions) {
    if (question.kind.startsWith("CASE_")) {
      for (const sub of question.subQuestions) expanded.push({ questionId: question.id, subQuestionId: sub.id, kind: question.kind, difficulty: question.difficulty, promptHtml: sub.questionHtml, caseHtml: question.caseHtml, options: sub.options, correctOptionLabel: sub.correctOptionId, answerHtml: sub.answerHtml, correctExplanationHtml: sub.correctExplanationHtml, premiumWrongExplanationHtml: sub.premiumWrongOptionsExplanationHtml, subjectId: sub.subjectId ?? question.subjectId, chapterId: sub.chapterId ?? question.chapterId, lessonId: sub.lessonId ?? question.lessonId, topicId: sub.topicId ?? question.topicId });
    } else {
      expanded.push({ questionId: question.id, subQuestionId: null, kind: question.kind, difficulty: question.difficulty, promptHtml: question.questionHtml, caseHtml: "", options: question.options, correctOptionLabel: question.correctOptionId, answerHtml: question.answerHtml, correctExplanationHtml: question.correctExplanationHtml, premiumWrongExplanationHtml: question.premiumWrongOptionsExplanationHtml, subjectId: question.subjectId, chapterId: question.chapterId, lessonId: question.lessonId, topicId: question.topicId });
    }
  }
  return { source, expanded };
}

export async function previewPracticeSet(userId: string, input: FilterInput) {
  const result = await candidates(userId, input);
  const eligible = result.expanded.length;
  if (!eligible) throw notFound("FILTER_COMBINATION_EMPTY", "No published questions match these filters.");
  return { eligibleQuestionCount: eligible, selectedQuestionCount: Math.min(input.questionCount, eligible), timerSeconds: input.timerSeconds ?? null, accessPolicy: result.source.policy, normalized: input };
}

export async function createPracticeSession(userId: string, input: FilterInput) {
  const result = await candidates(userId, input);
  const selected = result.expanded.slice(0, input.questionCount);
  if (!selected.length) throw notFound("FILTER_COMBINATION_EMPTY", "No published questions match these filters.");
  const now = new Date();
  const expiresAt = input.timerSeconds ? new Date(now.getTime() + input.timerSeconds * 1000) : null;
  return prisma.practiceSession.create({
    data: {
      userId, courseId: result.source.course.id, sourceKind: "ARCHIVE", subjectId: input.subjectId, chapterId: input.chapterId, lessonId: input.lessonId, topicId: input.topicId, collection: input.collection, year: input.year, answerFormat: input.answerFormat, accessPolicy: result.source.policy, timerSeconds: input.timerSeconds, questionCount: selected.length, expiresAt,
      questions: { create: selected.map((question, index) => ({ questionId: question.questionId, subQuestionId: question.subQuestionId, sequence: index + 1, kind: question.kind, difficulty: question.difficulty, promptHtml: question.promptHtml, caseHtml: question.caseHtml, optionsSnapshot: question.options as Prisma.InputJsonValue, correctOptionLabel: question.correctOptionLabel, answerHtml: question.answerHtml, correctExplanationHtml: question.correctExplanationHtml, premiumWrongExplanationHtml: question.premiumWrongExplanationHtml, subjectId: question.subjectId, chapterId: question.chapterId, lessonId: question.lessonId, topicId: question.topicId })) },
    },
    select: { id: true, sourceKind: true, answerFormat: true, accessPolicy: true, questionCount: true, timerSeconds: true, startedAt: true, expiresAt: true, status: true },
  });
}

async function ownedSession(userId: string, sessionId: string) {
  const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, userId }, select: { id: true, userId: true, courseId: true, sourceKind: true, answerFormat: true, accessPolicy: true, timerSeconds: true, questionCount: true, answeredCount: true, correctCount: true, wrongCount: true, markedReviewCount: true, status: true, startedAt: true, expiresAt: true, completedAt: true } });
  if (!session) throw notFound("PRACTICE_SESSION_NOT_FOUND", "The practice session was not found.");
  if (session.status === "ACTIVE" && session.expiresAt && session.expiresAt <= new Date()) {
    await prisma.practiceSession.updateMany({ where: { id: session.id, status: "ACTIVE" }, data: { status: "EXPIRED", completedAt: new Date() } });
    return { ...session, status: "EXPIRED" as const };
  }
  return session;
}

function prompt(question: { id: string; sequence: number; kind: QuestionKind; difficulty: string; promptHtml: string; caseHtml: string; optionsSnapshot: Prisma.JsonValue; navigatorState: string; attemptCount: number; final: boolean }) {
  return { id: question.id, sequence: question.sequence, kind: question.kind, difficulty: question.difficulty, promptHtml: question.promptHtml, caseHtml: question.caseHtml || null, options: question.optionsSnapshot, navigatorState: question.navigatorState, attemptCount: question.attemptCount, final: question.final };
}

export async function getPracticeSession(userId: string, sessionId: string) {
  const session = await ownedSession(userId, sessionId);
  const questions = await prisma.practiceSessionQuestion.findMany({ where: { sessionId }, orderBy: { sequence: "asc" }, select: { id: true, sequence: true, navigatorState: true, attemptCount: true, final: true } });
  return { ...session, navigator: questions };
}

export async function listSessionQuestions(userId: string, sessionId: string, page: number, limit: number) {
  const session = await ownedSession(userId, sessionId);
  const [questions, total] = await Promise.all([
    prisma.practiceSessionQuestion.findMany({ where: { sessionId }, skip: (page - 1) * limit, take: limit, orderBy: { sequence: "asc" }, select: { id: true, sequence: true, kind: true, difficulty: true, promptHtml: true, caseHtml: true, optionsSnapshot: true, navigatorState: true, attemptCount: true, final: true } }),
    prisma.practiceSessionQuestion.count({ where: { sessionId } }),
  ]);
  return { session: { id: session.id, status: session.status, accessPolicy: session.accessPolicy, expiresAt: session.expiresAt }, items: questions.map(prompt), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

function releasedExplanation(question: { answerHtml: string; correctExplanationHtml: string; premiumWrongExplanationHtml: string }, correct: boolean | null) {
  if (correct === false) return question.premiumWrongExplanationHtml || question.correctExplanationHtml || question.answerHtml || null;
  return question.correctExplanationHtml || question.answerHtml || null;
}

async function refreshSessionCounters(tx: Prisma.TransactionClient, sessionId: string) {
  const questions = await tx.practiceSessionQuestion.findMany({ where: { sessionId }, select: { navigatorState: true, attemptCount: true, final: true } });
  const answeredCount = questions.filter((item) => item.attemptCount > 0).length;
  const correctCount = questions.filter((item) => item.navigatorState === "ANSWERED_CORRECT").length;
  const wrongCount = questions.filter((item) => item.navigatorState === "ANSWERED_WRONG" || item.navigatorState === "LOCKED_WRONG").length;
  const markedReviewCount = questions.filter((item) => item.navigatorState === "MARKED_REVIEW").length;
  const allFinal = questions.length > 0 && questions.every((item) => item.final);
  return tx.practiceSession.update({ where: { id: sessionId }, data: { answeredCount, correctCount, wrongCount, markedReviewCount, ...(allFinal ? { status: "COMPLETED", completedAt: new Date() } : {}) }, select: { id: true, status: true, answeredCount: true, correctCount: true, wrongCount: true, markedReviewCount: true, completedAt: true } });
}

export async function submitAttempt(userId: string, sessionId: string, sessionQuestionId: string, input: { clientAttemptId: string; answerOptionLabel?: string; answerText?: string; durationMs?: number }) {
  const session = await ownedSession(userId, sessionId);
  const existing = await prisma.practiceAttempt.findFirst({ where: { sessionQuestionId, clientAttemptId: input.clientAttemptId, userId, sessionQuestion: { sessionId } }, include: { sessionQuestion: true } });
  if (existing) return { attempt: { id: existing.id, attemptNumber: existing.attemptNumber, correct: existing.correct, createdAt: existing.createdAt }, result: { navigatorState: existing.sessionQuestion.navigatorState, retryAllowed: !existing.sessionQuestion.final, explanation: existing.explanationReleased ? releasedExplanation(existing.sessionQuestion, existing.correct) : null }, replay: true };
  if (session.status !== "ACTIVE") {
    const locked = await prisma.practiceSessionQuestion.findFirst({ where: { id: sessionQuestionId, sessionId, navigatorState: "LOCKED_WRONG" }, select: { id: true } });
    if (locked) throw forbidden("WRONG_RETRY_PAID_REQUIRED", "Free Archive questions cannot be retried after an incorrect answer.");
    throw conflict(session.status === "EXPIRED" ? "SESSION_EXPIRED" : "SESSION_NOT_ACTIVE", "This practice session no longer accepts answers.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const question = await tx.practiceSessionQuestion.findFirst({ where: { id: sessionQuestionId, sessionId }, include: { session: { select: { accessPolicy: true, status: true } } } });
      if (!question) throw notFound("SESSION_QUESTION_NOT_FOUND", "The practice question was not found in this session.");
      if (question.final) {
        if (question.navigatorState === "LOCKED_WRONG") throw forbidden("WRONG_RETRY_PAID_REQUIRED", "Free Archive questions cannot be retried after an incorrect answer.");
        throw conflict("ANSWER_ALREADY_FINAL", "This question already has a final answer.");
      }
      const isMcq = question.kind === "NORMAL_MCQ" || question.kind === "CASE_MCQ";
      const option = input.answerOptionLabel?.trim().toUpperCase();
      const text = input.answerText?.trim();
      if (isMcq && (!option || !/^[A-Z]$/.test(option))) throw badRequest("ANSWER_OPTION_REQUIRED", "Choose one answer option.");
      if (!isMcq && !text) throw badRequest("ANSWER_TEXT_REQUIRED", "Enter an answer before submitting.");
      const correct = isMcq ? option === question.correctOptionLabel : null;
      const paid = question.session.accessPolicy === "PAID";
      const explanationReleased = paid || correct === true;
      const final = correct === true || correct === null || !paid;
      const navigatorState = correct === true ? "ANSWERED_CORRECT" as const : correct === null ? "AWAITING_REVIEW" as const : paid ? "ANSWERED_WRONG" as const : "LOCKED_WRONG" as const;
      const attemptNumber = question.attemptCount + 1;
      const attempt = await tx.practiceAttempt.create({ data: { userId, sessionQuestionId, attemptNumber, clientAttemptId: input.clientAttemptId, answerOptionLabel: option, answerText: text, correct, durationMs: input.durationMs, explanationReleased }, select: { id: true, attemptNumber: true, correct: true, createdAt: true } });
      const updated = await tx.practiceSessionQuestion.update({ where: { id: question.id }, data: { attemptCount: attemptNumber, navigatorState, final, lastAttemptAt: new Date() } });
      const summary = await refreshSessionCounters(tx, sessionId);
      return { attempt, result: { navigatorState: updated.navigatorState, retryAllowed: !updated.final, explanation: explanationReleased ? releasedExplanation(question, correct) : null }, session: summary, replay: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await prisma.practiceAttempt.findFirst({ where: { sessionQuestionId, clientAttemptId: input.clientAttemptId, userId }, include: { sessionQuestion: true } });
      if (replay) return { attempt: { id: replay.id, attemptNumber: replay.attemptNumber, correct: replay.correct, createdAt: replay.createdAt }, result: { navigatorState: replay.sessionQuestion.navigatorState, retryAllowed: !replay.sessionQuestion.final, explanation: replay.explanationReleased ? releasedExplanation(replay.sessionQuestion, replay.correct) : null }, replay: true };
    }
    throw error;
  }
}

export async function setMarkedForReview(userId: string, sessionId: string, sessionQuestionId: string, marked: boolean) {
  const session = await ownedSession(userId, sessionId);
  if (session.status !== "ACTIVE") throw conflict("SESSION_NOT_ACTIVE", "This practice session is no longer active.");
  return prisma.$transaction(async (tx) => {
    const question = await tx.practiceSessionQuestion.findFirst({ where: { id: sessionQuestionId, sessionId } });
    if (!question) throw notFound("SESSION_QUESTION_NOT_FOUND", "The practice question was not found in this session.");
    if (question.final || question.attemptCount > 0) throw conflict("ANSWER_STATE_FINAL", "Answered questions cannot be changed to review-only state.");
    const updated = await tx.practiceSessionQuestion.update({ where: { id: question.id }, data: { navigatorState: marked ? "MARKED_REVIEW" : "UNANSWERED" }, select: { id: true, sequence: true, navigatorState: true } });
    await refreshSessionCounters(tx, sessionId);
    return updated;
  });
}

export async function completePracticeSession(userId: string, sessionId: string) {
  const session = await ownedSession(userId, sessionId);
  if (session.status === "EXPIRED") throw conflict("SESSION_EXPIRED", "This practice timer has expired.");
  if (session.status === "COMPLETED") return getPracticeSession(userId, sessionId);
  await prisma.practiceSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  return getPracticeSession(userId, sessionId);
}

export async function getPracticeTracker(userId: string) {
  const course = await selectedCourse(userId);
  const paid = await hasPaidPracticePolicy(userId);
  const timezone = (await prisma.learnerPreference.findUnique({ where: { userId }, select: { timezone: true } }))?.timezone ?? "Asia/Kolkata";
  const rows = await prisma.practiceSessionQuestion.findMany({
    where: { session: { userId, courseId: course.id }, attemptCount: { gt: 0 } },
    take: 10_000,
    select: { id: true, questionId: true, subjectId: true, chapterId: true, topicId: true, navigatorState: true, attemptCount: true, attempts: { select: { correct: true, durationMs: true, createdAt: true } } },
  });
  const subjectIds = [...new Set(rows.flatMap((row) => row.subjectId ? [row.subjectId] : []))];
  const chapterIds = [...new Set(rows.flatMap((row) => row.chapterId ? [row.chapterId] : []))];
  const topicIds = [...new Set(rows.flatMap((row) => row.topicId ? [row.topicId] : []))];
  const [subjects, chapters, topics] = await Promise.all([
    prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }),
    prisma.taxonomyChapter.findMany({ where: { id: { in: chapterIds } }, select: { id: true, name: true, subject: { select: { id: true, name: true } } } }),
    prisma.taxonomyTopic.findMany({ where: { id: { in: topicIds } }, select: { id: true, name: true, lesson: { select: { chapter: { select: { id: true, name: true, subject: { select: { id: true, name: true } } } } } } } }),
  ]);
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  type Metrics = { questionIds: Set<string>; attempts: number; correct: number; wrong: number; durationMs: number };
  const emptyMetrics = (): Metrics => ({ questionIds: new Set(), attempts: 0, correct: 0, wrong: 0, durationMs: 0 });
  const subjectTotals = new Map<string, Metrics>();
  const chapterTotals = new Map<string, Metrics>();
  const topicTotals = new Map<string, Metrics>();
  const dailyTotals = new Map<string, { attempts: number; correct: number; wrong: number; durationMs: number }>();
  const add = (map: Map<string, Metrics>, id: string, row: typeof rows[number]) => {
    const current = map.get(id) ?? emptyMetrics();
    current.questionIds.add(row.questionId);
    current.attempts += row.attempts.length;
    current.correct += row.attempts.filter((attempt) => attempt.correct === true).length;
    current.wrong += row.attempts.filter((attempt) => attempt.correct === false).length;
    current.durationMs += row.attempts.reduce((sum, attempt) => sum + (attempt.durationMs ?? 0), 0);
    map.set(id, current);
  };
  for (const row of rows) {
    if (row.subjectId) add(subjectTotals, row.subjectId, row);
    if (row.chapterId) add(chapterTotals, row.chapterId, row);
    if (row.topicId) add(topicTotals, row.topicId, row);
    for (const attempt of row.attempts) {
      const date = learnerDateKey(attempt.createdAt, timezone);
      const day = dailyTotals.get(date) ?? { attempts: 0, correct: 0, wrong: 0, durationMs: 0 };
      day.attempts += 1;
      day.correct += attempt.correct === true ? 1 : 0;
      day.wrong += attempt.correct === false ? 1 : 0;
      day.durationMs += attempt.durationMs ?? 0;
      dailyTotals.set(date, day);
    }
  }
  const metric = (value: Metrics) => ({ questionsSolved: value.questionIds.size, attempts: value.attempts, correct: value.correct, wrong: value.wrong, durationMs: value.durationMs, accuracyPercent: value.correct + value.wrong ? Math.round(value.correct / (value.correct + value.wrong) * 100) : null });
  const subjectMetrics = [...subjectTotals].flatMap(([id, value]) => subjectMap.has(id) ? [{ subjectId: id, subjectName: subjectMap.get(id)!.name, ...metric(value) }] : []);
  const chapterMetrics = [...chapterTotals].flatMap(([id, value]) => chapterMap.has(id) ? [{ chapterId: id, chapterName: chapterMap.get(id)!.name, subject: chapterMap.get(id)!.subject, ...metric(value) }] : []);
  const topicMetrics = [...topicTotals].flatMap(([id, value]) => topicMap.has(id) ? [{ topicId: id, topicName: topicMap.get(id)!.name, chapter: { id: topicMap.get(id)!.lesson.chapter.id, name: topicMap.get(id)!.lesson.chapter.name }, subject: topicMap.get(id)!.lesson.chapter.subject, ...metric(value) }] : []);
  const uniqueQuestions = new Set(rows.map((row) => row.questionId)).size;
  const attempts = rows.flatMap((row) => row.attempts);
  const weakAreas = paid ? topicMetrics.filter((item) => item.wrong >= 2 && (item.accuracyPercent ?? 100) < 60).sort((a, b) => (a.accuracyPercent ?? 100) - (b.accuracyPercent ?? 100) || b.wrong - a.wrong) : null;
  return {
    course: { id: course.id, code: course.code, name: course.name },
    totals: { questionsSolved: uniqueQuestions, attempts: attempts.length, correct: attempts.filter((attempt) => attempt.correct === true).length, wrong: attempts.filter((attempt) => attempt.correct === false).length, durationMs: attempts.reduce((sum, attempt) => sum + (attempt.durationMs ?? 0), 0) },
    subjects: subjectMetrics,
    chapters: chapterMetrics,
    topics: topicMetrics,
    activity: [...dailyTotals].sort(([left], [right]) => left.localeCompare(right)).slice(-30).map(([date, value]) => ({ date, ...value })),
    weakAreas,
    capabilities: { conceptWeakAreas: paid, weakAreaGranularity: "TOPIC" as const },
  };
}
