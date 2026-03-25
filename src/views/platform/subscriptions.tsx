import type { FC } from "hono/jsx";
import { PlatformLayout } from "./layout";

interface SubscriptionsProps {
	subscriptions: Array<{ id: number; tenant_id: number; stripe_customer_id: string | null; stripe_subscription_id: string | null; plan: string; status: string; current_period_start: string | null; current_period_end: string | null; created_at: string; tenant_name: string; tenant_slug: string }>;
	user: { name: string; email: string } | null;
	mrr_cents: number;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const PLAN_COLORS: Record<string, string> = {
	starter: "bg-sk-bg text-sk-muted",
	pro: "bg-sk-blue-light text-sk-blue-dark",
	enterprise: "bg-sk-purple-light text-sk-purple",
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	active: { bg: "bg-sk-green-light", text: "text-sk-green-dark", label: "Ativo" },
	trialing: { bg: "bg-sk-blue-light", text: "text-sk-blue-dark", label: "Trial" },
	past_due: { bg: "bg-sk-yellow-light", text: "text-sk-yellow-dark", label: "Atrasado" },
	canceled: { bg: "bg-sk-danger-light", text: "text-sk-danger", label: "Cancelado" },
	unpaid: { bg: "bg-sk-danger-light", text: "text-sk-danger", label: "Nao pago" },
	incomplete: { bg: "bg-sk-bg", text: "text-sk-muted", label: "Incompleto" },
};

function truncateId(id: string | null): string {
	if (!id) return "\u2014";
	if (id.length <= 20) return id;
	return id.slice(0, 18) + "\u2026";
}

export const PlatformSubscriptions: FC<SubscriptionsProps> = ({ subscriptions, user, mrr_cents }) => {
	const activeCount = subscriptions.filter((s) => s.status === "active" || s.status === "trialing").length;

	return (
		<PlatformLayout
			title="Assinaturas"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Assinaturas" }]}
		>
			{/* Summary Cards */}
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Total Assinaturas</p>
					<p class="text-3xl font-bold font-display text-sk-text">{subscriptions.length}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Ativas</p>
					<p class="text-3xl font-bold font-display text-sk-green-dark">{activeCount}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 border-sk-green-light">
					<p class="text-xs text-sk-green font-display font-medium uppercase tracking-wider mb-1">MRR</p>
					<p class="text-2xl font-bold font-display text-sk-green-dark">{fmtBRL(mrr_cents)}</p>
					<p class="text-xs text-sk-muted font-body mt-1">receita mensal recorrente</p>
				</div>
			</div>

			{/* Subscriptions Table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
					<h2 class="font-semibold font-display text-sk-text">Assinaturas</h2>
					<span class="text-xs text-sk-muted font-body">{subscriptions.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-5 py-3 font-medium font-display">Tenant</th>
								<th class="px-5 py-3 font-medium font-display">Plano</th>
								<th class="px-5 py-3 font-medium font-display">Status</th>
								<th class="px-5 py-3 font-medium font-display">Stripe ID</th>
								<th class="px-5 py-3 font-medium font-display">Periodo</th>
								<th class="px-5 py-3 font-medium font-display">Criado em</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{subscriptions.map((s) => {
								const planColor = PLAN_COLORS[s.plan] || PLAN_COLORS.starter;
								const badge = STATUS_BADGE[s.status] || { bg: "bg-sk-bg", text: "text-sk-muted", label: s.status };
								const periodStart = s.current_period_start ? s.current_period_start.slice(0, 10) : "\u2014";
								const periodEnd = s.current_period_end ? s.current_period_end.slice(0, 10) : "\u2014";
								return (
									<tr class="hover:bg-sk-blue-light/30 transition-colors">
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${s.tenant_id}`} class="font-medium font-display text-sk-text hover:text-sk-blue transition-colors">
												{s.tenant_name}
											</a>
											<p class="text-xs text-sk-muted font-body">{s.tenant_slug}</p>
										</td>
										<td class="px-5 py-3">
											<span class={`${planColor} px-2 py-0.5 rounded text-xs font-medium font-display`}>
												{s.plan.charAt(0).toUpperCase() + s.plan.slice(1)}
											</span>
										</td>
										<td class="px-5 py-3">
											<span class={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>
												{badge.label}
											</span>
										</td>
										<td class="px-5 py-3 text-sk-muted text-xs font-mono" title={s.stripe_subscription_id || ""}>
											{truncateId(s.stripe_subscription_id)}
										</td>
										<td class="px-5 py-3 text-sk-muted text-xs tabular-nums font-body">
											{periodStart} &rarr; {periodEnd}
										</td>
										<td class="px-5 py-3 text-sk-muted text-xs tabular-nums font-body">
											{s.created_at?.slice(0, 10)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{subscriptions.length === 0 && (
						<div class="text-center py-12 text-sk-muted">
							<p class="text-sm font-body">Nenhuma assinatura encontrada</p>
						</div>
					)}
				</div>
			</div>
		</PlatformLayout>
	);
};
