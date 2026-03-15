import type { FC } from "hono/jsx";

export const BatterySwapModal: FC = () => (
	<div
		id="battery-swap-modal"
		class="hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 overlay-fade"
		onclick="if(event.target===this)closeBatterySwap()"
	>
		<div class="w-full max-w-md bg-sk-surface rounded-t-sk-xl sm:rounded-sk-xl p-5 pb-8 shadow-sk-xl modal-slide-up">
			<div class="flex items-center gap-2 mb-1">
				<span class="text-xl">🔋</span>
				<h2 id="swap-modal-title" class="text-lg font-display font-bold text-sk-text">Gerenciar Bateria</h2>
			</div>
			<p id="swap-asset-name" class="text-sm font-body text-sk-muted mb-4"></p>

			{/* Current battery section */}
			<div id="swap-current-section" class="hidden mb-4">
				<div class="text-xs font-body text-sk-muted uppercase tracking-wide mb-1">Bateria instalada</div>
				<div id="swap-current-battery" class="rounded-sk p-3 border-2">
					<div class="flex items-center justify-between mb-1">
						<span id="swap-current-label" class="font-display font-bold text-sk-text"></span>
						<span id="swap-current-pct" class="text-sm font-display font-bold"></span>
					</div>
					<div class="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-1">
						<div id="swap-current-bar" class="h-full rounded-full transition-all bg-sk-green" style="width:0%"></div>
					</div>
					<div id="swap-current-level" class="text-xs font-body text-sk-muted"></div>
				</div>
				<button
					id="swap-remove-btn"
					onclick="removeBattery()"
					class="btn-touch w-full mt-2 py-2 border border-sk-danger text-sk-danger rounded-sk font-body font-medium text-sm active:bg-sk-danger-light"
				>
					Remover bateria do ativo
				</button>
			</div>

			{/* No battery section */}
			<div id="swap-no-current" class="hidden mb-4">
				<div class="bg-gray-100 rounded-sk p-4 text-center">
					<div class="text-2xl mb-1">🔌</div>
					<div class="text-sm font-body text-sk-muted">Nenhuma bateria instalada</div>
				</div>
			</div>

			{/* Available batteries section */}
			<div class="mb-4">
				<div class="text-xs font-body text-sk-muted uppercase tracking-wide mb-2" id="swap-list-title">Baterias disponiveis</div>
				<div id="swap-battery-list" class="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
				</div>
				<div id="swap-no-batteries" class="hidden text-center py-4 text-sk-muted font-body text-sm">
					Nenhuma bateria carregada disponivel
				</div>
				<div id="swap-loading" class="text-center py-4 text-sk-muted font-body text-sm">
					<div class="inline-block w-5 h-5 border-2 border-sk-orange border-t-transparent rounded-full animate-spin"></div>
					<span class="ml-2">Carregando...</span>
				</div>
			</div>

			<button
				onclick="closeBatterySwap()"
				class="btn-touch w-full py-2.5 bg-gray-200 rounded-sk font-body font-medium text-sk-muted active:bg-gray-300"
			>
				Fechar
			</button>
		</div>
	</div>
);
