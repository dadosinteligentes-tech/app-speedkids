import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import type { AssetUtilization } from "../../db/queries/reports";
import type { Tenant } from "../../db/schema";

interface Props {
	assets: AssetUtilization[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const TYPE_BADGE = "bg-sk-blue-light text-sk-blue-dark";

function utilizationColor(pct: number): string {
	if (pct >= 50) return "bg-sk-green";
	if (pct >= 20) return "bg-sk-yellow-dark";
	return "bg-sk-danger";
}

export const AssetUtilizationView: FC<Props> = ({
	assets,
	from,
	to,
	user,
	tenant,
	isPlatformAdmin, planFeatures,
}) => {
	const totalRevenue = assets.reduce((s, a) => s + a.revenue_cents, 0);
	const totalRentals = assets.reduce((s, a) => s + a.rental_count, 0);

	return (
		<ReportLayout
			title="Utilizacao de Ativos"
			user={user}
			activeReport="/admin/reports/assets"
			from={from}
			to={to}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}
		>
			{/* Summary KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Ativos Analisados</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{assets.length}
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

			{/* Asset table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
						<tr>
							<th class="px-4 py-3 font-medium">Ativo</th>
							<th class="px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
							<th class="px-4 py-3 font-medium text-right">Locações</th>
							<th class="px-4 py-3 font-medium text-right hidden sm:table-cell">
								Minutos
							</th>
							<th class="px-4 py-3 font-medium text-right">Receita</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">
								Utilizacao
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{assets.map((a) => (
							<tr
								class={`hover:bg-sk-yellow-light ${a.rental_count === 0 ? "opacity-40" : "cursor-pointer"}`}
								onclick={a.rental_count > 0 ? `window.location='/admin/reports/detail?filter=asset&id=${a.asset_id}&from=${from}&to=${to}'` : undefined}
							>
								<td class="px-4 py-3 font-medium">{a.asset_name} {a.rental_count > 0 && <span class="text-sk-muted text-xs">&#8250;</span>}</td>
								<td class="px-4 py-3 hidden sm:table-cell">
									<span
										class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE}`}
									>
										{a.asset_type}
									</span>
								</td>
								<td class="px-4 py-3 text-right">{a.rental_count}</td>
								<td class="px-4 py-3 text-right text-sk-muted hidden sm:table-cell">
									{a.total_minutes}
								</td>
								<td class="px-4 py-3 text-right font-medium">
									{formatCurrency(a.revenue_cents)}
								</td>
								<td class="px-4 py-3 hidden md:table-cell">
									<div class="flex items-center gap-2">
										<div class="flex-1 bg-sk-yellow-light rounded-full h-2 overflow-hidden">
											<div
												class={`h-full rounded-full ${utilizationColor(a.utilization_pct)}`}
												style={`width:${Math.max(a.utilization_pct, 1)}%`}
											/>
										</div>
										<span class="text-xs text-sk-muted w-8 text-right">
											{a.utilization_pct}%
										</span>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{assets.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">Nenhum ativo cadastrado.</p>
				</div>
			)}

			{/* Legend */}
			<div class="mt-4 flex flex-wrap gap-4 text-xs font-body text-sk-muted">
				<span class="flex items-center gap-1">
					<span class="w-3 h-3 rounded-full bg-sk-green inline-block" />
					Alta (&ge;50%)
				</span>
				<span class="flex items-center gap-1">
					<span class="w-3 h-3 rounded-full bg-sk-yellow-dark inline-block" />
					Media (20-49%)
				</span>
				<span class="flex items-center gap-1">
					<span class="w-3 h-3 rounded-full bg-sk-danger inline-block" />
					Baixa (&lt;20%)
				</span>
				<span class="text-sk-muted/70">
					* Base: 8h/dia de operacao
				</span>
			</div>
		</ReportLayout>
	);
};
