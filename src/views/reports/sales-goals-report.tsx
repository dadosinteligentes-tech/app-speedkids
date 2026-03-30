import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import { toBrazilDate, toBrazilDateTime } from "../../lib/timezone";
import type { GoalReportRow } from "../../db/queries/sales-goals";
import type { Tenant } from "../../db/schema";

interface Props {
	goals: GoalReportRow[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const GOAL_TYPE_LABELS: Record<string, string> = {
	revenue: "Receita",
	rental_count: "Qtd Locacoes",
	product_sale_count: "Qtd Vendas",
};

const PERIOD_LABELS: Record<string, string> = {
	daily: "Diaria",
	weekly: "Semanal",
	monthly: "Mensal",
	custom: "Personalizada",
};

function formatValue(value: number, goalType: string): string {
	return goalType === "revenue" ? formatCurrency(value) : String(value);
}

function progressColor(pct: number): string {
	if (pct >= 100) return "bg-sk-green";
	if (pct >= 75) return "bg-sk-blue";
	if (pct >= 50) return "bg-sk-yellow";
	return "bg-sk-orange";
}

function statusBadge(achieved: boolean, pct: number): string {
	if (achieved) return "bg-sk-green-light text-sk-green-dark";
	if (pct >= 75) return "bg-sk-blue-light text-sk-blue-dark";
	if (pct >= 50) return "bg-sk-yellow-light text-sk-yellow-dark";
	return "bg-sk-orange-light text-sk-orange-dark";
}

export const SalesGoalsReportView: FC<Props> = ({
	goals,
	from,
	to,
	user,
	tenant,
	isPlatformAdmin, planFeatures,
}) => {
	const achieved = goals.filter((g) => g.achieved).length;
	const total = goals.length;
	const avgPct = total > 0 ? Math.round(goals.reduce((s, g) => s + g.percentage, 0) / total) : 0;

	return (
		<ReportLayout
			title="Metas de Vendas"
			user={user}
			activeReport="/admin/reports/goals"
			from={from}
			to={to}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}
		>
			{/* Summary KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total de Metas</p>
					<p class="text-xl font-display font-bold text-sk-text">{total}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Alcancadas</p>
					<p class="text-xl font-display font-bold text-sk-green-dark">{achieved}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Pendentes</p>
					<p class="text-xl font-display font-bold text-sk-orange">{total - achieved}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Progresso Medio</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">{avgPct}%</p>
				</div>
			</div>

			{/* Goals table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
						<tr>
							<th class="px-4 py-3 font-medium">Meta</th>
							<th class="px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Periodo</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Responsavel</th>
							<th class="px-4 py-3 font-medium text-right">Progresso</th>
							<th class="px-4 py-3 font-medium text-right hidden sm:table-cell">Alvo</th>
							<th class="px-4 py-3 font-medium text-center">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{goals.map((g) => (
							<tr class="hover:bg-sk-yellow-light">
								<td class="px-4 py-3">
									<div class="font-medium">{g.title}</div>
									<div class="text-xs text-sk-muted">
										{toBrazilDate(g.start_date + "T12:00:00Z")} - {toBrazilDate(g.end_date + "T12:00:00Z")}
									</div>
								</td>
								<td class="px-4 py-3 hidden sm:table-cell text-sk-muted">
									{GOAL_TYPE_LABELS[g.goal_type] ?? g.goal_type}
								</td>
								<td class="px-4 py-3 hidden md:table-cell text-sk-muted">
									{PERIOD_LABELS[g.period_type] ?? g.period_type}
								</td>
								<td class="px-4 py-3 hidden md:table-cell text-sk-muted">
									{g.user_name ?? "Equipe"}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center gap-2 justify-end">
										<div class="w-20 bg-sk-yellow-light rounded-full h-2 overflow-hidden">
											<div
												class={`h-full ${progressColor(g.percentage)} rounded-full`}
												style={`width:${Math.max(g.percentage, 2)}%`}
											/>
										</div>
										<span class="font-medium w-10 text-right">{g.percentage}%</span>
									</div>
									<div class="text-xs text-sk-muted mt-0.5">
										{formatValue(g.current_value, g.goal_type)}
									</div>
								</td>
								<td class="px-4 py-3 text-right hidden sm:table-cell font-medium">
									{formatValue(g.target_value, g.goal_type)}
								</td>
								<td class="px-4 py-3 text-center">
									<span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(g.achieved, g.percentage)}`}>
										{g.achieved ? "Alcancada" : g.percentage >= 75 ? "Quase la" : g.percentage >= 50 ? "Progresso" : "Iniciando"}
									</span>
									{g.achieved_at && (
										<div class="text-xs text-sk-muted mt-0.5">
											{toBrazilDateTime(g.achieved_at)}
										</div>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{goals.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">Nenhuma meta encontrada no periodo selecionado.</p>
				</div>
			)}
		</ReportLayout>
	);
};
