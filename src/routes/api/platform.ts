import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { platformAdminMiddleware } from "../../middleware/platform-admin";
import { getPlatformStats, getAllTenants, getTenantDetail, getTenantRecentActivity, updateTenantStatus } from "../../db/queries/platform";
import { isSlugAvailable, provisionTenant } from "../../services/provisioning";

export const platformApiRoutes = new Hono<AppEnv>();

platformApiRoutes.use("*", platformAdminMiddleware);

platformApiRoutes.get("/stats", async (c) => {
	const stats = await getPlatformStats(c.env.DB);
	return c.json(stats);
});

platformApiRoutes.get("/tenants", async (c) => {
	const tenants = await getAllTenants(c.env.DB);
	return c.json(tenants);
});

platformApiRoutes.get("/tenants/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const tenant = await getTenantDetail(c.env.DB, id);
	if (!tenant) return c.json({ error: "Tenant not found" }, 404);

	const activity = await getTenantRecentActivity(c.env.DB, id);
	return c.json({ ...tenant, ...activity });
});

platformApiRoutes.post("/tenants/:id/suspend", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await updateTenantStatus(c.env.DB, id, "suspended");
	return c.json({ ok: true });
});

platformApiRoutes.post("/tenants/:id/activate", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await updateTenantStatus(c.env.DB, id, "active");
	return c.json({ ok: true });
});

platformApiRoutes.post("/tenants", async (c) => {
	const body = await c.req.json<{
		slug: string;
		businessName: string;
		ownerName: string;
		ownerEmail: string;
		ownerPassword: string;
		plan: string;
	}>();

	if (!body.slug || !body.businessName || !body.ownerName || !body.ownerEmail || !body.ownerPassword) {
		return c.json({ error: "Campos obrigatorios faltando" }, 400);
	}

	const slug = body.slug.toLowerCase().trim();
	const available = await isSlugAvailable(c.env.DB, slug);
	if (!available) return c.json({ error: "Slug indisponivel" }, 400);

	const tenant = await provisionTenant(c.env.DB, {
		slug,
		name: body.businessName,
		ownerName: body.ownerName,
		ownerEmail: body.ownerEmail,
		ownerPassword: body.ownerPassword,
		plan: body.plan || "starter",
	});

	return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug } }, 201);
});
