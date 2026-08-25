import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../middleware/async-route.js";
import * as questions from "../services/questionService.js";

const uuid = z.string().uuid();
const option = z.object({
  id: z.string().optional(),
  optionLabel: z.string().optional(),
  html: z.string().min(1).max(10_000),
}).transform((opt) => ({
  optionLabel: (opt.optionLabel || opt.id || "A").toUpperCase(),
  html: opt.html,
}));

const classificationSchema = z.object({
  courseId: uuid.optional().nullable(),
  subjectId: uuid.optional().nullable(),
  chapterId: uuid.optional().nullable(),
  lessonId: uuid.optional().nullable(),
  topicId: uuid.optional().nullable(),
}).optional().nullable();

const taxonomyFields = {
  courseId: uuid.optional().nullable(),
  subjectId: uuid.optional().nullable(),
  chapterId: uuid.optional().nullable(),
  lessonId: uuid.optional().nullable(),
  topicId: uuid.optional().nullable(),
};

const subQuestion = z.object({
  questionHtml: z.string().min(1).max(50_000),
  answerHtml: z.string().max(50_000).optional().nullable(),
  correctOptionId: z.string().regex(/^[A-F]$/i).optional().nullable(),
  correctExplanationHtml: z.string().max(50_000).optional().nullable(),
  premiumWrongOptionsExplanationHtml: z.string().max(50_000).optional().nullable(),
  classification: classificationSchema,
  ...taxonomyFields,
  options: z.array(option).min(2).max(6).optional().nullable(),
}).transform((sub) => ({
  questionHtml: sub.questionHtml,
  answerHtml: sub.answerHtml || undefined,
  correctOptionId: sub.correctOptionId || undefined,
  correctExplanationHtml: sub.correctExplanationHtml || undefined,
  premiumWrongOptionsExplanationHtml: sub.premiumWrongOptionsExplanationHtml || undefined,
  courseId: sub.courseId || sub.classification?.courseId || undefined,
  subjectId: sub.subjectId || sub.classification?.subjectId || undefined,
  chapterId: sub.chapterId || sub.classification?.chapterId || undefined,
  lessonId: sub.lessonId || sub.classification?.lessonId || undefined,
  topicId: sub.topicId || sub.classification?.topicId || undefined,
  options: sub.options || undefined,
}));

const question = z.object({
  kind: z.enum(["NORMAL_MCQ", "NORMAL_DESCRIPTIVE", "CASE_MCQ", "CASE_DESCRIPTIVE"]),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  difficulty: z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED"]).optional(),
  questionHtml: z.string().max(50_000).optional().nullable(),
  answerHtml: z.string().max(50_000).optional().nullable(),
  caseHtml: z.string().max(100_000).optional().nullable(),
  classificationMode: z.enum(["ENTIRE_CASE", "INDIVIDUAL_SUB_QUESTIONS"]).optional(),
  correctOptionId: z.string().regex(/^[A-F]$/i).optional().nullable(),
  correctExplanationHtml: z.string().max(50_000).optional().nullable(),
  premiumWrongOptionsExplanationHtml: z.string().max(50_000).optional().nullable(),
  classification: classificationSchema,
  ...taxonomyFields,
  options: z.array(option).min(2).max(6).optional().nullable(),
  subQuestions: z.array(subQuestion).min(1).max(50).optional().nullable(),
}).transform((q) => ({
  kind: q.kind,
  status: q.status,
  difficulty: q.difficulty,
  questionHtml: q.questionHtml || undefined,
  answerHtml: q.answerHtml || undefined,
  caseHtml: q.caseHtml || undefined,
  classificationMode: q.classificationMode,
  correctOptionId: q.correctOptionId || undefined,
  correctExplanationHtml: q.correctExplanationHtml || undefined,
  premiumWrongOptionsExplanationHtml: q.premiumWrongOptionsExplanationHtml || undefined,
  courseId: q.courseId || q.classification?.courseId || undefined,
  subjectId: q.subjectId || q.classification?.subjectId || undefined,
  chapterId: q.chapterId || q.classification?.chapterId || undefined,
  lessonId: q.lessonId || q.classification?.lessonId || undefined,
  topicId: q.topicId || q.classification?.topicId || undefined,
  options: q.options || undefined,
  subQuestions: q.subQuestions || undefined,
}));

