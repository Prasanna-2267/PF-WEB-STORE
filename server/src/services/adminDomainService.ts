import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { badRequest, conflict, notFound, serviceUnavailable } from "../errors/api-error.js";

const pagination = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const normalizeSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entityType: string, entityId: string, description: string, academyId?: string, before?: Prisma.InputJsonValue, after?: Prisma.InputJsonValue) {
  await tx.systemAuditLog.create({ data: { actorId, action, entityType, entityId, description, academyId, before, after } });
}

export async function getAcademiesSummary() {
  const [
    totalAcademies,
    activeAcademies,
    pendingAcademies,
    suspendedAcademies,
    archivedAcademies,
    totalStudents,
    totalCourses,
  ] = await Promise.all([
    prisma.academy.count({ where: { deletedAt: null } }),
    prisma.academy.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.academy.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.academy.count({ where: { status: "SUSPENDED", deletedAt: null } }),
    prisma.academy.count({ where: { OR: [{ status: "ARCHIVED" }, { deletedAt: { not: null } }] } }),
    prisma.academyMembership.count({ where: { role: "ACADEMY_STUDENT", status: "ACTIVE" } }),
    prisma.course.count({ where: { deletedAt: null } }),
  ]);

  return {
    totalAcademies,
    activeAcademies,
    pendingAcademies,
    suspendedAcademies,
    archivedAcademies,
    totalStudents,
    totalCourses,
  };
}

export type AcademySortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "students" | "courses";
export type AcademyDetailResource = "students" | "courses" | "content" | "questions" | "broadcasts" | "audit";
export interface AcademyDetailPageInput { page: number; limit: number }

export async function listAcademies(input: {
  page: number;
  limit: number;
  search?: string;
  status?: "ACTIVE" | "PENDING" | "SUSPENDED" | "ARCHIVED" | "ALL";
  sort?: AcademySortOption;
  includeDeleted?: boolean;
}) {
  const where: Prisma.AcademyWhereInput = {};

  if (input.status === "ARCHIVED") {
    where.OR = [{ status: "ARCHIVED" }, { deletedAt: { not: null } }];
  } else {
    if (!input.includeDeleted && input.status !== "ALL") {
      where.deletedAt = null;
    }
    if (input.status && input.status !== "ALL") {
      where.status = input.status;
    }
  }

  if (input.search) {
    const term = input.search.trim();
    where.AND = [
      {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
          { adminName: { contains: term, mode: "insensitive" } },
          { adminEmail: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
          { city: { contains: term, mode: "insensitive" } },
        ],
      },
    ];
  }

  let orderBy: Prisma.AcademyOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];
  if (input.sort === "oldest") {
    orderBy = [{ createdAt: "asc" }, { id: "asc" }];
  } else if (input.sort === "name-asc") {
    orderBy = [{ name: "asc" }];
  } else if (input.sort === "name-desc") {
    orderBy = [{ name: "desc" }];
  }

  const [academies, total] = await Promise.all([
    prisma.academy.findMany({
      where,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      orderBy,
      include: {
        _count: {
          select: {
            memberships: { where: { role: "ACADEMY_STUDENT" } },
            tenantCourses: { where: { deletedAt: null } },
          },
        },
      },
    }),
    prisma.academy.count({ where }),
  ]);

  // Fetch real relational metrics for each academy
  const academyIds = academies.map((a) => a.id);
  const [studentCounts, courseCounts] = await Promise.all([
    prisma.academyMembership.groupBy({
      by: ["academyId"],
      where: { academyId: { in: academyIds }, role: "ACADEMY_STUDENT" },
      _count: { userId: true },
    }),
    prisma.course.groupBy({
      by: ["academyId"],
      where: { academyId: { in: academyIds }, deletedAt: null },
      _count: { id: true },
    }),
  ]);

  const studentCountMap = new Map(studentCounts.map((sc) => [sc.academyId, sc._count.userId]));
  const courseCountMap = new Map(courseCounts.map((cc) => [cc.academyId, cc.academyId ? cc._count.id : 0]));

  let data = academies.map((academy) => {
    const studentCount = studentCountMap.get(academy.id) ?? academy._count.memberships ?? 0;
    const courseCount = courseCountMap.get(academy.id) ?? academy._count.tenantCourses ?? 0;
    return {
      ...academy,
      studentCount,
      courseCount,
      revenue: Number(academy.revenue),
    };
  });

  if (input.sort === "students") {
    data.sort((a, b) => b.studentCount - a.studentCount);
  } else if (input.sort === "courses") {
    data.sort((a, b) => b.courseCount - a.courseCount);
  }

  return { data, pagination: pagination(input.page, input.limit, total) };
}

