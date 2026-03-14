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
function clockIn() {
	var btn = document.getElementById('clock-btn');
	btn.disabled = true;
	fetch('/api/shifts/start', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
		.then(function(r) {
			if (r.ok) location.reload();
			else r.json().then(function(d) { alert(d.error || 'Erro'); btn.disabled = false; });
		});
}

function clockOut(shiftId) {
	var notes = document.getElementById('shift-notes')?.value || '';
	fetch('/api/shifts/' + shiftId + '/end', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ notes: notes })
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}
`)}
</script>`;

	return (
		<Layout title="SpeedKids - Turno" user={user} bodyScripts={script} cashStatus={cashStatus}>
			<div class="mb-4">
				<a href="/" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Dashboard</a>
			</div>

			<div class="max-w-md mx-auto">
				<h2 class="text-xl font-display font-bold text-sk-text mb-4 text-center">Controle de Turno</h2>

				{!shift ? (
					<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-8 text-center">
						<div class="text-6xl mb-4">🕐</div>
						<p class="text-sk-muted font-body mb-6">Nenhum turno ativo</p>
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
							<p class="text-lg font-display font-bold text-sk-green-dark">Turno Ativo</p>
							<p class="text-sm text-sk-muted font-body mt-1">Iniciado em {formatDateTime(shift.started_at)}</p>
						</div>

						{/* Cash register warning */}
						{register && (
							<div class="bg-sk-danger-light border border-sk-danger/30 rounded-sk p-4 mb-4">
								<p class="text-sm font-body text-sk-danger font-medium mb-1">Caixa ainda esta aberto!</p>
								<p class="text-xs font-body text-sk-danger">Feche o caixa antes de encerrar o turno.</p>
								<a href="/cash" class="inline-block mt-2 text-sm text-sk-blue-dark underline font-body">Ir para o Caixa</a>
							</div>
						)}

						<div class="space-y-3">
							<div>
								<label class="block text-sm font-medium text-sk-text font-body mb-1">Observacoes do turno</label>
								<textarea
									id="shift-notes"
									rows={3}
									class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm"
									placeholder="Observacoes opcionais..."
								></textarea>
							</div>
							<button
								onclick={`clockOut(${shift.id})`}
								class="btn-touch w-full py-4 bg-sk-danger text-white rounded-sk font-display font-bold text-lg btn-bounce active:bg-red-700"
							>
								ENCERRAR TURNO
							</button>
						</div>

						{/* Prompt to open cash register */}
						{!register && (
							<div class="bg-sk-yellow-light border border-sk-yellow/50 rounded-sk p-4 mt-4">
								<p class="text-sm font-body text-sk-text mb-2">Turno iniciado! Deseja abrir o caixa?</p>
								<a
									href="/cash"
									class="btn-touch inline-block px-4 py-2 bg-sk-green text-white rounded-sk font-display font-medium text-sm btn-bounce"
								>
									Abrir Caixa
								</a>
							</div>
						)}
					</div>
				)}
			</div>
		</Layout>
	);
};
