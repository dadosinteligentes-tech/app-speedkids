import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Asset, Package, RentalSessionView } from "../../db/schema";
import type { CashStatusBadge } from "../../lib/cash-status";
import { Layout } from "../layout";
import { AssetCard } from "./asset-card";
import { PackageSelector } from "./package-selector";
import { PaymentModal } from "./payment-modal";
import { ExtendModal } from "./extend-modal";
import { IdentificationForm } from "./identification-form";

interface DashboardProps {
	assets: Asset[];
	packages: Package[];
	sessions: RentalSessionView[];
	user?: { name: string; role: string } | null;
	cashStatus?: CashStatusBadge | null;
}

export const Dashboard: FC<DashboardProps> = ({ assets, packages, sessions, user, cashStatus }) => {
	const sessionMap = new Map(sessions.map((s) => [s.asset_id, s]));

	const dataScript = html`<script>
window.__SK_DATA__ = {
	assets: ${raw(JSON.stringify(assets))},
	packages: ${raw(JSON.stringify(packages))},
	sessions: ${raw(JSON.stringify(sessions))},
	userRole: ${raw(JSON.stringify(user?.role ?? "operator"))}
};
</script>`;

	const appScript = html`<script>
${raw(timerEngineScript)}
${raw(dashboardControllerScript)}
</script>`;

	return (
		<Layout title="SpeedKids - Dashboard" bodyScripts={html`${dataScript}${appScript}`} user={user} cashStatus={cashStatus}>
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-2xl font-display font-bold text-sk-text">🎠 Painel de Controle</h1>
				<button
					onclick="location.reload()"
					class="btn-touch btn-bounce px-4 py-2 bg-sk-surface rounded-sk shadow-sk-sm text-sm font-body font-medium text-sk-muted active:bg-sk-yellow-light"
				>
					Atualizar
				</button>
			</div>

			<div id="assets-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
				{assets.map((asset) => (
					<AssetCard asset={asset} session={sessionMap.get(asset.id) ?? null} />
				))}
			</div>

			<PackageSelector packages={packages} />
			<IdentificationForm />
			<PaymentModal />
			{(user?.role === "manager" || user?.role === "owner") && <ExtendModal packages={packages} />}
		</Layout>
	);
};

// ============================================================
// Client-side timer engine (inline)
// ============================================================
const timerEngineScript = `
function formatTime(ms) {
	var negative = ms < 0;
	var abs = Math.abs(ms);
	var totalSec = Math.floor(abs / 1000);
	var min = Math.floor(totalSec / 60);
	var sec = totalSec % 60;
	var str = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
	return negative ? '-' + str : str;
}

function calcRemaining(session) {
	if (!session || !session.start_time || !session.duration_minutes) return null;
	var now = Date.now();
	var start = new Date(session.start_time).getTime();
	if (isNaN(start)) return null;
	var paused = session.total_paused_ms || 0;

	if (session.status === 'paused' && session.pause_time) {
		paused += now - new Date(session.pause_time).getTime();
	}

	var elapsed = now - start - paused;
	var total = session.duration_minutes * 60 * 1000;
	return total - elapsed;
}

function getTimerState(remaining) {
	if (remaining === null) return 'available';
	if (remaining <= 0) return 'expired';
	if (remaining <= 5 * 60 * 1000) return 'warning';
	return 'running';
}

var CARD_STYLES = {
	available: 'bg-sk-green-light border-sk-green',
	running: 'bg-sk-blue-light border-sk-blue',
	warning: 'bg-sk-yellow-light border-sk-yellow',
	expired: 'bg-sk-danger-light border-sk-danger animate-sk-pulse',
	paused: 'bg-sk-blue-light border-sk-blue/50 opacity-75',
	maintenance: 'bg-gray-100 border-gray-300',
	pending_payment: 'bg-sk-yellow-light border-sk-yellow',
};

var STATUS_COLORS = {
	available: 'bg-sk-green',
	running: 'bg-sk-blue',
	warning: 'bg-sk-yellow',
	expired: 'bg-sk-danger',
	paused: 'bg-sk-blue/60',
	maintenance: 'bg-gray-400',
	pending_payment: 'bg-sk-yellow',
};

function calcOvertimeCost(session, remaining) {
	if (remaining >= 0) return null;
	var pkgs = window.__SK_DATA__ && window.__SK_DATA__.packages || [];
	var pkg = null;
	for (var i = 0; i < pkgs.length; i++) {
		if (pkgs[i].id === session.package_id) { pkg = pkgs[i]; break; }
	}
	if (!pkg || !pkg.overtime_block_price_cents) return null;
	var overtimeMs = Math.abs(remaining) - (pkg.grace_period_minutes || 0) * 60000;
	if (overtimeMs <= 0) return null;
	var blockMs = (pkg.overtime_block_minutes || 5) * 60000;
	var blocks = Math.ceil(overtimeMs / blockMs);
	return blocks * pkg.overtime_block_price_cents;
}

function updateTimerDisplays() {
	if (!window.__SK_SESSIONS__) return;
	var cards = document.querySelectorAll('[data-asset-id]');
	cards.forEach(function(card) {
		var assetId = Number(card.dataset.assetId);
		var session = window.__SK_SESSIONS__[assetId];
		var timerEl = card.querySelector('.timer-display');
		var statusDot = card.querySelector('.status-dot');
		var statusText = card.querySelector('.status-text');
		var overtimeEl = card.querySelector('.overtime-display');

		if (!session || session.status === 'cancelled' || (session.status === 'completed' && session.paid)) {
			if (timerEl) timerEl.textContent = '';
			if (overtimeEl) { overtimeEl.textContent = ''; overtimeEl.classList.add('hidden'); }
			return;
		}
		if (session.status === 'completed' && !session.paid) {
			if (timerEl) timerEl.textContent = '';
			if (overtimeEl) { overtimeEl.textContent = ''; overtimeEl.classList.add('hidden'); }
			return;
		}

		var remaining = calcRemaining(session);
		var state = session.status === 'paused' ? 'paused' : getTimerState(remaining);

		if (timerEl) timerEl.textContent = formatTime(remaining);

		// Update overtime cost display
		if (overtimeEl) {
			var otCost = calcOvertimeCost(session, remaining);
			if (otCost && otCost > 0) {
				overtimeEl.textContent = 'Excedente: R$ ' + (otCost / 100).toFixed(2).replace('.', ',');
				overtimeEl.classList.remove('hidden');
			} else {
				overtimeEl.textContent = '';
				overtimeEl.classList.add('hidden');
			}
		}

		// Update card style
		var baseClasses = 'rounded-sk border-2 p-4 shadow-sk-sm transition-all card-wobble';
		card.className = baseClasses + ' ' + (CARD_STYLES[state] || '');

		// Update status dot
		if (statusDot) {
			statusDot.className = 'status-dot w-3 h-3 rounded-full flex-shrink-0 ' + (STATUS_COLORS[state] || '');
		}

		// Update status text
		if (statusText) {
			var texts = { running: 'Em uso', warning: 'Acabando!', expired: 'EXPIRADO!', paused: 'PAUSADO' };
			statusText.textContent = texts[state] || '';
		}
	});
}

setInterval(updateTimerDisplays, 1000);
`;