/**
 * Returns one authorised, academy-scoped page from the same operational tables
 * used by Academy Admin. This is deliberately a query projection, not a
 * platform-side copy of tenant data.
 */
export async function listAcademyDetailResource(
  academyId: string,
  resource: AcademyDetailResource,
  input: AcademyDetailPageInput,
) {
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { id: true } });
  if (!academy) throw notFound("ACADEMY_NOT_FOUND", "The academy was not found.");

  const pageResult = <T>(data: T[], total: number) => ({ data, pagination: pagination(input.page, input.limit, total) });
  const pageArgs = { skip: (input.page - 1) * input.limit, take: input.limit };

  switch (resource) {
    case "students": {
      const where = { academyId, role: "ACADEMY_STUDENT" as const };
      const [data, total] = await Promise.all([
        prisma.academyMembership.findMany({
          where, ...pageArgs, orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
          include: { user: { select: { id: true, email: true, fullName: true, phone: true, status: true, lastLoginAt: true, createdAt: true } } },
        }),
        prisma.academyMembership.count({ where }),
      ]);
      return pageResult(data, total);
    }
    case "courses": {
      const where = { academyId, deletedAt: null };
      const [data, total] = await Promise.all([
        prisma.course.findMany({
          where, ...pageArgs, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: { _count: { select: { enrollments: true, contentItems: { where: { deletedAt: null } }, packages: { where: { deletedAt: null } } } } },
        }),
        prisma.course.count({ where }),
      ]);
      return pageResult(data, total);
    }
    case "content": {
      const where = { deletedAt: null, course: { academyId, deletedAt: null } };
      const [items, total] = await Promise.all([
        prisma.contentItem.findMany({
          where, ...pageArgs, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, name: true, kind: true, mimeType: true, size: true, status: true, createdAt: true, course: { select: { id: true, name: true } } },
        }),
        prisma.contentItem.count({ where }),
      ]);
      return pageResult(items.map((item) => ({ ...item, size: Number(item.size) })), total);
    }
    case "questions": {
      const where = { academyId, deletedAt: null };
      const [data, total] = await Promise.all([
        prisma.question.findMany({
          where, ...pageArgs, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, kind: true, status: true, difficulty: true, questionHtml: true, caseHtml: true, createdAt: true, course: { select: { id: true, name: true } } },
        }),
        prisma.question.count({ where }),
      ]);
      return pageResult(data, total);
    }
    case "broadcasts": {
      const where = { academyId, deletedAt: null };
      const [data, total] = await Promise.all([
        prisma.broadcast.findMany({
          where, ...pageArgs, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, title: true, status: true, priority: true, publishedAt: true, createdAt: true },
        }),
        prisma.broadcast.count({ where }),
      ]);
      return pageResult(data, total);
    }
    case "audit": {
      const where = { academyId };
      const [logs, total] = await Promise.all([
        prisma.systemAuditLog.findMany({
          where, ...pageArgs, orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          include: { actor: { select: { id: true, fullName: true, email: true } } },
        }),
        prisma.systemAuditLog.count({ where }),
      ]);
      return pageResult(logs.map((log) => ({ ...log, actor: log.actor ?? undefined })), total);
    }
  }
}

