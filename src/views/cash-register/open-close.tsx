import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Shift } from "../../db/schema";
import type { CashRegisterView, CashTransactionView, RegisterSummary } from "../../db/queries/cash-registers";
import type { CashStatusBadge } from "../../lib/cash-status";
import { Layout } from "../layout";
import { DenominationInput } from "../components/denomination-input";
import { toBrazilTime, toBrazilDate } from "../../lib/timezone";

interface CashRegisterPageProps {
	register: CashRegisterView | null;
	transactions: CashTransactionView[];
	expectedCents: number;
	summary: RegisterSummary | null;
	shift: Shift | null;
	user: { name: string; role: string } | null;
	cashStatus?: CashStatusBadge | null;
}

const TX_TYPE_LABELS: Record<string, string> = {
	rental_payment: "Pagamento locacao",
	adjustment: "Ajuste",
	withdrawal: "Sangria",
	deposit: "Suprimento",
};

function formatCurrency(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function formatTime(iso: string): string {
	return toBrazilTime(iso);
}

export const CashRegisterPage: FC<CashRegisterPageProps> = ({ register, transactions, expectedCents, summary, shift, user, cashStatus }) => {
	const script = html`<script>
${raw(`
var DENOM_VALUES = [20000,10000,5000,2000,1000,500,200,100,50,25,10,5];
var DENOM_LABELS = {20000:'R$200',10000:'R$100',5000:'R$50',2000:'R$20',1000:'R$10',500:'R$5',200:'R$2',100:'R$1',50:'R$0,50',25:'R$0,25',10:'R$0,10',5:'R$0,05'};
var DENOM_COLORS = {
	20000:{bg:'bg-gray-100',text:'text-gray-700',badge:'bg-gray-600'},
	10000:{bg:'bg-sky-100',text:'text-sky-700',badge:'bg-sky-600'},
	5000:{bg:'bg-orange-100',text:'text-orange-700',badge:'bg-orange-500'},
	2000:{bg:'bg-yellow-100',text:'text-yellow-700',badge:'bg-yellow-500'},
	1000:{bg:'bg-violet-100',text:'text-violet-700',badge:'bg-violet-500'},
	500:{bg:'bg-purple-100',text:'text-purple-700',badge:'bg-purple-500'},
	200:{bg:'bg-blue-100',text:'text-blue-700',badge:'bg-blue-500'},
	100:{bg:'bg-amber-100',text:'text-amber-700',badge:'bg-amber-600'},
	50:{bg:'bg-amber-100',text:'text-amber-700',badge:'bg-amber-600'},
	25:{bg:'bg-zinc-200',text:'text-zinc-600',badge:'bg-zinc-500'},
	10:{bg:'bg-zinc-200',text:'text-zinc-600',badge:'bg-zinc-500'},
	5:{bg:'bg-zinc-200',text:'text-zinc-600',badge:'bg-zinc-500'}
};

function fmtBRL(cents) {
	return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

function getDenomMap(prefix) {
	var map = {};
	DENOM_VALUES.forEach(function(cents) {
		var el = document.getElementById(prefix + '-d-' + cents);
		var qty = el ? parseInt(el.value, 10) || 0 : 0;
		if (qty > 0) map[cents] = qty;
	});
	return map;
}

function denomMapTotal(map) {
	var total = 0;
	for (var k in map) {
		total += Number(k) * (map[k] || 0);
	}
	return total;
}

function updateDenomBadge(prefix, cents) {
	var input = document.getElementById(prefix + '-d-' + cents);
	var badge = document.getElementById(prefix + '-badge-' + cents);
	var decBtn = document.getElementById(prefix + '-dec-' + cents);
	var val = input ? parseInt(input.value, 10) || 0 : 0;
	if (badge) {
		badge.textContent = val;
		badge.classList.toggle('hidden', val === 0);
		if (val > 0) { badge.style.animation = 'none'; badge.offsetHeight; badge.style.animation = 'badge-pop 0.2s ease-out'; }
	}
	if (decBtn) decBtn.classList.toggle('hidden', val === 0);
}

function denomIncrement(prefix, cents) {
	var input = document.getElementById(prefix + '-d-' + cents);
	if (!input) return;
	input.value = (parseInt(input.value, 10) || 0) + 1;
	updateDenomBadge(prefix, cents);
	updateDenomTotal(prefix);
}

function denomDecrement(prefix, cents) {
	var input = document.getElementById(prefix + '-d-' + cents);
	if (!input) return;
	var val = parseInt(input.value, 10) || 0;
	if (val <= 0) return;
	input.value = val - 1;
	updateDenomBadge(prefix, cents);
	updateDenomTotal(prefix);
}

function clearDenomInputs(prefix) {
	DENOM_VALUES.forEach(function(cents) {
		var el = document.getElementById(prefix + '-d-' + cents);
		if (el) el.value = '0';
		updateDenomBadge(prefix, cents);
	});
	updateDenomTotal(prefix);
}

function updateDenomTotal(prefix) {
	var map = getDenomMap(prefix);
	var total = denomMapTotal(map);
	var el = document.getElementById(prefix + '-denom-total');
	if (el) el.textContent = fmtBRL(total);
}

function openCash() {
	var btn = event.target;
	btn.disabled = true;
	var denomMap = getDenomMap('open');
	var total = denomMapTotal(denomMap);
	var hasAnyDenom = Object.keys(denomMap).length > 0;
	var payload = hasAnyDenom
		? { opening_balance_cents: total, denominations: denomMap }
		: { opening_balance_cents: total };
	fetch('/api/cash-registers/open', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); btn.disabled = false; });
	});
}

