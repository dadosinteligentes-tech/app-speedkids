import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { HBar, formatCurrency, formatDate } from "../../lib/report-utils";
import type {
	FinancialSummary,
	DailyRevenueTrend,
	ProductSalesSummary,
} from "../../db/queries/reports";

interface Props {
	summary: FinancialSummary;
	productSales: ProductSalesSummary;
	trend: DailyRevenueTrend[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

export const FinancialSummaryView: FC<Props> = ({
	summary,
	productSales,
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
		summary.pix_cents +
		summary.mixed_cents +
		summary.courtesy_cents;

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
				<a href={`/admin/reports/detail?filter=all&from=${from}&to=${to}`} class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center block hover:opacity-80">
					<p class="text-xs text-sk-muted font-body mb-1">Receita Total</p>
					<p class="text-xl font-display font-bold text-sk-orange">
						{formatCurrency(summary.total_revenue_cents)}
					</p>
				</a>
				<a href={`/admin/reports/detail?filter=all&from=${from}&to=${to}`} class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center block hover:opacity-80">
					<p class="text-xs text-sk-muted font-body mb-1">Locações</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{summary.rental_count}
					</p>
				</a>
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
				<a href={`/admin/reports/detail?filter=payment_method&method=cash&from=${from}&to=${to}`} class="block hover:opacity-80">
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
				</a>
				<a href={`/admin/reports/detail?filter=payment_method&method=credit&from=${from}&to=${to}`} class="block hover:opacity-80">
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
				</a>
				<a href={`/admin/reports/detail?filter=payment_method&method=debit&from=${from}&to=${to}`} class="block hover:opacity-80">
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
				</a>
				<a href={`/admin/reports/detail?filter=payment_method&method=pix&from=${from}&to=${to}`} class="block hover:opacity-80">
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
				</a>
				{summary.mixed_cents > 0 && (
					<a href={`/admin/reports/detail?filter=payment_method&method=mixed&from=${from}&to=${to}`} class="block hover:opacity-80">
						<HBar
							label="Misto"
							value={summary.mixed_cents}
							pct={
								paymentTotal > 0
									? Math.round((summary.mixed_cents / paymentTotal) * 100)
									: 0
							}
							display={formatCurrency(summary.mixed_cents)}
							color="bg-sk-blue-dark"
						/>
					</a>
				)}
				{summary.courtesy_cents > 0 && (
					<HBar
						label="Cortesia"
						value={summary.courtesy_cents}
						pct={
							paymentTotal > 0
								? Math.round((summary.courtesy_cents / paymentTotal) * 100)
								: 0
						}
						display={formatCurrency(summary.courtesy_cents)}
						color="bg-gray-400"
					/>
				)}
			</div>

			{/* Product Sales */}
			{productSales.sale_count > 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-6">
					<h3 class="text-sm font-display font-bold text-sk-text mb-3">
						Vendas de Produtos
					</h3>
					<div class="grid grid-cols-3 gap-4 mb-3">
						<div class="text-center">
							<p class="text-xs text-sk-muted font-body">Receita</p>
							<p class="text-lg font-display font-bold text-sk-purple">{formatCurrency(productSales.total_revenue_cents)}</p>
						</div>
						<div class="text-center">
							<p class="text-xs text-sk-muted font-body">Vendas</p>
							<p class="text-lg font-display font-bold text-sk-text">{productSales.sale_count}</p>
						</div>
						<div class="text-center">
							<p class="text-xs text-sk-muted font-body">Ticket Medio</p>
							<p class="text-lg font-display font-bold text-sk-blue-dark">{formatCurrency(Math.round(productSales.avg_ticket_cents))}</p>
						</div>
					</div>
					<div class="text-xs text-sk-muted space-y-1">
						{productSales.cash_cents > 0 && <div class="flex justify-between"><span>Dinheiro</span><span>{formatCurrency(productSales.cash_cents)}</span></div>}
						{productSales.credit_cents > 0 && <div class="flex justify-between"><span>Credito</span><span>{formatCurrency(productSales.credit_cents)}</span></div>}
						{productSales.debit_cents > 0 && <div class="flex justify-between"><span>Debito</span><span>{formatCurrency(productSales.debit_cents)}</span></div>}
						{productSales.pix_cents > 0 && <div class="flex justify-between"><span>Pix</span><span>{formatCurrency(productSales.pix_cents)}</span></div>}
					</div>
				</div>
			)}

			{/* Alerts row */}
			<div class="grid grid-cols-3 gap-4 mb-6">
				<a
					href={`/admin/reports/unpaid?from=${from}&to=${to}`}
					class={`rounded-sk p-3 text-center block hover:opacity-80 ${summary.unpaid_count > 0 ? "bg-sk-danger-light" : "bg-sk-green-light"}`}
				>
					<p class="text-xs font-body text-sk-muted">Não Pagos</p>
					<p
						class={`text-lg font-display font-bold ${summary.unpaid_count > 0 ? "text-sk-danger" : "text-sk-green-dark"}`}
					>
						{summary.unpaid_count}
					</p>
				</a>
				<a
					href={`/admin/reports/unpaid?from=${from}&to=${to}`}
					class="bg-sk-purple-light rounded-sk p-3 text-center block hover:opacity-80"
				>
					<p class="text-xs font-body text-sk-muted">Cortesias</p>
					<p class="text-lg font-display font-bold text-sk-purple">
						{summary.courtesy_count}
					</p>
				</a>
				<a
					href={`/admin/reports/cancelled?from=${from}&to=${to}`}
					class="bg-sk-yellow-light rounded-sk p-3 text-center block hover:opacity-80"
				>
					<p class="text-xs font-body text-sk-muted">Cancelamentos</p>
					<p class="text-lg font-display font-bold text-sk-yellow-dark">
						{summary.cancelled_count}
					</p>
				</a>
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
								<tr class="hover:bg-sk-yellow-light cursor-pointer" onclick={`window.location='/admin/reports/detail?filter=day&day=${d.day}&from=${from}&to=${to}'`}>
									<td class="px-4 py-2">{formatDate(d.day)} <span class="text-sk-muted text-xs">&#8250;</span></td>
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
