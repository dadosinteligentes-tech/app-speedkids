import type { RentalSession, RentalSessionView } from "../schema";

export async function getActiveSessions(db: D1Database, tenantId: number): Promise<RentalSessionView[]> {
	const { results } = await db
		.prepare(`
			SELECT rs.*, a.name as asset_name, a.asset_type, a.photo_url as asset_photo_url,
				p.name as package_name,
				cu.name as customer_name, cu.phone as customer_phone,
				ch.name as child_name, ch.age as child_age
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			LEFT JOIN customers cu ON rs.customer_id = cu.id
			LEFT JOIN children ch ON rs.child_id = ch.id
			WHERE (rs.status IN ('running', 'paused')
			   OR (rs.status = 'completed' AND rs.paid = 0))
			   AND rs.tenant_id = ?
			ORDER BY rs.start_time DESC
		`)
		.bind(tenantId)
		.all<RentalSessionView>();
	return results;
}

export async function getSessionById(db: D1Database, id: string, tenantId: number): Promise<RentalSessionView | null> {
	return db
		.prepare(`
			SELECT rs.*, a.name as asset_name, a.asset_type, a.photo_url as asset_photo_url,
				p.name as package_name,
				cu.name as customer_name, cu.phone as customer_phone,
				ch.name as child_name, ch.age as child_age
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			LEFT JOIN customers cu ON rs.customer_id = cu.id
			LEFT JOIN children ch ON rs.child_id = ch.id
			WHERE rs.id = ? AND rs.tenant_id = ?
		`)
		.bind(id, tenantId)
		.first<RentalSessionView>();
}

export async function getActiveSessionByAsset(db: D1Database, assetId: number, tenantId: number): Promise<RentalSession | null> {
	return db
		.prepare("SELECT * FROM rental_sessions WHERE asset_id = ? AND status IN ('running', 'paused') AND tenant_id = ?")
		.bind(assetId, tenantId)
		.first<RentalSession>();
}

