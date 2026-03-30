import type { LoyaltyConfig, LoyaltyTransaction, LoyaltyTier, LoyaltyRedemptionOption } from "../schema";

export interface LoyaltyConfigView extends Omit<LoyaltyConfig, "tiers_json" | "redemption_options_json"> {
	tiers: LoyaltyTier[];
	redemption_options: LoyaltyRedemptionOption[];
}

function parseConfig(row: LoyaltyConfig): LoyaltyConfigView {
	let tiers: LoyaltyTier[] = [];
	let redemption_options: LoyaltyRedemptionOption[] = [];
	try { if (row.tiers_json) tiers = JSON.parse(row.tiers_json); } catch { /* ignore */ }
	try { if (row.redemption_options_json) redemption_options = JSON.parse(row.redemption_options_json); } catch { /* ignore */ }
	return { ...row, tiers, redemption_options };
}

const DEFAULT_CONFIG: LoyaltyConfigView = {
	id: 0,
	tenant_id: 0,
	enabled: 0,
	points_per_real: 1,
	min_redemption_points: 100,
	points_value_cents: 1,
	tiers: [],
	expiry_months: 0,
	bonus_first_purchase: 0,
	bonus_birthday: 0,
	bonus_referral: 0,
	double_points_weekends: 0,
	redemption_options: [],
	created_at: "",
	updated_at: "",
};

export async function getLoyaltyConfig(db: D1Database, tenantId: number): Promise<LoyaltyConfigView> {
	const row = await db
		.prepare("SELECT * FROM loyalty_config WHERE tenant_id = ?")
		.bind(tenantId)
		.first<LoyaltyConfig>();
	if (!row) return { ...DEFAULT_CONFIG, tenant_id: tenantId };
	return parseConfig(row);
}

export async function upsertLoyaltyConfig(
	db: D1Database,
	tenantId: number,
	data: {
		enabled?: boolean;
		points_per_real?: number;
		min_redemption_points?: number;
		points_value_cents?: number;
		tiers?: LoyaltyTier[];
		expiry_months?: number;
		bonus_first_purchase?: number;
		bonus_birthday?: number;
		bonus_referral?: number;
		double_points_weekends?: boolean;
		redemption_options?: LoyaltyRedemptionOption[];
	},
): Promise<void> {
	const existing = await db
		.prepare("SELECT id FROM loyalty_config WHERE tenant_id = ?")
		.bind(tenantId)
		.first();

	if (existing) {
		const sets: string[] = [];
		const vals: (string | number | null)[] = [];

		if (data.enabled !== undefined) { sets.push("enabled = ?"); vals.push(data.enabled ? 1 : 0); }
		if (data.points_per_real !== undefined) { sets.push("points_per_real = ?"); vals.push(data.points_per_real); }
		if (data.min_redemption_points !== undefined) { sets.push("min_redemption_points = ?"); vals.push(data.min_redemption_points); }
		if (data.points_value_cents !== undefined) { sets.push("points_value_cents = ?"); vals.push(data.points_value_cents); }
		if (data.tiers !== undefined) { sets.push("tiers_json = ?"); vals.push(JSON.stringify(data.tiers)); }
		if (data.expiry_months !== undefined) { sets.push("expiry_months = ?"); vals.push(data.expiry_months); }
		if (data.bonus_first_purchase !== undefined) { sets.push("bonus_first_purchase = ?"); vals.push(data.bonus_first_purchase); }
		if (data.bonus_birthday !== undefined) { sets.push("bonus_birthday = ?"); vals.push(data.bonus_birthday); }
		if (data.bonus_referral !== undefined) { sets.push("bonus_referral = ?"); vals.push(data.bonus_referral); }
		if (data.double_points_weekends !== undefined) { sets.push("double_points_weekends = ?"); vals.push(data.double_points_weekends ? 1 : 0); }
		if (data.redemption_options !== undefined) { sets.push("redemption_options_json = ?"); vals.push(JSON.stringify(data.redemption_options)); }

		if (sets.length === 0) return;
		sets.push("updated_at = datetime('now')");
		vals.push(tenantId);

		await db.prepare(`UPDATE loyalty_config SET ${sets.join(", ")} WHERE tenant_id = ?`).bind(...vals).run();
	} else {
		await db
			.prepare(`
				INSERT INTO loyalty_config (tenant_id, enabled, points_per_real, min_redemption_points, points_value_cents, tiers_json, expiry_months, bonus_first_purchase, bonus_birthday, bonus_referral, double_points_weekends, redemption_options_json)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`)
			.bind(
				tenantId,
				data.enabled ? 1 : 0,
				data.points_per_real ?? 1,
				data.min_redemption_points ?? 100,
				data.points_value_cents ?? 1,
				data.tiers ? JSON.stringify(data.tiers) : null,
				data.expiry_months ?? 0,
				data.bonus_first_purchase ?? 0,
				data.bonus_birthday ?? 0,
				data.bonus_referral ?? 0,
				data.double_points_weekends ? 1 : 0,
				data.redemption_options ? JSON.stringify(data.redemption_options) : null,
			)
			.run();
	}
}

