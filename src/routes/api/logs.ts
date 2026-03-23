import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getLogs } from "../../db/queries/logs";
import { requirePermission } from "../../middleware/require-permission";

export const logRoutes = new Hono<AppEnv>();

logRoutes.use("*", requirePermission("logs.view"));

logRoutes.get("/", async (c) => {
	const tenantId = c.get('tenant_id');
	const entity_type = c.req.query("entity_type");
	const entity_id = c.req.query("entity_id");
	const user_id = c.req.query("user_id");
	const limit = Number(c.req.query("limit")) || 50;
	const offset = Number(c.req.query("offset")) || 0;

	const result = await getLogs(c.env.DB, tenantId, {
		entity_type: entity_type || undefined,
		entity_id: entity_id || undefined,
		user_id: user_id ? Number(user_id) : undefined,
		limit,
		offset,
	});

	return c.json(result);
});
