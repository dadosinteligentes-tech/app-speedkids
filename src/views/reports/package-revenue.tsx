import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import type { PackageRevenue } from "../../db/queries/reports";
import type { Tenant } from "../../db/schema";

interface Props {
	packages: PackageRevenue[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

export const PackageRevenueView: FC<Props> = ({
	packages,
	from,
	to,
	user,
	tenant,
	isPlatformAdmin,
}) => {
	const totalRevenue = packages.reduce((s, p) => s + p.revenue_cents, 0);
	const totalRentals = packages.reduce((s, p) => s + p.rental_count, 0);

	return (
		<ReportLayout
			title="Faturamento por Pacote"
			user={user}
			activeReport="/admin/reports/packages"
			from={from}
			to={to}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin}
		>
			{/* Summary KPIs */}
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Receita Total</p>
					<p class="text-xl font-display font-bold text-sk-orange">
						{formatCurrency(totalRevenue)}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Locações</p>
					<p class="text-xl font-display font-bold text-sk-text">
						{totalRentals}
					</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center col-span-2 md:col-span-1">
					<p class="text-xs text-sk-muted font-body mb-1">Pacotes Vendidos</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{packages.filter((p) => p.rental_count > 0).length} de{" "}
						{packages.length}
					</p>
				</div>
			</div>

			{/* Package table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
						<tr>
							<th class="px-4 py-3 font-medium">Pacote</th>
							<th class="px-4 py-3 font-medium text-right hidden sm:table-cell">
								Duracao
							</th>
							<th class="px-4 py-3 font-medium text-right hidden sm:table-cell">
								Preco Unit.
							</th>
							<th class="px-4 py-3 font-medium text-right">Locações</th>
							<th class="px-4 py-3 font-medium text-right">Receita</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">
								Participacao
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{packages.map((p) => (
							<tr
								class={`hover:bg-sk-yellow-light ${p.rental_count === 0 ? "opacity-40" : "cursor-pointer"}`}
								onclick={p.rental_count > 0 ? `window.location='/admin/reports/detail?filter=package&id=${p.package_id}&from=${from}&to=${to}'` : undefined}
							>
								<td class="px-4 py-3 font-medium">{p.package_name} {p.rental_count > 0 && <span class="text-sk-muted text-xs">&#8250;</span>}</td>
								<td class="px-4 py-3 text-right text-sk-muted hidden sm:table-cell">
									{p.duration_minutes} min
								</td>
								<td class="px-4 py-3 text-right text-sk-muted hidden sm:table-cell">
									{formatCurrency(p.price_cents)}
								</td>
								<td class="px-4 py-3 text-right">{p.rental_count}</td>
								<td class="px-4 py-3 text-right font-medium">
									{formatCurrency(p.revenue_cents)}
								</td>
								<td class="px-4 py-3 hidden md:table-cell">
									<div class="flex items-center gap-2">
										<div class="flex-1 bg-sk-yellow-light rounded-full h-2 overflow-hidden">
											<div
												class="h-full bg-sk-orange rounded-full"
												style={`width:${p.revenue_pct}%`}
											/>
										</div>
										<span class="text-xs text-sk-muted w-8 text-right">
											{p.revenue_pct}%
										</span>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{packages.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mt-4">
					<p class="text-sk-muted font-body">Nenhum pacote cadastrado.</p>
				</div>
			)}
		</ReportLayout>
	);
};
