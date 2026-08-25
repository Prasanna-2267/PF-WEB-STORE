import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app/create-app.js";
import { hashPassword } from "../auth/password.js";
import { loginWithPassword, rotateRefreshToken } from "../auth/auth-service.js";
import type { TenantContext } from "../auth/tenant-auth.js";
import { getConfig } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import type { EmailProvider } from "../integrations/email-provider.js";
import type { PaymentProvider } from "../integrations/payment-provider.js";
import { providerTestHooks } from "../integrations/provider-registry.js";
import type { StorageProvider, UploadIntent } from "../integrations/storage-provider.js";
import * as admissions from "../services/academyAdmissionsService.js";
import * as academy from "../services/academyAdminService.js";
import * as notifications from "../services/academyNotificationService.js";
import * as adminBroadcasts from "../services/adminBroadcastService.js";
import * as adminDomains from "../services/adminDomainService.js";
import * as adminCourses from "../services/adminCourseService.js";
import * as admin from "../services/adminService.js";
import { enqueueJob, runDueJobsOnce } from "../services/backgroundJobService.js";
import * as commerce from "../services/commerceService.js";
import * as content from "../services/contentService.js";
import * as templates from "../services/notificationTemplateService.js";
import * as publicApi from "../services/publicService.js";
import * as questions from "../services/questionService.js";
import * as student from "../services/studentService.js";
import { integrationDatabaseEnabled } from "../tests/integration-database-guard.js";

const enabled = integrationDatabaseEnabled("RUN_BACKEND_INTEGRATION");
const metadata = { ipAddress: "127.0.0.1", userAgent: "phase-4-integration", deviceName: "phase-4" };
const suffix = randomUUID().slice(0, 8);
const password = "Phase4-only-Password!23456789";

let academyAId = "";
let academyBId = "";
let superId = "";
let adminAId = "";
let studentAId = "";
let studentBId = "";
let outsiderId = "";
let courseAId = "";
let courseBId = "";
let superToken = "";
let adminToken = "";
let studentToken = "";
let contextA: TenantContext;
let contextB: TenantContext;

const expectCode = async (fn: () => Promise<unknown>, code: string) => {
  await assert.rejects(fn, (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === code));
};

test.before(async () => {
  if (!enabled) return;
  const roles = await prisma.role.findMany({ where: { key: { in: ["super_admin", "admin", "ACADEMY_ADMIN", "student"] } } });
  const role = (key: string) => roles.find((item) => item.key === key)?.id ?? assert.fail(`Missing deterministic role ${key}`);
  const passwordHash = await hashPassword(password);
  academyAId = randomUUID(); academyBId = randomUUID();
  superId = randomUUID(); adminAId = randomUUID(); studentAId = randomUUID(); studentBId = randomUUID(); outsiderId = randomUUID();
  await prisma.academy.createMany({ data: [
    { id: academyAId, slug: `phase4-a-${suffix}`, name: "Phase 4 Academy A", email: `phase4-a-${suffix}@test.invalid`, phone: "9000000001", address: "A", city: "Chennai", state: "Tamil Nadu", postalCode: "600001", adminName: "Admin A", adminEmail: `admin-a-${suffix}@test.invalid`, status: "ACTIVE" },
    { id: academyBId, slug: `phase4-b-${suffix}`, name: "Phase 4 Academy B", email: `phase4-b-${suffix}@test.invalid`, phone: "9000000002", address: "B", city: "Kochi", state: "Kerala", postalCode: "682001", adminName: "Admin B", adminEmail: `admin-b-${suffix}@test.invalid`, status: "ACTIVE" },
  ] });
  await prisma.user.createMany({ data: [
    { id: superId, email: `super-${suffix}@test.invalid`, fullName: "Phase 4 Super", roleId: role("super_admin") },
    { id: adminAId, email: `admin-${suffix}@test.invalid`, fullName: "Phase 4 Admin", roleId: role("ACADEMY_ADMIN") },
    { id: studentAId, email: `student-a-${suffix}@test.invalid`, fullName: "Phase 4 Student A", roleId: role("student") },
    { id: studentBId, email: `student-b-${suffix}@test.invalid`, fullName: "Phase 4 Student B", roleId: role("student") },
    { id: outsiderId, email: `outsider-${suffix}@test.invalid`, fullName: "Phase 4 Outsider", roleId: role("student") },
  ] });
  await prisma.passwordCredential.createMany({ data: [superId, adminAId, studentAId, studentBId, outsiderId].map((userId) => ({ userId, passwordHash })) });
  await prisma.academyMembership.createMany({ data: [
    { academyId: academyAId, userId: adminAId, role: "ACADEMY_ADMIN", status: "ACTIVE" },
    { academyId: academyAId, userId: studentAId, role: "ACADEMY_STUDENT", status: "ACTIVE" },
    { academyId: academyAId, userId: studentBId, role: "ACADEMY_STUDENT", status: "ACTIVE" },
    { academyId: academyBId, userId: outsiderId, role: "ACADEMY_STUDENT", status: "ACTIVE" },
  ] });
  contextA = { user: { id: adminAId, email: `admin-${suffix}@test.invalid`, fullName: "Phase 4 Admin", roleKey: "ACADEMY_ADMIN" }, academyId: academyAId, roleInAcademy: "ACADEMY_ADMIN", membershipId: null, permissions: new Set(["academy:manage", "academy:read"]), isSuperAdmin: false };
  contextB = { ...contextA, academyId: academyBId };
  courseAId = (await academy.createAcademyCourse(contextA, { name: "Phase 4 Course A", code: `A${suffix.slice(0, 6)}` })).id;
  courseBId = (await prisma.course.create({ data: { academyId: academyBId, slug: `phase4-course-b-${suffix}`, code: `B${suffix.slice(0, 6)}`.toUpperCase(), name: "Phase 4 Course B", status: "ACTIVE" } })).id;
  await academy.enrollStudentInCourse(contextA, studentAId, courseAId);
  await academy.enrollStudentInCourse(contextA, studentBId, courseAId);
  superToken = (await loginWithPassword(`super-${suffix}@test.invalid`, password, metadata)).accessToken;
  adminToken = (await loginWithPassword(`admin-${suffix}@test.invalid`, password, metadata)).accessToken;
  studentToken = (await loginWithPassword(`student-a-${suffix}@test.invalid`, password, metadata)).accessToken;
});

