/**
 * PaymentService — Centralized payment recording logic.
 *
 * Eliminates the massive duplication across rental routes and product-sale routes.
 * All denomination conversions, transaction creation, and customer stats updates
 * happen here in one place.
 */
import type { DenominationMap } from "../lib/denominations";
import { denomTotal } from "../lib/denominations";
import { addTransaction, saveDenominations } from "../db/queries/cash-registers";
import { updateCustomerStats } from "../db/queries/customers";

// ── Types ──

export interface PaymentItem {
	method: string;
	amount_cents: number;
	payment_denominations?: Record<string, number>;
	change_denominations?: Record<string, number>;
}

export interface RecordPaymentParams {
	db: D1Database;
	tenantId: number;
	registerId: number;
	recordedBy: number | null;
	/** Link to rental or product sale */
	rentalSessionId?: string | null;
	productSaleId?: number | null;
	transactionType: "rental_payment" | "product_sale";
	/** Total amount in cents */
	amountCents: number;
	/** Single payment method (ignored when payments array provided) */
	paymentMethod?: string;
	/** For single cash payments */
	paymentDenominations?: Record<string, number>;
	changeDenominations?: Record<string, number>;
	/** Split payments (2+ items) */
	payments?: PaymentItem[];
	/** Customer to update stats for */
	customerId?: number | null;
}

// ── Helpers ──

/** Convert string-keyed denomination map from JSON to number-keyed DenominationMap */
export function toDenomMap(obj: Record<string, number> | undefined): DenominationMap | null {
	if (!obj) return null;
	const map: DenominationMap = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v > 0) map[Number(k)] = v;
	}
	return Object.keys(map).length > 0 ? map : null;
}

/** Record denomination entries for a cash transaction */
async function recordDenominations(
	db: D1Database,
	registerId: number,
	transactionId: number,
	paymentDenoms: Record<string, number> | undefined,
	changeDenoms: Record<string, number> | undefined,
): Promise<void> {
	const payMap = toDenomMap(paymentDenoms);
	if (payMap) {
		await saveDenominations(db, {
			cash_register_id: registerId,
			cash_transaction_id: transactionId,
			event_type: "payment_in",
			denominations: payMap,
		});
	}
	const changeMap = toDenomMap(changeDenoms);
	if (changeMap) {
		await saveDenominations(db, {
			cash_register_id: registerId,
			cash_transaction_id: transactionId,
			event_type: "change_out",
			denominations: changeMap,
		});
	}
}

// ── Main Service ──

/**
 * Records a payment against the cash register, handling:
 * - Single or split (mixed) payments
 * - Cash denomination tracking (payment_in + change_out)
 * - Customer stats update
 *
 * Skips transaction recording for courtesy and zero-amount payments.
 */
export async function recordPayment(params: RecordPaymentParams): Promise<void> {
	const {
		db,
		tenantId,
		registerId,
		recordedBy,
		rentalSessionId,
		productSaleId,
		transactionType,
		amountCents,
		paymentMethod,
		paymentDenominations,
		changeDenominations,
		payments,
		customerId,
	} = params;

	if (amountCents <= 0) {
		// Zero-amount or fully discounted — only update customer stats
		if (customerId) {
			await updateCustomerStats(db, tenantId, customerId, 0);
		}
		return;
	}

	const isSplit = payments && payments.length >= 2;

	if (isSplit) {
		// Split payment: record each portion as a separate transaction
		for (const payment of payments) {
			if (payment.amount_cents <= 0) continue;
			const tx = await addTransaction(db, {
				cash_register_id: registerId,
				rental_session_id: rentalSessionId ?? null,
				product_sale_id: productSaleId ?? null,
				type: transactionType,
				amount_cents: payment.amount_cents,
				payment_method: payment.method,
				recorded_by: recordedBy,
			});

			if (tx && payment.method === "cash") {
				await recordDenominations(
					db,
					registerId,
					tx.id,
					payment.payment_denominations,
					payment.change_denominations,
				);
			}
		}
	} else {
		// Single payment
		const isCourtesy = paymentMethod === "courtesy";
		if (isCourtesy) {
			// Courtesy: no cash transaction
		} else {
			const tx = await addTransaction(db, {
				cash_register_id: registerId,
				rental_session_id: rentalSessionId ?? null,
				product_sale_id: productSaleId ?? null,
				type: transactionType,
				amount_cents: amountCents,
				payment_method: paymentMethod ?? null,
				recorded_by: recordedBy,
			});

			if (tx && paymentMethod === "cash") {
				await recordDenominations(
					db,
					registerId,
					tx.id,
					paymentDenominations,
					changeDenominations,
				);
			}
		}
	}

	// Update customer stats
	if (customerId) {
		await updateCustomerStats(db, tenantId, customerId, amountCents);
	}
}

/**
 * Compute total from denomination map (convenience re-export for routes).
 */
export { denomTotal };
