import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireRole } from "../../middleware/require-role";
import { todayISO, daysAgoISO } from "../../lib/report-utils";
import { toBrazilDate, toBrazilDateTime } from "../../lib/timezone";
import {
	getFinancialSummary,
	getDailyRevenueTrend,
	getPackageRevenue,
	getAssetUtilization,
	getPeakHours,
	getOperatorPerformance,
	getCashReconciliation,
	getCustomerAnalysis,
	getUnpaidSessions,
	getCancelledSessions,
	getShiftReport,
} from "../../db/queries/reports";

export const reportApiRoutes = new Hono<AppEnv>();

reportApiRoutes.use("*", requireRole("manager", "owner"));

// ── CSV Helpers ──

function escapeCSV(v: unknown): string {
	const s = String(v ?? "");
	return s.includes(";") || s.includes('"') || s.includes("\n")
		? '"' + s.replace(/"/g, '""') + '"'
		: s;
}

function toCSV(headers: string[], rows: unknown[][]): string {
	const BOM = "\uFEFF";
	const lines = [headers.map(escapeCSV).join(";")];
	for (const row of rows) lines.push(row.map(escapeCSV).join(";"));
	return BOM + lines.join("\r\n");
}

function toCSVMultiSection(
	sections: { title: string; headers: string[]; rows: unknown[][] }[],
): string {
	const BOM = "\uFEFF";
	const parts: string[] = [];
	for (const section of sections) {
		parts.push(section.title);
		parts.push(section.headers.map(escapeCSV).join(";"));
		for (const row of section.rows)
			parts.push(row.map(escapeCSV).join(";"));
		parts.push("");
	}
	return BOM + parts.join("\r\n");
}

function csvResponse(c: { header: (k: string, v: string) => void }, filename: string, csv: string): Response {
	c.header("Content-Type", "text/csv; charset=utf-8");
	c.header("Content-Disposition", `attachment; filename="${filename}"`);
	return new Response(csv);
}

function fmtMoney(cents: number | null): string {
	return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}

function fmtPct(pct: number | null): string {
	return (pct ?? 0).toFixed(1).replace(".", ",");
}

function fmtDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return toBrazilDate(iso);
}

function fmtDateTime(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return toBrazilDateTime(iso);
}

function getDateRange(c: { req: { query: (k: string) => string | undefined } }): {
	from: string;
	to: string;
} {
	const from = c.req.query("from") ?? daysAgoISO(30);
	const to = c.req.query("to") ?? todayISO();
	return { from, to };
}

const DAY_NAMES = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

const ROLE_LABELS: Record<string, string> = {
	owner: "Socio",
	manager: "Gerente",
	operator: "Operador",
};

// ── Endpoints ──

