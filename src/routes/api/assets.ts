import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssets, getAssetById, createAsset, updateAsset, retireAsset } from "../../db/queries/assets";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const EXT_MAP: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const assetRoutes = new Hono<AppEnv>();

assetRoutes.get("/", async (c) => {
	const tenantId = c.get('tenant_id');
	const assets = await getAssets(c.env.DB, tenantId);
	return c.json(assets);
});

// Serve asset photo from R2
assetRoutes.get("/photo/*", async (c) => {
	const key = c.req.path.replace("/api/assets/photo/", "");
	if (!key) return c.json({ error: "Key obrigatoria" }, 400);

	const object = await c.env.B_BUCKET_SPEEDKIDS.get(key);
	if (!object) return c.json({ error: "Foto nao encontrada" }, 404);

	const headers = new Headers();
	headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/jpeg");
	headers.set("Cache-Control", "public, max-age=86400");
	return new Response(object.body, { headers });
});

assetRoutes.get("/:id", async (c) => {
	const tenantId = c.get('tenant_id');
	const asset = await getAssetById(c.env.DB, tenantId, Number(c.req.param("id")));
	if (!asset) return c.json({ error: "Asset not found" }, 404);
	return c.json(asset);
});

assetRoutes.post("/", requirePermission("assets.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await c.req.json<{
		name: string; asset_type: string; model?: string; photo_url?: string; notes?: string;
		uses_battery?: number; max_weight_kg?: number | null; min_age?: number | null; max_age?: number | null; sort_order?: number;
	}>();
	if (!body.name || !body.asset_type) {
		return c.json({ error: "Nome e tipo são obrigatórios" }, 400);
	}
	const asset = await createAsset(c.env.DB, { ...body, tenant_id: tenantId });
	await auditLog(c, "asset.create", "asset", asset?.id, { name: body.name });
	return c.json(asset, 201);
});

assetRoutes.put("/:id", requirePermission("assets.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const existing = await getAssetById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "Asset not found" }, 404);

	const body = await c.req.json<{
		name?: string; asset_type?: string; model?: string; photo_url?: string; notes?: string;
		uses_battery?: number; max_weight_kg?: number | null; min_age?: number | null; max_age?: number | null; sort_order?: number;
	}>();
	await updateAsset(c.env.DB, tenantId, id, body);
	await auditLog(c, "asset.update", "asset", id, body);
	const updated = await getAssetById(c.env.DB, tenantId, id);
	return c.json(updated);
});

assetRoutes.delete("/:id", requirePermission("assets.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const existing = await getAssetById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "Asset not found" }, 404);

	await retireAsset(c.env.DB, tenantId, id);
	await auditLog(c, "asset.retire", "asset", id, { name: existing.name });
	return c.json({ ok: true });
});

// Upload asset photo to R2
assetRoutes.post("/:id/photo", requirePermission("assets.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const existing = await getAssetById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "Ativo nao encontrado" }, 404);

	const formData = await c.req.formData();
	const file = formData.get("photo");
	if (!file || !(file instanceof File)) {
		return c.json({ error: "Arquivo de foto obrigatorio" }, 400);
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return c.json({ error: "Tipo de arquivo invalido. Use JPEG, PNG ou WebP" }, 400);
	}
	if (file.size > MAX_SIZE) {
		return c.json({ error: "Arquivo muito grande. Maximo 2MB" }, 400);
	}

	// Delete old photo if exists
	if (existing.photo_url) {
		await c.env.B_BUCKET_SPEEDKIDS.delete(existing.photo_url);
	}

	const ext = EXT_MAP[file.type] ?? "jpg";
	const key = `assets/${id}/${Date.now()}.${ext}`;

	await c.env.B_BUCKET_SPEEDKIDS.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	await updateAsset(c.env.DB, tenantId, id, { photo_url: key });
	await auditLog(c, "asset.photo.upload", "asset", id, { key });

	return c.json({ photo_url: key }, 200);
});

// Delete asset photo
assetRoutes.delete("/:id/photo", requirePermission("assets.manage"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const existing = await getAssetById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "Ativo nao encontrado" }, 404);

	if (existing.photo_url) {
		await c.env.B_BUCKET_SPEEDKIDS.delete(existing.photo_url);
		await updateAsset(c.env.DB, tenantId, id, { photo_url: null as unknown as string });
		await auditLog(c, "asset.photo.delete", "asset", id);
	}

	return c.json({ ok: true });
});
