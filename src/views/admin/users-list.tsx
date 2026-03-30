import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { User, Tenant } from "../../db/schema";
import { AdminLayout } from "./layout";

interface UsersListProps {
	users: Omit<User, "password_hash" | "salt">[];
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const ROLE_LABELS: Record<string, string> = {
	operator: "Operador",
	manager: "Gerente",
	owner: "Sócio",
};

export const UsersList: FC<UsersListProps> = ({ users, user, tenant, isPlatformAdmin, planFeatures }) => {
	const script = html`<script>
${raw(`
function showUserForm(u) {
	var modal = document.getElementById('user-form-modal');
	var titleEl = document.getElementById('user-form-title');
	var form = document.getElementById('user-form');
	var pwdField = document.getElementById('uf-password');

	if (u) {
		titleEl.textContent = 'Editar Usuário';
		form.dataset.id = u.id;
		document.getElementById('uf-name').value = u.name;
		document.getElementById('uf-email').value = u.email;
		document.getElementById('uf-role').value = u.role;
		pwdField.required = false;
		pwdField.placeholder = 'Deixe vazio para manter';
	} else {
		titleEl.textContent = 'Novo Usuário';
		delete form.dataset.id;
		form.reset();
		pwdField.required = true;
		pwdField.placeholder = 'Senha';
	}
	modal.classList.remove('hidden');
}

function closeUserForm() {
	document.getElementById('user-form-modal').classList.add('hidden');
}

document.getElementById('user-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var form = e.target;
	var id = form.dataset.id;
	var body = {
		name: document.getElementById('uf-name').value,
		email: document.getElementById('uf-email').value,
		role: document.getElementById('uf-role').value
	};
	var pwd = document.getElementById('uf-password').value;
	if (pwd) body.password = pwd;

	var method = id ? 'PUT' : 'POST';
	var url = id ? '/api/users/' + id : '/api/users';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
});

function deactivateUser(id, name) {
	if (!confirm('Deseja realmente desativar "' + name + '"?')) return;
	fetch('/api/users/' + id, { method: 'DELETE' }).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}
`)}
</script>`;

	return (
		<AdminLayout title="Usuários" user={user} activeTab="/admin/users" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">Usuários</h2>
				<button onclick="showUserForm(null)" class="btn-touch btn-bounce px-4 py-2 bg-sk-orange text-white rounded-sk font-display font-medium text-sm active:bg-sk-orange-dark">
					+ Novo Usuário
				</button>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-x-auto">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium">Nome</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Email</th>
							<th class="px-4 py-3 font-medium">Perfil</th>
							<th class="px-4 py-3 font-medium">Status</th>
							<th class="px-4 py-3 font-medium">Ações</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{users.map((u) => (
							<tr class={`hover:bg-sk-yellow-light ${!u.active ? "opacity-50" : ""}`}>
								<td class="px-4 py-3 font-medium">{u.name}</td>
								<td class="px-4 py-3 text-sk-muted hidden md:table-cell">{u.email}</td>
								<td class="px-4 py-3">
									<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sk-blue-light text-sk-blue-dark">
										{ROLE_LABELS[u.role] ?? u.role}
									</span>
								</td>
								<td class="px-4 py-3">
									<span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? "bg-sk-green-light text-sk-green-dark" : "bg-sk-danger-light text-sk-danger"}`}>
										{u.active ? "Ativo" : "Inativo"}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex gap-2">
										<button
											onclick={`showUserForm(${JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role })})`}
											class="btn-bounce text-sk-blue-dark hover:underline text-xs"
										>
											Editar
										</button>
										{u.active && (
											<button
												onclick={`deactivateUser(${u.id},'${u.name.replace(/'/g, "\\'")}')`}
												class="btn-bounce text-sk-danger hover:underline text-xs"
											>
												Desativar
											</button>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Form Modal */}
			<div id="user-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-end sm:items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-t-sk-xl sm:rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up max-h-[90vh] overflow-y-auto">
					<h3 id="user-form-title" class="text-lg font-display font-bold mb-4 text-sk-text">Novo Usuário</h3>
					<form id="user-form" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Nome *</label>
							<input id="uf-name" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Nome completo" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Email *</label>
							<input id="uf-email" type="email" required class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="email@exemplo.com" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Perfil *</label>
							<select id="uf-role" required class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue">
								<option value="operator">Operador</option>
								<option value="manager">Gerente</option>
								<option value="owner">Sócio</option>
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Senha *</label>
							<input id="uf-password" type="password" required minlength={6} class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Senha" />
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-touch btn-bounce flex-1 py-2 bg-sk-orange text-white rounded-sk font-display font-medium active:bg-sk-orange-dark">Salvar</button>
							<button type="button" onclick="closeUserForm()" class="btn-touch btn-bounce flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-display font-medium active:bg-gray-300">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</AdminLayout>
	);
};