// ============================================================
// Client-side dashboard controller (inline)
// ============================================================
const dashboardControllerScript = `
(function() {
	// Build sessions map keyed by asset_id
	window.__SK_SESSIONS__ = {};
	(window.__SK_DATA__.sessions || []).forEach(function(s) {
		window.__SK_SESSIONS__[s.asset_id] = s;
	});

	// Save to localStorage for offline resilience
	function saveLocal() {
		try { localStorage.setItem('sk_sessions', JSON.stringify(window.__SK_SESSIONS__)); } catch(e) {}
	}
	saveLocal();

	// API helper — rejects on non-2xx so error objects never get stored as data
	function api(method, path, body) {
		var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
		if (body) opts.body = JSON.stringify(body);
		return fetch('/api' + path, opts).then(function(r) {
			return r.json().then(function(data) {
				if (!r.ok) throw new Error(data.error || 'Erro ' + r.status);
				return data;
			});
		});
	}

	// ---- Actions ----

	window.showPackageSelector = function(assetId) {
		window.__SK_SELECTED_ASSET__ = assetId;
		document.getElementById('package-modal').classList.remove('hidden');
	};

	window.selectPackage = function(packageId) {
		document.getElementById('package-modal').classList.add('hidden');
		window.__SK_SELECTED_PACKAGE__ = packageId;
		openIdentificationModal();
	};

	window.startRental = function(customerId, childId) {
		var assetId = window.__SK_SELECTED_ASSET__;
		var packageId = window.__SK_SELECTED_PACKAGE__;
		var body = { asset_id: assetId, package_id: packageId };
		if (customerId) body.customer_id = customerId;
		if (childId) body.child_id = childId;

		api('POST', '/rentals/start', body)
			.then(function(session) {
				window.__SK_SESSIONS__[assetId] = session;
				saveLocal();
				updateCard(assetId, session);
				if (typeof triggerConfetti === 'function') triggerConfetti();
			})
			.catch(function(err) { alert('Erro ao iniciar: ' + err.message); });
	};

	window.pauseRental = function(sessionId, assetId) {
		api('POST', '/rentals/' + sessionId + '/pause')
			.then(function(session) {
				window.__SK_SESSIONS__[assetId] = session;
				saveLocal();
				updateCard(assetId, session);
			})
			.catch(function() { alert('Erro ao pausar. Tente novamente.'); });
	};

	window.resumeRental = function(sessionId, assetId) {
		api('POST', '/rentals/' + sessionId + '/resume')
			.then(function(session) {
				window.__SK_SESSIONS__[assetId] = session;
				saveLocal();
				updateCard(assetId, session);
			})
			.catch(function() { alert('Erro ao retomar. Tente novamente.'); });
	};

	// ---- Helpers de pagamento ----
	function fmtBRL(cents) {
		return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
	}

	function showPaymentScreen(screen) {
		['payment-confirm-stop','payment-main','payment-cash','payment-waive','payment-success'].forEach(function(id) {
			var el = document.getElementById(id);
			if (el) el.classList.toggle('hidden', id !== 'payment-' + screen);
		});
	}

	function setPaymentButtonsEnabled(enabled) {
		var btns = document.querySelectorAll('#payment-buttons button');
		btns.forEach(function(b) { b.disabled = !enabled; });
	}

	function populatePaymentSummary(session) {
		var childEl = document.getElementById('pay-child');
		var guardianEl = document.getElementById('pay-guardian');
		var assetEl = document.getElementById('pay-asset');
		var timeEl = document.getElementById('pay-time');

		if (childEl) {
			childEl.textContent = session.child_name
				? '\\u{1F466} ' + session.child_name + (session.child_age ? ' (' + session.child_age + ' anos)' : '')
				: '';
		}
		if (guardianEl) {
			guardianEl.textContent = session.customer_name
				? '\\u{1F464} ' + session.customer_name
				: '';
		}
		if (assetEl) {
			assetEl.textContent = '\\u{1F3CE}\\u{FE0F} ' + (session.asset_name || 'Ativo')
				+ (session.package_name ? ' \\u{00B7} ' + session.package_name : '');
		}
		if (timeEl && session.start_time && session.end_time) {
			var start = new Date(session.start_time);
			var end = new Date(session.end_time);
			var startStr = String(start.getHours()).padStart(2,'0') + ':' + String(start.getMinutes()).padStart(2,'0');
			var endStr = String(end.getHours()).padStart(2,'0') + ':' + String(end.getMinutes()).padStart(2,'0');
			var elapsedMs = end.getTime() - start.getTime() - (session.total_paused_ms || 0);
			var elapsedMin = Math.round(elapsedMs / 60000);
			timeEl.textContent = '\\u{23F1} ' + startStr + ' \\u{2192} ' + endStr + ' (' + elapsedMin + 'min)';
		}

		// Overtime breakdown
		var otBreakdown = document.getElementById('payment-overtime-breakdown');
		if (otBreakdown) {
			if (session.overtime_cents && session.overtime_cents > 0) {
				var baseAmount = session.amount_cents - session.overtime_cents;
				document.getElementById('pay-base-amount').textContent = fmtBRL(baseAmount);
				document.getElementById('pay-ot-minutes').textContent = session.overtime_minutes || 0;
				document.getElementById('pay-ot-amount').textContent = fmtBRL(session.overtime_cents);
				otBreakdown.classList.remove('hidden');
			} else {
				otBreakdown.classList.add('hidden');
			}
		}

		// Valor
		document.getElementById('payment-amount').textContent = fmtBRL(session.amount_cents);
		document.getElementById('payment-original').classList.add('hidden');

		// Reset desconto
		window.__SK_DISCOUNT__ = 0;
		var discountFields = document.getElementById('discount-fields');
		if (discountFields) discountFields.classList.add('hidden');
		var discountValue = document.getElementById('discount-value');
		if (discountValue) discountValue.value = '';
		var removeBtn = document.getElementById('discount-remove-btn');
		if (removeBtn) removeBtn.classList.add('hidden');

		// Reset waive
		var waiveReason = document.getElementById('waive-reason');
		if (waiveReason) waiveReason.value = '';
		var waiveAmount = document.getElementById('waive-amount');
		if (waiveAmount) waiveAmount.textContent = fmtBRL(session.amount_cents);
	}

	// ---- Stop / Pay / Waive ----

	window.stopRental = function(sessionId, assetId) {
		var session = window.__SK_SESSIONS__[assetId];
		// Populate confirm screen summary
		var el;
		el = document.getElementById('confirm-child');
		if (el) el.textContent = session && session.child_name
			? '\\u{1F466} ' + session.child_name + (session.child_age ? ' (' + session.child_age + ' anos)' : '')
			: '';
		el = document.getElementById('confirm-guardian');
		if (el) el.textContent = session && session.customer_name ? '\\u{1F464} ' + session.customer_name : '';
		el = document.getElementById('confirm-asset');
		if (el) el.textContent = session ? '\\u{1F697} ' + (session.asset_name || '') + ' \\u{00B7} ' + (session.package_name || '') : '';
		el = document.getElementById('confirm-time');
		if (el && session) {
			var remaining = calcRemaining(session);
			var totalMs = session.duration_minutes * 60 * 1000;
			var elapsedMs = totalMs - (remaining || 0);
			el.textContent = '\\u{23F1} Tempo decorrido: ' + formatTime(elapsedMs);
		}

		window.__SK_STOP_PENDING__ = { sessionId: sessionId, assetId: assetId };
		showPaymentScreen('confirm-stop');
		document.getElementById('payment-modal').classList.remove('hidden');
	};

	window.confirmStopRental = function() {
		var pending = window.__SK_STOP_PENDING__;
		if (!pending) return;
		var btn = document.getElementById('confirm-stop-btn');
		if (btn) btn.disabled = true;

		api('POST', '/rentals/' + pending.sessionId + '/stop')
			.then(function(session) {
				window.__SK_SESSIONS__[pending.assetId] = session;
				saveLocal();
				window.__SK_PAYING_SESSION__ = session;
				window.__SK_STOP_PENDING__ = null;
				populatePaymentSummary(session);
				showPaymentScreen('main');
				setPaymentButtonsEnabled(true);
				if (btn) btn.disabled = false;
				// Verificar caixa aberto
				api('GET', '/cash-registers/active').then(function(reg) {
					var w = document.getElementById('payment-no-register');
					if (w) w.classList.toggle('hidden', !!reg);
				}).catch(function() {});
			})
			.catch(function() {
				if (btn) btn.disabled = false;
				alert('Erro ao encerrar locacao. Tente novamente.');
			});
	};

	window.cancelStopRental = function() {
		window.__SK_STOP_PENDING__ = null;
		document.getElementById('payment-modal').classList.add('hidden');
	};

	window.selectPayment = function(method) {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;

		if (method === 'cash') {
			// Show denomination screen for cash payments
			var discount = window.__SK_DISCOUNT__ || 0;
			var amountDue = session.amount_cents - discount;
			window.__SK_CASH_AMOUNT_DUE__ = amountDue;
			document.getElementById('cash-amount-due').textContent = fmtBRL(amountDue);
			clearDenomInputs('pay');
			var changeDisplay = document.getElementById('pay-change-display');
			if (changeDisplay) changeDisplay.classList.add('hidden');
			document.getElementById('cash-confirm-btn').disabled = true;
			showPaymentScreen('cash');
			return;
		}

		var discount = window.__SK_DISCOUNT__ || 0;
		var body = { payment_method: method };
		if (discount > 0) body.discount_cents = discount;

		setPaymentButtonsEnabled(false);
		api('POST', '/rentals/' + session.id + '/pay', body)
			.then(function() {
				delete window.__SK_SESSIONS__[session.asset_id];
				saveLocal();
				updateCard(session.asset_id, null);
				var finalAmount = session.amount_cents - discount;
				var labels = { cash:'Dinheiro', pix:'PIX', debit:'Debito', credit:'Credito' };
				document.getElementById('success-amount').textContent = fmtBRL(finalAmount);
				document.getElementById('success-method').textContent = labels[method] || method;
				document.getElementById('success-detail').textContent =
					(session.child_name || 'Cliente') + ' \\u{00B7} ' + (session.asset_name || '');
				// Hide change section for non-cash methods
				var successChange = document.getElementById('success-change');
				if (successChange) successChange.classList.add('hidden');
				showPaymentScreen('success');
			})
			.catch(function() {
				setPaymentButtonsEnabled(true);
				alert('Erro ao registrar pagamento. Tente novamente.');
			});
	};

	// ---- Desconto ----
	window.toggleDiscount = function() {
		var fields = document.getElementById('discount-fields');
		fields.classList.toggle('hidden');
		if (!fields.classList.contains('hidden')) {
			document.getElementById('discount-value').focus();
		}
	};

	window.applyDiscount = function() {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;
		var type = document.getElementById('discount-type').value;
		var val = parseFloat(document.getElementById('discount-value').value) || 0;
		if (val <= 0) return;
		var discount = type === 'pct'
			? Math.round(session.amount_cents * val / 100)
			: Math.round(val * 100);
		discount = Math.min(discount, session.amount_cents);
		window.__SK_DISCOUNT__ = discount;

		var finalAmount = session.amount_cents - discount;
		document.getElementById('payment-amount').textContent = fmtBRL(finalAmount);
		document.getElementById('payment-original').textContent = fmtBRL(session.amount_cents);
		document.getElementById('payment-original').classList.remove('hidden');
		document.getElementById('discount-remove-btn').classList.remove('hidden');
	};

	window.removeDiscount = function() {
		window.__SK_DISCOUNT__ = 0;
		var session = window.__SK_PAYING_SESSION__;
		if (session) {
			document.getElementById('payment-amount').textContent = fmtBRL(session.amount_cents);
		}
		document.getElementById('payment-original').classList.add('hidden');
		document.getElementById('discount-fields').classList.add('hidden');
		document.getElementById('discount-remove-btn').classList.add('hidden');
		document.getElementById('discount-value').value = '';
	};

	// ---- Cortesia ----
	window.showWaiveConfirm = function() {
		showPaymentScreen('waive');
	};

	window.cancelWaive = function() {
		showPaymentScreen('main');
	};

	window.confirmWaive = function() {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;
		var reason = document.getElementById('waive-reason').value.trim();
		if (!reason) { alert('Informe o motivo da cortesia'); return; }

		api('POST', '/rentals/' + session.id + '/pay', {
			payment_method: 'courtesy',
			discount_cents: session.amount_cents,
			notes: reason
		})
		.then(function() {
			delete window.__SK_SESSIONS__[session.asset_id];
			saveLocal();
			updateCard(session.asset_id, null);
			document.getElementById('payment-modal').classList.add('hidden');
			window.__SK_PAYING_SESSION__ = null;
		})
		.catch(function() {
			alert('Erro ao registrar cortesia. Tente novamente.');
		});
	};

	// ---- Dismiss sucesso ----
	window.dismissPayment = function() {
		var session = window.__SK_PAYING_SESSION__;
		document.getElementById('payment-modal').classList.add('hidden');
		window.__SK_PAYING_SESSION__ = null;
		// Update card to show pending payment state
		if (session && session.asset_id) {
			updateCard(session.asset_id, session);
		}
	};

	window.confirmDismissPayment = function() {
		if (confirm('A locacao ja foi encerrada. Deseja sair sem registrar o pagamento?\\n\\nO pagamento ficara pendente.')) {
			dismissPayment();
		}
	};

	window.reopenPayment = function(sessionId, assetId) {
		var session = window.__SK_SESSIONS__[assetId];
		if (!session) {
			api('GET', '/rentals/' + sessionId).then(function(s) {
				window.__SK_PAYING_SESSION__ = s;
				populatePaymentSummary(s);
				showPaymentScreen('main');
				setPaymentButtonsEnabled(true);
				document.getElementById('payment-modal').classList.remove('hidden');
				api('GET', '/cash-registers/active').then(function(reg) {
					var w = document.getElementById('payment-no-register');
					if (w) w.classList.toggle('hidden', !!reg);
				}).catch(function() {});
			}).catch(function() {
				alert('Erro ao carregar sessao.');
			});
			return;
		}
		window.__SK_PAYING_SESSION__ = session;
		populatePaymentSummary(session);
		showPaymentScreen('main');
		setPaymentButtonsEnabled(true);
		document.getElementById('payment-modal').classList.remove('hidden');
		api('GET', '/cash-registers/active').then(function(reg) {
			var w = document.getElementById('payment-no-register');
			if (w) w.classList.toggle('hidden', !!reg);
		}).catch(function() {});
	};

	// ---- Denomination helpers for cash payment ----
	var DENOM_VALUES = [20000,10000,5000,2000,1000,500,200,100,50,25,10,5];
	var DENOM_LABELS = {20000:'R$ 200',10000:'R$ 100',5000:'R$ 50',2000:'R$ 20',1000:'R$ 10',500:'R$ 5',200:'R$ 2',100:'R$ 1',50:'R$ 0,50',25:'R$ 0,25',10:'R$ 0,10',5:'R$ 0,05'};
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

	window.denomIncrement = function(prefix, cents) {
		var input = document.getElementById(prefix + '-d-' + cents);
		if (!input) return;
		input.value = (parseInt(input.value, 10) || 0) + 1;
		updateDenomBadge(prefix, cents);
		updateDenomTotal(prefix);
	};

	window.denomDecrement = function(prefix, cents) {
		var input = document.getElementById(prefix + '-d-' + cents);
		if (!input) return;
		var val = parseInt(input.value, 10) || 0;
		if (val <= 0) return;
		input.value = val - 1;
		updateDenomBadge(prefix, cents);
		updateDenomTotal(prefix);
	};

	function clearDenomInputs(prefix) {
		DENOM_VALUES.forEach(function(cents) {
			var el = document.getElementById(prefix + '-d-' + cents);
			if (el) el.value = '0';
			updateDenomBadge(prefix, cents);
		});
		updateDenomTotal(prefix);
	}

	window.updateDenomTotal = function(prefix) {
		var map = getDenomMap(prefix);
		var total = denomMapTotal(map);
		var el = document.getElementById(prefix + '-denom-total');
		if (el) el.textContent = fmtBRL(total);

		// Handle change calculation for payment screen
		if (prefix === 'pay') {
			onPayDenomChange(total, map);
		}
	};

	function renderChangeCards(denomMap) {
		var html = '';
		DENOM_VALUES.forEach(function(cents) {
			var qty = denomMap[cents];
			if (qty && qty > 0) {
				var c = DENOM_COLORS[cents];
				html += '<div class="relative ' + c.bg + ' ' + c.text + ' rounded-sk p-2 min-h-[48px] flex items-center justify-center">'
					+ '<span class="text-base font-display font-bold">' + DENOM_LABELS[cents] + '</span>'
					+ '<span class="absolute -top-2 -right-2 w-6 h-6 rounded-full ' + c.badge + ' text-white font-bold text-xs flex items-center justify-center shadow-md">' + qty + '</span>'
					+ '</div>';
			}
		});
		return html;
	}

	var _changeTimer = null;
	function onPayDenomChange(received, payMap) {
		var due = window.__SK_CASH_AMOUNT_DUE__ || 0;
		var changeAmt = received - due;
		var confirmBtn = document.getElementById('cash-confirm-btn');
		var changeDisplay = document.getElementById('pay-change-display');
		var changeAmountEl = document.getElementById('pay-change-amount');
		var breakdownEl = document.getElementById('pay-change-breakdown');
		var impossibleEl = document.getElementById('pay-change-impossible');

		if (received < due) {
			if (changeDisplay) changeDisplay.classList.add('hidden');
			if (confirmBtn) confirmBtn.disabled = true;
			return;
		}

		if (changeAmt === 0) {
			if (changeDisplay) changeDisplay.classList.add('hidden');
			if (confirmBtn) confirmBtn.disabled = false;
			window.__SK_CHANGE_DENOMS__ = {};
			return;
		}

		// Need change — calculate via API
		if (changeDisplay) changeDisplay.classList.remove('hidden');
		if (changeAmountEl) changeAmountEl.textContent = fmtBRL(changeAmt);
		if (breakdownEl) breakdownEl.innerHTML = '<p class="text-xs text-sk-muted text-center">Calculando...</p>';

		if (_changeTimer) clearTimeout(_changeTimer);
		_changeTimer = setTimeout(function() {
			api('GET', '/cash-registers/active')
				.then(function(reg) {
					if (!reg) {
						window.__SK_CHANGE_DENOMS__ = {};
						if (breakdownEl) breakdownEl.innerHTML = '';
						if (impossibleEl) impossibleEl.classList.add('hidden');
						if (confirmBtn) confirmBtn.disabled = false;
						return;
					}
					return api('POST', '/cash-registers/' + reg.id + '/calculate-change', {
						amount_due_cents: due,
						payment_denominations: payMap,
					});
				})
				.then(function(result) {
					if (!result) return;
					if (result.exact && result.denominations) {
						window.__SK_CHANGE_DENOMS__ = result.denominations;
						if (impossibleEl) impossibleEl.classList.add('hidden');
						if (breakdownEl) breakdownEl.innerHTML = renderChangeCards(result.denominations);
						if (confirmBtn) confirmBtn.disabled = false;
					} else {
						window.__SK_CHANGE_DENOMS__ = {};
						if (impossibleEl) impossibleEl.classList.remove('hidden');
						if (breakdownEl) breakdownEl.innerHTML = '';
						if (confirmBtn) confirmBtn.disabled = false;
					}
				})
				.catch(function() {
					if (confirmBtn) confirmBtn.disabled = false;
					window.__SK_CHANGE_DENOMS__ = {};
				});
		}, 300);
	}

	window.confirmCashPayment = function() {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;
		var discount = window.__SK_DISCOUNT__ || 0;
		var payDenoms = getDenomMap('pay');
		var changeDenoms = window.__SK_CHANGE_DENOMS__ || {};
		var cashAmountDue = window.__SK_CASH_AMOUNT_DUE__ || 0;
		var received = denomMapTotal(payDenoms);
		var changeAmt = received - cashAmountDue;

		var body = {
			payment_method: 'cash',
			payment_denominations: payDenoms,
			change_denominations: changeDenoms,
		};
		if (discount > 0) body.discount_cents = discount;

		var btn = document.getElementById('cash-confirm-btn');
		if (btn) btn.disabled = true;

		api('POST', '/rentals/' + session.id + '/pay', body)
			.then(function() {
				delete window.__SK_SESSIONS__[session.asset_id];
				saveLocal();
				updateCard(session.asset_id, null);
				var finalAmount = session.amount_cents - discount;
				document.getElementById('success-amount').textContent = fmtBRL(finalAmount);
				document.getElementById('success-method').textContent = 'Dinheiro';
				document.getElementById('success-detail').textContent =
					(session.child_name || 'Cliente') + ' \\u{00B7} ' + (session.asset_name || '');

				// Show change info on success screen
				var successChange = document.getElementById('success-change');
				if (changeAmt > 0 && successChange) {
					document.getElementById('success-change-amount').textContent = fmtBRL(changeAmt);
					var brkHtml = renderChangeCards(changeDenoms);
					var hasBreakdown = brkHtml.length > 0;
					var brkEl = document.getElementById('success-change-breakdown');
					if (brkEl) brkEl.innerHTML = brkHtml;
					var impEl = document.getElementById('success-change-impossible');
					if (impEl) impEl.classList.toggle('hidden', hasBreakdown);
					successChange.classList.remove('hidden');
				} else if (successChange) {
					successChange.classList.add('hidden');
				}

				showPaymentScreen('success');
			})
			.catch(function(err) {
				alert('Erro ao registrar pagamento: ' + (err.message || 'Erro'));
				if (btn) btn.disabled = false;
			});
	};

	window.cancelCashPayment = function() {
		showPaymentScreen('main');
	};

	window.closePackageModal = function() {
		document.getElementById('package-modal').classList.add('hidden');
	};

	// ---- Identification Form Controller ----
	var __idState = { customerId: null, childId: null, children: [], isReturning: false };
	var phoneSearchTimer = null;

	// Input masks
	window.onPhoneInput = function(el) {
		var raw = el.value.replace(/\\D/g, '');
		if (raw.length > 11) raw = raw.substring(0, 11);
		var masked = '';
		if (raw.length > 0) masked += '(' + raw.substring(0, 2);
		if (raw.length >= 2) masked += ') ';
		if (raw.length > 2) masked += raw.substring(2, 7);
		if (raw.length > 7) masked += '-' + raw.substring(7, 11);
		el.value = masked;

		clearTimeout(phoneSearchTimer);
		if (raw.length === 11) {
			document.getElementById('id-phone-loading').classList.remove('hidden');
			phoneSearchTimer = setTimeout(function() { lookupPhone(raw); }, 300);
		} else {
			document.getElementById('id-phone-loading').classList.add('hidden');
			document.getElementById('id-phone-match').classList.add('hidden');
			setNewCustomerMode();
		}
	};

	window.onBirthdateInput = function(el) {
		var raw = el.value.replace(/\\D/g, '');
		if (raw.length > 8) raw = raw.substring(0, 8);
		var masked = '';
		if (raw.length > 0) masked += raw.substring(0, 2);
		if (raw.length > 2) masked += '/' + raw.substring(2, 4);
		if (raw.length > 4) masked += '/' + raw.substring(4, 8);
		el.value = masked;
	};

	function lookupPhone(rawPhone) {
		api('GET', '/customers/phone/' + rawPhone)
			.then(function(result) {
				document.getElementById('id-phone-loading').classList.add('hidden');
				if (result && result.customer) {
					setReturningCustomerMode(result.customer, result.children || []);
				} else {
					document.getElementById('id-phone-match').classList.add('hidden');
					setNewCustomerMode();
				}
			})
			.catch(function() {
				document.getElementById('id-phone-loading').classList.add('hidden');
				setNewCustomerMode();
			});
	}

	function setReturningCustomerMode(customer, children) {
		__idState.customerId = customer.id;
		__idState.children = children;
		__idState.isReturning = true;
		__idState.childId = null;

		document.getElementById('id-phone-match').classList.remove('hidden');
		var nameEl = document.getElementById('id-guardian-name');
		nameEl.value = customer.name;
		nameEl.classList.add('bg-sk-yellow-light');

		if (children.length > 0) {
			var listEl = document.getElementById('id-children-list');
			listEl.innerHTML = children.map(function(child) {
				return '<label class="flex items-center gap-3 p-3 bg-sk-blue-light border border-sk-blue/30 rounded-sk cursor-pointer">'
					+ '<input type="radio" name="id-child-radio" value="' + child.id + '" onchange="selectExistingChild(' + child.id + ')" class="w-5 h-5 text-sk-blue accent-sk-blue" />'
					+ '<div><span class="font-display font-medium text-sk-text">' + child.name + '</span>'
					+ '<span class="text-sm text-sk-muted ml-2">' + child.age + ' anos</span></div>'
					+ '</label>';
			}).join('');
			document.getElementById('id-known-children').classList.remove('hidden');
			document.getElementById('id-new-child').classList.add('hidden');
		} else {
			document.getElementById('id-known-children').classList.add('hidden');
			document.getElementById('id-new-child').classList.remove('hidden');
		}
	}

	function setNewCustomerMode() {
		__idState.customerId = null;
		__idState.children = [];
		__idState.isReturning = false;
		__idState.childId = null;

		var nameEl = document.getElementById('id-guardian-name');
		if (nameEl) {
			nameEl.classList.remove('bg-sk-yellow-light');
			if (!__idState.isReturning) nameEl.value = '';
		}
		var knownEl = document.getElementById('id-known-children');
		if (knownEl) knownEl.classList.add('hidden');
		var newEl = document.getElementById('id-new-child');
		if (newEl) newEl.classList.remove('hidden');
	}

	window.selectExistingChild = function(childId) {
		__idState.childId = childId;
		document.getElementById('id-new-child').classList.add('hidden');
	};

	window.showNewChildFields = function() {
		__idState.childId = null;
		var radios = document.querySelectorAll('input[name="id-child-radio"]');
		radios.forEach(function(r) { r.checked = false; });
		document.getElementById('id-new-child').classList.remove('hidden');
		document.getElementById('id-child-name').focus();
	};

	function openIdentificationModal() {
		__idState = { customerId: null, childId: null, children: [], isReturning: false };
		document.getElementById('id-phone').value = '';
		document.getElementById('id-guardian-name').value = '';
		document.getElementById('id-guardian-name').classList.remove('bg-sk-yellow-light');
		document.getElementById('id-child-name').value = '';
		document.getElementById('id-child-age').value = '';
		document.getElementById('id-child-birthdate').value = '';
		document.getElementById('id-phone-loading').classList.add('hidden');
		document.getElementById('id-phone-match').classList.add('hidden');
		document.getElementById('id-known-children').classList.add('hidden');
		document.getElementById('id-children-list').innerHTML = '';
		document.getElementById('id-new-child').classList.remove('hidden');
		document.getElementById('identification-modal').classList.remove('hidden');
		setTimeout(function() { document.getElementById('id-phone').focus(); }, 100);
	}

	window.closeIdentificationModal = function() {
		document.getElementById('identification-modal').classList.add('hidden');
	};

	window.confirmIdentificationAndStart = function() {
		var phone = document.getElementById('id-phone').value.replace(/\\D/g, '');
		var guardianName = document.getElementById('id-guardian-name').value.trim();

		if (!phone || phone.length < 10) { alert('Telefone do responsavel e obrigatorio'); return; }
		if (!guardianName) { alert('Nome do responsavel e obrigatorio'); return; }

		var needsNewChild = !__idState.childId;
		var childName, childAge, childBirthdate;

		if (needsNewChild) {
			childName = document.getElementById('id-child-name').value.trim();
			childAge = parseInt(document.getElementById('id-child-age').value, 10);
			childBirthdate = document.getElementById('id-child-birthdate').value.trim();
			if (!childName) { alert('Nome da crianca e obrigatorio'); return; }
			if (!childAge || childAge < 1) { alert('Idade da crianca e obrigatoria'); return; }
		}

		var birthDateISO = null;
		if (childBirthdate && childBirthdate.length === 10) {
			var parts = childBirthdate.split('/');
			birthDateISO = parts[2] + '-' + parts[1] + '-' + parts[0];
		}

		var btn = document.getElementById('id-start-btn');
		btn.disabled = true;
		btn.textContent = 'INICIANDO...';

		var customerPromise;
		if (__idState.customerId) {
			customerPromise = Promise.resolve(__idState.customerId);
		} else {
			customerPromise = api('POST', '/customers/quick', { name: guardianName, phone: phone })
				.then(function(c) { return c.id; });
		}

		customerPromise
			.then(function(customerId) {
				if (__idState.childId) {
					return { customerId: customerId, childId: __idState.childId };
				}
				return api('POST', '/customers/' + customerId + '/children', {
					name: childName,
					age: childAge,
					birth_date: birthDateISO
				}).then(function(child) {
					return { customerId: customerId, childId: child.id };
				});
			})
			.then(function(result) {
				document.getElementById('identification-modal').classList.add('hidden');
				startRental(result.customerId, result.childId);
			})
			.catch(function(err) {
				alert('Erro: ' + (err.message || 'Falha ao iniciar'));
			})
			.finally(function() {
				btn.disabled = false;
				btn.textContent = 'INICIAR';
			});
	};

	// ---- Extend ----
	window.showExtendModal = function(sessionId, assetId) {
		window.__SK_EXTENDING__ = { sessionId: sessionId, assetId: assetId };
		var modal = document.getElementById('extend-modal');
		if (modal) modal.classList.remove('hidden');
	};

	window.closeExtendModal = function() {
		var modal = document.getElementById('extend-modal');
		if (modal) modal.classList.add('hidden');
	};

	window.extendWithPackage = function(packageId) {
		var ext = window.__SK_EXTENDING__;
		if (!ext) return;
		closeExtendModal();
		api('POST', '/rentals/' + ext.sessionId + '/extend', { package_id: packageId })
			.then(function(session) {
				window.__SK_SESSIONS__[ext.assetId] = session;
				saveLocal();
				updateCard(ext.assetId, session);
			})
			.catch(function(err) { alert('Erro ao estender: ' + (err.message || 'Erro')); });
	};

	function updateCard(assetId, session) {
		var card = document.querySelector('[data-asset-id="' + assetId + '"]');
		if (!card) return;
		var actionsEl = card.querySelector('.card-actions');
		if (!actionsEl) return;

		// Update person info
		var personInfo = card.querySelector('.person-info');
		var isPendingPayment = session && session.status === 'completed' && !session.paid;
		if (personInfo) {
			if (session && (session.status === 'running' || session.status === 'paused' || isPendingPayment) && session.child_name) {
				var html = '<div class="bg-white/70 rounded-sk px-2 py-1.5">'
					+ '<div class="font-display font-semibold text-sk-text truncate">'
					+ '\\u{1F466} ' + session.child_name + (session.child_age ? ' (' + session.child_age + ' anos)' : '')
					+ '</div>';
				if (session.customer_name) {
					html += '<div class="text-sk-muted truncate">\\u{1F464} ' + session.customer_name + '</div>';
				}
				html += '</div>';
				personInfo.innerHTML = html;
				personInfo.classList.remove('hidden');
			} else {
				personInfo.innerHTML = '';
				personInfo.classList.add('hidden');
			}
		}

		if (isPendingPayment) {
			card.className = 'rounded-sk border-2 p-4 shadow-sk-sm transition-all card-wobble ' + CARD_STYLES.pending_payment;
			actionsEl.innerHTML = '<button onclick="reopenPayment(\\'' + session.id + '\\',' + assetId + ')" class="btn-touch btn-bounce w-full py-3 bg-sk-yellow text-sk-text rounded-sk font-display font-bold text-lg active:bg-sk-yellow-dark shadow-sk-sm" aria-label="Registrar pagamento">PAGAR</button>';
			var timerEl = card.querySelector('.timer-display');
			if (timerEl) timerEl.textContent = '';
			var statusText = card.querySelector('.status-text');
			if (statusText) statusText.textContent = 'PAGAMENTO PENDENTE';
			var statusDot = card.querySelector('.status-dot');
			if (statusDot) statusDot.className = 'status-dot w-3 h-3 rounded-full flex-shrink-0 ' + STATUS_COLORS.pending_payment;
			var pkgName = card.querySelector('.package-name');
			if (pkgName) pkgName.textContent = session.package_name || '';
		} else if (!session || session.status === 'completed' || session.status === 'cancelled') {
			card.className = 'rounded-sk border-2 p-4 shadow-sk-sm transition-all card-wobble ' + CARD_STYLES.available;
			actionsEl.innerHTML = '<button onclick="showPackageSelector(' + assetId + ')" class="btn-touch btn-bounce w-full py-3 bg-sk-green text-white rounded-sk font-display font-bold text-lg active:bg-sk-green-dark shadow-sk-sm" aria-label="Iniciar locacao">INICIAR</button>';
			var timerEl = card.querySelector('.timer-display');
			if (timerEl) timerEl.textContent = '';
			var statusText = card.querySelector('.status-text');
			if (statusText) statusText.textContent = 'Disponivel';
			var pkgName = card.querySelector('.package-name');
			if (pkgName) pkgName.textContent = '';
		} else if (session.status === 'running' || session.status === 'paused') {
			var isPaused = session.status === 'paused';
			var canExtend = window.__SK_DATA__.userRole === 'manager' || window.__SK_DATA__.userRole === 'owner';
			actionsEl.innerHTML =
				'<div class="flex gap-1">'
				+ (isPaused
					? '<button onclick="resumeRental(\\'' + session.id + '\\',' + assetId + ')" class="btn-touch btn-bounce flex-1 py-3 bg-sk-blue text-white rounded-sk font-display font-bold active:bg-sk-blue-dark" aria-label="Retomar">RETOMAR</button>'
					: '<button onclick="pauseRental(\\'' + session.id + '\\',' + assetId + ')" class="btn-touch btn-bounce flex-1 py-3 bg-sk-yellow text-sk-text rounded-sk font-display font-bold active:bg-sk-yellow-dark" aria-label="Pausar">PAUSAR</button>')
				+ '<button onclick="stopRental(\\'' + session.id + '\\',' + assetId + ')" class="btn-touch btn-bounce flex-1 py-3 bg-sk-danger text-white rounded-sk font-display font-bold active:bg-red-700" aria-label="Parar">PARAR</button>'
				+ '</div>'
				+ (canExtend ? '<button onclick="showExtendModal(\\'' + session.id + '\\',' + assetId + ')" class="btn-touch btn-bounce w-full mt-1 py-2 bg-sk-purple-light text-sk-purple rounded-sk text-xs font-display font-medium active:bg-purple-200">+ Estender</button>' : '');
			var pkgName = card.querySelector('.package-name');
			if (pkgName) pkgName.textContent = session.package_name || '';
		}
	}

	// Polling: sync with server every 30 seconds
	setInterval(function() {
		api('GET', '/rentals/active').then(function(sessions) {
			var newMap = {};
			sessions.forEach(function(s) { newMap[s.asset_id] = s; });
			window.__SK_SESSIONS__ = newMap;
			saveLocal();
		}).catch(function() {});
	}, 30000);

	// Online/offline detection
	function updateOnlineStatus() {
		var el = document.getElementById('online-status');
		if (!el) return;
		if (navigator.onLine) {
			el.innerHTML = '<span class="w-2 h-2 rounded-full bg-sk-green"></span> Online';
		} else {
			el.innerHTML = '<span class="w-2 h-2 rounded-full bg-sk-danger"></span> Offline';
		}
	}
	window.addEventListener('online', updateOnlineStatus);
	window.addEventListener('offline', updateOnlineStatus);

	// Initial timer update
	updateTimerDisplays();
})();
`;
