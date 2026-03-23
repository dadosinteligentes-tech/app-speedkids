import { Hono } from "hono";
import type { AppEnv } from "../../types";

export const setupRoutes = new Hono<AppEnv>();

setupRoutes.post("/complete", async (c) => {
	const tenantId = c.get("tenant_id");
	await c.env.DB
		.prepare("UPDATE tenants SET setup_completed = 1, updated_at = datetime('now') WHERE id = ?")
		.bind(tenantId)
		.run();
	return c.json({ ok: true });
});
