import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency, formatDateTime } from "../../lib/report-utils";
import type { CashRegisterReport } from "../../db/queries/reports";

interface Props {
	registers: CashRegisterReport[];
	total: number;
	page: number;
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

function discrepancyClass(cents: number | null): string {
	if (cents === null) return "text-sk-muted";
	const abs = Math.abs(cents);
	if (abs === 0) return "text-sk-green-dark";
	if (abs <= 500) return "text-sk-yellow-dark";
	return "text-sk-danger";
}

export const CashReconciliationView: FC<Props> = ({
	registers,
	total,
	page,
	from,
	to,
	user,
}) => {
	const perPage = 20;
	const totalPages = Math.ceil(total / perPage);
	const totalDiscrepancy = registers.reduce(
		(s, r) => s + Math.abs(r.discrepancy_cents ?? 0),
		0,
	);
	const openCount = registers.filter((r) => r.status === "open").length;

	return (
		<ReportLayout
			title="Fechamento de Caixa"
			user={user}
			activeReport="/admin/reports/cash"
			from={from}
			to={to}
		>
			{/* Summary KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Caixas</p>
					<p class="text-xl font-display font-bold text-sk-text">{total}</p>
				</div>
				<div
					class={`rounded-sk shadow-sk-sm p-4 text-center ${totalDiscrepancy > 0 ? "bg-sk-danger-light" : "bg-sk-green-light"}`}
				>
					<p class="text-xs text-sk-muted font-body mb-1">
						Discrepancia Total
					</p>
					<p
						class={`text-xl font-display font-bold ${totalDiscrepancy > 0 ? "text-sk-danger" : "text-sk-green-dark"}`}
					>
						{formatCurrency(totalDiscrepancy)}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center col-span-2 md:col-span-1">
					<p class="text-xs text-sk-muted font-body mb-1">Caixas Abertos</p>
					<p
						class={`text-xl font-display font-bold ${openCount > 0 ? "text-sk-blue-dark" : "text-sk-muted"}`}
					>
						{openCount}
					</p>
				</div>
			</div>

			{/* Cash registers table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
							<tr>
								<th class="px-3 py-3 font-medium whitespace-nowrap">
									Abertura
								</th>
								<th class="px-3 py-3 font-medium hidden sm:table-cell">
									Operador
								</th>
								<th class="px-3 py-3 font-medium text-right hidden md:table-cell">
									Saldo Inicial
								</th>
								<th class="px-3 py-3 font-medium text-right hidden lg:table-cell">
									Pagamentos
								</th>
								<th class="px-3 py-3 font-medium text-right">Esperado</th>
								<th class="px-3 py-3 font-medium text-right">Declarado</th>
								<th class="px-3 py-3 font-medium text-right">Diferenca</th>
								<th class="px-3 py-3 font-medium text-center">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{registers.map((r) => (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-3 py-2 whitespace-nowrap text-xs">
										{formatDateTime(r.opened_at)}
									</td>
									<td class="px-3 py-2 hidden sm:table-cell">
										{r.opened_by_name}
									</td>
									<td class="px-3 py-2 text-right text-sk-muted hidden md:table-cell">
										{formatCurrency(r.opening_balance_cents)}
									</td>
									<td class="px-3 py-2 text-right text-sk-muted hidden lg:table-cell">
										{formatCurrency(r.rental_payment_cents)}
									</td>
									<td class="px-3 py-2 text-right">
										{r.expected_balance_cents !== null
											? formatCurrency(r.expected_balance_cents)
											: "—"}
									</td>
									<td class="px-3 py-2 text-right">
										{r.closing_balance_cents !== null
											? formatCurrency(r.closing_balance_cents)
											: "—"}
									</td>
									<td
										class={`px-3 py-2 text-right font-medium ${discrepancyClass(r.discrepancy_cents)}`}
									>
										{r.discrepancy_cents !== null
											? `${r.discrepancy_cents >= 0 ? "+" : ""}${formatCurrency(r.discrepancy_cents)}`
											: "—"}
									</td>
									<td class="px-3 py-2 text-center">
										<span
											class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
												r.status === "open"
													? "bg-sk-green-light text-sk-green-dark"
													: "bg-gray-100 text-sk-muted"
											}`}
										>
											{r.status === "open" ? "Aberto" : "Fechado"}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{registers.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">
						Nenhum caixa encontrado no período.
					</p>
				</div>
			)}

			{/* Pagination */}
			{totalPages > 1 && (
				<div class="flex items-center justify-between mt-4 text-sm font-body">
					<span class="text-sk-muted">
						Pagina {page} de {totalPages} ({total} registros)
					</span>
					<div class="flex gap-2">
						{page > 1 && (
							<a
								href={`/admin/reports/cash?from=${from}&to=${to}&page=${page - 1}`}
								class="px-3 py-1 bg-sk-surface border border-sk-border rounded-sk text-sk-muted hover:bg-sk-yellow-light"
							>
								Anterior
							</a>
						)}
						{page < totalPages && (
							<a
								href={`/admin/reports/cash?from=${from}&to=${to}&page=${page + 1}`}
								class="px-3 py-1 bg-sk-surface border border-sk-border rounded-sk text-sk-muted hover:bg-sk-yellow-light"
							>
								Proximo
							</a>
						)}
					</div>
				</div>
			)}
		</ReportLayout>
	);
};