function startCloseFlow() {
	document.getElementById('close-step-1').classList.remove('hidden');
	document.getElementById('close-step-2').classList.add('hidden');
	clearDenomInputs('close');
}

function revealSummary(registerId) {
	var denomMap = getDenomMap('close');
	var declaredCents = denomMapTotal(denomMap);
	window.__SK_CLOSING_AMOUNT__ = declaredCents;
	window.__SK_CLOSING_DENOMS__ = denomMap;

	fetch('/api/cash-registers/' + registerId + '/summary')
		.then(function(r) { return r.json(); })
		.then(function(s) {
			document.getElementById('close-declared').textContent = fmtBRL(declaredCents);
			document.getElementById('close-expected').textContent = fmtBRL(s.expected_cash_cents);
			var diff = declaredCents - s.expected_cash_cents;
			document.getElementById('close-diff').textContent =
				(diff >= 0 ? '+' : '') + fmtBRL(diff);

			var diffBox = document.getElementById('close-diff-box');
			var diffText = document.getElementById('close-diff');
			var absDiff = Math.abs(diff);
			if (absDiff === 0) {
				diffBox.className = 'rounded-sk p-4 text-center mb-4 bg-sk-green-light';
				diffText.className = 'text-2xl font-display font-bold text-sk-green-dark';
			} else if (absDiff <= 500) {
				diffBox.className = 'rounded-sk p-4 text-center mb-4 bg-sk-yellow-light';
				diffText.className = 'text-2xl font-display font-bold text-sk-yellow-dark';
			} else {
				diffBox.className = 'rounded-sk p-4 text-center mb-4 bg-sk-danger-light';
				diffText.className = 'text-2xl font-display font-bold text-sk-danger';
			}

			document.getElementById('sum-opening').textContent = fmtBRL(s.opening_balance_cents);
			document.getElementById('sum-cash').textContent = fmtBRL(s.cash_payments_cents);
			document.getElementById('sum-pix').textContent = fmtBRL(s.pix_payments_cents);
			document.getElementById('sum-debit').textContent = fmtBRL(s.debit_payments_cents);
			document.getElementById('sum-credit').textContent = fmtBRL(s.credit_payments_cents);
			document.getElementById('sum-deposits').textContent = '+' + fmtBRL(s.total_deposits_cents);
			document.getElementById('sum-withdrawals').textContent = '-' + fmtBRL(s.total_withdrawals_cents);
			document.getElementById('sum-adjustments').textContent = fmtBRL(s.total_adjustments_cents);
			document.getElementById('sum-rentals').textContent = s.rental_count;
			document.getElementById('sum-courtesy').textContent = s.courtesy_count;

			// Load denomination inventory for comparison
			fetch('/api/cash-registers/' + registerId + '/denominations')
				.then(function(r) { return r.json(); })
				.then(function(inv) {
					var container = document.getElementById('close-denom-comparison');
					if (!container) return;
					var html = '';
					var labels = {20000:'R$200',10000:'R$100',5000:'R$50',2000:'R$20',1000:'R$10',500:'R$5',200:'R$2',100:'R$1',50:'R$0,50',25:'R$0,25',10:'R$0,10',5:'R$0,05'};
					DENOM_VALUES.forEach(function(cents) {
						var counted = denomMap[cents] || 0;
						var expected = inv[cents] || 0;
						if (counted === 0 && expected === 0) return;
						var diff = counted - expected;
						var diffColor = diff === 0 ? 'text-sk-green-dark' : 'text-sk-danger';
						var diffStr = diff > 0 ? '+' + diff : '' + diff;
						html += '<div class="flex justify-between text-xs font-body py-1">'
							+ '<span class="text-sk-muted">' + labels[cents] + '</span>'
							+ '<span>' + counted + ' / ' + expected + ' <span class="' + diffColor + '">(' + diffStr + ')</span></span>'
							+ '</div>';
					});
					if (html) {
						container.innerHTML = '<p class="text-xs font-display font-medium text-sk-muted mb-1 mt-3">Contado / Esperado por denominacao:</p>' + html;
					}
				});

			document.getElementById('close-step-1').classList.add('hidden');
			document.getElementById('close-step-2').classList.remove('hidden');
		});
}

