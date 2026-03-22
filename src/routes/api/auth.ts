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
	const body = await validateJson(c, loginSchema);

	const user = await getUserByEmail(c.env.DB, body.email);
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

	c.set("user", { id: user.id, name: user.name, email: user.email, role: user.role });
	await auditLog(c, "auth.login", "auth", user.id);

	return c.json({
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
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