test("Phase 4 migration ledger, deterministic seed, and operational constraints are present", { skip: !enabled }, async () => {
  const migrations = await prisma.$queryRaw<Array<{ applied: bigint; failed: bigint }>>`
    SELECT COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::bigint AS applied,
           COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::bigint AS failed
    FROM "_prisma_migrations"`;
  assert.equal(Number(migrations[0]?.applied), 20);
  assert.equal(Number(migrations[0]?.failed), 0);
  const roles = await prisma.role.findMany({ where: { key: { in: ["super_admin", "admin", "ACADEMY_ADMIN", "student"] } }, include: { rolePermissions: true } });
  assert.equal(roles.length, 4);
  assert.ok(roles.find((item) => item.key === "super_admin")!.rolePermissions.length > 0);
  const constraints = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM pg_constraint WHERE convalidated = false`;
  assert.equal(Number(constraints[0]?.count), 0);
});

test("authentication persists sessions, rejects failures, and atomically rotates refresh tokens", { skip: !enabled }, async () => {
  const login = await loginWithPassword(`student-b-${suffix}@test.invalid`, password, metadata);
  assert.ok(login.accessToken && login.refreshToken);
  await assert.rejects(() => loginWithPassword(`student-b-${suffix}@test.invalid`, "wrong-password", metadata));
  const failed = await prisma.securityEvent.count({ where: { userId: studentBId, eventType: "LOGIN_FAILED" } });
  assert.ok(failed >= 1);
  const rotations = await Promise.allSettled([rotateRefreshToken(login.refreshToken), rotateRefreshToken(login.refreshToken)]);
  assert.equal(rotations.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(rotations.filter((item) => item.status === "rejected").length, 1);
  await prisma.user.update({ where: { id: studentBId }, data: { status: "DISABLED" } });
  const winner = rotations.find((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof rotateRefreshToken>>> => item.status === "fulfilled")!;
  await assert.rejects(() => rotateRefreshToken(winner.value.refreshToken));
  await prisma.user.update({ where: { id: studentBId }, data: { status: "ACTIVE" } });
  const logoutLogin = await loginWithPassword(`student-b-${suffix}@test.invalid`, password, metadata);
  const server = createApp(getConfig()).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const sessionUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
  try {
    const headers = { authorization: `Bearer ${logoutLogin.accessToken}`, "content-type": "application/json" };
    assert.equal((await fetch(`${sessionUrl}/session`, { headers })).status, 200);
    const academyAdminSession = await fetch(`${sessionUrl}/session`, { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(academyAdminSession.status, 200);
    assert.equal((await academyAdminSession.json()).user.role, "academy_admin", "session restoration must use the same public role vocabulary as login");
    assert.equal((await fetch(`${sessionUrl}/logout`, { method: "POST", headers, body: "{}" })).status, 204);
    assert.equal((await fetch(`${sessionUrl}/session`, { headers })).status, 401);
    await assert.rejects(() => rotateRefreshToken(logoutLogin.refreshToken));
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("Super Admin academy creation atomically provisions one active Academy Admin identity", { skip: !enabled }, async () => {
  const created = await adminDomains.createAcademy(superId, {
    name: `Provisioned Academy ${suffix}`,
    email: `provisioned-academy-${suffix}@test.invalid`,
    phone: "9000000099",
    address: "Provisioning Road",
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "600001",
    adminName: "Provisioned Admin",
    adminEmail: `provisioned-admin-${suffix}@test.invalid`,
  });
  assert.equal(created.academy.status, "ACTIVE");
  assert.ok(created.membershipCreated);

  const administrator = await prisma.user.findUniqueOrThrow({
    where: { email: `provisioned-admin-${suffix}@test.invalid` },
    include: { role: { select: { key: true } }, academyMemberships: true },
  });
  assert.equal(administrator.role.key, "ACADEMY_ADMIN");
  assert.deepEqual(administrator.academyMemberships.map((membership) => ({ academyId: membership.academyId, role: membership.role, status: membership.status })), [
    { academyId: created.academy.id, role: "ACADEMY_ADMIN", status: "ACTIVE" },
  ]);
  const auditActions = await prisma.systemAuditLog.findMany({ where: { academyId: created.academy.id }, select: { action: true }, orderBy: { occurredAt: "asc" } });
  assert.deepEqual(auditActions.map((entry) => entry.action), ["ACADEMY_CREATED", "ACADEMY_ADMIN_ASSIGNED"]);
  await prisma.passwordCredential.create({ data: { userId: administrator.id, passwordHash: await hashPassword(password) } });
  const adminLogin = await loginWithPassword(administrator.email, password, metadata);
  assert.equal(adminLogin.user.role, "academy_admin");

  const server = createApp(getConfig()).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const headers = { authorization: `Bearer ${adminLogin.accessToken}`, "content-type": "application/json" };
    const context = await fetch(`${base}/api/academy/context`, { headers });
    assert.equal(context.status, 200);
    assert.deepEqual(await context.json(), { academyId: created.academy.id, roleInAcademy: "ACADEMY_ADMIN", membershipId: created.membershipId, permissions: ["academy:manage", "academy:read"] });
    assert.equal((await fetch(`${base}/api/admin/packages`, { headers })).status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  await assert.rejects(
    () => adminDomains.createAcademy(superId, {
      name: `Rollback Academy ${suffix}`,
      email: `rollback-academy-${suffix}@test.invalid`,
      phone: "9000000098",
      address: "Rollback Road",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600001",
      adminName: "Provisioned Admin",
      adminEmail: administrator.email,
    }),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "ADMIN_IDENTITY_CONFLICT"),
  );
  assert.equal(await prisma.academy.count({ where: { email: `rollback-academy-${suffix}@test.invalid` } }), 0);
});

test("global Super Admin academic APIs expose only direct Parallax Flow data", { skip: !enabled }, async () => {
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { key: "student" } });
  const platformStudent = await prisma.user.create({ data: {
    id: randomUUID(), email: `platform-student-${suffix}@test.invalid`, fullName: "Platform Student", roleId: studentRole.id,
  } });
  const platformCourse = await prisma.course.create({ data: {
    academyId: null, slug: `platform-course-${suffix}`, code: `P${suffix.slice(0, 6)}`.toUpperCase(), name: `Platform Course ${suffix}`, status: "ACTIVE",
  } });
  const platformContent = await content.createFolder({ academyId: null, actorId: superId }, { courseId: platformCourse.id, name: `Platform Folder ${suffix}` }) as unknown as { id: string };
  const academyContent = await prisma.contentItem.create({ data: { courseId: courseAId, kind: "FOLDER", name: `Academy Folder ${suffix}` } });
  const platformQuestion = await questions.createQuestion({ actorId: superId }, {
    kind: "NORMAL_DESCRIPTIVE", courseId: platformCourse.id, questionHtml: "Explain platform-only ownership.", answerHtml: "Platform-only ownership.",
  });
  const platformBroadcast = await prisma.broadcast.create({ data: { academyId: null, title: `Platform Broadcast ${suffix}`, message: "Platform-only broadcast." } });
  const academyBroadcast = await prisma.broadcast.create({ data: { academyId: academyAId, title: `Academy Broadcast ${suffix}`, message: "Academy-only broadcast." } });

  const students = await admin.listAdminUsers({ page: 1, limit: 100 });
  assert.ok(students.data.some((row) => row.id === platformStudent.id));
  assert.ok(!students.data.some((row) => row.id === studentAId));
  await expectCode(() => admin.getAdminUser(studentAId), "USER_NOT_FOUND");

  const courses = await adminCourses.listAdminCourses({ page: 1, limit: 100 });
  assert.ok(courses.data.some((row) => row.id === platformCourse.id));
  assert.ok(!courses.data.some((row) => row.id === courseAId));
  await expectCode(() => adminCourses.getAdminCourse(courseAId), "COURSE_NOT_FOUND");

  const contentRows = await content.listContent({ academyId: null, actorId: superId }, { courseId: platformCourse.id, page: 1, limit: 100 });
  assert.ok((contentRows.data as unknown as Array<{ id: string }>).some((row) => row.id === platformContent.id));
  await expectCode(() => content.getContent({ academyId: null, actorId: superId }, academyContent.id), "CONTENT_NOT_FOUND");

  const questionsRows = await questions.listQuestions({ actorId: superId }, { page: 1, limit: 100 });
  assert.ok(questionsRows.data.some((row) => row.id === platformQuestion.id));
  assert.ok(!questionsRows.data.some((row) => row.academyId === academyAId));

  const broadcasts = await adminBroadcasts.listBroadcasts({ page: 1, limit: 100 });
  assert.ok(broadcasts.data.some((row) => row.id === platformBroadcast.id));
  assert.ok(!broadcasts.data.some((row) => row.id === academyBroadcast.id));

  const server = createApp(getConfig()).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { authorization: `Bearer ${superToken}` };
  try {
    const studentsResponse = await fetch(`${base}/api/admin/students?limit=100`, { headers });
    assert.equal(studentsResponse.status, 200);
    const studentsBody = await studentsResponse.json() as { data: Array<{ id: string }> };
    assert.ok(studentsBody.data.some((row) => row.id === platformStudent.id));
    assert.ok(!studentsBody.data.some((row) => row.id === studentAId));
    const coursesResponse = await fetch(`${base}/api/admin/courses?limit=100`, { headers });
    const coursesBody = await coursesResponse.json() as { data: Array<{ id: string }> };
    assert.ok(coursesBody.data.some((row) => row.id === platformCourse.id));
    assert.ok(!coursesBody.data.some((row) => row.id === courseAId));
    assert.equal((await fetch(`${base}/api/admin/content?courseId=${platformCourse.id}`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/api/admin/questions?limit=100`, { headers })).status, 200);
    const broadcastsResponse = await fetch(`${base}/api/admin/broadcasts?limit=100`, { headers });
    const broadcastsBody = await broadcastsResponse.json() as { data: Array<{ id: string }> };
    assert.ok(broadcastsBody.data.some((row) => row.id === platformBroadcast.id));
    assert.ok(!broadcastsBody.data.some((row) => row.id === academyBroadcast.id));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("HTTP RBAC, single-tenant Academy Admin scope, IDOR, and commercial boundaries fail closed", { skip: !enabled }, async () => {
  const foreignQuestion = await questions.createQuestion({ academyId: academyBId, actorId: adminAId }, { kind: "NORMAL_DESCRIPTIVE", courseId: courseBId, questionHtml: "Academy B only" });
  const foreignBroadcast = await academy.createAcademyBroadcast(contextB, { title: "Academy B only", message: "Private Academy B announcement" });
  const server = createApp(getConfig()).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, token: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  try {
    assert.equal((await call("/api/admin/overview", superToken)).status, 200);
    assert.equal((await call("/api/admin/overview", adminToken)).status, 403);
    assert.equal((await call("/api/academy/overview", adminToken)).status, 200);
    assert.equal((await call("/api/academy/overview", adminToken, { headers: { "x-academy-id": academyAId } })).status, 200);
    assert.equal((await call("/api/academy/overview", studentToken)).status, 403);
    assert.equal((await call("/api/academy/questions", studentToken)).status, 403);
    assert.equal((await call("/api/academy/broadcasts", studentToken)).status, 403);
    assert.equal((await fetch(`${base}/api/academy/questions`)).status, 401);
    assert.equal((await fetch(`${base}/api/academy/broadcasts`)).status, 401);
    await prisma.academyMembership.update({ where: { userId_academyId: { userId: studentAId, academyId: academyAId } }, data: { role: "ACADEMY_ADMIN" } });
    assert.equal((await call("/api/academy/overview", studentToken)).status, 403, "A Student platform identity must not become Academy Admin through membership spoofing");
    await prisma.academyMembership.update({ where: { userId_academyId: { userId: studentAId, academyId: academyAId } }, data: { role: "ACADEMY_STUDENT" } });
    assert.equal((await call("/api/academy/overview", adminToken, { headers: { "x-academy-id": academyBId } })).status, 403);
    assert.equal((await call("/api/academy/admissions", adminToken)).status, 200);
    assert.equal((await call("/api/academy/admissions", studentToken)).status, 403);
    assert.equal((await call("/api/academy/admissions/qr", adminToken, { method: "POST", body: JSON.stringify({ academyId: academyBId }) })).status, 403, "Cross-Academy QR generation forgery must fail closed");
    assert.equal((await call("/api/academy/admissions/code", adminToken, { method: "POST", body: JSON.stringify({ academyId: academyBId, maxUses: 1, expiresAt: null }) })).status, 403, "Cross-Academy code generation forgery must fail closed");
    assert.equal((await call("/api/student/admissions/codes/claim", studentToken, { method: "POST", body: JSON.stringify({ code: "ABCDEFGH", academyId: academyBId }) })).status, 422, "Students must not mass-assign Academy identity during code claims");
    assert.equal((await call("/api/academy/admissions/qr", superToken, { method: "POST", body: "{}" })).status, 409, "Super Admin must not receive an implicit Academy tenant context");
    for (const removedPath of ["/api/academy/analytics", "/api/academy/settings", "/api/academy/notifications"]) {
      assert.equal((await call(removedPath, adminToken)).status, 404, `${removedPath} must not be exposed to Academy Admin`);
    }
    for (const commercialPath of ["/api/admin/packages", "/api/admin/orders", "/api/admin/coupons", "/api/admin/store-management"]) {
      assert.equal((await call(commercialPath, adminToken)).status, 403, `${commercialPath} must remain Super Admin only`);
    }
    assert.equal((await call("/api/admin/packages", superToken)).status, 200);
    assert.equal((await call("/api/academy/broadcasts", adminToken, { method: "POST", body: JSON.stringify({ title: "Store sale", message: "Buy now", type: "STORE" }) })).status, 422);
    assert.equal((await call("/api/academy/broadcasts", adminToken, { method: "POST", body: JSON.stringify({ title: "Forged Academy", message: "Denied", academyId: academyBId }) })).status, 403);
    assert.equal((await call("/api/academy/questions", adminToken, { method: "POST", body: JSON.stringify({ kind: "NORMAL_DESCRIPTIVE", questionHtml: "Forged", academyId: academyBId }) })).status, 403);
    assert.equal((await call("/api/academy/questions", adminToken, { method: "POST", body: JSON.stringify({ kind: "NORMAL_DESCRIPTIVE", questionHtml: "Foreign course", courseId: courseBId }) })).status, 404);
    assert.equal((await call("/api/academy/broadcasts", adminToken, { method: "POST", body: JSON.stringify({ title: "Foreign course", message: "Denied", targetCourseId: courseBId }) })).status, 404);
    assert.equal((await call(`/api/academy/questions/${foreignQuestion.id}`, adminToken)).status, 404);
    assert.equal((await call(`/api/academy/questions/${foreignQuestion.id}`, adminToken, { method: "PUT", body: JSON.stringify({ kind: "NORMAL_DESCRIPTIVE", questionHtml: "Tampered" }) })).status, 404);
    assert.equal((await call(`/api/academy/broadcasts/${foreignBroadcast.id}`, adminToken)).status, 404);
    assert.equal((await call(`/api/academy/broadcasts/${foreignBroadcast.id}`, adminToken, { method: "PATCH", body: JSON.stringify({ title: "Tampered" }) })).status, 404);
    assert.equal((await call("/api/academy/questions?limit=101", adminToken)).status, 422);
    assert.equal((await call("/api/academy/broadcasts?limit=101", adminToken)).status, 422);
    const fakeContentId = randomUUID();
    assert.equal((await call(`/api/academy/content/${fakeContentId}`, adminToken, { method: "PATCH", body: JSON.stringify({ accessType: "PAID", price: 999 }) })).status, 422);
    assert.equal((await call(`/api/academy/content/${fakeContentId}/store-sections`, adminToken, { method: "POST", body: JSON.stringify({ heading: "Store", content: "Sale" }) })).status, 404);
    const academyFolderResponse = await call("/api/academy/content/folders", adminToken, { method: "POST", body: JSON.stringify({ courseId: courseAId, parentId: null, name: `HTTP Academy Folder ${suffix}` }) });
    assert.equal(academyFolderResponse.status, 201);
    const academyFolder = await academyFolderResponse.json() as { id: string };
    assert.equal((await call("/api/academy/content/display-orders", adminToken, { method: "PATCH", body: JSON.stringify({ courseId: courseAId, folderId: null, itemIds: [academyFolder.id] }) })).status, 200, "The static display-order route must remain reachable before /:contentId");
    assert.equal((await call("/api/academy/content/display-orders", adminToken, { method: "PATCH", body: JSON.stringify({ courseId: courseBId, folderId: null, itemIds: [academyFolder.id] }) })).status, 404, "Academy A must not order Academy B content");
    assert.equal((await call(`/api/academy/content?courseId=${courseBId}`, adminToken)).status, 404, "Academy A must not list Academy B content");
    const unchanged = await prisma.academy.findUniqueOrThrow({ where: { id: academyAId } });
    assert.equal(unchanged.status, "ACTIVE"); assert.equal(Number(unchanged.revenue), 0);
    assert.equal((await call(`/api/academy/courses/${courseBId}`, adminToken)).status, 404);
    await prisma.academyMembership.create({ data: { academyId: academyBId, userId: adminAId, role: "ACADEMY_ADMIN", status: "ACTIVE" } });
    assert.equal((await call("/api/academy/overview", adminToken)).status, 409);
    assert.equal((await call("/api/academy/overview", adminToken, { headers: { "x-academy-id": academyAId } })).status, 409);
    await prisma.academyMembership.delete({ where: { userId_academyId: { userId: adminAId, academyId: academyBId } } });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "admin" } });
    const superRole = await prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } });
    await prisma.user.update({ where: { id: superId }, data: { roleId: adminRole.id } });
    assert.equal((await call("/api/admin/overview", superToken)).status, 403);
    await prisma.user.update({ where: { id: superId }, data: { roleId: superRole.id } });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Academy course lifecycle fields and student filters remain tenant-scoped", { skip: !enabled }, async () => {
  const created = await academy.createAcademyCourse(contextA, {
    name: `Lifecycle ${suffix}`,
    code: `L${suffix.slice(0, 6)}`,
    status: "INACTIVE",
  });
  assert.equal(created.academyId, academyAId);
  assert.equal(created.status, "INACTIVE");
  assert.equal(created.deletedAt, null);

  const archived = await academy.updateAcademyCourse(contextA, created.id, { status: "ARCHIVED" });
  assert.equal(archived.status, "ARCHIVED");
  assert.ok(archived.deletedAt);
  await expectCode(() => academy.updateAcademyCourse(contextB, created.id, { status: "ACTIVE" }), "COURSE_NOT_FOUND");

  const restored = await academy.updateAcademyCourse(contextA, created.id, { status: "ACTIVE" });
  assert.equal(restored.status, "ACTIVE");
  assert.equal(restored.deletedAt, null);

  const activeStudents = await academy.getAcademyStudents(contextA, { page: 1, limit: 25, accountStatus: "ACTIVE" });
  assert.ok(activeStudents.data.length > 0);
  assert.ok(activeStudents.data.every((student) => student.accountStatus === "ACTIVE"));
  assert.ok(activeStudents.data.every((student) => "lastLoginAt" in student));
});