export async function createSession(
	db: D1Database,
	params: {
		id: string;
		asset_id: number;
		package_id: number;
		attendant_id?: number | null;
		customer_id?: number | null;
		child_id?: number | null;
		start_time: string;
		duration_minutes: number;
		amount_cents: number;
		tenant_id: number;
	},
): Promise<RentalSession | null> {
	return db
		.prepare(`
			INSERT INTO rental_sessions (id, asset_id, package_id, attendant_id, customer_id, child_id, status, start_time, duration_minutes, amount_cents, tenant_id)
			VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.id, params.asset_id, params.package_id, params.attendant_id ?? null, params.customer_id ?? null, params.child_id ?? null, params.start_time, params.duration_minutes, params.amount_cents, params.tenant_id)
		.first<RentalSession>();
}

export async function pauseSession(db: D1Database, id: string, pauseTime: string, tenantId: number): Promise<void> {
	await db.batch([
		db
			.prepare("UPDATE rental_sessions SET status = 'paused', pause_time = ?, updated_at = datetime('now') WHERE id = ? AND status = 'running' AND tenant_id = ?")
			.bind(pauseTime, id, tenantId),
		db
			.prepare("INSERT INTO session_pauses (session_id, paused_at) VALUES (?, ?)")
			.bind(id, pauseTime),
	]);
}

export async function resumeSession(db: D1Database, id: string, resumeTime: string, tenantId: number): Promise<void> {
	const session = await db
		.prepare("SELECT pause_time, total_paused_ms FROM rental_sessions WHERE id = ? AND status = 'paused' AND tenant_id = ?")
		.bind(id, tenantId)
		.first<{ pause_time: string; total_paused_ms: number }>();

	if (!session?.pause_time) return;

	const pauseDuration = new Date(resumeTime).getTime() - new Date(session.pause_time).getTime();
	const newTotalPaused = session.total_paused_ms + pauseDuration;

	await db.batch([
		db
			.prepare("UPDATE rental_sessions SET status = 'running', pause_time = NULL, total_paused_ms = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
			.bind(newTotalPaused, id, tenantId),
		db
			.prepare("UPDATE session_pauses SET resumed_at = ?, duration_ms = ? WHERE session_id = ? AND resumed_at IS NULL")
			.bind(resumeTime, pauseDuration, id),
	]);
}

export async function stopSession(db: D1Database, id: string, endTime: string, tenantId: number): Promise<RentalSession | null> {
	// Fetch session data
	const session = await db
		.prepare("SELECT status, pause_time, total_paused_ms, start_time, duration_minutes, amount_cents, package_id FROM rental_sessions WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.first<{
			status: string; pause_time: string | null; total_paused_ms: number;
			start_time: string; duration_minutes: number; amount_cents: number; package_id: number;
		}>();

	if (!session) return null;

	let totalPaused = session.total_paused_ms;
	if (session.status === "paused" && session.pause_time) {
		totalPaused += new Date(endTime).getTime() - new Date(session.pause_time).getTime();
	}

	// Fetch package overtime config (separate query — works even before migration 0014)
	const pkg = await db
		.prepare("SELECT * FROM packages WHERE id = ?")
		.bind(session.package_id)
		.first<{ overtime_block_minutes?: number; overtime_block_price_cents?: number; grace_period_minutes?: number }>();

	const blockMinutes = pkg?.overtime_block_minutes ?? 0;
	const blockPrice = pkg?.overtime_block_price_cents ?? 0;
	const graceMins = pkg?.grace_period_minutes ?? 0;

	// Calculate overtime
	let overtimeMinutes = 0;
	let overtimeCents = 0;

	if (blockPrice > 0) {
		const elapsedMs = new Date(endTime).getTime() - new Date(session.start_time).getTime() - totalPaused;
		const packageMs = session.duration_minutes * 60 * 1000;
		const graceMs = graceMins * 60 * 1000;
		const overtimeMs = elapsedMs - packageMs - graceMs;

		if (overtimeMs > 0) {
			overtimeMinutes = Math.ceil(overtimeMs / 60000);
			const blockMs = (blockMinutes || 5) * 60 * 1000;
			const blocks = Math.ceil(overtimeMs / blockMs);
			overtimeCents = blocks * blockPrice;
		}
	}

	const finalAmount = session.amount_cents + overtimeCents;

	// Always set overtime columns — zero values are valid and avoid fragile branching
	await db
		.prepare(`
			UPDATE rental_sessions
			SET status = 'completed', end_time = ?, pause_time = NULL, total_paused_ms = ?,
			    overtime_minutes = ?, overtime_cents = ?, amount_cents = ?, updated_at = datetime('now')
			WHERE id = ? AND status IN ('running', 'paused') AND tenant_id = ?
		`)
		.bind(endTime, totalPaused, overtimeMinutes, overtimeCents, finalAmount, id, tenantId)
		.run();

	return db.prepare("SELECT * FROM rental_sessions WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<RentalSession>();
}

export async function paySession(
	db: D1Database,
	id: string,
	paymentMethod: string,
	finalAmountCents: number,
	notes: string | null,
	tenantId: number,
	discountCents?: number,
	promotionId?: number | null,
): Promise<void> {
	await db
		.prepare(
			`UPDATE rental_sessions
			 SET paid = 1, payment_method = ?, amount_cents = ?, notes = COALESCE(?, notes),
			     discount_cents = ?, promotion_id = ?, updated_at = datetime('now')
			 WHERE id = ? AND tenant_id = ?`,
		)
		.bind(paymentMethod, finalAmountCents, notes, discountCents ?? 0, promotionId ?? null, id, tenantId)
		.run();
}

export async function updateSessionDuration(
	db: D1Database,
	id: string,
	durationMinutes: number,
	amountCents: number,
	tenantId: number,
): Promise<void> {
	await db
		.prepare("UPDATE rental_sessions SET duration_minutes = ?, amount_cents = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(durationMinutes, amountCents, id, tenantId)
		.run();
}

export async function getSessionsByAsset(
	db: D1Database,
	assetId: number,
	limit = 50,
	offset = 0,
	tenantId: number,
): Promise<{ sessions: RentalSessionView[]; total: number }> {
	const countResult = await db
		.prepare("SELECT COUNT(*) as total FROM rental_sessions WHERE asset_id = ? AND tenant_id = ?")
		.bind(assetId, tenantId)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(`
			SELECT rs.*, a.name as asset_name, a.asset_type, a.photo_url as asset_photo_url,
				p.name as package_name,
				cu.name as customer_name, cu.phone as customer_phone,
				ch.name as child_name, ch.age as child_age
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			LEFT JOIN customers cu ON rs.customer_id = cu.id
			LEFT JOIN children ch ON rs.child_id = ch.id
			WHERE rs.asset_id = ? AND rs.tenant_id = ?
			ORDER BY rs.start_time DESC
			LIMIT ? OFFSET ?
		`)
		.bind(assetId, tenantId, limit, offset)
		.all<RentalSessionView>();

	return { sessions: results, total: countResult?.total ?? 0 };
}

export async function extendSession(
	db: D1Database,
	id: string,
	additionalMinutes: number,
	additionalCents: number,
	tenantId: number,
): Promise<void> {
	await db
		.prepare(`
			UPDATE rental_sessions
			SET duration_minutes = duration_minutes + ?,
			    amount_cents = amount_cents + ?,
			    updated_at = datetime('now')
			WHERE id = ? AND status IN ('running', 'paused') AND tenant_id = ?
		`)
		.bind(additionalMinutes, additionalCents, id, tenantId)
		.run();
}
