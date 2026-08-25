import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { Prisma } from "../../generated/prisma/client.js";
import { getConfig } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { conflict, forbidden, serviceUnavailable, unauthorized } from "../errors/api-error.js";
import { logger } from "../observability/logger.js";
import { consumePasswordVerificationWork, hashPassword, verifyPassword } from "./password.js";
import {
  createRefreshToken,
  hashRefreshToken,
  issueAccessToken,
  parseRefreshToken,
  refreshTokenMatches,
} from "./tokens.js";
import type { AuthContext, AuthResult, PublicUser, RequestMetadata } from "./types.js";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Platform role keys are persisted in their canonical database form. The web
 * client receives a small, stable role vocabulary for routing only; tenant
 * authorization is still resolved from the session and AcademyMembership.
 */
export const publicRoleKey = (roleKey: string): string => {
  if (roleKey === "ACADEMY_ADMIN") return "academy_admin";
  if (roleKey === "ACADEMY_STUDENT" || roleKey === "STUDENT") return "student";
  return roleKey;
};

const permissionSelect = {
  key: true,
  isActive: true,
  rolePermissions: { select: { permission: { select: { key: true } } } },
} satisfies Prisma.RoleSelect;

const publicUser = (user: {
  id: string;
  email: string;
  fullName: string;
  role: { key: string; rolePermissions: Array<{ permission: { key: string } }> };
}): PublicUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: publicRoleKey(user.role.key),
  permissions: user.role.rolePermissions.map(({ permission }) => permission.key).sort(),
});

const cleanMetadata = (metadata: RequestMetadata) => ({
  ipAddress: metadata.ipAddress?.slice(0, 128),
  userAgent: metadata.userAgent?.slice(0, 512),
  deviceName: metadata.deviceName?.slice(0, 128),
});

const securityMetadata = (metadata: RequestMetadata) => {
  const cleaned = cleanMetadata(metadata);
  return { ipAddress: cleaned.ipAddress, userAgent: cleaned.userAgent };
};

const recordFailedLogin = async (userId: string | undefined, metadata: RequestMetadata): Promise<void> => {
  try {
    await prisma.securityEvent.create({
      data: {
        eventType: "LOGIN_FAILED",
        riskLevel: "MEDIUM",
        description: "An authentication attempt was rejected.",
        userId,
        ...securityMetadata(metadata),
      },
    });
  } catch (error) {
    logger.error("security_event.write_failed", error, { eventType: "LOGIN_FAILED", userId });
  }
};

const createSession = async (
  user: {
    id: string;
    email: string;
    fullName: string;
    role: { key: string; rolePermissions: Array<{ permission: { key: string } }> };
  },
  metadata: RequestMetadata,
): Promise<AuthResult> => {
  const config = getConfig();
  const authSessionId = randomUUID();
  const refreshToken = createRefreshToken(authSessionId);
  const expiresAt = new Date(Date.now() + config.auth.refreshTokenTtlSeconds * 1_000);
  const requestMetadata = cleanMetadata(metadata);

  await prisma.$transaction(async (transaction) => {
    const session = await transaction.userSession.create({
      data: {
        userId: user.id,
        authSessionId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        userAgent: requestMetadata.userAgent,
        ipAddress: requestMetadata.ipAddress,
        deviceName: requestMetadata.deviceName,
        platform: "WEB",
      },
      select: { id: true },
    });
    await transaction.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await transaction.securityEvent.createMany({
      data: [
        {
          eventType: "LOGIN_SUCCESS",
          riskLevel: "LOW",
          description: "Authentication succeeded.",
          userId: user.id,
          actorId: user.id,
          sessionId: session.id,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
        },
        {
          eventType: "SESSION_CREATED",
          riskLevel: "LOW",
          description: "A revocable application session was created.",
          userId: user.id,
          actorId: user.id,
          sessionId: session.id,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
        },
      ],
    });
  });

  return {
    accessToken: issueAccessToken(user.id, authSessionId, config.auth),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: config.auth.accessTokenTtlSeconds,
    user: publicUser(user),
  };
};

export const loginWithPassword = async (
  email: string,
  password: string,
  metadata: RequestMetadata,
): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      deletedAt: true,
      passwordCredential: { select: { passwordHash: true } },
      role: { select: permissionSelect },
    },
  });

  const validPassword = user?.passwordCredential
    ? await verifyPassword(password, user.passwordCredential.passwordHash)
    : (await consumePasswordVerificationWork(password), false);

  if (!user || !validPassword) {
    await recordFailedLogin(user?.id, metadata);
    throw unauthorized("The email or password is incorrect.");
  }
  if (user.deletedAt || user.status !== "ACTIVE" || !user.role.isActive) {
    await recordFailedLogin(user.id, metadata);
    throw unauthorized("The email or password is incorrect.");
  }

  return createSession(user, metadata);
};

