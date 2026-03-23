import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getBusinessConfig, updateBusinessConfig } from "../../db/queries/business-config";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const EXT_MAP: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

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

// Serve logo from R2
businessConfigRoutes.get("/logo/*", async (c) => {
	const key = c.req.path.replace("/api/business-config/logo/", "");
	if (!key) return c.json({ error: "Key obrigatoria" }, 400);

	const object = await c.env.B_BUCKET_SPEEDKIDS.get(key);
	if (!object) return c.json({ error: "Logo nao encontrado" }, 404);

	const headers = new Headers();
	headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/png");
	headers.set("Cache-Control", "public, max-age=86400");
	return new Response(object.body, { headers });
});

// Upload logo to R2
businessConfigRoutes.post("/logo", requirePermission("settings.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const tenant = c.get('tenant');
	if (!tenant) return c.json({ error: "Tenant nao encontrado" }, 404);

	const formData = await c.req.formData();
	const file = formData.get("logo");
	if (!file || !(file instanceof File)) {
		return c.json({ error: "Arquivo de logo obrigatorio" }, 400);
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return c.json({ error: "Tipo de arquivo invalido. Use JPEG, PNG ou WebP" }, 400);
	}
	if (file.size > MAX_SIZE) {
		return c.json({ error: "Arquivo muito grande. Maximo 2MB" }, 400);
	}

	// Delete old logo if exists
	if (tenant.logo_url) {
		const oldKey = tenant.logo_url.replace("/api/business-config/logo/", "");
		if (oldKey) {
			await c.env.B_BUCKET_SPEEDKIDS.delete(oldKey);
		}
	}

	const ext = EXT_MAP[file.type] ?? "png";
	const key = `tenants/${tenant.slug}/logo.${ext}`;

	await c.env.B_BUCKET_SPEEDKIDS.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	const logoUrl = `/api/business-config/logo/${key}`;
	await c.env.DB.prepare("UPDATE tenants SET logo_url = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(logoUrl, tenantId)
		.run();

	await auditLog(c, "tenant.logo.upload", "tenant", tenantId, { key });

	return c.json({ logo_url: logoUrl }, 200);
});

// Update tenant branding (primary_color)
businessConfigRoutes.put("/branding", requirePermission("settings.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await c.req.json<{ primary_color?: string }>();

	if (body.primary_color) {
		// Validate hex color format
		if (!/^#[0-9A-Fa-f]{6}$/.test(body.primary_color)) {
			return c.json({ error: "Cor invalida. Use formato hex (#RRGGBB)" }, 400);
		}
		await c.env.DB.prepare("UPDATE tenants SET primary_color = ?, updated_at = datetime('now') WHERE id = ?")
			.bind(body.primary_color, tenantId)
			.run();
		await auditLog(c, "tenant.branding.update", "tenant", tenantId, { primary_color: body.primary_color });
	}

	const tenant = await c.env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
	return c.json(tenant);
});
