import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Asset, AssetType } from "../../db/schema";
import { AdminLayout } from "./layout";

interface AssetsListProps {
	assets: Asset[];
	assetTypes: AssetType[];
	user: { name: string; role: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
	available: "Disponível",
	in_use: "Em uso",
	maintenance: "Manutenção",
	retired: "Aposentado",
};

const STATUS_COLORS: Record<string, string> = {
	available: "bg-sk-green-light text-sk-green-dark",
	in_use: "bg-sk-blue-light text-sk-blue-dark",
	maintenance: "bg-sk-yellow-light text-sk-yellow-dark",
	retired: "bg-gray-100 text-gray-600",
};

export const AssetsList: FC<AssetsListProps> = ({ assets, assetTypes, user }) => {
	const typeMap = Object.fromEntries(assetTypes.map((t) => [t.name, t.label]));
	const isOwner = user?.role === "owner";

	const script = html`<script>
${raw(`
var __ASSET_TYPES__ = ${JSON.stringify(assetTypes)};

function showAssetForm(asset) {
	var modal = document.getElementById('asset-form-modal');
	var titleEl = document.getElementById('form-title');
	var form = document.getElementById('asset-form');

	if (asset) {
		titleEl.textContent = 'Editar Ativo';
		form.dataset.id = asset.id;
		document.getElementById('f-name').value = asset.name;
		document.getElementById('f-type').value = asset.asset_type;
		document.getElementById('f-model').value = asset.model || '';
		document.getElementById('f-max-weight').value = asset.max_weight_kg != null ? asset.max_weight_kg : '';
		document.getElementById('f-min-age').value = asset.min_age != null ? asset.min_age : '';
		document.getElementById('f-max-age').value = asset.max_age != null ? asset.max_age : '';
		document.getElementById('f-sort-order').value = asset.sort_order != null ? asset.sort_order : 0;
		document.getElementById('f-notes').value = asset.notes || '';
		document.getElementById('f-battery').checked = !!asset.uses_battery;
	} else {
		titleEl.textContent = 'Novo Ativo';
		delete form.dataset.id;
		form.reset();
		document.getElementById('f-sort-order').value = 0;
	}
	modal.classList.remove('hidden');
}

function closeAssetForm() {
	document.getElementById('asset-form-modal').classList.add('hidden');
}

document.getElementById('asset-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var form = e.target;
	var id = form.dataset.id;
	var body = {
		name: document.getElementById('f-name').value,
		asset_type: document.getElementById('f-type').value,
		model: document.getElementById('f-model').value || null,
		notes: document.getElementById('f-notes').value || null,
		uses_battery: document.getElementById('f-battery').checked ? 1 : 0,
		max_weight_kg: parseFloat(document.getElementById('f-max-weight').value) || null,
		min_age: parseInt(document.getElementById('f-min-age').value) || null,
		max_age: parseInt(document.getElementById('f-max-age').value) || null,
		sort_order: parseInt(document.getElementById('f-sort-order').value) || 0
	};

	var method = id ? 'PUT' : 'POST';
	var url = id ? '/api/assets/' + id : '/api/assets';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
});

function retireAsset(id, name) {
	if (!confirm('Deseja realmente aposentar "' + name + '"?')) return;
	fetch('/api/assets/' + id, { method: 'DELETE' }).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

// ── Asset Types CRUD ──

function showTypeForm(type) {
	var modal = document.getElementById('type-form-modal');
	var titleEl = document.getElementById('type-form-title');
	var form = document.getElementById('type-form');

	if (type) {
		titleEl.textContent = 'Editar Tipo';
		form.dataset.id = type.id;
		document.getElementById('ft-name').value = type.name;
		document.getElementById('ft-name').readOnly = true;
		document.getElementById('ft-label').value = type.label;
	} else {
		titleEl.textContent = 'Novo Tipo';
		delete form.dataset.id;
		document.getElementById('ft-name').readOnly = false;
		form.reset();
	}
	modal.classList.remove('hidden');
}

function closeTypeForm() {
	document.getElementById('type-form-modal').classList.add('hidden');
}

document.getElementById('type-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var form = e.target;
	var id = form.dataset.id;

	var body = { label: document.getElementById('ft-label').value };
	if (!id) {
		body.name = document.getElementById('ft-name').value;
	}

	var method = id ? 'PUT' : 'POST';
	var url = id ? '/api/asset-types/' + id : '/api/asset-types';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
});

function deleteType(id, label) {
	if (!confirm('Deseja excluir o tipo "' + label + '"?')) return;
	fetch('/api/asset-types/' + id, { method: 'DELETE' }).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}
`)}
</script>`;

