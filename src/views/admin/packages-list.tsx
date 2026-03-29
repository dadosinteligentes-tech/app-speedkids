import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Package, Tenant } from "../../db/schema";
import { AdminLayout } from "./layout";

interface PackagesListProps {
	packages: Package[];
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

export const PackagesList: FC<PackagesListProps> = ({ packages, user, tenant, isPlatformAdmin }) => {
	const script = html`<script>
${raw(`
function showPackageForm(pkg) {
	var modal = document.getElementById('pkg-form-modal');
	var titleEl = document.getElementById('pkg-form-title');
	var form = document.getElementById('pkg-form');

	if (pkg) {
		titleEl.textContent = 'Editar Pacote';
		form.dataset.id = pkg.id;
		document.getElementById('pf-name').value = pkg.name;
		document.getElementById('pf-duration').value = pkg.duration_minutes;
		document.getElementById('pf-price').value = (pkg.price_cents / 100).toFixed(2);
		document.getElementById('pf-order').value = pkg.sort_order;
		document.getElementById('pf-ot-block').value = pkg.overtime_block_minutes || 5;
		document.getElementById('pf-ot-price').value = ((pkg.overtime_block_price_cents || 0) / 100).toFixed(2);
		document.getElementById('pf-grace').value = pkg.grace_period_minutes || 5;
		document.getElementById('pf-extension').checked = !!pkg.is_extension;
	} else {
		titleEl.textContent = 'Novo Pacote';
		delete form.dataset.id;
		form.reset();
		document.getElementById('pf-ot-block').value = 5;
		document.getElementById('pf-ot-price').value = '5.00';
		document.getElementById('pf-grace').value = 5;
		document.getElementById('pf-extension').checked = false;
	}
	modal.classList.remove('hidden');
}

function closePackageForm() {
	document.getElementById('pkg-form-modal').classList.add('hidden');
}

document.getElementById('pkg-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var form = e.target;
	var id = form.dataset.id;
	var body = {
		name: document.getElementById('pf-name').value,
		duration_minutes: Number(document.getElementById('pf-duration').value),
		price_cents: Math.round(parseFloat(document.getElementById('pf-price').value) * 100),
		sort_order: Number(document.getElementById('pf-order').value) || 0,
		overtime_block_minutes: Number(document.getElementById('pf-ot-block').value) || 5,
		overtime_block_price_cents: Math.round(parseFloat(document.getElementById('pf-ot-price').value || '0') * 100),
		grace_period_minutes: Number(document.getElementById('pf-grace').value) || 5,
		is_extension: document.getElementById('pf-extension').checked ? 1 : 0
	};

	var method = id ? 'PUT' : 'POST';
	var url = id ? '/api/packages/' + id : '/api/packages';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
});

function togglePackage(id) {
	fetch('/api/packages/' + id + '/toggle', { method: 'PATCH' }).then(function(r) {
		if (r.ok) location.reload();
	});
}
`)}
</script>`;

