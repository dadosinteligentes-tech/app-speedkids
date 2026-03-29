import type { Package } from "../schema";

export async function getActivePackages(db: D1Database, tenantId: number): Promise<Package[]> {
	const { results } = await db
		.prepare("SELECT * FROM packages WHERE active = 1 AND tenant_id = ? ORDER BY sort_order ASC")
		.bind(tenantId)
		.all<Package>();
	return results;
}

export async function getAllPackages(db: D1Database, tenantId: number): Promise<Package[]> {
	const { results } = await db
		.prepare("SELECT * FROM packages WHERE tenant_id = ? ORDER BY sort_order ASC")
		.bind(tenantId)
		.all<Package>();
	return results;
}

export async function getPackageById(db: D1Database, tenantId: number, id: number): Promise<Package | null> {
	return db.prepare("SELECT * FROM packages WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<Package>();
}

export async function createPackage(
	db: D1Database,
	params: {
		tenant_id: number;
		name: string;
		duration_minutes: number;
		price_cents: number;
		sort_order?: number;
		overtime_block_minutes?: number;
		overtime_block_price_cents?: number;
		grace_period_minutes?: number;
		is_extension?: number;
	},
): Promise<Package | null> {
	return db
		.prepare(`
			INSERT INTO packages (tenant_id, name, duration_minutes, price_cents, sort_order, overtime_block_minutes, overtime_block_price_cents, grace_period_minutes, is_extension)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(
			params.tenant_id,
			params.name,
			params.duration_minutes,
			params.price_cents,
			params.sort_order ?? 0,
			params.overtime_block_minutes ?? 5,
			params.overtime_block_price_cents ?? 0,
			params.grace_period_minutes ?? 5,
			params.is_extension ?? 0,
		)
		.first<Package>();
}

export async function updatePackage(
	db: D1Database,
	tenantId: number,
	id: number,
	params: {
		name?: string;
		duration_minutes?: number;
		price_cents?: number;
		sort_order?: number;
		overtime_block_minutes?: number;
		overtime_block_price_cents?: number;
		grace_period_minutes?: number;
		is_extension?: number;
	},
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.name !== undefined) { sets.push("name = ?"); values.push(params.name); }
	if (params.duration_minutes !== undefined) { sets.push("duration_minutes = ?"); values.push(params.duration_minutes); }
	if (params.price_cents !== undefined) { sets.push("price_cents = ?"); values.push(params.price_cents); }
	if (params.sort_order !== undefined) { sets.push("sort_order = ?"); values.push(params.sort_order); }
	if (params.overtime_block_minutes !== undefined) { sets.push("overtime_block_minutes = ?"); values.push(params.overtime_block_minutes); }
	if (params.overtime_block_price_cents !== undefined) { sets.push("overtime_block_price_cents = ?"); values.push(params.overtime_block_price_cents); }
	if (params.grace_period_minutes !== undefined) { sets.push("grace_period_minutes = ?"); values.push(params.grace_period_minutes); }
	if (params.is_extension !== undefined) { sets.push("is_extension = ?"); values.push(params.is_extension); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id, tenantId);

	await db
		.prepare(`UPDATE packages SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`)
		.bind(...values)
		.run();
}

export async function togglePackageActive(db: D1Database, tenantId: number, id: number): Promise<void> {
	await db
		.prepare("UPDATE packages SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.run();
}
