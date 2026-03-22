import { describe, it, expect } from "vitest";
import {
	toBrazilDateTime,
	toBrazilDate,
	toBrazilTime,
	todayBrazilISO,
	daysAgoBrazilISO,
} from "../../src/lib/timezone";

describe("toBrazilDateTime", () => {
	it("converts UTC noon to Brazil morning (UTC-3)", () => {
		const result = toBrazilDateTime("2026-03-22T12:00:00Z");
		expect(result).toBe("22/03/2026, 09:00");
	});

	it("handles UTC midnight → previous day in Brazil", () => {
		const result = toBrazilDateTime("2026-03-22T00:00:00Z");
		// UTC 00:00 = BRT 21:00 of previous day
		expect(result).toBe("21/03/2026, 21:00");
	});

	it("handles UTC 03:00 → midnight in Brazil", () => {
		const result = toBrazilDateTime("2026-03-22T03:00:00Z");
		expect(result).toBe("22/03/2026, 00:00");
	});
});

describe("toBrazilDate", () => {
	it("formats date in dd/mm/yyyy", () => {
		const result = toBrazilDate("2026-03-22T15:00:00Z");
		expect(result).toBe("22/03/2026");
	});

	it("handles day boundary correctly", () => {
		// UTC 02:00 on Mar 22 = BRT 23:00 on Mar 21
		const result = toBrazilDate("2026-03-22T02:00:00Z");
		expect(result).toBe("21/03/2026");
	});
});

describe("toBrazilTime", () => {
	it("formats time in HH:mm", () => {
		const result = toBrazilTime("2026-03-22T15:30:00Z");
		expect(result).toBe("12:30");
	});
});

describe("todayBrazilISO", () => {
	it("returns YYYY-MM-DD format", () => {
		const result = todayBrazilISO();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("daysAgoBrazilISO", () => {
	it("returns YYYY-MM-DD format", () => {
		const result = daysAgoBrazilISO(7);
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns a date earlier than today", () => {
		const today = todayBrazilISO();
		const weekAgo = daysAgoBrazilISO(7);
		expect(new Date(weekAgo).getTime()).toBeLessThan(new Date(today).getTime());
	});

	it("0 days ago is today", () => {
		expect(daysAgoBrazilISO(0)).toBe(todayBrazilISO());
	});
});
