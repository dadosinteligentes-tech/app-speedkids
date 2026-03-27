import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../../types";
import { getUserByEmail } from "../../db/queries/users";
import { createAuthSession, deleteAuthSession } from "../../db/queries/auth";
import { verifyPassword } from "../../lib/crypto";
import { auditLog } from "../../lib/logger";
import { validateJson } from "../../lib/request";
import { loginSchema } from "../../lib/validation";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await validateJson(c, loginSchema);

	// Try current tenant first (only if tenant resolved from subdomain)
	let user = tenantId ? await getUserByEmail(c.env.DB, tenantId, body.email) : null;

	// If not found and email is a platform admin, try the _platform tenant
	if (!user) {
		const adminEmails = (c.env.PLATFORM_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
		if (adminEmails.includes(body.email.toLowerCase())) {
			const platformTenant = await c.env.DB
				.prepare("SELECT id FROM tenants WHERE slug = '_platform'")
				.first<{ id: number }>();
			if (platformTenant) {
				user = await getUserByEmail(c.env.DB, platformTenant.id, body.email);
			}
		}
	}

	if (!user) {
		return c.json({ error: "Email ou senha inválidos" }, 401);
	}

	const valid = await verifyPassword(body.password, user.salt, user.password_hash);
	if (!valid) {
		return c.json({ error: "Email ou senha inválidos" }, 401);
	}

	const session = await createAuthSession(c.env.DB, user.id);
	if (!session) {
		return c.json({ error: "Erro ao criar sessão" }, 500);
	}

	setCookie(c, "sk_session", session.id, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		maxAge: 60 * 60 * 24, // 24 hours
	});

	c.set("user", { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id });
	await auditLog(c, "auth.login", "auth", user.id);

	return c.json({
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	});
});

// Platform admin login — authenticates directly against the _platform tenant
authRoutes.post("/platform-login", async (c) => {
	const body = await validateJson(c, loginSchema);

	const platformTenant = await c.env.DB
		.prepare("SELECT id FROM tenants WHERE slug = '_platform'")
		.first<{ id: number }>();

	if (!platformTenant) {
		return c.json({ error: "Plataforma não configurada" }, 500);
	}

	const user = await getUserByEmail(c.env.DB, platformTenant.id, body.email);
	if (!user) {
		return c.json({ error: "Email ou senha inválidos" }, 401);
	}

	const valid = await verifyPassword(body.password, user.salt, user.password_hash);
	if (!valid) {
		return c.json({ error: "Email ou senha inválidos" }, 401);
	}

	const session = await createAuthSession(c.env.DB, user.id);
	if (!session) {
		return c.json({ error: "Erro ao criar sessão" }, 500);
	}

	setCookie(c, "sk_session", session.id, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		maxAge: 60 * 60 * 24,
	});

	c.set("user", { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id });
	await auditLog(c, "auth.platform_login", "auth", user.id);

	return c.json({
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		redirect: "/platform",
	});
});

authRoutes.post("/logout", async (c) => {
	const sessionId = getCookie(c, "sk_session");
	if (sessionId) {
		await deleteAuthSession(c.env.DB, sessionId);
	}

	deleteCookie(c, "sk_session", { path: "/" });
	await auditLog(c, "auth.logout", "auth");
	return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Not authenticated" }, 401);
	return c.json(user);
});