function confirmClose(registerId) {
	var btn = event.target;
	btn.disabled = true;
	var payload = { closing_balance_cents: window.__SK_CLOSING_AMOUNT__ };
	if (window.__SK_CLOSING_DENOMS__ && Object.keys(window.__SK_CLOSING_DENOMS__).length > 0) {
		payload.denominations = window.__SK_CLOSING_DENOMS__;
	}
	fetch('/api/cash-registers/' + registerId + '/close', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	}).then(function(r) {
		if (!r.ok) return r.json().then(function(d) { alert(d.error || 'Erro'); btn.disabled = false; });

		var endShiftCb = document.getElementById('close-end-shift');
		if (endShiftCb && endShiftCb.checked) {
			var shiftId = endShiftCb.getAttribute('data-shift-id');
			fetch('/api/shifts/' + shiftId + '/end', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: 'Encerrado ao fechar caixa' })
			}).then(function() {
				location.href = '/cash/closed/' + registerId;
			});
		} else {
			location.href = '/cash/closed/' + registerId;
		}
	});
}

function cancelClose() {
	document.getElementById('close-step-1').classList.add('hidden');
	document.getElementById('close-step-2').classList.add('hidden');
}

function showTxForm() {
	document.getElementById('tx-form-modal').classList.remove('hidden');
	clearDenomInputs('tx');
	updateTxForm();
}
function closeTxForm() {
	document.getElementById('tx-form-modal').classList.add('hidden');
}

function updateTxForm() {
	var type = document.getElementById('tx-type').value;
	var showReason = (type === 'withdrawal' || type === 'deposit');
	var showDenom = (type !== 'adjustment');
	document.getElementById('tx-reason-group').classList.toggle('hidden', !showReason);
	document.getElementById('tx-denom-section').classList.toggle('hidden', !showDenom);
	document.getElementById('tx-amount-group').classList.toggle('hidden', showDenom);
	var descLabel = document.getElementById('tx-desc-label');
	descLabel.textContent = type === 'withdrawal' ? 'Detalhes adicionais' : 'Descricao';
	document.getElementById('tx-desc').placeholder = 'Opcional';
}

function addTx(registerId) {
	var type = document.getElementById('tx-type').value;
	var showDenom = (type !== 'adjustment');
	var denomMap = showDenom ? getDenomMap('tx') : null;
	var amount;
	if (denomMap && Object.keys(denomMap).length > 0) {
		amount = denomMapTotal(denomMap);
	} else {
		amount = parseFloat(document.getElementById('tx-amount').value || '0');
		amount = Math.round(amount * 100);
	}

	if (amount <= 0) { alert('Informe um valor'); return; }

	var reason = document.getElementById('tx-reason').value;
	var desc = document.getElementById('tx-desc').value.trim();

	var finalDesc;
	if (reason === '__custom__') {
		finalDesc = desc;
	} else if (reason) {
		finalDesc = desc ? reason + ' - ' + desc : reason;
	} else {
		finalDesc = desc;
	}

	if (type === 'withdrawal' && !finalDesc) {
		alert('Informe o motivo da sangria');
		return;
	}

	var payload = { type: type, amount_cents: amount, description: finalDesc };
	if (denomMap && Object.keys(denomMap).length > 0) {
		payload.denominations = denomMap;
	}

	fetch('/api/cash-registers/' + registerId + '/transactions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	}).then(function(r) {
		if (r.ok) location.reload();
		else r.json().then(function(d) { alert(d.error || 'Erro'); });
	});
}

