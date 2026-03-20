import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireRole } from "../../middleware/require-role";
import { todayISO, daysAgoISO } from "../../lib/report-utils";
import {
	getFinancialSummary,
	getDailyRevenueTrend,
	getProductSalesSummary,
	getPackageRevenue,
	getAssetUtilization,
	getPeakHours,
	getOperatorPerformance,
	getCashReconciliation,
	getCustomerAnalysis,
	getUnpaidSessions,
	getCancelledSessions,
	getShiftReport,
	getDetailSessions,
	getProductRevenue,
	getProductSaleDetail,
	type DetailFilter,
} from "../../db/queries/reports";
import { FinancialSummaryView } from "../../views/reports/financial-summary";
import { PackageRevenueView } from "../../views/reports/package-revenue";
import { AssetUtilizationView } from "../../views/reports/asset-utilization";
import { PeakHoursView } from "../../views/reports/peak-hours";
import { OperatorPerformanceView } from "../../views/reports/operator-performance";
import { CashReconciliationView } from "../../views/reports/cash-reconciliation";
import { CustomerAnalysisView } from "../../views/reports/customer-analysis";
import { UnpaidReportView } from "../../views/reports/unpaid";
import { CancelledReportView } from "../../views/reports/cancelled";
import { ShiftReportView } from "../../views/reports/shift-report";
import { ReportDetailView } from "../../views/reports/detail";
import { ProductSalesReportView } from "../../views/reports/product-sales";
import { ProductSaleDetailView } from "../../views/reports/product-sale-detail";

export const reportPages = new Hono<AppEnv>();

reportPages.use("*", requireRole("manager", "owner"));

function getDateRange(c: { req: { query: (k: string) => string | undefined } }): {
	from: string;
	to: string;
} {
	const from = c.req.query("from") ?? daysAgoISO(30);
	const to = c.req.query("to") ?? todayISO();
	return { from, to };
}

// Redirect /admin/reports → /admin/reports/financial
reportPages.get("/", (c) => {
	const { from, to } = getDateRange(c);
	return c.redirect(`/admin/reports/financial?from=${from}&to=${to}`);
});

