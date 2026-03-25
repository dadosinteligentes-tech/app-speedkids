import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Tenant } from "../../db/schema";
import type { PlanLimits, TenantUsage } from "../../lib/plan-limits";
import { AdminLayout } from "./layout";

interface MyPlanProps {
	tenant?: Tenant | null;
	limits: PlanLimits;
	usage: TenantUsage;
	user: { name: string; role: string } | null;
	isPlatformAdmin?: boolean;
}

function pct(used: number, max: number): number {
	if (max <= 0) return 0;
	return Math.min(100, Math.round((used / max) * 100));
}

function barColor(used: number, max: number): string {
	const p = pct(used, max);
	if (p >= 90) return "bg-red-500";
	if (p >= 70) return "bg-yellow-500";
	return "bg-green-500";
}

export const MyPlan: FC<MyPlanProps> = ({ tenant, limits, usage, user, isPlatformAdmin }) => {
	const billingScript = html`<script>
${raw(`
function openBillingPortal() {
	var btn = document.getElementById('billing-btn');
	btn.disabled = true;
	btn.textContent = 'Abrindo...';
	fetch('/api/billing/portal')
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (data.url) {
				window.open(data.url, '_blank');
			} else {
				alert(data.error || 'Erro ao abrir portal');
			}
			btn.disabled = false;
			btn.textContent = 'Gerenciar assinatura';
		})
		.catch(function() {
			alert('Erro de conexão');
			btn.disabled = false;
			btn.textContent = 'Gerenciar assinatura';
		});
}
`)}
</script>`;

	return (
	<AdminLayout title="Meu Plano" user={user} activeTab="/admin/plan" tenant={tenant} isPlatformAdmin={isPlatformAdmin} bodyScripts={billingScript}>
		<div class="max-w-2xl">
			<h2 class="text-xl font-display font-bold text-sk-text mb-6">Meu Plano</h2>

			{/* Current plan */}
			<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-6">
				<div class="flex items-center justify-between mb-4">
					<div>
						<span class="text-sm text-sk-muted font-body">Plano atual</span>
						<h3 class="text-2xl font-display font-bold text-sk-text">{limits.label}</h3>
					</div>
					<span class="bg-sk-blue-light text-sk-blue-dark px-3 py-1 rounded-full text-sm font-display font-medium">
						{tenant?.status === "active" ? "Ativo" : tenant?.status}
					</span>
				</div>

				{/* Usage bars */}
				<div class="space-y-4">
					<div>
						<div class="flex justify-between text-sm font-body mb-1">
							<span class="text-sk-muted">Usuarios</span>
							<span class="font-medium">{usage.userCount} / {limits.maxUsers}</span>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-3">
							<div
								class={`h-3 rounded-full ${barColor(usage.userCount, limits.maxUsers)}`}
								style={`width: ${pct(usage.userCount, limits.maxUsers)}%`}
							></div>
						</div>
					</div>

					<div>
						<div class="flex justify-between text-sm font-body mb-1">
							<span class="text-sk-muted">Ativos (karts, bicicletas, etc.)</span>
							<span class="font-medium">{usage.assetCount} / {limits.maxAssets}</span>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-3">
							<div
								class={`h-3 rounded-full ${barColor(usage.assetCount, limits.maxAssets)}`}
								style={`width: ${pct(usage.assetCount, limits.maxAssets)}%`}
							></div>
						</div>
					</div>
				</div>
			</div>

			{/* Plan comparison */}
			<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6">
				<h3 class="font-display font-bold text-sk-text mb-4">Comparacao de planos</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="border-b text-left text-sk-muted">
								<th class="py-2 pr-4">Recurso</th>
								<th class="py-2 px-4 text-center">Starter</th>
								<th class="py-2 px-4 text-center">Pro</th>
								<th class="py-2 px-4 text-center">Enterprise</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							<tr>
								<td class="py-2 pr-4">Usuarios</td>
								<td class="py-2 px-4 text-center">3</td>
								<td class="py-2 px-4 text-center">10</td>
								<td class="py-2 px-4 text-center">Ilimitado</td>
							</tr>
							<tr>
								<td class="py-2 pr-4">Ativos</td>
								<td class="py-2 px-4 text-center">15</td>
								<td class="py-2 px-4 text-center">50</td>
								<td class="py-2 px-4 text-center">Ilimitado</td>
							</tr>
							<tr>
								<td class="py-2 pr-4">Relatorios</td>
								<td class="py-2 px-4 text-center">Basicos</td>
								<td class="py-2 px-4 text-center">Completos</td>
								<td class="py-2 px-4 text-center">Completos + Export</td>
							</tr>
							<tr>
								<td class="py-2 pr-4">Logo/cores proprias</td>
								<td class="py-2 px-4 text-center text-sk-muted">—</td>
								<td class="py-2 px-4 text-center text-sk-green-dark">✓</td>
								<td class="py-2 px-4 text-center text-sk-green-dark">✓</td>
							</tr>
							<tr>
								<td class="py-2 pr-4">Preco</td>
								<td class="py-2 px-4 text-center font-medium">R$ 97/mes</td>
								<td class="py-2 px-4 text-center font-medium">R$ 197/mes</td>
								<td class="py-2 px-4 text-center font-medium">R$ 397/mes</td>
							</tr>
						</tbody>
					</table>
				</div>
				{user?.role === "owner" && (
					<div class="mt-6 pt-4 border-t border-sk-border/30">
						<button
							id="billing-btn"
							onclick="openBillingPortal()"
							class="btn-touch btn-bounce w-full py-3 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-base shadow-sk-sm disabled:opacity-50 transition-colors"
						>
							Gerenciar assinatura
						</button>
						<p class="text-xs text-sk-muted mt-2 text-center font-body">
							Altere seu plano, atualize forma de pagamento ou cancele sua assinatura.
						</p>
					</div>
				)}
			</div>
		</div>
	</AdminLayout>
	);
};
