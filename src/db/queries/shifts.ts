import type { Shift } from "../schema";

export interface ShiftView extends Shift {
	user_name: string;
}

export async function startShift(db: D1Database, userId: number, name?: string): Promise<Shift | null> {
	return db
		.prepare("INSERT INTO shifts (user_id, name) VALUES (?, ?) RETURNING *")
		.bind(userId, name ?? null)
		.first<Shift>();
}

export async function endShift(db: D1Database, id: number, notes?: string): Promise<void> {
	await db
		.prepare("UPDATE shifts SET ended_at = datetime('now'), notes = ? WHERE id = ? AND ended_at IS NULL")
		.bind(notes ?? null, id)
		.run();
}

export async function getActiveShift(db: D1Database, userId: number): Promise<Shift | null> {
	return db
		.prepare("SELECT * FROM shifts WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1")
		.bind(userId)
		.first<Shift>();
}

export async function getShiftById(db: D1Database, id: number): Promise<ShiftView | null> {
	return db
		.prepare("SELECT s.*, u.name as user_name FROM shifts s JOIN users u ON s.user_id = u.id WHERE s.id = ?")
		.bind(id)
		.first<ShiftView>();
}

export async function getShiftsByDateRange(
	db: D1Database,
	startDate: string,
	endDate: string,
): Promise<ShiftView[]> {
	const { results } = await db
		.prepare(`
			SELECT s.*, u.name as user_name
			FROM shifts s JOIN users u ON s.user_id = u.id
			WHERE s.started_at >= ? AND s.started_at <= ?
			ORDER BY s.started_at DESC
		`)
		.bind(startDate, endDate)
		.all<ShiftView>();
	return results;
}
