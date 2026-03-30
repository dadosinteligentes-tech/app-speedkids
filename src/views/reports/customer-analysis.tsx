import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { HBar, formatCurrency } from "../../lib/report-utils";
import type {
	TopCustomer,
	AgeGroup,
	CustomerStats,
} from "../../db/queries/reports";
import type { Tenant } from "../../db/schema";

interface Props {
	topByRevenue: TopCustomer[];
	topByFrequency: TopCustomer[];
	ageGroups: AgeGroup[];
	stats: CustomerStats;
	from: string;
	to: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const AGE_COLORS: Record<string, string> = {
	"1-2": "bg-sk-purple",
	"3-5": "bg-sk-green",
	"6-8": "bg-sk-blue",
	"9-12": "bg-sk-orange",
	"13+": "bg-sk-yellow-dark",
	Outros: "bg-sk-muted",
};

export const CustomerAnalysisView: FC<Props> = ({
	topByRevenue,
	topByFrequency,
	ageGroups,
	stats,
	from,
	to,
	user,
	tenant,
	isPlatformAdmin, planFeatures,
}) => {
	const maxAgeCount = Math.max(...ageGroups.map((a) => a.count), 1);

	return (
		<ReportLayout
			title="Analise de Clientes"
			user={user}
			activeReport="/admin/reports/customers"
			from={from}
			to={to}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}
		>
			{/* KPI Row */}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">
						Clientes no Periodo
					</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{stats.total_customers}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Novos</p>
					<p class="text-xl font-display font-bold text-sk-green-dark">
						{stats.new_customers}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Recorrentes</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{stats.returning_customers}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Gasto Medio</p>
					<p class="text-xl font-display font-bold text-sk-orange">
						{formatCurrency(stats.avg_spent_cents)}
					</p>
				</div>
			</div>

			{/* Top customers */}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
				{/* Top by Revenue */}
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<div class="px-4 py-3 bg-sk-yellow-light/50">
						<h3 class="text-sm font-display font-bold text-sk-text">
							Top 10 por Receita
						</h3>
					</div>
					<table class="w-full text-sm font-body">
						<thead class="text-sk-muted">
							<tr>
								<th class="px-4 py-2 text-left font-medium">#</th>
								<th class="px-4 py-2 text-left font-medium">Cliente</th>
								<th class="px-4 py-2 text-right font-medium">Receita</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{topByRevenue.map((c, i) => (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-4 py-2 text-sk-muted">{i + 1}</td>
									<td class="px-4 py-2">
										<a
											href={`/customers/${c.customer_id}`}
											class="text-sk-blue-dark hover:underline font-medium"
										>
											{c.customer_name}
										</a>
										{c.phone && (
											<span class="text-xs text-sk-muted ml-1">
												{c.phone}
											</span>
										)}
									</td>
									<td class="px-4 py-2 text-right font-medium">
										{formatCurrency(c.revenue_cents)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{topByRevenue.length === 0 && (
						<p class="p-4 text-center text-sk-muted text-xs">
							Sem dados no período.
						</p>
					)}
				</div>

				{/* Top by Frequency */}
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<div class="px-4 py-3 bg-sk-yellow-light/50">
						<h3 class="text-sm font-display font-bold text-sk-text">
							Top 10 por Frequencia
						</h3>
					</div>
					<table class="w-full text-sm font-body">
						<thead class="text-sk-muted">
							<tr>
								<th class="px-4 py-2 text-left font-medium">#</th>
								<th class="px-4 py-2 text-left font-medium">Cliente</th>
								<th class="px-4 py-2 text-right font-medium">Visitas</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{topByFrequency.map((c, i) => (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-4 py-2 text-sk-muted">{i + 1}</td>
									<td class="px-4 py-2">
										<a
											href={`/customers/${c.customer_id}`}
											class="text-sk-blue-dark hover:underline font-medium"
										>
											{c.customer_name}
										</a>
										{c.phone && (
											<span class="text-xs text-sk-muted ml-1">
												{c.phone}
											</span>
										)}
									</td>
									<td class="px-4 py-2 text-right font-medium">
										{c.rental_count}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{topByFrequency.length === 0 && (
						<p class="p-4 text-center text-sk-muted text-xs">
							Sem dados no período.
						</p>
					)}
				</div>
			</div>

			{/* Age demographics */}
			{ageGroups.length > 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4">
					<h3 class="text-sm font-display font-bold text-sk-text mb-3">
						Distribuicao por Faixa Etaria
					</h3>
					{ageGroups.map((ag) => (
						<HBar
							label={`${ag.age_group} anos`}
							value={ag.count}
							pct={Math.round((ag.count / maxAgeCount) * 100)}
							display={`${ag.count} criancas`}
							color={AGE_COLORS[ag.age_group] ?? "bg-sk-muted"}
						/>
					))}
				</div>
			)}
		</ReportLayout>
	);
};
