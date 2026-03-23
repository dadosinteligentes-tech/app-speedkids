import type { Context } from "hono";
import type { AppEnv } from "../types";
import { createLog } from "../db/queries/logs";

export async function auditLog(
	c: Context<AppEnv>,
	action: string,
	entityType: string,
	entityId?: string | number | null,
	details?: Record<string, unknown>,
): Promise<void> {
	const user = c.get("user");
	const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null;

	// Use the user's actual tenant_id (not the middleware-resolved one)
	// This prevents platform admin actions from leaking into client tenant logs
	const tenantId = user?.tenant_id ?? c.get("tenant_id");

	try {
		await createLog(c.env.DB, {
			tenant_id: tenantId,
			user_id: user?.id ?? null,
			action,
			entity_type: entityType,
			entity_id: entityId != null ? String(entityId) : null,
			details: details ? JSON.stringify(details) : null,
			ip_address: ip,
		});
	} catch {
		// Don't let logging failures break the main flow
		console.error("Failed to write audit log:", action, entityType, entityId);
	}
}
