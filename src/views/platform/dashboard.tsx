import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { PlatformStats, TenantWithStats, TrialExpiring, TenantEngagement, DelinquentSubscription, AbandonedCheckout } from "../../db/queries/platform";
import type { CrmDashboardStats } from "../../db/queries/crm-leads";
import { PlatformLayout } from "./layout";

interface PlatformDashboardProps {
	stats: PlatformStats;
	tenants: TenantWithStats[];
	user: { name: string; email: string } | null;
	domain: string;
	expiringTrials: TrialExpiring[];
	engagement: TenantEngagement[];
	delinquent: DelinquentSubscription[];
	abandoned: AbandonedCheckout[];
	crmStats: CrmDashboardStats;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const STATUS_COLORS: Record<string, string> = {
	active: "bg-sk-green",
	suspended: "bg-sk-danger",
	cancelled: "bg-gray-400",
};

const PLAN_COLORS: Record<string, string> = {
	starter: "bg-sk-yellow-light text-sk-yellow-dark",
	pro: "bg-sk-blue-light text-sk-blue-dark",
	enterprise: "bg-sk-purple-light text-sk-purple",
};

const HEALTH_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	healthy: { bg: "bg-sk-green-light", text: "text-sk-green-dark", label: "Saudável" },
	warning: { bg: "bg-sk-yellow-light", text: "text-sk-yellow-dark", label: "Atenção" },
	critical: { bg: "bg-sk-danger-light", text: "text-sk-danger", label: "Crítico" },
};

