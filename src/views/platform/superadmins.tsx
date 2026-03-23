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

function resetPassword(id) {
	var newPass = prompt('Digite a nova senha para este admin:');
	if (!newPass) return;
	fetch('/api/platform/superadmins/' + id + '/reset-password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ password: newPass })
	})
	.then(function(r) {
		if (r.ok) { showToast('Senha redefinida com sucesso'); }
		else alert('Erro ao redefinir senha');
	});
}
`)}
</script>`;

	const createButton = html`
		<button onclick="showCreateForm()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
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
			<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
				<div class="px-6 py-4 border-b flex items-center justify-between">
					<h2 class="font-semibold text-gray-900">Administradores</h2>
					<span class="text-xs text-gray-400">{admins.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
								<th class="px-5 py-3 font-medium">Nome</th>
								<th class="px-5 py-3 font-medium">Email</th>
								<th class="px-5 py-3 font-medium text-center">Status</th>
								<th class="px-5 py-3 font-medium">Criado em</th>
								<th class="px-5 py-3 font-medium text-right">Acoes</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{admins.map((a) => (
								<tr class="hover:bg-blue-50/30 transition-colors">
									<td class="px-5 py-3 font-medium text-gray-900">{a.name}</td>
									<td class="px-5 py-3 text-gray-600">{a.email}</td>
									<td class="px-5 py-3 text-center">
										<span class={`inline-block w-2.5 h-2.5 rounded-full ${a.active ? "bg-green-500" : "bg-red-500"}`} title={a.active ? "Ativo" : "Inativo"}></span>
									</td>
									<td class="px-5 py-3 text-gray-500">{fmtDate(a.created_at)}</td>
									<td class="px-5 py-3 text-right">
										<div class="flex items-center justify-end gap-2">
											{a.active ? (
												<button onclick={`toggleActive(${a.id},1)`} class="text-red-500 hover:text-red-700 text-xs font-medium">Desativar</button>
											) : (
												<button onclick={`toggleActive(${a.id},0)`} class="text-green-600 hover:text-green-800 text-xs font-medium">Ativar</button>
											)}
											<button onclick={`resetPassword(${a.id})`} class="text-blue-600 hover:text-blue-800 text-xs font-medium">Reset Senha</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{admins.length === 0 && (
						<div class="text-center py-12 text-gray-400">
							<p class="text-lg mb-2">Nenhum admin cadastrado</p>
							<p class="text-sm">Crie o primeiro admin clicando em "+ Novo Admin"</p>
						</div>
					)}
				</div>
			</div>

			{/* Create Admin Modal */}
			<div id="create-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-bold">Novo Admin</h3>
						<button onclick="hideCreateForm()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
					</div>
					<div id="create-error" class="hidden mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm"></div>
					<form onsubmit="createAdmin(event)" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Nome</label>
							<input id="new-name" type="text" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
							<input id="new-email" type="email" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Senha</label>
							<input id="new-password" type="text" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Gere uma senha segura" />
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" id="create-btn" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">Criar Admin</button>
							<button type="button" onclick="hideCreateForm()" class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
