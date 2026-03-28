import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import { PlatformLayout } from "./layout";

interface SuperadminsProps {
	admins: Array<{ id: number; name: string; email: string; role: string; active: number; created_at: string }>;
	user: { name: string; email: string } | null;
}

function fmtDate(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const Superadmins: FC<SuperadminsProps> = ({ admins, user }) => {
	const script = html`<script>
${raw(`
function showCreateForm() { document.getElementById('create-modal').classList.remove('hidden'); }
function hideCreateForm() { document.getElementById('create-modal').classList.add('hidden'); }

function createAdmin(e) {
	e.preventDefault();
	var btn = document.getElementById('create-btn');
	var errEl = document.getElementById('create-error');
	btn.disabled = true;
	errEl.classList.add('hidden');

	var data = {
		name: document.getElementById('new-name').value.trim(),
		email: document.getElementById('new-email').value.trim(),
		password: document.getElementById('new-password').value
	};

	fetch('/api/platform/superadmins', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok) { showToast('Admin criado com sucesso'); setTimeout(function(){location.reload()},800); }
		else { errEl.textContent = res.data.error || 'Erro'; errEl.classList.remove('hidden'); btn.disabled = false; }
	});
}

function toggleActive(id, current) {
	var action = current ? 'desativar' : 'ativar';
	if (!confirm('Deseja ' + action + ' este admin?')) return;
	fetch('/api/platform/superadmins/' + id + '/toggle-active', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ active: current ? 0 : 1 })
	})
	.then(function(r) {
		if (r.ok) { showToast(current ? 'Admin desativado' : 'Admin ativado'); setTimeout(function(){location.reload()},800); }
		else alert('Erro ao alterar status');
	});
}

