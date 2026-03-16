import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Asset, BatteryView } from "../../db/schema";
import { AdminLayout } from "./layout";

interface BatteriesListProps {
	batteries: BatteryView[];
	assets: Asset[];
	user: { name: string; role: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
	charging: "Carregando",
	ready: "Pronta",
	in_use: "Em uso",
	depleted: "Descarregada",
	retired: "Aposentada",
};

const STATUS_COLORS: Record<string, string> = {
	charging: "bg-sk-yellow-light text-sk-yellow-dark",
	ready: "bg-sk-green-light text-sk-green-dark",
	in_use: "bg-sk-blue-light text-sk-blue-dark",
	depleted: "bg-sk-danger-light text-sk-danger",
	retired: "bg-gray-100 text-gray-600",
};

export const BatteriesList: FC<BatteriesListProps> = ({ batteries, assets, user }) => {
	// Assets that use battery and don't already have one installed
	const installedAssetIds = new Set(batteries.filter((b) => b.asset_id).map((b) => b.asset_id));
	const availableAssets = assets.filter((a) => !installedAssetIds.has(a.id));

	const script = html`<script>
${raw(`
var __ASSETS__ = ${JSON.stringify(availableAssets.map((a) => ({ id: a.id, name: a.name })))};
var __ALL_BATTERY_ASSETS__ = ${JSON.stringify(assets.map((a) => ({ id: a.id, name: a.name })))};

function showBatteryForm(battery) {
	var modal = document.getElementById('battery-form-modal');
	var titleEl = document.getElementById('bf-title');
	var form = document.getElementById('battery-form');

	if (battery) {
		titleEl.textContent = 'Editar Bateria';
		form.dataset.id = battery.id;
		document.getElementById('bf-label').value = battery.label;
		document.getElementById('bf-charge').value = battery.full_charge_minutes;
		document.getElementById('bf-charge-time').value = battery.charge_time_minutes || 480;
		document.getElementById('bf-notes').value = battery.notes || '';
	} else {
		titleEl.textContent = 'Nova Bateria';
		delete form.dataset.id;
		form.reset();
		document.getElementById('bf-charge').value = '90';
		document.getElementById('bf-charge-time').value = '480';
	}
	modal.classList.remove('hidden');
}

function closeBatteryForm() {
	document.getElementById('battery-form-modal').classList.add('hidden');
}

document.getElementById('battery-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var form = e.target;
	var id = form.dataset.id;
	var body = {
		label: document.getElementById('bf-label').value,
		full_charge_minutes: parseInt(document.getElementById('bf-charge').value, 10) || 90,
		charge_time_minutes: parseInt(document.getElementById('bf-charge-time').value, 10) || 480,
		notes: document.getElementById('bf-notes').value || null
	};

	var method = id ? 'PUT' : 'POST';
	var url = id ? '/api/batteries/' + id : '/api/batteries';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
});

function chargeBattery(id, label) {
	if (!confirm('Marcar "' + label + '" como carregada?')) return;
	fetch('/api/batteries/' + id + '/charge', { method: 'POST' }).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

function retireBattery(id, label) {
	if (!confirm('Deseja aposentar "' + label + '"?')) return;
	fetch('/api/batteries/' + id, { method: 'DELETE' }).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

// ── Level Adjust ──
var __BL_ID__ = null;
var __BL_FULL__ = 90;

function showBatteryLevelAdmin(battery) {
	__BL_ID__ = battery.id;
	__BL_FULL__ = battery.full_charge_minutes || 90;
	__BL_CHARGE_TIME__ = battery.charge_time_minutes || 480;
	__BL_FULL_CHARGE__ = battery.full_charge_minutes || 90;
	var subtitle = document.getElementById('bla-subtitle');
	if (subtitle) subtitle.textContent = battery.label;

	var slider = document.getElementById('bla-slider');
	if (slider) { slider.max = __BL_FULL__; slider.value = battery.estimated_minutes_remaining; }
	var input = document.getElementById('bla-minutes');
	if (input) { input.value = battery.estimated_minutes_remaining; input.max = __BL_FULL__; }
	updateLevelPreview();
	// Reset charging section
	document.getElementById('bla-charging-section').classList.add('hidden');
	document.getElementById('bla-charging-minutes').value = '';
	document.getElementById('bla-charging-preview').textContent = '';
	document.getElementById('battery-level-admin-modal').classList.remove('hidden');
}

function closeBatteryLevelAdmin() {
	document.getElementById('battery-level-admin-modal').classList.add('hidden');
}

function setLevelPct(fraction) {
	var mins = Math.round(__BL_FULL__ * fraction);
	var slider = document.getElementById('bla-slider');
	if (slider) slider.value = mins;
	var input = document.getElementById('bla-minutes');
	if (input) input.value = mins;
	updateLevelPreview();
}

function onAdminSlider(val) {
	var input = document.getElementById('bla-minutes');
	if (input) input.value = val;
	updateLevelPreview();
}

function onAdminMinutesInput() {
	var input = document.getElementById('bla-minutes');
	var mins = parseInt(input ? input.value : '0', 10) || 0;
	var slider = document.getElementById('bla-slider');
	if (slider) slider.value = Math.min(mins, __BL_FULL__);
	updateLevelPreview();
}

function updateLevelPreview() {
	var input = document.getElementById('bla-minutes');
	var mins = parseInt(input ? input.value : '0', 10) || 0;
	var pct = __BL_FULL__ > 0 ? Math.min(100, Math.round((mins / __BL_FULL__) * 100)) : 0;
	var bar = document.getElementById('bla-bar');
	if (bar) {
		bar.style.width = pct + '%';
		bar.className = 'h-full rounded-full transition-all ' + (pct > 50 ? 'bg-sk-green' : pct > 25 ? 'bg-sk-yellow' : 'bg-sk-danger');
	}
	var pctEl = document.getElementById('bla-pct');
	if (pctEl) pctEl.textContent = pct + '%';
	var minsLabel = document.getElementById('bla-mins-label');
	if (minsLabel) minsLabel.textContent = mins + ' min';
}

function saveBatteryLevelAdmin() {
	if (!__BL_ID__) return;
	var input = document.getElementById('bla-minutes');
	var mins = parseInt(input ? input.value : '0', 10) || 0;
	fetch('/api/batteries/' + __BL_ID__ + '/level', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ estimated_minutes_remaining: mins })
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

// ── Tab Sorting ──
function showBatteryTab(tab) {
	var tabAll = document.getElementById('tab-all');
	var tabLowest = document.getElementById('tab-lowest');
	var activeClass = 'px-3 py-1.5 rounded-lg text-xs font-medium font-body bg-sk-orange text-white';
	var inactiveClass = 'px-3 py-1.5 rounded-lg text-xs font-medium font-body text-sk-muted hover:bg-sk-yellow-light';
	tabAll.className = tab === 'all' ? activeClass : inactiveClass;
	tabLowest.className = tab === 'lowest' ? activeClass : inactiveClass;

	var rows = Array.from(document.querySelectorAll('#battery-table tbody tr'));
	if (tab === 'lowest') {
		rows.sort(function(a, b) {
			return (parseInt(a.dataset.remaining, 10) || 0) - (parseInt(b.dataset.remaining, 10) || 0);
		});
	} else {
		rows.sort(function(a, b) {
			return (a.dataset.label || '').localeCompare(b.dataset.label || '');
		});
	}
	var tbody = document.querySelector('#battery-table tbody');
	rows.forEach(function(r) { tbody.appendChild(r); });
}

// ── Charging Time Calculator ──
var __BL_CHARGE_TIME__ = 480;
var __BL_FULL_CHARGE__ = 90;

function toggleChargingTime() {
	var section = document.getElementById('bla-charging-section');
	section.classList.toggle('hidden');
}

function previewChargingTime() {
	var mins = parseInt(document.getElementById('bla-charging-minutes').value, 10) || 0;
	var additional = Math.round((mins / __BL_CHARGE_TIME__) * __BL_FULL_CHARGE__);
	var preview = document.getElementById('bla-charging-preview');
	if (mins > 0) {
		preview.textContent = '+' + additional + ' min de autonomia adicional';
	} else {
		preview.textContent = '';
	}
}

function applyChargingTime() {
	if (!__BL_ID__) return;
	var mins = parseInt(document.getElementById('bla-charging-minutes').value, 10) || 0;
	if (mins <= 0) { alert('Informe um tempo valido'); return; }
	fetch('/api/batteries/' + __BL_ID__ + '/charge-time', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ charging_minutes: mins })
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

// ── Install / Uninstall ──
function showInstallModal(batteryId, batteryLabel) {
	document.getElementById('inst-battery-label').textContent = batteryLabel;
	document.getElementById('inst-battery-id').value = batteryId;

	var select = document.getElementById('inst-asset');
	select.innerHTML = '<option value="">Selecione um ativo...</option>';
	__ASSETS__.forEach(function(a) {
		var opt = document.createElement('option');
		opt.value = a.id;
		opt.textContent = a.name;
		select.appendChild(opt);
	});

	if (__ASSETS__.length === 0) {
		select.innerHTML = '<option value="">Nenhum ativo disponivel</option>';
	}

	document.getElementById('install-modal').classList.remove('hidden');
}

function closeInstallModal() {
	document.getElementById('install-modal').classList.add('hidden');
}

function confirmInstall() {
	var batteryId = document.getElementById('inst-battery-id').value;
	var assetId = document.getElementById('inst-asset').value;
	if (!assetId) { alert('Selecione um ativo'); return; }
	fetch('/api/batteries/' + batteryId + '/install', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ asset_id: parseInt(assetId, 10) })
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

function uninstallBattery(id, label) {
	if (!confirm('Remover "' + label + '" do ativo?')) return;
	fetch('/api/batteries/' + id + '/uninstall', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({})
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}
`)}
</script>`;

	return (
		<AdminLayout title="Baterias" user={user} activeTab="/admin/batteries" bodyScripts={script}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">🔋 Inventario de Baterias</h2>
				<button onclick="showBatteryForm(null)" class="btn-touch px-4 py-2 bg-sk-orange text-white rounded-sk font-display font-medium text-sm btn-bounce active:bg-sk-orange-dark">
					+ Nova Bateria
				</button>
			</div>

			<div class="flex gap-2 mb-4">
				<button onclick="showBatteryTab('all')" id="tab-all" class="px-3 py-1.5 rounded-lg text-xs font-medium font-body bg-sk-orange text-white">Todas</button>
				<button onclick="showBatteryTab('lowest')" id="tab-lowest" class="px-3 py-1.5 rounded-lg text-xs font-medium font-body text-sk-muted hover:bg-sk-yellow-light">Menor Carga</button>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table id="battery-table" class="w-full text-sm">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium font-body">Label</th>
							<th class="px-4 py-3 font-medium font-body">Status</th>
							<th class="px-4 py-3 font-medium font-body">Ativo</th>
							<th class="px-4 py-3 font-medium font-body">Carga</th>
							<th class="px-4 py-3 font-medium font-body hidden md:table-cell">Ultima Carga</th>
							<th class="px-4 py-3 font-medium font-body">Acoes</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{batteries.map((bat) => {
							const pct = bat.full_charge_minutes > 0 ? Math.round((bat.estimated_minutes_remaining / bat.full_charge_minutes) * 100) : 0;
							const barColor = pct > 50 ? "bg-sk-green" : pct > 25 ? "bg-sk-yellow" : "bg-sk-danger";
							return (
								<tr class="hover:bg-sk-yellow-light" data-remaining={String(bat.estimated_minutes_remaining)} data-label={bat.label}>
									<td class="px-4 py-3 font-display font-bold text-sk-text">{bat.label}</td>
									<td class="px-4 py-3">
										<span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bat.status] ?? ""}`}>
											{STATUS_LABELS[bat.status] ?? bat.status}
										</span>
									</td>
									<td class="px-4 py-3 font-body">
										{bat.asset_name ? (
											<div class="flex items-center gap-1">
												<span class="text-sk-text text-xs">{bat.asset_name}</span>
												<button
													onclick={`uninstallBattery(${bat.id},'${bat.label.replace(/'/g, "\\'")}')`}
													class="text-sk-danger hover:underline text-xs ml-1"
													title="Remover do ativo"
												>
													✕
												</button>
											</div>
										) : bat.status !== "retired" ? (
											<button
												onclick={`showInstallModal(${bat.id},'${bat.label.replace(/'/g, "\\'")}')`}
												class="text-sk-blue-dark hover:underline text-xs font-body"
											>
												Instalar
											</button>
										) : (
											<span class="text-gray-400">—</span>
										)}
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
												<div class={`h-full rounded-full ${barColor}`} style={`width:${pct}%`}></div>
											</div>
											<span class="text-xs font-body text-sk-muted">{bat.estimated_minutes_remaining} min</span>
										</div>
									</td>
									<td class="px-4 py-3 text-xs text-sk-muted font-body hidden md:table-cell">
										{bat.last_charged_at ? new Date(bat.last_charged_at).toLocaleString("pt-BR") : "—"}
									</td>
									<td class="px-4 py-3">
										<div class="flex gap-2 flex-wrap">
											<button
												onclick={`showBatteryForm(${JSON.stringify({ id: bat.id, label: bat.label, full_charge_minutes: bat.full_charge_minutes, charge_time_minutes: bat.charge_time_minutes, notes: bat.notes })})`}
												class="text-sk-blue-dark hover:underline text-xs font-body"
											>
												Editar
											</button>
											{bat.status !== "retired" && (
												<button
													onclick={`showBatteryLevelAdmin(${JSON.stringify({ id: bat.id, label: bat.label, full_charge_minutes: bat.full_charge_minutes, charge_time_minutes: bat.charge_time_minutes, estimated_minutes_remaining: bat.estimated_minutes_remaining })})`}
													class="text-sk-orange-dark hover:underline text-xs font-body"
												>
													Ajustar
												</button>
											)}
											{bat.status !== "ready" && bat.status !== "retired" && (
												<button
													onclick={`chargeBattery(${bat.id},'${bat.label.replace(/'/g, "\\'")}')`}
													class="text-sk-green-dark hover:underline text-xs font-body"
												>
													Carregar
												</button>
											)}
											{bat.status !== "retired" && (
												<button
													onclick={`retireBattery(${bat.id},'${bat.label.replace(/'/g, "\\'")}')`}
													class="text-sk-danger hover:underline text-xs font-body"
												>
													Aposentar
												</button>
											)}
										</div>
									</td>
								</tr>
							);
						})}
						{batteries.length === 0 && (
							<tr>
								<td colspan={6} class="px-4 py-8 text-center text-gray-400 font-body">Nenhuma bateria cadastrada</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Battery Form Modal */}
			<div id="battery-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up">
					<h3 id="bf-title" class="text-lg font-display font-bold mb-4 text-sk-text">Nova Bateria</h3>
					<form id="battery-form" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Label *</label>
							<input id="bf-label" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Ex: BAT-01" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Duracao Carga Completa (min)</label>
							<input id="bf-charge" type="number" min="1" value="90" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Tempo de Carregamento (min)</label>
							<input id="bf-charge-time" type="number" min="1" value="480" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" />
							<p class="text-xs text-sk-muted font-body mt-1">Tempo para recarregar 0% a 100% (padrao 480 = 8h)</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1 font-body">Observações</label>
							<textarea id="bf-notes" rows={2} class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Notas adicionais..."></textarea>
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-touch flex-1 py-2 bg-sk-orange text-white rounded-sk font-display font-medium btn-bounce active:bg-sk-orange-dark">Salvar</button>
							<button type="button" onclick="closeBatteryForm()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-body font-medium active:bg-gray-300">Cancelar</button>
						</div>
					</form>
				</div>
			</div>

			{/* Battery Level Adjust Modal */}
			<div id="battery-level-admin-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-sm p-6 modal-slide-up">
					<div class="flex items-center gap-2 mb-1">
						<span class="text-lg">🔋</span>
						<h3 class="font-display font-bold text-sk-text">Ajustar Nivel</h3>
					</div>
					<p id="bla-subtitle" class="text-sm text-sk-muted font-body mb-4"></p>

					<div class="mb-3">
						<div class="w-full h-5 bg-gray-200 rounded-full overflow-hidden">
							<div id="bla-bar" class="h-full rounded-full bg-sk-green transition-all" style="width:0%"></div>
						</div>
						<div class="flex justify-between mt-1">
							<span id="bla-pct" class="text-base font-display font-bold text-sk-text">0%</span>
							<span id="bla-mins-label" class="text-base font-display font-bold text-sk-muted">0 min</span>
						</div>
					</div>

					<div class="mb-4">
						<input id="bla-slider" type="range" min="0" max="90" value="0" class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-sk-orange" oninput="onAdminSlider(this.value)" />
					</div>

					<div class="grid grid-cols-4 gap-2 mb-3">
						<button type="button" onclick="setLevelPct(0.25)" class="btn-touch py-1.5 bg-sk-danger-light text-sk-danger rounded-sk font-display font-bold text-xs active:opacity-70">25%</button>
						<button type="button" onclick="setLevelPct(0.50)" class="btn-touch py-1.5 bg-sk-yellow-light text-sk-yellow-dark rounded-sk font-display font-bold text-xs active:opacity-70">50%</button>
						<button type="button" onclick="setLevelPct(0.75)" class="btn-touch py-1.5 bg-sk-green-light text-sk-green-dark rounded-sk font-display font-bold text-xs active:opacity-70">75%</button>
						<button type="button" onclick="setLevelPct(1.00)" class="btn-touch py-1.5 bg-sk-green-light text-sk-green-dark rounded-sk font-display font-bold text-xs active:opacity-70">100%</button>
					</div>

					<div class="mb-4 flex items-center gap-2">
						<label class="text-sm font-medium text-sk-text font-body whitespace-nowrap">Minutos:</label>
						<input id="bla-minutes" type="number" min="0" class="flex-1 px-3 py-2 border border-sk-border rounded-sk font-body text-center text-lg font-bold focus:ring-sk-blue/30 focus:border-sk-blue" oninput="onAdminMinutesInput()" />
					</div>

					<div class="flex gap-2">
						<button type="button" onclick="saveBatteryLevelAdmin()" class="btn-touch flex-1 py-2 bg-sk-orange text-white rounded-sk font-display font-medium btn-bounce active:bg-sk-orange-dark">Salvar</button>
						<button type="button" onclick="closeBatteryLevelAdmin()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-body font-medium active:bg-gray-300">Cancelar</button>
					</div>

					<div class="border-t border-sk-border pt-3 mt-3">
						<button type="button" onclick="toggleChargingTime()" class="text-sm text-sk-blue-dark font-body hover:underline mb-2">
							Calcular por tempo de carga
						</button>
						<div id="bla-charging-section" class="hidden">
							<div class="flex items-center gap-2 mb-1">
								<label class="text-sm font-medium text-sk-text font-body whitespace-nowrap">Tempo na carga:</label>
								<input id="bla-charging-minutes" type="number" min="0" class="flex-1 px-3 py-2 border border-sk-border rounded-sk font-body text-center" placeholder="min" oninput="previewChargingTime()" />
							</div>
							<p id="bla-charging-preview" class="text-xs text-sk-muted font-body mb-2"></p>
							<button type="button" onclick="applyChargingTime()" class="btn-touch w-full py-2 bg-sk-blue text-white rounded-sk font-display font-medium text-sm btn-bounce">
								Adicionar Carga
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Install Battery Modal */}
			<div id="install-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-sm p-6 modal-slide-up">
					<div class="flex items-center gap-2 mb-1">
						<span class="text-lg">🔌</span>
						<h3 class="font-display font-bold text-sk-text">Instalar Bateria</h3>
					</div>
					<p class="text-sm text-sk-muted font-body mb-4">
						Instalar <strong id="inst-battery-label" class="text-sk-text"></strong> em:
					</p>
					<input type="hidden" id="inst-battery-id" />
					<div class="mb-4">
						<select id="inst-asset" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue">
							<option value="">Selecione um ativo...</option>
						</select>
					</div>
					<div class="flex gap-2">
						<button type="button" onclick="confirmInstall()" class="btn-touch flex-1 py-2 bg-sk-orange text-white rounded-sk font-display font-medium btn-bounce active:bg-sk-orange-dark">Instalar</button>
						<button type="button" onclick="closeInstallModal()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-body font-medium active:bg-gray-300">Cancelar</button>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
};
