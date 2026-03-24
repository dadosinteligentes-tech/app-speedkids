import { describe, it, expect } from "vitest";
import {
	salesGoalSchema,
	salesGoalUpdateSchema,
	parseBody,
} from "../../src/lib/validation";

describe("salesGoalSchema", () => {
	const validGoal = {
		title: "Meta diaria de vendas",
		goal_type: "revenue" as const,
		period_type: "daily" as const,
		target_value: 50000,
		user_id: null,
		start_date: "2026-03-24",
		end_date: "2026-03-24",
	};

	it("accepts a valid goal", () => {
		const result = salesGoalSchema.safeParse(validGoal);
		expect(result.success).toBe(true);
	});

	it("accepts goal with user_id", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, user_id: 1 });
		expect(result.success).toBe(true);
	});

	it("accepts goal with null user_id (team-wide)", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, user_id: null });
		expect(result.success).toBe(true);
	});

	it("accepts all goal types", () => {
		for (const type of ["revenue", "rental_count", "product_sale_count"]) {
			const result = salesGoalSchema.safeParse({ ...validGoal, goal_type: type });
			expect(result.success).toBe(true);
		}
	});

	it("accepts all period types", () => {
		for (const period of ["daily", "weekly", "monthly", "custom"]) {
			const result = salesGoalSchema.safeParse({ ...validGoal, period_type: period });
			expect(result.success).toBe(true);
		}
	});

	it("rejects empty title", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, title: "" });
		expect(result.success).toBe(false);
	});

	it("rejects title over 100 chars", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, title: "A".repeat(101) });
		expect(result.success).toBe(false);
	});

	it("rejects invalid goal_type", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, goal_type: "invalid" });
		expect(result.success).toBe(false);
	});

	it("rejects invalid period_type", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, period_type: "hourly" });
		expect(result.success).toBe(false);
	});

	it("rejects target_value of zero", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, target_value: 0 });
		expect(result.success).toBe(false);
	});

	it("rejects negative target_value", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, target_value: -100 });
		expect(result.success).toBe(false);
	});

	it("rejects non-integer target_value", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, target_value: 50.5 });
		expect(result.success).toBe(false);
	});

	it("rejects invalid date format for start_date", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, start_date: "24/03/2026" });
		expect(result.success).toBe(false);
	});

	it("rejects invalid date format for end_date", () => {
		const result = salesGoalSchema.safeParse({ ...validGoal, end_date: "2026-3-24" });
		expect(result.success).toBe(false);
	});

	it("rejects missing required fields", () => {
		const result = salesGoalSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});

