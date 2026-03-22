import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	openRegister,
	closeRegister,
	getOpenRegister,
	getRegisterById,
	addTransaction,
	getTransactions,
	calculateExpected,
	getRecentRegisters,
	getRegisterSummary,
	getDenominationInventory,
	saveDenominations,
} from "../../db/queries/cash-registers";
import { getActiveShift } from "../../db/queries/shifts";
import { auditLog } from "../../lib/logger";
import { calculateChange } from "../../lib/denominations";
import { toDenomMap, denomTotal } from "../../services/payment";
import { validateJson } from "../../lib/request";
import { cashOpenSchema, cashCloseSchema, cashTransactionSchema, calculateChangeSchema } from "../../lib/validation";

export const cashRegisterRoutes = new Hono<AppEnv>();

cashRegisterRoutes.get("/active", async (c) => {
	const register = await getOpenRegister(c.env.DB);
	return c.json(register);
});

cashRegisterRoutes.get("/recent", async (c) => {
	const registers = await getRecentRegisters(c.env.DB);
	return c.json(registers);
});

cashRegisterRoutes.get("/:id", async (c) => {
	const register = await getRegisterById(c.env.DB, Number(c.req.param("id")));
	if (!register) return c.json({ error: "Register not found" }, 404);
	return c.json(register);
});

cashRegisterRoutes.get("/:id/transactions", async (c) => {
	const transactions = await getTransactions(c.env.DB, Number(c.req.param("id")));
	return c.json(transactions);
});

cashRegisterRoutes.get("/:id/expected", async (c) => {
	const expected = await calculateExpected(c.env.DB, Number(c.req.param("id")));
	return c.json({ expected_cents: expected });
});

cashRegisterRoutes.get("/:id/summary", async (c) => {
	const summary = await getRegisterSummary(c.env.DB, Number(c.req.param("id")));
	return c.json(summary);
});

cashRegisterRoutes.post("/open", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const existing = await getOpenRegister(c.env.DB);
	if (existing) return c.json({ error: "Já existe um caixa aberto" }, 400);

	const body = await validateJson(c, cashOpenSchema);
	const shift = await getActiveShift(c.env.DB, user.id);

	const denoms = toDenomMap(body.denominations);
	const openingCents = denoms ? denomTotal(denoms) : (body.opening_balance_cents ?? 0);

	const register = await openRegister(c.env.DB, {
		opened_by: user.id,
		shift_id: shift?.id,
		opening_balance_cents: openingCents,
		denominations: denoms ?? undefined,
	});

	await auditLog(c, "cash.open", "cash_register", register?.id, { opening_balance_cents: openingCents, denominations: denoms });
	return c.json(register, 201);
});

cashRegisterRoutes.post("/:id/close", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const id = Number(c.req.param("id"));
	const register = await getRegisterById(c.env.DB, id);
	if (!register) return c.json({ error: "Register not found" }, 404);
	if (register.status === "closed") return c.json({ error: "Caixa já está fechado" }, 400);

	const body = await validateJson(c, cashCloseSchema);
	const closingDenoms = toDenomMap(body.denominations);
	const closingCents = closingDenoms ? denomTotal(closingDenoms) : (body.closing_balance_cents ?? 0);

	await closeRegister(c.env.DB, id, user.id, closingCents, closingDenoms ?? undefined);

	const updated = await getRegisterById(c.env.DB, id);
	await auditLog(c, "cash.close", "cash_register", id, {
		closing: closingCents,
		expected: updated?.expected_balance_cents,
		denominations: closingDenoms,
	});
	return c.json(updated);
});

cashRegisterRoutes.post("/:id/transactions", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const id = Number(c.req.param("id"));
	const register = await getRegisterById(c.env.DB, id);
	if (!register) return c.json({ error: "Register not found" }, 404);
	if (register.status === "closed") return c.json({ error: "Caixa fechado" }, 400);

	const body = await validateJson(c, cashTransactionSchema);

	if (body.type === "withdrawal" && !body.description?.trim()) {
		return c.json({ error: "Descricao obrigatoria para sangria" }, 400);
	}

	const txDenoms = toDenomMap(body.denominations);
	const amountCents = txDenoms ? denomTotal(txDenoms) : (body.amount_cents ?? 0);

	const tx = await addTransaction(c.env.DB, {
		cash_register_id: id,
		type: body.type,
		amount_cents: amountCents,
		description: body.description,
		recorded_by: user.id,
	});

	if (tx && txDenoms && body.type !== "adjustment") {
		const eventType = body.type === "deposit" ? "deposit" : "withdrawal";
		await saveDenominations(c.env.DB, {
			cash_register_id: id,
			cash_transaction_id: tx.id,
			event_type: eventType,
			denominations: txDenoms,
		});
	}

	await auditLog(c, "cash.transaction", "cash_register", id, { type: body.type, amount: amountCents, description: body.description, denominations: txDenoms });

	if (body.type === "withdrawal" && amountCents > 10000) {
		await auditLog(c, "cash.withdrawal_warning", "cash_register", id, {
			amount_cents: amountCents,
			description: body.description,
		});
	}

	return c.json(tx, 201);
});

cashRegisterRoutes.get("/:id/denominations", async (c) => {
	const inventory = await getDenominationInventory(c.env.DB, Number(c.req.param("id")));
	return c.json(inventory);
});

cashRegisterRoutes.post("/:id/calculate-change", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await validateJson(c, calculateChangeSchema);

	const payDenoms = toDenomMap(body.payment_denominations);
	const receivedCents = payDenoms ? denomTotal(payDenoms) : 0;
	const changeDue = receivedCents - body.amount_due_cents;

	if (changeDue <= 0) {
		return c.json({ change_cents: 0, denominations: {}, exact: true });
	}

	// Current inventory + the bills customer just handed over
	const currentInventory = await getDenominationInventory(c.env.DB, id);
	if (payDenoms) {
		for (const [cents, qty] of Object.entries(payDenoms)) {
			currentInventory[Number(cents)] = (currentInventory[Number(cents)] ?? 0) + (qty ?? 0);
		}
	}

	const changeDenoms = calculateChange(changeDue, currentInventory);

	return c.json({
		change_cents: changeDue,
		denominations: changeDenoms,
		exact: changeDenoms !== null,
	});
});
