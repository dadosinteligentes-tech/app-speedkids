import { describe, it, expect } from "vitest";
import { lighten, darken, generateBrandPalette } from "../../src/lib/color-utils";

describe("lighten", () => {
	it("lightens a known color", () => {
		const result = lighten("#000000", 0.5);
		// Black mixed 50% toward white → mid-gray
		expect(result).toBe("#808080");
	});

	it("returns the same color when amount is 0", () => {
		const result = lighten("#3366CC", 0);
		expect(result).toBe("#3366CC");
	});

	it("returns white when amount is 1", () => {
		const result = lighten("#3366CC", 1);
		expect(result).toBe("#FFFFFF");
	});

	it("handles lowercase hex input", () => {
		const result = lighten("#ff0000", 0);
		expect(result).toBe("#FF0000");
	});

	it("handles uppercase hex input", () => {
		const result = lighten("#FF0000", 0);
		expect(result).toBe("#FF0000");
	});
});

describe("darken", () => {
	it("darkens a known color", () => {
		const result = darken("#FFFFFF", 0.5);
		// White mixed 50% toward black → mid-gray
		expect(result).toBe("#808080");
	});

	it("returns the same color when amount is 0", () => {
		const result = darken("#3366CC", 0);
		expect(result).toBe("#3366CC");
	});

	it("returns black when amount is 1", () => {
		const result = darken("#3366CC", 1);
		expect(result).toBe("#000000");
	});

	it("handles lowercase hex input", () => {
		const result = darken("#ff0000", 0);
		expect(result).toBe("#FF0000");
	});

	it("handles uppercase hex input", () => {
		const result = darken("#FF0000", 0);
		expect(result).toBe("#FF0000");
	});
});

describe("generateBrandPalette", () => {
	it("returns object with DEFAULT, light, and dark properties", () => {
		const palette = generateBrandPalette("#2563EB");
		expect(palette).toHaveProperty("DEFAULT");
		expect(palette).toHaveProperty("light");
		expect(palette).toHaveProperty("dark");
	});

	it("sets DEFAULT to the input color (uppercased)", () => {
		const palette = generateBrandPalette("#2563eb");
		expect(palette.DEFAULT).toBe("#2563EB");
	});

	it("generates a lighter shade for light", () => {
		const palette = generateBrandPalette("#2563EB");
		// light should be closer to white than the original
		// Compare green channel: original G=0x63=99, light should be higher
		const lightG = parseInt(palette.light.slice(3, 5), 16);
		expect(lightG).toBeGreaterThan(99);
	});

	it("generates a darker shade for dark", () => {
		const palette = generateBrandPalette("#2563EB");
		// dark should be closer to black than the original
		// Compare green channel: original G=0x63=99, dark should be lower
		const darkG = parseInt(palette.dark.slice(3, 5), 16);
		expect(darkG).toBeLessThan(99);
	});
});
