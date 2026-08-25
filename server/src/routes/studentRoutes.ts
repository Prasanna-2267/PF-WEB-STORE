import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../middleware/async-route.js";
import * as student from "../services/studentService.js";

const uuid = z.string().uuid();
export const studentDomainRouter = Router();
studentDomainRouter.get("/me", asyncRoute(async (req, res) => { res.json(await student.getProfile(req.auth!.userId)); }));
studentDomainRouter.patch("/me", asyncRoute(async (req, res) => { const body = z.object({ fullName: z.string().trim().min(2).max(120).optional(), phone: z.string().trim().min(7).max(30).nullable().optional() }).strict().refine((value) => Object.keys(value).length > 0).parse(req.body); res.json(await student.updateProfile(req.auth!.userId, body)); }));
studentDomainRouter.get("/memberships", asyncRoute(async (req, res) => { res.json(await student.getMemberships(req.auth!.userId)); }));
studentDomainRouter.get("/active-academy", asyncRoute(async (req, res) => { res.json(await student.getActiveAcademy(req.auth!.userId)); }));
studentDomainRouter.put("/active-academy", asyncRoute(async (req, res) => { const body = z.object({ academyId: uuid }).strict().parse(req.body); res.json(await student.setActiveAcademy(req.auth!.userId, body.academyId)); }));
studentDomainRouter.get("/dashboard", asyncRoute(async (req, res) => { const query = z.object({ academyId: uuid.optional() }).parse(req.query); res.json(await student.getDashboard(req.auth!.userId, query.academyId)); }));
studentDomainRouter.get("/courses", asyncRoute(async (req, res) => { const query = z.object({ academyId: uuid.optional() }).parse(req.query); res.json(await student.listCourses(req.auth!.userId, query.academyId)); }));
studentDomainRouter.get("/courses/:courseId", asyncRoute(async (req, res) => { res.json(await student.getCourse(req.auth!.userId, uuid.parse(req.params.courseId))); }));
studentDomainRouter.get("/courses/:courseId/content", asyncRoute(async (req, res) => { const query = z.object({ parentId: uuid.nullish() }).parse(req.query); res.json(await student.listCourseContent(req.auth!.userId, uuid.parse(req.params.courseId), query.parentId)); }));
studentDomainRouter.get("/content/:contentId/access", asyncRoute(async (req, res) => { res.json(await student.getContentAccess(req.auth!.userId, uuid.parse(req.params.contentId))); }));
studentDomainRouter.get("/orders", asyncRoute(async (req, res) => { const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).parse(req.query); res.json(await student.listOrders(req.auth!.userId, query.page, query.limit)); }));
studentDomainRouter.get("/orders/:orderId", asyncRoute(async (req, res) => { res.json(await student.getOrder(req.auth!.userId, uuid.parse(req.params.orderId))); }));
studentDomainRouter.get("/questions", asyncRoute(async (req, res) => {
  const query = z.object({
    courseId: uuid.optional(),
    subjectId: uuid.optional(),
    chapterId: uuid.optional(),
    lessonId: uuid.optional(),
    topicId: uuid.optional(),
    kind: z.enum(["NORMAL_MCQ", "NORMAL_DESCRIPTIVE", "CASE_MCQ", "CASE_DESCRIPTIVE"]).optional(),
    difficulty: z.enum(["FOUNDATION", "INTERMEDIATE", "ADVANCED"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    academyId: uuid.optional(),
  }).parse(req.query);
  const questions = await import("../services/questionService.js");
  res.json(await questions.listStudentQuestions(req.auth!.userId, query.academyId, query));
}));
