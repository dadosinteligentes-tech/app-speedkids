/**
 * Plan limits configuration and enforcement.
 */

export interface LoyaltyLimits {
	enabled: boolean;
	configurable: boolean;
	customBranding: boolean;
}

export interface PlanLimits {
	maxUsers: number;
	maxAssets: number;
	label: string;
	loyalty: LoyaltyLimits;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
	starter: { maxUsers: 3, maxAssets: 15, label: "Starter", loyalty: { enabled: true, configurable: false, customBranding: false } },
	pro: { maxUsers: 10, maxAssets: 50, label: "Pro", loyalty: { enabled: true, configurable: true, customBranding: false } },
	enterprise: { maxUsers: 999, maxAssets: 999, label: "Enterprise", loyalty: { enabled: true, configurable: true, customBranding: true } },
};

export function getLimitsForPlan(plan: string): PlanLimits {
	return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

export interface TenantUsage {
	userCount: number;
	assetCount: number;
}

export async function getTenantUsage(db: D1Database, tenantId: number): Promise<TenantUsage> {
	const [users, assets] = await Promise.all([
		db.prepare("SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ? AND active = 1").bind(tenantId).first<{ cnt: number }>(),
		db.prepare("SELECT COUNT(*) as cnt FROM assets WHERE tenant_id = ? AND status != 'retired'").bind(tenantId).first<{ cnt: number }>(),
	]);

	return {
		userCount: users?.cnt ?? 0,
		assetCount: assets?.cnt ?? 0,
	};
}

export function checkLimit(
	usage: number,
	max: number,
	resourceName: string,
): { allowed: boolean; message?: string } {
	if (usage >= max) {
		return {
			allowed: false,
			message: `Limite de ${resourceName} atingido (${usage}/${max}). Faca upgrade do seu plano.`,
		};
	}
	return { allowed: true };
}