export const PlatformDashboard: FC<PlatformDashboardProps> = ({ stats, tenants, user, domain, expiringTrials, engagement, delinquent, abandoned, crmStats }) => {
	const criticalCount = engagement.filter((e) => e.health === "critical").length;
	const warningCount = engagement.filter((e) => e.health === "warning").length;

	const script = html`<script>
${raw(`
function toggleTenant(id, action) {
	if (!confirm(action === 'suspend' ? 'Suspender este tenant?' : 'Reativar este tenant?')) return;
	fetch('/api/platform/tenants/' + id + '/' + action, { method: 'POST' })
		.then(function(r) { if (r.ok) { showToast(action === 'suspend' ? 'Tenant suspenso' : 'Tenant ativado'); setTimeout(function(){location.reload()},800); } else alert('Erro'); });
}

function showCreateForm() { document.getElementById('create-modal').classList.remove('hidden'); }
function hideCreateForm() { document.getElementById('create-modal').classList.add('hidden'); }

function createTenant(e) {
	e.preventDefault();
	var btn = document.getElementById('create-btn');
	var errEl = document.getElementById('create-error');
	btn.disabled = true;
	errEl.classList.add('hidden');

	var data = {
		slug: document.getElementById('new-slug').value.toLowerCase().trim(),
		businessName: document.getElementById('new-name').value.trim(),
		ownerName: document.getElementById('new-owner').value.trim(),
		ownerEmail: document.getElementById('new-email').value.trim(),
		ownerPassword: document.getElementById('new-password').value,
		plan: document.getElementById('new-plan').value
	};

	fetch('/api/platform/tenants', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok) { showToast('Tenant criado com sucesso'); setTimeout(function(){location.reload()},800); }
		else { errEl.textContent = res.data.error || 'Erro'; errEl.classList.remove('hidden'); btn.disabled = false; }
	});
}
`)}
</script>`;

	const createButton = html`
		<button onclick="showCreateForm()" class="btn-bounce bg-sk-blue hover:bg-sk-blue-dark text-white px-4 py-2 rounded-sk text-sm font-display font-bold transition-colors shadow-sk-sm">
			+ Novo Tenant
		</button>
	`;

	return (
		<PlatformLayout title="Visão Geral" user={user} actions={createButton} bodyScripts={script}>
			{/* KPIs */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
				<a href="#tenants-table" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md transition-all cursor-pointer block">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Tenants</p>
					<p class="text-3xl font-display font-bold text-sk-text">{stats.total_tenants}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">
						<span class="text-sk-green">{stats.active_tenants} ativos</span>
						{stats.suspended_tenants > 0 && <span> &middot; <span class="text-sk-danger">{stats.suspended_tenants} suspensos</span></span>}
					</p>
				</a>
				<a href="/platform/users" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md transition-all cursor-pointer block">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Usuários</p>
					<p class="text-3xl font-display font-bold text-sk-text">{stats.total_users}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">em todos os tenants</p>
				</a>
				<a href="/platform/reports" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md transition-all cursor-pointer block">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Receita Total</p>
					<p class="text-2xl font-display font-bold text-sk-text">{fmtBRL(stats.total_revenue_cents)}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">{stats.total_rentals} locações</p>
				</a>
				<a href="/platform/subscriptions" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-green-light hover:shadow-sk-md transition-all cursor-pointer block">
					<p class="text-xs text-sk-green font-display font-medium uppercase tracking-wider mb-1">MRR</p>
					<p class="text-2xl font-display font-bold text-sk-green-dark">{fmtBRL(stats.mrr_cents)}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">receita mensal recorrente</p>
				</a>
			</div>

			{/* ── Alert Panels ── */}
			<div class="grid md:grid-cols-2 gap-4 mb-6">

				{/* 1. Trials Expirando */}
				<div class={`bg-sk-surface rounded-sk shadow-sk-sm border-2 overflow-hidden ${expiringTrials.length > 0 ? "border-sk-orange" : "border-sk-border/50"}`}>
					<div class="px-5 py-3 border-b border-sk-border/30 flex items-center justify-between">
						<h3 class="font-display font-bold text-sm text-sk-text">Trials Expirando (7 dias)</h3>
						{expiringTrials.length > 0 && (
							<span class="bg-sk-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">{expiringTrials.length}</span>
						)}
					</div>
					{expiringTrials.length > 0 ? (
						<div class="divide-y divide-sk-border/20">
							{expiringTrials.map((t) => (
								<div class="px-5 py-3 flex items-center justify-between">
									<div>
										<a href={`/platform/tenants/${t.tenant_id}`} class="font-display font-medium text-sm text-sk-text hover:text-sk-blue">{t.tenant_name}</a>
										<p class="text-xs text-sk-muted font-body">{t.owner_email}</p>
									</div>
									<div class="text-right">
										<span class={`font-display font-bold text-sm ${t.days_remaining <= 2 ? "text-sk-danger" : "text-sk-orange"}`}>
											{t.days_remaining <= 0 ? "Expira hoje" : `${t.days_remaining}d restantes`}
										</span>
										<p class="text-xs text-sk-muted font-body">{t.rental_count} locações</p>
									</div>
								</div>
							))}
						</div>
					) : (
						<div class="px-5 py-6 text-center text-sk-muted text-sm font-body">Nenhum trial expirando em breve</div>
					)}
				</div>

				{/* 2. Inadimplência */}
				<div class={`bg-sk-surface rounded-sk shadow-sk-sm border-2 overflow-hidden ${delinquent.length > 0 ? "border-sk-danger" : "border-sk-border/50"}`}>
					<div class="px-5 py-3 border-b border-sk-border/30 flex items-center justify-between">
						<h3 class="font-display font-bold text-sm text-sk-text">Inadimplência</h3>
						{delinquent.length > 0 && (
							<span class="bg-sk-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">{delinquent.length}</span>
						)}
					</div>
					{delinquent.length > 0 ? (
						<div class="divide-y divide-sk-border/20">
							{delinquent.map((d) => (
								<div class="px-5 py-3 flex items-center justify-between">
									<div>
										<a href={`/platform/tenants/${d.tenant_id}`} class="font-display font-medium text-sm text-sk-text hover:text-sk-blue">{d.tenant_name}</a>
										<p class="text-xs text-sk-muted font-body">{d.owner_email}</p>
									</div>
									<div class="text-right flex items-center gap-2">
										<div>
											<span class="font-display font-bold text-sm text-sk-danger">{d.days_overdue}d atrasado</span>
											<p class="text-xs text-sk-muted font-body">{d.status}</p>
										</div>
										<a href={`mailto:${d.owner_email}?subject=Problema no pagamento - ${d.tenant_name}`}
											class="text-sk-blue hover:text-sk-blue-dark text-xs font-display" title="Enviar email">
											Contatar
										</a>
									</div>
								</div>
							))}
						</div>
					) : (
						<div class="px-5 py-6 text-center text-sk-green text-sm font-body">Nenhuma inadimplência</div>
					)}
				</div>
			</div>

			{/* ── Row 2: Engagement + Abandoned ── */}
			<div class="grid md:grid-cols-2 gap-4 mb-6">

				{/* 3. Engajamento */}
				<div class={`bg-sk-surface rounded-sk shadow-sk-sm border-2 overflow-hidden ${criticalCount > 0 ? "border-sk-danger" : warningCount > 0 ? "border-sk-yellow" : "border-sk-border/50"}`}>
					<div class="px-5 py-3 border-b border-sk-border/30 flex items-center justify-between">
						<h3 class="font-display font-bold text-sm text-sk-text">Engajamento dos Tenants</h3>
						<div class="flex gap-2">
							{criticalCount > 0 && <span class="bg-sk-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">{criticalCount} críticos</span>}
							{warningCount > 0 && <span class="bg-sk-yellow text-sk-text text-xs font-bold px-2 py-0.5 rounded-full">{warningCount} atenção</span>}
						</div>
					</div>
					<div class="overflow-x-auto max-h-[300px] overflow-y-auto">
						<table class="w-full text-xs font-body">
							<thead class="bg-sk-bg sticky top-0">
								<tr class="text-left text-sk-muted uppercase tracking-wider">
									<th class="px-4 py-2 font-display font-medium">Tenant</th>
									<th class="px-4 py-2 font-display font-medium text-center">7d</th>
									<th class="px-4 py-2 font-display font-medium text-center">Último login</th>
									<th class="px-4 py-2 font-display font-medium text-center">Saúde</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-sk-border/20">
								{engagement.map((t) => {
									const hb = HEALTH_BADGE[t.health];
									return (
										<tr class={t.health === "critical" ? "bg-sk-danger-light/30" : t.health === "warning" ? "bg-sk-yellow-light/30" : ""}>
											<td class="px-4 py-2">
												<a href={`/platform/tenants/${t.tenant_id}`} class="font-display font-medium text-sk-text hover:text-sk-blue">{t.tenant_name}</a>
											</td>
											<td class="px-4 py-2 text-center tabular-nums">
												{t.rentals_7d > 0 ? <span class="text-sk-green-dark font-medium">{t.rentals_7d} loc.</span> : <span class="text-sk-muted">0</span>}
											</td>
											<td class="px-4 py-2 text-center text-sk-muted tabular-nums">
												{t.days_since_login !== null
													? (t.days_since_login === 0 ? "Hoje" : t.days_since_login === 1 ? "Ontem" : `${t.days_since_login}d`)
													: "Nunca"
												}
											</td>
											<td class="px-4 py-2 text-center">
												<span class={`${hb.bg} ${hb.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>{hb.label}</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{engagement.length === 0 && (
							<div class="px-5 py-6 text-center text-sk-muted text-sm font-body">Nenhum tenant ativo</div>
						)}
					</div>
				</div>

				{/* 4. Checkouts Abandonados */}
				<div class={`bg-sk-surface rounded-sk shadow-sk-sm border-2 overflow-hidden ${abandoned.length > 0 ? "border-sk-yellow" : "border-sk-border/50"}`}>
					<div class="px-5 py-3 border-b border-sk-border/30 flex items-center justify-between">
						<h3 class="font-display font-bold text-sm text-sk-text">Checkouts Abandonados</h3>
						{abandoned.length > 0 && (
							<span class="bg-sk-yellow text-sk-text text-xs font-bold px-2 py-0.5 rounded-full">{abandoned.length}</span>
						)}
					</div>
					{abandoned.length > 0 ? (
						<div class="divide-y divide-sk-border/20 max-h-[400px] overflow-y-auto">
							{abandoned.map((a) => {
								const urgency = a.hours_ago < 2 ? "border-l-4 border-sk-green" : a.hours_ago < 24 ? "border-l-4 border-sk-yellow" : a.hours_ago < 72 ? "border-l-4 border-sk-orange" : "border-l-4 border-sk-danger";
								const timeLabel = a.hours_ago < 1 ? "Agora mesmo" : a.hours_ago < 24 ? `${a.hours_ago}h atrás` : `${Math.floor(a.hours_ago / 24)}d atrás`;
								const whatsappBody = encodeURIComponent(`Olá ${a.owner_name}! Sou da Giro Kids. Notei que você iniciou o cadastro para ${a.business_name} mas não finalizou. Posso ajudar com alguma dúvida?`);
								const emailBody = `Olá ${a.owner_name},%0D%0A%0D%0ANotamos que você iniciou o cadastro do ${a.business_name} na plataforma Giro Kids mas não concluiu o processo.%0D%0A%0D%0ASe teve alguma dificuldade ou dúvida, estamos à disposição para ajudar.%0D%0A%0D%0ASeu subdomínio reservado: ${a.slug}.giro-kids.com%0D%0APlano selecionado: ${a.plan.charAt(0).toUpperCase() + a.plan.slice(1)}%0D%0A%0D%0AAtenciosamente,%0D%0AEquipe Giro Kids`;
								return (
									<div class={`px-4 py-3 ${urgency}`}>
										<div class="flex items-start justify-between gap-3">
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 mb-1">
													<p class="font-display font-bold text-sm text-sk-text truncate">{a.business_name}</p>
													<span class={`${PLAN_COLORS[a.plan] || PLAN_COLORS.starter} px-2 py-0.5 rounded text-xs font-medium font-display flex-shrink-0`}>
														{a.plan.charAt(0).toUpperCase() + a.plan.slice(1)}
													</span>
												</div>
												<div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-body">
													<div><span class="text-sk-muted">Responsável:</span> <span class="text-sk-text font-medium">{a.owner_name}</span></div>
													<div><span class="text-sk-muted">Subdomínio:</span> <span class="text-sk-text font-medium">{a.slug}.giro-kids.com</span></div>
													<div><span class="text-sk-muted">Email:</span> <a href={`mailto:${a.owner_email}`} class="text-sk-blue hover:underline">{a.owner_email}</a></div>
													<div><span class="text-sk-muted">Quando:</span> <span class={`font-medium ${a.hours_ago > 48 ? "text-sk-danger" : "text-sk-text"}`}>{timeLabel}</span></div>
												</div>
											</div>
											<div class="flex flex-col gap-1 flex-shrink-0">
												<a href={`mailto:${a.owner_email}?subject=Finalize seu cadastro - Giro Kids&body=${emailBody}`}
													class="btn-touch px-2.5 py-1.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk text-xs font-display font-bold text-center" title="Enviar email">
													Email
												</a>
												<a href={`https://wa.me/?text=${whatsappBody}`} target="_blank"
													class="btn-touch px-2.5 py-1.5 bg-sk-green hover:bg-sk-green-dark text-white rounded-sk text-xs font-display font-bold text-center" title="Abrir WhatsApp">
													WhatsApp
												</a>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div class="px-5 py-6 text-center text-sk-muted text-sm font-body">Nenhum checkout abandonado nos últimos 30 dias</div>
					)}
				</div>
			</div>

			{/* ── CRM Summary ── */}
			<a href="/platform/crm" class={`block bg-sk-surface rounded-sk shadow-sk-sm border-2 p-5 mb-6 hover:shadow-sk-md transition-all ${crmStats.overdue_count > 0 ? "border-sk-orange" : "border-sk-border/50"}`}>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<span class="text-2xl">📋</span>
						<div>
							<h3 class="font-display font-bold text-sm text-sk-text">CRM — Prospecção</h3>
							<p class="text-xs text-sk-muted font-body">{crmStats.total} leads · {crmStats.this_week_contacts} contatos esta semana</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						{crmStats.overdue_count > 0 && (
							<span class="bg-sk-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">{crmStats.overdue_count} atrasados</span>
						)}
						<span class="text-sk-blue text-xs font-display font-medium">Ver CRM &rarr;</span>
					</div>
				</div>
			</a>

			{/* ── Tenants Table ── */}
			<div id="tenants-table" class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
					<h2 class="font-display font-bold text-sk-text">Tenants</h2>
					<span class="text-xs text-sk-muted font-body">{tenants.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-5 py-3 font-display font-medium w-8"></th>
								<th class="px-5 py-3 font-display font-medium">Tenant</th>
								<th class="px-5 py-3 font-display font-medium">Plano</th>
								<th class="px-5 py-3 font-display font-medium text-center">Usuários</th>
								<th class="px-5 py-3 font-display font-medium text-center">Ativos</th>
								<th class="px-5 py-3 font-display font-medium text-right">Faturamento</th>
								<th class="px-5 py-3 font-display font-medium text-center">Atividade</th>
								<th class="px-5 py-3 font-display font-medium text-right">Ações</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-sk-border/30">
							{tenants.map((t) => {
								const statusColor = STATUS_COLORS[t.status] || "bg-gray-400";
								const planColor = PLAN_COLORS[t.subscription_plan || t.plan] || PLAN_COLORS.starter;
								const plan = t.subscription_plan || t.plan;
								return (
									<tr class="hover:bg-sk-blue-light/30 transition-colors">
										<td class="px-5 py-3">
											<span class={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} title={t.status}></span>
										</td>
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${t.id}`} class="font-display font-medium text-sk-text hover:text-sk-blue transition-colors">
												{t.name}
											</a>
											<p class="text-xs text-sk-muted">{t.slug}.{domain}</p>
										</td>
										<td class="px-5 py-3">
											<span class={`${planColor} px-2.5 py-0.5 rounded-sk text-xs font-display font-medium`}>
												{plan.charAt(0).toUpperCase() + plan.slice(1)}
											</span>
										</td>
										<td class="px-5 py-3 text-center">
											<span class="font-display font-medium">{t.user_count}</span>
											<span class="text-sk-muted">/{t.max_users}</span>
										</td>
										<td class="px-5 py-3 text-center">
											<span class="font-display font-medium">{t.asset_count}</span>
											<span class="text-sk-muted">/{t.max_assets}</span>
										</td>
										<td class="px-5 py-3 text-right font-display font-medium">{fmtBRL(t.revenue_cents)}</td>
										<td class="px-5 py-3 text-center text-xs text-sk-muted">
											{t.rental_count > 0 ? `${t.rental_count} loc.` : <span class="text-sk-border">&mdash;</span>}
										</td>
										<td class="px-5 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<a href={`/platform/tenants/${t.id}`} class="text-sk-blue hover:text-sk-blue-dark text-xs font-display font-medium">Detalhes</a>
												{t.status === "active" ? (
													<button onclick={`toggleTenant(${t.id},'suspend')`} class="text-sk-danger hover:text-sk-danger/80 text-xs font-display">Suspender</button>
												) : (
													<button onclick={`toggleTenant(${t.id},'activate')`} class="text-sk-green hover:text-sk-green-dark text-xs font-display">Ativar</button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{tenants.length === 0 && (
						<div class="text-center py-12 text-sk-muted">
							<p class="text-lg mb-2 font-display">Nenhum tenant cadastrado</p>
							<p class="text-sm font-body">Crie o primeiro tenant clicando em "+ Novo Tenant"</p>
						</div>
					)}
				</div>
			</div>

			{/* Create Tenant Modal */}
			<div id="create-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-md p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-display font-bold text-sk-text">Novo Tenant</h3>
						<button onclick="hideCreateForm()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<div id="create-error" class="hidden mb-3 p-3 bg-sk-danger-light text-sk-danger rounded-sk text-sm font-body"></div>
					<form onsubmit="createTenant(event)" class="space-y-3">
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Subdomínio</label>
							<div class="flex items-center gap-1">
								<input id="new-slug" type="text" required class="flex-1 px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" placeholder="meu-parque" />
								<span class="text-sk-muted text-xs flex-shrink-0 font-body">.{domain}</span>
							</div>
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Nome do estabelecimento</label>
							<input id="new-name" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-display font-medium text-sk-text mb-1">Nome do dono</label>
								<input id="new-owner" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" />
							</div>
							<div>
								<label class="block text-sm font-display font-medium text-sk-text mb-1">Plano</label>
								<select id="new-plan" class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors">
									<option value="starter">Starter</option>
									<option value="pro" selected>Pro</option>
									<option value="enterprise">Enterprise</option>
								</select>
							</div>
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Email</label>
							<input id="new-email" type="email" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" />
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Senha inicial</label>
							<input id="new-password" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" placeholder="Gere uma senha segura" />
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" id="create-btn" class="btn-bounce flex-1 py-2.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-sm transition-colors">Criar Tenant</button>
							<button type="button" onclick="hideCreateForm()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm transition-colors">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
