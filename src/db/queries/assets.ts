import type { Asset } from "../schema";

export async function getAssets(db: D1Database): Promise<Asset[]> {
	const { results } = await db
		.prepare("SELECT * FROM assets WHERE status != 'retired' ORDER BY name ASC")
		.all<Asset>();
	return results;
}

export async function getAllAssets(db: D1Database): Promise<Asset[]> {
	const { results } = await db
		.prepare("SELECT * FROM assets ORDER BY name ASC")
		.all<Asset>();
	return results;
}

export async function getAssetById(db: D1Database, id: number): Promise<Asset | null> {
	return db.prepare("SELECT * FROM assets WHERE id = ?").bind(id).first<Asset>();
}

export async function createAsset(
	db: D1Database,
	params: { name: string; asset_type: string; model?: string; photo_url?: string; notes?: string; uses_battery?: number },
): Promise<Asset | null> {
	return db
		.prepare(`
			INSERT INTO assets (name, asset_type, model, photo_url, notes, uses_battery, status)
			VALUES (?, ?, ?, ?, ?, ?, 'available')
			RETURNING *
		`)
		.bind(params.name, params.asset_type, params.model ?? null, params.photo_url ?? null, params.notes ?? null, params.uses_battery ?? 0)
		.first<Asset>();
}

export async function updateAsset(
	db: D1Database,
	id: number,
	params: { name?: string; asset_type?: string; model?: string; photo_url?: string; notes?: string; uses_battery?: number },
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.name !== undefined) { sets.push("name = ?"); values.push(params.name); }
	if (params.asset_type !== undefined) { sets.push("asset_type = ?"); values.push(params.asset_type); }
	if (params.model !== undefined) { sets.push("model = ?"); values.push(params.model); }
	if (params.photo_url !== undefined) { sets.push("photo_url = ?"); values.push(params.photo_url); }
	if (params.notes !== undefined) { sets.push("notes = ?"); values.push(params.notes); }
	if (params.uses_battery !== undefined) { sets.push("uses_battery = ?"); values.push(params.uses_battery); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id);

	await db
		.prepare(`UPDATE assets SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function updateAssetStatus(db: D1Database, id: number, status: Asset["status"]): Promise<void> {
	await db
		.prepare("UPDATE assets SET status = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(status, id)
		.run();
}

export async function retireAsset(db: D1Database, id: number): Promise<void> {
	await db
		.prepare("UPDATE assets SET status = 'retired', updated_at = datetime('now') WHERE id = ?")
		.bind(id)
		.run();
}
