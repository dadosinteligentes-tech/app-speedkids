import type { Package } from "../schema";

export async function getActivePackages(db: D1Database): Promise<Package[]> {
	const { results } = await db
		.prepare("SELECT * FROM packages WHERE active = 1 ORDER BY sort_order ASC")
		.all<Package>();
	return results;
}

export async function getAllPackages(db: D1Database): Promise<Package[]> {
	const { results } = await db
		.prepare("SELECT * FROM packages ORDER BY sort_order ASC")
		.all<Package>();
	return results;
}

export async function getPackageById(db: D1Database, id: number): Promise<Package | null> {
	return db.prepare("SELECT * FROM packages WHERE id = ?").bind(id).first<Package>();
}

export async function createPackage(
	db: D1Database,
	params: {
		name: string;
		duration_minutes: number;
		price_cents: number;
		sort_order?: number;
		overtime_block_minutes?: number;
		overtime_block_price_cents?: number;
		grace_period_minutes?: number;
	},
): Promise<Package | null> {
	return db
		.prepare(`
			INSERT INTO packages (name, duration_minutes, price_cents, sort_order, overtime_block_minutes, overtime_block_price_cents, grace_period_minutes)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(
			params.name,
			params.duration_minutes,
			params.price_cents,
			params.sort_order ?? 0,
			params.overtime_block_minutes ?? 5,
			params.overtime_block_price_cents ?? 0,
			params.grace_period_minutes ?? 5,
		)
		.first<Package>();
}

export async function updatePackage(
	db: D1Database,
	id: number,
	params: {
		name?: string;
		duration_minutes?: number;
		price_cents?: number;
		sort_order?: number;
		overtime_block_minutes?: number;
		overtime_block_price_cents?: number;
		grace_period_minutes?: number;
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

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id);

	await db
		.prepare(`UPDATE packages SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function togglePackageActive(db: D1Database, id: number): Promise<void> {
	await db
		.prepare("UPDATE packages SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?")
		.bind(id)
		.run();
}