	return (
		<AdminLayout title="Ativos" user={user} activeTab="/admin/assets" bodyScripts={script}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">Ativos / Brinquedos</h2>
				<button onclick="showAssetForm(null)" class="btn-touch px-4 py-2 bg-sk-orange text-white rounded-sk font-display font-medium text-sm btn-bounce active:bg-sk-orange-dark">
					+ Novo Ativo
				</button>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium font-body">Nome</th>
							<th class="px-4 py-3 font-medium font-body">Tipo</th>
							<th class="px-4 py-3 font-medium font-body hidden md:table-cell">Modelo</th>
							<th class="px-4 py-3 font-medium font-body hidden md:table-cell">Peso</th>
							<th class="px-4 py-3 font-medium font-body hidden md:table-cell">Idade</th>
							<th class="px-4 py-3 font-medium font-body">Status</th>
							<th class="px-4 py-3 font-medium font-body">Acoes</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{assets.map((asset) => (
							<tr class="hover:bg-sk-yellow-light">
								<td class="px-4 py-3 font-medium font-body">{asset.name}</td>
								<td class="px-4 py-3 text-sk-muted font-body">{typeMap[asset.asset_type] ?? asset.asset_type}</td>
								<td class="px-4 py-3 text-sk-muted font-body hidden md:table-cell">{asset.model ?? "—"}</td>
								<td class="px-4 py-3 text-sk-muted font-body hidden md:table-cell">{asset.max_weight_kg != null ? `${asset.max_weight_kg} kg` : "—"}</td>
								<td class="px-4 py-3 text-sk-muted font-body hidden md:table-cell">{asset.min_age != null || asset.max_age != null ? `${asset.min_age ?? "?"}–${asset.max_age ?? "?"} anos` : "—"}</td>
								<td class="px-4 py-3">
									<span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status] ?? ""}`}>
										{STATUS_LABELS[asset.status] ?? asset.status}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex gap-2">
										<button
											onclick={`showAssetForm(${JSON.stringify({ id: asset.id, name: asset.name, asset_type: asset.asset_type, model: asset.model, notes: asset.notes, uses_battery: asset.uses_battery, max_weight_kg: asset.max_weight_kg, min_age: asset.min_age, max_age: asset.max_age, sort_order: asset.sort_order })})`}
											class="text-sk-blue-dark hover:underline text-xs font-body"
										>
											Editar
										</button>
										{asset.status !== "retired" && (
											<button
												onclick={`retireAsset(${asset.id},'${asset.name.replace(/'/g, "\\'")}')`}
												class="text-sk-danger hover:underline text-xs font-body"
											>
												Aposentar
											</button>
										)}
									</div>
								</td>
							</tr>
						))}
						{assets.length === 0 && (
							<tr>
								<td colspan={7} class="px-4 py-8 text-center text-gray-400 font-body">Nenhum ativo cadastrado</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* ── Gerenciar Tipos ── */}
			<div class="mt-8">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-display font-bold text-sk-text">Tipos de Ativo</h2>
					<button onclick="showTypeForm(null)" class="btn-touch px-4 py-2 bg-sk-blue text-white rounded-sk font-display font-medium text-sm btn-bounce active:bg-sk-blue-dark">
						+ Novo Tipo
					</button>
				</div>

				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<table class="w-full text-sm">
						<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
							<tr>
								<th class="px-4 py-3 font-medium font-body">Nome Interno</th>
								<th class="px-4 py-3 font-medium font-body">Label</th>
								<th class="px-4 py-3 font-medium font-body">Acoes</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{assetTypes.map((t) => (
								<tr class="hover:bg-sk-yellow-light">
									<td class="px-4 py-3 font-mono text-xs text-sk-muted">{t.name}</td>
									<td class="px-4 py-3 font-medium font-body">{t.label}</td>
									<td class="px-4 py-3">
										<div class="flex gap-2">
											<button
												onclick={`showTypeForm(${JSON.stringify({ id: t.id, name: t.name, label: t.label })})`}
												class="text-sk-blue-dark hover:underline text-xs font-body"
											>
												Editar
											</button>
											{isOwner && (
												<button
													onclick={`deleteType(${t.id},'${t.label.replace(/'/g, "\\'")}')`}
													class="text-sk-danger hover:underline text-xs font-body"
												>
													Excluir
												</button>
											)}
										</div>
									</td>
								</tr>
							))}
							{assetTypes.length === 0 && (
								<tr>
									<td colspan={3} class="px-4 py-8 text-center text-gray-400 font-body">Nenhum tipo cadastrado</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Asset Form Modal */}
			<div id="asset-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up">
					<h3 id="form-title" class="text-lg font-display font-bold mb-4 text-sk-text">Novo Ativo</h3>
					<form id="asset-form" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Nome *</label>
							<input id="f-name" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: Carrinho 01" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Tipo *</label>
							<select id="f-type" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue">
								{assetTypes.map((t) => (
									<option value={t.name}>{t.label}</option>
								))}
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Modelo</label>
							<input id="f-model" type="text" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: Modelo XYZ" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Peso maximo (kg)</label>
							<input id="f-max-weight" type="number" step="0.1" min="0" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: 30" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Idade recomendada</label>
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="block text-xs text-sk-muted mb-1 font-body">Idade minima</label>
									<input id="f-min-age" type="number" min="1" max="17" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: 3" />
								</div>
								<div>
									<label class="block text-xs text-sk-muted mb-1 font-body">Idade maxima</label>
									<input id="f-max-age" type="number" min="1" max="17" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: 10" />
								</div>
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Ordem de exibicao</label>
							<input id="f-sort-order" type="number" min="0" value="0" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Observações</label>
							<textarea id="f-notes" rows={2} class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Notas adicionais..."></textarea>
						</div>
						<div class="flex items-center gap-2">
							<input id="f-battery" type="checkbox" class="w-4 h-4 rounded border-sk-border text-sk-orange focus:ring-sk-orange/30" />
							<label for="f-battery" class="text-sm font-medium text-sk-text font-body">Usa bateria</label>
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-touch flex-1 py-2 bg-sk-orange text-white rounded-sk font-display font-medium btn-bounce active:bg-sk-orange-dark">Salvar</button>
							<button type="button" onclick="closeAssetForm()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-body font-medium active:bg-gray-300">Cancelar</button>
						</div>
					</form>
				</div>
			</div>

			{/* Type Form Modal */}
			<div id="type-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up">
					<h3 id="type-form-title" class="text-lg font-display font-bold mb-4 text-sk-text">Novo Tipo</h3>
					<form id="type-form" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Nome Interno *</label>
							<input id="ft-name" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: triciclo" />
							<p class="text-xs text-sk-muted mt-1 font-body">Identificador unico (sem espacos ou acentos)</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Label *</label>
							<input id="ft-label" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: Triciclo" />
							<p class="text-xs text-sk-muted mt-1 font-body">Nome exibido na interface</p>
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-touch flex-1 py-2 bg-sk-blue text-white rounded-sk font-display font-medium btn-bounce active:bg-sk-blue-dark">Salvar</button>
							<button type="button" onclick="closeTypeForm()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-body font-medium active:bg-gray-300">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</AdminLayout>
	);
};
