import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { startShift, endShift, getActiveShift, getShiftById } from "../../db/queries/shifts";
import { auditLog } from "../../lib/logger";

export const shiftRoutes = new Hono<AppEnv>();

shiftRoutes.get("/active", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const shift = await getActiveShift(c.env.DB, user.id);
	return c.json(shift);
});

shiftRoutes.get("/:id", async (c) => {
	const shift = await getShiftById(c.env.DB, Number(c.req.param("id")));
	if (!shift) return c.json({ error: "Shift not found" }, 404);
	return c.json(shift);
});

shiftRoutes.post("/start", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const body = await c.req.json<{ name?: string }>().catch((): { name?: string } => ({}));

	const existing = await getActiveShift(c.env.DB, user.id);
	if (existing) return c.json({ error: "Já existe um turno ativo" }, 400);

	const shift = await startShift(c.env.DB, user.id, body.name);
	await auditLog(c, "shift.start", "shift", shift?.id, { name: body.name });
	return c.json(shift, 201);
});

shiftRoutes.post("/:id/end", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ notes?: string }>().catch((): { notes?: string } => ({}));
	await endShift(c.env.DB, id, body.notes);
	await auditLog(c, "shift.end", "shift", id);
	const shift = await getShiftById(c.env.DB, id);
	return c.json(shift);
});
