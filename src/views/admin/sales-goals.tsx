import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { SalesGoalProgress, Tenant, User } from "../../db/schema";
import { AdminLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import { toBrazilDate } from "../../lib/timezone";

interface Props {
	goals: SalesGoalProgress[];
	users: Omit<User, "password_hash" | "salt">[];
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

const GOAL_TYPE_LABELS: Record<string, string> = {
	revenue: "Receita (R$)",
	rental_count: "Qtd Locacoes",
	product_sale_count: "Qtd Vendas Produtos",
};

const PERIOD_TYPE_LABELS: Record<string, string> = {
	daily: "Diaria",
	weekly: "Semanal",
	monthly: "Mensal",
	custom: "Personalizada",
};

function formatGoalValue(value: number, goalType: string): string {
	return goalType === "revenue" ? formatCurrency(value) : String(value);
}

function progressColor(pct: number): string {
	if (pct >= 100) return "bg-sk-green";
	if (pct >= 75) return "bg-sk-blue";
	if (pct >= 50) return "bg-sk-yellow";
	return "bg-sk-orange";
}

export const SalesGoalsManage: FC<Props> = ({ goals, users, user, tenant, isPlatformAdmin }) => {
	const script = html`<script>
${raw(`
var USERS = ${JSON.stringify(users)};

function showGoalForm(goal) {
	var modal = document.getElementById('goal-form-modal');
	var titleEl = document.getElementById('goal-form-title');
	var form = document.getElementById('goal-form');

	if (goal) {
		titleEl.textContent = 'Editar Meta';
		form.dataset.id = goal.id;
		document.getElementById('gf-title').value = goal.title;
		document.getElementById('gf-goal-type').value = goal.goal_type;
		document.getElementById('gf-period-type').value = goal.period_type;
		document.getElementById('gf-target').value = goal.goal_type === 'revenue' ? (goal.target_value / 100).toFixed(2) : goal.target_value;
		document.getElementById('gf-user').value = goal.user_id || '';
		document.getElementById('gf-start').value = goal.start_date;
		document.getElementById('gf-end').value = goal.end_date;
		document.getElementById('gf-celebration').value = goal.celebration_message || '';
		updateTargetLabel();
	} else {
		titleEl.textContent = 'Nova Meta';
		delete form.dataset.id;
		form.reset();
		// Set defaults
		var today = new Date().toISOString().slice(0, 10);
		document.getElementById('gf-start').value = today;
		document.getElementById('gf-end').value = today;
		onPeriodChange();
		updateTargetLabel();
	}
	modal.classList.remove('hidden');
}

function closeGoalForm() {
	document.getElementById('goal-form-modal').classList.add('hidden');
}

function updateTargetLabel() {
	var type = document.getElementById('gf-goal-type').value;
	var label = document.getElementById('gf-target-label');
	if (type === 'revenue') {
		label.textContent = 'Valor alvo (R$)';
	} else {
		label.textContent = 'Quantidade alvo';
	}
}

function onPeriodChange() {
	var period = document.getElementById('gf-period-type').value;
	var startEl = document.getElementById('gf-start');
	var endEl = document.getElementById('gf-end');
	var today = new Date();

	if (period === 'daily') {
		var d = today.toISOString().slice(0, 10);
		startEl.value = d;
		endEl.value = d;
	} else if (period === 'weekly') {
		var dow = today.getDay();
		var mon = new Date(today);
		mon.setDate(today.getDate() - ((dow + 6) % 7));
		var sun = new Date(mon);
		sun.setDate(mon.getDate() + 6);
		startEl.value = mon.toISOString().slice(0, 10);
		endEl.value = sun.toISOString().slice(0, 10);
	} else if (period === 'monthly') {
		var y = today.getFullYear(), m = today.getMonth();
		startEl.value = new Date(y, m, 1).toISOString().slice(0, 10);
		endEl.value = new Date(y, m + 1, 0).toISOString().slice(0, 10);
	}
}

document.getElementById('goal-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var form = e.target;
	var id = form.dataset.id;
	var goalType = document.getElementById('gf-goal-type').value;
	var rawTarget = parseFloat(document.getElementById('gf-target').value) || 0;
	var targetValue = goalType === 'revenue' ? Math.round(rawTarget * 100) : Math.round(rawTarget);

	if (targetValue <= 0) { alert('Valor alvo deve ser maior que zero'); return; }

	var body = {
		title: document.getElementById('gf-title').value.trim(),
		goal_type: goalType,
		period_type: document.getElementById('gf-period-type').value,
		target_value: targetValue,
		user_id: document.getElementById('gf-user').value ? Number(document.getElementById('gf-user').value) : null,
		start_date: document.getElementById('gf-start').value,
		end_date: document.getElementById('gf-end').value,
		celebration_message: document.getElementById('gf-celebration').value.trim() || null
	};

	if (!body.title) { alert('Titulo e obrigatorio'); return; }

	var url = id ? '/api/sales-goals/manage/' + id : '/api/sales-goals/manage';
	var method = id ? 'PUT' : 'POST';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).then(function(r) {
		if (!r.ok) return r.json().then(function(d) { alert(d.error || 'Erro'); throw new Error(); });
		window.location.reload();
	}).catch(function() {});
});

function toggleGoal(id, active) {
	fetch('/api/sales-goals/manage/' + id, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ active: !active })
	}).then(function(r) {
		if (r.ok) window.location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

function deleteGoal(id, title) {
	if (!confirm('Excluir meta "' + title + '"?')) return;
	fetch('/api/sales-goals/manage/' + id, { method: 'DELETE' })
		.then(function(r) {
			if (r.ok) window.location.reload();
			else r.json().then(function(d) { alert(d.error || 'Erro'); });
		});
}
`)}
</script>`;

	const active = goals.filter((g) => g.active);
	const inactive = goals.filter((g) => !g.active);

	return (
		<AdminLayout title="Metas de Vendas" user={user} activeTab="/admin/goals" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin}>
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-xl font-display font-bold text-sk-text">Metas de Vendas</h2>
					<p class="text-sm text-sk-muted font-body">Defina metas e acompanhe o progresso da equipe</p>
				</div>
				<div class="flex gap-2">
					<a href="/admin/goals/report" class="btn-touch px-3 py-2 bg-sk-blue-light text-sk-blue-dark rounded-sk font-display font-medium text-sm">
						Relatorio
					</a>
					<button onclick="showGoalForm(null)" class="btn-touch px-3 py-2 bg-sk-orange text-white rounded-sk font-display font-medium text-sm btn-bounce">
						+ Nova Meta
					</button>
				</div>
			</div>

			{/* Active Goals with Progress */}
			{active.length > 0 && (
				<div class="space-y-3 mb-6">
					{active.map((g) => (
						<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4">
							<div class="flex items-start justify-between mb-2">
								<div>
									<h3 class="font-display font-bold text-sk-text">{g.title}</h3>
									<div class="flex flex-wrap gap-2 mt-1">
										<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sk-blue-light text-sk-blue-dark">
											{GOAL_TYPE_LABELS[g.goal_type] ?? g.goal_type}
										</span>
										<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sk-yellow-light text-sk-yellow-dark">
											{PERIOD_TYPE_LABELS[g.period_type] ?? g.period_type}
										</span>
										{g.user_name ? (
											<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sk-purple-light text-sk-purple">
												{g.user_name}
											</span>
										) : (
											<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-sk-muted">
												Equipe toda
											</span>
										)}
									</div>
								</div>
								<div class="flex gap-1">
									<button
										onclick={`showGoalForm(${JSON.stringify({ id: g.id, title: g.title, goal_type: g.goal_type, period_type: g.period_type, target_value: g.target_value, user_id: g.user_id, start_date: g.start_date, end_date: g.end_date, celebration_message: g.celebration_message })})`}
										class="px-3 py-2 text-xs bg-sk-blue-light text-sk-blue-dark rounded font-body hover:bg-sk-blue/20"
									>
										Editar
									</button>
									<button
										onclick={`toggleGoal(${g.id}, true)`}
										class="px-3 py-2 text-xs bg-gray-100 text-sk-muted rounded font-body hover:bg-gray-200"
									>
										Desativar
									</button>
									<button
										onclick={`deleteGoal(${g.id}, '${g.title.replace(/'/g, "\\'")}')`}
										class="px-3 py-2 text-xs bg-sk-danger-light text-sk-danger rounded font-body hover:bg-red-100"
									>
										Excluir
									</button>
								</div>
							</div>

							{/* Progress Bar */}
							<div class="mt-3">
								<div class="flex justify-between text-sm font-body mb-1">
									<span class="text-sk-muted">
										{formatGoalValue(g.current_value, g.goal_type)} / {formatGoalValue(g.target_value, g.goal_type)}
									</span>
									<span class={`font-bold ${g.achieved ? "text-sk-green-dark" : "text-sk-text"}`}>
										{g.percentage}%
										{g.achieved && " ✓"}
									</span>
								</div>
								<div class="w-full bg-sk-yellow-light rounded-full h-4 overflow-hidden">
									<div
										class={`h-full ${progressColor(g.percentage)} rounded-full transition-all duration-500`}
										style={`width:${Math.max(g.percentage, 2)}%`}
									/>
								</div>
							</div>

							<div class="flex justify-between mt-2 text-xs text-sk-muted font-body">
								<span>{toBrazilDate(g.start_date + "T12:00:00Z")} - {toBrazilDate(g.end_date + "T12:00:00Z")}</span>
								<span>Criado por: {g.created_by_name}</span>
							</div>
						</div>
					))}
				</div>
			)}

			{active.length === 0 && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center mb-6">
					<div class="text-4xl mb-2">🎯</div>
					<p class="text-sk-muted font-body">Nenhuma meta ativa. Crie sua primeira meta!</p>
				</div>
			)}

			{/* Inactive Goals */}
			{inactive.length > 0 && (
				<div>
					<h3 class="text-sm font-display font-bold text-sk-muted mb-2">Metas Inativas</h3>
					<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
						<table class="w-full text-sm font-body">
							<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
								<tr>
									<th class="px-4 py-2 font-medium">Titulo</th>
									<th class="px-4 py-2 font-medium hidden sm:table-cell">Tipo</th>
									<th class="px-4 py-2 font-medium text-right">Progresso</th>
									<th class="px-4 py-2 font-medium text-right">Acoes</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{inactive.map((g) => (
									<tr class="hover:bg-sk-yellow-light">
										<td class="px-4 py-2">{g.title}</td>
										<td class="px-4 py-2 hidden sm:table-cell text-sk-muted">{GOAL_TYPE_LABELS[g.goal_type]}</td>
										<td class="px-4 py-2 text-right">{g.percentage}%</td>
										<td class="px-4 py-2 text-right">
											<button
												onclick={`toggleGoal(${g.id}, false)`}
												class="px-3 py-2 text-xs bg-sk-green-light text-sk-green-dark rounded font-body"
											>
												Ativar
											</button>
											<button
												onclick={`deleteGoal(${g.id}, '${g.title.replace(/'/g, "\\'")}')`}
												class="px-3 py-2 text-xs bg-sk-danger-light text-sk-danger rounded font-body ml-1"
											>
												Excluir
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Form Modal */}
			<div id="goal-form-modal" class="hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
				<div class="w-full max-w-md bg-sk-surface rounded-t-sk sm:rounded-sk p-6 shadow-sk-xl mx-4 max-h-[90vh] overflow-y-auto">
					<div class="flex items-center justify-between mb-4">
						<h3 id="goal-form-title" class="text-lg font-display font-bold text-sk-text">Nova Meta</h3>
						<button onclick="closeGoalForm()" class="text-sk-muted hover:text-sk-text text-lg">&times;</button>
					</div>
					<form id="goal-form" class="space-y-3">
						<div>
							<label class="block text-xs font-medium text-sk-muted font-body mb-1">Titulo *</label>
							<input id="gf-title" type="text" required maxlength={100}
								class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30"
								placeholder="Ex: Meta diaria de vendas" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-xs font-medium text-sk-muted font-body mb-1">Tipo de Meta</label>
								<select id="gf-goal-type" onchange="updateTargetLabel()"
									class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body">
									<option value="revenue">Receita (R$)</option>
									<option value="rental_count">Qtd Locacoes</option>
									<option value="product_sale_count">Qtd Vendas Produtos</option>
								</select>
							</div>
							<div>
								<label class="block text-xs font-medium text-sk-muted font-body mb-1">Periodo</label>
								<select id="gf-period-type" onchange="onPeriodChange()"
									class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body">
									<option value="daily">Diaria</option>
									<option value="weekly">Semanal</option>
									<option value="monthly">Mensal</option>
									<option value="custom">Personalizada</option>
								</select>
							</div>
						</div>
						<div>
							<label id="gf-target-label" class="block text-xs font-medium text-sk-muted font-body mb-1">Valor alvo (R$)</label>
							<input id="gf-target" type="number" required min="0.01" step="0.01"
								class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30"
								placeholder="0,00" />
						</div>
						<div>
							<label class="block text-xs font-medium text-sk-muted font-body mb-1">Atribuir a</label>
							<select id="gf-user"
								class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body">
								<option value="">Equipe toda</option>
								{users.filter((u) => u.active).map((u) => (
									<option value={u.id}>{u.name} ({u.role === "operator" ? "Operador" : u.role === "manager" ? "Gerente" : "Socio"})</option>
								))}
							</select>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-xs font-medium text-sk-muted font-body mb-1">Inicio</label>
								<input id="gf-start" type="date" required
									class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body" />
							</div>
							<div>
								<label class="block text-xs font-medium text-sk-muted font-body mb-1">Fim</label>
								<input id="gf-end" type="date" required
									class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body" />
							</div>
						</div>
						<div>
							<label class="block text-xs font-medium text-sk-muted font-body mb-1">Mensagem de celebração</label>
							<input id="gf-celebration" type="text" maxlength={200}
								class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30"
								placeholder="Ex: Parabéns equipe! Meta batida! 🎉" />
							<p class="text-xs text-sk-muted font-body mt-1">Aparece na animação quando a meta é alcançada. Se vazio, exibe o título da meta.</p>
						</div>
						<button type="submit"
							class="btn-touch btn-bounce w-full py-3 bg-sk-orange text-white rounded-sk font-display font-bold text-lg active:bg-sk-orange-dark shadow-sk-sm mt-2">
							Salvar Meta
						</button>
					</form>
				</div>
			</div>
		</AdminLayout>
	);
};
