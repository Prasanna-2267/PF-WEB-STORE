import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../middleware/async-route.js";
import * as notificationService from "../services/academyNotificationService.js";
import * as templateService from "../services/notificationTemplateService.js";

export const academyNotificationRouter = Router();
const notificationType = z.enum(["ANNOUNCEMENT", "ACADEMIC_UPDATE", "EVENT", "REMINDER", "ALERT"]);
const priority = z.enum(["NORMAL", "HIGH", "URGENT"]);
const targetType = z.enum(["ALL_STUDENTS", "COURSE", "INDIVIDUAL_STUDENTS"]);
const createSchema = z.object({
  title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(10_000),
  type: notificationType.optional(), priority: priority.optional(), targetType: targetType.optional(),
  targetCourseId: z.string().uuid().optional(), studentUserIds: z.array(z.string().uuid()).max(1_000).optional(),
  scheduledAt: z.iso.datetime().optional(),
}).strict();
const updateSchema = createSchema.omit({ targetType: true, targetCourseId: true, studentUserIds: true }).partial().strict().refine((body) => Object.keys(body).length > 0, "At least one field is required.");
const listSchema = z.object({ status: z.enum(["DRAFT", "SCHEDULED", "PROCESSING", "SENT", "CANCELLED"]).optional(), type: notificationType.optional(), priority: priority.optional(), targetType: targetType.optional(), page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(50).optional() });
const templateSchema = z.object({ title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(10_000), category: z.string().trim().regex(/^[A-Za-z0-9_-]{1,50}$/).optional() }).strict();
academyNotificationRouter.get("/templates", asyncRoute(async (req, res) => { const query = z.object({ category: z.string().trim().max(50).optional() }).parse(req.query); res.json(await templateService.listTemplates(req.tenantContext!, query.category)); }));
academyNotificationRouter.post("/templates", asyncRoute(async (req, res) => { res.status(201).json(await templateService.createTemplate(req.tenantContext!, templateSchema.parse(req.body))); }));
academyNotificationRouter.patch("/templates/:templateId", asyncRoute(async (req, res) => { res.json(await templateService.updateTemplate(req.tenantContext!, z.string().uuid().parse(req.params.templateId), templateSchema.partial().refine((value) => Object.keys(value).length > 0).parse(req.body))); }));
academyNotificationRouter.delete("/templates/:templateId", asyncRoute(async (req, res) => { res.json(await templateService.deleteTemplate(req.tenantContext!, z.string().uuid().parse(req.params.templateId))); }));
academyNotificationRouter.post("/templates/:templateId/preview", asyncRoute(async (req, res) => { const body = z.object({ variables: z.record(z.string().max(50), z.string().max(500)).refine((value) => Object.keys(value).length <= 50) }).strict().parse(req.body); res.json(await templateService.previewTemplate(req.tenantContext!, z.string().uuid().parse(req.params.templateId), body.variables)); }));
academyNotificationRouter.get("/", asyncRoute(async (req, res) => {
  res.json(await notificationService.listNotifications(req.tenantContext!, listSchema.parse(req.query)));
}));
academyNotificationRouter.post("/", asyncRoute(async (req, res) => {
  res.status(201).json(await notificationService.createNotification(req.tenantContext!, createSchema.parse(req.body)));
}));
academyNotificationRouter.get("/:notificationId", asyncRoute(async (req, res) => {
  res.json(await notificationService.getNotification(req.tenantContext!, z.string().uuid().parse(req.params.notificationId)));
}));
academyNotificationRouter.patch("/:notificationId", asyncRoute(async (req, res) => {
  res.json(await notificationService.updateNotification(req.tenantContext!, z.string().uuid().parse(req.params.notificationId), updateSchema.parse(req.body)));
}));
academyNotificationRouter.post("/:notificationId/send", asyncRoute(async (req, res) => {
  const body = z.object({ channels: z.array(z.enum(["IN_APP", "EMAIL"])).min(1).max(2).default(["IN_APP"]) }).strict().parse(req.body ?? {});
  res.json(await notificationService.sendNotification(req.tenantContext!, z.string().uuid().parse(req.params.notificationId), body.channels));
}));
academyNotificationRouter.post("/:notificationId/schedule", asyncRoute(async (req, res) => {
  const body = z.object({ scheduledAt: z.iso.datetime() }).strict().parse(req.body);
  res.json(await notificationService.scheduleNotification(req.tenantContext!, z.string().uuid().parse(req.params.notificationId), body.scheduledAt));
}));
academyNotificationRouter.post("/:notificationId/cancel", asyncRoute(async (req, res) => {
  res.json(await notificationService.cancelNotification(req.tenantContext!, z.string().uuid().parse(req.params.notificationId)));
}));
academyNotificationRouter.delete("/:notificationId", asyncRoute(async (req, res) => {
  res.json(await notificationService.deleteNotification(req.tenantContext!, z.string().uuid().parse(req.params.notificationId)));
}));

export const studentNotificationRouter = Router();
studentNotificationRouter.get("/", asyncRoute(async (req, res) => {
  const query = z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(50).optional(), unreadOnly: z.enum(["true", "false"]).optional() }).parse(req.query);
  res.json(await notificationService.getStudentNotifications(req.auth!.userId, query));
}));
studentNotificationRouter.get("/unread-count", asyncRoute(async (req, res) => {
  res.json(await notificationService.getStudentUnreadCount(req.auth!.userId));
}));
studentNotificationRouter.patch("/:notificationId/read", asyncRoute(async (req, res) => {
  res.json(await notificationService.markStudentNotificationRead(req.auth!.userId, z.string().uuid().parse(req.params.notificationId)));
}));
