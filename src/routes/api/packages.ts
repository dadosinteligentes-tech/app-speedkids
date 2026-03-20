import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getActivePackages, getAllPackages, getPackageById, createPackage, updatePackage, togglePackageActive } from "../../db/queries/packages";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";

export const packageRoutes = new Hono<AppEnv>();

packageRoutes.get("/", async (c) => {
	const all = c.req.query("all");
	const packages = all ? await getAllPackages(c.env.DB) : await getActivePackages(c.env.DB);
	return c.json(packages);
});

packageRoutes.get("/:id", async (c) => {
	const pkg = await getPackageById(c.env.DB, Number(c.req.param("id")));
	if (!pkg) return c.json({ error: "Package not found" }, 404);
	return c.json(pkg);
});

packageRoutes.post("/", requirePermission("packages.manage"), async (c) => {
	const body = await c.req.json<{
		name: string; duration_minutes: number; price_cents: number; sort_order?: number;
		overtime_block_minutes?: number; overtime_block_price_cents?: number; grace_period_minutes?: number;
	}>();
	if (!body.name || !body.duration_minutes || body.price_cents == null) {
		return c.json({ error: "Nome, duração e preço são obrigatórios" }, 400);
	}
	const pkg = await createPackage(c.env.DB, body);
	await auditLog(c, "package.create", "package", pkg?.id, { name: body.name });
	return c.json(pkg, 201);
});

packageRoutes.put("/:id", requirePermission("packages.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getPackageById(c.env.DB, id);
	if (!existing) return c.json({ error: "Package not found" }, 404);

	const body = await c.req.json<{
		name?: string; duration_minutes?: number; price_cents?: number; sort_order?: number;
		overtime_block_minutes?: number; overtime_block_price_cents?: number; grace_period_minutes?: number;
	}>();
	await updatePackage(c.env.DB, id, body);
	await auditLog(c, "package.update", "package", id, body);
	const updated = await getPackageById(c.env.DB, id);
	return c.json(updated);
});

packageRoutes.patch("/:id/toggle", requirePermission("packages.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getPackageById(c.env.DB, id);
	if (!existing) return c.json({ error: "Package not found" }, 404);

	await togglePackageActive(c.env.DB, id);
	await auditLog(c, "package.toggle", "package", id);
	const updated = await getPackageById(c.env.DB, id);
	return c.json(updated);
});