test("admission-code final-capacity concurrency admits exactly one student", { skip: !enabled }, async () => {
  const code = await admissions.createAdmissionCode(contextA, { maxUses: 1, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const extraA = randomUUID(), extraB = randomUUID();
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { key: "student" } });
  await prisma.user.createMany({ data: [
    { id: extraA, email: `capacity-a-${suffix}@test.invalid`, fullName: "Capacity A", roleId: studentRole.id },
    { id: extraB, email: `capacity-b-${suffix}@test.invalid`, fullName: "Capacity B", roleId: studentRole.id },
  ] });
  const attempts = await Promise.allSettled([admissions.claimAdmissionCode(extraA, code.code), admissions.claimAdmissionCode(extraB, code.code)]);
  assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
  const persisted = await prisma.admissionCode.findUniqueOrThrow({ where: { id: code.id } });
  assert.equal(persisted.currentUses, 1);
  assert.equal(await prisma.academyMembership.count({ where: { academyId: academyAId, userId: { in: [extraA, extraB] } } }), 1);
  const rollbackCode = await admissions.createAdmissionCode(contextA, { maxUses: 2, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  await expectCode(() => admissions.claimAdmissionCode(randomUUID(), rollbackCode.code), "STUDENT_NOT_FOUND");
  assert.equal((await prisma.admissionCode.findUniqueOrThrow({ where: { id: rollbackCode.id } })).currentUses, 0);
});

test("unlimited admission codes resolve Academy ownership and preserve Academy-owned history", { skip: !enabled }, async () => {
  const codeA = await admissions.createAdmissionCode(contextA, { maxUses: null, expiresAt: null });
  const codeB = await admissions.createAdmissionCode(contextB, { maxUses: null, expiresAt: null });
  assert.notEqual(codeA.code, codeB.code);
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { key: "student" } });
  const claimants = [randomUUID(), randomUUID()];
  await prisma.user.createMany({ data: claimants.map((id, index) => ({ id, email: `unlimited-${index}-${suffix}@test.invalid`, fullName: `Unlimited ${index}`, roleId: studentRole.id })) });
  const results = await Promise.all(claimants.map((id) => admissions.claimAdmissionCode(id, codeA.code)));
  assert.ok(results.every((result) => result.status === "SUCCESS" && result.academyId === academyAId));
  assert.equal(await prisma.academyMembership.count({ where: { academyId: academyAId, userId: { in: claimants } } }), 2);
  assert.equal(await prisma.academyMembership.count({ where: { academyId: academyBId, userId: { in: claimants } } }), 0);
  assert.equal(await prisma.admissionRecord.count({ where: { academyId: academyAId, codeId: codeA.id, studentId: { in: claimants }, status: "SUCCESS" } }), 2);
  assert.equal(await prisma.admissionRecord.count({ where: { academyId: academyBId, codeId: codeA.id } }), 0);
  const persisted = await prisma.admissionCode.findUniqueOrThrow({ where: { id: codeA.id } });
  assert.equal(persisted.currentUses, 2);
  assert.equal(persisted.status, "ACTIVE");
});