export async function getAcademy(academyId: string) {
  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    include: {
      invitations: { take: 100, orderBy: { createdAt: "desc" } },
      systemAuditLogs: {
        take: 50,
        orderBy: { occurredAt: "desc" },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });

  if (!academy) throw notFound("ACADEMY_NOT_FOUND", "The academy was not found.");

  const [
    admins,
    students,
    tenantCourses,
    studentCount,
    activeStudentCount,
    courseCount,
    publishedCourseCount,
    contentCount,
    publishedContentCount,
    contentItems,
    questionCount,
    questionRows,
    broadcastCount,
    activeBroadcastCount,
    broadcasts,
    packages,
    orders,
    auditLogCount,
  ] = await Promise.all([
    prisma.academyMembership.findMany({
      where: { academyId, role: "ACADEMY_ADMIN" },
      take: 20,
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      include: { user: { select: { id: true, email: true, fullName: true, phone: true, status: true, lastLoginAt: true, createdAt: true } } },
    }),
    prisma.academyMembership.findMany({
      where: { academyId, role: "ACADEMY_STUDENT" },
      take: 100,
      orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      include: { user: { select: { id: true, email: true, fullName: true, phone: true, status: true, lastLoginAt: true, createdAt: true } } },
    }),
    prisma.course.findMany({
      where: { academyId, deletedAt: null },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { _count: { select: { enrollments: true, contentItems: { where: { deletedAt: null } }, packages: { where: { deletedAt: null } } } } },
    }),
    prisma.academyMembership.count({ where: { academyId, role: "ACADEMY_STUDENT" } }),
    prisma.academyMembership.count({ where: { academyId, role: "ACADEMY_STUDENT", status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null } } }),
    prisma.course.count({ where: { academyId, deletedAt: null } }),
    prisma.course.count({ where: { academyId, status: "ACTIVE", deletedAt: null } }),
    prisma.contentItem.count({ where: { deletedAt: null, course: { academyId, deletedAt: null } } }),
    prisma.contentItem.count({ where: { status: "PUBLISHED", deletedAt: null, course: { academyId, deletedAt: null } } }),
    prisma.contentItem.findMany({
      where: { deletedAt: null, course: { academyId, deletedAt: null } },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, kind: true, mimeType: true, size: true, status: true, createdAt: true, course: { select: { id: true, name: true } } },
    }),
    prisma.question.count({ where: { academyId, deletedAt: null } }),
    prisma.question.findMany({
      where: { academyId, deletedAt: null },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, kind: true, status: true, difficulty: true, questionHtml: true, caseHtml: true, createdAt: true, course: { select: { id: true, name: true } } },
    }),
    prisma.broadcast.count({ where: { academyId, deletedAt: null } }),
    prisma.broadcast.count({ where: { academyId, status: "ACTIVE", deletedAt: null } }),
    prisma.broadcast.findMany({
      where: { academyId, deletedAt: null },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, status: true, priority: true, publishedAt: true, startAt: true, createdAt: true },
    }),
    prisma.package.findMany({
      where: { course: { academyId }, deletedAt: null },
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { course: { select: { id: true, name: true } }, _count: { select: { items: true } } },
    }),
    prisma.order.findMany({
      where: { course: { academyId } },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true, user: { select: { fullName: true, email: true } } },
    }),
    prisma.systemAuditLog.count({ where: { academyId } }),
  ]);

  const paidOrders = orders.filter((o) => o.status === "PAID");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const primaryAdmin = admins.find((membership) => membership.status === "ACTIVE") ?? admins[0] ?? null;

  return {
    ...academy,
    revenue: Number(academy.revenue) || totalRevenue,
    metrics: {
      studentsCount: studentCount,
      activeStudentsCount: activeStudentCount,
      coursesCount: courseCount,
      publishedCoursesCount: publishedCourseCount,
      contentCount,
      publishedContentCount,
      packagesCount: packages.length,
      questionsCount: questionCount,
      broadcastCount,
      activeBroadcastCount,
      auditLogCount,
      ordersCount: orders.length,
      revenue: totalRevenue,
    },
    administrator: primaryAdmin ? {
      id: primaryAdmin.user.id,
      name: primaryAdmin.user.fullName,
      email: primaryAdmin.user.email,
      phone: primaryAdmin.user.phone,
      identityStatus: primaryAdmin.user.status,
      membershipStatus: primaryAdmin.status,
    } : {
      id: null,
      name: academy.adminName,
      email: academy.adminEmail,
      phone: academy.adminPhone || null,
      identityStatus: null,
      membershipStatus: "INVITED",
    },
    admins,
    students,
    memberships: [...admins, ...students],
    tenantCourses,
    contentItems: contentItems.map((item) => ({ ...item, size: Number(item.size) })),
    questions: questionRows,
    packages,
    orders,
    broadcasts,
  };
}

