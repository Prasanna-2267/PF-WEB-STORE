import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { ApiError, badRequest, conflict, notFound } from "../errors/api-error.js";
import { getPaymentProvider } from "../integrations/provider-registry.js";
import { getConfig } from "../config/env.js";

const orderNumber = () => `PF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
const receiptNumber = () => `RCP-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
const requestHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function grantOrderEntitlements(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const item of order.items) {
    const duplicate = await tx.entitlement.findFirst({ where: { userId: order.userId, orderId, packageId: item.packageId, contentItemId: item.contentItemId } });
    if (!duplicate) await tx.entitlement.create({ data: { userId: order.userId, resourceType: item.resourceType, contentItemId: item.contentItemId, packageId: item.packageId, resourceTitle: item.titleSnapshot, source: "PURCHASE", orderId, accessType: "PERMANENT", status: "ACTIVE" } });
  }
  await tx.order.update({ where: { id: orderId }, data: { accessStatus: "GRANTED" } });
}

export async function createCheckout(userId: string, input: { packageIds: string[]; couponCode?: string }, idempotencyKey: string) {
  const hash = requestHash(input);
  const existing = await prisma.idempotencyRecord.findUnique({ where: { scope_key: { scope: `checkout:${userId}`, key: idempotencyKey } } });
  if (existing) {
    if (existing.requestHash !== hash) throw conflict("IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used with a different request.");
    if (existing.responseCode >= 400) throw new ApiError(existing.responseCode, "CHECKOUT_PREVIOUSLY_FAILED", "The prior checkout attempt with this idempotency key failed.");
    return existing.responseBody;
  }
  const packages = await prisma.package.findMany({ where: { id: { in: [...new Set(input.packageIds)] }, status: "PUBLISHED", deletedAt: null, course: { status: "ACTIVE", deletedAt: null } }, take: 50, include: { course: true } });
  if (!packages.length || packages.length !== new Set(input.packageIds).size) throw badRequest("INVALID_CHECKOUT_ITEMS", "Every checkout package must be published and available.");
  if (new Set(packages.map((item) => item.courseId)).size !== 1) throw badRequest("MULTI_COURSE_CHECKOUT_UNSUPPORTED", "A checkout can contain packages from only one course.");
  const subtotal = packages.reduce((sum, item) => sum + Number(item.price), 0);
  let coupon: Awaited<ReturnType<typeof prisma.coupon.findFirst>> = null; let discount = 0;
  if (input.couponCode) {
    coupon = await prisma.coupon.findFirst({ where: { code: input.couponCode.toUpperCase(), enabled: true } });
    if (!coupon || (coupon.expiresAt && coupon.expiresAt <= new Date()) || (coupon.maxUses !== null && coupon.usageCount >= coupon.maxUses)) throw badRequest("COUPON_UNAVAILABLE", "The coupon is invalid, expired, or exhausted.");
    const targets = await prisma.couponTarget.findMany({ where: { couponId: coupon.id }, take: 1_001 });
    if (targets.length > 1_000) throw badRequest("COUPON_TARGET_LIMIT_EXCEEDED", "This coupon has too many targets to evaluate safely.");
    if (coupon.scope === "PACKAGES" && !packages.some((item) => targets.some((target) => target.packageId === item.id))) throw badRequest("COUPON_NOT_APPLICABLE", "The coupon does not apply to these packages.");
    discount = coupon.discountType === "PERCENT" ? Math.min(subtotal, subtotal * Number(coupon.discountValue) / 100) : Math.min(subtotal, Number(coupon.discountValue));
  }
  const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
  const provider = total > 0 ? getPaymentProvider() : null;
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
    if (coupon) {
      const claimed = await tx.coupon.updateMany({ where: { id: coupon.id, enabled: true, usageCount: coupon.maxUses === null ? undefined : { lt: coupon.maxUses } }, data: { usageCount: { increment: 1 } } });
      if (!claimed.count) throw conflict("COUPON_EXHAUSTED", "The coupon was exhausted by another checkout.");
    }
    const created = await tx.order.create({ data: { orderNumber: orderNumber(), userId, courseId: packages[0].courseId, subtotal, discountAmount: discount, totalAmount: total, status: total === 0 ? "PAID" : "CREATED", accessStatus: total === 0 ? "PENDING" : "PENDING", isComplimentary: total === 0, paidAt: total === 0 ? new Date() : null, receiptNumber: total === 0 ? receiptNumber() : null, items: { create: packages.map((item) => ({ packageId: item.id, resourceType: "PACKAGE", titleSnapshot: item.title, unitPrice: item.price, quantity: 1, totalPrice: item.price })) } } });
    if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, userId, orderId: created.id, discountAmount: discount } });
    if (total === 0) await grantOrderEntitlements(tx, created.id);
    else await tx.payment.create({ data: { orderId: created.id, provider: "configured", amount: total, currency: "INR", status: "PENDING" } });
    await tx.idempotencyRecord.create({ data: { scope: `checkout:${userId}`, key: idempotencyKey, requestHash: hash, responseCode: 201, responseBody: { orderId: created.id, orderNumber: created.orderNumber, status: created.status, currency: created.currency, subtotal, discountAmount: discount, totalAmount: total }, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.idempotencyRecord.findUnique({ where: { scope_key: { scope: `checkout:${userId}`, key: idempotencyKey } } });
      if (winner?.requestHash !== hash) throw conflict("IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used with a different request.");
      if (winner) return winner.responseBody;
    }
    throw error;
  }
  let response: Record<string, unknown> = { orderId: order.id, orderNumber: order.orderNumber, status: order.status, currency: order.currency, subtotal, discountAmount: discount, totalAmount: total };
  if (provider) {
    try {
      const checkout = await provider.createCheckout({ orderId: order.id, amountMinor: Math.round(total * 100), currency: order.currency, idempotencyKey });
      await prisma.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { providerPaymentId: checkout.providerPaymentId } });
      response = { ...response, checkoutUrl: checkout.redirectUrl };
    } catch (error) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 500) : "Provider failure" } });
        await tx.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
        if (coupon) { await tx.couponRedemption.deleteMany({ where: { orderId: order.id, couponId: coupon.id } }); await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { decrement: 1 } } }); }
        await tx.idempotencyRecord.update({ where: { scope_key: { scope: `checkout:${userId}`, key: idempotencyKey } }, data: { responseCode: 502, responseBody: { orderId: order.id, status: "FAILED", code: "PAYMENT_PROVIDER_FAILED" } } });
      });
      throw new ApiError(502, "PAYMENT_PROVIDER_FAILED", "The payment provider could not create checkout.");
    }
  }
  await prisma.idempotencyRecord.update({ where: { scope_key: { scope: `checkout:${userId}`, key: idempotencyKey } }, data: { responseBody: response as Prisma.InputJsonValue } });
  return response;
}

