import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	getActiveSessionByAsset,
	getActiveSessions,
	getSessionById,
	createSession,
	pauseSession,
	resumeSession,
	stopSession,
	paySession,
	updateSessionDuration,
	extendSession,
} from "../../db/queries/rentals";
import { getPackageById } from "../../db/queries/packages";
import { getAssetById, updateAssetStatus } from "../../db/queries/assets";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";
import { getOpenRegister } from "../../db/queries/cash-registers";
import { getBatteryByAssetId, updateBatteryStatus, updateBatteryDrain } from "../../db/queries/batteries";
import { recordPayment } from "../../services/payment";
import { validateJson } from "../../lib/request";
import { rentalStartSchema, rentalPaySchema, rentalExtendSchema, rentalEditSchema } from "../../lib/validation";

export const rentalRoutes = new Hono<AppEnv>();

rentalRoutes.get("/active", async (c) => {
	const tenantId = c.get('tenant_id');
	const sessions = await getActiveSessions(c.env.DB, tenantId);
	return c.json(sessions);
});

rentalRoutes.get("/:id", async (c) => {
	const tenantId = c.get('tenant_id');
	const session = await getSessionById(c.env.DB, c.req.param("id"), tenantId);
	if (!session) return c.json({ error: "Session not found" }, 404);
	return c.json(session);
});

rentalRoutes.post("/start", async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await validateJson(c, rentalStartSchema);

	// Block rental if no cash register is open
	const register = await getOpenRegister(c.env.DB, tenantId);
	if (!register) {
		return c.json({ error: "Abra o caixa antes de iniciar uma locacao", code: "NO_REGISTER" }, 400);
	}

	// Validate asset and package in parallel
	const [asset, existing, pkg] = await Promise.all([
		getAssetById(c.env.DB, tenantId, body.asset_id),
		getActiveSessionByAsset(c.env.DB, body.asset_id, tenantId),
		getPackageById(c.env.DB, tenantId, body.package_id),
	]);

	if (!asset) return c.json({ error: "Asset not found" }, 404);
	if (asset.status !== "available") return c.json({ error: "Asset not available" }, 400);
	if (existing) return c.json({ error: "Asset already has active session" }, 400);
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
		tenant_id: tenantId,
	});

	await updateAssetStatus(c.env.DB, tenantId, body.asset_id, "in_use");

	// Mark battery as in_use if asset uses battery
	if (asset.uses_battery) {
		const battery = await getBatteryByAssetId(c.env.DB, body.asset_id, tenantId);
		if (battery && (battery.status === "ready" || battery.status === "in_use")) {
			await updateBatteryStatus(c.env.DB, battery.id, "in_use", tenantId);
		}
	}

	// Handle prepaid payment
	if (body.paid) {
		const prepaidDiscount = Math.min(body.discount_cents ?? 0, pkg.price_cents);
		const isSplit = body.payments && body.payments.length >= 2;
		const isCourtesy = body.payment_method === "courtesy";
		const amount = isCourtesy ? 0 : Math.max(0, pkg.price_cents - prepaidDiscount);
		const method = isSplit ? "mixed" : (body.payment_method ?? "cash");

		await paySession(c.env.DB, sessionId, method, amount, null, tenantId, prepaidDiscount, body.promotion_id);

		let payResult = { achievements: [] as any[] };
		if (amount > 0) {
			payResult = await recordPayment({
				db: c.env.DB,
				tenantId,
				registerId: register.id,
				recordedBy: user?.id ?? null,
				rentalSessionId: sessionId,
				transactionType: "rental_payment",
				amountCents: amount,
				paymentMethod: method,
				paymentDenominations: body.payment_denominations,
				changeDenominations: body.change_denominations,
				payments: body.payments,
				customerId: body.customer_id,
			});
		}
		if (payResult.achievements.length > 0) {
			const session = await getSessionById(c.env.DB, sessionId, tenantId);
			return c.json({ ...session, achievements: payResult.achievements }, 201);
		}
	}

	await auditLog(c, "rental.start", "rental", sessionId, {
		asset_id: body.asset_id,
		package: pkg.name,
		customer_id: body.customer_id,
		child_id: body.child_id,
		prepaid: body.paid ?? false,
		payment_method: body.payments ? "mixed" : (body.payment_method ?? null),
		discount_cents: (body.discount_cents ?? 0) > 0 ? body.discount_cents : undefined,
	});

	const session = await getSessionById(c.env.DB, sessionId, tenantId);
	return c.json(session, 201);
});

