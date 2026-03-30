import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency, formatDateTime } from "../../lib/report-utils";
import type { ShiftReport } from "../../db/queries/reports";
import type { Tenant } from "../../db/schema";

interface Props {
	shifts: ShiftReport[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

export const ShiftReportView: FC<Props> = ({ shifts, from, to, user, tenant, isPlatformAdmin, planFeatures }) => {
	const totalShifts = shifts.length;
	const totalRentals = shifts.reduce((s, r) => s + r.rental_count, 0);
	const totalRevenue = shifts.reduce((s, r) => s + r.revenue_cents, 0);

	return (
		<ReportLayout
			title="Turnos"
			user={user}
			activeReport="/admin/reports/shifts"
			isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}
			from={from}
			to={to}
			tenant={tenant}
		>
			{/* Summary KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Turnos</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{totalShifts}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Locações</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{totalRentals}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center col-span-2 md:col-span-1">
					<p class="text-xs text-sk-muted font-body mb-1">Receita Total</p>
					<p class="text-xl font-display font-bold text-sk-orange">
						{formatCurrency(totalRevenue)}
					</p>
				</div>
			</div>

			{/* Shift table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
							<tr>
								<th class="px-4 py-3 font-medium">Turno</th>
								<th class="px-4 py-3 font-medium">Operador</th>
								<th class="px-4 py-3 font-medium">Inicio</th>
								<th class="px-4 py-3 font-medium">Fim</th>
								<th class="px-4 py-3 font-medium text-right">Locações</th>
								<th class="px-4 py-3 font-medium text-right">Receita</th>
								<th class="px-4 py-3 font-medium text-right hidden md:table-cell">Dinheiro</th>
								<th class="px-4 py-3 font-medium text-right hidden md:table-cell">Credito</th>
								<th class="px-4 py-3 font-medium text-right hidden md:table-cell">Debito</th>
								<th class="px-4 py-3 font-medium text-right hidden lg:table-cell">PIX</th>
								<th class="px-4 py-3 font-medium text-right hidden lg:table-cell">Cortesias</th>
								<th class="px-4 py-3 font-medium text-center">Cupom</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{shifts.map((s) => (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-4 py-3 font-medium">
										<a href={`/admin/reports/detail?filter=shift&id=${s.shift_id}&from=${from}&to=${to}`} class="text-sk-blue-dark hover:underline">
											{s.shift_name ?? `Turno #${s.shift_id}`}
										</a>
									</td>
									<td class="px-4 py-3">{s.user_name}</td>
									<td class="px-4 py-3 text-sk-muted whitespace-nowrap">
										{formatDateTime(s.started_at)}
									</td>
									<td class="px-4 py-3 text-sk-muted whitespace-nowrap">
										{s.ended_at ? formatDateTime(s.ended_at) : (
											<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sk-green-light text-sk-green-dark">
												Ativo
											</span>
										)}
									</td>
									<td class="px-4 py-3 text-right">{s.rental_count}</td>
									<td class="px-4 py-3 text-right font-medium">
										{formatCurrency(s.revenue_cents)}
									</td>
									<td class="px-4 py-3 text-right text-sk-muted hidden md:table-cell">
										{formatCurrency(s.cash_cents)}
									</td>
									<td class="px-4 py-3 text-right text-sk-muted hidden md:table-cell">
										{formatCurrency(s.credit_cents)}
									</td>
									<td class="px-4 py-3 text-right text-sk-muted hidden md:table-cell">
										{formatCurrency(s.debit_cents)}
									</td>
									<td class="px-4 py-3 text-right text-sk-muted hidden lg:table-cell">
										{formatCurrency(s.pix_cents)}
									</td>
									<td class="px-4 py-3 text-right text-sk-muted hidden lg:table-cell">
										{s.courtesy_count}
									</td>
									<td class="px-4 py-3 text-center">
										<button
											onclick={`window.open('/receipts/shift/${s.shift_id}','_blank')`}
											class="text-sk-blue-dark hover:underline text-xs font-medium"
										>
											Imprimir
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{shifts.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">Nenhum turno encontrado no período.</p>
				</div>
			)}
		</ReportLayout>
	);
};
