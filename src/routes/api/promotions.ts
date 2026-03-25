import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import { validateJson } from "../../lib/request";
import { promotionSchema, promotionUpdateSchema } from "../../lib/validation";
import { auditLog } from "../../lib/logger";
import {
	getPromotions,
	getActivePromotions,
	getPromotionById,
	createPromotion,
	updatePromotion,
	deletePromotion,
} from "../../db/queries/promotions";

export const promotionRoutes = new Hono<AppEnv>();

// List all promotions (active users can see active ones for payment)
promotionRoutes.get("/", async (c) => {
	const tenantId = c.get("tenant_id");
	const promotions = await getPromotions(c.env.DB, tenantId);
	return c.json(promotions);
});

// List only active promotions (for payment modals)
promotionRoutes.get("/active", async (c) => {
	const tenantId = c.get("tenant_id");
	const promotions = await getActivePromotions(c.env.DB, tenantId);
	return c.json(promotions);
});

// Create promotion
promotionRoutes.post("/", requirePermission("promotions.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const body = await validateJson(c, promotionSchema);

	const promo = await createPromotion(c.env.DB, tenantId, body);
	await auditLog(c, "promotion.create", "promotion", promo.id, { name: promo.name });
	return c.json(promo, 201);
});

// Update promotion
promotionRoutes.put("/:id", requirePermission("promotions.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const id = Number(c.req.param("id"));
	const body = await validateJson(c, promotionUpdateSchema);

	const existing = await getPromotionById(c.env.DB, id, tenantId);
	if (!existing) return c.json({ error: "Promoção não encontrada" }, 404);

	await updatePromotion(c.env.DB, id, tenantId, body);
	await auditLog(c, "promotion.update", "promotion", id);

	const updated = await getPromotionById(c.env.DB, id, tenantId);
	return c.json(updated);
});

// Toggle active
promotionRoutes.post("/:id/toggle", requirePermission("promotions.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const id = Number(c.req.param("id"));

	const existing = await getPromotionById(c.env.DB, id, tenantId);
	if (!existing) return c.json({ error: "Promoção não encontrada" }, 404);

	await updatePromotion(c.env.DB, id, tenantId, { active: existing.active ? 0 : 1 });
	await auditLog(c, existing.active ? "promotion.deactivate" : "promotion.activate", "promotion", id);
	return c.json({ ok: true });
});

// Delete promotion
promotionRoutes.delete("/:id", requirePermission("promotions.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const id = Number(c.req.param("id"));

	const existing = await getPromotionById(c.env.DB, id, tenantId);
	if (!existing) return c.json({ error: "Promoção não encontrada" }, 404);

	await deletePromotion(c.env.DB, id, tenantId);
	await auditLog(c, "promotion.delete", "promotion", id, { name: existing.name });
	return c.json({ ok: true });
});
