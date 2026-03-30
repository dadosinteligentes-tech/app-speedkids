import type { FC } from "hono/jsx";
import { PlatformLayout } from "./layout";

interface PlatformLoyaltyProps {
	stats: {
		tenantsWithLoyalty: number;
		totalVerifiedCustomers: number;
		totalPointsIssued: number;
		totalPointsRedeemed: number;
	};
	tenants: {
		id: number;
		name: string;
		slug: string;
		plan: string;
		loyalty_enabled: number;
		verified_customers: number;
		points_issued: number;
		points_redeemed: number;
	}[];
	user: { name: string; email: string } | null;
}

export const PlatformLoyalty: FC<PlatformLoyaltyProps> = ({ stats, tenants, user }) => (
	<PlatformLayout
		title="Fidelidade"
		user={user}
		breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Fidelidade" }]}
	>
		{/* Stats cards */}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
			<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
				<p class="text-2xl font-display font-bold text-sk-blue">{stats.tenantsWithLoyalty}</p>
				<p class="text-xs font-body text-sk-muted">Tenants com fidelidade</p>
			</div>
			<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
				<p class="text-2xl font-display font-bold text-sk-green">{stats.totalVerifiedCustomers}</p>
				<p class="text-xs font-body text-sk-muted">Clientes verificados</p>
			</div>
			<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
				<p class="text-2xl font-display font-bold text-sk-orange">{stats.totalPointsIssued.toLocaleString("pt-BR")}</p>
				<p class="text-xs font-body text-sk-muted">Pontos emitidos</p>
			</div>
			<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
				<p class="text-2xl font-display font-bold text-sk-purple">{stats.totalPointsRedeemed.toLocaleString("pt-BR")}</p>
				<p class="text-xs font-body text-sk-muted">Pontos resgatados</p>
			</div>
		</div>

		{/* Tenants table */}
		<div class="bg-sk-surface rounded-sk-lg shadow-sk-sm border border-sk-border/50 overflow-hidden">
			<div class="px-5 py-4 border-b border-sk-border/30">
				<h2 class="font-display font-bold text-lg text-sk-text">Adoção por Tenant</h2>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm font-body">
					<thead>
						<tr class="bg-sk-bg text-left">
							<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Tenant</th>
							<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Plano</th>
							<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Status</th>
							<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right">Verificados</th>
							<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right hidden md:table-cell">Emitidos</th>
							<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right hidden md:table-cell">Resgatados</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-sk-border/30">
						{tenants.map((t) => (
							<tr class="hover:bg-sk-blue-light/20 transition-colors">
								<td class="px-4 py-3">
									<a href={`/platform/tenants/${t.id}`} class="font-display font-bold text-sk-text hover:text-sk-blue text-sm">{t.name}</a>
									<p class="text-xs text-sk-muted">{t.slug}</p>
								</td>
								<td class="px-4 py-3">
									<span class={`px-2 py-0.5 rounded text-xs font-medium font-display ${
										t.plan === "enterprise" ? "bg-sk-purple-light text-sk-purple" :
										t.plan === "pro" ? "bg-sk-blue-light text-sk-blue-dark" :
										"bg-sk-yellow-light text-sk-yellow-dark"
									}`}>{t.plan}</span>
								</td>
								<td class="px-4 py-3">
									{t.loyalty_enabled ? (
										<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-green-light text-sk-green-dark">Ativo</span>
									) : (
										<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-bg text-sk-muted">Inativo</span>
									)}
								</td>
								<td class="px-4 py-3 text-right font-display font-bold">{t.verified_customers}</td>
								<td class="px-4 py-3 text-right hidden md:table-cell text-sk-orange font-display">{t.points_issued.toLocaleString("pt-BR")}</td>
								<td class="px-4 py-3 text-right hidden md:table-cell text-sk-purple font-display">{t.points_redeemed.toLocaleString("pt-BR")}</td>
							</tr>
						))}
						{tenants.length === 0 && (
							<tr><td colspan={6} class="px-4 py-8 text-center text-sk-muted">Nenhum tenant encontrado</td></tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	</PlatformLayout>
);
