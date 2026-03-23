import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { TenantWithStats } from "../../db/queries/platform";
import { PlatformLayout } from "./layout";

interface TenantDetailProps {
	tenant: TenantWithStats & { rentals_today: number; rentals_week: number; revenue_today_cents: number; last_login: string | null };
	users: Array<{ id: number; name: string; email: string; role: string; active: number; created_at: string; last_login: string | null }>;
	sessions: Array<{ id: string; asset_name: string; package_name: string; customer_name: string | null; status: string; start_time: string; duration_minutes: number; amount_cents: number }>;
	config: { name: string; cnpj: string | null; address: string | null; phone: string | null; receipt_footer: string | null } | null;
	logs: Array<{ id: number; user_name: string | null; action: string; entity_type: string; entity_id: string | null; created_at: string }>;
	domain: string;
	user: { name: string; email: string } | null;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function daysAgo(dateStr: string | null): string {
	if (!dateStr) return "Nunca";
	const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
	if (diff === 0) return "Hoje";
	if (diff === 1) return "Ontem";
	return `${diff} dias atras`;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	active: { bg: "bg-green-100", text: "text-green-700", label: "Ativo" },
	suspended: { bg: "bg-red-100", text: "text-red-700", label: "Suspenso" },
	cancelled: { bg: "bg-gray-100", text: "text-gray-600", label: "Cancelado" },
};

const PLAN_COLORS: Record<string, string> = {
	starter: "bg-gray-100 text-gray-600",
	pro: "bg-blue-100 text-blue-700",
	enterprise: "bg-purple-100 text-purple-700",
};

const ROLE_LABELS: Record<string, string> = { owner: "Socio", manager: "Gerente", operator: "Operador" };

const SESSION_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	running: { bg: "bg-blue-100", text: "text-blue-700", label: "Em andamento" },
	paused: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pausado" },
};

export const TenantDetail: FC<TenantDetailProps> = ({ tenant, users, sessions, config, logs, domain, user }) => {
	const badge = STATUS_BADGE[tenant.status] || STATUS_BADGE.active;
	const plan = tenant.subscription_plan || tenant.plan;
	const planColor = PLAN_COLORS[plan] || PLAN_COLORS.starter;
	const tenantId = tenant.id;
	const slug = tenant.slug;

	const script = html`<script>
${raw(`
var tenantId = ${tenantId};
var slug = '${slug}';
var domain = '${domain}';

function toggleTenant(action) {
	if (!confirm(action === 'suspend' ? 'Suspender este tenant?' : 'Reativar este tenant?')) return;
	fetch('/api/platform/tenants/' + tenantId + '/' + action, { method: 'POST' })
		.then(function(r) { if (r.ok) { showToast(action === 'suspend' ? 'Tenant suspenso' : 'Tenant ativado'); setTimeout(function(){location.reload()},800); } else showToast('Erro', 'error'); });
}

function resetPassword(userId, userName) {
	var pwd = prompt('Nova senha para ' + userName + ':');
	if (!pwd) return;
	if (pwd.length < 6) { showToast('Senha deve ter ao menos 6 caracteres', 'error'); return; }
	fetch('/api/platform/tenants/' + tenantId + '/users/' + userId + '/reset-password', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ new_password: pwd })
	}).then(function(r) {
		if (r.ok) showToast('Senha alterada para ' + userName);
		else showToast('Erro ao alterar senha', 'error');
	});
}

function impersonateUser(userId) {
	fetch('/api/platform/tenants/' + tenantId + '/impersonate/' + userId, { method: 'POST' })
		.then(function(r) { return r.json(); })
		.then(function(d) {
			if (d.session_id) {
				document.cookie = 'sk_session=' + d.session_id + '; path=/';
				window.open('https://' + slug + '.' + domain + '/', '_blank');
				showToast('Sessao criada — abrindo em nova aba');
			} else showToast('Erro ao impersonar', 'error');
		});
}

function forceComplete(sessionId, assetName) {
	if (!confirm('Forcar finalizacao da sessao em ' + assetName + '?')) return;
	fetch('/api/platform/tenants/' + tenantId + '/sessions/' + sessionId + '/force-complete', { method: 'POST' })
		.then(function(r) { if (r.ok) { showToast('Sessao finalizada'); setTimeout(function(){location.reload()},800); } else showToast('Erro', 'error'); });
}

function saveConfig(e) {
	e.preventDefault();
	var btn = e.target.querySelector('button[type=submit]');
	btn.disabled = true;
	fetch('/api/platform/tenants/' + tenantId + '/config', {
		method: 'PUT', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: document.getElementById('cfg-name').value,
			cnpj: document.getElementById('cfg-cnpj').value || null,
			address: document.getElementById('cfg-address').value || null,
			phone: document.getElementById('cfg-phone').value || null,
			receipt_footer: document.getElementById('cfg-footer').value || null
		})
	}).then(function(r) { btn.disabled = false; if (r.ok) showToast('Configuracoes salvas'); else showToast('Erro ao salvar', 'error'); });
}