export interface AcademyInput { slug?: string; name: string; email: string; phone: string; address: string; city: string; state: string; country?: string; postalCode: string; website?: string; description?: string; adminName: string; adminEmail: string; adminPhone?: string }
export async function createAcademy(actorId: string, input: AcademyInput) {
  const slug = normalizeSlug(input.slug ?? input.name);
  if (slug.length < 2) throw badRequest("INVALID_ACADEMY_SLUG", "A valid academy slug is required.");
  const adminEmail = input.adminEmail.trim().toLowerCase();
  try {
    return await prisma.$transaction(async (tx) => {
      const academyAdminRole = await tx.role.findFirst({ where: { key: "ACADEMY_ADMIN", isActive: true }, select: { id: true } });
      if (!academyAdminRole) throw serviceUnavailable("IDENTITY_CONFIGURATION_ERROR", "The Academy Admin role is not available.");

      const existingUser = await tx.user.findUnique({
        where: { email: adminEmail },
        select: { id: true, deletedAt: true, role: { select: { key: true } } },
      });
      if (existingUser?.deletedAt) throw conflict("ADMIN_IDENTITY_CONFLICT", "The administrator email belongs to a deleted account.");
      if (existingUser && !["ACADEMY_ADMIN", "admin", "ACADEMY_STUDENT", "student"].includes(existingUser.role.key)) {
        throw conflict("ADMIN_IDENTITY_CONFLICT", "The administrator email already belongs to an incompatible platform identity.");
      }
      if (existingUser && await tx.academyMembership.count({ where: { userId: existingUser.id, status: "ACTIVE" } }) > 0) {
        throw conflict("ADMIN_IDENTITY_CONFLICT", "The administrator identity already has an active academy membership.");
      }

      const academy = await tx.academy.create({
        data: {
          slug, name: input.name.trim(), email: input.email.toLowerCase(), phone: input.phone.trim(),
          address: input.address.trim(), city: input.city.trim(), state: input.state.trim(),
          country: input.country?.trim() ?? "India", postalCode: input.postalCode.trim(),
          website: input.website?.trim() ?? "", description: input.description?.trim() ?? "",
          adminName: input.adminName.trim(), adminEmail, adminPhone: input.adminPhone?.trim() ?? "",
          // A Super Admin creates a trusted academy directly, so it is provisioned
          // as operational together with its administrator identity.
          status: "ACTIVE",
        },
      });
      const administrator = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: { roleId: academyAdminRole.id }, select: { id: true } })
        : await tx.user.create({
          data: {
            id: randomUUID(), email: adminEmail, fullName: input.adminName.trim(), phone: input.adminPhone?.trim() || null,
            roleId: academyAdminRole.id,
          },
          select: { id: true },
        });
      const membership = await tx.academyMembership.create({
        data: { academyId: academy.id, userId: administrator.id, role: "ACADEMY_ADMIN", status: "ACTIVE" },
      });
      await audit(tx, actorId, "ACADEMY_CREATED", "Academy", academy.id, `Created academy ${academy.name}.`, academy.id);
      await audit(tx, actorId, "ACADEMY_ADMIN_ASSIGNED", "AcademyMembership", membership.id, `Provisioned Academy Admin ${adminEmail}.`, academy.id);
      return { academy, administratorId: administrator.id, membershipId: membership.id, membershipCreated: true, authentication: "EXISTING_CREDENTIALS_OR_GOOGLE" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("ACADEMY_IDENTITY_CONFLICT", "The academy slug or email is already in use.");
    throw error;
  }
}

export async function updateAcademy(actorId: string, academyId: string, input: Partial<AcademyInput>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.academy.findFirst({ where: { id: academyId, deletedAt: null } });
    if (!existing) throw notFound("ACADEMY_NOT_FOUND", "The active academy was not found.");
    const data: Prisma.AcademyUpdateInput = {};
    for (const key of ["name", "phone", "address", "city", "state", "country", "postalCode", "website", "description", "adminName", "adminPhone"] as const) if (input[key] !== undefined) data[key] = input[key]!.trim();
    if (input.slug !== undefined) data.slug = normalizeSlug(input.slug);
    if (input.email !== undefined) data.email = input.email.toLowerCase();
    if (input.adminEmail !== undefined) data.adminEmail = input.adminEmail.toLowerCase();
    const updated = await tx.academy.update({ where: { id: academyId }, data });
    await audit(tx, actorId, "ACADEMY_UPDATED", "Academy", academyId, `Updated academy ${updated.name}.`, academyId, { name: existing.name, email: existing.email, status: existing.status }, { name: updated.name, email: updated.email, status: updated.status });
    return updated;
  });
}

