import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Shift } from "../../db/schema";
import type { CashRegisterView } from "../../db/queries/cash-registers";
import type { CashStatusBadge } from "../../lib/cash-status";
import { Layout } from "../layout";

interface ClockInOutProps {
	shift: Shift | null;
	register: CashRegisterView | null;
	user: { name: string; role: string } | null;
	cashStatus?: CashStatusBadge | null;
}

function formatDateTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const ClockInOut: FC<ClockInOutProps> = ({ shift, register, user, cashStatus }) => {
	const script = html`<script>
${raw(`
function setShiftName(name) {
	document.getElementById('shift-name').value = name;
}

function clockIn() {
	var btn = document.getElementById('clock-btn');
	btn.disabled = true;
	var shiftName = document.getElementById('shift-name').value.trim() || null;
	fetch('/api/shifts/start', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: shiftName })
	})
		.then(function(r) {
			if (r.ok) location.reload();
			else r.json().then(function(d) { alert(d.error || 'Erro'); btn.disabled = false; });
		});
}

function clockOut(shiftId) {
	if (!confirm('Deseja encerrar o turno?')) return;
	var notes = document.getElementById('shift-notes')?.value || '';
	fetch('/api/shifts/' + shiftId + '/end', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ notes: notes })
	}).then(function(r) {
		if (r.ok) {
			showShiftEndScreen(shiftId);
		} else {
			r.json().then(function(d) { alert(d.error || 'Erro'); });
		}
	});
}