test("content/storage lifecycle verifies metadata, ownership, hierarchy, copies, and signed access", { skip: !enabled }, async () => {
  await content.updateLocation({ academyId: academyAId, actorId: adminAId }, courseAId, null, "Phase 4 Study Materials");
  if (getConfig().storage.driver !== "s3") {
    await expectCode(() => content.createUploadIntent({ academyId: academyAId, actorId: adminAId }, { courseId: courseAId, fileName: "disabled.pdf", mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "d".repeat(64) }), "STORAGE_PROVIDER_NOT_CONFIGURED");
  }
  const objects = new Map<string, { sizeBytes: number; mimeType: string; checksumSha256: string }>();
  const storage: StorageProvider = {
    async createUploadUrl(intent: UploadIntent) { objects.set(intent.objectKey, { sizeBytes: intent.sizeBytes, mimeType: intent.mimeType, checksumSha256: intent.checksumSha256 }); return { uploadUrl: `https://storage.test/upload/${encodeURIComponent(intent.objectKey)}`, expiresAt: new Date(Date.now() + 60_000), headers: { "content-type": intent.mimeType } }; },
    async createDownloadUrl(key) { return `https://storage.test/download/${encodeURIComponent(key)}`; },
    async statObject(key) { const value = objects.get(key); if (!value) throw new Error("OBJECT_MISSING"); return value; },
    async deleteObject(key) { objects.delete(key); },
    async copyObject(source, destination) { const value = objects.get(source); if (!value) throw new Error("OBJECT_MISSING"); objects.set(destination, value); },
    async putObject(key, body, mimeType, checksumSha256) { objects.set(key, { sizeBytes: body.byteLength, mimeType, checksumSha256 }); },
  };
  providerTestHooks.setStorage(storage);
  try {
    const folder = await content.createFolder({ academyId: academyAId, actorId: adminAId }, { courseId: courseAId, name: "Phase 4 Folder" }) as unknown as { id: string };
    const checksum = "a".repeat(64);
    const intent = await content.createUploadIntent({ academyId: academyAId, actorId: adminAId }, { courseId: courseAId, parentId: folder.id, fileName: "phase4.pdf", mimeType: "application/pdf", sizeBytes: 1234, checksumSha256: checksum });
    const item = await content.finalizeUpload({ academyId: academyAId, actorId: adminAId }, intent.uploadId, { parentId: folder.id, entityType: "STUDY_MATERIAL", accessType: "FREE" }) as unknown as { id: string; name: string };
    assert.equal(item.name, "phase4.pdf");
    assert.equal((await content.getContentAccessUrl({ academyId: academyAId, actorId: adminAId }, item.id, "download")).expiresIn, 300);
    await expectCode(() => content.getContent({ academyId: academyBId, actorId: adminAId }, item.id), "CONTENT_NOT_FOUND");
    const copied = await content.copyContent({ academyId: academyAId, actorId: adminAId }, item.id, null);
    assert.ok("id" in copied);
    await content.archiveContent({ academyId: academyAId, actorId: adminAId }, item.id);
    await content.archiveContent({ academyId: academyAId, actorId: adminAId }, item.id, true);
    assert.equal((await content.getContentAccessUrl({ academyId: academyAId, actorId: adminAId }, item.id, "download")).expiresIn, 300);
    await content.archiveContent({ academyId: academyAId, actorId: adminAId }, folder.id);
    await expectCode(() => content.getContent({ academyId: academyAId, actorId: adminAId }, item.id), "CONTENT_NOT_FOUND");
    await content.archiveContent({ academyId: academyAId, actorId: adminAId }, folder.id, true);
    const restoredItem = await content.getContent({ academyId: academyAId, actorId: adminAId }, item.id) as unknown as { name: string };
    assert.equal(restoredItem.name, "phase4.pdf");
    const mismatch = await content.createUploadIntent({ academyId: academyAId, actorId: adminAId }, { courseId: courseAId, fileName: "mismatch.pdf", mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "b".repeat(64) });
    objects.set(mismatch.objectKey, { sizeBytes: 11, mimeType: "application/pdf", checksumSha256: "b".repeat(64) });
    await expectCode(() => content.finalizeUpload({ academyId: academyAId, actorId: adminAId }, mismatch.uploadId, {}), "UPLOAD_VERIFICATION_FAILED");

    const proxyBytes = Buffer.from("verified Academy proxy upload");
    const proxyChecksum = createHash("sha256").update(proxyBytes).digest("hex");
    const proxyIntent = await content.createUploadIntent({ academyId: academyAId, actorId: adminAId }, {
      courseId: courseAId,
      fileName: "proxy-verified.txt",
      mimeType: "text/plain",
      sizeBytes: proxyBytes.byteLength,
      checksumSha256: proxyChecksum,
    });
    await expectCode(
      () => content.uploadProxy({ academyId: academyAId, actorId: adminAId }, proxyIntent.uploadId, Buffer.from("wrong size")),
      "UPLOAD_SIZE_MISMATCH",
    );
    const wrongChecksum = Buffer.alloc(proxyBytes.byteLength, 1);
    await expectCode(
      () => content.uploadProxy({ academyId: academyAId, actorId: adminAId }, proxyIntent.uploadId, wrongChecksum),
      "UPLOAD_CHECKSUM_MISMATCH",
    );
    await expectCode(
      () => content.uploadProxy({ academyId: academyBId, actorId: adminAId }, proxyIntent.uploadId, proxyBytes),
      "UPLOAD_NOT_FOUND",
    );
    await content.uploadProxy({ academyId: academyAId, actorId: adminAId }, proxyIntent.uploadId, proxyBytes);
    const proxyItem = await content.finalizeUpload({ academyId: academyAId, actorId: adminAId }, proxyIntent.uploadId, {});
    assert.equal(proxyItem.name, "proxy-verified.txt");
  } finally { providerTestHooks.reset(); }
});

