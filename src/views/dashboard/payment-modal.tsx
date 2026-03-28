import type { FC } from "hono/jsx";
import { DenominationInput } from "../components/denomination-input";
import { ChangeDisplay } from "../components/change-display";

export const PaymentModal: FC = () => (
	<div
		id="payment-modal"
		class="hidden fixed inset-0 z-50 flex items-end justify-center bg-black/30 overlay-fade"
	>
		<div class="w-full max-w-lg bg-sk-surface rounded-t-sk-xl p-6 pb-8 shadow-sk-xl max-h-[90vh] overflow-y-auto modal-slide-up">
			{/* ====== TELA 0: CONFIRMAÇÃO ENCERRAMENTO ====== */}
			<div id="payment-confirm-stop" class="hidden">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-display font-bold text-sk-text">
						Encerrar Locacao?
					</h2>
					<button
						onclick="cancelStopRental()"
						class="w-8 h-8 flex items-center justify-center rounded-full text-sk-muted hover:bg-gray-100 text-lg"
						title="Cancelar"
					>
						&times;
					</button>
				</div>

				<div
					id="confirm-stop-summary"
					class="bg-sk-yellow-light/50 rounded-sk p-4 mb-4 text-sm font-body space-y-1"
				>
					<div id="confirm-child" class="font-display font-semibold text-sk-text"></div>
					<div id="confirm-guardian" class="text-sk-muted"></div>
					<div id="confirm-asset" class="text-sk-muted"></div>
					<div id="confirm-time" class="text-sk-muted"></div>
				</div>

				<p class="text-sm font-body text-sk-muted mb-4">
					A locacao sera encerrada e voce podera registrar o pagamento em seguida.
				</p>

				<div class="flex gap-3">
					<button
						id="confirm-stop-btn"
						onclick="confirmStopRental()"
						class="btn-touch btn-bounce flex-1 py-3 bg-sk-danger text-white rounded-sk font-display font-bold text-lg active:bg-red-700 shadow-sk-sm"
					>
						ENCERRAR
					</button>
					<button
						onclick="cancelStopRental()"
						class="btn-touch flex-1 py-3 bg-gray-200 rounded-sk font-display font-bold text-lg text-sk-muted active:bg-gray-300"
					>
						VOLTAR
					</button>
				</div>
			</div>

			{/* ====== TELA 1: PAGAMENTO (principal) ====== */}
			<div id="payment-main">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-xl font-display font-bold text-sk-text">
						Encerrar Locacao
					</h2>
					<button
						onclick="dismissPayment()"
						class="w-8 h-8 flex items-center justify-center rounded-full text-sk-muted hover:bg-gray-100 text-lg"
						title="Fechar"
					>
						&times;
					</button>
				</div>

				{/* Resumo da locação */}
				<div
					id="payment-summary"
					class="bg-sk-yellow-light/50 rounded-sk p-3 mb-3 text-sm font-body space-y-1"
				>
					<div id="pay-child" class="font-display font-semibold text-sk-text"></div>
					<div id="pay-guardian" class="text-sk-muted"></div>
					<div id="pay-asset" class="text-sk-muted"></div>
					<div id="pay-time" class="text-sk-muted"></div>
				</div>

				{/* Aviso caixa fechado */}
				<div
					id="payment-no-register"
					class="hidden mb-3 p-3 bg-sk-danger-light border border-sk-danger/30 rounded-sk text-sm font-body text-sk-danger"
				>
					Nenhum caixa aberto! O pagamento nao sera registrado no caixa.
				</div>

				{/* Desconto / Promoção */}
				<div class="mb-3">
					<div class="flex items-center gap-2">
						<button
							onclick="toggleDiscount()"
							class="text-xs font-body text-sk-blue-dark hover:underline"
						>
							Aplicar desconto
						</button>
						<button
							id="discount-remove-btn"
							onclick="removeDiscount()"
							class="hidden text-xs font-body text-sk-danger hover:underline"
						>
							Remover desconto
						</button>
					</div>
					<div id="discount-fields" class="hidden mt-2 space-y-2">
						<select
							id="discount-promo"
							onchange="selectPromotion(this.value)"
							class="w-full px-3 py-1.5 border border-sk-border rounded-sk text-sm font-body focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20"
						>
							<option value="">Desconto manual</option>
						</select>
						<div id="discount-manual" class="flex gap-2 items-end">
							<select
								id="discount-type"
								class="px-2 py-1.5 border border-sk-border rounded-sk text-sm font-body"
							>
								<option value="pct">%</option>
								<option value="fixed">R$</option>
							</select>
							<input
								id="discount-value"
								type="number"
								min="0"
								step="0.01"
								placeholder="Valor"
								class="w-24 px-3 py-1.5 border border-sk-border rounded-sk text-sm font-body focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20"
							/>
							<button
								onclick="applyDiscount()"
								class="px-3 py-1.5 bg-sk-blue text-white rounded-sk text-sm font-body btn-bounce active:bg-sk-blue-dark"
							>
								Aplicar
							</button>
						</div>
					</div>
				</div>

				{/* Breakdown excedente */}
				<div id="payment-overtime-breakdown" class="hidden mb-3 bg-sk-danger-light/50 rounded-sk p-3 text-sm font-body space-y-1">
					<div class="flex justify-between">
						<span class="text-sk-muted">Pacote</span>
						<span id="pay-base-amount" class="font-medium text-sk-text">R$ 0,00</span>
					</div>
					<div class="flex justify-between text-sk-danger">
						<span>Excedente (<span id="pay-ot-minutes">0</span>min)</span>
						<span id="pay-ot-amount" class="font-medium">R$ 0,00</span>
					</div>
				</div>

				{/* Valor */}
				<div class="text-center my-4">
					<div class="text-sm text-sk-muted font-body">Valor a cobrar</div>
					<div
						id="payment-original"
						class="hidden text-lg text-sk-muted font-body line-through"
					>
						R$ 0,00
					</div>
					<div
						id="payment-amount"
						class="text-4xl font-display font-bold text-sk-text mt-1"
					>
						R$ 0,00
					</div>
				</div>

				{/* Botões de pagamento */}
				<p class="text-sm font-display font-medium text-sk-muted mb-3">
					Forma de pagamento:
				</p>
				<div id="payment-buttons" class="grid grid-cols-2 gap-3">
					<button
						onclick="selectPayment('cash')"
						class="btn-touch btn-bounce p-4 bg-sk-green-light border-2 border-sk-green/30 rounded-sk font-display font-bold text-sk-green-dark active:bg-sk-green/20 disabled:opacity-50"
					>
						DINHEIRO
					</button>
					<button
						onclick="selectPayment('pix')"
						class="btn-touch btn-bounce p-4 bg-sk-purple-light border-2 border-sk-purple/30 rounded-sk font-display font-bold text-sk-purple active:bg-purple-100 disabled:opacity-50"
					>
						PIX
					</button>
					<button
						onclick="selectPayment('debit')"
						class="btn-touch btn-bounce p-4 bg-sk-blue-light border-2 border-sk-blue/30 rounded-sk font-display font-bold text-sk-blue-dark active:bg-sk-blue/20 disabled:opacity-50"
					>
						DEBITO
					</button>
					<button
						onclick="selectPayment('credit')"
						class="btn-touch btn-bounce p-4 bg-sk-yellow-light border-2 border-sk-yellow/30 rounded-sk font-display font-bold text-sk-yellow-dark active:bg-sk-yellow/20 disabled:opacity-50"
					>
						CREDITO
					</button>
					<button
						onclick="openSplitPayment()"
						class="btn-touch btn-bounce p-4 bg-gray-100 border-2 border-gray-300/60 rounded-sk font-display font-bold text-sk-text active:bg-gray-200 disabled:opacity-50 col-span-2"
					>
						PAGAMENTO MISTO
					</button>
				</div>

				{/* Fechar sem cobrar */}
				<button
					onclick="showWaiveConfirm()"
					class="btn-touch w-full mt-4 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted active:bg-gray-300"
				>
					FECHAR SEM COBRAR
				</button>

				{/* Pagar depois */}
				<button
					onclick="confirmDismissPayment()"
					class="w-full mt-2 py-2 text-sm font-body text-sk-muted hover:underline"
				>
					Pagar depois
				</button>
			</div>

			{/* ====== TELA 1.3: PAGAMENTO MISTO ====== */}
			<div id="payment-split" class="hidden">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-xl font-display font-bold text-sk-text">
						Pagamento Misto
					</h2>
					<button
						onclick="cancelSplitPayment()"
						class="w-8 h-8 flex items-center justify-center rounded-full text-sk-muted hover:bg-gray-100 text-lg"
						title="Voltar"
					>
						&larr;
					</button>
				</div>

				{/* Total */}
				<div class="bg-sk-blue-light rounded-sk p-3 text-center mb-4">
					<p class="text-xs text-sk-muted font-body">Total a cobrar</p>
					<p id="split-total-amount" class="text-2xl font-display font-bold text-sk-blue-dark">R$ 0,00</p>
				</div>

				{/* Payment rows container */}
				<div id="split-rows" class="space-y-3 mb-3"></div>

				{/* Add row button */}
				<button
					id="split-add-btn"
					onclick="addSplitRow()"
					class="w-full py-2 text-sm font-body text-sk-blue-dark hover:underline mb-3"
				>
					+ Adicionar forma de pagamento
				</button>

				{/* Remaining balance */}
				<div id="split-remaining-box" class="rounded-sk p-3 text-center mb-4 bg-sk-danger-light">
					<p class="text-xs text-sk-muted font-body">Restante</p>
					<p id="split-remaining" class="text-xl font-display font-bold text-sk-danger">R$ 0,00</p>
				</div>

				{/* Confirm */}
				<button
					id="split-confirm-btn"
					onclick="confirmSplitPayment()"
					disabled
					class="btn-touch btn-bounce w-full py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg active:bg-sk-green-dark shadow-sk-sm disabled:opacity-50 disabled:cursor-not-allowed"
				>
					CONFIRMAR PAGAMENTO
				</button>
				<button
					onclick="cancelSplitPayment()"
					class="btn-touch w-full mt-2 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted active:bg-gray-300"
				>
					VOLTAR
				</button>
			</div>

			{/* ====== TELA 1.5: DINHEIRO - CEDULAS ====== */}
			<div id="payment-cash" class="hidden">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-xl font-display font-bold text-sk-text">
						Pagamento em Dinheiro
					</h2>
					<button
						onclick="cancelCashPayment()"
						class="w-8 h-8 flex items-center justify-center rounded-full text-sk-muted hover:bg-gray-100 text-lg"
						title="Voltar"
					>
						&larr;
					</button>
				</div>

				{/* Amount due */}
				<div class="bg-sk-blue-light rounded-sk p-3 text-center mb-3">
					<p class="text-xs text-sk-muted font-body">Valor a cobrar</p>
					<p id="cash-amount-due" class="text-2xl font-display font-bold text-sk-blue-dark">R$ 0,00</p>
				</div>

				{/* Denomination input */}
				<p class="text-xs font-display font-medium text-sk-muted mb-2">Cedulas recebidas do cliente:</p>
				<DenominationInput prefix="pay" showTotal={true} totalLabel="Total recebido" />

				{/* Change display */}
				<ChangeDisplay prefix="pay" />

				{/* Confirm button */}
				<button
					id="cash-confirm-btn"
					onclick="confirmCashPayment()"
					disabled
					class="btn-touch btn-bounce w-full mt-3 py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg active:bg-sk-green-dark shadow-sk-sm disabled:opacity-50 disabled:cursor-not-allowed"
				>
					CONFIRMAR PAGAMENTO
				</button>
				<button
					onclick="cancelCashPayment()"
					class="btn-touch w-full mt-2 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted active:bg-gray-300"
				>
					VOLTAR
				</button>
			</div>

			{/* ====== TELA 2: CONFIRMAÇÃO CORTESIA ====== */}
			<div id="payment-waive" class="hidden">
				<h2 class="text-xl font-display font-bold text-sk-danger mb-3">
					Fechar sem cobrar
				</h2>
				<div class="bg-sk-danger-light rounded-sk p-3 mb-4 text-sm font-body text-sk-danger">
					Valor que sera perdido:{" "}
					<span id="waive-amount" class="font-bold">R$ 0,00</span>
				</div>
				<div class="mb-4">
					<label class="block text-sm font-display font-medium text-sk-text mb-1">
						Motivo *
					</label>
					<textarea
						id="waive-reason"
						rows={3}
						placeholder="Informe o motivo da cortesia..."
						class="w-full border-2 border-sk-border rounded-sk px-4 py-3 text-sm font-body focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20 resize-none"
					></textarea>
				</div>
				<div class="flex gap-3">
					<button
						onclick="confirmWaive()"
						class="btn-touch btn-bounce flex-1 py-3 bg-sk-danger text-white rounded-sk font-display font-bold active:bg-red-700"
					>
						CONFIRMAR CORTESIA
					</button>
					<button
						onclick="cancelWaive()"
						class="btn-touch flex-1 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted active:bg-gray-300"
					>
						VOLTAR
					</button>
				</div>
			</div>

			{/* ====== TELA 3: SUCESSO ====== */}
			<div id="payment-success" class="hidden text-center py-6">
				<div class="text-5xl mb-4">&#x2705;</div>
				<h2 class="text-xl font-display font-bold text-sk-green-dark mb-2">
					Pagamento registrado!
				</h2>
				<div class="mb-1">
					<span
						id="success-amount"
						class="text-2xl font-display font-bold text-sk-text"
					>
						R$ 0,00
					</span>
					<span class="text-sm text-sk-muted font-body ml-1">
						via <span id="success-method">—</span>
					</span>
				</div>
				<div
					id="success-detail"
					class="text-sm text-sk-muted font-body mb-2"
				></div>

				{/* Split payment breakdown */}
				<div id="success-split-breakdown" class="hidden mb-4 text-sm font-body text-left max-w-xs mx-auto space-y-1"></div>

				{/* Troco — visível apenas em pagamento dinheiro */}
				<div id="success-change" class="hidden mb-4">
					<div class="bg-sk-yellow-light rounded-sk p-3 text-center mb-2">
						<p class="text-xs text-sk-muted font-body">Troco a devolver</p>
						<p id="success-change-amount" class="text-3xl font-display font-bold text-sk-yellow-dark">R$ 0,00</p>
					</div>
					<div id="success-change-breakdown" class="space-y-1 text-sm font-body"></div>
					<div id="success-change-impossible" class="hidden bg-sk-danger-light rounded-sk p-3 text-center text-sm font-body text-sk-danger mt-2">
						Troco exato indisponivel! Verifique manualmente.
					</div>
				</div>

				{/* Document templates */}
				<div id="payment-documents" class="hidden mb-4 text-left max-w-sm mx-auto">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-2 text-center">Documentos</p>
					<div id="payment-documents-list" class="space-y-1"></div>
				</div>

				<div class="flex gap-2 justify-center">
					<button
						id="payment-ok-btn"
						onclick="dismissPayment()"
						class="btn-touch btn-bounce px-8 py-3 bg-sk-green text-white rounded-sk font-display font-bold text-lg active:bg-sk-green-dark shadow-sk-sm"
					>
						OK
					</button>
					<button
						id="print-receipt-btn"
						onclick="printReceipt()"
						class="btn-touch btn-bounce px-6 py-3 bg-sk-blue text-white rounded-sk font-display font-bold text-sm active:bg-sk-blue-dark shadow-sk-sm hidden"
					>
						Imprimir Cupom
					</button>
				</div>
			</div>
		</div>
	</div>
);
