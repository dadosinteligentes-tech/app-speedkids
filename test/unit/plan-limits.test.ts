import { describe, it, expect } from "vitest";
import { getLimitsForPlan, checkLimit, PLAN_LIMITS } from "../../src/lib/plan-limits";

describe("getLimitsForPlan", () => {
	it("returns correct limits for starter", () => {
		const limits = getLimitsForPlan("starter");
		expect(limits.maxUsers).toBe(3);
		expect(limits.maxAssets).toBe(15);
		expect(limits.label).toBe("Starter");
	});

	it("returns correct limits for pro", () => {
		const limits = getLimitsForPlan("pro");
		expect(limits.maxUsers).toBe(10);
		expect(limits.maxAssets).toBe(50);
		expect(limits.label).toBe("Pro");
	});

	it("returns correct limits for enterprise", () => {
		const limits = getLimitsForPlan("enterprise");
		expect(limits.maxUsers).toBe(999);
		expect(limits.maxAssets).toBe(999);
		expect(limits.label).toBe("Enterprise");
	});

	it("returns starter defaults for unknown plan", () => {
		const limits = getLimitsForPlan("unknown-plan");
		expect(limits).toEqual(PLAN_LIMITS.starter);
	});
});

describe("checkLimit", () => {
	it("returns allowed: true when under limit", () => {
		const result = checkLimit(2, 10, "usuarios");
		expect(result).toEqual({ allowed: true });
	});

	it("returns allowed: false with message when at limit", () => {
		const result = checkLimit(10, 10, "usuarios");
		expect(result.allowed).toBe(false);
		expect(result.message).toBeDefined();
		expect(result.message).toContain("usuarios");
		expect(result.message).toContain("10/10");
	});

	it("returns allowed: false when over limit", () => {
		const result = checkLimit(15, 10, "ativos");
		expect(result.allowed).toBe(false);
		expect(result.message).toContain("ativos");
		expect(result.message).toContain("15/10");
	});
});