rentalRoutes.post("/:id/pause", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = c.req.param("id");
	const now = new Date().toISOString();
	await pauseSession(c.env.DB, id, now, tenantId);
	const session = await getSessionById(c.env.DB, id, tenantId);
	await auditLog(c, "rental.pause", "rental", id);
	return c.json(session);
});

rentalRoutes.post("/:id/resume", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = c.req.param("id");
	const now = new Date().toISOString();
	await resumeSession(c.env.DB, id, now, tenantId);
	const session = await getSessionById(c.env.DB, id, tenantId);
	await auditLog(c, "rental.resume", "rental", id);
	return c.json(session);
});

rentalRoutes.post("/:id/stop", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = c.req.param("id");
	const now = new Date().toISOString();
	const stopped = await stopSession(c.env.DB, id, now, tenantId);
	if (!stopped) return c.json({ error: "Session not found" }, 404);

	await updateAssetStatus(c.env.DB, tenantId, stopped.asset_id, "available");

	// Drain battery based on running time
	const asset = await getAssetById(c.env.DB, tenantId, stopped.asset_id);
	if (asset?.uses_battery) {
		const battery = await getBatteryByAssetId(c.env.DB, stopped.asset_id, tenantId);
		if (battery) {
			const elapsedMs = new Date(now).getTime() - new Date(stopped.start_time).getTime() - stopped.total_paused_ms;
			const minutesUsed = Math.max(0, Math.round(elapsedMs / 60000));
			await updateBatteryDrain(c.env.DB, battery.id, minutesUsed, tenantId);
		}
	}

	await auditLog(c, "rental.stop", "rental", id, { amount_cents: stopped.amount_cents });

	const session = await getSessionById(c.env.DB, id, tenantId);
	const prepaid = session?.paid === 1;
	return c.json({ ...session, prepaid });
});

rentalRoutes.post("/:id/pay", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = c.req.param("id");
	const body = await validateJson(c, rentalPaySchema);

	const session = await getSessionById(c.env.DB, id, tenantId);
	if (!session) return c.json({ error: "Session not found" }, 404);

	const originalAmount = session.amount_cents;
	const discount = Math.min(body.discount_cents ?? 0, originalAmount);
	const finalAmount = Math.max(0, originalAmount - discount);
	const user = c.get("user");
	const register = await getOpenRegister(c.env.DB, tenantId);

	// For prepaid sessions with overtime, only overtime is due now
	const isOvertimeOnly = session.paid === 1 && session.overtime_cents > 0;
	const amountDue = isOvertimeOnly
		? Math.max(0, session.overtime_cents - discount)
		: finalAmount;

	const isSplit = body.payments && body.payments.length >= 2;

	// Validate split payment totals
	if (isSplit && body.payments) {
		const paymentsTotal = body.payments.reduce((sum, p) => sum + p.amount_cents, 0);
		if (paymentsTotal !== amountDue) {
			return c.json({ error: "Soma dos pagamentos nao confere com o total" }, 400);
		}
	}

	const method = isSplit ? "mixed" : body.payment_method;
	await paySession(c.env.DB, id, method, finalAmount, body.notes ?? null, tenantId, discount, body.promotion_id);

	let achievements: any[] = [];
	if (register && amountDue > 0) {
		const payResult = await recordPayment({
			db: c.env.DB,
			tenantId,
			registerId: register.id,
			recordedBy: user?.id ?? null,
			rentalSessionId: id,
			transactionType: "rental_payment",
			amountCents: amountDue,
			paymentMethod: method,
			paymentDenominations: body.payment_denominations,
			changeDenominations: body.change_denominations,
			payments: body.payments,
			customerId: session.customer_id,
		});
		achievements = payResult.achievements;
	} else if (session.customer_id) {
		// No register open but still update customer stats
		const { updateCustomerStats } = await import("../../db/queries/customers");
		await updateCustomerStats(c.env.DB, tenantId, session.customer_id, amountDue);
	}

	await auditLog(c, "rental.pay", "rental", id, {
		payment_method: method,
		original_amount_cents: originalAmount,
		discount_cents: discount,
		final_amount_cents: finalAmount,
		amount_due: amountDue,
		notes: body.notes,
	});

	const updated = await getSessionById(c.env.DB, id, tenantId);
	return c.json({ ...updated, achievements });
});

