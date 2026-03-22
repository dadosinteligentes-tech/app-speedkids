import { describe, it, expect } from "vitest";
import { toDenomMap } from "../../src/services/payment";

describe("toDenomMap", () => {
	it("returns null for undefined input", () => {
		expect(toDenomMap(undefined)).toBeNull();
	});

	it("returns null for empty map after filtering zeros", () => {
		expect(toDenomMap({ "10000": 0, "5000": 0 })).toBeNull();
	});

	it("converts string keys to number keys", () => {
		const result = toDenomMap({ "10000": 2, "5000": 1 });
		expect(result).toEqual({ 10000: 2, 5000: 1 });
	});

	it("filters out zero and negative values", () => {
		const result = toDenomMap({ "10000": 3, "5000": 0, "2000": -1 });
		expect(result).toEqual({ 10000: 3 });
	});

	it("returns null when all values are zero", () => {
		expect(toDenomMap({ "10000": 0 })).toBeNull();
	});
});
