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
	starter: "bg-gray-100 text-gray-600",
	pro: "bg-blue-100 text-blue-700",
	enterprise: "bg-purple-100 text-purple-700",
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	active: { bg: "bg-green-100", text: "text-green-700", label: "Ativo" },
	trialing: { bg: "bg-blue-100", text: "text-blue-700", label: "Trial" },
	past_due: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Atrasado" },
	canceled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelado" },
	unpaid: { bg: "bg-red-100", text: "text-red-700", label: "Nao pago" },
	incomplete: { bg: "bg-gray-100", text: "text-gray-600", label: "Incompleto" },
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
				<div class="bg-white rounded-xl p-5 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Total Assinaturas</p>
					<p class="text-3xl font-bold text-gray-900">{subscriptions.length}</p>
				</div>
				<div class="bg-white rounded-xl p-5 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Ativas</p>
					<p class="text-3xl font-bold text-green-700">{activeCount}</p>
				</div>
				<div class="bg-white rounded-xl p-5 shadow-sm border border-green-100">
					<p class="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">MRR</p>
					<p class="text-2xl font-bold text-green-700">{fmtBRL(mrr_cents)}</p>
					<p class="text-xs text-gray-400 mt-1">receita mensal recorrente</p>
				</div>
			</div>

			{/* Subscriptions Table */}
			<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
				<div class="px-6 py-4 border-b flex items-center justify-between">
					<h2 class="font-semibold text-gray-900">Assinaturas</h2>
					<span class="text-xs text-gray-400">{subscriptions.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
								<th class="px-5 py-3 font-medium">Tenant</th>
								<th class="px-5 py-3 font-medium">Plano</th>
								<th class="px-5 py-3 font-medium">Status</th>
								<th class="px-5 py-3 font-medium">Stripe ID</th>
								<th class="px-5 py-3 font-medium">Periodo</th>
								<th class="px-5 py-3 font-medium">Criado em</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{subscriptions.map((s) => {
								const planColor = PLAN_COLORS[s.plan] || PLAN_COLORS.starter;
								const badge = STATUS_BADGE[s.status] || { bg: "bg-gray-100", text: "text-gray-600", label: s.status };
								const periodStart = s.current_period_start ? s.current_period_start.slice(0, 10) : "\u2014";
								const periodEnd = s.current_period_end ? s.current_period_end.slice(0, 10) : "\u2014";
								return (
									<tr class="hover:bg-blue-50/30 transition-colors">
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${s.tenant_id}`} class="font-medium text-gray-900 hover:text-blue-600 transition-colors">
												{s.tenant_name}
											</a>
											<p class="text-xs text-gray-400">{s.tenant_slug}</p>
										</td>
										<td class="px-5 py-3">
											<span class={`${planColor} px-2 py-0.5 rounded text-xs font-medium`}>
												{s.plan.charAt(0).toUpperCase() + s.plan.slice(1)}
											</span>
										</td>
										<td class="px-5 py-3">
											<span class={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium`}>
												{badge.label}
											</span>
										</td>
										<td class="px-5 py-3 text-gray-400 text-xs font-mono" title={s.stripe_subscription_id || ""}>
											{truncateId(s.stripe_subscription_id)}
										</td>
										<td class="px-5 py-3 text-gray-500 text-xs tabular-nums">
											{periodStart} &rarr; {periodEnd}
										</td>
										<td class="px-5 py-3 text-gray-400 text-xs tabular-nums">
											{s.created_at?.slice(0, 10)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{subscriptions.length === 0 && (
						<div class="text-center py-12 text-gray-400">
							<p class="text-sm">Nenhuma assinatura encontrada</p>
						</div>
					)}
				</div>
			</div>
		</PlatformLayout>
	);
};