var _resetAdminId = null;
function resetPassword(id) {
	_resetAdminId = id;
	var modal = document.getElementById('reset-modal');
	var input = document.getElementById('reset-password');
	var errEl = document.getElementById('reset-error');
	input.value = '';
	errEl.classList.add('hidden');
	document.getElementById('reset-btn').disabled = false;
	document.getElementById('reset-btn').textContent = 'Redefinir senha';
	modal.classList.remove('hidden');
	setTimeout(function() { input.focus(); }, 100);
}
function hideResetForm() { document.getElementById('reset-modal').classList.add('hidden'); }
function submitReset(e) {
	e.preventDefault();
	var newPass = document.getElementById('reset-password').value;
	var confirmPass = document.getElementById('reset-password-confirm').value;
	var errEl = document.getElementById('reset-error');
	var btn = document.getElementById('reset-btn');
	if (!newPass || newPass.length < 6) {
		errEl.textContent = 'A senha deve ter pelo menos 6 caracteres';
		errEl.classList.remove('hidden');
		return;
	}
	if (newPass !== confirmPass) {
		errEl.textContent = 'As senhas não coincidem';
		errEl.classList.remove('hidden');
		return;
	}
	btn.disabled = true;
	btn.textContent = 'Salvando...';
	errEl.classList.add('hidden');
	fetch('/api/platform/superadmins/' + _resetAdminId + '/reset-password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ new_password: newPass })
	})
	.then(function(r) {
		if (r.ok) { hideResetForm(); showToast('Senha redefinida com sucesso'); }
		else { errEl.textContent = 'Erro ao redefinir senha'; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Redefinir senha'; }
	});
}
`)}
</script>`;

	const createButton = html`
		<button onclick="showCreateForm()" class="bg-sk-blue hover:bg-sk-blue-dark text-white px-4 py-2 rounded-sk text-sm font-medium font-display transition-colors shadow-sk-sm">
			+ Novo Admin
		</button>
	`;

	return (
		<PlatformLayout
			title="Superadmins"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Superadmins" }]}
			actions={createButton}
			bodyScripts={script}
		>
			{/* Admins Table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
					<h2 class="font-semibold font-display text-sk-text">Administradores</h2>
					<span class="text-xs text-sk-muted font-body">{admins.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-5 py-3 font-medium font-display">Nome</th>
								<th class="px-5 py-3 font-medium font-display">Email</th>
								<th class="px-5 py-3 font-medium font-display text-center">Status</th>
								<th class="px-5 py-3 font-medium font-display">Criado em</th>
								<th class="px-5 py-3 font-medium font-display text-right">Acoes</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{admins.map((a) => (
								<tr class="hover:bg-sk-blue-light/30 transition-colors">
									<td class="px-5 py-3 font-medium text-sk-text">{a.name}</td>
									<td class="px-5 py-3 text-sk-muted">{a.email}</td>
									<td class="px-5 py-3 text-center">
										<span class={`inline-block w-2.5 h-2.5 rounded-full ${a.active ? "bg-sk-green" : "bg-sk-danger"}`} title={a.active ? "Ativo" : "Inativo"}></span>
									</td>
									<td class="px-5 py-3 text-sk-muted">{fmtDate(a.created_at)}</td>
									<td class="px-5 py-3 text-right">
										<div class="flex items-center justify-end gap-2">
											{a.active ? (
												<button onclick={`toggleActive(${a.id},1)`} class="text-sk-danger hover:text-sk-danger/80 text-xs font-medium font-display">Desativar</button>
											) : (
												<button onclick={`toggleActive(${a.id},0)`} class="text-sk-green hover:text-sk-green-dark text-xs font-medium font-display">Ativar</button>
											)}
											<button onclick={`resetPassword(${a.id})`} class="text-sk-blue hover:text-sk-blue-dark text-xs font-medium font-display">Reset Senha</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{admins.length === 0 && (
						<div class="text-center py-12 text-sk-muted font-body">
							<p class="text-lg mb-2">Nenhum admin cadastrado</p>
							<p class="text-sm">Crie o primeiro admin clicando em "+ Novo Admin"</p>
						</div>
					)}
				</div>
			</div>

			{/* Create Admin Modal */}
			<div id="create-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-md p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-bold font-display">Novo Admin</h3>
						<button onclick="hideCreateForm()" class="text-sk-muted hover:text-sk-muted text-xl">&times;</button>
					</div>
					<div id="create-error" class="hidden mb-3 p-3 bg-sk-danger-light text-sk-danger rounded-sk text-sm font-body"></div>
					<form onsubmit="createAdmin(event)" class="space-y-3">
						<div>
							<label class="block text-sm font-medium font-display text-sk-text mb-1">Nome</label>
							<input id="new-name" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border/50 rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium font-display text-sk-text mb-1">Email</label>
							<input id="new-email" type="email" required class="w-full px-3 py-2.5 border-2 border-sk-border/50 rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium font-display text-sk-text mb-1">Senha</label>
							<input id="new-password" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border/50 rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" placeholder="Gere uma senha segura" />
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" id="create-btn" class="flex-1 py-2.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-medium font-display text-sm transition-colors">Criar Admin</button>
							<button type="button" onclick="hideCreateForm()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-medium font-display text-sm transition-colors">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
			{/* Reset Password Modal */}
			<div id="reset-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-sm p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-2">
							<div class="bg-sk-blue-light w-10 h-10 rounded-sk flex items-center justify-center">
								<span class="text-lg">🔑</span>
							</div>
							<h3 class="text-lg font-bold font-display text-sk-text">Redefinir senha</h3>
						</div>
						<button onclick="hideResetForm()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<p class="text-sm text-sk-muted font-body mb-4">Digite a nova senha para este administrador.</p>
					<div id="reset-error" class="hidden mb-3 p-3 bg-sk-danger-light text-sk-danger rounded-sk text-sm font-body"></div>
					<form onsubmit="submitReset(event)" class="space-y-4">
						<div>
							<label class="block text-sm font-medium font-display text-sk-text mb-1">Nova senha</label>
							<input id="reset-password" type="password" required minlength={6} class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue text-base outline-none transition-colors" placeholder="Mínimo 6 caracteres" />
						</div>
						<div>
							<label class="block text-sm font-medium font-display text-sk-text mb-1">Confirmar senha</label>
							<input id="reset-password-confirm" type="password" required minlength={6} class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue text-base outline-none transition-colors" placeholder="Repita a senha" />
						</div>
						<div class="flex gap-2">
							<button type="submit" id="reset-btn" class="btn-bounce flex-1 py-2.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-sm transition-colors">Redefinir senha</button>
							<button type="button" onclick="hideResetForm()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm transition-colors">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
