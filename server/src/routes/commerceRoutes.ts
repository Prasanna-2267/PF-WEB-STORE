import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../errors/api-error.js";
import { asyncRoute } from "../middleware/async-route.js";
import * as commerce from "../services/commerceService.js";

export const checkoutRouter = Router();
checkoutRouter.post("/", asyncRoute(async (req, res) => { const key = req.get("idempotency-key")?.trim(); if (!key || key.length > 200) throw badRequest("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required."); const body = z.object({ packageIds: z.array(z.string().uuid()).min(1).max(50), couponCode: z.string().trim().max(40).optional() }).strict().parse(req.body); res.status(201).json(await commerce.createCheckout(req.auth!.userId, body, key)); }));

export const paymentWebhookRouter = Router();
paymentWebhookRouter.post("/webhook/:provider", asyncRoute(async (req, res) => { const provider = z.string().trim().regex(/^[a-z0-9_-]{2,40}$/).parse(req.params.provider); const signature = req.get("x-payment-signature"); if (!signature) throw badRequest("WEBHOOK_SIGNATURE_REQUIRED", "A payment signature is required."); res.status(202).json(await commerce.handlePaymentWebhook(provider, req.body as Buffer, signature)); }));