export async function setAcademyLifecycle(actorId: string, academyId: string, action: "activate" | "suspend" | "archive" | "restore" | "delete") {
  return prisma.$transaction(async (tx) => {
    const academy = await tx.academy.findUnique({ where: { id: academyId } });
    if (!academy || (action !== "restore" && academy.deletedAt && action !== "archive")) throw notFound("ACADEMY_NOT_FOUND", "The academy was not found in the requested lifecycle state.");
    if ((action === "delete" || action === "archive") && await tx.order.count({ where: { course: { academyId }, status: { in: ["CREATED", "PAID"] } } }) > 0) {
      if (action === "delete") {
        throw conflict("ACADEMY_HAS_FINANCIAL_RECORDS", "Academies with financial records cannot be physically deleted; archive or suspend them instead.");
      }
    }

    let status: "ACTIVE" | "PENDING" | "SUSPENDED" | "ARCHIVED" = academy.status;
    let deletedAt: Date | null = academy.deletedAt;

    if (action === "activate") {
      status = "ACTIVE";
      deletedAt = null;
    } else if (action === "suspend") {
      status = "SUSPENDED";
    } else if (action === "archive" || action === "delete") {
      status = "ARCHIVED";
      deletedAt = new Date();
    } else if (action === "restore") {
      status = "ACTIVE";
      deletedAt = null;
    }

    const updated = await tx.academy.update({ where: { id: academyId }, data: { status, deletedAt } });
    if (action === "suspend" || action === "archive") {
      await tx.academyMembership.updateMany({ where: { academyId, status: "ACTIVE" }, data: { status: "SUSPENDED" } });
    } else if (action === "activate" || action === "restore") {
      await tx.academyMembership.updateMany({ where: { academyId, status: "SUSPENDED" }, data: { status: "ACTIVE" } });
    }
    await audit(tx, actorId, `ACADEMY_${action.toUpperCase()}D`, "Academy", academyId, `${action.toUpperCase()} academy ${academy.name}.`, academyId);
    return updated;
  });
}

export async function inviteAcademyAdmin(actorId: string, academyId: string, input: { email: string; name: string }) {
  const email = input.email.toLowerCase();
  return prisma.$transaction(async (tx) => {
    const academy = await tx.academy.findFirst({ where: { id: academyId, deletedAt: null } });
    if (!academy) throw notFound("ACADEMY_NOT_FOUND", "The academy was not found.");
    if (await tx.academyInvitation.findFirst({ where: { academyId, email, status: "PENDING" } })) throw conflict("INVITATION_ALREADY_PENDING", "A pending administrator invitation already exists for this email.");
    const user = await tx.user.findFirst({ where: { email, deletedAt: null } });
    if (user) await tx.academyMembership.upsert({ where: { userId_academyId: { userId: user.id, academyId } }, create: { userId: user.id, academyId, role: "ACADEMY_ADMIN", status: "INVITED" }, update: { role: "ACADEMY_ADMIN", status: "INVITED" } });
    const invitation = await tx.academyInvitation.create({ data: { academyId, email, studentName: input.name.trim(), role: "ACADEMY_ADMIN", status: "PENDING", invitedBy: actorId, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    await audit(tx, actorId, "ACADEMY_ADMIN_INVITED", "AcademyInvitation", invitation.id, `Invited administrator ${email}.`, academyId);
    return { invitation, membershipCreated: Boolean(user), deliveryStatus: "EMAIL_PROVIDER_NOT_CONFIGURED" as const };
  });
}

export async function revokeAcademyAdmin(actorId: string, academyId: string, userId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.academyMembership.findFirst({ where: { academyId, userId, role: "ACADEMY_ADMIN", status: { in: ["ACTIVE", "INVITED", "SUSPENDED"] } }, include: { user: { select: { email: true } } } });
    if (!membership) throw notFound("ACADEMY_ADMIN_NOT_FOUND", "The academy administrator membership was not found.");
    const activeAdmins = await tx.academyMembership.count({ where: { academyId, role: "ACADEMY_ADMIN", status: "ACTIVE" } });
    if (membership.status === "ACTIVE" && activeAdmins <= 1) throw conflict("LAST_ACADEMY_ADMIN", "The last active academy administrator cannot be revoked.");
    const updated = await tx.academyMembership.update({ where: { id: membership.id }, data: { status: "REVOKED" } });
    await tx.academyInvitation.updateMany({ where: { academyId, email: membership.user.email, status: "PENDING" }, data: { status: "REVOKED" } });
    await audit(tx, actorId, "ACADEMY_ADMIN_REVOKED", "AcademyMembership", membership.id, `Revoked academy administrator: ${reason}.`, academyId);
    return updated;
  });
}

export async function listPackages(input: { page: number; limit: number; courseId?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; includeDeleted?: boolean; search?: string }) {
  const searchFilter = input.search ? { OR: [{ title: { contains: input.search, mode: "insensitive" as const } }, { description: { contains: input.search, mode: "insensitive" as const } }] } : {};
  const where: Prisma.PackageWhereInput = { ...(input.courseId ? { courseId: input.courseId } : {}), ...(input.status ? { status: input.status } : {}), ...(input.includeDeleted ? {} : { deletedAt: null }), ...searchFilter };
  const [data, total] = await Promise.all([prisma.package.findMany({ where, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { course: { select: { id: true, name: true, code: true, academyId: true } }, items: { orderBy: { displayOrder: "asc" }, include: { contentItem: { select: { id: true, name: true, accessType: true, status: true, kind: true, size: true } } } } } }), prisma.package.count({ where })]);
  return { data, pagination: pagination(input.page, input.limit, total) };
}

export async function getPackage(packageId: string) {
  const item = await prisma.package.findUnique({ where: { id: packageId }, include: { course: true, items: { orderBy: { displayOrder: "asc" }, include: { contentItem: true } }, couponTargets: true, entitlements: { take: 50, orderBy: { grantedAt: "desc" } } } });
  if (!item) throw notFound("PACKAGE_NOT_FOUND", "The package was not found.");
  return item;
}

export async function createPackage(actorId: string, input: { courseId: string; title: string; slug?: string; description?: string; price: number; status?: "DRAFT" | "PUBLISHED"; contentItemIds?: string[] }) {
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findFirst({ where: { id: input.courseId, deletedAt: null } });
    if (!course) throw notFound("COURSE_NOT_FOUND", "The package course was not found.");
    const ids = [...new Set(input.contentItemIds ?? [])];
    if (ids.length && await tx.contentItem.count({ where: { id: { in: ids }, courseId: input.courseId, deletedAt: null } }) !== ids.length) throw badRequest("INVALID_PACKAGE_ITEMS", "Every package item must be active content in the package course.");
    const item = await tx.package.create({ data: { courseId: input.courseId, title: input.title.trim(), slug: normalizeSlug(input.slug ?? input.title), description: input.description?.trim() ?? "", price: input.price, status: input.status ?? "DRAFT", items: ids.length ? { create: ids.map((contentItemId, displayOrder) => ({ contentItemId, displayOrder })) } : undefined }, include: { items: true } });
    await audit(tx, actorId, "PACKAGE_CREATED", "Package", item.id, `Created package ${item.title}.`, course.academyId ?? undefined);
    return item;
  });
}

