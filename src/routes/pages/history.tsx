import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import { getAssetById } from "../../db/queries/assets";
import { getSessionsByAsset } from "../../db/queries/rentals";
import { AssetHistory } from "../../views/history/asset-history";

export const historyPages = new Hono<AppEnv>();

historyPages.use("*", requirePermission("reports.view"));

historyPages.get("/:assetId", async (c) => {
	const assetId = Number(c.req.param("assetId"));
	const asset = await getAssetById(c.env.DB, assetId);
	if (!asset) return c.text("Ativo não encontrado", 404);

	const page = Number(c.req.query("page")) || 1;
	const perPage = 50;
	const { sessions, total } = await getSessionsByAsset(c.env.DB, assetId, perPage, (page - 1) * perPage);
	const user = c.get("user");

	return c.html(<AssetHistory asset={asset} sessions={sessions} total={total} page={page} user={user} />);
});
