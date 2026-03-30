import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Tenant } from "../../db/schema";
import type { PlanLimits, TenantUsage } from "../../lib/plan-limits";
import type { PlanConfig } from "../../db/queries/platform";
import { AdminLayout } from "./layout";

interface MyPlanProps {
	tenant?: Tenant | null;
	limits: PlanLimits;
	usage: TenantUsage;
	user: { name: string; role: string } | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
	plans: Record<string, PlanConfig>;
	hasStripeSubscription: boolean;
	domain: string;
}

function pct(used: number, max: number): number {
	if (max <= 0) return 0;
	return Math.min(100, Math.round((used / max) * 100));
}

function barColor(used: number, max: number): string {
	const p = pct(used, max);
	if (p >= 90) return "bg-sk-danger";
	if (p >= 70) return "bg-sk-yellow";
	return "bg-sk-green";
}

function fmtBRL(cents: number): string {
	const reais = Math.floor(cents / 100);
	const centavos = cents % 100;
	const r = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	return centavos > 0 ? `R$ ${r},${centavos.toString().padStart(2, "0")}` : `R$ ${r}`;
}

const PLAN_ORDER = ["starter", "pro", "enterprise"];
const PLAN_STYLES: Record<string, { border: string; btnClass: string }> = {
	starter: { border: "border-sk-border/50", btnClass: "bg-sk-yellow hover:bg-sk-yellow-dark text-sk-text" },
	pro: { border: "border-sk-blue ring-2 ring-sk-blue", btnClass: "bg-sk-blue hover:bg-sk-blue-dark text-white" },
	enterprise: { border: "border-sk-border/50", btnClass: "bg-sk-purple hover:bg-sk-purple/80 text-white" },
};