describe("salesGoalUpdateSchema", () => {
	it("accepts partial updates", () => {
		const result = salesGoalUpdateSchema.safeParse({ title: "Updated title" });
		expect(result.success).toBe(true);
	});

	it("accepts active toggle", () => {
		const result = salesGoalUpdateSchema.safeParse({ active: false });
		expect(result.success).toBe(true);
	});

	it("accepts target_value update", () => {
		const result = salesGoalUpdateSchema.safeParse({ target_value: 100000 });
		expect(result.success).toBe(true);
	});

	it("accepts date updates", () => {
		const result = salesGoalUpdateSchema.safeParse({
			start_date: "2026-04-01",
			end_date: "2026-04-30",
		});
		expect(result.success).toBe(true);
	});

	it("accepts empty object (no changes)", () => {
		const result = salesGoalUpdateSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("rejects invalid target_value", () => {
		const result = salesGoalUpdateSchema.safeParse({ target_value: -5 });
		expect(result.success).toBe(false);
	});

	it("rejects invalid date format", () => {
		const result = salesGoalUpdateSchema.safeParse({ start_date: "invalid" });
		expect(result.success).toBe(false);
	});
});

describe("parseBody with salesGoalSchema", () => {
	it("returns structured error for invalid input", () => {
		const result = parseBody(salesGoalSchema, {
			title: "",
			goal_type: "invalid",
			target_value: -1,
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeTruthy();
			expect(typeof result.error).toBe("string");
		}
	});
});

describe("goal progress calculation logic", () => {
	it("calculates percentage correctly", () => {
		const targetValue = 50000;
		const currentValue = 25000;
		const percentage = Math.min(Math.round((currentValue / targetValue) * 100), 100);
		expect(percentage).toBe(50);
	});

	it("caps percentage at 100", () => {
		const targetValue = 50000;
		const currentValue = 75000;
		const percentage = Math.min(Math.round((currentValue / targetValue) * 100), 100);
		expect(percentage).toBe(100);
	});

	it("handles zero target gracefully", () => {
		const targetValue = 0;
		const currentValue = 100;
		const percentage = targetValue > 0
			? Math.min(Math.round((currentValue / targetValue) * 100), 100)
			: 0;
		expect(percentage).toBe(0);
	});

	it("detects achievement when current >= target", () => {
		expect(50000 >= 50000).toBe(true);
		expect(60000 >= 50000).toBe(true);
		expect(49999 >= 50000).toBe(false);
	});
});

describe("UTC date boundary conversion for goals", () => {
	// Goals use Brazil timezone (UTC-3).
	// When querying DB, we convert:
	// from='2026-03-22' BRT → '2026-03-22 03:00:00' UTC
	// to  ='2026-03-22' BRT → '2026-03-23 03:00:00' UTC (exclusive upper bound)

	it("converts BRT start date to UTC correctly", () => {
		const from = "2026-03-22";
		// BRT 00:00 = UTC 03:00 same day
		const utcFrom = new Date(from + "T03:00:00Z");
		expect(utcFrom.toISOString()).toBe("2026-03-22T03:00:00.000Z");
	});

	it("converts BRT end date to UTC exclusive upper bound", () => {
		const to = "2026-03-22";
		// BRT end of day → next day 03:00 UTC
		const nextDay = new Date(to);
		nextDay.setDate(nextDay.getDate() + 1);
		const utcTo = new Date(nextDay.toISOString().slice(0, 10) + "T03:00:00Z");
		expect(utcTo.toISOString()).toBe("2026-03-23T03:00:00.000Z");
	});

	it("a UTC timestamp at 02:59 Mar 22 falls in BRT Mar 21", () => {
		// UTC 02:59 on Mar 22 = BRT 23:59 on Mar 21
		const utcTime = new Date("2026-03-22T02:59:00Z");
		const brtOffset = -3;
		const brtHour = utcTime.getUTCHours() + brtOffset;
		// This is -0.0167 hours, meaning it's the previous day in BRT
		expect(brtHour).toBeLessThan(0);
	});

	it("a UTC timestamp at 03:00 Mar 22 falls in BRT Mar 22", () => {
		// UTC 03:00 on Mar 22 = BRT 00:00 on Mar 22
		const utcTime = new Date("2026-03-22T03:00:00Z");
		const brtOffset = -3;
		const brtHour = utcTime.getUTCHours() + brtOffset;
		expect(brtHour).toBe(0);
	});

	it("daily goal covers full BRT day in UTC range", () => {
		// A daily goal for 2026-03-24 in BRT should cover:
		// From: 2026-03-24T03:00:00Z (BRT 00:00)
		// To:   2026-03-25T03:00:00Z (exclusive, BRT 00:00 next day)
		const goalDate = "2026-03-24";
		const utcFrom = goalDate + "T03:00:00Z";
		const utcTo = "2026-03-25T03:00:00Z";

		// A sale at BRT 15:00 (UTC 18:00) should be within range
		const saleTime = new Date("2026-03-24T18:00:00Z");
		expect(saleTime >= new Date(utcFrom)).toBe(true);
		expect(saleTime < new Date(utcTo)).toBe(true);
	});

	it("monthly goal covers full BRT month", () => {
		// March 2026 goal: start=2026-03-01, end=2026-03-31
		// UTC range: 2026-03-01T03:00:00Z to 2026-04-01T03:00:00Z
		const startUtc = new Date("2026-03-01T03:00:00Z");
		const endUtc = new Date("2026-04-01T03:00:00Z");

		// Sale on last day of March at BRT 23:00 (UTC 02:00 Apr 1)
		const lastDaySale = new Date("2026-04-01T02:00:00Z");
		expect(lastDaySale >= startUtc).toBe(true);
		expect(lastDaySale < endUtc).toBe(true);

		// Sale on Apr 1 at BRT 00:00 (UTC 03:00 Apr 1) should be excluded
		const nextMonthSale = new Date("2026-04-01T03:00:00Z");
		expect(nextMonthSale < endUtc).toBe(false);
	});
});