function showShiftEndScreen(shiftId) {
	var container = document.querySelector('.max-w-md');
	if (!container) { location.reload(); return; }
	container.innerHTML =
		'<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-8 text-center">'
		+ '<div class="text-5xl mb-4">&#9989;</div>'
		+ '<p class="text-lg font-display font-bold text-sk-green-dark mb-2">Turno Encerrado</p>'
		+ '<p class="text-sm text-sk-muted font-body mb-6">O turno foi encerrado com sucesso.</p>'
		+ '<div class="space-y-3">'
		+ '<button onclick="window.open(\'/receipts/shift/' + shiftId + '\',\'_blank\')" class="btn-touch w-full py-4 bg-sk-blue text-white rounded-sk font-display font-bold text-lg btn-bounce active:bg-sk-blue-dark shadow-sk-sm">IMPRIMIR CUPOM DO TURNO</button>'
		+ '<a href="/shift" class="btn-touch block w-full py-3 bg-sk-surface border border-sk-border text-sk-text rounded-sk font-display font-medium text-sm">Voltar</a>'
		+ '</div>'
		+ '</div>';
}
`)}
</script>`;

	return (
		<Layout title="SpeedKids - Turno" user={user} bodyScripts={script} cashStatus={cashStatus}>
			<div class="mb-4">
				<a href="/" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Dashboard</a>
			</div>

			<div class="max-w-md mx-auto">
				<h2 class="text-xl font-display font-bold text-sk-text mb-2 text-center">Controle de Turno</h2>
				<p class="text-sm text-sk-muted font-body text-center mb-6">
					O turno registra seu período de trabalho. Inicie ao chegar e encerre ao sair.
				</p>

				{/* Workflow steps */}
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-6">
					<p class="text-xs font-display font-semibold text-sk-muted mb-3 uppercase tracking-wider">Fluxo de trabalho</p>
					<div class="flex items-start gap-3">
						<div class="flex flex-col items-center gap-1">
							<div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${shift ? "bg-sk-green text-white" : "bg-sk-orange text-white"}`}>1</div>
							<div class="w-0.5 h-4 bg-sk-border"></div>
						</div>
						<div class="flex-1 pb-3">
							<p class={`text-sm font-body font-medium ${shift ? "text-sk-green-dark" : "text-sk-text"}`}>
								Iniciar turno {shift && "✓"}
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex flex-col items-center gap-1">
							<div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${register ? "bg-sk-green text-white" : shift ? "bg-sk-orange text-white" : "bg-gray-200 text-sk-muted"}`}>2</div>
							<div class="w-0.5 h-4 bg-sk-border"></div>
						</div>
						<div class="flex-1 pb-3">
							<p class={`text-sm font-body font-medium ${register ? "text-sk-green-dark" : "text-sk-text"}`}>
								Abrir caixa {register && "✓"}
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex flex-col items-center gap-1">
							<div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${shift && register ? "bg-sk-blue text-white" : "bg-gray-200 text-sk-muted"}`}>3</div>
							<div class="w-0.5 h-4 bg-sk-border"></div>
						</div>
						<div class="flex-1 pb-3">
							<p class="text-sm font-body font-medium text-sk-text">Operar normalmente</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex flex-col items-center gap-1">
							<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-sk-muted">4</div>
							<div class="w-0.5 h-4 bg-sk-border"></div>
						</div>
						<div class="flex-1 pb-3">
							<p class="text-sm font-body font-medium text-sk-text">Fechar caixa</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex flex-col items-center">
							<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-sk-muted">5</div>
						</div>
						<div class="flex-1">
							<p class="text-sm font-body font-medium text-sk-text">Encerrar turno</p>
						</div>
					</div>
				</div>

				{!shift ? (
					<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-8 text-center">
						<div class="text-5xl mb-4">🕐</div>
						<p class="text-sk-muted font-body mb-2">Nenhum turno ativo</p>
						<p class="text-xs text-sk-muted font-body mb-6">Inicie seu turno para comecar a trabalhar.</p>
						<div class="mb-4">
							<label class="block text-sm font-medium text-sk-text font-body mb-2">Nome do turno</label>
							<div class="grid grid-cols-3 gap-2 mb-2">
								<button type="button" onclick="setShiftName('Manha')" class="py-2 bg-sk-yellow-light rounded-sk text-sm font-body text-sk-text active:bg-sk-yellow">Manha</button>
								<button type="button" onclick="setShiftName('Tarde')" class="py-2 bg-sk-orange-light rounded-sk text-sm font-body text-sk-text active:bg-sk-orange/20">Tarde</button>
								<button type="button" onclick="setShiftName('Noite')" class="py-2 bg-sk-blue-light rounded-sk text-sm font-body text-sk-text active:bg-sk-blue/20">Noite</button>
							</div>
							<input id="shift-name" type="text" placeholder="Ou digite um nome personalizado..." class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" />
						</div>
						<button
							id="clock-btn"
							onclick="clockIn()"
							class="btn-touch w-full py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg btn-bounce active:bg-sk-green-dark shadow-sk-sm"
						>
							INICIAR TURNO
						</button>
					</div>
				) : (
					<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6">
						<div class="text-center mb-6">
							<div class="text-4xl mb-2">✅</div>
							<p class="text-lg font-display font-bold text-sk-green-dark">Turno Ativo{shift.name ? ` — ${shift.name}` : ''}</p>
							<p class="text-sm text-sk-muted font-body mt-1">Iniciado em {formatDateTime(shift.started_at)}</p>
						</div>

						{/* Cash register status */}
						{register ? (
							<div class="bg-sk-green-light border border-sk-green/30 rounded-sk p-4 mb-4">
								<div class="flex items-center gap-2">
									<span class="w-2.5 h-2.5 rounded-full bg-sk-green"></span>
									<p class="text-sm font-body text-sk-green-dark font-medium">Caixa aberto</p>
								</div>
								<a href="/cash" class="inline-block mt-1 text-sm text-sk-blue-dark underline font-body">Ir para o Caixa</a>
							</div>
						) : (
							<div class="bg-sk-yellow-light border border-sk-yellow/50 rounded-sk p-4 mb-4">
								<p class="text-sm font-body text-sk-text mb-2">Caixa fechado. Abra o caixa para iniciar as operacoes.</p>
								<a
									href="/cash"
									class="btn-touch inline-block px-4 py-2 bg-sk-green text-white rounded-sk font-display font-medium text-sm btn-bounce"
								>
									Abrir Caixa
								</a>
							</div>
						)}

						{/* Warning: close register before ending shift */}
						{register && (
							<div class="bg-sk-danger-light border border-sk-danger/30 rounded-sk p-4 mb-4">
								<p class="text-sm font-body text-sk-danger font-medium mb-1">Feche o caixa antes de encerrar o turno.</p>
								<a href="/cash" class="inline-block mt-1 text-sm text-sk-blue-dark underline font-body">Ir para o Caixa</a>
							</div>
						)}

						<div class="space-y-3">
							<div>
								<label class="block text-sm font-medium text-sk-text font-body mb-1">Observações do turno</label>
								<textarea
									id="shift-notes"
									rows={3}
									class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm"
									placeholder="Observações opcionais..."
								></textarea>
							</div>
							<button
								onclick={`clockOut(${shift.id})`}
								class="btn-touch w-full py-4 bg-sk-danger text-white rounded-sk font-display font-bold text-lg btn-bounce active:bg-red-700"
							>
								ENCERRAR TURNO
							</button>
						</div>
					</div>
				)}
			</div>
		</Layout>
	);
};
