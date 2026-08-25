import express, { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../middleware/async-route.js";
import * as content from "../services/contentService.js";

const uuid = z.string().min(1).max(120);
const entityType = z.enum(["EXAM", "STAGE", "SUBJECT", "CHAPTER", "COURSE", "CATEGORY", "LESSON", "STUDY_MATERIAL", "GOVERNMENT_DOCUMENT", "QUESTION_PAPER", "REFERENCE_MATERIAL", "PREMIUM_NOTE", "MEDIA", "OTHER"]);
const academyScope = (req: Express.Request) => ({ academyId: req.tenantContext!.academyId!, actorId: req.auth!.userId });
// The global Super Admin content workspace owns only platform resources.
// Academy resources are reachable exclusively through the academy-scoped router.
const adminScope = (req: Express.Request) => ({ academyId: req.tenantContext?.academyId ?? undefined, actorId: req.auth!.userId });

export function createContentRouter(kind: "admin" | "academy") {
  const router = Router();
  const scope = kind === "admin" ? adminScope : academyScope;
  router.get("/", asyncRoute(async (req, res) => {
    const query = z.object({ courseId: uuid, parentId: z.union([uuid, z.literal("all")]).nullish(), search: z.string().trim().max(120).optional(), includeArchived: z.coerce.boolean().default(false), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(1000).default(25) }).parse(req.query);
    res.json(await content.listContent(scope(req), query));
  }));
  router.post("/folders", asyncRoute(async (req, res) => {
    const body = z.object({ courseId: uuid, parentId: uuid.nullish(), name: z.string().min(1).max(180), description: z.string().max(2_000).optional(), displayOrder: z.number().int().min(0).max(1_000_000).optional() }).strict().parse(req.body);
    res.status(201).json(await content.createFolder(scope(req), body));
  }));
  router.post("/upload-intents", asyncRoute(async (req, res) => {
    const body = z.object({ courseId: uuid, parentId: uuid.nullish(), fileName: z.string().min(1).max(255), mimeType: z.string().min(3).max(120), sizeBytes: z.number().int().positive(), checksumSha256: z.string().length(64), purpose: z.enum(["CONTENT", "ACADEMY_LOGO", "BROADCAST_IMAGE"]).optional() }).strict().parse(req.body);
    res.status(201).json(await content.createUploadIntent(scope(req), body));
  }));
  router.post("/uploads/:uploadId/binary", express.raw({ type: "*/*", limit: "100mb" }), asyncRoute(async (req, res) => {
    const uploadId = uuid.parse(req.params.uploadId);
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    res.json(await content.uploadProxy(scope(req), uploadId, buffer));
  }));
  router.post("/uploads/:uploadId/finalize", asyncRoute(async (req, res) => {
    const academicFinalizeSchema = z.object({ parentId: uuid.nullish(), description: z.string().max(2_000).optional(), entityType: entityType.exclude(["PREMIUM_NOTE"]).optional(), displayOrder: z.number().int().min(0).max(1_000_000).optional() }).strict();
    const adminFinalizeSchema = academicFinalizeSchema.extend({ entityType: entityType.optional(), accessType: z.enum(["FREE", "PAID"]).optional(), price: z.number().positive().max(9_999_999).optional() }).strict();
    const body = (kind === "academy" ? academicFinalizeSchema : adminFinalizeSchema).parse(req.body);
    res.status(201).json(await content.finalizeUpload(scope(req), uuid.parse(req.params.uploadId), body));
  }));
  router.get("/locations", asyncRoute(async (req, res) => { const query = z.object({ courseId: uuid, folderId: uuid.nullish() }).parse(req.query); res.json(await content.getLocation(scope(req), query.courseId, query.folderId)); }));
  router.patch("/locations", asyncRoute(async (req, res) => { const body = z.object({ courseId: uuid, folderId: uuid.nullish(), pageHeading: z.string().trim().min(1).max(160) }).strict().parse(req.body); res.json(await content.updateLocation(scope(req), body.courseId, body.folderId ?? null, body.pageHeading)); }));
  // Static routes must precede /:contentId or Express will treat "display-orders" as an item id.
  router.patch("/display-orders", asyncRoute(async (req, res) => { const body = z.object({ courseId: uuid, folderId: uuid.nullish(), itemIds: z.array(uuid) }).strict().parse(req.body); await content.updateDisplayOrders(scope(req), body.courseId, body.folderId ?? null, body.itemIds); res.json({ success: true }); }));
  router.get("/:contentId", asyncRoute(async (req, res) => { res.json(await content.getContent(scope(req), uuid.parse(req.params.contentId))); }));
  if (kind === "admin") {
    router.post("/:contentId/sample-images/upload-intent", asyncRoute(async (req, res) => { const body = z.object({ fileName: z.string().min(1).max(180), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024), checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i) }).strict().parse(req.body); res.status(201).json(await content.createSampleImageUpload(scope(req), uuid.parse(req.params.contentId), body)); }));
    router.post("/:contentId/sample-images/finalize", asyncRoute(async (req, res) => { const body = z.object({ uploadId: uuid, displayOrder: z.number().int().min(0).max(1_000_000).optional() }).strict().parse(req.body); res.status(201).json(await content.finalizeSampleImage(scope(req), uuid.parse(req.params.contentId), body.uploadId, body.displayOrder)); }));
    router.delete("/:contentId/sample-images/:imageId", asyncRoute(async (req, res) => { res.json(await content.deleteSampleImage(scope(req), uuid.parse(req.params.contentId), uuid.parse(req.params.imageId))); }));
    const section = z.object({ heading: z.string().trim().min(1).max(200), content: z.string().min(1).max(50_000), displayOrder: z.number().int().min(0).max(1_000_000).optional() }).strict();
    router.post("/:contentId/store-sections", asyncRoute(async (req, res) => { res.status(201).json(await content.createStoreSection(scope(req), uuid.parse(req.params.contentId), section.parse(req.body))); }));
    router.patch("/:contentId/store-sections/:sectionId", asyncRoute(async (req, res) => { res.json(await content.updateStoreSection(scope(req), uuid.parse(req.params.contentId), uuid.parse(req.params.sectionId), section.partial().refine((value) => Object.keys(value).length > 0).parse(req.body))); }));
    router.delete("/:contentId/store-sections/:sectionId", asyncRoute(async (req, res) => { res.json(await content.deleteStoreSection(scope(req), uuid.parse(req.params.contentId), uuid.parse(req.params.sectionId))); }));
  }
  router.get("/:contentId/download", asyncRoute(async (req, res) => { res.json(await content.getContentAccessUrl(scope(req), uuid.parse(req.params.contentId), "download")); }));
  router.get("/:contentId/preview", asyncRoute(async (req, res) => { res.json(await content.getContentAccessUrl(scope(req), uuid.parse(req.params.contentId), "preview")); }));
  router.patch("/:contentId", asyncRoute(async (req, res) => {
    const baseUpdate = z.object({ name: z.string().min(1).max(180).optional(), description: z.string().max(2_000).optional(), entityType: entityType.exclude(["PREMIUM_NOTE"]).optional(), status: z.enum(["PUBLISHED", "ARCHIVED"]).optional(), displayOrder: z.number().int().min(0).max(1_000_000).optional() });
    const adminUpdate = baseUpdate.extend({ entityType: entityType.optional(), accessType: z.enum(["FREE", "PAID"]).optional(), price: z.number().positive().max(9_999_999).nullable().optional(), applyToChildren: z.boolean().optional(), storeSections: z.array(z.object({ id: z.string().optional(), heading: z.string().max(200), content: z.string().max(2_000), displayOrder: z.number().int().optional() })).optional() });
    const body = (kind === "academy" ? baseUpdate : adminUpdate).strict().refine((value) => Object.keys(value).length > 0).parse(req.body);
    res.json(await content.updateContent(scope(req), uuid.parse(req.params.contentId), body));
  }));
  router.post("/:contentId/move", asyncRoute(async (req, res) => { const body = z.object({ parentId: uuid.nullable() }).strict().parse(req.body); res.json(await content.moveContent(scope(req), uuid.parse(req.params.contentId), body.parentId)); }));
  router.post("/:contentId/copy", asyncRoute(async (req, res) => { const body = z.object({ parentId: uuid.nullable() }).strict().parse(req.body); const result = await content.copyContent(scope(req), uuid.parse(req.params.contentId), body.parentId); res.status("accepted" in result ? 202 : 201).json(result); }));
  router.delete("/:contentId", asyncRoute(async (req, res) => { res.json(await content.archiveContent(scope(req), uuid.parse(req.params.contentId))); }));
  router.post("/:contentId/restore", asyncRoute(async (req, res) => { res.json(await content.archiveContent(scope(req), uuid.parse(req.params.contentId), true)); }));
  return router;
}