export async function updatePackage(actorId: string, packageId: string, input: { title?: string; slug?: string; description?: string; price?: number; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; contentItemIds?: string[] }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.package.findFirst({ where: { id: packageId, deletedAt: null }, include: { course: true } });
    if (!existing) throw notFound("PACKAGE_NOT_FOUND", "The package was not found.");
    if (input.contentItemIds) {
      const ids = [...new Set(input.contentItemIds)];
      if (await tx.contentItem.count({ where: { id: { in: ids }, courseId: existing.courseId, deletedAt: null } }) !== ids.length) throw badRequest("INVALID_PACKAGE_ITEMS", "Every package item must be active content in the package course.");
      await tx.packageItem.deleteMany({ where: { packageId } });
      if (ids.length) await tx.packageItem.createMany({ data: ids.map((contentItemId, displayOrder) => ({ packageId, contentItemId, displayOrder })) });
    }
    const updated = await tx.package.update({ where: { id: packageId }, data: { ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.slug !== undefined ? { slug: normalizeSlug(input.slug) } : {}), ...(input.description !== undefined ? { description: input.description.trim() } : {}), ...(input.price !== undefined ? { price: input.price } : {}), ...(input.status !== undefined ? { status: input.status } : {}) }, include: { items: true } });
    await audit(tx, actorId, "PACKAGE_UPDATED", "Package", packageId, `Updated package ${updated.title}.`, existing.course.academyId ?? undefined);
    return updated;
  });
}

export async function archivePackage(actorId: string, packageId: string, restore = false) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.package.findFirst({ where: { id: packageId, ...(restore ? { deletedAt: { not: null } } : { deletedAt: null }) }, include: { course: true } });
    if (!item) throw notFound("PACKAGE_NOT_FOUND", "The package was not found in the requested lifecycle state.");
    const updated = await tx.package.update({ where: { id: packageId }, data: restore ? { deletedAt: null, status: "DRAFT" } : { deletedAt: new Date(), status: "ARCHIVED" } });
    await audit(tx, actorId, restore ? "PACKAGE_RESTORED" : "PACKAGE_ARCHIVED", "Package", item.id, `${restore ? "Restored" : "Archived"} package ${item.title}.`, item.course.academyId ?? undefined);
    return updated;
  });
}