export const MyPlan: FC<MyPlanProps> = ({ tenant, limits, usage, user, isPlatformAdmin, plans, hasStripeSubscription, domain }) => {
	const currentPlan = tenant?.plan || "starter";

	const script = html`<script>
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
				showToast(data.error || 'Erro ao abrir portal', 'error');
			}
			btn.disabled = false;
			btn.textContent = 'Gerenciar assinatura';
		})
		.catch(function() {
			showToast('Erro de conexão', 'error');
			btn.disabled = false;
			btn.textContent = 'Gerenciar assinatura';
		});
}

function upgradePlan(plan) {
	var btn = document.getElementById('upgrade-btn-' + plan);
	if (!btn) return;
	btn.disabled = true;
	btn.textContent = 'Redirecionando...';

	fetch('/api/billing/upgrade', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ plan: plan })
	})
	.then(function(r) { return r.json(); })
	.then(function(data) {
		if (data.checkoutUrl) {
			window.location.href = data.checkoutUrl;
		} else if (data.portalUrl) {
			window.open(data.portalUrl, '_blank');
			btn.disabled = false;
			btn.textContent = 'Fazer upgrade';
		} else {
			showToast(data.error || 'Erro ao processar upgrade', 'error');
			btn.disabled = false;
			btn.textContent = 'Fazer upgrade';
		}
	})
	.catch(function() {
		showToast('Erro de conexão', 'error');
		btn.disabled = false;
		btn.textContent = 'Fazer upgrade';
	});
}
`)}
</script>`;

	return (
	<AdminLayout title="Meu Plano" user={user} activeTab="/admin/plan" tenant={tenant} isPlatformAdmin={isPlatformAdmin} bodyScripts={script}>
		<div class="max-w-4xl">
			<h2 class="text-xl font-display font-bold text-sk-text mb-6">Meu Plano</h2>

			{/* Current plan summary */}
			<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-6 border-2 border-sk-border/50">
				<div class="flex items-center justify-between mb-4">
					<div>
						<span class="text-sm text-sk-muted font-body">Plano atual</span>
						<h3 class="text-2xl font-display font-bold text-sk-text">{plans[currentPlan]?.label || limits.label}</h3>
					</div>
					<span class={`px-3 py-1 rounded-full text-sm font-display font-medium ${tenant?.status === "active" ? "bg-sk-green-light text-sk-green-dark" : "bg-sk-danger-light text-sk-danger"}`}>
						{tenant?.status === "active" ? "Ativo" : tenant?.status}
					</span>
				</div>

				{/* Usage bars */}
				<div class="space-y-4">
					<div>
						<div class="flex justify-between text-sm font-body mb-1">
							<span class="text-sk-muted">Usuários</span>
							<span class="font-medium">{usage.userCount} / {limits.maxUsers >= 999 ? "∞" : limits.maxUsers}</span>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-3">
							<div class={`h-3 rounded-full transition-all ${barColor(usage.userCount, limits.maxUsers)}`}
								style={`width: ${pct(usage.userCount, limits.maxUsers)}%`}></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between text-sm font-body mb-1">
							<span class="text-sk-muted">Brinquedos</span>
							<span class="font-medium">{usage.assetCount} / {limits.maxAssets >= 999 ? "∞" : limits.maxAssets}</span>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-3">
							<div class={`h-3 rounded-full transition-all ${barColor(usage.assetCount, limits.maxAssets)}`}
								style={`width: ${pct(usage.assetCount, limits.maxAssets)}%`}></div>
						</div>
					</div>
				</div>

				{/* Billing portal for existing Stripe subscribers */}
				{hasStripeSubscription && user?.role === "owner" && (
					<div class="mt-6 pt-4 border-t border-sk-border/30">
						<button id="billing-btn" onclick="openBillingPortal()"
							class="btn-touch btn-bounce w-full py-3 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-base shadow-sk-sm disabled:opacity-50 transition-colors">
							Gerenciar assinatura
						</button>
						<p class="text-xs text-sk-muted mt-2 text-center font-body">
							Altere seu plano, atualize forma de pagamento ou cancele sua assinatura.
						</p>
					</div>
				)}
			</div>

			{/* Plan comparison cards */}
			<h3 class="font-display font-bold text-sk-text mb-4">Comparação de planos</h3>
			<div class="grid md:grid-cols-3 gap-4 mb-6">
				{PLAN_ORDER.map((key) => {
					const plan = plans[key];
					if (!plan) return null;
					const isCurrent = key === currentPlan;
					const currentIdx = PLAN_ORDER.indexOf(currentPlan);
					const thisIdx = PLAN_ORDER.indexOf(key);
					const isUpgrade = thisIdx > currentIdx;
					const isDowngrade = thisIdx < currentIdx;
					const style = PLAN_STYLES[key] || PLAN_STYLES.starter;

					// Check if downgrade would exceed limits
					const exceedsUsers = isDowngrade && usage.userCount > plan.maxUsers && plan.maxUsers < 999;
					const exceedsAssets = isDowngrade && usage.assetCount > plan.maxAssets && plan.maxAssets < 999;
					const hasExcess = exceedsUsers || exceedsAssets;

					return (
						<div class={`bg-sk-surface rounded-sk-lg p-5 border-2 ${isCurrent ? "border-sk-green ring-2 ring-sk-green/30" : style.border} ${isCurrent ? "shadow-sk-md" : "shadow-sk-sm"}`}>
							{isCurrent && (
								<span class="inline-block bg-sk-green text-white text-xs font-display font-bold px-2 py-0.5 rounded-full mb-3">Plano atual</span>
							)}
							<h4 class="font-display font-bold text-lg text-sk-text">{plan.label}</h4>
							<p class="font-display font-bold text-2xl text-sk-text mt-2">
								{fmtBRL(plan.priceCents)}<span class="text-sm font-normal text-sk-muted font-body">/mês</span>
							</p>

							<ul class="space-y-2 mt-4 text-sm font-body text-sk-text">
								<li class={`flex items-center gap-2 ${exceedsUsers ? "text-sk-danger" : ""}`}>
									{exceedsUsers
										? <><span class="text-sk-danger font-bold">!</span> {plan.maxUsers} usuários <span class="text-xs">(você tem {usage.userCount})</span></>
										: <><span class="text-sk-green font-bold">✓</span> {plan.maxUsers >= 999 ? "Usuários ilimitados" : `${plan.maxUsers} usuários`}</>
									}
								</li>
								<li class={`flex items-center gap-2 ${exceedsAssets ? "text-sk-danger" : ""}`}>
									{exceedsAssets
										? <><span class="text-sk-danger font-bold">!</span> {plan.maxAssets} brinquedos <span class="text-xs">(você tem {usage.assetCount})</span></>
										: <><span class="text-sk-green font-bold">✓</span> {plan.maxAssets >= 999 ? "Brinquedos ilimitados" : `${plan.maxAssets} brinquedos`}</>
									}
								</li>
								<li class="flex items-center gap-2">
									{plan.hasTickets
										? <><span class="text-sk-green font-bold">✓</span> Suporte por tickets</>
										: <><span class="text-sk-muted">✗</span> <span class="text-sk-muted">Suporte por tickets</span></>
									}
								</li>
							</ul>

							{isUpgrade && user?.role === "owner" && (
								<button id={`upgrade-btn-${key}`} onclick={`upgradePlan('${key}')`}
									class={`btn-touch btn-bounce w-full py-2.5 mt-4 rounded-sk font-display font-bold text-sm shadow-sk-sm transition-colors ${style.btnClass}`}>
									Fazer upgrade
								</button>
							)}
							{isDowngrade && user?.role === "owner" && (
								<div class="mt-4">
									{hasExcess && (
										<p class="text-xs text-sk-danger font-body mb-2 text-center">
											Você precisará reduzir seu uso antes de migrar para este plano.
										</p>
									)}
									<button id={`upgrade-btn-${key}`} onclick={`upgradePlan('${key}')`}
										class="w-full py-2.5 rounded-sk font-display font-medium text-sm transition-colors bg-sk-bg hover:bg-sk-border/30 text-sk-muted border border-sk-border">
										Alterar para {plan.label}
									</button>
								</div>
							)}
							{isCurrent && (
								<div class="mt-4 py-2 text-center text-sm text-sk-green-dark font-display font-medium">
									Seu plano atual
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Contact info for non-owners */}
			{user?.role !== "owner" && (
				<div class="bg-sk-bg rounded-sk p-4 text-center">
					<p class="text-sm text-sk-muted font-body">
						Para alterar o plano, entre em contato com o administrador da conta.
					</p>
				</div>
			)}
		</div>
	</AdminLayout>
	);
};
