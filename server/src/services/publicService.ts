import { createHmac } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { notFound } from "../errors/api-error.js";
import { enqueueJob } from "./backgroundJobService.js";
import { getConfig } from "../config/env.js";

import { getStorageProvider } from "../integrations/provider-registry.js";
import { ensurePdfCoverImage } from "./contentService.js";

const money = <T extends Record<string, unknown>>(value: T) => ({ ...value, ...(value.price !== undefined ? { price: Number(value.price) } : {}) });

export async function listCatalog(input: { page: number; limit: number; search?: string; academyId?: string }) {
  const courseWhere: Prisma.CourseWhereInput = { deletedAt: null, ...(input.academyId ? { academyId: input.academyId } : {}), ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { description: { contains: input.search, mode: "insensitive" } }] } : {}) };
  const packageWhere: Prisma.PackageWhereInput = { status: "PUBLISHED", deletedAt: null, course: courseWhere };
  const paidItemWhere: Prisma.ContentItemWhereInput = { accessType: "PAID", status: "PUBLISHED", deletedAt: null, course: courseWhere };

  const [courses, packages, paidItems, totalCourses, totalPackages, totalPaidItems] = await Promise.all([
    prisma.course.findMany({ where: courseWhere, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, slug: true, code: true, name: true, description: true, academy: { select: { id: true, name: true, slug: true, logoUrl: true } }, _count: { select: { subjects: true, contentItems: true, packages: true } } } }),
    prisma.package.findMany({ where: packageWhere, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, courseId: true, title: true, slug: true, description: true, price: true, course: { select: { name: true, academy: { select: { id: true, name: true, slug: true } } } }, _count: { select: { items: true } } } }),
    prisma.contentItem.findMany({ where: paidItemWhere, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, courseId: true, name: true, description: true, price: true, entityType: true, kind: true, mimeType: true, size: true, course: { select: { name: true, academy: { select: { id: true, name: true, slug: true } } } }, sampleImages: { orderBy: { displayOrder: "asc" }, select: { id: true, name: true, displayOrder: true } }, storeSections: { orderBy: { displayOrder: "asc" }, select: { id: true, heading: true, content: true, displayOrder: true } } } }),
    prisma.course.count({ where: courseWhere }),
    prisma.package.count({ where: packageWhere }),
    prisma.contentItem.count({ where: paidItemWhere }),
  ]);

  return {
    courses,
    packages: packages.map((item) => money(item)),
    paidItems: paidItems.map((item) => ({ ...money(item), size: Number(item.size) })),
    pagination: { page: input.page, limit: input.limit, totalCourses, totalPackages, totalPaidItems },
  };
}

export async function getCatalogCourse(courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, status: "ACTIVE", deletedAt: null, academy: { status: "ACTIVE", deletedAt: null } }, include: { academy: { select: { id: true, name: true, slug: true } }, subjects: { where: { deletedAt: null }, orderBy: { name: "asc" }, take: 500 }, packages: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { title: "asc" }, take: 500, include: { items: { orderBy: { displayOrder: "asc" }, take: 2_000, include: { contentItem: { select: { id: true, name: true, description: true, entityType: true } } } } } } } });
  if (!course) throw notFound("CATALOG_COURSE_NOT_FOUND", "The published course was not found.");
  return { ...course, packages: course.packages.map((item) => money(item)) };
}

export async function getCatalogPackage(packageId: string) {
  const item = await prisma.package.findFirst({ where: { id: packageId, status: "PUBLISHED", deletedAt: null, course: { status: "ACTIVE", deletedAt: null, academy: { status: "ACTIVE", deletedAt: null } } }, include: { course: { select: { id: true, name: true, academy: { select: { id: true, name: true, slug: true } } } }, items: { orderBy: { displayOrder: "asc" }, take: 2_000, include: { contentItem: { select: { id: true, name: true, description: true, entityType: true, mimeType: true, kind: true, size: true, accessType: true } } } } } });
  if (!item) throw notFound("CATALOG_PACKAGE_NOT_FOUND", "The published package was not found.");
  return money({
    ...item,
    items: item.items.map((i) => ({ ...i, contentItem: { ...i.contentItem, size: Number(i.contentItem.size) } })),
  });
}

