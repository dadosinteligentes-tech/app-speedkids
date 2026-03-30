import type { FC } from "hono/jsx";
import type { ProductSaleDetailRow } from "../../db/queries/reports";
import { ReportLayout } from "./layout";
import { toBrazilDateTime, toBrazilDate } from "../../lib/timezone";
import type { Tenant } from "../../db/schema";

interface Props {
	sales: ProductSaleDetailRow[];
	total: number;
	page: number;
	from: string;
	to: string;
	productId?: number;
	productName?: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

function formatCurrency(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const PAYMENT_LABELS: Record<string, string> = {
	cash: "Dinheiro",
	credit: "Credito",
	debit: "Debito",
	pix: "PIX",
	mixed: "Misto",
};

const PER_PAGE = 50;

export const ProductSaleDetailView: FC<Props> = ({
	sales, total, page, from, to, productId, productName, user, tenant, isPlatformAdmin, planFeatures,
}) => {
	const totalPages = Math.ceil(total / PER_PAGE);
	const totalRevenue = sales.reduce((s, r) => s + r.total_cents, 0);
	const label = productName ? `Produto: ${productName}` : "Todas as Vendas de Produtos";
	const baseQs = `from=${from}&to=${to}${productId ? `&product_id=${productId}` : ""}`;

	return (
		<ReportLayout title={label} user={user} activeReport="/admin/reports/products" from={from} to={to} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
			<div class="mb-4">
				<a href={`/admin/reports/products?from=${from}&to=${to}`} class="text-sk-orange font-body text-sm hover:underline">
					&larr; Voltar ao relatorio de produtos
				</a>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-4">
				<h2 class="text-lg font-display font-bold text-sk-text">{label}</h2>
				<p class="text-sm text-sk-muted font-body">
					{toBrazilDate(from + "T12:00:00")} — {toBrazilDate(to + "T12:00:00")}
					{" "}&middot; {total} vendas
				</p>
			</div>

			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Vendas</p>
					<p class="text-xl font-display font-bold text-sk-text">{total}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Receita</p>
					<p class="text-xl font-display font-bold text-sk-purple">{formatCurrency(totalRevenue)}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Ticket Medio</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{formatCurrency(sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0)}
					</p>
				</div>
			</div>

			{sales.length === 0 ? (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center">
					<p class="text-sk-muted font-body">Nenhuma venda encontrada.</p>
				</div>
			) : (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
								<tr>
									<th class="px-3 py-3 font-medium">Data</th>
									<th class="px-3 py-3 font-medium">Itens</th>
									<th class="px-3 py-3 font-medium text-right">Valor</th>
									<th class="px-3 py-3 font-medium hidden md:table-cell">Pagamento</th>
									<th class="px-3 py-3 font-medium hidden md:table-cell">Cliente</th>
									<th class="px-3 py-3 font-medium hidden lg:table-cell">Operador</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{sales.map((s) => (
									<tr class="hover:bg-sk-yellow-light">
										<td class="px-3 py-2 whitespace-nowrap text-xs text-sk-muted">
											{toBrazilDateTime(s.created_at)}
										</td>
										<td class="px-3 py-2 text-xs max-w-[200px] truncate" title={s.item_summary}>
											{s.item_summary}
										</td>
										<td class="px-3 py-2 text-right font-medium">
											{formatCurrency(s.total_cents)}
										</td>
										<td class="px-3 py-2 hidden md:table-cell text-sk-muted text-xs">
											{PAYMENT_LABELS[s.payment_method ?? ""] ?? s.payment_method ?? "—"}
										</td>
										<td class="px-3 py-2 hidden md:table-cell text-sk-muted">
											{s.customer_name ?? "—"}
										</td>
										<td class="px-3 py-2 hidden lg:table-cell text-sk-muted">
											{s.attendant_name ?? "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{totalPages > 1 && (
				<div class="flex items-center justify-between mt-4 text-sm font-body">
					<span class="text-sk-muted">Pagina {page} de {totalPages}</span>
					<div class="flex gap-2">
						{page > 1 && (
							<a href={`/admin/reports/product-detail?${baseQs}&page=${page - 1}`}
								class="px-3 py-1 bg-sk-surface border border-sk-border rounded-sk hover:bg-sk-yellow-light">&larr; Anterior</a>
						)}
						{page < totalPages && (
							<a href={`/admin/reports/product-detail?${baseQs}&page=${page + 1}`}
								class="px-3 py-1 bg-sk-surface border border-sk-border rounded-sk hover:bg-sk-yellow-light">Proxima &rarr;</a>
						)}
					</div>
				</div>
			)}
		</ReportLayout>
	);
};