test("question and taxonomy lifecycle is tenant-scoped and sanitizes persisted rich text", { skip: !enabled }, async () => {
  const scope = { academyId: academyAId, actorId: adminAId };
  const subject = await questions.createTaxonomyNode(scope, { kind: "subject", parentId: courseAId, courseId: courseAId, name: "Mathematics" });
  const chapter = await questions.createTaxonomyNode(scope, { kind: "chapter", parentId: subject.id, courseId: courseAId, name: "Algebra" });
  const created = await questions.createQuestion(scope, { kind: "NORMAL_MCQ", courseId: courseAId, subjectId: subject.id, chapterId: chapter.id, questionHtml: '<p>2 + 2?</p><script>alert(1)</script>', correctOptionId: "B", options: [{ optionLabel: "A", html: "3" }, { optionLabel: "B", html: "4" }] });
  assert.doesNotMatch(created.questionHtml, /script|alert/i);
  const persisted = await prisma.question.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(persisted.academyId, academyAId);
  assert.equal(persisted.courseId, courseAId);
  const replaced = await questions.updateQuestion(scope, created.id, { kind: "NORMAL_MCQ", courseId: courseAId, questionHtml: "Updated", correctOptionId: "A", options: [{ optionLabel: "A", html: "4" }, { optionLabel: "B", html: "5" }] });
  assert.equal(replaced.options.length, 2); assert.equal(replaced.correctOptionId, "A");
  const cloned = await questions.cloneQuestion(scope, created.id); assert.equal(cloned.status, "DRAFT");
  const caseQuestion = await questions.createQuestion(scope, { kind: "CASE_MCQ", courseId: courseAId, caseHtml: "Read the Academy case.", classificationMode: "ENTIRE_CASE", subQuestions: [{ questionHtml: "Which option applies?", correctOptionId: "A", options: [{ optionLabel: "A", html: "Applicable" }, { optionLabel: "B", html: "Not applicable" }] }] });
  assert.equal(caseQuestion.kind, "CASE_MCQ");
  assert.equal(caseQuestion.subQuestions.length, 1);
  await questions.setQuestionLifecycle(scope, created.id, "publish");
  await questions.setQuestionLifecycle(scope, created.id, "archive");
  await questions.setQuestionLifecycle(scope, created.id, "restore");
  await questions.setQuestionLifecycle(scope, created.id, "publish");
  await expectCode(() => questions.getQuestion({ academyId: academyBId, actorId: adminAId }, created.id), "QUESTION_NOT_FOUND");
  await expectCode(() => questions.createQuestion({ academyId: academyAId, actorId: adminAId }, { kind: "NORMAL_DESCRIPTIVE", courseId: courseBId, questionHtml: "foreign" }), "COURSE_NOT_FOUND");
  const academyBQuestion = await questions.createQuestion({ academyId: academyBId, actorId: adminAId }, { kind: "NORMAL_DESCRIPTIVE", courseId: courseBId, questionHtml: "Academy B private question" });
  const academyAList = await questions.listQuestions(scope, { page: 1, limit: 100, includeDeleted: true });
  const academyBList = await questions.listQuestions({ academyId: academyBId, actorId: adminAId }, { page: 1, limit: 100, includeDeleted: true });
  const platformList = await questions.listQuestions({ actorId: superId }, { page: 1, limit: 100, includeDeleted: true });
  assert.ok(academyAList.data.some((question) => question.id === created.id));
  assert.ok(!academyAList.data.some((question) => question.id === academyBQuestion.id));
  assert.ok(academyBList.data.some((question) => question.id === academyBQuestion.id));
  assert.ok(!platformList.data.some((question) => question.id === created.id || question.id === academyBQuestion.id));
  await expectCode(() => questions.getTaxonomy(scope, courseBId), "COURSE_NOT_FOUND");
  const academyStudentList = await questions.listStudentQuestions(studentAId, academyAId, { page: 1, limit: 100 });
  const directStudentList = await questions.listStudentQuestions(studentAId, undefined, { page: 1, limit: 100 });
  assert.ok(academyStudentList.data.some((question) => question.id === created.id));
  assert.ok(!directStudentList.data.some((question) => question.id === created.id || question.id === academyBQuestion.id));
  await expectCode(() => questions.listStudentQuestions(outsiderId, academyAId, { page: 1, limit: 100 }), "ACADEMY_QUESTIONS_NOT_FOUND");
});

