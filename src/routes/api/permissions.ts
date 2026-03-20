import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireRole } from "../../middleware/require-role";
import { getAllPermissions, getAllRolePermissions, setRolePermissions } from "../../db/queries/permissions";
import { auditLog } from "../../lib/logger";

export const permissionRoutes = new Hono<AppEnv>();

// Only owners can manage permissions (hardcoded to prevent lock-out)
permissionRoutes.use("*", requireRole("owner"));

permissionRoutes.get("/", async (c) => {
	const [permissions, rolePermissions] = await Promise.all([
		getAllPermissions(c.env.DB),
		getAllRolePermissions(c.env.DB),
	]);
	return c.json({ permissions, rolePermissions });
});

permissionRoutes.put("/:role", async (c) => {
	const role = c.req.param("role");

	if (role !== "operator" && role !== "manager" && role !== "owner") {
		return c.json({ error: "Perfil invalido" }, 400);
	}

	if (role === "owner") {
		return c.json({ error: "Permissoes do Socio nao podem ser alteradas" }, 400);
	}

	const body = await c.req.json<{ permissions: string[] }>();
	if (!Array.isArray(body.permissions)) {
		return c.json({ error: "Lista de permissoes invalida" }, 400);
	}

	const allPerms = await getAllPermissions(c.env.DB);
	const validKeys = allPerms.map((p) => p.key);
	const invalidKeys = body.permissions.filter((k) => !validKeys.includes(k));
	if (invalidKeys.length > 0) {
		return c.json({ error: "Permissoes invalidas: " + invalidKeys.join(", ") }, 400);
	}

	await setRolePermissions(c.env.DB, role, body.permissions);
	await auditLog(c, "permissions.update", "role_permissions", role, {
		role,
		permissions: body.permissions,
	});

	return c.json({ ok: true });
});