export async function getCatalogContent(contentId: string) {
  let item = await prisma.contentItem.findFirst({
    where: { id: contentId, accessType: "PAID", status: "PUBLISHED", deletedAt: null },
    include: {
      course: { select: { id: true, name: true, code: true, slug: true, academy: { select: { id: true, name: true, slug: true } } } },
      sampleImages: { orderBy: [{ role: "asc" }, { displayOrder: "asc" }] },
      storeSections: { orderBy: { displayOrder: "asc" } },
    },
  });
  if (!item) throw notFound("CATALOG_CONTENT_NOT_FOUND", "The published paid item was not found.");

  const existingCover = item.sampleImages.find((img) => img.role === "PDF_FIRST_PAGE");
  const needsCover = item.mimeType?.toLowerCase() === "application/pdf" && (
    !existingCover ||
    // Verify the stored object actually exists — previous broken uploads left orphaned DB rows
    await (async () => {
      try { await getStorageProvider().statObject(existingCover.storagePath); return false; } catch { return true; }
    })()
  );

  if (needsCover) {
    // Delete the broken DB record first so ensurePdfCoverImage can create a fresh one
    if (existingCover) {
      await prisma.contentSampleImage.delete({ where: { id: existingCover.id } }).catch(() => {});
    }
    await ensurePdfCoverImage(contentId);
    item = await prisma.contentItem.findFirst({
      where: { id: contentId },
      include: {
        course: { select: { id: true, name: true, code: true, slug: true, academy: { select: { id: true, name: true, slug: true } } } },
        sampleImages: { orderBy: [{ role: "asc" }, { displayOrder: "asc" }] },
        storeSections: { orderBy: { displayOrder: "asc" } },
      },
    }) as any;
  }

  const sortedSamples = [...(item?.sampleImages || [])].sort((a, b) => {
    if (a.role === "PDF_FIRST_PAGE" && b.role !== "PDF_FIRST_PAGE") return -1;
    if (a.role !== "PDF_FIRST_PAGE" && b.role === "PDF_FIRST_PAGE") return 1;
    return a.displayOrder - b.displayOrder;
  });

  const provider = getStorageProvider();
  const sampleImagesWithUrls = await Promise.all(
    sortedSamples.map(async (img) => ({
      id: img.id,
      role: img.role,
      name: img.name,
      displayOrder: img.displayOrder,
      url: await provider.createDownloadUrl(img.storagePath, 3600),
    }))
  );

  return money({
    id: item!.id,
    courseId: item!.courseId,
    name: item!.name,
    description: item!.description,
    price: item!.price,
    accessType: item!.accessType,
    entityType: item!.entityType,
    kind: item!.kind,
    mimeType: item!.mimeType,
    size: Number(item!.size),
    course: item!.course,
    sampleImages: sampleImagesWithUrls,
    previews: sampleImagesWithUrls,
    storeSections: item!.storeSections,
    highlights: item!.storeSections.map((sec) => ({ id: sec.id, heading: sec.heading, content: sec.content, displayOrder: sec.displayOrder })),
  });
}
export async function submitContact(input: { name: string; email: string; phone?: string; subject: string; message: string; academyId?: string; ipAddress?: string }) {
  const ipHash = input.ipAddress ? createHmac("sha256", getConfig().auth.jwtSecret).update(input.ipAddress).digest("hex") : undefined;
  const result = await prisma.$transaction(async (tx) => {
    if (input.academyId && !await tx.academy.findFirst({ where: { id: input.academyId, status: "ACTIVE", deletedAt: null } })) throw notFound("ACADEMY_NOT_FOUND", "The selected academy was not found.");
    const submission = await tx.contactSubmission.create({ data: { academyId: input.academyId, name: input.name.trim(), email: input.email.toLowerCase(), phone: input.phone?.trim(), subject: input.subject.trim(), message: input.message.trim(), ipHash } });
    const job = await enqueueJob({ kind: "CONTACT_EMAIL", payload: { submissionId: submission.id }, academyId: input.academyId, runAt: new Date(), deduplicationKey: submission.id }, tx);
    return { submission, job };
  });
  return { id: result.submission.id, status: "RECEIVED", delivery: { status: "QUEUED", jobId: result.job.id } };
}

export async function getStudentUserCourses(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      academyEnrollments: {
        where: { course: { status: "ACTIVE", deletedAt: null } },
        select: { course: { select: { id: true, name: true, slug: true, code: true } } },
      },
    },
  });
  return user?.academyEnrollments.map((e: any) => e.course).filter(Boolean) || [];
}
