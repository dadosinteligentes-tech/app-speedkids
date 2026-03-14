import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getLogs } from "../../db/queries/logs";
import { requireRole } from "../../middleware/require-role";

export const logRoutes = new Hono<AppEnv>();

logRoutes.use("*", requireRole("manager", "owner"));

logRoutes.get("/", async (c) => {
	const entity_type = c.req.query("entity_type");
	const entity_id = c.req.query("entity_id");
	const user_id = c.req.query("user_id");
	const limit = Number(c.req.query("limit")) || 50;
	const offset = Number(c.req.query("offset")) || 0;

	const result = await getLogs(c.env.DB, {
		entity_type: entity_type || undefined,
		entity_id: entity_id || undefined,
		user_id: user_id ? Number(user_id) : undefined,
		limit,
		offset,
	});

	return c.json(result);
});