reportApiRoutes.get("/financial/export", async (c) => {
	const { from, to } = getDateRange(c);
	const [summary, trend] = await Promise.all([
		getFinancialSummary(c.env.DB, from, to),
		getDailyRevenueTrend(c.env.DB, from, to),
	]);

	const csv = toCSVMultiSection([
		{
			title: `RESUMO FINANCEIRO (${fmtDate(from)} a ${fmtDate(to)})`,
			headers: [
				"Receita Total",
				"Locações",
				"Ticket Medio",
				"Dinheiro",
				"Credito",
				"Debito",
				"Pix",
				"Não Pagos",
				"Cancelados",
				"Minutos Totais",
			],
			rows: [
				[
					fmtMoney(summary.total_revenue_cents),
					summary.rental_count,
					fmtMoney(summary.avg_ticket_cents),
					fmtMoney(summary.cash_cents),
					fmtMoney(summary.credit_cents),
					fmtMoney(summary.debit_cents),
					fmtMoney(summary.pix_cents),
					summary.unpaid_count,
					summary.cancelled_count,
					summary.total_minutes,
				],
			],
		},
		{
			title: "TENDENCIA DIARIA",
			headers: ["Data", "Locações", "Receita"],
			rows: trend.map((t) => [fmtDate(t.day), t.rental_count, fmtMoney(t.revenue_cents)]),
		},
	]);

	return csvResponse(c, `resumo-financeiro-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/packages/export", async (c) => {
	const { from, to } = getDateRange(c);
	const packages = await getPackageRevenue(c.env.DB, from, to);

	const csv = toCSV(
		["Pacote", "Duracao (min)", "Preco Unitario", "Locações", "Receita", "Participacao %"],
		packages.map((p) => [
			p.package_name,
			p.duration_minutes,
			fmtMoney(p.price_cents),
			p.rental_count,
			fmtMoney(p.revenue_cents),
			fmtPct(p.revenue_pct),
		]),
	);

	return csvResponse(c, `pacotes-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/assets/export", async (c) => {
	const { from, to } = getDateRange(c);
	const assets = await getAssetUtilization(c.env.DB, from, to);

	const csv = toCSV(
		["Ativo", "Tipo", "Locações", "Minutos", "Receita", "Utilizacao %"],
		assets.map((a) => [
			a.asset_name,
			a.asset_type,
			a.rental_count,
			a.total_minutes,
			fmtMoney(a.revenue_cents),
			fmtPct(a.utilization_pct),
		]),
	);

	return csvResponse(c, `ativos-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/peak-hours/export", async (c) => {
	const { from, to } = getDateRange(c);
	const data = await getPeakHours(c.env.DB, from, to);

	const csv = toCSVMultiSection([
		{
			title: `HORARIOS DE PICO (${fmtDate(from)} a ${fmtDate(to)})`,
			headers: ["Hora", "Locações", "Receita"],
			rows: data.byHour.map((h) => [
				`${String(h.hour).padStart(2, "0")}:00`,
				h.rental_count,
				fmtMoney(h.revenue_cents),
			]),
		},
		{
			title: "POR DIA DA SEMANA",
			headers: ["Dia", "Locações", "Receita"],
			rows: data.byDay.map((d) => [
				DAY_NAMES[d.dow] ?? String(d.dow),
				d.rental_count,
				fmtMoney(d.revenue_cents),
			]),
		},
	]);

	return csvResponse(c, `horarios-pico-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/operators/export", requireRole("owner"), async (c) => {
	const { from, to } = getDateRange(c);
	const operators = await getOperatorPerformance(c.env.DB, from, to);

	const csv = toCSV(
		[
			"Operador",
			"Cargo",
			"Locações Iniciadas",
			"Receita",
			"Turnos",
			"Horas Trabalhadas",
			"Diferenca Caixa",
		],
		operators.map((o) => [
			o.user_name,
			ROLE_LABELS[o.role] ?? o.role,
			o.rentals_started,
			fmtMoney(o.revenue_cents),
			o.shift_count,
			fmtPct(o.shift_hours),
			fmtMoney(o.cash_discrepancy_cents),
		]),
	);

	return csvResponse(c, `operadores-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/cash/export", async (c) => {
	const { from, to } = getDateRange(c);
	const { registers } = await getCashReconciliation(c.env.DB, from, to, 10000, 0);

	const csv = toCSV(
		[
			"Abertura",
			"Fechamento",
			"Operador",
			"Saldo Inicial",
			"Pagamentos",
			"Retiradas",
			"Depositos",
			"Ajustes",
			"Esperado",
			"Declarado",
			"Diferenca",
			"Status",
		],
		registers.map((r) => [
			fmtDateTime(r.opened_at),
			r.closed_at ? fmtDateTime(r.closed_at) : "Aberto",
			r.opened_by_name,
			fmtMoney(r.opening_balance_cents),
			fmtMoney(r.rental_payment_cents),
			fmtMoney(r.withdrawal_cents),
			fmtMoney(r.deposit_cents),
			fmtMoney(r.adjustment_cents),
			r.expected_balance_cents != null ? fmtMoney(r.expected_balance_cents) : "",
			r.closing_balance_cents != null ? fmtMoney(r.closing_balance_cents) : "",
			r.discrepancy_cents != null ? fmtMoney(r.discrepancy_cents) : "",
			r.status === "open" ? "Aberto" : "Fechado",
		]),
	);

	return csvResponse(c, `caixa-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/customers/export", async (c) => {
	const { from, to } = getDateRange(c);
	const data = await getCustomerAnalysis(c.env.DB, from, to);

	const csv = toCSVMultiSection([
		{
			title: `CLIENTES (${fmtDate(from)} a ${fmtDate(to)})`,
			headers: ["Cliente", "Telefone", "Locações", "Receita"],
			rows: data.topByRevenue.map((t) => [
				t.customer_name,
				t.phone ?? "",
				t.rental_count,
				fmtMoney(t.revenue_cents),
			]),
		},
		{
			title: "TOP CLIENTES POR FREQUENCIA",
			headers: ["Cliente", "Telefone", "Locações", "Receita"],
			rows: data.topByFrequency.map((t) => [
				t.customer_name,
				t.phone ?? "",
				t.rental_count,
				fmtMoney(t.revenue_cents),
			]),
		},
		{
			title: "DISTRIBUICAO POR FAIXA ETARIA",
			headers: ["Faixa Etaria", "Quantidade"],
			rows: data.ageGroups.map((g) => [g.age_group, g.count]),
		},
	]);

	return csvResponse(c, `clientes-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/unpaid/export", async (c) => {
	const { from, to } = getDateRange(c);
	const sessions = await getUnpaidSessions(c.env.DB, from, to);

	const csv = toCSV(
		["Data", "Crianca", "Responsavel", "Ativo", "Pacote", "Valor", "Tipo", "Motivo", "Operador"],
		sessions.map((s) => [
			fmtDateTime(s.start_time),
			s.child_name ?? "",
			s.customer_name ?? "",
			s.asset_name,
			s.package_name,
			fmtMoney(s.amount_cents),
			s.payment_method === "courtesy" ? "Cortesia" : "Pendente",
			s.notes ?? "",
			s.attendant_name ?? "",
		]),
	);

	return csvResponse(c, `nao-pagos-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/shifts/export", async (c) => {
	const { from, to } = getDateRange(c);
	const shifts = await getShiftReport(c.env.DB, from, to);

	const csv = toCSV(
		["Turno", "Operador", "Inicio", "Fim", "Locações", "Receita", "Dinheiro", "Credito", "Debito", "PIX", "Cortesias"],
		shifts.map((s) => [
			s.shift_name ?? "—",
			s.user_name,
			fmtDateTime(s.started_at),
			s.ended_at ? fmtDateTime(s.ended_at) : "Ativo",
			s.rental_count,
			fmtMoney(s.revenue_cents),
			fmtMoney(s.cash_cents),
			fmtMoney(s.credit_cents),
			fmtMoney(s.debit_cents),
			fmtMoney(s.pix_cents),
			s.courtesy_count,
		]),
	);

	return csvResponse(c, `turnos-${from}-a-${to}.csv`, csv);
});

reportApiRoutes.get("/cancelled/export", async (c) => {
	const { from, to } = getDateRange(c);
	const sessions = await getCancelledSessions(c.env.DB, from, to);

	const csv = toCSV(
		["Data", "Crianca", "Responsavel", "Ativo", "Pacote", "Valor", "Motivo", "Operador"],
		sessions.map((s) => [
			fmtDateTime(s.start_time),
			s.child_name ?? "",
			s.customer_name ?? "",
			s.asset_name,
			s.package_name,
			fmtMoney(s.amount_cents),
			s.notes ?? "",
			s.attendant_name ?? "",
		]),
	);

	return csvResponse(c, `cancelados-${from}-a-${to}.csv`, csv);
});