const academyScope = (req: Express.Request) => ({ academyId: req.tenantContext!.academyId!, actorId: req.auth!.userId });
const adminScope = (req: Express.Request) => ({ actorId: req.auth!.userId });

export function createQuestionRouter(kind: "admin" | "academy") {
  const router = Router();
  const scope = kind === "admin" ? adminScope : academyScope;

  router.get("/taxonomy", asyncRoute(async (req, res) => {
    const query = z.object({ courseId: uuid }).parse(req.query);
    res.json(await questions.getTaxonomy(scope(req), query.courseId));
  }));

  router.post("/taxonomy/:nodeKind", asyncRoute(async (req, res) => {
    const nodeKind = z.enum(["subject", "chapter", "lesson", "topic"]).parse(req.params.nodeKind);
    const body = z.object({ courseId: uuid, parentId: uuid, name: z.string().trim().min(1).max(160) }).strict().parse(req.body);
    res.status(201).json(await questions.createTaxonomyNode(scope(req), { kind: nodeKind, ...body }));
  }));

  router.patch("/taxonomy/:nodeKind/:nodeId", asyncRoute(async (req, res) => {
    const nodeKind = z.enum(["subject", "chapter", "lesson", "topic"]).parse(req.params.nodeKind);
    const body = z.object({ courseId: uuid, name: z.string().trim().min(1).max(160) }).strict().parse(req.body);
    res.json(await questions.updateTaxonomyNode(scope(req), nodeKind, uuid.parse(req.params.nodeId), body.courseId, body.name));
  }));

  router.delete("/taxonomy/:nodeKind/:nodeId", asyncRoute(async (req, res) => {
    const nodeKind = z.enum(["subject", "chapter", "lesson", "topic"]).parse(req.params.nodeKind);
    const query = z.object({ courseId: uuid }).parse(req.query);
    res.json(await questions.deleteTaxonomyNode(scope(req), nodeKind, uuid.parse(req.params.nodeId), query.courseId));
  }));

  router.get("/", asyncRoute(async (req, res) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
      kind: z.enum(["NORMAL_MCQ", "NORMAL_DESCRIPTIVE", "CASE_MCQ", "CASE_DESCRIPTIVE"]).optional(),
      difficulty: z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED"]).optional(),
      courseId: uuid.optional(),
      search: z.string().trim().max(120).optional(),
      includeDeleted: z.coerce.boolean().optional(),
    }).parse(req.query);

    res.json(await questions.listQuestions(scope(req), query));
  }));

  router.post("/", asyncRoute(async (req, res) => {
    res.status(201).json(await questions.createQuestion(scope(req), question.parse(req.body)));
  }));

  router.get("/:questionId", asyncRoute(async (req, res) => {
    res.json(await questions.getQuestion(scope(req), uuid.parse(req.params.questionId)));
  }));

  router.put("/:questionId", asyncRoute(async (req, res) => {
    res.json(await questions.updateQuestion(scope(req), uuid.parse(req.params.questionId), question.parse(req.body)));
  }));

  router.post("/:questionId/clone", asyncRoute(async (req, res) => {
    res.status(201).json(await questions.cloneQuestion(scope(req), uuid.parse(req.params.questionId)));
  }));

  for (const action of ["archive", "restore", "publish"] as const) {
    router.post(`/:questionId/${action}`, asyncRoute(async (req, res) => {
      res.json(await questions.setQuestionLifecycle(scope(req), uuid.parse(req.params.questionId), action));
    }));
  }

  router.delete("/:questionId", asyncRoute(async (req, res) => {
    res.json(await questions.permanentDeleteQuestion(scope(req), uuid.parse(req.params.questionId)));
  }));

  return router;
}