export async function addLoyaltyTransaction(
	db: D1Database,
	tenantId: number,
	customerId: number,
	type: "earned" | "redeemed" | "adjusted" | "expired",
	points: number,
	refType?: string | null,
	refId?: string | null,
	description?: string | null,
	recordedBy?: number | null,
): Promise<{ balanceAfter: number }> {
	const updated = await db
		.prepare("UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ? RETURNING loyalty_points")
		.bind(points, customerId, tenantId)
		.first<{ loyalty_points: number }>();

	const balanceAfter = updated?.loyalty_points ?? 0;

	await db
		.prepare(`
			INSERT INTO loyalty_transactions (tenant_id, customer_id, type, points, balance_after, reference_type, reference_id, description, recorded_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(tenantId, customerId, type, points, balanceAfter, refType ?? null, refId ?? null, description ?? null, recordedBy ?? null)
		.run();

	return { balanceAfter };
}

export async function getCustomerLoyaltyBalance(db: D1Database, tenantId: number, customerId: number): Promise<number> {
	const row = await db
		.prepare("SELECT loyalty_points FROM customers WHERE id = ? AND tenant_id = ?")
		.bind(customerId, tenantId)
		.first<{ loyalty_points: number }>();
	return row?.loyalty_points ?? 0;
}

export async function getCustomerTransactions(
	db: D1Database,
	tenantId: number,
	customerId: number,
	limit = 20,
	offset = 0,
): Promise<LoyaltyTransaction[]> {
	const { results } = await db
		.prepare("SELECT * FROM loyalty_transactions WHERE tenant_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
		.bind(tenantId, customerId, limit, offset)
		.all<LoyaltyTransaction>();
	return results;
}

export async function getRecentTransactions(
	db: D1Database,
	tenantId: number,
	limit = 50,
): Promise<(LoyaltyTransaction & { customer_name: string })[]> {
	const { results } = await db
		.prepare(`
			SELECT lt.*, c.name as customer_name
			FROM loyalty_transactions lt
			JOIN customers c ON c.id = lt.customer_id AND c.tenant_id = lt.tenant_id
			WHERE lt.tenant_id = ?
			ORDER BY lt.created_at DESC
			LIMIT ?
		`)
		.bind(tenantId, limit)
		.all();
	return results as any[];
}

export async function getLoyaltyStats(db: D1Database, tenantId: number): Promise<{
	totalEarned: number;
	totalRedeemed: number;
	activeCustomers: number;
	verifiedCustomers: number;
	totalCustomersWithEmail: number;
	earnedThisMonth: number;
	redeemedThisMonth: number;
}> {
	const [earned, redeemed, active, verified, withEmail, earnedMonth, redeemedMonth] = await Promise.all([
		db.prepare("SELECT COALESCE(SUM(points), 0) as total FROM loyalty_transactions WHERE tenant_id = ? AND type = 'earned'")
			.bind(tenantId).first<{ total: number }>(),
		db.prepare("SELECT COALESCE(SUM(ABS(points)), 0) as total FROM loyalty_transactions WHERE tenant_id = ? AND type = 'redeemed'")
			.bind(tenantId).first<{ total: number }>(),
		db.prepare("SELECT COUNT(DISTINCT customer_id) as cnt FROM loyalty_transactions WHERE tenant_id = ?")
			.bind(tenantId).first<{ cnt: number }>(),
		db.prepare("SELECT COUNT(*) as cnt FROM customers WHERE tenant_id = ? AND email_verified = 1")
			.bind(tenantId).first<{ cnt: number }>(),
		db.prepare("SELECT COUNT(*) as cnt FROM customers WHERE tenant_id = ? AND email IS NOT NULL AND email != ''")
			.bind(tenantId).first<{ cnt: number }>(),
		db.prepare("SELECT COALESCE(SUM(points), 0) as total FROM loyalty_transactions WHERE tenant_id = ? AND type = 'earned' AND created_at >= date('now', 'start of month')")
			.bind(tenantId).first<{ total: number }>(),
		db.prepare("SELECT COALESCE(SUM(ABS(points)), 0) as total FROM loyalty_transactions WHERE tenant_id = ? AND type = 'redeemed' AND created_at >= date('now', 'start of month')")
			.bind(tenantId).first<{ total: number }>(),
	]);

	return {
		totalEarned: earned?.total ?? 0,
		totalRedeemed: redeemed?.total ?? 0,
		activeCustomers: active?.cnt ?? 0,
		verifiedCustomers: verified?.cnt ?? 0,
		totalCustomersWithEmail: withEmail?.cnt ?? 0,
		earnedThisMonth: earnedMonth?.total ?? 0,
		redeemedThisMonth: redeemedMonth?.total ?? 0,
	};
}

export async function getLoyaltyRanking(db: D1Database, tenantId: number, limit = 20): Promise<{
	id: number;
	name: string;
	email: string | null;
	phone: string | null;
	loyalty_points: number;
	total_spent_cents: number;
	total_rentals: number;
	email_verified: number;
}[]> {
	const { results } = await db
		.prepare(`
			SELECT id, name, email, phone, loyalty_points, total_spent_cents, total_rentals, email_verified
			FROM customers
			WHERE tenant_id = ? AND loyalty_points > 0
			ORDER BY loyalty_points DESC
			LIMIT ?
		`)
		.bind(tenantId, limit)
		.all();
	return results as any[];
}

export async function markEmailVerified(db: D1Database, tenantId: number, customerId: number): Promise<void> {
	await db
		.prepare("UPDATE customers SET email_verified = 1, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
		.bind(customerId, tenantId)
		.run();
}