function savePlan(e) {
	e.preventDefault();
	var btn = e.target.querySelector('button[type=submit]');
	btn.disabled = true;
	fetch('/api/platform/tenants/' + tenantId + '/plan', {
		method: 'PUT', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			plan: document.getElementById('plan-select').value,
			max_users: parseInt(document.getElementById('plan-max-users').value),
			max_assets: parseInt(document.getElementById('plan-max-assets').value)
		})
	}).then(function(r) { btn.disabled = false; if (r.ok) showToast('Plano atualizado'); else showToast('Erro', 'error'); });
}

// Tab switching
function showTab(tab) {
	document.querySelectorAll('[data-tab]').forEach(function(el) { el.classList.add('hidden'); });
	document.querySelectorAll('[data-tab-btn]').forEach(function(el) {
		el.className = el.className.replace('border-blue-500 text-blue-600', 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300');
	});
	document.getElementById('tab-' + tab).classList.remove('hidden');
	document.getElementById('btn-' + tab).className = document.getElementById('btn-' + tab).className.replace('border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', 'border-blue-500 text-blue-600');
}
`)}
</script>`;

	const headerActions = html`
		<div class="flex items-center gap-2">
			${raw(tenant.status === "active"
				? '<button onclick="toggleTenant(\'suspend\')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors">Suspender</button>'
				: '<button onclick="toggleTenant(\'activate\')" class="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors">Ativar</button>'
			)}
			${raw(users.length > 0
				? `<button onclick="impersonateUser(${users[0].id})" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Impersonar</button>`
				: ''
			)}
		</div>
	`;

	return (
		<PlatformLayout
			title={tenant.name}
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: tenant.name }]}
			actions={headerActions}
			bodyScripts={script}
		>
			{/* Tenant header info */}
			<div class="flex items-center gap-3 mb-6">
				<a href={`https://${slug}.${domain}`} target="_blank" class="text-sm text-blue-500 hover:text-blue-600 transition-colors">
					{slug}.{domain} ↗
				</a>
				<span class={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium`}>{badge.label}</span>
				<span class={`${planColor} px-2 py-0.5 rounded text-xs font-medium`}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
			</div>

			{/* Overview Cards */}
			<div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
				<div class="bg-white rounded-xl p-4 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Usuarios</p>
					<p class="text-2xl font-bold">{tenant.user_count}<span class="text-sm text-gray-400 font-normal">/{tenant.max_users}</span></p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Ativos</p>
					<p class="text-2xl font-bold">{tenant.asset_count}<span class="text-sm text-gray-400 font-normal">/{tenant.max_assets}</span></p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Locacoes</p>
					<p class="text-2xl font-bold">{tenant.rentals_today}<span class="text-sm text-gray-400 font-normal"> hoje / {tenant.rentals_week} sem</span></p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Receita hoje</p>
					<p class="text-xl font-bold text-green-700">{fmtBRL(tenant.revenue_today_cents)}</p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Ultimo login</p>
					<p class="text-lg font-semibold">{daysAgo(tenant.last_login)}</p>
				</div>
			</div>

			{/* Tabs */}
			<div class="border-b mb-6">
				<nav class="flex gap-6">
					<button id="btn-users" data-tab-btn onclick="showTab('users')" class="pb-3 text-sm font-medium border-b-2 border-blue-500 text-blue-600 transition-colors">
						Usuarios ({users.length})
					</button>
					<button id="btn-sessions" data-tab-btn onclick="showTab('sessions')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Sessoes ({sessions.length})
					</button>
					<button id="btn-config" data-tab-btn onclick="showTab('config')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Configuracoes
					</button>
					<button id="btn-plan" data-tab-btn onclick="showTab('plan')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Plano
					</button>
					<button id="btn-logs" data-tab-btn onclick="showTab('logs')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Logs ({logs.length})
					</button>
				</nav>
			</div>

			{/* Tab: Users */}
			<div id="tab-users" data-tab>
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Nome</th>
									<th class="px-5 py-3 font-medium">Email</th>
									<th class="px-5 py-3 font-medium">Perfil</th>
									<th class="px-5 py-3 font-medium text-center">Status</th>
									<th class="px-5 py-3 font-medium">Ultimo login</th>
									<th class="px-5 py-3 font-medium text-right">Acoes</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{users.map((u) => (
									<tr class="hover:bg-blue-50/30 transition-colors">
										<td class="px-5 py-3 font-medium">{u.name}</td>
										<td class="px-5 py-3 text-gray-500">{u.email}</td>
										<td class="px-5 py-3"><span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">{ROLE_LABELS[u.role] || u.role}</span></td>
										<td class="px-5 py-3 text-center">
											{u.active
												? <span class="inline-block w-2 h-2 rounded-full bg-green-500" title="Ativo"></span>
												: <span class="inline-block w-2 h-2 rounded-full bg-red-500" title="Inativo"></span>
											}
										</td>
										<td class="px-5 py-3 text-gray-400 text-xs">{u.last_login ? daysAgo(u.last_login) : "Nunca"}</td>
										<td class="px-5 py-3 text-right">
											<div class="flex items-center justify-end gap-3">
												<button onclick={`resetPassword(${u.id},'${u.name.replace(/'/g, "\\'")}')`} class="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors">Resetar senha</button>
												<button onclick={`impersonateUser(${u.id})`} class="text-purple-600 hover:text-purple-800 text-xs font-medium transition-colors">Impersonar</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{users.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum usuario</p>}
					</div>
				</div>
			</div>

			{/* Tab: Sessions */}
			<div id="tab-sessions" data-tab class="hidden">
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Ativo</th>
									<th class="px-5 py-3 font-medium">Pacote</th>
									<th class="px-5 py-3 font-medium">Cliente</th>
									<th class="px-5 py-3 font-medium">Status</th>
									<th class="px-5 py-3 font-medium">Inicio</th>
									<th class="px-5 py-3 font-medium text-right">Valor</th>
									<th class="px-5 py-3 font-medium text-right">Acoes</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{sessions.map((s) => {
									const sBadge = SESSION_BADGE[s.status] || SESSION_BADGE.running;
									return (
										<tr class="hover:bg-blue-50/30 transition-colors">
											<td class="px-5 py-3 font-medium">{s.asset_name}</td>
											<td class="px-5 py-3">{s.package_name}</td>
											<td class="px-5 py-3 text-gray-500">{s.customer_name || "—"}</td>
											<td class="px-5 py-3"><span class={`${sBadge.bg} ${sBadge.text} px-2 py-0.5 rounded text-xs font-medium`}>{sBadge.label}</span></td>
											<td class="px-5 py-3 text-gray-400 text-xs">{s.start_time?.slice(11, 16)}</td>
											<td class="px-5 py-3 text-right font-medium">{fmtBRL(s.amount_cents)}</td>
											<td class="px-5 py-3 text-right">
												<button onclick={`forceComplete('${s.id}','${s.asset_name.replace(/'/g, "\\'")}')`} class="text-red-600 hover:text-red-800 text-xs font-medium transition-colors">Forcar finalizacao</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{sessions.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhuma sessao ativa</p>}
					</div>
				</div>
			</div>

			{/* Tab: Config */}
			<div id="tab-config" data-tab class="hidden">
				<div class="bg-white rounded-xl shadow-sm border p-6">
					<form onsubmit="saveConfig(event)" class="space-y-4 max-w-xl">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Nome do estabelecimento</label>
							<input id="cfg-name" type="text" value={config?.name || tenant.name} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
								<input id="cfg-cnpj" type="text" value={config?.cnpj || ""} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
								<input id="cfg-phone" type="text" value={config?.phone || ""} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Endereco</label>
							<input id="cfg-address" type="text" value={config?.address || ""} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Rodape do recibo</label>
							<textarea id="cfg-footer" rows={2} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">{config?.receipt_footer || ""}</textarea>
						</div>
						<button type="submit" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Salvar</button>
					</form>
				</div>
			</div>

			{/* Tab: Plan */}
			<div id="tab-plan" data-tab class="hidden">
				<div class="bg-white rounded-xl shadow-sm border p-6">
					<form onsubmit="savePlan(event)" class="space-y-4 max-w-md">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Plano</label>
							<select id="plan-select" class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
								<option value="starter" selected={plan === "starter"}>Starter (R$ 97/mes)</option>
								<option value="pro" selected={plan === "pro"}>Pro (R$ 197/mes)</option>
								<option value="enterprise" selected={plan === "enterprise"}>Enterprise (R$ 397/mes)</option>
							</select>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Max usuarios</label>
								<input id="plan-max-users" type="number" min="1" value={tenant.max_users} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Max ativos</label>
								<input id="plan-max-assets" type="number" min="1" value={tenant.max_assets} class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
							</div>
						</div>
						<button type="submit" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Salvar</button>
					</form>
				</div>
			</div>

			{/* Tab: Logs */}
			<div id="tab-logs" data-tab class="hidden">
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Data/Hora</th>
									<th class="px-5 py-3 font-medium">Usuario</th>
									<th class="px-5 py-3 font-medium">Acao</th>
									<th class="px-5 py-3 font-medium">Entidade</th>
									<th class="px-5 py-3 font-medium">ID</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{logs.map((l) => (
									<tr class="hover:bg-blue-50/30 transition-colors">
										<td class="px-5 py-3 text-gray-400 text-xs tabular-nums">{l.created_at?.slice(0, 16).replace("T", " ")}</td>
										<td class="px-5 py-3">{l.user_name || <span class="text-gray-300">Sistema</span>}</td>
										<td class="px-5 py-3 font-medium">{l.action}</td>
										<td class="px-5 py-3"><span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{l.entity_type}</span></td>
										<td class="px-5 py-3 text-gray-400 text-xs">{l.entity_id || "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
						{logs.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum log</p>}
					</div>
				</div>
			</div>
		</PlatformLayout>
	);
};
