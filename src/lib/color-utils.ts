/**
 * Color utilities for generating dynamic brand palettes from a hex color.
 */

/** Parse a hex color (#RRGGBB or #RGB) into [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	const full = h.length === 3
		? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
		: h;
	return [
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16),
	];
}

/** Convert [r, g, b] back to #RRGGBB */
function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return (
		"#" +
		[clamp(r), clamp(g), clamp(b)]
			.map((c) => c.toString(16).padStart(2, "0"))
			.join("")
			.toUpperCase()
	);
}

/**
 * Mix a color with white by `amount` (0–1).
 * amount=0 returns original, amount=1 returns white.
 */
export function lighten(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(
		r + (255 - r) * amount,
		g + (255 - g) * amount,
		b + (255 - b) * amount,
	);
}

/**
 * Mix a color with black by `amount` (0–1).
 * amount=0 returns original, amount=1 returns black.
 */
export function darken(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * Generate a brand palette from a single hex color.
 * Returns DEFAULT, light (for backgrounds), and dark (for hover/emphasis).
 */
export function generateBrandPalette(hex: string): {
	DEFAULT: string;
	light: string;
	dark: string;
} {
	return {
		DEFAULT: hex.toUpperCase(),
		light: lighten(hex, 0.85),
		dark: darken(hex, 0.25),
	};
}
