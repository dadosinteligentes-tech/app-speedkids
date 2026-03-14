import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getActiveSessionByAsset, getActiveSessions, getSessionById, createSession, pauseSession, resumeSession, stopSession, paySession, updateSessionDuration, extendSession } from "../../db/queries/rentals";
import { getPackageById } from "../../db/queries/packages";
import { getAssetById, updateAssetStatus } from "../../db/queries/assets";
import { requireRole } from "../../middleware/require-role";
import { auditLog } from "../../lib/logger";
import { getOpenRegister, addTransaction, saveDenominations } from "../../db/queries/cash-registers";
import { updateCustomerStats } from "../../db/queries/customers";
import type { DenominationMap } from "../../lib/denominations";

export const rentalRoutes = new Hono<AppEnv>();

rentalRoutes.get("/active", async (c) => {
	const sessions = await getActiveSessions(c.env.DB);
	return c.json(sessions);
});

rentalRoutes.get("/:id", async (c) => {
	const session = await getSessionById(c.env.DB, c.req.param("id"));
	if (!session) return c.json({ error: "Session not found" }, 404);
	return c.json(session);
});

rentalRoutes.post("/start", async (c) => {
	const body = await c.req.json<{ asset_id: number; package_id: number; id?: string; customer_id?: number; child_id?: number }>();

	const asset = await getAssetById(c.env.DB, body.asset_id);
	if (!asset) return c.json({ error: "Asset not found" }, 404);
	if (asset.status !== "available") return c.json({ error: "Asset not available" }, 400);

	const existing = await getActiveSessionByAsset(c.env.DB, body.asset_id);
	if (existing) return c.json({ error: "Asset already has active session" }, 400);

	const pkg = await getPackageById(c.env.DB, body.package_id);
	if (!pkg) return c.json({ error: "Package not found" }, 404);

	const sessionId = body.id ?? crypto.randomUUID();
	const now = new Date().toISOString();

	const user = c.get("user");
	await createSession(c.env.DB, {
		id: sessionId,
		asset_id: body.asset_id,
		package_id: body.package_id,
		attendant_id: user?.id ?? null,
		customer_id: body.customer_id ?? null,
		child_id: body.child_id ?? null,
		start_time: now,
		duration_minutes: pkg.duration_minutes,
		amount_cents: pkg.price_cents,
	});

	await updateAssetStatus(c.env.DB, body.asset_id, "in_use");
	await auditLog(c, "rental.start", "rental", sessionId, { asset_id: body.asset_id, package: pkg.name, customer_id: body.customer_id, child_id: body.child_id });

	const session = await getSessionById(c.env.DB, sessionId);
	return c.json(session, 201);
});

rentalRoutes.post("/:id/pause", async (c) => {
	const id = c.req.param("id");
	const now = new Date().toISOString();
	await pauseSession(c.env.DB, id, now);
	const session = await getSessionById(c.env.DB, id);
	await auditLog(c, "rental.pause", "rental", id);
	return c.json(session);
});

rentalRoutes.post("/:id/resume", async (c) => {
	const id = c.req.param("id");
	const now = new Date().toISOString();
	await resumeSession(c.env.DB, id, now);
	const session = await getSessionById(c.env.DB, id);
	await auditLog(c, "rental.resume", "rental", id);
	return c.json(session);
});

rentalRoutes.post("/:id/stop", async (c) => {
	const id = c.req.param("id");
	const now = new Date().toISOString();
	const stopped = await stopSession(c.env.DB, id, now);
	if (!stopped) return c.json({ error: "Session not found" }, 404);

	await updateAssetStatus(c.env.DB, stopped.asset_id, "available");
	await auditLog(c, "rental.stop", "rental", id, { amount_cents: stopped.amount_cents });

	const session = await getSessionById(c.env.DB, id);
	return c.json(session);
});