test("broadcast delivery, templates, durable jobs, retries, deduplication, and stale recovery persist correctly", { skip: !enabled }, async () => {
  const sent: string[] = [];
  const email: EmailProvider = { async send(message) { sent.push(message.idempotencyKey); return { providerMessageId: `mail-${sent.length}` }; } };
  providerTestHooks.setEmail(email);
  try {
    const template = await templates.createTemplate(contextA, { title: "Hello {{name}}", body: "Welcome {{name}}", category: "welcome" });
    assert.equal((await templates.previewTemplate(contextA, template.id, { name: "Learner" })).body, "Welcome Learner");
    await expectCode(() => templates.previewTemplate(contextB, template.id, { name: "Attacker" }), "NOTIFICATION_TEMPLATE_NOT_FOUND");
    await expectCode(() => academy.createAcademyBroadcast(contextA, { title: "Foreign course", message: "Denied", targetCourseId: courseBId }), "COURSE_NOT_FOUND");
    await expectCode(() => academy.createAcademyBroadcast(contextA, { title: "Unsafe internal route", message: "Denied", cta: { enabled: true, text: "Open", action: "INTERNAL_ROUTE", destination: "/store/packages" } }), "INVALID_BROADCAST_CTA");
    await expectCode(() => academy.createAcademyBroadcast(contextA, { title: "Foreign CTA", message: "Denied", cta: { enabled: true, text: "Open", action: "COURSE", destination: courseBId } }), "COURSE_NOT_FOUND");
    const academyBPrivate = await academy.createAcademyBroadcast(contextB, { title: "Academy B Broadcast", message: "Academy B only" });
    const broadcast = await academy.createAcademyBroadcast(contextA, {
      title: "Phase 4 Broadcast", subtitle: "Rich persisted workflow", message: "Delivery test", type: "ACADEMIC", priority: "HIGH",
      platform: "BOTH", placements: ["NOTIFICATION", "HOME", "GENERAL"], frequency: "UNTIL_DISMISSED", dismissible: true,
      presentation: "BANNER", displayOrder: "CUSTOM", customOrderWeight: 77, acknowledgementRequired: true,
      repeatBehavior: "CONTINUE", showInWhatsNew: true,
      cta: { enabled: true, text: "View course", action: "COURSE", destination: courseAId },
    });
    assert.equal(broadcast.academyId, academyAId);
    assert.equal(broadcast.audienceKind, "ACADEMY_STUDENTS");
    assert.equal(broadcast.cta?.destination, courseAId);
    assert.deepEqual(broadcast.placements.map((entry) => entry.placement).sort(), ["GENERAL", "HOME", "NOTIFICATION"]);
    const persistedBroadcast = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id }, include: { placements: true, cta: true, timeline: true } });
    assert.equal(persistedBroadcast.academyId, academyAId);
    assert.equal(persistedBroadcast.presentation, "BANNER");
    assert.equal(persistedBroadcast.displayOrder, "CUSTOM");
    assert.equal(persistedBroadcast.customOrderWeight, 77);
    assert.equal(persistedBroadcast.acknowledgementRequired, true);
    assert.equal(persistedBroadcast.repeatBehavior, "CONTINUE");
    assert.equal(persistedBroadcast.showInWhatsNew, true);
    assert.equal(persistedBroadcast.cta?.action, "COURSE");
    assert.ok(persistedBroadcast.timeline.some((event) => event.action === "CREATED"));
    const academyAList = await academy.getAcademyBroadcasts(contextA, { page: 1, limit: 100 });
    assert.ok(academyAList.data.some((item) => item.id === broadcast.id));
    assert.ok(!academyAList.data.some((item) => item.id === academyBPrivate.id));
    await expectCode(() => academy.getAcademyBroadcastDetail(contextA, academyBPrivate.id), "BROADCAST_NOT_FOUND");
    await expectCode(() => academy.updateAcademyBroadcast(contextA, academyBPrivate.id, { title: "Tampered" }), "BROADCAST_NOT_FOUND");
    const published = await academy.publishAcademyBroadcast(contextA, broadcast.id);
    assert.equal(published.delivery.status, "QUEUED");
    const concurrentRuns = await Promise.all([
      runDueJobsOnce({ workerId: "phase4-worker-a", limit: 20 }),
      runDueJobsOnce({ workerId: "phase4-worker-b", limit: 20 }),
    ]);
    const deliveryClaims = concurrentRuns.flat().filter((item) => item.id === published.delivery.jobId);
    assert.equal(deliveryClaims.length, 1, "Concurrent workers must claim a broadcast delivery job exactly once");
    assert.equal(deliveryClaims[0]?.status, "COMPLETED");
    const notification = await prisma.notification.findUniqueOrThrow({ where: { id: published.delivery.notificationId } });
    const expectedRecipients = await prisma.academyMembership.count({ where: { academyId: academyAId, role: "ACADEMY_STUDENT", status: "ACTIVE" } });
    assert.equal(notification.status, "SENT"); assert.equal(notification.totalRecipients, expectedRecipients);
    const courseBroadcast = await academy.createAcademyBroadcast(contextA, { title: "Course audience", message: "Course-only delivery", targetCourseId: courseAId });
    assert.equal(courseBroadcast.audienceKind, "COURSES");
    assert.equal(courseBroadcast.courseTargets[0]?.course.id, courseAId);
    const coursePublished = await academy.publishAcademyBroadcast(contextA, courseBroadcast.id);
    await runDueJobsOnce({ workerId: "phase4-course-worker", limit: 20 });
    const courseNotification = await prisma.notification.findUniqueOrThrow({ where: { id: coursePublished.delivery.notificationId } });
    const expectedCourseRecipients = await prisma.academyCourseEnrollment.count({ where: { academyId: academyAId, courseId: courseAId, status: "ACTIVE", student: { academyMemberships: { some: { academyId: academyAId, role: "ACADEMY_STUDENT", status: "ACTIVE" } } } } });
    assert.equal(courseNotification.targetType, "COURSE");
    assert.equal(courseNotification.targetCourseId, courseAId);
    assert.equal(courseNotification.status, "SENT");
    assert.equal(courseNotification.totalRecipients, expectedCourseRecipients);
    const emailNotification = await notifications.createNotification(contextA, { title: "Email abstraction", body: "Provider delivery", targetType: "ALL_STUDENTS" });
    const emailResult = await notifications.sendNotification(contextA, emailNotification.id, ["IN_APP", "EMAIL"]);
    assert.equal(emailResult.channels.emailDelivered, expectedRecipients);
    assert.equal(await prisma.notificationDelivery.count({ where: { notificationId: emailNotification.id, channel: "EMAIL", status: "DELIVERED" } }), expectedRecipients);
    const dedupeA = await enqueueJob({ kind: "CONTACT_EMAIL", payload: { submissionId: randomUUID() }, deduplicationKey: `dedupe-${suffix}` });
    const dedupeB = await enqueueJob({ kind: "CONTACT_EMAIL", payload: { submissionId: randomUUID() }, deduplicationKey: `dedupe-${suffix}` });
    assert.equal(dedupeA.id, dedupeB.id);
    const stale = await prisma.backgroundJob.create({ data: { kind: "UNKNOWN_PHASE4", payload: {}, status: "PROCESSING", lockedAt: new Date(Date.now() - 11 * 60_000), lockedBy: "dead-worker", attemptCount: 1, maxAttempts: 3 } });
    await runDueJobsOnce({ workerId: "phase4-recovery", limit: 1 });
    const recovered = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: stale.id } });
    assert.notEqual(recovered.status, "PROCESSING"); assert.equal(recovered.lockedBy, null);
    const exhausted = await prisma.backgroundJob.create({ data: { kind: "UNKNOWN_PHASE4_EXHAUSTED", payload: {}, status: "PENDING", runAt: new Date(0), attemptCount: 1, maxAttempts: 1 } });
    await runDueJobsOnce({ workerId: "phase4-exhaustion", limit: 100 });
    assert.equal((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: exhausted.id } })).status, "FAILED");
    const scheduled = await academy.createAcademyBroadcast(contextA, { title: "Cancel race", message: "cancel" });
    await academy.scheduleAcademyBroadcast(contextA, scheduled.id, new Date(Date.now() + 60_000).toISOString());
    await academy.cancelAcademyBroadcast(contextA, scheduled.id);
    assert.equal((await prisma.backgroundJob.findUniqueOrThrow({ where: { kind_deduplicationKey: { kind: "BROADCAST_PUBLISH", deduplicationKey: scheduled.id } } })).status, "CANCELLED");
  } finally { providerTestHooks.reset(); }
});

