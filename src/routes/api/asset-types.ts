import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssetTypes, createAssetType, updateAssetType, deleteAssetType } from "../../db/queries/asset-types";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";

export const assetTypeRoutes = new Hono<AppEnv>();

assetTypeRoutes.get("/", async (c) => {
	const types = await getAssetTypes(c.env.DB);
	return c.json(types);
});

assetTypeRoutes.post("/", requirePermission("assets.manage"), async (c) => {
	const body = await c.req.json<{ name: string; label: string }>();
	if (!body.name || !body.label) {
		return c.json({ error: "Nome e label sao obrigatorios" }, 400);
	}
	const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
	if (!slug) {
		return c.json({ error: "Nome invalido" }, 400);
	}
	try {
		const assetType = await createAssetType(c.env.DB, slug, body.label);
		await auditLog(c, "asset_type.create", "asset_type", assetType?.id, { name: slug, label: body.label });
		return c.json(assetType, 201);
	} catch (e: any) {
		if (e?.message?.includes("UNIQUE")) {
			return c.json({ error: "Tipo ja existe com esse nome" }, 409);
		}
		throw e;
	}
});

assetTypeRoutes.put("/:id", requirePermission("assets.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ label: string }>();
	if (!body.label) {
		return c.json({ error: "Label e obrigatorio" }, 400);
	}
	await updateAssetType(c.env.DB, id, body.label);
	await auditLog(c, "asset_type.update", "asset_type", id, { label: body.label });
	return c.json({ ok: true });
});

assetTypeRoutes.delete("/:id", requirePermission("assets.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const result = await deleteAssetType(c.env.DB, id);
	if (!result.ok) {
		return c.json({ error: result.error }, 409);
	}
	await auditLog(c, "asset_type.delete", "asset_type", id);
	return c.json({ ok: true });
});
