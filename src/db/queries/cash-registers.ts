import type { CashRegister, CashRegisterDenomination, CashTransaction } from "../schema";
import type { DenominationMap } from "../../lib/denominations";

export interface CashRegisterView extends CashRegister {
	opened_by_name: string;
	closed_by_name: string | null;
}

export interface CashTransactionView extends CashTransaction {
	recorded_by_name: string | null;
}

export async function openRegister(
	db: D1Database,
	params: { opened_by: number; shift_id?: number; opening_balance_cents: number; denominations?: DenominationMap; tenant_id: number },
): Promise<CashRegister | null> {
	const register = await db
		.prepare(`
			INSERT INTO cash_registers (opened_by, shift_id, opening_balance_cents, tenant_id)
			VALUES (?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.opened_by, params.shift_id ?? null, params.opening_balance_cents, params.tenant_id)
		.first<CashRegister>();

	if (register && params.denominations) {
		await saveDenominations(db, {
			cash_register_id: register.id,
			event_type: "opening",
			denominations: params.denominations,
		});
	}

	return register;
}

export async function closeRegister(
	db: D1Database,
	id: number,
	closedBy: number,
	closingBalanceCents: number,
	tenantId: number,
	closingDenominations?: DenominationMap,
): Promise<void> {
	// Calculate expected balance
	const expected = await calculateExpected(db, id);

	await db
		.prepare(`
			UPDATE cash_registers
			SET status = 'closed', closed_by = ?, closing_balance_cents = ?,
			    expected_balance_cents = ?, closed_at = datetime('now')
			WHERE id = ? AND status = 'open' AND tenant_id = ?
		`)
		.bind(closedBy, closingBalanceCents, expected, id, tenantId)
		.run();

	if (closingDenominations) {
		await saveDenominations(db, {
			cash_register_id: id,
			event_type: "closing",
			denominations: closingDenominations,
		});
	}
}

export async function getOpenRegister(db: D1Database, tenantId: number, userId?: number): Promise<CashRegisterView | null> {
	const query = userId
		? "SELECT cr.*, u1.name as opened_by_name, u2.name as closed_by_name FROM cash_registers cr JOIN users u1 ON cr.opened_by = u1.id LEFT JOIN users u2 ON cr.closed_by = u2.id WHERE cr.status = 'open' AND cr.tenant_id = ? AND cr.opened_by = ? ORDER BY cr.opened_at DESC LIMIT 1"
		: "SELECT cr.*, u1.name as opened_by_name, u2.name as closed_by_name FROM cash_registers cr JOIN users u1 ON cr.opened_by = u1.id LEFT JOIN users u2 ON cr.closed_by = u2.id WHERE cr.status = 'open' AND cr.tenant_id = ? ORDER BY cr.opened_at DESC LIMIT 1";

	return userId
		? db.prepare(query).bind(tenantId, userId).first<CashRegisterView>()
		: db.prepare(query).bind(tenantId).first<CashRegisterView>();
}

export async function getRegisterById(db: D1Database, id: number, tenantId: number): Promise<CashRegisterView | null> {
	return db
		.prepare(`
			SELECT cr.*, u1.name as opened_by_name, u2.name as closed_by_name
			FROM cash_registers cr
			JOIN users u1 ON cr.opened_by = u1.id
			LEFT JOIN users u2 ON cr.closed_by = u2.id
			WHERE cr.id = ? AND cr.tenant_id = ?
		`)
		.bind(id, tenantId)
		.first<CashRegisterView>();
}

export async function addTransaction(
	db: D1Database,
	params: {
		cash_register_id: number;
		rental_session_id?: string | null;
		product_sale_id?: number | null;
		type: CashTransaction["type"];
		amount_cents: number;
		payment_method?: string | null;
		description?: string | null;
		recorded_by?: number | null;
	},
): Promise<CashTransaction | null> {
	return db
		.prepare(`
			INSERT INTO cash_transactions (cash_register_id, rental_session_id, product_sale_id, type, amount_cents, payment_method, description, recorded_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(
			params.cash_register_id,
			params.rental_session_id ?? null,
			params.product_sale_id ?? null,
			params.type,
			params.amount_cents,
			params.payment_method ?? null,
			params.description ?? null,
			params.recorded_by ?? null,
		)
		.first<CashTransaction>();
}

export async function getTransactions(db: D1Database, registerId: number): Promise<CashTransactionView[]> {
	const { results } = await db
		.prepare(`
			SELECT ct.*, u.name as recorded_by_name
			FROM cash_transactions ct
			LEFT JOIN users u ON ct.recorded_by = u.id
			WHERE ct.cash_register_id = ?
			ORDER BY ct.created_at DESC
		`)
		.bind(registerId)
		.all<CashTransactionView>();
	return results;
}

export async function calculateExpected(db: D1Database, registerId: number): Promise<number> {
	const register = await db
		.prepare("SELECT opening_balance_cents FROM cash_registers WHERE id = ?")
		.bind(registerId)
		.first<{ opening_balance_cents: number }>();

	const sum = await db
		.prepare(`
			SELECT COALESCE(SUM(
				CASE
					WHEN type IN ('rental_payment', 'product_sale', 'deposit') AND (payment_method = 'cash' OR payment_method IS NULL) THEN amount_cents
					WHEN type = 'withdrawal' THEN -amount_cents
					WHEN type = 'adjustment' THEN amount_cents
					ELSE 0
				END
			), 0) as total
			FROM cash_transactions
			WHERE cash_register_id = ?
		`)
		.bind(registerId)
		.first<{ total: number }>();

	return (register?.opening_balance_cents ?? 0) + (sum?.total ?? 0);
}

export interface RegisterSummary {
	opening_balance_cents: number;
	cash_payments_cents: number;
	pix_payments_cents: number;
	debit_payments_cents: number;
	credit_payments_cents: number;
	courtesy_count: number;
	total_deposits_cents: number;
	total_withdrawals_cents: number;
	total_adjustments_cents: number;
	rental_count: number;
	product_sale_count: number;
	deposit_count: number;
	withdrawal_count: number;
	adjustment_count: number;
	expected_cash_cents: number;
}

export async function getRegisterSummary(db: D1Database, registerId: number): Promise<RegisterSummary> {
	const row = await db
		.prepare(`
			SELECT
				cr.opening_balance_cents,
				COALESCE(SUM(CASE WHEN ct.type IN ('rental_payment','product_sale') AND ct.payment_method='cash' THEN ct.amount_cents ELSE 0 END), 0) AS cash_payments_cents,
				COALESCE(SUM(CASE WHEN ct.type IN ('rental_payment','product_sale') AND ct.payment_method='pix' THEN ct.amount_cents ELSE 0 END), 0) AS pix_payments_cents,
				COALESCE(SUM(CASE WHEN ct.type IN ('rental_payment','product_sale') AND ct.payment_method='debit' THEN ct.amount_cents ELSE 0 END), 0) AS debit_payments_cents,
				COALESCE(SUM(CASE WHEN ct.type IN ('rental_payment','product_sale') AND ct.payment_method='credit' THEN ct.amount_cents ELSE 0 END), 0) AS credit_payments_cents,
				COUNT(CASE WHEN ct.type='rental_payment' AND ct.payment_method='courtesy' THEN 1 END) AS courtesy_count,
				COALESCE(SUM(CASE WHEN ct.type='deposit' THEN ct.amount_cents ELSE 0 END), 0) AS total_deposits_cents,
				COALESCE(SUM(CASE WHEN ct.type='withdrawal' THEN ct.amount_cents ELSE 0 END), 0) AS total_withdrawals_cents,
				COALESCE(SUM(CASE WHEN ct.type='adjustment' THEN ct.amount_cents ELSE 0 END), 0) AS total_adjustments_cents,
				COUNT(DISTINCT ct.rental_session_id) AS rental_count,
				COUNT(DISTINCT ct.product_sale_id) AS product_sale_count,
				COUNT(CASE WHEN ct.type='deposit' THEN 1 END) AS deposit_count,
				COUNT(CASE WHEN ct.type='withdrawal' THEN 1 END) AS withdrawal_count,
				COUNT(CASE WHEN ct.type='adjustment' THEN 1 END) AS adjustment_count
			FROM cash_registers cr
			LEFT JOIN cash_transactions ct ON ct.cash_register_id = cr.id
			WHERE cr.id = ?
			GROUP BY cr.id
		`)
		.bind(registerId)
		.first<Omit<RegisterSummary, "expected_cash_cents">>();

	const opening = row?.opening_balance_cents ?? 0;
	const cashPayments = row?.cash_payments_cents ?? 0;
	const deposits = row?.total_deposits_cents ?? 0;
	const withdrawals = row?.total_withdrawals_cents ?? 0;
	const adjustments = row?.total_adjustments_cents ?? 0;

	return {
		opening_balance_cents: opening,
		cash_payments_cents: cashPayments,
		pix_payments_cents: row?.pix_payments_cents ?? 0,
		debit_payments_cents: row?.debit_payments_cents ?? 0,
		credit_payments_cents: row?.credit_payments_cents ?? 0,
		courtesy_count: row?.courtesy_count ?? 0,
		total_deposits_cents: deposits,
		total_withdrawals_cents: withdrawals,
		total_adjustments_cents: adjustments,
		rental_count: row?.rental_count ?? 0,
		product_sale_count: row?.product_sale_count ?? 0,
		deposit_count: row?.deposit_count ?? 0,
		withdrawal_count: row?.withdrawal_count ?? 0,
		adjustment_count: row?.adjustment_count ?? 0,
		expected_cash_cents: opening + cashPayments + deposits - withdrawals + adjustments,
	};
}

export async function getRecentRegisters(db: D1Database, tenantId: number, limit = 20): Promise<CashRegisterView[]> {
	const { results } = await db
		.prepare(`
			SELECT cr.*, u1.name as opened_by_name, u2.name as closed_by_name
			FROM cash_registers cr
			JOIN users u1 ON cr.opened_by = u1.id
			LEFT JOIN users u2 ON cr.closed_by = u2.id
			WHERE cr.tenant_id = ?
			ORDER BY cr.opened_at DESC
			LIMIT ?
		`)
		.bind(tenantId, limit)
		.all<CashRegisterView>();
	return results;
}

// ── Denomination tracking ──────────────────────────────────────────────

export async function saveDenominations(
	db: D1Database,
	params: {
		cash_register_id: number;
		cash_transaction_id?: number | null;
		event_type: string;
		denominations: DenominationMap;
	},
): Promise<void> {
	const entries = Object.entries(params.denominations).filter(
		([, qty]) => (qty ?? 0) > 0,
	);
	if (entries.length === 0) return;

	const stmts = entries.map(([cents, qty]) =>
		db
			.prepare(
				`INSERT INTO cash_register_denominations
				 (cash_register_id, cash_transaction_id, event_type, denomination_cents, quantity)
				 VALUES (?, ?, ?, ?, ?)`,
			)
			.bind(
				params.cash_register_id,
				params.cash_transaction_id ?? null,
				params.event_type,
				Number(cents),
				qty,
			),
	);

	await db.batch(stmts);
}

export async function getDenominationInventory(
	db: D1Database,
	registerId: number,
): Promise<DenominationMap> {
	const { results } = await db
		.prepare(
			`SELECT denomination_cents,
				SUM(CASE WHEN event_type IN ('opening','payment_in','deposit') THEN quantity ELSE 0 END)
				- SUM(CASE WHEN event_type IN ('change_out','withdrawal') THEN quantity ELSE 0 END)
				AS net_quantity
			FROM cash_register_denominations
			WHERE cash_register_id = ?
			GROUP BY denomination_cents`,
		)
		.bind(registerId)
		.all<{ denomination_cents: number; net_quantity: number }>();

	const map: DenominationMap = {};
	for (const row of results) {
		map[row.denomination_cents] = Math.max(0, row.net_quantity);
	}
	return map;
}

export async function getDenominationEvents(
	db: D1Database,
	registerId: number,
): Promise<CashRegisterDenomination[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM cash_register_denominations
			 WHERE cash_register_id = ?
			 ORDER BY created_at ASC`,
		)
		.bind(registerId)
		.all<CashRegisterDenomination>();
	return results;
}
