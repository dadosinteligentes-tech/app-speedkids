import type { Asset } from "../schema";

export async function getAssets(db: D1Database, tenantId: number): Promise<Asset[]> {
	const { results } = await db
		.prepare("SELECT * FROM assets WHERE status != 'retired' AND tenant_id = ? ORDER BY sort_order ASC, name ASC")
		.bind(tenantId)
		.all<Asset>();
	return results;
}

export async function getAllAssets(db: D1Database, tenantId: number): Promise<Asset[]> {
	const { results } = await db
		.prepare("SELECT * FROM assets WHERE tenant_id = ? ORDER BY sort_order ASC, name ASC")
		.bind(tenantId)
		.all<Asset>();
	return results;
}

export async function getAssetById(db: D1Database, tenantId: number, id: number): Promise<Asset | null> {
	return db.prepare("SELECT * FROM assets WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<Asset>();
}

export async function createAsset(
	db: D1Database,
	params: {
		tenant_id: number;
		name: string; asset_type: string; model?: string; photo_url?: string; notes?: string;
		uses_battery?: number; max_weight_kg?: number | null; min_age?: number | null; max_age?: number | null; sort_order?: number;
	},
): Promise<Asset | null> {
	return db
		.prepare(`
			INSERT INTO assets (tenant_id, name, asset_type, model, photo_url, notes, uses_battery, max_weight_kg, min_age, max_age, sort_order, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
			RETURNING *
		`)
		.bind(
			params.tenant_id,
			params.name, params.asset_type, params.model ?? null, params.photo_url ?? null, params.notes ?? null,
			params.uses_battery ?? 0, params.max_weight_kg ?? null, params.min_age ?? null, params.max_age ?? null, params.sort_order ?? 0,
		)
		.first<Asset>();
}

export async function updateAsset(
	db: D1Database,
	tenantId: number,
	id: number,
	params: {
		name?: string; asset_type?: string; model?: string; photo_url?: string; notes?: string;
		uses_battery?: number; max_weight_kg?: number | null; min_age?: number | null; max_age?: number | null; sort_order?: number;
	},
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.name !== undefined) { sets.push("name = ?"); values.push(params.name); }
	if (params.asset_type !== undefined) { sets.push("asset_type = ?"); values.push(params.asset_type); }
	if (params.model !== undefined) { sets.push("model = ?"); values.push(params.model); }
	if (params.photo_url !== undefined) { sets.push("photo_url = ?"); values.push(params.photo_url); }
	if (params.notes !== undefined) { sets.push("notes = ?"); values.push(params.notes); }
	if (params.uses_battery !== undefined) { sets.push("uses_battery = ?"); values.push(params.uses_battery); }
	if (params.max_weight_kg !== undefined) { sets.push("max_weight_kg = ?"); values.push(params.max_weight_kg); }
	if (params.min_age !== undefined) { sets.push("min_age = ?"); values.push(params.min_age); }
	if (params.max_age !== undefined) { sets.push("max_age = ?"); values.push(params.max_age); }
	if (params.sort_order !== undefined) { sets.push("sort_order = ?"); values.push(params.sort_order); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id, tenantId);

	await db
		.prepare(`UPDATE assets SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`)
		.bind(...values)
		.run();
}

export async function updateAssetStatus(db: D1Database, tenantId: number, id: number, status: Asset["status"]): Promise<void> {
	await db
		.prepare("UPDATE assets SET status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(status, id, tenantId)
		.run();
}

export async function retireAsset(db: D1Database, tenantId: number, id: number): Promise<void> {
	await db
		.prepare("UPDATE assets SET status = 'retired', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.run();
}
