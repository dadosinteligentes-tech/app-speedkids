import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import type { OperatorPerformance } from "../../db/queries/reports";

interface Props {
	operators: OperatorPerformance[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

const ROLE_LABELS: Record<string, string> = {
	operator: "Operador",
	manager: "Gerente",
	owner: "Socio",
};

const ROLE_COLORS: Record<string, string> = {
	operator: "bg-sk-blue-light text-sk-blue-dark",
	manager: "bg-sk-yellow-light text-sk-yellow-dark",
	owner: "bg-sk-orange-light text-sk-orange-dark",
};

function discrepancyClass(cents: number): string {
	if (cents === 0) return "text-sk-green-dark";
	if (cents <= 500) return "text-sk-yellow-dark";
	return "text-sk-danger";
}

export const OperatorPerformanceView: FC<Props> = ({
	operators,
	from,
	to,
	user,
}) => {
	const totalRevenue = operators.reduce((s, o) => s + o.revenue_cents, 0);
	const totalRentals = operators.reduce((s, o) => s + o.rentals_started, 0);

	return (
		<ReportLayout
			title="Desempenho por Operador"
			user={user}
			activeReport="/admin/reports/operators"
			from={from}
			to={to}
		>
			<div class="bg-sk-purple-light rounded-sk p-3 mb-4 text-xs font-body text-sk-purple">
				Este relatorio e exclusivo para socios. Os dados sao confidenciais.
			</div>

			{/* Summary KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Operadores Ativos</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{operators.length}
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

			{/* Operator table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
						<tr>
							<th class="px-4 py-3 font-medium">Nome</th>
							<th class="px-4 py-3 font-medium hidden sm:table-cell">
								Cargo
							</th>
							<th class="px-4 py-3 font-medium text-right">Locações</th>
							<th class="px-4 py-3 font-medium text-right">Receita</th>
							<th class="px-4 py-3 font-medium text-right hidden md:table-cell">
								Turnos
							</th>
							<th class="px-4 py-3 font-medium text-right hidden md:table-cell">
								Horas
							</th>
							<th class="px-4 py-3 font-medium text-right hidden lg:table-cell">
								Discrepancia
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{operators.map((o) => (
							<tr class="hover:bg-sk-yellow-light">
								<td class="px-4 py-3 font-medium">{o.user_name}</td>
								<td class="px-4 py-3 hidden sm:table-cell">
									<span
										class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[o.role] ?? "bg-gray-100 text-sk-muted"}`}
									>
										{ROLE_LABELS[o.role] ?? o.role}
									</span>
								</td>
								<td class="px-4 py-3 text-right">{o.rentals_started}</td>
								<td class="px-4 py-3 text-right font-medium">
									{formatCurrency(o.revenue_cents)}
								</td>
								<td class="px-4 py-3 text-right text-sk-muted hidden md:table-cell">
									{o.shift_count}
								</td>
								<td class="px-4 py-3 text-right text-sk-muted hidden md:table-cell">
									{o.shift_hours}h
								</td>
								<td
									class={`px-4 py-3 text-right font-medium hidden lg:table-cell ${discrepancyClass(Math.abs(o.cash_discrepancy_cents))}`}
								>
									{o.cash_discrepancy_cents === 0
										? "R$ 0,00"
										: formatCurrency(Math.abs(o.cash_discrepancy_cents))}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{operators.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">Nenhum operador ativo.</p>
				</div>
			)}
		</ReportLayout>
	);
};
