import type { Battery, BatteryView } from "../schema";

export async function getBatteries(db: D1Database): Promise<BatteryView[]> {
	const { results } = await db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			WHERE b.status != 'retired'
			ORDER BY b.label ASC
		`)
		.all<BatteryView>();
	return results;
}

export async function getAllBatteries(db: D1Database): Promise<BatteryView[]> {
	const { results } = await db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			ORDER BY b.label ASC
		`)
		.all<BatteryView>();
	return results;
}

export async function getBatteryById(db: D1Database, id: number): Promise<BatteryView | null> {
	return db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			WHERE b.id = ?
		`)
		.bind(id)
		.first<BatteryView>();
}

export async function getBatteryByAssetId(db: D1Database, assetId: number): Promise<Battery | null> {
	return db
		.prepare("SELECT * FROM batteries WHERE asset_id = ? AND status != 'retired'")
		.bind(assetId)
		.first<Battery>();
}

export async function getInstalledBatteries(db: D1Database): Promise<Battery[]> {
	const { results } = await db
		.prepare("SELECT * FROM batteries WHERE asset_id IS NOT NULL AND status != 'retired'")
		.all<Battery>();
	return results;
}

export async function getReadyBatteries(db: D1Database): Promise<Battery[]> {
	const { results } = await db
		.prepare("SELECT * FROM batteries WHERE status = 'ready' AND asset_id IS NULL ORDER BY estimated_minutes_remaining DESC")
		.all<Battery>();
	return results;
}

export async function createBattery(
	db: D1Database,
	params: { label: string; full_charge_minutes?: number; notes?: string },
): Promise<Battery | null> {
	const fullCharge = params.full_charge_minutes ?? 90;
	return db
		.prepare(`
			INSERT INTO batteries (label, full_charge_minutes, estimated_minutes_remaining, notes)
			VALUES (?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.label, fullCharge, fullCharge, params.notes ?? null)
		.first<Battery>();
}

export async function updateBattery(
	db: D1Database,
	id: number,
	params: { label?: string; full_charge_minutes?: number; notes?: string },
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.label !== undefined) { sets.push("label = ?"); values.push(params.label); }
	if (params.full_charge_minutes !== undefined) { sets.push("full_charge_minutes = ?"); values.push(params.full_charge_minutes); }
	if (params.notes !== undefined) { sets.push("notes = ?"); values.push(params.notes); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id);

	await db
		.prepare(`UPDATE batteries SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function markBatteryCharged(db: D1Database, id: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET status = 'ready', estimated_minutes_remaining = full_charge_minutes,
			    last_charged_at = datetime('now'), updated_at = datetime('now')
			WHERE id = ?
		`)
		.bind(id)
		.run();
}

export async function updateBatteryStatus(db: D1Database, id: number, status: Battery["status"]): Promise<void> {
	await db
		.prepare("UPDATE batteries SET status = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(status, id)
		.run();
}

export async function swapBattery(
	db: D1Database,
	assetId: number,
	oldBatteryId: number | null,
	newBatteryId: number,
): Promise<void> {
	const stmts: D1PreparedStatement[] = [];

	if (oldBatteryId) {
		stmts.push(
			db.prepare("UPDATE batteries SET asset_id = NULL, status = 'depleted', updated_at = datetime('now') WHERE id = ?")
				.bind(oldBatteryId),
		);
	}

	stmts.push(
		db.prepare("UPDATE batteries SET asset_id = ?, status = 'in_use', updated_at = datetime('now') WHERE id = ?")
			.bind(assetId, newBatteryId),
	);

	await db.batch(stmts);
}

export async function updateBatteryDrain(db: D1Database, id: number, minutesUsed: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET estimated_minutes_remaining = MAX(0, estimated_minutes_remaining - ?),
			    status = CASE WHEN estimated_minutes_remaining - ? <= 0 THEN 'depleted' ELSE status END,
			    updated_at = datetime('now')
			WHERE id = ?
		`)
		.bind(minutesUsed, minutesUsed, id)
		.run();
}

export async function setBatteryLevel(db: D1Database, id: number, minutes: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET estimated_minutes_remaining = MAX(0, MIN(?, full_charge_minutes)),
			    status = CASE
			      WHEN ? <= 0 THEN 'depleted'
			      WHEN status = 'depleted' THEN 'ready'
			      ELSE status
			    END,
			    updated_at = datetime('now')
			WHERE id = ?
		`)
		.bind(minutes, minutes, id)
		.run();
}

export async function uninstallBattery(db: D1Database, id: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET asset_id = NULL,
			    status = CASE WHEN estimated_minutes_remaining > 0 THEN 'ready' ELSE 'depleted' END,
			    updated_at = datetime('now')
			WHERE id = ?
		`)
		.bind(id)
		.run();
}

export async function installBattery(db: D1Database, batteryId: number, assetId: number): Promise<void> {
	await db
		.prepare("UPDATE batteries SET asset_id = ?, status = 'in_use', updated_at = datetime('now') WHERE id = ?")
		.bind(assetId, batteryId)
		.run();
}

export async function retireBattery(db: D1Database, id: number): Promise<void> {
	await db
		.prepare("UPDATE batteries SET status = 'retired', asset_id = NULL, updated_at = datetime('now') WHERE id = ?")
		.bind(id)
		.run();
}
