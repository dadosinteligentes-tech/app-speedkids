import type { Permission, RolePermission } from "../schema";

export async function getAllPermissions(db: D1Database): Promise<Permission[]> {
	const { results } = await db
		.prepare("SELECT * FROM permissions ORDER BY sort_order")
		.all<Permission>();
	return results;
}

export async function getAllRolePermissions(db: D1Database): Promise<RolePermission[]> {
	const { results } = await db
		.prepare("SELECT * FROM role_permissions ORDER BY role, permission_key")
		.all<RolePermission>();
	return results;
}

export async function getPermissionsForRole(db: D1Database, role: string): Promise<string[]> {
	const { results } = await db
		.prepare("SELECT permission_key FROM role_permissions WHERE role = ?")
		.bind(role)
		.all<{ permission_key: string }>();
	return results.map((r) => r.permission_key);
}

export async function setRolePermissions(
	db: D1Database,
	role: string,
	permissionKeys: string[],
): Promise<void> {
	const stmts: D1PreparedStatement[] = [
		db.prepare("DELETE FROM role_permissions WHERE role = ?").bind(role),
	];
	for (const key of permissionKeys) {
		stmts.push(
			db.prepare("INSERT INTO role_permissions (role, permission_key) VALUES (?, ?)").bind(role, key),
		);
	}
	await db.batch(stmts);
}
