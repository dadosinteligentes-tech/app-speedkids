import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getBusinessConfig, updateBusinessConfig } from "../../db/queries/business-config";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";

export const businessConfigRoutes = new Hono<AppEnv>();

businessConfigRoutes.get("/", async (c) => {
	const tenantId = c.get('tenant_id');
	const config = await getBusinessConfig(c.env.DB, tenantId);
	return c.json(config);
});

businessConfigRoutes.put("/", requirePermission("settings.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await c.req.json<{
		name?: string;
		cnpj?: string | null;
		address?: string | null;
		phone?: string | null;
		receipt_footer?: string | null;
	}>();

	await updateBusinessConfig(c.env.DB, tenantId, body);
	await auditLog(c, "business_config.update", "business_config", 1, body);
	const updated = await getBusinessConfig(c.env.DB, tenantId);
	return c.json(updated);
});
