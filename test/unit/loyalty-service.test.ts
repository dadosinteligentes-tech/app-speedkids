import { describe, it, expect } from "vitest";
import { getCustomerTier } from "../../src/services/loyalty";
import { getLimitsForPlan } from "../../src/lib/plan-limits";

describe("getCustomerTier", () => {
	const tiers = [
		{ name: "Bronze", min_points: 0 },
		{ name: "Prata", min_points: 500 },
		{ name: "Ouro", min_points: 2000 },
		{ name: "Diamante", min_points: 5000 },
	];

	it("returns null for empty tiers", () => {
		expect(getCustomerTier(100, [])).toBeNull();
	});

	it("returns null for undefined tiers", () => {
		expect(getCustomerTier(100, undefined as any)).toBeNull();
	});

	it("returns Bronze for 0 points", () => {
		expect(getCustomerTier(0, tiers)?.name).toBe("Bronze");
	});

	it("returns Bronze for 499 points", () => {
		expect(getCustomerTier(499, tiers)?.name).toBe("Bronze");
	});

	it("returns Prata for exactly 500 points", () => {
		expect(getCustomerTier(500, tiers)?.name).toBe("Prata");
	});

	it("returns Prata for 501 points", () => {
		expect(getCustomerTier(501, tiers)?.name).toBe("Prata");
	});

	it("returns Ouro for 2000 points", () => {
		expect(getCustomerTier(2000, tiers)?.name).toBe("Ouro");
	});

	it("returns Diamante for 10000 points", () => {
		expect(getCustomerTier(10000, tiers)?.name).toBe("Diamante");
	});

	it("handles single tier", () => {
		expect(getCustomerTier(0, [{ name: "Único", min_points: 0 }])?.name).toBe("Único");
	});

	it("handles unsorted tiers", () => {
		const unsorted = [
			{ name: "Ouro", min_points: 2000 },
			{ name: "Bronze", min_points: 0 },
			{ name: "Prata", min_points: 500 },
		];
		expect(getCustomerTier(1000, unsorted)?.name).toBe("Prata");
	});
});

describe("plan loyalty limits", () => {
	it("starter has loyalty enabled but not configurable", () => {
		const limits = getLimitsForPlan("starter");
		expect(limits.loyalty.enabled).toBe(true);
		expect(limits.loyalty.configurable).toBe(false);
		expect(limits.loyalty.customBranding).toBe(false);
	});

	it("pro has loyalty enabled and configurable", () => {
		const limits = getLimitsForPlan("pro");
		expect(limits.loyalty.enabled).toBe(true);
		expect(limits.loyalty.configurable).toBe(true);
		expect(limits.loyalty.customBranding).toBe(false);
	});

	it("enterprise has full loyalty", () => {
		const limits = getLimitsForPlan("enterprise");
		expect(limits.loyalty.enabled).toBe(true);
		expect(limits.loyalty.configurable).toBe(true);
		expect(limits.loyalty.customBranding).toBe(true);
	});

	it("unknown plan defaults to starter", () => {
		const limits = getLimitsForPlan("nonexistent");
		expect(limits.loyalty.enabled).toBe(true);
		expect(limits.loyalty.configurable).toBe(false);
	});

	it("empty string plan defaults to starter", () => {
		const limits = getLimitsForPlan("");
		expect(limits.loyalty.configurable).toBe(false);
	});
});
