import { Router, type Request } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth-middleware.js";
import {
  loginWithGoogle,
  loginWithPassword,
  publicRoleKey,
  registerWithPassword,
  revokeSession,
  rotateRefreshToken,
} from "../auth/auth-service.js";
import type { RequestMetadata } from "../auth/types.js";
import { getConfig } from "../config/env.js";
import { asyncRoute } from "../middleware/async-route.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
const registrationSchema = credentialsSchema.extend({ fullName: z.string().trim().min(2).max(120) });
const googleSchema = z.object({ idToken: z.string().min(100).max(16_384) });
const refreshSchema = z.object({ refreshToken: z.string().min(40).max(512) });

const requestMetadata = (req: Request): RequestMetadata => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
  deviceName: req.get("x-device-name"),
});

export const createAuthRouter = (): Router => {
  const router = Router();
  const config = getConfig();
  router.use((_req, res, next) => {
    res.setHeader("cache-control", "no-store");
    next();
  });
  router.use(createRateLimiter({
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.authMaxRequests,
    namespace: "auth",
  }));

  router.post("/login", asyncRoute(async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    res.json(await loginWithPassword(body.email, body.password, requestMetadata(req)));
  }));
  router.post("/register", asyncRoute(async (req, res) => {
    const body = registrationSchema.parse(req.body);
    res.status(201).json(await registerWithPassword(body, requestMetadata(req)));
  }));
  router.post("/google", asyncRoute(async (req, res) => {
    const body = googleSchema.parse(req.body);
    res.json(await loginWithGoogle(body.idToken, requestMetadata(req)));
  }));
  router.post("/refresh", asyncRoute(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    res.json(await rotateRefreshToken(body.refreshToken));
  }));
  router.post("/logout", requireAuth, asyncRoute(async (req, res) => {
    await revokeSession(req.auth!, requestMetadata(req));
    res.status(204).end();
  }));
  router.get("/session", requireAuth, (req, res) => {
    res.json({
      user: {
        id: req.auth!.userId,
        email: req.auth!.email,
        fullName: req.auth!.fullName,
        role: publicRoleKey(req.auth!.roleKey),
        permissions: [...req.auth!.permissions].sort(),
      },
    });
  });

  return router;
};
