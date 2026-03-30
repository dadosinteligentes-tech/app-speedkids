import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import type { ProductSalesSummary, ProductRevenueRow } from "../../db/queries/reports";
import type { Tenant } from "../../db/schema";

interface Props {
	summary: ProductSalesSummary;
	products: ProductRevenueRow[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

export const ProductSalesReportView: FC<Props> = ({
	summary,
	products,
	from,
	to,
	user,
	tenant,
	isPlatformAdmin, planFeatures,
}) => {
	const paymentTotal =
		summary.cash_cents +
		summary.credit_cents +
		summary.debit_cents +
		summary.pix_cents;
	const totalQty = products.reduce((s, p) => s + p.quantity_sold, 0);

	return (
		<ReportLayout
			title="Vendas de Produtos"
			user={user}
			activeReport="/admin/reports/products"
			from={from}
			to={to}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}
		>
			{/* KPI Row */}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<a href={`/admin/reports/product-detail?from=${from}&to=${to}`} class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center block hover:opacity-80">
					<p class="text-xs text-sk-muted font-body mb-1">Receita Total</p>
					<p class="text-xl font-display font-bold text-sk-purple">
						{formatCurrency(summary.total_revenue_cents)}
					</p>
				</a>
				<a href={`/admin/reports/product-detail?from=${from}&to=${to}`} class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center block hover:opacity-80">
					<p class="text-xs text-sk-muted font-body mb-1">Vendas</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{summary.sale_count}
					</p>
				</a>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Ticket Medio</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{formatCurrency(Math.round(summary.avg_ticket_cents))}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Itens Vendidos</p>
					<p class="text-xl font-display font-bold text-sk-green-dark">
						{totalQty}
					</p>
				</div>
			</div>

			{/* Payment breakdown */}
			{paymentTotal > 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-6">
					<h3 class="text-sm font-display font-bold text-sk-text mb-3">
						Formas de Pagamento
					</h3>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-body">
						{summary.cash_cents > 0 && (
							<div class="flex justify-between p-2 bg-sk-green-light rounded-sk">
								<span class="text-sk-green-dark font-medium">Dinheiro</span>
								<span class="font-bold">{formatCurrency(summary.cash_cents)}</span>
							</div>
						)}
						{summary.credit_cents > 0 && (
							<div class="flex justify-between p-2 bg-sk-yellow-light rounded-sk">
								<span class="text-sk-yellow-dark font-medium">Credito</span>
								<span class="font-bold">{formatCurrency(summary.credit_cents)}</span>
							</div>
						)}
						{summary.debit_cents > 0 && (
							<div class="flex justify-between p-2 bg-sk-blue-light rounded-sk">
								<span class="text-sk-blue-dark font-medium">Debito</span>
								<span class="font-bold">{formatCurrency(summary.debit_cents)}</span>
							</div>
						)}
						{summary.pix_cents > 0 && (
							<div class="flex justify-between p-2 bg-sk-purple-light rounded-sk">
								<span class="text-sk-purple font-medium">Pix</span>
								<span class="font-bold">{formatCurrency(summary.pix_cents)}</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Products table */}
			{products.length > 0 ? (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<div class="px-4 py-3 bg-sk-yellow-light/50">
						<h3 class="text-sm font-display font-bold text-sk-text">
							Faturamento por Produto
						</h3>
					</div>
					<table class="w-full text-sm font-body">
						<thead class="bg-sk-yellow-light/30 text-sk-muted text-left">
							<tr>
								<th class="px-4 py-2 font-medium">Produto</th>
								<th class="px-4 py-2 font-medium hidden sm:table-cell">Categoria</th>
								<th class="px-4 py-2 font-medium text-right hidden sm:table-cell">Preco Unit.</th>
								<th class="px-4 py-2 font-medium text-right">Qtd</th>
								<th class="px-4 py-2 font-medium text-right">Receita</th>
								<th class="px-4 py-2 font-medium hidden md:table-cell">Participacao</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{products.map((p) => (
								<tr
									class={`hover:bg-sk-yellow-light ${p.quantity_sold === 0 ? "opacity-40" : "cursor-pointer"}`}
									onclick={p.quantity_sold > 0 ? `window.location='/admin/reports/product-detail?product_id=${p.product_id}&from=${from}&to=${to}'` : undefined}
								>
									<td class="px-4 py-2 font-medium">
										{p.product_name}
										{p.quantity_sold > 0 && <span class="text-sk-muted text-xs ml-1">&#8250;</span>}
									</td>
									<td class="px-4 py-2 text-sk-muted hidden sm:table-cell">{p.category ?? "—"}</td>
									<td class="px-4 py-2 text-right text-sk-muted hidden sm:table-cell">{formatCurrency(p.price_cents)}</td>
									<td class="px-4 py-2 text-right">{p.quantity_sold}</td>
									<td class="px-4 py-2 text-right font-medium">{formatCurrency(p.revenue_cents)}</td>
									<td class="px-4 py-2 hidden md:table-cell">
										<div class="flex items-center gap-2">
											<div class="flex-1 bg-sk-yellow-light rounded-full h-2 overflow-hidden">
												<div
													class="h-full bg-sk-purple rounded-full"
													style={`width:${Math.max(p.revenue_pct, 1)}%`}
												/>
											</div>
											<span class="text-xs text-sk-muted w-8 text-right">{p.revenue_pct}%</span>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center">
					<p class="text-sk-muted font-body">
						Nenhuma venda de produto no periodo selecionado.
					</p>
				</div>
			)}
		</ReportLayout>
	);
};