test("Super Admin Academy Details aggregates and operational rows are database-backed and tenant-scoped", { skip: !enabled }, async () => {
  const detail = await adminDomains.getAcademy(academyAId);
  const foreign = await adminDomains.getAcademy(academyBId);
  const [students, activeStudents, courses, publishedCourses, contentItemsCount, questionCount, broadcastCount, activeBroadcastCount] = await Promise.all([
    prisma.academyMembership.count({ where: { academyId: academyAId, role: "ACADEMY_STUDENT" } }),
    prisma.academyMembership.count({ where: { academyId: academyAId, role: "ACADEMY_STUDENT", status: "ACTIVE", user: { status: "ACTIVE", deletedAt: null } } }),
    prisma.course.count({ where: { academyId: academyAId, deletedAt: null } }),
    prisma.course.count({ where: { academyId: academyAId, status: "ACTIVE", deletedAt: null } }),
    prisma.contentItem.count({ where: { deletedAt: null, course: { academyId: academyAId, deletedAt: null } } }),
    prisma.question.count({ where: { academyId: academyAId, deletedAt: null } }),
    prisma.broadcast.count({ where: { academyId: academyAId, deletedAt: null } }),
    prisma.broadcast.count({ where: { academyId: academyAId, status: "ACTIVE", deletedAt: null } }),
  ]);

  assert.deepEqual({
    studentsCount: detail.metrics.studentsCount,
    activeStudentsCount: detail.metrics.activeStudentsCount,
    coursesCount: detail.metrics.coursesCount,
    publishedCoursesCount: detail.metrics.publishedCoursesCount,
    contentCount: detail.metrics.contentCount,
    questionsCount: detail.metrics.questionsCount,
    broadcastCount: detail.metrics.broadcastCount,
    activeBroadcastCount: detail.metrics.activeBroadcastCount,
  }, {
    studentsCount: students,
    activeStudentsCount: activeStudents,
    coursesCount: courses,
    publishedCoursesCount: publishedCourses,
    contentCount: contentItemsCount,
    questionsCount: questionCount,
    broadcastCount,
    activeBroadcastCount,
  });
  assert.equal(detail.administrator.id, adminAId);
  assert.ok(detail.contentItems.every((item) => item.course.id === courseAId));
  assert.equal(detail.questions.length, questionCount);
  assert.equal(detail.broadcasts.length, broadcastCount);
  assert.equal(foreign.metrics.studentsCount, 1);
  assert.equal(foreign.contentItems.length, 0);
  assert.equal(foreign.questions.length, foreign.metrics.questionsCount);
  assert.equal(foreign.broadcasts.length, foreign.metrics.broadcastCount);
  const foreignQuestionIds = new Set((await prisma.question.findMany({ where: { academyId: academyBId, deletedAt: null }, select: { id: true } })).map((item) => item.id));
  const foreignBroadcastIds = new Set((await prisma.broadcast.findMany({ where: { academyId: academyBId, deletedAt: null }, select: { id: true } })).map((item) => item.id));
  assert.ok(foreign.questions.every((item) => foreignQuestionIds.has(item.id)));
  assert.ok(foreign.broadcasts.every((item) => foreignBroadcastIds.has(item.id)));
});