export async function handlePaymentWebhook(providerName: string, rawBody: Buffer, signature: string) {
  if (providerName !== getConfig().payment.providerName) throw notFound("PAYMENT_PROVIDER_NOT_FOUND", "The payment provider webhook route was not found.");
  const provider = getPaymentProvider();
  let verified;
  try { verified = await provider.verifyWebhook(rawBody, signature); }
  catch { throw badRequest("INVALID_WEBHOOK_SIGNATURE", "The payment webhook signature or envelope is invalid."); }
  const hash = createHash("sha256").update(rawBody).digest("hex");
  let event = await prisma.paymentWebhookEvent.findUnique({ where: { provider_providerEventId: { provider: providerName, providerEventId: verified.eventId } } });
  if (!event) {
    try {
      event = await prisma.paymentWebhookEvent.create({ data: { provider: providerName, providerEventId: verified.eventId, eventType: verified.eventType, payloadHash: hash } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      event = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { provider_providerEventId: { provider: providerName, providerEventId: verified.eventId } } });
    }
  }
  if (event.payloadHash !== hash) throw conflict("WEBHOOK_EVENT_CONFLICT", "The provider event ID was reused with different content.");
  if (event.status === "PROCESSED") return { accepted: true, duplicate: true };
  const claimed = await prisma.paymentWebhookEvent.updateMany({
    where: { id: event.id, status: { in: ["RECEIVED", "FAILED"] } },
    data: { status: "PROCESSING", lastError: null },
  });
  if (!claimed.count) return { accepted: true, duplicate: true };
  const payload = verified.payload as { providerPaymentId?: string; status?: string };
  if (!payload.providerPaymentId) throw badRequest("INVALID_WEBHOOK_PAYLOAD", "The verified webhook contains no provider payment ID.");
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { providerPaymentId: payload.providerPaymentId }, include: { order: true } });
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "The payment referenced by the webhook was not found.");
      if (verified.eventType === "PAYMENT_SUCCEEDED" || payload.status === "SUCCESS") {
        if (payment.order.status === "CANCELLED" || payment.order.status === "REFUNDED") {
          throw conflict("ORDER_NOT_PAYABLE", "A cancelled or refunded order cannot be marked paid by a late webhook.");
        }
        if (payment.status !== "SUCCESS") {
          await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
          await tx.order.update({ where: { id: payment.orderId }, data: { status: "PAID", paidAt: new Date(), receiptNumber: payment.order.receiptNumber ?? receiptNumber() } });
          await grantOrderEntitlements(tx, payment.orderId);
        }
      } else if (verified.eventType === "PAYMENT_FAILED" || payload.status === "FAILED") {
        if (payment.order.status !== "CANCELLED" && payment.order.status !== "REFUNDED" && payment.status !== "SUCCESS") {
          await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Provider reported failure" } });
          await tx.order.update({ where: { id: payment.orderId }, data: { status: "FAILED" } });
        }
      }
      await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date(), lastError: null } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { accepted: true, duplicate: false };
  } catch (error) {
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown webhook error" } });
    throw error;
  }
}
