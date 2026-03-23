import type { User } from "../schema";

export async function getUserByEmail(db: D1Database, tenantId: number, email: string): Promise<User | null> {
	return db
		.prepare("SELECT * FROM users WHERE email = ? AND active = 1 AND tenant_id = ?")
		.bind(email, tenantId)
		.first<User>();
}

export async function getUserById(db: D1Database, tenantId: number, id: number): Promise<User | null> {
	return db
		.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.first<User>();
}

export async function listUsers(db: D1Database, tenantId: number): Promise<User[]> {
	const { results } = await db
		.prepare("SELECT * FROM users WHERE tenant_id = ? ORDER BY name")
		.bind(tenantId)
		.all<User>();
	return results;
}

export async function createUser(
	db: D1Database,
	params: { tenant_id: number; name: string; email: string; password_hash: string; salt: string; role: string },
): Promise<User | null> {
	return db
		.prepare(`
			INSERT INTO users (tenant_id, name, email, password_hash, salt, role)
			VALUES (?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.tenant_id, params.name, params.email, params.password_hash, params.salt, params.role)
		.first<User>();
}

export async function updateUser(
	db: D1Database,
	tenantId: number,
	id: number,
	params: { name?: string; email?: string; role?: string; password_hash?: string; salt?: string },
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.name !== undefined) { sets.push("name = ?"); values.push(params.name); }
	if (params.email !== undefined) { sets.push("email = ?"); values.push(params.email); }
	if (params.role !== undefined) { sets.push("role = ?"); values.push(params.role); }
	if (params.password_hash !== undefined && params.salt !== undefined) {
		sets.push("password_hash = ?", "salt = ?");
		values.push(params.password_hash, params.salt);
	}

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id, tenantId);

	await db
		.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`)
		.bind(...values)
		.run();
}

export async function deactivateUser(db: D1Database, tenantId: number, id: number): Promise<void> {
	await db
		.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.run();
}