rentalRoutes.post("/:id/extend", requirePermission("rentals.extend"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = c.req.param("id");
	const body = await validateJson(c, rentalExtendSchema);

	const session = await getSessionById(c.env.DB, id, tenantId);
	if (!session) return c.json({ error: "Session not found" }, 404);
	if (session.status !== "running" && session.status !== "paused") {
		return c.json({ error: "Session is not active" }, 400);
	}

	let addMinutes: number;
	let addCents: number;

	if (body.package_id) {
		const pkg = await getPackageById(c.env.DB, tenantId, body.package_id);
		if (!pkg) return c.json({ error: "Package not found" }, 404);
		addMinutes = pkg.duration_minutes;
		addCents = pkg.price_cents;
	} else {
		addMinutes = body.additional_minutes!;
		addCents = 0;
	}

	await extendSession(c.env.DB, id, addMinutes, addCents, tenantId);
	const updated = await getSessionById(c.env.DB, id, tenantId);
	await auditLog(c, "rental.extend", "rental", id, { added_minutes: addMinutes, added_cents: addCents });
	return c.json(updated);
});

rentalRoutes.put("/:id/edit", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = c.req.param("id");
	const body = await validateJson(c, rentalEditSchema);

	const session = await getSessionById(c.env.DB, id, tenantId);
	if (!session) return c.json({ error: "Session not found" }, 404);
	if (session.status === "completed" || session.status === "cancelled") {
		return c.json({ error: "Cannot edit finished session" }, 400);
	}

	let duration = body.duration_minutes ?? session.duration_minutes;
	let amount = session.amount_cents;

	if (body.package_id && body.package_id !== session.package_id) {
		const pkg = await getPackageById(c.env.DB, tenantId, body.package_id);
		if (!pkg) return c.json({ error: "Package not found" }, 404);
		duration = pkg.duration_minutes;
		amount = pkg.price_cents;
	}

	await updateSessionDuration(c.env.DB, id, duration, amount, tenantId);
	const updated = await getSessionById(c.env.DB, id, tenantId);
	return c.json(updated);
});

// ── Document templates for rental ──

import { getActiveTemplates, getSessionPrintedDocs, recordPrint } from "../../db/queries/document-templates";

rentalRoutes.get("/:id/documents", async (c) => {
	const tenantId = c.get("tenant_id");
	const id = c.req.param("id");
	const [templates, printed] = await Promise.all([
		getActiveTemplates(c.env.DB, tenantId),
		getSessionPrintedDocs(c.env.DB, id),
	]);
	const printedIds = new Set(printed.map((p) => p.template_id));
	return c.json({
		templates: templates.map((t) => ({ ...t, printed: printedIds.has(t.id) })),
		printed,
	});
});

rentalRoutes.post("/:id/documents/:docId/print", requirePermission("documents.print"), async (c) => {
	const tenantId = c.get("tenant_id");
	const sessionId = c.req.param("id");
	const docId = parseInt(c.req.param("docId"), 10);
	const user = c.get("user");
	await recordPrint(c.env.DB, sessionId, docId, tenantId, user?.id ?? 0);
	return c.json({ ok: true });
});
