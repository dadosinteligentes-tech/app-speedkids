import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssets, getAssetById, createAsset, updateAsset, retireAsset } from "../../db/queries/assets";
import { requireRole } from "../../middleware/require-role";
import { auditLog } from "../../lib/logger";

export const assetRoutes = new Hono<AppEnv>();

assetRoutes.get("/", async (c) => {
	const assets = await getAssets(c.env.DB);
	return c.json(assets);
});

assetRoutes.get("/:id", async (c) => {
	const asset = await getAssetById(c.env.DB, Number(c.req.param("id")));
	if (!asset) return c.json({ error: "Asset not found" }, 404);
	return c.json(asset);
});

assetRoutes.post("/", requireRole("manager", "owner"), async (c) => {
	const body = await c.req.json<{
		name: string; asset_type: string; model?: string; photo_url?: string; notes?: string;
		uses_battery?: number; max_weight_kg?: number | null; min_age?: number | null; max_age?: number | null; sort_order?: number;
	}>();
	if (!body.name || !body.asset_type) {
		return c.json({ error: "Nome e tipo são obrigatórios" }, 400);
	}
	const asset = await createAsset(c.env.DB, body);
	await auditLog(c, "asset.create", "asset", asset?.id, { name: body.name });
	return c.json(asset, 201);
});

assetRoutes.put("/:id", requireRole("manager", "owner"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getAssetById(c.env.DB, id);
	if (!existing) return c.json({ error: "Asset not found" }, 404);

	const body = await c.req.json<{
		name?: string; asset_type?: string; model?: string; photo_url?: string; notes?: string;
		uses_battery?: number; max_weight_kg?: number | null; min_age?: number | null; max_age?: number | null; sort_order?: number;
	}>();
	await updateAsset(c.env.DB, id, body);
	await auditLog(c, "asset.update", "asset", id, body);
	const updated = await getAssetById(c.env.DB, id);
	return c.json(updated);
});

assetRoutes.delete("/:id", requireRole("manager", "owner"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getAssetById(c.env.DB, id);
	if (!existing) return c.json({ error: "Asset not found" }, 404);

	await retireAsset(c.env.DB, id);
	await auditLog(c, "asset.retire", "asset", id, { name: existing.name });
	return c.json({ ok: true });
});