	return (
		<AdminLayout title="Pacotes" user={user} activeTab="/admin/packages" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">Pacotes</h2>
				<button onclick="showPackageForm(null)" class="btn-touch btn-bounce px-4 py-2 bg-sk-orange text-white rounded-sk font-display font-medium text-sm active:bg-sk-orange-dark">
					+ Novo Pacote
				</button>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium">Nome</th>
							<th class="px-4 py-3 font-medium">Duração</th>
							<th class="px-4 py-3 font-medium">Preço</th>
							<th class="px-4 py-3 font-medium">Excedente</th>
							<th class="px-4 py-3 font-medium">Status</th>
							<th class="px-4 py-3 font-medium">Ações</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{packages.map((pkg) => (
							<tr class={`hover:bg-sk-yellow-light ${!pkg.active ? "opacity-50" : ""}`}>
								<td class="px-4 py-3 font-medium">
									{pkg.name}
									{pkg.is_extension ? <span class="ml-2 px-2 py-0.5 rounded text-xs bg-sk-purple-light text-sk-purple font-display font-medium">Prorrogação</span> : null}
								</td>
								<td class="px-4 py-3 text-sk-muted">{pkg.duration_minutes} min</td>
								<td class="px-4 py-3 text-sk-muted">R$ {(pkg.price_cents / 100).toFixed(2).replace(".", ",")}</td>
								<td class="px-4 py-3 text-sk-muted text-xs">
									{pkg.overtime_block_price_cents > 0
										? `R$ ${(pkg.overtime_block_price_cents / 100).toFixed(2).replace(".", ",")} / ${pkg.overtime_block_minutes}min`
										: "—"}
									{pkg.overtime_block_price_cents > 0 && (
										<div class="text-gray-400">{pkg.grace_period_minutes}min tolerancia</div>
									)}
								</td>
								<td class="px-4 py-3">
									<span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${pkg.active ? "bg-sk-green-light text-sk-green-dark" : "bg-gray-100 text-gray-600"}`}>
										{pkg.active ? "Ativo" : "Inativo"}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex gap-2">
										<button
											onclick={`showPackageForm(${JSON.stringify({ id: pkg.id, name: pkg.name, duration_minutes: pkg.duration_minutes, price_cents: pkg.price_cents, sort_order: pkg.sort_order, overtime_block_minutes: pkg.overtime_block_minutes, overtime_block_price_cents: pkg.overtime_block_price_cents, grace_period_minutes: pkg.grace_period_minutes, is_extension: pkg.is_extension })})`}
											class="btn-bounce text-sk-blue-dark hover:underline text-xs"
										>
											Editar
										</button>
										<button
											onclick={`togglePackage(${pkg.id})`}
											class={`btn-bounce hover:underline text-xs ${pkg.active ? "text-sk-yellow-dark" : "text-sk-green-dark"}`}
										>
											{pkg.active ? "Desativar" : "Ativar"}
										</button>
									</div>
								</td>
							</tr>
						))}
						{packages.length === 0 && (
							<tr>
								<td colspan={6} class="px-4 py-8 text-center text-gray-400 font-body">Nenhum pacote cadastrado</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Form Modal */}
			<div id="pkg-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up">
					<h3 id="pkg-form-title" class="text-lg font-display font-bold mb-4 text-sk-text">Novo Pacote</h3>
					<form id="pkg-form" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Nome *</label>
							<input id="pf-name" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: 30 Minutos" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1 font-body">Duração (min) *</label>
								<input id="pf-duration" type="number" required min="1" class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="30" />
							</div>
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1 font-body">Preço (R$) *</label>
								<input id="pf-price" type="number" required min="0" step="0.01" class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="25.00" />
							</div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1 font-body">Ordem de exibição</label>
								<input id="pf-order" type="number" min="0" class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" value="0" />
							</div>
							<div class="flex items-end pb-2 gap-2">
								<input id="pf-extension" type="checkbox" class="w-4 h-4 rounded accent-sk-purple" />
								<label class="text-sm font-medium text-sk-text font-body">Pacote de prorrogação</label>
							</div>
						</div>
						<p class="text-xs text-sk-muted font-body -mt-2">Pacotes de prorrogação aparecem apenas na opção "Estender" durante uma locação ativa.</p>
						<div class="border-t border-sk-border pt-3 mt-1">
							<p class="text-sm font-display font-medium text-sk-text mb-2">Cobranca por excedente</p>
							<div class="grid grid-cols-3 gap-2">
								<div>
									<label class="block text-xs font-medium text-sk-muted mb-1 font-body">Bloco (min)</label>
									<input id="pf-ot-block" type="number" min="1" value="5" class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
								</div>
								<div>
									<label class="block text-xs font-medium text-sk-muted mb-1 font-body">Preco/bloco (R$)</label>
									<input id="pf-ot-price" type="number" min="0" step="0.01" value="5.00" class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
								</div>
								<div>
									<label class="block text-xs font-medium text-sk-muted mb-1 font-body">Tolerancia (min)</label>
									<input id="pf-grace" type="number" min="0" value="5" class="w-full px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
								</div>
							</div>
							<p class="text-xs text-sk-muted mt-1 font-body">Preco 0 = sem cobranca de excedente</p>
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-touch btn-bounce flex-1 py-2 bg-sk-orange text-white rounded-sk font-display font-medium active:bg-sk-orange-dark">Salvar</button>
							<button type="button" onclick="closePackageForm()" class="btn-touch btn-bounce flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-display font-medium active:bg-gray-300">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</AdminLayout>
	);
};
