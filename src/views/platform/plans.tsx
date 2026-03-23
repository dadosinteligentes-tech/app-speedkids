import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { PlanConfig } from "../../db/queries/platform";
import { PlatformLayout } from "./layout";

interface PlansProps {
	plans: Record<string, PlanConfig>;
	user: { name: string; email: string } | null;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const PLAN_ORDER = ["starter", "pro", "enterprise"] as const;

const PLAN_STYLES: Record<string, { ring: string; badge: string }> = {
	starter: { ring: "", badge: "bg-gray-100 text-gray-600" },
	pro: { ring: "ring-2 ring-blue-200", badge: "bg-blue-100 text-blue-700" },
	enterprise: { ring: "", badge: "bg-purple-100 text-purple-700" },
};

export const Plans: FC<PlansProps> = ({ plans, user }) => {
	const script = html`<script>
${raw(`
var plansData = ${JSON.stringify(plans)};

function toggleEdit(key) {
	var card = document.getElementById('card-' + key);
	var view = card.querySelector('.plan-view');
	var edit = card.querySelector('.plan-edit');
	var isEditing = !edit.classList.contains('hidden');
	if (isEditing) {
		edit.classList.add('hidden');
		view.classList.remove('hidden');
	} else {
		// populate inputs with current values
		document.getElementById('price-' + key).value = (plansData[key].priceCents / 100).toFixed(2);
		document.getElementById('users-' + key).value = plansData[key].maxUsers;
		document.getElementById('assets-' + key).value = plansData[key].maxAssets;
		view.classList.add('hidden');
		edit.classList.remove('hidden');
	}
}

function savePlan(key) {
	var price = parseFloat(document.getElementById('price-' + key).value);
	var maxUsers = parseInt(document.getElementById('users-' + key).value, 10);
	var maxAssets = parseInt(document.getElementById('assets-' + key).value, 10);

	if (isNaN(price) || isNaN(maxUsers) || isNaN(maxAssets)) {
		showToast('Preencha todos os campos corretamente', 'error');
		return;
	}

	plansData[key].priceCents = Math.round(price * 100);
	plansData[key].maxUsers = maxUsers;
	plansData[key].maxAssets = maxAssets;

	var btn = document.getElementById('save-btn-' + key);
	btn.disabled = true;
	btn.textContent = 'Salvando...';

	fetch('/api/platform/plans', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(plansData)
	})
	.then(function(r) {
		if (r.ok) {
			showToast('Plano atualizado com sucesso');
			setTimeout(function(){ location.reload(); }, 800);
		} else {
			r.json().then(function(d) { showToast(d.error || 'Erro ao salvar', 'error'); });
			btn.disabled = false;
			btn.textContent = 'Salvar';
		}
	});
}
`)}
</script>`;

	return (
		<PlatformLayout
			title="Planos e Limites"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Planos e Limites" }]}
			bodyScripts={script}
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				{PLAN_ORDER.map((key) => {
					const plan = plans[key];
					if (!plan) return null;
					const style = PLAN_STYLES[key] || PLAN_STYLES.starter;
					return (
						<div id={`card-${key}`} class={`bg-white rounded-xl shadow-sm border p-6 ${style.ring}`}>
							{/* Header */}
							<div class="flex items-center justify-between mb-4">
								<span class={`${style.badge} px-3 py-1 rounded-lg text-sm font-semibold`}>
									{plan.label}
								</span>
							</div>

							{/* View Mode */}
							<div class="plan-view">
								<p class="text-3xl font-bold text-gray-900 mb-1">{fmtBRL(plan.priceCents)}<span class="text-sm font-normal text-gray-400">/mes</span></p>
								<div class="mt-4 space-y-2">
									<div class="flex items-center justify-between text-sm">
										<span class="text-gray-500">Max. usuarios</span>
										<span class="font-medium text-gray-900">{plan.maxUsers}</span>
									</div>
									<div class="flex items-center justify-between text-sm">
										<span class="text-gray-500">Max. ativos</span>
										<span class="font-medium text-gray-900">{plan.maxAssets}</span>
									</div>
								</div>
								<button onclick={`toggleEdit('${key}')`} class="mt-5 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors">
									Editar
								</button>
							</div>

							{/* Edit Mode */}
							<div class="plan-edit hidden">
								<div class="space-y-3">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Preco (R$)</label>
										<input id={`price-${key}`} type="number" step="0.01" min="0" class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Max. usuarios</label>
										<input id={`users-${key}`} type="number" min="1" class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Max. ativos</label>
										<input id={`assets-${key}`} type="number" min="1" class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
									</div>
								</div>
								<div class="flex gap-2 mt-4">
									<button id={`save-btn-${key}`} onclick={`savePlan('${key}')`} class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">Salvar</button>
									<button onclick={`toggleEdit('${key}')`} class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</PlatformLayout>
	);
};
