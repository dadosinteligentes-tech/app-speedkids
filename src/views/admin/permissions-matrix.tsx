import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Permission, RolePermission, Tenant } from "../../db/schema";
import { AdminLayout } from "./layout";

interface PermissionsMatrixProps {
	permissions: Permission[];
	rolePermissions: RolePermission[];
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const ROLE_LABELS: Record<string, string> = {
	operator: "Operador",
	manager: "Gerente",
	owner: "Socio",
};

const ROLES = ["operator", "manager", "owner"];

export const PermissionsMatrix: FC<PermissionsMatrixProps> = ({ permissions, rolePermissions, user, tenant, isPlatformAdmin, planFeatures }) => {
	const activeSet = new Set(rolePermissions.map((rp) => rp.role + ":" + rp.permission_key));

	const categories: Record<string, Permission[]> = {};
	for (const p of permissions) {
		if (!categories[p.category]) categories[p.category] = [];
		categories[p.category].push(p);
	}
	const categoryNames = Object.keys(categories);

	const script = html`<script>
${raw(`
var __DIRTY__ = false;

function onPermToggle() {
	__DIRTY__ = true;
	updateSaveBtn();
}

function updateSaveBtn() {
	var btn = document.getElementById('save-btn');
	if (__DIRTY__) {
		btn.disabled = false;
		btn.classList.remove('opacity-50');
	} else {
		btn.disabled = true;
		btn.classList.add('opacity-50');
	}
}

function savePermissions() {
	var btn = document.getElementById('save-btn');
	btn.disabled = true;
	btn.textContent = 'Salvando...';

	var roles = ['operator', 'manager'];
	var checkboxes = document.querySelectorAll('input[data-role]');
	var promises = [];

	for (var r = 0; r < roles.length; r++) {
		var role = roles[r];
		var perms = [];
		for (var i = 0; i < checkboxes.length; i++) {
			var cb = checkboxes[i];
			if (cb.getAttribute('data-role') === role && cb.checked) {
				perms.push(cb.getAttribute('data-key'));
			}
		}
		promises.push(
			fetch('/api/permissions/' + role, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ permissions: perms })
			})
		);
	}

	Promise.all(promises)
		.then(function(responses) {
			for (var j = 0; j < responses.length; j++) {
				if (!responses[j].ok) {
					return responses[j].json().then(function(e) {
						throw new Error(e.error || 'Erro ao salvar');
					});
				}
			}
			__DIRTY__ = false;
			btn.textContent = 'Salvo!';
			btn.classList.remove('bg-sk-orange');
			btn.classList.add('bg-sk-green');
			setTimeout(function() {
				btn.textContent = 'Salvar Alteracoes';
				btn.classList.remove('bg-sk-green');
				btn.classList.add('bg-sk-orange');
				updateSaveBtn();
			}, 2000);
		})
		.catch(function(err) {
			alert('Erro: ' + err.message);
			btn.disabled = false;
			btn.textContent = 'Salvar Alteracoes';
		});
}
`)}
</script>`;

	return (
		<AdminLayout title="Permissoes" user={user} activeTab="/admin/permissions" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-xl font-display font-bold text-sk-text">Permissoes por Perfil</h2>
					<p class="text-sm text-sk-muted font-body mt-1">
						Configure o que cada perfil pode fazer. O perfil Socio sempre tem todas as permissoes.
					</p>
				</div>
				<button
					id="save-btn"
					onclick="savePermissions()"
					disabled
					class="btn-touch btn-bounce px-6 py-2 bg-sk-orange text-white rounded-sk font-display font-medium opacity-50"
				>
					Salvar Alteracoes
				</button>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-x-auto">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium min-w-[200px]">Permissao</th>
							{ROLES.map((role) => (
								<th class="px-4 py-3 font-medium text-center w-28">{ROLE_LABELS[role]}</th>
							))}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{categoryNames.map((cat) => (
							<>
								<tr class="bg-sk-orange/5">
									<td colspan={4} class="px-4 py-2 font-display font-bold text-sk-orange text-sm">
										{cat}
									</td>
								</tr>
								{categories[cat].map((perm) => (
									<tr class="hover:bg-sk-yellow-light/30">
										<td class="px-4 py-3">
											<div class="font-medium text-sk-text">{perm.label}</div>
											{perm.description && (
												<div class="text-xs text-sk-muted mt-0.5">{perm.description}</div>
											)}
										</td>
										{ROLES.map((role) => {
											const isOwner = role === "owner";
											const checked = activeSet.has(role + ":" + perm.key);
											return (
												<td class="px-4 py-3 text-center">
													<input
														type="checkbox"
														id={`cb-${role}-${perm.key}`}
														data-role={role}
														data-key={perm.key}
														checked={checked}
														disabled={isOwner}
														onchange={isOwner ? undefined : "onPermToggle()"}
														class={`w-5 h-5 rounded accent-sk-orange ${isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
													/>
												</td>
											);
										})}
									</tr>
								))}
							</>
						))}
					</tbody>
				</table>
			</div>
		</AdminLayout>
	);
};
