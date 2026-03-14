import type { AuthSession } from "../schema";

export async function createAuthSession(
	db: D1Database,
	userId: number,
	durationHours = 24,
): Promise<AuthSession | null> {
	const id = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

	return db
		.prepare(`
			INSERT INTO auth_sessions (id, user_id, expires_at)
			VALUES (?, ?, ?)
			RETURNING *
		`)
		.bind(id, userId, expiresAt)
		.first<AuthSession>();
}

export async function getAuthSession(
	db: D1Database,
	sessionId: string,
): Promise<(AuthSession & { user_name: string; user_email: string; user_role: string }) | null> {
	return db
		.prepare(`
			SELECT s.*, u.name as user_name, u.email as user_email, u.role as user_role
			FROM auth_sessions s
			JOIN users u ON s.user_id = u.id
			WHERE s.id = ? AND s.expires_at > datetime('now') AND u.active = 1
		`)
		.bind(sessionId)
		.first();
}

export async function deleteAuthSession(db: D1Database, sessionId: string): Promise<void> {
	await db
		.prepare("DELETE FROM auth_sessions WHERE id = ?")
		.bind(sessionId)
		.run();
}

export async function cleanExpiredSessions(db: D1Database): Promise<void> {
	await db
		.prepare("DELETE FROM auth_sessions WHERE expires_at <= datetime('now')")
		.run();
}
