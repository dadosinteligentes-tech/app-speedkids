import type { Promotion } from "../schema";

export async function getPromotions(db: D1Database, tenantId: number): Promise<Promotion[]> {
	const { results } = await db
		.prepare("SELECT * FROM promotions WHERE tenant_id = ? ORDER BY active DESC, name ASC")
		.bind(tenantId)
		.all<Promotion>();
	return results;
}

export async function getActivePromotions(db: D1Database, tenantId: number): Promise<Promotion[]> {
	const { results } = await db
		.prepare("SELECT * FROM promotions WHERE tenant_id = ? AND active = 1 ORDER BY name ASC")
		.bind(tenantId)
		.all<Promotion>();
	return results;
}

export async function getPromotionById(db: D1Database, id: number, tenantId: number): Promise<Promotion | null> {
	return db
		.prepare("SELECT * FROM promotions WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.first<Promotion>();
}

export async function createPromotion(
	db: D1Database,
	tenantId: number,
	data: { name: string; description?: string | null; discount_type: string; discount_value: number },
): Promise<Promotion> {
	const promo = await db
		.prepare(
			`INSERT INTO promotions (tenant_id, name, description, discount_type, discount_value)
			 VALUES (?, ?, ?, ?, ?)
			 RETURNING *`,
		)
		.bind(tenantId, data.name, data.description ?? null, data.discount_type, data.discount_value)
		.first<Promotion>();

	if (!promo) throw new Error("Failed to create promotion");
	return promo;
}

export async function updatePromotion(
	db: D1Database,
	id: number,
	tenantId: number,
	data: { name?: string; description?: string | null; discount_type?: string; discount_value?: number; active?: number },
): Promise<void> {
	const sets: string[] = [];
	const values: (string | number | null)[] = [];

	if (data.name !== undefined) { sets.push("name = ?"); values.push(data.name); }
	if (data.description !== undefined) { sets.push("description = ?"); values.push(data.description); }
	if (data.discount_type !== undefined) { sets.push("discount_type = ?"); values.push(data.discount_type); }
	if (data.discount_value !== undefined) { sets.push("discount_value = ?"); values.push(data.discount_value); }
	if (data.active !== undefined) { sets.push("active = ?"); values.push(data.active); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id, tenantId);

	await db
		.prepare(`UPDATE promotions SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`)
		.bind(...values)
		.run();
}

export async function deletePromotion(db: D1Database, id: number, tenantId: number): Promise<void> {
	await db
		.prepare("DELETE FROM promotions WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.run();
}

// ── Report: promotion usage stats ──

export interface PromotionUsage {
	id: number;
	name: string;
	description: string | null;
	discount_type: string;
	discount_value: number;
	active: number;
	rental_count: number;
	product_count: number;
	total_discount_cents: number;
}

export async function getPromotionUsageStats(
	db: D1Database,
	tenantId: number,
): Promise<PromotionUsage[]> {
	const { results } = await db
		.prepare(
			`SELECT p.*,
				COALESCE(r.cnt, 0) AS rental_count,
				COALESCE(ps.cnt, 0) AS product_count,
				COALESCE(r.total_discount, 0) + COALESCE(ps.total_discount, 0) AS total_discount_cents
			 FROM promotions p
			 LEFT JOIN (
				SELECT promotion_id, COUNT(*) AS cnt, SUM(discount_cents) AS total_discount
				FROM rental_sessions WHERE tenant_id = ? AND promotion_id IS NOT NULL
				GROUP BY promotion_id
			 ) r ON r.promotion_id = p.id
			 LEFT JOIN (
				SELECT promotion_id, COUNT(*) AS cnt, SUM(discount_cents) AS total_discount
				FROM product_sales WHERE tenant_id = ? AND promotion_id IS NOT NULL
				GROUP BY promotion_id
			 ) ps ON ps.promotion_id = p.id
			 WHERE p.tenant_id = ?
			 ORDER BY (COALESCE(r.cnt, 0) + COALESCE(ps.cnt, 0)) DESC, p.name ASC`,
		)
		.bind(tenantId, tenantId, tenantId)
		.all<PromotionUsage>();

	return results;
}
