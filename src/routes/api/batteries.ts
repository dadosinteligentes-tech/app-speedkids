import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	getBatteries, getBatteryById, getInstalledBatteries, getReadyBatteries,
	createBattery, updateBattery, markBatteryCharged, updateBatteryStatus,
	swapBattery, retireBattery, getBatteryByAssetId, setBatteryLevel,
	uninstallBattery, installBattery, addBatteryChargingTime, getBatteriesByLowestCharge,
} from "../../db/queries/batteries";
import { requireRole } from "../../middleware/require-role";
import { auditLog } from "../../lib/logger";

export const batteryRoutes = new Hono<AppEnv>();

batteryRoutes.get("/", async (c) => {
	const batteries = await getBatteries(c.env.DB);
	return c.json(batteries);
});

batteryRoutes.get("/installed", async (c) => {
	const batteries = await getInstalledBatteries(c.env.DB);
	return c.json(batteries);
});

batteryRoutes.get("/ready", async (c) => {
	const batteries = await getReadyBatteries(c.env.DB);
	return c.json(batteries);
});

batteryRoutes.get("/sorted/lowest-charge", async (c) => {
	const batteries = await getBatteriesByLowestCharge(c.env.DB);
	return c.json(batteries);
});

batteryRoutes.get("/:id", async (c) => {
	const battery = await getBatteryById(c.env.DB, Number(c.req.param("id")));
	if (!battery) return c.json({ error: "Battery not found" }, 404);
	return c.json(battery);
});

batteryRoutes.post("/", requireRole("manager", "owner"), async (c) => {
	const body = await c.req.json<{ label: string; full_charge_minutes?: number; charge_time_minutes?: number; notes?: string }>();
	if (!body.label) return c.json({ error: "Label e obrigatorio" }, 400);
	const battery = await createBattery(c.env.DB, body);
	await auditLog(c, "battery.create", "battery", battery?.id, { label: body.label });
	return c.json(battery, 201);
});

batteryRoutes.put("/:id", requireRole("manager", "owner"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);

	const body = await c.req.json<{ label?: string; full_charge_minutes?: number; charge_time_minutes?: number; notes?: string }>();
	await updateBattery(c.env.DB, id, body);
	await auditLog(c, "battery.update", "battery", id, body);
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.post("/:id/charge", async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);

	await markBatteryCharged(c.env.DB, id);
	await auditLog(c, "battery.charge", "battery", id, { label: existing.label });
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.post("/:id/swap", async (c) => {
	const oldBatteryId = Number(c.req.param("id")) || null;
	const body = await c.req.json<{ asset_id: number; new_battery_id: number }>();
	if (!body.asset_id || !body.new_battery_id) {
		return c.json({ error: "asset_id e new_battery_id sao obrigatorios" }, 400);
	}

	const newBattery = await getBatteryById(c.env.DB, body.new_battery_id);
	if (!newBattery) return c.json({ error: "Nova bateria nao encontrada" }, 404);
	if (newBattery.status !== "ready") return c.json({ error: "Bateria nao esta pronta" }, 400);

	await swapBattery(c.env.DB, body.asset_id, oldBatteryId, body.new_battery_id);
	await auditLog(c, "battery.swap", "battery", body.new_battery_id, {
		asset_id: body.asset_id,
		old_battery_id: oldBatteryId,
	});
	const updated = await getBatteryById(c.env.DB, body.new_battery_id);
	return c.json({ battery: updated });
});

batteryRoutes.post("/:id/uninstall", async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);

	await uninstallBattery(c.env.DB, id);
	await auditLog(c, "battery.uninstall", "battery", id, {
		label: existing.label,
		asset_id: existing.asset_id,
	});
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.post("/:id/install", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ asset_id: number }>();
	if (!body.asset_id) return c.json({ error: "asset_id e obrigatorio" }, 400);

	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);
	if (existing.status === "retired") return c.json({ error: "Bateria aposentada" }, 400);

	// Uninstall any existing battery on this asset
	const currentBattery = await getBatteryByAssetId(c.env.DB, body.asset_id);
	if (currentBattery) {
		await uninstallBattery(c.env.DB, currentBattery.id);
	}

	await installBattery(c.env.DB, id, body.asset_id);
	await auditLog(c, "battery.install", "battery", id, {
		label: existing.label,
		asset_id: body.asset_id,
	});
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.post("/:id/level", async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);
	if (existing.status === "retired") return c.json({ error: "Bateria aposentada" }, 400);

	const body = await c.req.json<{ estimated_minutes_remaining: number }>();
	const minutes = Math.max(0, body.estimated_minutes_remaining ?? 0);

	await setBatteryLevel(c.env.DB, id, minutes);
	await auditLog(c, "battery.level", "battery", id, {
		label: existing.label,
		from: existing.estimated_minutes_remaining,
		to: minutes,
	});
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.post("/:id/charge-time", async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);
	if (existing.status === "retired") return c.json({ error: "Bateria aposentada" }, 400);

	const body = await c.req.json<{ charging_minutes: number }>();
	const chargingMinutes = Math.max(0, body.charging_minutes ?? 0);
	if (chargingMinutes <= 0) return c.json({ error: "Tempo de carga invalido" }, 400);

	await addBatteryChargingTime(c.env.DB, id, chargingMinutes);
	await auditLog(c, "battery.charge_time", "battery", id, {
		label: existing.label,
		charging_minutes: chargingMinutes,
	});
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.post("/:id/status", async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);

	const body = await c.req.json<{ status: string }>();
	const valid = ["charging", "ready", "in_use", "depleted"];
	if (!valid.includes(body.status)) return c.json({ error: "Status invalido" }, 400);

	await updateBatteryStatus(c.env.DB, id, body.status as "charging" | "ready" | "in_use" | "depleted");
	const updated = await getBatteryById(c.env.DB, id);
	return c.json(updated);
});

batteryRoutes.delete("/:id", requireRole("manager", "owner"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getBatteryById(c.env.DB, id);
	if (!existing) return c.json({ error: "Battery not found" }, 404);

	await retireBattery(c.env.DB, id);
	await auditLog(c, "battery.retire", "battery", id, { label: existing.label });
	return c.json({ ok: true });
});