export async function listCoupons(input: { page: number; limit: number; enabled?: boolean }) {
  const where = input.enabled === undefined ? {} : { enabled: input.enabled };
  const [data, total] = await Promise.all([prisma.coupon.findMany({ where, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { targets: true, _count: { select: { redemptions: true } } } }), prisma.coupon.count({ where })]);
  return { data, pagination: pagination(input.page, input.limit, total) };
}

export async function createCoupon(actorId: string, input: { code: string; discountType: "PERCENT" | "FLAT"; discountValue: number; scope?: "ALL" | "PACKAGES" | "SUBJECTS"; maxUses?: number; expiresAt?: string; packageIds?: string[]; subjectIds?: string[] }) {
  if (input.discountType === "PERCENT" && input.discountValue > 100) throw badRequest("INVALID_DISCOUNT", "Percentage discounts cannot exceed 100.");
  return prisma.$transaction(async (tx) => {
    const packageIds = [...new Set(input.packageIds ?? [])]; const subjectIds = [...new Set(input.subjectIds ?? [])];
    if (packageIds.length && await tx.package.count({ where: { id: { in: packageIds }, deletedAt: null } }) !== packageIds.length) throw badRequest("INVALID_COUPON_TARGETS", "One or more package targets are invalid.");
    if (subjectIds.length && await tx.subject.count({ where: { id: { in: subjectIds }, deletedAt: null } }) !== subjectIds.length) throw badRequest("INVALID_COUPON_TARGETS", "One or more subject targets are invalid.");
    const coupon = await tx.coupon.create({ data: { code: input.code.trim().toUpperCase(), discountType: input.discountType, discountValue: input.discountValue, scope: input.scope ?? "ALL", maxUses: input.maxUses, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, targets: (packageIds.length || subjectIds.length) ? { create: [...packageIds.map((packageId) => ({ packageId })), ...subjectIds.map((subjectId) => ({ subjectId }))] } : undefined }, include: { targets: true } });
    await audit(tx, actorId, "COUPON_CREATED", "Coupon", coupon.id, `Created coupon ${coupon.code}.`);
    return coupon;
  });
}

export async function updateCoupon(actorId: string, couponId: string, input: { enabled?: boolean; maxUses?: number | null; expiresAt?: string | null }) {
  const existing = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!existing) throw notFound("COUPON_NOT_FOUND", "The coupon was not found.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.coupon.update({ where: { id: couponId }, data: { ...(input.enabled !== undefined ? { enabled: input.enabled } : {}), ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}), ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}) } });
    await audit(tx, actorId, "COUPON_UPDATED", "Coupon", couponId, `Updated coupon ${updated.code}.`);
    return updated;
  });
}

type ResourceType = "COURSE" | "PACKAGE" | "LESSON" | "PREMIUM_NOTES" | "SUBJECT" | "OTHER";

export interface EntitlementResourceOption {
  id: string;
  resourceType: ResourceType;
  title: string;
  subtitle: string;
}

export async function listEntitlementResources(input: { resourceType: ResourceType; search?: string; limit: number }): Promise<{ data: EntitlementResourceOption[] }> {
  const nameFilter = input.search ? { contains: input.search, mode: "insensitive" as const } : undefined;

  if (input.resourceType === "COURSE") {
    const records = await prisma.course.findMany({
      where: { deletedAt: null, ...(nameFilter ? { name: nameFilter } : {}) },
      take: input.limit,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, academy: { select: { name: true } } },
    });
    return { data: records.map((record) => ({ id: record.id, resourceType: input.resourceType, title: record.name, subtitle: `${record.code} · ${record.academy?.name ?? "Platform course"}` })) };
  }

  if (input.resourceType === "PACKAGE") {
    const records = await prisma.package.findMany({
      where: { deletedAt: null, ...(nameFilter ? { title: nameFilter } : {}) },
      take: input.limit,
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: { id: true, title: true, status: true, course: { select: { name: true } } },
    });
    return { data: records.map((record) => ({ id: record.id, resourceType: input.resourceType, title: record.title, subtitle: `${record.course.name} · ${record.status}` })) };
  }

  if (input.resourceType === "SUBJECT") {
    const records = await prisma.subject.findMany({
      where: { deletedAt: null, ...(nameFilter ? { name: nameFilter } : {}) },
      take: input.limit,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, course: { select: { name: true } } },
    });
    return { data: records.map((record) => ({ id: record.id, resourceType: input.resourceType, title: record.name, subtitle: record.course.name })) };
  }

  const entityType = input.resourceType === "LESSON"
    ? "LESSON" as const
    : input.resourceType === "PREMIUM_NOTES"
      ? "PREMIUM_NOTE" as const
      : "OTHER" as const;
  const records = await prisma.contentItem.findMany({
    where: { deletedAt: null, status: "PUBLISHED", entityType, ...(nameFilter ? { name: nameFilter } : {}) },
    take: input.limit,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, kind: true, course: { select: { name: true } } },
  });
  return { data: records.map((record) => ({ id: record.id, resourceType: input.resourceType, title: record.name, subtitle: `${record.course.name} · ${record.kind}` })) };
}

