import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { BusinessConfig, Tenant } from "../../db/schema";
import { AdminLayout } from "./layout";

interface BusinessSettingsProps {
	config: BusinessConfig | null;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

export const BusinessSettings: FC<BusinessSettingsProps> = ({ config, user, tenant, isPlatformAdmin }) => {
	const script = html`<script>
${raw(`
function saveConfig() {
	var btn = document.getElementById('save-btn');
	btn.disabled = true;
	btn.textContent = 'Salvando...';

	var data = {
		name: document.getElementById('cfg-name').value.trim(),
		cnpj: document.getElementById('cfg-cnpj').value.trim() || null,
		address: document.getElementById('cfg-address').value.trim() || null,
		phone: document.getElementById('cfg-phone').value.trim() || null,
		receipt_footer: document.getElementById('cfg-footer').value.trim() || null
	};

	if (!data.name) {
		alert('Nome do estabelecimento e obrigatorio');
		btn.disabled = false;
		btn.textContent = 'Salvar';
		return;
	}

	fetch('/api/business-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	})
	.then(function(r) {
		if (!r.ok) return r.json().then(function(e) { throw new Error(e.error); });
		return r.json();
	})
	.then(function() {
		btn.textContent = 'Salvo!';
		btn.classList.remove('bg-sk-orange');
		btn.classList.add('bg-sk-green');
		setTimeout(function() {
			btn.disabled = false;
			btn.textContent = 'Salvar';
			btn.classList.remove('bg-sk-green');
			btn.classList.add('bg-sk-orange');
		}, 2000);
	})
	.catch(function(err) {
		alert('Erro: ' + err.message);
		btn.disabled = false;
		btn.textContent = 'Salvar';
	});
}

function uploadLogo() {
	var input = document.getElementById('logo-input');
	if (!input.files || !input.files[0]) return;

	var file = input.files[0];
	if (file.size > 2 * 1024 * 1024) {
		alert('Arquivo muito grande. Maximo 2MB');
		return;
	}

	var btn = document.getElementById('logo-upload-btn');
	btn.disabled = true;
	btn.textContent = 'Enviando...';

	var formData = new FormData();
	formData.append('logo', file);

	fetch('/api/business-config/logo', {
		method: 'POST',
		body: formData
	})
	.then(function(r) {
		if (!r.ok) return r.json().then(function(e) { throw new Error(e.error); });
		return r.json();
	})
	.then(function() {
		window.location.reload();
	})
	.catch(function(err) {
		alert('Erro ao enviar logo: ' + err.message);
		btn.disabled = false;
		btn.textContent = 'Enviar Logo';
	});
}

function saveColor() {
	var btn = document.getElementById('color-save-btn');
	var color = document.getElementById('color-input').value;
	btn.disabled = true;
	btn.textContent = 'Salvando...';

	fetch('/api/business-config/branding', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ primary_color: color })
	})
	.then(function(r) {
		if (!r.ok) return r.json().then(function(e) { throw new Error(e.error); });
		return r.json();
	})
	.then(function() {
		btn.textContent = 'Salvo!';
		btn.classList.remove('bg-sk-orange');
		btn.classList.add('bg-sk-green');
		setTimeout(function() {
			btn.disabled = false;
			btn.textContent = 'Salvar Cor';
			btn.classList.remove('bg-sk-green');
			btn.classList.add('bg-sk-orange');
		}, 2000);
	})
	.catch(function(err) {
		alert('Erro: ' + err.message);
		btn.disabled = false;
		btn.textContent = 'Salvar Cor';
	});
}

function triggerLogoInput() {
	document.getElementById('logo-input').click();
}

