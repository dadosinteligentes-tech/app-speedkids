import type { Battery, BatteryView } from "../schema";

export async function getBatteries(db: D1Database, tenantId: number): Promise<BatteryView[]> {
	const { results } = await db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			WHERE b.status != 'retired' AND b.tenant_id = ?
			ORDER BY b.label ASC
		`)
		.bind(tenantId)
		.all<BatteryView>();
	return results;
}

export async function getAllBatteries(db: D1Database, tenantId: number): Promise<BatteryView[]> {
	const { results } = await db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			WHERE b.tenant_id = ?
			ORDER BY b.label ASC
		`)
		.bind(tenantId)
		.all<BatteryView>();
	return results;
}

export async function getBatteryById(db: D1Database, id: number, tenantId: number): Promise<BatteryView | null> {
	return db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			WHERE b.id = ? AND b.tenant_id = ?
		`)
		.bind(id, tenantId)
		.first<BatteryView>();
}

export async function getBatteryByAssetId(db: D1Database, assetId: number, tenantId: number): Promise<Battery | null> {
	return db
		.prepare("SELECT * FROM batteries WHERE asset_id = ? AND status != 'retired' AND tenant_id = ?")
		.bind(assetId, tenantId)
		.first<Battery>();
}

export async function getInstalledBatteries(db: D1Database, tenantId: number): Promise<Battery[]> {
	const { results } = await db
		.prepare("SELECT * FROM batteries WHERE asset_id IS NOT NULL AND status != 'retired' AND tenant_id = ?")
		.bind(tenantId)
		.all<Battery>();
	return results;
}

export async function getReadyBatteries(db: D1Database, tenantId: number): Promise<Battery[]> {
	const { results } = await db
		.prepare("SELECT * FROM batteries WHERE status = 'ready' AND asset_id IS NULL AND tenant_id = ? ORDER BY estimated_minutes_remaining DESC")
		.bind(tenantId)
		.all<Battery>();
	return results;
}

export async function createBattery(
	db: D1Database,
	params: { label: string; full_charge_minutes?: number; charge_time_minutes?: number; notes?: string; tenant_id: number },
): Promise<Battery | null> {
	const fullCharge = params.full_charge_minutes ?? 90;
	const chargeTime = params.charge_time_minutes ?? 480;
	return db
		.prepare(`
			INSERT INTO batteries (label, full_charge_minutes, charge_time_minutes, estimated_minutes_remaining, notes, tenant_id)
			VALUES (?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.label, fullCharge, chargeTime, fullCharge, params.notes ?? null, params.tenant_id)
		.first<Battery>();
}

export async function updateBattery(
	db: D1Database,
	id: number,
	params: { label?: string; full_charge_minutes?: number; charge_time_minutes?: number; notes?: string },
	tenantId: number,
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.label !== undefined) { sets.push("label = ?"); values.push(params.label); }
	if (params.full_charge_minutes !== undefined) { sets.push("full_charge_minutes = ?"); values.push(params.full_charge_minutes); }
	if (params.charge_time_minutes !== undefined) { sets.push("charge_time_minutes = ?"); values.push(params.charge_time_minutes); }
	if (params.notes !== undefined) { sets.push("notes = ?"); values.push(params.notes); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id, tenantId);

	await db
		.prepare(`UPDATE batteries SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`)
		.bind(...values)
		.run();
}

export async function markBatteryCharged(db: D1Database, id: number, tenantId: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET status = 'ready', estimated_minutes_remaining = full_charge_minutes,
			    last_charged_at = datetime('now'), updated_at = datetime('now')
			WHERE id = ? AND tenant_id = ?
		`)
		.bind(id, tenantId)
		.run();
}

export async function updateBatteryStatus(db: D1Database, id: number, status: Battery["status"], tenantId: number): Promise<void> {
	await db
		.prepare("UPDATE batteries SET status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(status, id, tenantId)
		.run();
}

export async function swapBattery(
	db: D1Database,
	assetId: number,
	oldBatteryId: number | null,
	newBatteryId: number,
	tenantId: number,
): Promise<void> {
	const stmts: D1PreparedStatement[] = [];

	if (oldBatteryId) {
		stmts.push(
			db.prepare("UPDATE batteries SET asset_id = NULL, status = 'depleted', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
				.bind(oldBatteryId, tenantId),
		);
	}

	stmts.push(
		db.prepare("UPDATE batteries SET asset_id = ?, status = 'in_use', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
			.bind(assetId, newBatteryId, tenantId),
	);

	await db.batch(stmts);
}

export async function updateBatteryDrain(db: D1Database, id: number, minutesUsed: number, tenantId: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET estimated_minutes_remaining = MAX(0, estimated_minutes_remaining - ?),
			    status = CASE WHEN estimated_minutes_remaining - ? <= 0 THEN 'depleted' ELSE status END,
			    updated_at = datetime('now')
			WHERE id = ? AND tenant_id = ?
		`)
		.bind(minutesUsed, minutesUsed, id, tenantId)
		.run();
}

export async function setBatteryLevel(db: D1Database, id: number, minutes: number, tenantId: number): Promise<void> {
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
			WHERE id = ? AND tenant_id = ?
		`)
		.bind(minutes, minutes, id, tenantId)
		.run();
}

export async function uninstallBattery(db: D1Database, id: number, tenantId: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET asset_id = NULL,
			    status = CASE WHEN estimated_minutes_remaining > 0 THEN 'ready' ELSE 'depleted' END,
			    updated_at = datetime('now')
			WHERE id = ? AND tenant_id = ?
		`)
		.bind(id, tenantId)
		.run();
}

export async function installBattery(db: D1Database, batteryId: number, assetId: number, tenantId: number): Promise<void> {
	await db
		.prepare("UPDATE batteries SET asset_id = ?, status = 'in_use', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(assetId, batteryId, tenantId)
		.run();
}

export async function addBatteryChargingTime(db: D1Database, id: number, chargingMinutes: number, tenantId: number): Promise<void> {
	await db
		.prepare(`
			UPDATE batteries
			SET estimated_minutes_remaining = MIN(
					full_charge_minutes,
					estimated_minutes_remaining + CAST(
						(? * 1.0 / charge_time_minutes) * full_charge_minutes AS INTEGER
					)
				),
				status = CASE
					WHEN estimated_minutes_remaining + CAST((? * 1.0 / charge_time_minutes) * full_charge_minutes AS INTEGER) > 0
						AND status = 'depleted' THEN 'ready'
					ELSE status
				END,
				last_charged_at = datetime('now'),
				updated_at = datetime('now')
			WHERE id = ? AND tenant_id = ?
		`)
		.bind(chargingMinutes, chargingMinutes, id, tenantId)
		.run();
}

export async function getBatteriesByLowestCharge(db: D1Database, tenantId: number): Promise<BatteryView[]> {
	const { results } = await db
		.prepare(`
			SELECT b.*, a.name as asset_name
			FROM batteries b
			LEFT JOIN assets a ON b.asset_id = a.id
			WHERE b.status != 'retired' AND b.tenant_id = ?
			ORDER BY b.estimated_minutes_remaining ASC
		`)
		.bind(tenantId)
		.all<BatteryView>();
	return results;
}

export async function retireBattery(db: D1Database, id: number, tenantId: number): Promise<void> {
	await db
		.prepare("UPDATE batteries SET status = 'retired', asset_id = NULL, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.run();
}