export async function grantEntitlement(actorId: string, input: { userId: string; resourceType: ResourceType; contentItemId?: string; packageId?: string; subjectId?: string; courseId?: string; resourceTitle: string; accessType?: "PERMANENT" | "TIME_LIMITED"; expiresAt?: string; reason: string }) {
  const references = [input.contentItemId, input.packageId, input.subjectId, input.courseId].filter(Boolean);
  if (references.length !== 1) throw badRequest("INVALID_ENTITLEMENT_RESOURCE", "Exactly one resource identifier is required.");
  if (input.accessType === "TIME_LIMITED" && !input.expiresAt) throw badRequest("EXPIRY_REQUIRED", "Time-limited access requires expiresAt.");
  return prisma.$transaction(async (tx) => {
    if (!await tx.user.findFirst({ where: { id: input.userId, deletedAt: null, status: "ACTIVE" } })) throw notFound("USER_NOT_FOUND", "The active user was not found.");
    if (input.contentItemId && !await tx.contentItem.findFirst({ where: { id: input.contentItemId, deletedAt: null } })) throw notFound("CONTENT_NOT_FOUND", "The content resource was not found.");
    if (input.packageId && !await tx.package.findFirst({ where: { id: input.packageId, deletedAt: null } })) throw notFound("PACKAGE_NOT_FOUND", "The package resource was not found.");
    if (input.subjectId && !await tx.subject.findFirst({ where: { id: input.subjectId, deletedAt: null } })) throw notFound("SUBJECT_NOT_FOUND", "The subject resource was not found.");
    if (input.courseId && !await tx.course.findFirst({ where: { id: input.courseId, deletedAt: null } })) throw notFound("COURSE_NOT_FOUND", "The course resource was not found.");
    const entitlement = await tx.entitlement.create({ data: { ...input, source: "ADMIN_GRANT", accessType: input.accessType ?? "PERMANENT", expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, grantedByAdminId: actorId } });
    await audit(tx, actorId, "ENTITLEMENT_GRANTED", "Entitlement", entitlement.id, `Granted ${input.resourceTitle} to user ${input.userId}.`);
    return entitlement;
  });
}

export async function revokeEntitlement(actorId: string, entitlementId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.entitlement.findFirst({ where: { id: entitlementId, status: "ACTIVE" } });
    if (!existing) throw notFound("ACTIVE_ENTITLEMENT_NOT_FOUND", "The active entitlement was not found.");
    const updated = await tx.entitlement.update({ where: { id: entitlementId }, data: { status: "REVOKED", revokedAt: new Date(), reason } });
    await audit(tx, actorId, "ENTITLEMENT_REVOKED", "Entitlement", entitlementId, `Revoked entitlement: ${reason}.`);
    return updated;
  });
}

export async function listEntitlements(input: { page: number; limit: number; userId?: string; status?: "ACTIVE" | "EXPIRED" | "REVOKED" }) {
  const now = new Date();
  await prisma.entitlement.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
  const where: Prisma.EntitlementWhereInput = { ...(input.userId ? { userId: input.userId } : {}), ...(input.status ? { status: input.status } : {}) };
  const [data, total] = await Promise.all([prisma.entitlement.findMany({ where, skip: (input.page - 1) * input.limit, take: input.limit, orderBy: [{ grantedAt: "desc" }, { id: "desc" }], include: { user: { select: { id: true, email: true, fullName: true } }, package: { select: { id: true, title: true } }, course: { select: { id: true, name: true } } } }), prisma.entitlement.count({ where })]);
  return { data, pagination: pagination(input.page, input.limit, total) };
}

export async function getStoreKpis() {
  const [totalRevenueAgg, totalOrders, activePackages, publishedPaidItems] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ["PAID"] } },
    }),
    prisma.order.count(),
    prisma.package.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.contentItem.count({ where: { accessType: "PAID", status: "PUBLISHED", deletedAt: null } }),
  ]);

  return {
    totalRevenue: Number(totalRevenueAgg._sum.totalAmount ?? 0),
    totalOrders,
    activePackages,
    publishedPaidItems,
  };
}