reportPages.get("/financial", async (c) => {
	const { from, to } = getDateRange(c);
	const [summary, trend, productSales] = await Promise.all([
		getFinancialSummary(c.env.DB, from, to),
		getDailyRevenueTrend(c.env.DB, from, to),
		getProductSalesSummary(c.env.DB, from, to),
	]);
	return c.html(
		<FinancialSummaryView
			summary={summary}
			productSales={productSales}
			trend={trend}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/packages", async (c) => {
	const { from, to } = getDateRange(c);
	const packages = await getPackageRevenue(c.env.DB, from, to);
	return c.html(
		<PackageRevenueView
			packages={packages}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/assets", async (c) => {
	const { from, to } = getDateRange(c);
	const assets = await getAssetUtilization(c.env.DB, from, to);
	return c.html(
		<AssetUtilizationView
			assets={assets}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/peak-hours", async (c) => {
	const { from, to } = getDateRange(c);
	const data = await getPeakHours(c.env.DB, from, to);
	return c.html(
		<PeakHoursView
			byHour={data.byHour}
			byDay={data.byDay}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

// Owner-only
reportPages.get("/operators", requireRole("owner"), async (c) => {
	const { from, to } = getDateRange(c);
	const operators = await getOperatorPerformance(c.env.DB, from, to);
	return c.html(
		<OperatorPerformanceView
			operators={operators}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/cash", async (c) => {
	const { from, to } = getDateRange(c);
	const page = Number(c.req.query("page")) || 1;
	const perPage = 20;
	const { registers, total } = await getCashReconciliation(
		c.env.DB,
		from,
		to,
		perPage,
		(page - 1) * perPage,
	);
	return c.html(
		<CashReconciliationView
			registers={registers}
			total={total}
			page={page}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/customers", async (c) => {
	const { from, to } = getDateRange(c);
	const data = await getCustomerAnalysis(c.env.DB, from, to);
	return c.html(
		<CustomerAnalysisView
			{...data}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/unpaid", async (c) => {
	const { from, to } = getDateRange(c);
	const sessions = await getUnpaidSessions(c.env.DB, from, to);
	return c.html(
		<UnpaidReportView
			sessions={sessions}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/cancelled", async (c) => {
	const { from, to } = getDateRange(c);
	const sessions = await getCancelledSessions(c.env.DB, from, to);
	return c.html(
		<CancelledReportView
			sessions={sessions}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/shifts", async (c) => {
	const { from, to } = getDateRange(c);
	const shifts = await getShiftReport(c.env.DB, from, to);
	return c.html(
		<ShiftReportView
			shifts={shifts}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/products", async (c) => {
	const { from, to } = getDateRange(c);
	const [summary, products] = await Promise.all([
		getProductSalesSummary(c.env.DB, from, to),
		getProductRevenue(c.env.DB, from, to),
	]);
	return c.html(
		<ProductSalesReportView
			summary={summary}
			products={products}
			from={from}
			to={to}
			user={c.get("user")}
		/>,
	);
});

reportPages.get("/product-detail", async (c) => {
	const { from, to } = getDateRange(c);
	const productId = c.req.query("product_id") ? Number(c.req.query("product_id")) : undefined;
	const page = Number(c.req.query("page")) || 1;
	const perPage = 50;
	const { sales, total } = await getProductSaleDetail(
		c.env.DB, from, to, productId, perPage, (page - 1) * perPage,
	);

	let productName: string | undefined;
	if (productId && sales.length > 0) {
		// Get product name from the first sale's items or query
		const row = await c.env.DB.prepare("SELECT name FROM products WHERE id = ?").bind(productId).first<{ name: string }>();
		productName = row?.name;
	}

	return c.html(
		<ProductSaleDetailView
			sales={sales}
			total={total}
			page={page}
			from={from}
			to={to}
			productId={productId}
			productName={productName}
			user={c.get("user")}
		/>,
	);
});

const BACK_URL_MAP: Record<string, string> = {
	package: "/admin/reports/packages",
	asset: "/admin/reports/assets",
	operator: "/admin/reports/operators",
	shift: "/admin/reports/shifts",
	day: "/admin/reports/financial",
	payment_method: "/admin/reports/financial",
	hour: "/admin/reports/peak-hours",
	dow: "/admin/reports/peak-hours",
	all: "/admin/reports/detail",
};

reportPages.get("/detail", async (c) => {
	const { from, to } = getDateRange(c);
	const filterType = c.req.query("filter") ?? "all";
	const id = c.req.query("id");
	const day = c.req.query("day");
	const page = Number(c.req.query("page")) || 1;
	const perPage = 50;

	const validFilters = ["package", "asset", "operator", "shift", "day", "payment_method", "hour", "dow", "all"];
	if (!validFilters.includes(filterType)) {
		return c.redirect(`/admin/reports/financial?from=${from}&to=${to}`);
	}

	if (filterType === "operator") {
		const user = c.get("user");
		if (!user || user.role !== "owner") return c.text("Acesso negado", 403);
	}

	let filter: DetailFilter;
	let filterParams: string;
	if (filterType === "day") {
		if (!day) return c.redirect(`/admin/reports/financial?from=${from}&to=${to}`);
		filter = { type: "day", day };
		filterParams = `&day=${day}`;
	} else if (filterType === "payment_method") {
		const method = c.req.query("method");
		if (!method) return c.redirect(`/admin/reports/financial?from=${from}&to=${to}`);
		filter = { type: "payment_method", method };
		filterParams = `&method=${method}`;
	} else if (filterType === "hour") {
		const hourVal = c.req.query("hour");
		if (hourVal === undefined) return c.redirect(`/admin/reports/peak-hours?from=${from}&to=${to}`);
		filter = { type: "hour", hour: Number(hourVal) };
		filterParams = `&hour=${hourVal}`;
	} else if (filterType === "dow") {
		const dowVal = c.req.query("dow");
		if (dowVal === undefined) return c.redirect(`/admin/reports/peak-hours?from=${from}&to=${to}`);
		filter = { type: "dow", dow: Number(dowVal) };
		filterParams = `&dow=${dowVal}`;
	} else if (filterType === "all") {
		filter = { type: "all" };
		filterParams = "";
	} else {
		if (!id) return c.redirect(`/admin/reports/financial?from=${from}&to=${to}`);
		filter = { type: filterType as "package" | "asset" | "operator" | "shift", id: Number(id) };
		filterParams = `&id=${id}`;
	}

	const { sessions, total, context } = await getDetailSessions(
		c.env.DB, filter, from, to, perPage, (page - 1) * perPage,
	);

	return c.html(
		<ReportDetailView
			sessions={sessions}
			total={total}
			context={context}
			page={page}
			from={from}
			to={to}
			filter={filterType}
			filterParams={filterParams}
			backUrl={BACK_URL_MAP[filterType] ?? "/admin/reports/financial"}
			user={c.get("user")}
		/>,
	);
});
