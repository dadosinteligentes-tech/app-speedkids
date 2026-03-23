import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { listUsers, getUserById, createUser, updateUser, deactivateUser } from "../../db/queries/users";
import { requirePermission } from "../../middleware/require-permission";
import { generateSalt, hashPassword } from "../../lib/crypto";
import { auditLog } from "../../lib/logger";
import { getLimitsForPlan, getTenantUsage, checkLimit } from "../../lib/plan-limits";

export const userRoutes = new Hono<AppEnv>();

// All user management requires owner role
userRoutes.use("*", requirePermission("users.manage"));

userRoutes.get("/", async (c) => {
	const tenantId = c.get('tenant_id');
	const users = await listUsers(c.env.DB, tenantId);
	// Strip sensitive fields
	const safe = users.map(({ password_hash, salt, ...rest }) => rest);
	return c.json(safe);
});

userRoutes.get("/:id", async (c) => {
	const tenantId = c.get('tenant_id');
	const user = await getUserById(c.env.DB, tenantId, Number(c.req.param("id")));
	if (!user) return c.json({ error: "User not found" }, 404);
	const { password_hash, salt, ...safe } = user;
	return c.json(safe);
});

userRoutes.post("/", async (c) => {
	const tenantId = c.get('tenant_id');
	const tenant = c.get('tenant');

	// Enforce plan limits
	const limits = getLimitsForPlan(tenant?.plan || "starter");
	const usage = await getTenantUsage(c.env.DB, tenantId);
	const check = checkLimit(usage.userCount, limits.maxUsers, "usuarios");
	if (!check.allowed) {
		return c.json({ error: check.message }, 403);
	}

	const body = await c.req.json<{ name: string; email: string; password: string; role: string }>();
	if (!body.name || !body.email || !body.password || !body.role) {
		return c.json({ error: "Todos os campos são obrigatórios" }, 400);
	}

	const salt = generateSalt();
	const password_hash = await hashPassword(body.password, salt);
	const user = await createUser(c.env.DB, {
		tenant_id: tenantId,
		name: body.name,
		email: body.email,
		password_hash,
		salt,
		role: body.role,
	});

	if (!user) return c.json({ error: "Erro ao criar usuário" }, 500);

	const { password_hash: _, salt: __, ...safe } = user;
	await auditLog(c, "user.create", "user", user.id, { name: body.name, role: body.role });
	return c.json(safe, 201);
});

userRoutes.put("/:id", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const existing = await getUserById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "User not found" }, 404);

	const body = await c.req.json<{ name?: string; email?: string; role?: string; password?: string }>();
	const params: { name?: string; email?: string; role?: string; password_hash?: string; salt?: string } = {};

	if (body.name) params.name = body.name;
	if (body.email) params.email = body.email;
	if (body.role) params.role = body.role;
	if (body.password) {
		params.salt = generateSalt();
		params.password_hash = await hashPassword(body.password, params.salt);
	}

	await updateUser(c.env.DB, tenantId, id, params);
	await auditLog(c, "user.update", "user", id, { name: body.name, role: body.role });
	const updated = await getUserById(c.env.DB, tenantId, id);
	if (!updated) return c.json({ error: "User not found" }, 404);
	const { password_hash, salt, ...safe } = updated;
	return c.json(safe);
});

userRoutes.delete("/:id", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const currentUser = c.get("user");

	if (currentUser?.id === id) {
		return c.json({ error: "Não é possível desativar a si mesmo" }, 400);
	}

	const existing = await getUserById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "User not found" }, 404);

	await deactivateUser(c.env.DB, tenantId, id);
	await auditLog(c, "user.deactivate", "user", id, { name: existing.name });
	return c.json({ ok: true });
});
