import type { FC } from "hono/jsx";

export const IdentificationForm: FC = () => (
	<div
		id="identification-modal"
		class="hidden fixed inset-0 z-50 flex items-end justify-center bg-black/30 overlay-fade"
	>
		<div class="w-full max-w-lg bg-sk-surface rounded-t-sk-xl p-6 pb-8 shadow-sk-xl max-h-[90vh] overflow-y-auto modal-slide-up">
			<h2 class="text-xl font-display font-bold text-sk-text mb-1">📋 Identificacao</h2>
			<p class="text-sm text-sk-muted font-body mb-4">Dados do responsavel e da crianca</p>

			{/* ====== GUARDIAN SECTION ====== */}
			<div class="mb-4">
				<label class="block text-sm font-display font-semibold text-sk-text mb-1">Responsavel</label>
				<input
					id="id-phone"
					type="tel"
					placeholder="(00) 00000-0000"
					maxlength={15}
					class="w-full border-2 border-sk-border rounded-sk px-4 py-3 text-lg font-body focus:border-sk-blue focus:outline-none focus:ring-2 focus:ring-sk-blue/20 mb-2"
					oninput="onPhoneInput(this)"
					autocomplete="off"
				/>
				<div id="id-phone-loading" class="hidden text-xs text-sk-blue font-body mb-2">Buscando...</div>
				<div id="id-phone-match" class="hidden text-xs text-sk-green-dark font-body font-semibold mb-2">Cliente encontrado!</div>
				<input
					id="id-guardian-name"
					type="text"
					placeholder="Nome do responsavel"
					class="w-full border-2 border-sk-border rounded-sk px-4 py-3 text-lg font-body focus:border-sk-blue focus:outline-none focus:ring-2 focus:ring-sk-blue/20"
					autocomplete="off"
				/>
			</div>

			{/* ====== KNOWN CHILDREN LIST (returning customer) ====== */}
			<div id="id-known-children" class="hidden mb-4">
				<label class="block text-sm font-display font-semibold text-sk-text mb-2">Criancas cadastradas</label>
				<div id="id-children-list" class="space-y-2"></div>
				<button
					onclick="showNewChildFields()"
					class="mt-2 text-sm text-sk-blue-dark font-body hover:underline"
				>
					+ Cadastrar nova crianca
				</button>
			</div>

			{/* ====== NEW CHILD FIELDS ====== */}
			<div id="id-new-child" class="mb-4">
				<label class="block text-sm font-display font-semibold text-sk-text mb-1">Crianca</label>
				<input
					id="id-child-name"
					type="text"
					placeholder="Nome completo da crianca"
					class="w-full border-2 border-sk-border rounded-sk px-4 py-3 text-lg font-body focus:border-sk-blue focus:outline-none focus:ring-2 focus:ring-sk-blue/20 mb-2"
					autocomplete="off"
				/>
				<div class="flex gap-2">
					<input
						id="id-child-age"
						type="number"
						placeholder="Idade"
						min={1}
						max={17}
						class="w-24 border-2 border-sk-border rounded-sk px-4 py-3 text-lg font-body focus:border-sk-blue focus:outline-none focus:ring-2 focus:ring-sk-blue/20"
					/>
					<input
						id="id-child-birthdate"
						type="tel"
						placeholder="Nasc. DD/MM/AAAA"
						maxlength={10}
						class="flex-1 border-2 border-sk-border rounded-sk px-4 py-3 text-lg font-body focus:border-sk-blue focus:outline-none focus:ring-2 focus:ring-sk-blue/20"
						oninput="onBirthdateInput(this)"
						autocomplete="off"
					/>
				</div>
				<p class="text-xs text-sk-muted font-body mt-1">Idade obrigatoria. Data de nascimento opcional.</p>
			</div>

			{/* ====== ACTION BUTTONS ====== */}
			<button
				id="id-start-btn"
				onclick="confirmIdentificationAndStart()"
				class="btn-touch btn-bounce w-full py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg active:bg-sk-green-dark shadow-sk-sm"
			>
				INICIAR
			</button>
			<button
				onclick="closeIdentificationModal()"
				class="btn-touch w-full mt-2 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted active:bg-gray-300"
			>
				CANCELAR
			</button>
		</div>
	</div>
);
