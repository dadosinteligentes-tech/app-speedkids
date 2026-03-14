import type { AssetType } from "../schema";

export async function getAssetTypes(db: D1Database): Promise<AssetType[]> {
	const { results } = await db
		.prepare("SELECT * FROM asset_types ORDER BY label ASC")
		.all<AssetType>();
	return results;
}

export async function createAssetType(
	db: D1Database,
	name: string,
	label: string,
): Promise<AssetType | null> {
	return db
		.prepare("INSERT INTO asset_types (name, label) VALUES (?, ?) RETURNING *")
		.bind(name, label)
		.first<AssetType>();
}

export async function updateAssetType(
	db: D1Database,
	id: number,
	label: string,
): Promise<void> {
	await db
		.prepare("UPDATE asset_types SET label = ? WHERE id = ?")
		.bind(label, id)
		.run();
}

export async function deleteAssetType(
	db: D1Database,
	id: number,
): Promise<{ ok: boolean; error?: string }> {
	const usage = await db
		.prepare("SELECT COUNT(*) AS cnt FROM assets WHERE asset_type = (SELECT name FROM asset_types WHERE id = ?)")
		.bind(id)
		.first<{ cnt: number }>();

	if (usage && usage.cnt > 0) {
		return { ok: false, error: `Tipo em uso por ${usage.cnt} ativo(s). Remova ou altere os ativos primeiro.` };
	}

	await db.prepare("DELETE FROM asset_types WHERE id = ?").bind(id).run();
	return { ok: true };
}
