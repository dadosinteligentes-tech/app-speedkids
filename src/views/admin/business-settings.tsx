import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { BusinessConfig } from "../../db/schema";
import { AdminLayout } from "./layout";

interface BusinessSettingsProps {
	config: BusinessConfig | null;
	user: { name: string; role: string } | null;
}

export const BusinessSettings: FC<BusinessSettingsProps> = ({ config, user }) => {
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
`)}
</script>`;

	return (
		<AdminLayout title="Configuracoes" user={user} activeTab="/admin/settings" bodyScripts={script}>
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
							placeholder="Ex: SpeedKids Diversoes"
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