rentalRoutes.post("/:id/pay", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json<{
		payment_method: string;
		discount_cents?: number;
		notes?: string;
		payment_denominations?: Record<string, number>;
		change_denominations?: Record<string, number>;
	}>();

	const session = await getSessionById(c.env.DB, id);
	if (!session) return c.json({ error: "Session not found" }, 404);

	const originalAmount = session.amount_cents;
	const discount = Math.min(body.discount_cents ?? 0, originalAmount);
	const finalAmount = Math.max(0, originalAmount - discount);
	const isCourtesy = body.payment_method === "courtesy";

	await paySession(c.env.DB, id, body.payment_method, finalAmount, body.notes ?? null);

	// Record cash transaction only if register is open, amount > 0, and not courtesy
	const user = c.get("user");
	const register = await getOpenRegister(c.env.DB);
	if (register && finalAmount > 0 && !isCourtesy) {
		const tx = await addTransaction(c.env.DB, {
			cash_register_id: register.id,
			rental_session_id: id,
			type: "rental_payment",
			amount_cents: finalAmount,
			payment_method: body.payment_method,
			recorded_by: user?.id ?? null,
		});

		// Save denomination data for cash payments
		if (tx && body.payment_method === "cash") {
			if (body.payment_denominations) {
				const payDenoms: DenominationMap = Object.fromEntries(
					Object.entries(body.payment_denominations).map(([k, v]) => [Number(k), v]),
				);
				await saveDenominations(c.env.DB, {
					cash_register_id: register.id,
					cash_transaction_id: tx.id,
					event_type: "payment_in",
					denominations: payDenoms,
				});
			}
			if (body.change_denominations) {
				const changeDenoms: DenominationMap = Object.fromEntries(
					Object.entries(body.change_denominations).map(([k, v]) => [Number(k), v]),
				);
				await saveDenominations(c.env.DB, {
					cash_register_id: register.id,
					cash_transaction_id: tx.id,
					event_type: "change_out",
					denominations: changeDenoms,
				});
			}
		}
	}

	// Update customer stats with final amount
	if (session.customer_id) {
		await updateCustomerStats(c.env.DB, session.customer_id, finalAmount);
	}

	await auditLog(c, "rental.pay", "rental", id, {
		payment_method: body.payment_method,
		original_amount_cents: originalAmount,
		discount_cents: discount,
		final_amount_cents: finalAmount,
		notes: body.notes,
	});

	const updated = await getSessionById(c.env.DB, id);
	return c.json(updated);
});

rentalRoutes.post("/:id/extend", requireRole("manager", "owner"), async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json<{ package_id?: number; additional_minutes?: number }>();

	const session = await getSessionById(c.env.DB, id);
	if (!session) return c.json({ error: "Session not found" }, 404);
	if (session.status !== "running" && session.status !== "paused") {
		return c.json({ error: "Session is not active" }, 400);
	}

	let addMinutes: number;
	let addCents: number;

	if (body.package_id) {
		const pkg = await getPackageById(c.env.DB, body.package_id);
		if (!pkg) return c.json({ error: "Package not found" }, 404);
		addMinutes = pkg.duration_minutes;
		addCents = pkg.price_cents;
	} else if (body.additional_minutes) {
		addMinutes = body.additional_minutes;
		addCents = 0;
	} else {
		return c.json({ error: "Provide package_id or additional_minutes" }, 400);
	}

	await extendSession(c.env.DB, id, addMinutes, addCents);
	const updated = await getSessionById(c.env.DB, id);
	await auditLog(c, "rental.extend", "rental", id, { added_minutes: addMinutes, added_cents: addCents });
	return c.json(updated);
});

rentalRoutes.put("/:id/edit", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json<{ package_id?: number; duration_minutes?: number }>();

	const session = await getSessionById(c.env.DB, id);
	if (!session) return c.json({ error: "Session not found" }, 404);
	if (session.status === "completed" || session.status === "cancelled") {
		return c.json({ error: "Cannot edit finished session" }, 400);
	}

	let duration = body.duration_minutes ?? session.duration_minutes;
	let amount = session.amount_cents;

	if (body.package_id && body.package_id !== session.package_id) {
		const pkg = await getPackageById(c.env.DB, body.package_id);
		if (!pkg) return c.json({ error: "Package not found" }, 404);
		duration = pkg.duration_minutes;
		amount = pkg.price_cents;
	}

	await updateSessionDuration(c.env.DB, id, duration, amount);
	const updated = await getSessionById(c.env.DB, id);
	return c.json(updated);
});
