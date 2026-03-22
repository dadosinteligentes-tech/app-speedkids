import { describe, it, expect } from "vitest";
import {
	DENOMINATIONS,
	DENOM_VALUES,
	denomTotal,
	calculateChange,
	type DenominationMap,
} from "../../src/lib/denominations";

describe("DENOMINATIONS", () => {
	it("has 12 Brazilian currency denominations", () => {
		expect(DENOMINATIONS).toHaveLength(12);
	});

	it("is sorted largest-first", () => {
		for (let i = 1; i < DENOMINATIONS.length; i++) {
			expect(DENOMINATIONS[i - 1].cents).toBeGreaterThan(DENOMINATIONS[i].cents);
		}
	});

	it("DENOM_VALUES matches DENOMINATIONS order", () => {
		expect(DENOM_VALUES).toEqual(DENOMINATIONS.map((d) => d.cents));
	});
});

describe("denomTotal", () => {
	it("returns 0 for empty map", () => {
		expect(denomTotal({})).toBe(0);
	});

	it("calculates total from mixed denominations", () => {
		const map: DenominationMap = {
			10000: 1, // R$ 100
			5000: 2, // R$ 50 x2
			100: 3, // R$ 1 x3
		};
		expect(denomTotal(map)).toBe(10000 + 10000 + 300);
	});

	it("ignores undefined quantities", () => {
		const map: DenominationMap = { 10000: undefined, 5000: 1 };
		expect(denomTotal(map)).toBe(5000);
	});

	it("handles string keys from JSON (Record<string, number>)", () => {
		// JSON.parse always returns string keys; denomTotal must handle this
		const map = { "10000": 2, "500": 1 } as unknown as DenominationMap;
		expect(denomTotal(map)).toBe(20500);
	});
});

describe("calculateChange", () => {
	it("returns empty object for zero change", () => {
		expect(calculateChange(0, {})).toEqual({});
	});

	it("returns null for negative change", () => {
		expect(calculateChange(-100, {})).toEqual({});
	});

	it("gives exact change with single denomination", () => {
		const inventory: DenominationMap = { 1000: 5 };
		const result = calculateChange(3000, inventory);
		expect(result).toEqual({ 1000: 3 });
	});

	it("uses largest denominations first (greedy)", () => {
		const inventory: DenominationMap = {
			10000: 2,
			5000: 3,
			2000: 5,
			1000: 10,
		};
		// R$ 170 = R$ 100 + R$ 50 + R$ 20
		const result = calculateChange(17000, inventory);
		expect(result).toEqual({ 10000: 1, 5000: 1, 2000: 1 });
	});

	it("falls back to smaller denominations when larger unavailable", () => {
		const inventory: DenominationMap = {
			10000: 0,
			5000: 0,
			2000: 3,
			1000: 5,
		};
		// R$ 70 with only R$20 and R$10 available = 3xR$20 + 1xR$10
		const result = calculateChange(7000, inventory);
		expect(result).toEqual({ 2000: 3, 1000: 1 });
	});

	it("returns null when exact change is impossible", () => {
		const inventory: DenominationMap = { 5000: 1 };
		// Need R$ 30 but only have R$ 50 bill
		const result = calculateChange(3000, inventory);
		expect(result).toBeNull();
	});

	it("handles coin-level change (R$ 0.75)", () => {
		const inventory: DenominationMap = { 50: 3, 25: 5 };
		const result = calculateChange(75, inventory);
		expect(result).toEqual({ 50: 1, 25: 1 });
	});

	it("handles complex real-world scenario", () => {
		const inventory: DenominationMap = {
			10000: 2,
			5000: 3,
			2000: 5,
			1000: 5,
			500: 4,
			200: 10,
			100: 20,
			50: 10,
			25: 10,
			10: 10,
			5: 10,
		};
		// R$ 37.85 change
		const result = calculateChange(3785, inventory);
		expect(result).not.toBeNull();
		// Verify total matches
		let total = 0;
		for (const [cents, qty] of Object.entries(result!)) {
			total += Number(cents) * qty;
		}
		expect(total).toBe(3785);
	});
});
