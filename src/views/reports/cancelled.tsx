import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency, formatDateTime } from "../../lib/report-utils";
import type { CancelledSession } from "../../db/queries/reports";

interface Props {
	sessions: CancelledSession[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

export const CancelledReportView: FC<Props> = ({ sessions, from, to, user }) => {
	const totalCancelled = sessions.length;
	const totalValue = sessions.reduce((s, c) => s + c.amount_cents, 0);

	return (
		<ReportLayout
			title="Cancelados"
			user={user}
			activeReport="/admin/reports/cancelled"
			from={from}
			to={to}
		>
			{/* KPIs */}
			<div class="grid grid-cols-2 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Cancelamentos</p>
					<p class="text-xl font-display font-bold text-sk-danger">
						{totalCancelled}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Valor Cancelado</p>
					<p class="text-xl font-display font-bold text-sk-danger">
						{formatCurrency(totalValue)}
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
							<th class="px-4 py-3 font-medium hidden md:table-cell">Motivo</th>
							<th class="px-4 py-3 font-medium hidden lg:table-cell">Operador</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{sessions.map((s) => (
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
								<td class="px-4 py-3 hidden md:table-cell text-sk-muted text-xs max-w-[200px] truncate">
									{s.notes ?? "—"}
								</td>
								<td class="px-4 py-3 hidden lg:table-cell text-sk-muted">
									{s.attendant_name ?? "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{sessions.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">
						Nenhum cancelamento no período.
					</p>
				</div>
			)}
		</ReportLayout>
	);
};