function onLogoSelected() {
	var input = document.getElementById('logo-input');
	if (input.files && input.files[0]) {
		document.getElementById('logo-filename').textContent = input.files[0].name;
		document.getElementById('logo-upload-btn').style.display = 'inline-block';
	}
}
`)}
</script>`;

	return (
		<AdminLayout title="Configuracoes" user={user} activeTab="/admin/settings" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin}>
			{/* Branding Section */}
			<h2 class="text-xl font-display font-bold text-sk-text mb-4">Identidade Visual</h2>
			<p class="text-sm text-sk-muted font-body mb-6">
				Logo e cor principal do seu estabelecimento. O logo aparece na tela de login e no menu lateral.
			</p>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-6 max-w-lg mb-8">
				<div class="space-y-6">
					{/* Logo Upload */}
					<div>
						<label class="block text-sm font-medium text-sk-text mb-2 font-body">Logo</label>
						<div class="flex items-center gap-4">
							<div class="w-20 h-20 rounded-sk border border-sk-border flex items-center justify-center bg-white overflow-hidden">
								{tenant?.logo_url ? (
									<img src={tenant.logo_url} alt="Logo" class="w-full h-full object-contain" />
								) : (
									<span class="text-sk-muted text-xs font-body text-center">Sem logo</span>
								)}
							</div>
							<div class="flex flex-col gap-2">
								<input
									id="logo-input"
									type="file"
									accept="image/jpeg,image/png,image/webp"
									onchange="onLogoSelected()"
									class="hidden"
								/>
								<button
									type="button"
									onclick="triggerLogoInput()"
									class="btn-touch btn-bounce px-4 py-2 border border-sk-border rounded-sk text-sm font-body text-sk-text hover:bg-sk-bg"
								>
									Escolher Arquivo
								</button>
								<span id="logo-filename" class="text-xs text-sk-muted font-body"></span>
								<button
									id="logo-upload-btn"
									type="button"
									onclick="uploadLogo()"
									style="display: none;"
									class="btn-touch btn-bounce px-4 py-2 bg-sk-orange text-white rounded-sk text-sm font-display font-medium active:bg-sk-orange-dark"
								>
									Enviar Logo
								</button>
								<p class="text-xs text-sk-muted font-body">JPEG, PNG ou WebP. Maximo 2MB.</p>
							</div>
						</div>
					</div>

					{/* Primary Color */}
					<div>
						<label class="block text-sm font-medium text-sk-text mb-2 font-body">Cor Principal</label>
						<div class="flex items-center gap-3">
							<input
								id="color-input"
								type="color"
								value={tenant?.primary_color ?? "#FF7043"}
								class="w-12 h-10 rounded-sk border border-sk-border cursor-pointer"
							/>
							<span class="text-sm text-sk-muted font-body">{tenant?.primary_color ?? "#FF7043"}</span>
							<button
								id="color-save-btn"
								type="button"
								onclick="saveColor()"
								class="btn-touch btn-bounce px-4 py-2 bg-sk-orange text-white rounded-sk text-sm font-display font-medium active:bg-sk-orange-dark"
							>
								Salvar Cor
							</button>
						</div>
						<p class="text-xs text-sk-muted mt-1 font-body">Usada no tema do sistema, barra de navegacao e botoes.</p>
					</div>
				</div>
			</div>

			{/* Business Data Section */}
			<h2 class="text-xl font-display font-bold text-sk-text mb-4">Dados do Estabelecimento</h2>
			<p class="text-sm text-sk-muted font-body mb-6">
				Estas informacoes aparecem no cabecalho dos cupons impressos. A impressao de cupons so fica disponivel apos preencher o nome do estabelecimento.
			</p>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-6 max-w-lg">
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-sk-text mb-1 font-body">Nome do Estabelecimento *</label>
						<input
							id="cfg-name"
							type="text"
							value={config?.name ?? ""}
							placeholder="Ex: Minha Empresa"
							class="w-full border border-sk-border rounded-sk px-3 py-2 font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-sk-text mb-1 font-body">CNPJ</label>
						<input
							id="cfg-cnpj"
							type="text"
							value={config?.cnpj ?? ""}
							placeholder="00.000.000/0000-00"
							class="w-full border border-sk-border rounded-sk px-3 py-2 font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-sk-text mb-1 font-body">Endereço</label>
						<input
							id="cfg-address"
							type="text"
							value={config?.address ?? ""}
							placeholder="Rua Exemplo, 123 - Centro"
							class="w-full border border-sk-border rounded-sk px-3 py-2 font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-sk-text mb-1 font-body">Telefone</label>
						<input
							id="cfg-phone"
							type="tel"
							value={config?.phone ?? ""}
							placeholder="(00) 00000-0000"
							class="w-full border border-sk-border rounded-sk px-3 py-2 font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-sk-text mb-1 font-body">Rodapé do Cupom</label>
						<textarea
							id="cfg-footer"
							rows={2}
							placeholder="Obrigado pela preferencia!"
							class="w-full border border-sk-border rounded-sk px-3 py-2 font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue"
						>{config?.receipt_footer ?? ""}</textarea>
						<p class="text-xs text-sk-muted mt-1 font-body">Texto exibido no final de cada cupom impresso.</p>
					</div>
				</div>

				<div class="mt-6">
					<button
						id="save-btn"
						onclick="saveConfig()"
						class="btn-touch btn-bounce px-6 py-2 bg-sk-orange text-white rounded-sk font-display font-medium active:bg-sk-orange-dark"
					>
						Salvar
					</button>
				</div>
			</div>
		</AdminLayout>
	);
};
