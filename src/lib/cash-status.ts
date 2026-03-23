import { getOpenRegister, calculateExpected } from "../db/queries/cash-registers";

export interface CashStatusBadge {
	open: boolean;
	balance_cents?: number;
}

export async function getCashStatus(db: D1Database, tenantId: number): Promise<CashStatusBadge> {
	const register = await getOpenRegister(db, tenantId);
	if (register) {
		const balance = await calculateExpected(db, register.id);
		return { open: true, balance_cents: balance };
	}
	return { open: false };
}
