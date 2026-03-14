import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency, formatDateTime } from "../../lib/report-utils";
import type { UnpaidSession } from "../../db/queries/reports";

interface Props {
	sessions: UnpaidSession[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

export const UnpaidReportView: FC<Props> = ({ sessions, from, to, user }) => {
	const courtesies = sessions.filter((s) => s.payment_method === "courtesy");
	const pending = sessions.filter((s) => s.payment_method !== "courtesy");
	const lostValue = courtesies.reduce((s, c) => s + c.amount_cents, 0);

	return (
		<ReportLayout
			title="Nao Pagos / Cortesias"
			user={user}
			activeReport="/admin/reports/unpaid"
			from={from}
			to={to}
		>
			{/* KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Cortesias</p>
					<p class="text-xl font-display font-bold text-sk-purple">
						{courtesies.length}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Pagamentos Pendentes</p>
					<p class="text-xl font-display font-bold text-sk-yellow-dark">
						{pending.length}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center col-span-2 md:col-span-1">
					<p class="text-xs text-sk-muted font-body mb-1">Valor Perdido (Cortesias)</p>
					<p class="text-xl font-display font-bold text-sk-danger">
						{formatCurrency(lostValue)}
					</p>
				</div>
			</div>

			{/* Table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
						<tr>
							<th class="px-4 py-3 font-medium">Data</th>
							<th class="px-4 py-3 font-medium hidden sm:table-cell">Crianca</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Responsavel</th>
							<th class="px-4 py-3 font-medium hidden sm:table-cell">Ativo</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Pacote</th>
							<th class="px-4 py-3 font-medium text-right">Valor</th>
							<th class="px-4 py-3 font-medium">Tipo</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Motivo</th>
							<th class="px-4 py-3 font-medium hidden lg:table-cell">Operador</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{sessions.map((s) => {
							const isCourtesy = s.payment_method === "courtesy";
							return (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-4 py-3 text-sk-muted whitespace-nowrap">
										{formatDateTime(s.start_time)}
									</td>
									<td class="px-4 py-3 hidden sm:table-cell">
										{s.child_name ?? "—"}
									</td>
									<td class="px-4 py-3 hidden md:table-cell text-sk-muted">
										{s.customer_name ?? "—"}
									</td>
									<td class="px-4 py-3 hidden sm:table-cell text-sk-muted">
										{s.asset_name}
									</td>
									<td class="px-4 py-3 hidden md:table-cell text-sk-muted">
										{s.package_name}
									</td>
									<td class="px-4 py-3 text-right font-medium">
										{formatCurrency(s.amount_cents)}
									</td>
									<td class="px-4 py-3">
										<span
											class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
												isCourtesy
													? "bg-sk-purple-light text-sk-purple"
													: "bg-sk-yellow-light text-sk-yellow-dark"
											}`}
										>
											{isCourtesy ? "Cortesia" : "Pendente"}
										</span>
									</td>
									<td class="px-4 py-3 hidden md:table-cell text-sk-muted text-xs max-w-[200px] truncate">
										{s.notes ?? "—"}
									</td>
									<td class="px-4 py-3 hidden lg:table-cell text-sk-muted">
										{s.attendant_name ?? "—"}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{sessions.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">
						Nenhuma cortesia ou pagamento pendente no periodo.
					</p>
				</div>
			)}
		</ReportLayout>
	);
};
