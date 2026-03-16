import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { HBar, formatCurrency, formatDate } from "../../lib/report-utils";
import type {
	FinancialSummary,
	DailyRevenueTrend,
} from "../../db/queries/reports";

interface Props {
	summary: FinancialSummary;
	trend: DailyRevenueTrend[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

export const FinancialSummaryView: FC<Props> = ({
	summary,
	trend,
	from,
	to,
	user,
}) => {
	const maxDayRevenue = Math.max(...trend.map((d) => d.revenue_cents), 1);
	const paymentTotal =
		summary.cash_cents +
		summary.credit_cents +
		summary.debit_cents +
		summary.pix_cents;

	return (
		<ReportLayout
			title="Resumo Financeiro"
			user={user}
			activeReport="/admin/reports/financial"
			from={from}
			to={to}
		>
			{/* KPI Row */}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Receita Total</p>
					<p class="text-xl font-display font-bold text-sk-orange">
						{formatCurrency(summary.total_revenue_cents)}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Locações</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{summary.rental_count}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Ticket Medio</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{formatCurrency(Math.round(summary.avg_ticket_cents))}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Min. Operados</p>
					<p class="text-xl font-display font-bold text-sk-green-dark">
						{summary.total_minutes}
					</p>
				</div>
			</div>

			{/* Payment breakdown */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-6">
				<h3 class="text-sm font-display font-bold text-sk-text mb-3">
					Formas de Pagamento
				</h3>
				<HBar
					label="Dinheiro"
					value={summary.cash_cents}
					pct={
						paymentTotal > 0
							? Math.round((summary.cash_cents / paymentTotal) * 100)
							: 0
					}
					display={formatCurrency(summary.cash_cents)}
					color="bg-sk-green"
				/>
				<HBar
					label="Credito"
					value={summary.credit_cents}
					pct={
						paymentTotal > 0
							? Math.round((summary.credit_cents / paymentTotal) * 100)
							: 0
					}
					display={formatCurrency(summary.credit_cents)}
					color="bg-sk-yellow-dark"
				/>
				<HBar
					label="Debito"
					value={summary.debit_cents}
					pct={
						paymentTotal > 0
							? Math.round((summary.debit_cents / paymentTotal) * 100)
							: 0
					}
					display={formatCurrency(summary.debit_cents)}
					color="bg-sk-blue"
				/>
				<HBar
					label="Pix"
					value={summary.pix_cents}
					pct={
						paymentTotal > 0
							? Math.round((summary.pix_cents / paymentTotal) * 100)
							: 0
					}
					display={formatCurrency(summary.pix_cents)}
					color="bg-sk-purple"
				/>
			</div>

			{/* Alerts row */}
			<div class="grid grid-cols-2 gap-4 mb-6">
				<div
					class={`rounded-sk p-3 text-center ${summary.unpaid_count > 0 ? "bg-sk-danger-light" : "bg-sk-green-light"}`}
				>
					<p class="text-xs font-body text-sk-muted">Não Pagos</p>
					<p
						class={`text-lg font-display font-bold ${summary.unpaid_count > 0 ? "text-sk-danger" : "text-sk-green-dark"}`}
					>
						{summary.unpaid_count}
					</p>
				</div>
				<div class="bg-sk-yellow-light rounded-sk p-3 text-center">
					<p class="text-xs font-body text-sk-muted">Cancelamentos</p>
					<p class="text-lg font-display font-bold text-sk-yellow-dark">
						{summary.cancelled_count}
					</p>
				</div>
			</div>

			{/* Daily trend table */}
			{trend.length > 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<div class="px-4 py-3 bg-sk-yellow-light/50">
						<h3 class="text-sm font-display font-bold text-sk-text">
							Tendencia Diaria
						</h3>
					</div>
					<table class="w-full text-sm font-body">
						<thead class="bg-sk-yellow-light/30 text-sk-muted">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Data</th>
								<th class="px-4 py-2 text-right font-medium">Locações</th>
								<th class="px-4 py-2 text-right font-medium">Receita</th>
								<th class="px-4 py-2 font-medium hidden md:table-cell">
									Grafico
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{trend.map((d) => (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-4 py-2">{formatDate(d.day)}</td>
									<td class="px-4 py-2 text-right">{d.rental_count}</td>
									<td class="px-4 py-2 text-right font-medium">
										{formatCurrency(d.revenue_cents)}
									</td>
									<td class="px-4 py-2 hidden md:table-cell">
										<div class="bg-sk-yellow-light rounded-full h-2 w-full overflow-hidden">
											<div
												class="h-full bg-sk-orange rounded-full"
												style={`width:${Math.round((d.revenue_cents / maxDayRevenue) * 100)}%`}
											/>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{trend.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center">
					<p class="text-sk-muted font-body">
						Nenhuma locacao encontrada no período selecionado.
					</p>
				</div>
			)}
		</ReportLayout>
	);
};
