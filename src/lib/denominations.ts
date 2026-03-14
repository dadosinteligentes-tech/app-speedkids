/**
 * Brazilian currency denomination constants and change calculation.
 */

export const DENOMINATIONS = [
	{ cents: 20000, label: "R$ 200", type: "note" as const },
	{ cents: 10000, label: "R$ 100", type: "note" as const },
	{ cents: 5000, label: "R$ 50", type: "note" as const },
	{ cents: 2000, label: "R$ 20", type: "note" as const },
	{ cents: 1000, label: "R$ 10", type: "note" as const },
	{ cents: 500, label: "R$ 5", type: "note" as const },
	{ cents: 200, label: "R$ 2", type: "note" as const },
	{ cents: 100, label: "R$ 1", type: "coin" as const },
	{ cents: 50, label: "R$ 0,50", type: "coin" as const },
	{ cents: 25, label: "R$ 0,25", type: "coin" as const },
	{ cents: 10, label: "R$ 0,10", type: "coin" as const },
	{ cents: 5, label: "R$ 0,05", type: "coin" as const },
] as const;

/** Denomination values in cents, sorted largest-first */
export const DENOM_VALUES = DENOMINATIONS.map((d) => d.cents);

/** Map from denomination cents to quantity */
export type DenominationMap = Partial<Record<number, number>>;

/** Compute total cents from a denomination map */
export function denomTotal(map: DenominationMap): number {
	let total = 0;
	for (const [cents, qty] of Object.entries(map)) {
		total += Number(cents) * (qty ?? 0);
	}
	return total;
}

/**
 * Greedy change algorithm with inventory awareness.
 *
 * Given change amount and current inventory, returns which bills/coins
 * to give back. Prioritizes largest denominations first (keeps smaller
 * ones in the register for future change).
 *
 * Returns null if exact change is impossible with available inventory.
 */
export function calculateChange(
	changeCents: number,
	inventory: DenominationMap,
): DenominationMap | null {
	if (changeCents <= 0) return {};

	let remaining = changeCents;
	const result: DenominationMap = {};

	for (const denom of DENOMINATIONS) {
		if (remaining <= 0) break;
		const available = inventory[denom.cents] ?? 0;
		if (available <= 0) continue;

		const needed = Math.floor(remaining / denom.cents);
		const use = Math.min(needed, available);
		if (use > 0) {
			result[denom.cents] = use;
			remaining -= use * denom.cents;
		}
	}

	if (remaining > 0) return null;
	return result;
}