test("commerce enforces server pricing, idempotency, coupon concurrency, webhook replay, and refund idempotency", { skip: !enabled }, async () => {
  let checkoutCounter = 0;
  const payment: PaymentProvider = {
    async createCheckout(request) { checkoutCounter += 1; return { providerPaymentId: `provider-${request.orderId}`, redirectUrl: `https://pay.test/${request.orderId}` }; },
    async verifyWebhook(rawBody, signature) { if (signature !== "valid") throw new Error("bad signature"); const body = JSON.parse(rawBody.toString()) as { eventId: string; eventType: string; providerPaymentId: string; status: string }; return { eventId: body.eventId, eventType: body.eventType, payload: { providerPaymentId: body.providerPaymentId, status: body.status } }; },
    async refund(_providerPaymentId, _amountMinor, idempotencyKey) { return { providerRefundId: `refund-${idempotencyKey}` }; },
  };
  providerTestHooks.setPayment(payment);
  try {
    const paidPackage = await adminDomains.createPackage(superId, { courseId: courseAId, title: `Paid ${suffix}`, price: 499, status: "PUBLISHED" });
    const checkout = await commerce.createCheckout(studentAId, { packageIds: [paidPackage.id] }, `paid-${suffix}`) as Record<string, unknown>;
    assert.equal(checkout.totalAmount, 499); assert.ok(checkout.checkoutUrl); assert.equal(checkoutCounter, 1);
    const replay = await commerce.createCheckout(studentAId, { packageIds: [paidPackage.id] }, `paid-${suffix}`) as Record<string, unknown>;
    assert.equal(replay.orderId, checkout.orderId); assert.equal(checkoutCounter, 1);
    await expectCode(() => commerce.createCheckout(studentAId, { packageIds: [paidPackage.id], couponCode: "DIFFERENT" }, `paid-${suffix}`), "IDEMPOTENCY_KEY_REUSED");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: String(checkout.orderId) }, include: { payments: true } });
    const webhookBody = Buffer.from(JSON.stringify({ eventId: `event-${suffix}`, eventType: "PAYMENT_SUCCEEDED", providerPaymentId: order.payments[0]!.providerPaymentId, status: "SUCCESS" }));
    await expectCode(() => commerce.handlePaymentWebhook("http", webhookBody, "tampered"), "INVALID_WEBHOOK_SIGNATURE");
    const webhookAttempts = await Promise.allSettled([commerce.handlePaymentWebhook("http", webhookBody, "valid"), commerce.handlePaymentWebhook("http", webhookBody, "valid")]);
    assert.ok(webhookAttempts.some((item) => item.status === "fulfilled"));
    assert.equal(await prisma.entitlement.count({ where: { orderId: order.id } }), 1);
    const refundA = await admin.refundAdminOrder(superId, order.id, { reason: "Phase 4", idempotencyKey: `refund-${suffix}` });
    const refundB = await admin.refundAdminOrder(superId, order.id, { reason: "Phase 4", idempotencyKey: `refund-${suffix}` });
    assert.equal(refundA.id, refundB.id);
    const freePackage = await adminDomains.createPackage(superId, { courseId: courseAId, title: `Coupon ${suffix}`, price: 100, status: "PUBLISHED" });
    const coupon = await adminDomains.createCoupon(superId, { code: `ONE${suffix}`, discountType: "PERCENT", discountValue: 100, maxUses: 1 });
    const couponAttempts = await Promise.allSettled([
      commerce.createCheckout(studentAId, { packageIds: [freePackage.id], couponCode: coupon.code }, `coupon-a-${suffix}`),
      commerce.createCheckout(studentBId, { packageIds: [freePackage.id], couponCode: coupon.code }, `coupon-b-${suffix}`),
    ]);
    assert.equal(couponAttempts.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usageCount, 1);
  } finally { providerTestHooks.reset(); }
});

test("Super Admin, Student, public catalog/contact, and recursive audit redaction use persisted data", { skip: !enabled }, async () => {
  const overview = await admin.getAdminOverview();
  // Other integration cases intentionally create and remove disposable users
  // and academies in parallel. A second database count is not an atomic
  // comparison with the overview's Promise.all snapshot, so validate the
  // persisted aggregate contract without introducing a cross-test race.
  assert.ok(Number.isInteger(overview.users) && overview.users >= 2);
  assert.ok(Number.isInteger(overview.academies) && overview.academies >= 2);
  const granted = await adminDomains.grantEntitlement(superId, { userId: studentAId, resourceType: "COURSE", courseId: courseAId, resourceTitle: "Phase 4 Course", reason: "Phase 4 verification" });
  assert.equal((await student.getMemberships(studentAId)).data.length >= 1, true);
  await student.setActiveAcademy(studentAId, academyAId);
  assert.equal((await student.getDashboard(studentAId)).academyId, academyAId);
  assert.equal((await student.listCourses(studentAId)).data.length >= 1, true);
  await expectCode(() => student.setActiveAcademy(studentAId, academyBId), "ACADEMY_MEMBERSHIP_REQUIRED");
  const catalog = await publicApi.listCatalog({ page: 1, limit: 100, academyId: academyAId });
  assert.ok(catalog.courses.some((item) => item.id === courseAId));
  assert.ok(catalog.packages.every((item) => !("deletedAt" in item) && !("storagePath" in item)));
  const contact = await publicApi.submitContact({ name: "Phase Four", email: `contact-${suffix}@test.invalid`, subject: "Verification", message: "This is a Phase 4 contact verification message.", academyId: academyAId, ipAddress: "127.0.0.1" });
  assert.equal(contact.status, "RECEIVED");
  const persisted = await prisma.contactSubmission.findUniqueOrThrow({ where: { id: contact.id } });
  assert.ok(persisted.ipHash && persisted.ipHash !== "127.0.0.1");
  await prisma.systemAuditLog.create({ data: { actorId: superId, action: "PHASE4_REDACTION", entityType: "Verification", before: { password: "secret", nested: { authorization: "Bearer token", safe: "visible" } }, after: { cookie: "session=secret", api_key: "secret" } } });
  const events = await admin.listAuditEvents({ page: 1, limit: 100, action: "PHASE4_REDACTION" });
  const serialized = JSON.stringify(events.data[0]);
  assert.doesNotMatch(serialized, /Bearer token|session=secret|\"secret\"/); assert.match(serialized, /\[REDACTED\]/);
  await adminDomains.revokeEntitlement(superId, granted.id, "Verification complete");
});

test("database integrity queries and representative EXPLAIN plans complete without violations", { skip: !enabled }, async () => {
  const integrity = await prisma.$queryRawUnsafe<Array<{ violation: string; count: bigint }>>(`
    SELECT 'membership_without_academy' AS violation, COUNT(*)::bigint AS count FROM "AcademyMembership" m LEFT JOIN "Academy" a ON a.id=m."academyId" WHERE a.id IS NULL
    UNION ALL SELECT 'membership_without_user', COUNT(*)::bigint FROM "AcademyMembership" m LEFT JOIN "User" u ON u.id=m."userId" WHERE u.id IS NULL
    UNION ALL SELECT 'recipient_tenant_mismatch', COUNT(*)::bigint FROM "NotificationRecipient" r JOIN "Notification" n ON n.id=r."notificationId" WHERE r."academyId"<>n."academyId"
    UNION ALL SELECT 'order_total_mismatch', COUNT(*)::bigint FROM "Order" WHERE "totalAmount"<>GREATEST(0,"subtotal"-"discountAmount")
    UNION ALL SELECT 'job_lock_mismatch', COUNT(*)::bigint FROM "BackgroundJob" WHERE (status='PROCESSING')<>("lockedAt" IS NOT NULL AND "lockedBy" IS NOT NULL)
  `);
  assert.deepEqual(integrity.filter((row) => Number(row.count) !== 0), []);
  const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM "SystemAuditLog" WHERE "academyId"='${academyAId}'::uuid ORDER BY "occurredAt" DESC LIMIT 25`);
  assert.ok(plan[0]?.["QUERY PLAN"]);
  const plan2 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM "NotificationRecipient" WHERE "studentUserId"='${studentAId}'::uuid AND "isRead"=false ORDER BY "createdAt" DESC LIMIT 25`);
  assert.ok(plan2[0]?.["QUERY PLAN"]);
});

test.after(async () => { providerTestHooks.reset(); await prisma.$disconnect(); });
