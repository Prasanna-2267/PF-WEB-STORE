import { randomUUID } from "node:crypto";
import { prisma } from "../src/db/prisma.js";
import { hashPassword } from "../src/auth/password.js";
import {
  GLOBAL_PERMISSION_SEEDS,
  GLOBAL_ROLE_SEEDS,
  SUPER_ADMIN_PERMISSION_KEYS,
} from "./seed-data.js";

async function seedAuthFoundation(): Promise<void> {
  const roles = await Promise.all(
    GLOBAL_ROLE_SEEDS.map((role) =>
      prisma.role.upsert({
        where: { key: role.key },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
          isActive: true,
        },
        create: {
          ...role,
          isSystem: true,
          isActive: true,
        },
      }),
    ),
  );

  const permissions = await Promise.all(
    GLOBAL_PERMISSION_SEEDS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          module: permission.module,
          action: permission.action,
          description: permission.description,
        },
        create: permission,
      }),
    ),
  );

  const superAdminRole = roles.find(({ key }) => key === "super_admin");
  const approvedSuperAdminPermissions = permissions.filter(({ key }) =>
    SUPER_ADMIN_PERMISSION_KEYS.includes(
      key as (typeof SUPER_ADMIN_PERMISSION_KEYS)[number],
    ),
  );

  if (!superAdminRole) {
    throw new Error("The super_admin role seed could not be resolved.");
  }

  await prisma.rolePermission.createMany({
    data: approvedSuperAdminPermissions.map(({ id: permissionId }) => ({
      roleId: superAdminRole.id,
      permissionId,
    })),
    skipDuplicates: true,
  });

  // Stable local integration identities. These records are intentionally
  // provisioned by the disposable/local seed only; production account
  // provisioning remains an explicit administrative operation.
  const localPassword = "Phase4-only-Password!23456789";
  const [seededSuperAdminRole, academyAdminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } }),
    prisma.role.findUniqueOrThrow({ where: { key: "ACADEMY_ADMIN" } }),
  ]);
  const passwordHash = await hashPassword(localPassword);

  const superAdmin = await prisma.user.upsert({
    where: { email: "brightsteps2025@gmail.com" },
    update: { fullName: "Brightsteps Super Admin", roleId: seededSuperAdminRole.id, status: "ACTIVE", deletedAt: null },
    create: { id: randomUUID(), email: "brightsteps2025@gmail.com", fullName: "Brightsteps Super Admin", roleId: seededSuperAdminRole.id },
  });
  await prisma.passwordCredential.upsert({
    where: { userId: superAdmin.id },
    update: { passwordHash },
    create: { userId: superAdmin.id, passwordHash },
  });

  const academy = await prisma.academy.findFirst({ where: { name: "Phase 4 Academy A", deletedAt: null }, orderBy: { createdAt: "asc" } }) ?? await prisma.academy.create({
    data: {
      id: "99a70359-d3c4-484b-a9d7-a43d198406b4",
      slug: "phase-4-academy-a",
      name: "Phase 4 Academy A",
      email: "phase4-academy-a@local.test",
      phone: "9000000001",
      address: "A",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600001",
      status: "ACTIVE",
      adminName: "Kartikeyan Suresh",
      adminEmail: "kartikeyansuresh2703@gmail.com",
    },
  });
  const academyAdmin = await prisma.user.upsert({
    where: { email: "kartikeyansuresh2703@gmail.com" },
    update: { fullName: "Kartikeyan Suresh", roleId: academyAdminRole.id, status: "ACTIVE", deletedAt: null },
    create: { id: randomUUID(), email: "kartikeyansuresh2703@gmail.com", fullName: "Kartikeyan Suresh", roleId: academyAdminRole.id },
  });
  await prisma.passwordCredential.upsert({
    where: { userId: academyAdmin.id },
    update: { passwordHash },
    create: { userId: academyAdmin.id, passwordHash },
  });
  await prisma.academyMembership.updateMany({
    where: { userId: academyAdmin.id, academyId: { not: academy.id }, status: "ACTIVE" },
    data: { status: "SUSPENDED" },
  });
  await prisma.academyMembership.upsert({
    where: { userId_academyId: { userId: academyAdmin.id, academyId: academy.id } },
    update: { role: "ACADEMY_ADMIN", status: "ACTIVE" },
    create: { userId: academyAdmin.id, academyId: academy.id, role: "ACADEMY_ADMIN", status: "ACTIVE" },
  });
}

seedAuthFoundation()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Auth foundation seed failed.", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