// Load denomination inventory on page load
(function() {
	var invEl = document.getElementById('denom-inventory');
	if (!invEl) return;
	var registerId = invEl.getAttribute('data-register-id');
	if (!registerId) return;
	fetch('/api/cash-registers/' + registerId + '/denominations')
		.then(function(r) { return r.json(); })
		.then(function(inv) {
			var html = '';
			var hasAny = false;
			DENOM_VALUES.forEach(function(cents) {
				var qty = inv[cents] || 0;
				if (qty <= 0) return;
				hasAny = true;
				var c = DENOM_COLORS[cents];
				html += '<div class="relative ' + c.bg + ' ' + c.text + ' rounded-sk p-2 min-h-[48px] flex items-center justify-center">'
					+ '<span class="text-sm font-display font-bold">' + DENOM_LABELS[cents] + '</span>'
					+ '<span class="absolute -top-2 -right-2 w-6 h-6 rounded-full ' + c.badge + ' text-white font-bold text-xs flex items-center justify-center shadow-md">' + qty + '</span>'
					+ '</div>';
			});
			if (!hasAny) html = '<p class="text-sk-muted col-span-4 text-xs">Sem dados de denominacao</p>';
			invEl.innerHTML = html;
		});
})();
`)}
</script>`;

	return (
		<Layout title="SpeedKids - Caixa" user={user} bodyScripts={script} cashStatus={cashStatus}>
			<div class="mb-4">
				<a href="/" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Dashboard</a>
			</div>

			<div class="max-w-2xl mx-auto">
				<h2 class="text-xl font-display font-bold text-sk-text mb-4">Controle de Caixa</h2>

				{!register ? (
					<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6">
						<div class="text-5xl text-center mb-3">💰</div>
						<p class="text-sk-muted font-body mb-4 text-center text-sm">Nenhum caixa aberto. Conte as cedulas e moedas:</p>
						<DenominationInput prefix="open" showTotal={true} totalLabel="Valor de abertura" />
						<button
							onclick="openCash()"
							class="btn-touch w-full mt-4 py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg btn-bounce active:bg-sk-green-dark shadow-sk-sm"
						>
							ABRIR CAIXA
						</button>
					</div>
				) : (
					<>
						{/* Real-time panel */}
						<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-4">
							<div class="flex items-center justify-between mb-4">
								<div>
									<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sk-green-light text-sk-green-dark">Aberto</span>
									<span class="text-sm text-sk-muted font-body ml-2">por {register.opened_by_name}</span>
								</div>
								<span class="text-sm text-sk-muted font-body">{toBrazilDate(register.opened_at)}</span>
							</div>

							{/* Main balance */}
							<div class="bg-sk-green-light rounded-sk p-4 text-center mb-4">
								<p class="text-xs text-sk-muted font-body">Saldo estimado em caixa</p>
								<p class="text-3xl font-display font-bold text-sk-green-dark">{formatCurrency(expectedCents)}</p>
							</div>

							{/* Breakdown grid */}
							{summary && (
								<>
									<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
										<div class="bg-sk-yellow-light/50 rounded-sk p-2">
											<p class="text-xs text-sk-muted font-body">Abertura</p>
											<p class="font-display font-bold">{formatCurrency(summary.opening_balance_cents)}</p>
										</div>
										<div class="bg-sk-green-light rounded-sk p-2">
											<p class="text-xs text-sk-muted font-body">Dinheiro</p>
											<p class="font-display font-bold text-sk-green-dark">{formatCurrency(summary.cash_payments_cents)}</p>
										</div>
										<div class="bg-sk-purple-light rounded-sk p-2">
											<p class="text-xs text-sk-muted font-body">PIX</p>
											<p class="font-display font-bold text-sk-purple">{formatCurrency(summary.pix_payments_cents)}</p>
										</div>
										<div class="bg-sk-blue-light rounded-sk p-2">
											<p class="text-xs text-sk-muted font-body">Cartao</p>
											<p class="font-display font-bold text-sk-blue-dark">{formatCurrency(summary.debit_payments_cents + summary.credit_payments_cents)}</p>
										</div>
									</div>
									<div class="mt-3 text-center">
										<span class="text-xs text-sk-muted font-body">
											{summary.rental_count} locacoes &middot; {summary.withdrawal_count} sangrias &middot; {summary.deposit_count} suprimentos
											{summary.courtesy_count > 0 && <> &middot; {summary.courtesy_count} cortesias</>}
										</span>
									</div>
								</>
							)}
						</div>

						{/* Denomination Inventory Panel */}
						<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-4 mb-4">
							<h3 class="font-display font-bold text-sm text-sk-text mb-2">Composicao do Caixa</h3>
							<div
								id="denom-inventory"
								data-register-id={String(register.id)}
								class="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center text-xs font-body"
							>
								<p class="text-sk-muted col-span-4 text-xs">Carregando...</p>
							</div>
						</div>

						{/* Actions */}
						<div class="flex gap-2 mb-4">
							<button
								onclick="showTxForm()"
								class="btn-touch flex-1 py-3 bg-sk-blue text-white rounded-sk font-display btn-bounce font-medium active:bg-blue-700"
							>
								+ Movimento
							</button>
							<button
								onclick={`window.open('/receipts/cash/${register.id}','_blank')`}
								class="btn-touch flex-1 py-3 bg-sk-purple text-white rounded-sk font-display btn-bounce font-medium active:bg-purple-700"
							>
								Imprimir
							</button>
							<button
								onclick="startCloseFlow()"
								class="btn-touch flex-1 py-3 bg-sk-danger text-white rounded-sk font-display btn-bounce font-medium active:bg-red-700"
							>
								Fechar Caixa
							</button>
						</div>

						{/* Close Step 1: Denomination Count */}
						<div id="close-step-1" class="hidden bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-4">
							<h3 class="font-display font-bold text-lg text-sk-text mb-2">Fechar Caixa — Contagem</h3>
							<p class="text-sm text-sk-muted font-body mb-4">
								Conte as cedulas e moedas em caixa:
							</p>
							<DenominationInput prefix="close" showTotal={true} totalLabel="Total contado" />
							<button
								onclick={`revealSummary(${register.id})`}
								class="btn-touch btn-bounce w-full mt-4 py-4 bg-sk-blue text-white rounded-sk font-display font-bold text-lg active:bg-sk-blue-dark"
							>
								CONFERIR
							</button>
							<button
								onclick="cancelClose()"
								class="btn-touch w-full mt-2 py-3 bg-gray-200 text-sk-muted rounded-sk font-display font-medium"
							>
								CANCELAR
							</button>
						</div>

						{/* Close Step 2: Summary Reveal */}
						<div id="close-step-2" class="hidden bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-4">
							<h3 class="font-display font-bold text-lg text-sk-text mb-4">Resumo do Caixa</h3>

							{/* Declared vs Expected */}
							<div class="grid grid-cols-2 gap-4 mb-4">
								<div class="bg-sk-blue-light rounded-sk p-3 text-center">
									<p class="text-xs text-sk-muted font-body">Declarado</p>
									<p id="close-declared" class="text-xl font-display font-bold text-sk-blue-dark">R$ 0,00</p>
								</div>
								<div class="bg-sk-yellow-light rounded-sk p-3 text-center">
									<p class="text-xs text-sk-muted font-body">Esperado</p>
									<p id="close-expected" class="text-xl font-display font-bold text-sk-yellow-dark">R$ 0,00</p>
								</div>
							</div>

							{/* Difference */}
							<div id="close-diff-box" class="rounded-sk p-4 text-center mb-4 bg-sk-green-light">
								<p class="text-xs text-sk-muted font-body">Diferenca</p>
								<p id="close-diff" class="text-2xl font-display font-bold text-sk-green-dark">R$ 0,00</p>
							</div>

							{/* Denomination comparison */}
							<div id="close-denom-comparison"></div>

							{/* Breakdown */}
							<div class="space-y-2 mb-4 text-sm font-body mt-4">
								<div class="flex justify-between"><span>Saldo inicial</span><span id="sum-opening">R$ 0,00</span></div>
								<div class="flex justify-between"><span>Pagamentos dinheiro</span><span id="sum-cash" class="text-sk-green-dark">R$ 0,00</span></div>
								<div class="flex justify-between text-sk-muted"><span>Pagamentos PIX</span><span id="sum-pix">R$ 0,00</span></div>
								<div class="flex justify-between text-sk-muted"><span>Pagamentos debito</span><span id="sum-debit">R$ 0,00</span></div>
								<div class="flex justify-between text-sk-muted"><span>Pagamentos credito</span><span id="sum-credit">R$ 0,00</span></div>
								<hr class="border-sk-border" />
								<div class="flex justify-between"><span>Suprimentos</span><span id="sum-deposits" class="text-sk-green-dark">R$ 0,00</span></div>
								<div class="flex justify-between"><span>Sangrias</span><span id="sum-withdrawals" class="text-sk-danger">R$ 0,00</span></div>
								<div class="flex justify-between"><span>Ajustes</span><span id="sum-adjustments">R$ 0,00</span></div>
								<hr class="border-sk-border" />
								<div class="flex justify-between"><span>Total locacoes</span><span id="sum-rentals">0</span></div>
								<div class="flex justify-between text-sk-muted"><span>Cortesias</span><span id="sum-courtesy">0</span></div>
							</div>

							{/* End shift checkbox */}
							{shift && (
								<label class="flex items-center gap-2 mb-4 text-sm font-body">
									<input type="checkbox" id="close-end-shift" data-shift-id={shift.id} class="w-4 h-4 accent-sk-blue" />
									Encerrar turno tambem
								</label>
							)}

							<button
								onclick={`confirmClose(${register.id})`}
								class="btn-touch btn-bounce w-full py-4 bg-sk-danger text-white rounded-sk font-display font-bold text-lg active:bg-red-700"
							>
								CONFIRMAR FECHAMENTO
							</button>
							<button
								onclick="cancelClose()"
								class="btn-touch w-full mt-2 py-3 bg-gray-200 text-sk-muted rounded-sk font-display font-medium"
							>
								VOLTAR
							</button>
						</div>

						{/* Transactions */}
						<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
							<div class="px-4 py-3 bg-sk-yellow-light/50 border-b">
								<h3 class="font-display font-medium text-sk-text text-sm">Movimentacoes</h3>
							</div>
							{transactions.length === 0 ? (
								<p class="px-4 py-6 text-center text-sk-muted font-body text-sm">Nenhuma movimentacao</p>
							) : (
								<div class="divide-y divide-gray-100">
									{transactions.map((tx) => (
										<div class="px-4 py-3 flex items-center justify-between">
											<div>
												<span class="text-sm font-medium font-body">{TX_TYPE_LABELS[tx.type] ?? tx.type}</span>
												{tx.description && <span class="text-xs text-sk-muted font-body ml-2">{tx.description}</span>}
												{tx.payment_method && <span class="text-xs text-sk-muted font-body ml-1">({tx.payment_method})</span>}
											</div>
											<div class="text-right">
												<span class={`font-medium text-sm ${tx.type === "withdrawal" ? "text-sk-danger" : "text-sk-green-dark"}`}>
													{tx.type === "withdrawal" ? "-" : "+"}{formatCurrency(tx.amount_cents)}
												</span>
												<p class="text-xs text-sk-muted font-body">{formatTime(tx.created_at)}</p>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Transaction Form Modal */}
						<div id="tx-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
							<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up max-h-[90vh] overflow-y-auto">
								<h3 class="text-lg font-display font-bold mb-4">Novo Movimento</h3>
								<div class="space-y-3">
									<div>
										<label class="block text-sm font-medium text-sk-text font-body mb-1">Tipo</label>
										<select id="tx-type" onchange="updateTxForm()" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue">
											<option value="deposit">Suprimento</option>
											<option value="withdrawal">Sangria</option>
											<option value="adjustment">Ajuste</option>
										</select>
									</div>
									<div id="tx-denom-section">
										<DenominationInput prefix="tx" showTotal={true} totalLabel="Total em cedulas/moedas" />
									</div>
									<div id="tx-amount-group" class="hidden">
										<label class="block text-sm font-medium text-sk-text font-body mb-1">Valor (R$)</label>
										<input id="tx-amount" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="0.00" />
									</div>
									<div id="tx-reason-group" class="hidden">
										<label class="block text-sm font-medium text-sk-text font-body mb-1">Motivo</label>
										<select id="tx-reason" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue">
											<option value="">Selecione...</option>
											<option value="Sangria p/ cofre">Sangria p/ cofre</option>
											<option value="Troco">Troco</option>
											<option value="Despesa operacional">Despesa operacional</option>
											<option value="Fundo de caixa">Fundo de caixa</option>
											<option value="__custom__">Outro (especificar)</option>
										</select>
									</div>
									<div>
										<label id="tx-desc-label" class="block text-sm font-medium text-sk-text font-body mb-1">Descricao</label>
										<input id="tx-desc" type="text" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-sk-blue/30 focus:border-sk-blue" placeholder="Opcional" />
									</div>
									<div class="flex gap-2 pt-2">
										<button onclick={`addTx(${register.id})`} class="btn-touch flex-1 py-2 bg-sk-blue text-white rounded-sk font-display btn-bounce font-medium">Salvar</button>
										<button onclick="closeTxForm()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-display font-medium">Cancelar</button>
									</div>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</Layout>
	);
};