export const registerWithPassword = async (
  input: { email: string; fullName: string; password: string },
  metadata: RequestMetadata,
): Promise<AuthResult> => {
  const config = getConfig();
  if (!config.auth.passwordRegistrationEnabled) {
    throw serviceUnavailable("REGISTRATION_DISABLED", "Password registration is not enabled for this deployment.");
  }

  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  let user: Awaited<ReturnType<typeof prisma.user.create>> & {
    role: { key: string; rolePermissions: Array<{ permission: { key: string } }> };
  };
  try {
    user = await prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({ where: { key: "student" }, select: { id: true, isActive: true } });
      if (!role?.isActive) throw serviceUnavailable("IDENTITY_CONFIGURATION_ERROR", "The student role is not available.");
      return transaction.user.create({
        data: {
          id: randomUUID(),
          email,
          fullName: input.fullName.trim(),
          roleId: role.id,
          passwordCredential: { create: { passwordHash } },
        },
        include: { role: { select: permissionSelect } },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("EMAIL_ALREADY_REGISTERED", "An account already exists for this email address.");
    }
    throw error;
  }
  return createSession(user, metadata);
};

export const loginWithGoogle = async (
  idToken: string,
  metadata: RequestMetadata,
): Promise<AuthResult> => {
  const config = getConfig();
  if (!config.auth.googleClientId) {
    throw serviceUnavailable("GOOGLE_AUTH_NOT_CONFIGURED", "Google authentication is not configured.");
  }

  let payload;
  try {
    const ticket = await new OAuth2Client(config.auth.googleClientId).verifyIdToken({
      idToken,
      audience: config.auth.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    await recordFailedLogin(undefined, metadata);
    throw unauthorized("The Google credential is invalid or expired.");
  }
  if (!payload?.email || payload.email_verified !== true || !payload.sub) {
    await recordFailedLogin(undefined, metadata);
    throw unauthorized("The Google credential does not contain a verified email identity.");
  }

  const email = normalizeEmail(payload.email);
  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, status: true, deletedAt: true, role: { select: permissionSelect } },
  });

  if (!user && config.auth.googleRegistrationEnabled) {
    const role = await prisma.role.findUnique({ where: { key: "student" }, select: { id: true, isActive: true } });
    if (!role?.isActive) throw serviceUnavailable("IDENTITY_CONFIGURATION_ERROR", "The student role is not available.");
    user = await prisma.user.create({
      data: { id: randomUUID(), email, fullName: payload.name?.trim() || email.split("@", 1)[0]!, roleId: role.id },
      select: { id: true, email: true, fullName: true, status: true, deletedAt: true, role: { select: permissionSelect } },
    });
  }

  if (!user) throw forbidden("ACCOUNT_NOT_PROVISIONED", "No Parallax Flow account is provisioned for this Google identity.");
  if (user.deletedAt || user.status !== "ACTIVE" || !user.role.isActive) throw unauthorized("This account cannot sign in.");
  return createSession(user, metadata);
};

export const rotateRefreshToken = async (refreshToken: string): Promise<AuthResult> => {
  const config = getConfig();
  const { authSessionId } = parseRefreshToken(refreshToken);
  const session = await prisma.userSession.findUnique({
    where: { authSessionId },
    select: {
      id: true,
      userId: true,
      authSessionId: true,
      refreshTokenHash: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          deletedAt: true,
          role: { select: permissionSelect },
        },
      },
    },
  });
  const now = new Date();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.user.deletedAt ||
    session.user.status !== "ACTIVE" ||
    !session.user.role.isActive ||
    !refreshTokenMatches(refreshToken, session.refreshTokenHash)
  ) {
    throw unauthorized("The refresh token is invalid or expired.");
  }

  const nextRefreshToken = createRefreshToken(session.authSessionId);
  const updated = await prisma.userSession.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      refreshTokenHash: session.refreshTokenHash,
    },
    data: {
      refreshTokenHash: hashRefreshToken(nextRefreshToken),
      rotationCounter: { increment: 1 },
      lastRotatedAt: now,
      lastSeenAt: now,
    },
  });
  if (updated.count !== 1) throw unauthorized("The refresh token has already been used.");

  return {
    accessToken: issueAccessToken(session.userId, session.authSessionId, config.auth),
    refreshToken: nextRefreshToken,
    tokenType: "Bearer",
    expiresIn: config.auth.accessTokenTtlSeconds,
    user: publicUser(session.user),
  };
};

export const revokeSession = async (auth: AuthContext, metadata: RequestMetadata): Promise<void> => {
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.userSession.updateMany({
      where: { id: auth.sessionId, userId: auth.userId, revokedAt: null },
      data: { revokedAt: now, refreshTokenHash: null },
    });
    await transaction.securityEvent.create({
      data: {
        eventType: "LOGOUT",
        riskLevel: "LOW",
        description: "The application session was revoked by its user.",
        userId: auth.userId,
        actorId: auth.userId,
        sessionId: auth.sessionId,
        ...securityMetadata(metadata),
      },
    });
  });
};
