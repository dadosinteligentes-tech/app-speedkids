import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Tenant } from "../../db/schema";

interface SetupWizardProps {
	tenant: Tenant;
	domain: string;
}

export const SetupWizard: FC<SetupWizardProps> = ({ tenant, domain }) => {
	const script = html`<script>
${raw(`
var currentStep = 1;
var totalSteps = 3;

function showStep(n) {
	for (var i = 1; i <= totalSteps; i++) {
		var el = document.getElementById('step-' + i);
		if (el) el.classList.toggle('hidden', i !== n);
	}
	currentStep = n;
	// Update progress
	for (var i = 1; i <= totalSteps; i++) {
		var dot = document.getElementById('dot-' + i);
		if (dot) {
			dot.className = i <= n
				? 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-blue-600 text-white'
				: 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500';
		}
		var bar = document.getElementById('bar-' + i);
		if (bar) bar.className = i < n ? 'flex-1 h-1 bg-blue-600' : 'flex-1 h-1 bg-gray-200';
	}
}

function saveBusinessInfo() {
	var data = {
		name: document.getElementById('biz-name').value.trim(),
		cnpj: document.getElementById('biz-cnpj').value.trim() || null,
		address: document.getElementById('biz-address').value.trim() || null,
		phone: document.getElementById('biz-phone').value.trim() || null,
	};
	if (!data.name) { alert('Nome e obrigatorio'); return; }

	fetch('/api/business-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	}).then(function(r) {
		if (r.ok) showStep(2);
		else alert('Erro ao salvar');
	});
}

function saveBranding() {
	var color = document.getElementById('brand-color').value;
	fetch('/api/business-config/branding', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ primary_color: color })
	}).then(function(r) {
		if (r.ok) showStep(3);
		else alert('Erro ao salvar cor');
	});
}

function uploadLogo() {
	var input = document.getElementById('logo-input');
	if (!input.files || !input.files[0]) {
		showStep(3);
		return;
	}
	var form = new FormData();
	form.append('logo', input.files[0]);
	fetch('/api/business-config/logo', { method: 'POST', body: form })
		.then(function(r) {
			if (r.ok) showStep(3);
			else alert('Erro no upload');
		});
}

function addAsset() {
	var name = document.getElementById('asset-name').value.trim();
	var type = document.getElementById('asset-type').value;
	if (!name) return;

	fetch('/api/assets', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: name, asset_type: type })
	}).then(function(r) { return r.json(); })
	.then(function(asset) {
		if (asset.id) {
			var list = document.getElementById('asset-list');
			var item = document.createElement('div');
			item.className = 'flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-sm text-green-700';
			item.textContent = '✓ ' + name + ' (' + type + ')';
			list.appendChild(item);
			document.getElementById('asset-name').value = '';
			document.getElementById('asset-name').focus();
		} else {
			alert(asset.error || 'Erro');
		}
	});
}

function completeSetup() {
	fetch('/api/setup/complete', { method: 'POST' })
		.then(function() { window.location.href = '/'; });
}
`)}
</script>`;

	return (
		<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Configuracao Inicial — {tenant.name}</title>
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
				<script src="https://cdn.tailwindcss.com"></script>
				<style>{`body { font-family: 'Inter', sans-serif; }`}</style>
			</head>
			<body class="bg-gray-50 min-h-screen">
				<div class="max-w-xl mx-auto px-4 py-10">
					<div class="text-center mb-8">
						<h1 class="text-2xl font-bold text-gray-900 mb-1">Configure seu sistema</h1>
						<p class="text-gray-500 text-sm">{tenant.slug}.{domain}</p>
					</div>

					{/* Progress bar */}
					<div class="flex items-center gap-0 mb-8 px-4">
						<div id="dot-1" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-blue-600 text-white">1</div>
						<div id="bar-1" class="flex-1 h-1 bg-gray-200"></div>
						<div id="dot-2" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500">2</div>
						<div id="bar-2" class="flex-1 h-1 bg-gray-200"></div>
						<div id="dot-3" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500">3</div>
					</div>

					{/* Step 1: Business Info */}
					<div id="step-1" class="bg-white rounded-2xl shadow-sm border p-6">
						<h2 class="text-lg font-bold mb-1">Dados do estabelecimento</h2>
						<p class="text-gray-500 text-sm mb-4">Essas informacoes aparecem nos recibos e relatorios</p>

						<div class="space-y-3">
							<div>
								<label class="block text-sm font-medium mb-1">Nome do estabelecimento *</label>
								<input id="biz-name" type="text" value={tenant.name} class="w-full px-3 py-2 border rounded-lg text-sm" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">CNPJ</label>
								<input id="biz-cnpj" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="00.000.000/0000-00" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Endereco</label>
								<input id="biz-address" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Telefone</label>
								<input id="biz-phone" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="(00) 00000-0000" />
							</div>
						</div>

						<button onclick="saveBusinessInfo()" class="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
							Proximo
						</button>
					</div>

					{/* Step 2: Branding */}
					<div id="step-2" class="hidden bg-white rounded-2xl shadow-sm border p-6">
						<h2 class="text-lg font-bold mb-1">Identidade visual</h2>
						<p class="text-gray-500 text-sm mb-4">Personalize a aparencia do seu sistema</p>

						<div class="space-y-4">
							<div>
								<label class="block text-sm font-medium mb-2">Cor principal</label>
								<div class="flex items-center gap-3">
									<input id="brand-color" type="color" value={tenant.primary_color || "#FF7043"} class="w-12 h-12 rounded-lg cursor-pointer border-0" />
									<span class="text-sm text-gray-500">Clique para escolher</span>
								</div>
							</div>
							<div>
								<label class="block text-sm font-medium mb-2">Logo (opcional)</label>
								<input id="logo-input" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm" />
							</div>
						</div>

						<div class="flex gap-2 mt-4">
							<button onclick="showStep(1)" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Voltar</button>
							<button onclick="saveBranding(); uploadLogo();" class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Proximo</button>
						</div>
					</div>

					{/* Step 3: Assets */}
					<div id="step-3" class="hidden bg-white rounded-2xl shadow-sm border p-6">
						<h2 class="text-lg font-bold mb-1">Cadastre seus ativos</h2>
						<p class="text-gray-500 text-sm mb-4">Adicione os karts, bicicletas ou brinquedos que voce aluga</p>

						<div class="flex gap-2 mb-3">
							<input id="asset-name" type="text" placeholder="Ex: Kart 01" class="flex-1 px-3 py-2 border rounded-lg text-sm" />
							<select id="asset-type" class="px-3 py-2 border rounded-lg text-sm">
								<option value="kart">Kart</option>
								<option value="bicicleta">Bicicleta</option>
								<option value="patinete">Patinete</option>
							</select>
							<button onclick="addAsset()" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">+</button>
						</div>

						<div id="asset-list" class="space-y-2 mb-4 max-h-48 overflow-y-auto"></div>

						<p class="text-xs text-gray-500 mb-4">Voce pode adicionar mais ativos depois em Admin → Ativos</p>

						<div class="flex gap-2">
							<button onclick="showStep(2)" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Voltar</button>
							<button onclick="completeSetup()" class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
								Concluir e comecar
							</button>
						</div>
					</div>
				</div>

				{script}
			</body>
		</html>
	);
};
