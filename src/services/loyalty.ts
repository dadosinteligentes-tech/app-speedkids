import { getLoyaltyConfig, addLoyaltyTransaction, getCustomerLoyaltyBalance } from "../db/queries/loyalty";
import { getLimitsForPlan } from "../lib/plan-limits";
import type { LoyaltyTier } from "../db/schema";

/**
 * Award loyalty points after a payment.
 * Only awards if: loyalty enabled for tenant, customer has verified email, plan allows loyalty.
 */
export async function awardLoyaltyPoints(
	db: D1Database,
	tenantId: number,
	customerId: number,
	amountCents: number,
	refType: string,
	refId: string | null,
	tenantPlan?: string,
): Promise<{ awarded: number; balance: number } | null> {
	// Check plan allows loyalty
	if (tenantPlan) {
		const limits = getLimitsForPlan(tenantPlan);
		if (!limits.loyalty.enabled) return null;
	}

	// Check customer is email-verified
	const customer = await db
		.prepare("SELECT email_verified FROM customers WHERE id = ? AND tenant_id = ?")
		.bind(customerId, tenantId)
		.first<{ email_verified: number }>();

	if (!customer || !customer.email_verified) return null;

	// Get loyalty config
	const config = await getLoyaltyConfig(db, tenantId);
	if (!config.enabled) return null;

	// Calculate points
	const reais = Math.floor(amountCents / 100);
	const points = reais * config.points_per_real;
	if (points <= 0) return null;

	const { balanceAfter } = await addLoyaltyTransaction(
		db, tenantId, customerId,
		"earned", points,
		refType, refId,
		`${points} pontos por pagamento de R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`,
	);

	return { awarded: points, balance: balanceAfter };
}

/**
 * Redeem loyalty points as a discount.
 * Returns the discount amount in cents.
 */
export async function redeemLoyaltyPoints(
	db: D1Database,
	tenantId: number,
	customerId: number,
	pointsToRedeem: number,
	refType: string,
	refId: string | null,
	recordedBy: number | null,
): Promise<{ discountCents: number; pointsRedeemed: number }> {
	const config = await getLoyaltyConfig(db, tenantId);
	if (!config.enabled) throw new Error("Programa de fidelidade não está ativo");

	if (pointsToRedeem < config.min_redemption_points) {
		throw new Error(`Mínimo de ${config.min_redemption_points} pontos para resgate`);
	}

	const balance = await getCustomerLoyaltyBalance(db, tenantId, customerId);
	if (balance < pointsToRedeem) {
		throw new Error(`Saldo insuficiente: ${balance} pontos disponíveis`);
	}

	// Check email verified
	const customer = await db
		.prepare("SELECT email_verified FROM customers WHERE id = ? AND tenant_id = ?")
		.bind(customerId, tenantId)
		.first<{ email_verified: number }>();

	if (!customer?.email_verified) {
		throw new Error("Email não verificado");
	}

	const discountCents = pointsToRedeem * config.points_value_cents;

	await addLoyaltyTransaction(
		db, tenantId, customerId,
		"redeemed", -pointsToRedeem,
		refType, refId,
		`Resgate de ${pointsToRedeem} pontos = R$ ${(discountCents / 100).toFixed(2).replace(".", ",")} de desconto`,
		recordedBy,
	);

	return { discountCents, pointsRedeemed: pointsToRedeem };
}

/**
 * Get customer's current tier based on accumulated points.
 */
export function getCustomerTier(points: number, tiers: LoyaltyTier[]): LoyaltyTier | null {
	if (!tiers || tiers.length === 0) return null;
	const sorted = [...tiers].sort((a, b) => b.min_points - a.min_points);
	return sorted.find((t) => points >= t.min_points) ?? null;
}
