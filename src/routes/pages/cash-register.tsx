import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getOpenRegister, getRegisterById, getTransactions, calculateExpected, getRegisterSummary, getDenominationEvents, getDenominationInventory } from "../../db/queries/cash-registers";
import { getActiveShift } from "../../db/queries/shifts";
import { getCashStatus } from "../../lib/cash-status";
import { CashRegisterPage } from "../../views/cash-register/open-close";
import { CashClosedSummary } from "../../views/cash-register/closed-summary";

export const cashRegisterPages = new Hono<AppEnv>();

cashRegisterPages.get("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.redirect("/login");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const tenantId = c.get("tenant_id");

	const register = await getOpenRegister(c.env.DB, tenantId);
	let transactions: Awaited<ReturnType<typeof getTransactions>> = [];
	let expectedCents = 0;
	let summary: Awaited<ReturnType<typeof getRegisterSummary>> | null = null;

	if (register) {
		[transactions, expectedCents, summary] = await Promise.all([
			getTransactions(c.env.DB, register.id),
			calculateExpected(c.env.DB, register.id),
			getRegisterSummary(c.env.DB, register.id),
		]);
	}

	const [shift, cashStatus] = await Promise.all([
		getActiveShift(c.env.DB, tenantId, user.id),
		getCashStatus(c.env.DB, tenantId),
	]);

	return c.html(
		<CashRegisterPage
			register={register}
			transactions={transactions}
			expectedCents={expectedCents}
			summary={summary}
			shift={shift}
			user={user}
			cashStatus={cashStatus}
			tenant={tenant}
		isPlatformAdmin={isPlatformAdmin}
		/>,
	);
});

cashRegisterPages.get("/closed/:id", async (c) => {
	const user = c.get("user");
	if (!user) return c.redirect("/login");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const tenantId = c.get("tenant_id");

	const id = Number(c.req.param("id"));
	const [register, transactions, summary, denomEvents, denomInventory] = await Promise.all([
		getRegisterById(c.env.DB, id, tenantId),
		getTransactions(c.env.DB, id),
		getRegisterSummary(c.env.DB, id),
		getDenominationEvents(c.env.DB, id),
		getDenominationInventory(c.env.DB, id),
	]);

	if (!register) return c.redirect("/cash");

	const cashStatus = await getCashStatus(c.env.DB, tenantId);

	return c.html(
		<CashClosedSummary
			register={register}
			transactions={transactions}
			summary={summary}
			denomEvents={denomEvents}
			denomInventory={denomInventory}
			user={user}
			cashStatus={cashStatus}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin}
		/>,
	);
});
