import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Asset, Battery, Package, RentalSessionView } from "../../db/schema";
import type { CashStatusBadge } from "../../lib/cash-status";
import { Layout } from "../layout";
import { AssetCard } from "./asset-card";
import { PackageSelector } from "./package-selector";
import { PaymentModal } from "./payment-modal";
import { ExtendModal } from "./extend-modal";
import { IdentificationForm } from "./identification-form";
import { BatterySwapModal } from "./battery-swap-modal";

interface DashboardProps {
	assets: Asset[];
	packages: Package[];
	sessions: RentalSessionView[];
	user?: { name: string; role: string } | null;
	cashStatus?: CashStatusBadge | null;
	batteries?: Battery[];
	pageTitle?: string;
}

export const Dashboard: FC<DashboardProps> = ({ assets, packages, sessions, user, cashStatus, batteries, pageTitle }) => {
	const sessionMap = new Map(sessions.map((s) => [s.asset_id, s]));
	const batteryMap = new Map((batteries ?? []).map((b) => [b.asset_id!, b]));

	const dataScript = html`<script>
window.__SK_DATA__ = {
	assets: ${raw(JSON.stringify(assets))},
	packages: ${raw(JSON.stringify(packages))},
	sessions: ${raw(JSON.stringify(sessions))},
	batteries: ${raw(JSON.stringify(batteries ?? []))},
	userRole: ${raw(JSON.stringify(user?.role ?? "operator"))}
};
</script>`;

	const appScript = html`<script>
${raw(timerEngineScript)}
${raw(dashboardControllerScript)}
</script>`;

	return (
		<Layout title={`SpeedKids - ${pageTitle ?? "Dashboard"}`} bodyScripts={html`${dataScript}${appScript}`} user={user} cashStatus={cashStatus}>
			<div id="toast-container" class="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none"></div>
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-2xl font-display font-bold text-sk-text">{pageTitle ? `🎮 ${pageTitle}` : "🎠 Painel de Controle"}</h1>
				<button
					onclick="location.reload()"
					class="btn-touch btn-bounce px-4 py-2 bg-sk-surface rounded-sk shadow-sk-sm text-sm font-body font-medium text-sk-muted active:bg-sk-yellow-light"
				>
					Atualizar
				</button>
			</div>

			<div id="assets-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
				{assets.map((asset) => (
					<AssetCard asset={asset} session={sessionMap.get(asset.id) ?? null} battery={batteryMap.get(asset.id) ?? null} />
				))}
			</div>

			<PackageSelector packages={packages} />
			<IdentificationForm />
			<PaymentModal />
			<BatterySwapModal />

			{/* Battery Level Adjust Modal */}
			<div id="battery-level-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-end sm:items-center justify-center z-50">
				<div class="bg-sk-surface rounded-t-sk-xl sm:rounded-sk-xl shadow-sk-xl w-full max-w-sm p-5 modal-slide-up">
					<div class="flex items-center gap-2 mb-1">
						<span class="text-lg">🔋</span>
						<h3 class="font-display font-bold text-sk-text">Nivel de Bateria</h3>
					</div>
					<p id="bl-subtitle" class="text-sm text-sk-muted font-body mb-4"></p>

					<div class="mb-3">
						<div class="w-full h-5 bg-gray-200 rounded-full overflow-hidden">
							<div id="bl-bar" class="h-full rounded-full bg-sk-green transition-all" style="width:0%"></div>
						</div>
						<div class="flex justify-between mt-1">
							<span id="bl-pct" class="text-base font-display font-bold text-sk-text">0%</span>
							<span id="bl-mins-label" class="text-base font-display font-bold text-sk-muted">0 min</span>
						</div>
					</div>

					<div class="mb-4">
						<input id="bl-slider" type="range" min="0" max="90" value="0" class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-sk-orange" oninput="onBatterySlider(this.value)" />
					</div>

					<div class="grid grid-cols-4 gap-2 mb-3">
						<button onclick="previewBatteryLevel(0.25)" class="btn-touch py-1.5 bg-sk-danger-light text-sk-danger rounded-sk font-display font-bold text-xs active:opacity-70">25%</button>
						<button onclick="previewBatteryLevel(0.50)" class="btn-touch py-1.5 bg-sk-yellow-light text-sk-yellow-dark rounded-sk font-display font-bold text-xs active:opacity-70">50%</button>
						<button onclick="previewBatteryLevel(0.75)" class="btn-touch py-1.5 bg-sk-green-light text-sk-green-dark rounded-sk font-display font-bold text-xs active:opacity-70">75%</button>
						<button onclick="previewBatteryLevel(1.00)" class="btn-touch py-1.5 bg-sk-green-light text-sk-green-dark rounded-sk font-display font-bold text-xs active:opacity-70">100%</button>
					</div>

					<div class="mb-4 flex items-center gap-2">
						<label class="text-sm font-medium text-sk-text font-body whitespace-nowrap">Minutos:</label>
						<input id="bl-minutes" type="number" min="0" class="flex-1 px-3 py-2 border border-sk-border rounded-sk font-body text-center text-lg font-bold focus:ring-sk-blue/30 focus:border-sk-blue" oninput="onBatteryMinutesInput()" />
					</div>

					<div class="flex gap-2">
						<button onclick="saveBatteryLevel()" class="btn-touch flex-1 py-2.5 bg-sk-orange text-white rounded-sk font-display font-bold btn-bounce active:bg-sk-orange-dark">Salvar</button>
						<button onclick="closeBatteryLevel()" class="btn-touch flex-1 py-2.5 bg-gray-200 text-sk-text rounded-sk font-body font-medium active:bg-gray-300">Cancelar</button>
					</div>
				</div>
			</div>

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

// Battery tracking
window.__SK_BATTERIES__ = {};
(window.__SK_DATA__ && window.__SK_DATA__.batteries || []).forEach(function(b) {
	if (b.asset_id) window.__SK_BATTERIES__[b.asset_id] = b;
});
var BATTERY_LOW_THRESHOLD = 15;

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

		// Battery display update
		if (card.dataset.usesBattery === '1') {
			var bat = window.__SK_BATTERIES__[assetId];
			var batteryIndicator = card.querySelector('.battery-indicator');
			if (bat && batteryIndicator) {
				var fillEl = batteryIndicator.querySelector('.battery-fill');
				var minutesEl = batteryIndicator.querySelector('.battery-minutes');
				var iconEl = batteryIndicator.querySelector('.battery-icon');

				// Drain while running
				if (session && session.status === 'running') {
					if (!bat._lastTick) bat._lastTick = Date.now();
					var now = Date.now();
					var delta = (now - bat._lastTick) / 60000;
					bat.estimated_minutes_remaining = Math.max(0, bat.estimated_minutes_remaining - delta);
					bat._lastTick = now;
				} else {
					bat._lastTick = null;
				}

				var pct = bat.full_charge_minutes > 0 ? Math.round((bat.estimated_minutes_remaining / bat.full_charge_minutes) * 100) : 0;
				pct = Math.max(0, Math.min(100, pct));
				var mins = Math.round(bat.estimated_minutes_remaining);

				if (fillEl) {
					fillEl.style.width = pct + '%';
					fillEl.className = 'battery-fill absolute inset-0.5 rounded-sm transition-all ' + (pct > 50 ? 'bg-sk-green' : pct > 25 ? 'bg-sk-yellow' : 'bg-sk-danger');
				}
				if (minutesEl) {
					minutesEl.textContent = mins + ' min';
					minutesEl.className = 'battery-minutes font-display font-medium ' + (pct > 50 ? 'text-sk-green-dark' : pct > 25 ? 'text-sk-yellow-dark' : 'text-sk-danger');
				}

				// Low battery alert
				if (mins <= BATTERY_LOW_THRESHOLD && mins > 0 && session && session.status === 'running') {
					if (!bat._lowAlertShown) {
						bat._lowAlertShown = true;
						if (window.showBatteryAlert) window.showBatteryAlert(assetId, bat.label || 'Bateria', mins);
					}
					if (iconEl) iconEl.classList.add('animate-sk-pulse');
				} else if (iconEl) {
					iconEl.classList.remove('animate-sk-pulse');
				}
			} else if (batteryIndicator) {
				var minutesEl2 = batteryIndicator.querySelector('.battery-minutes');
				if (minutesEl2) { minutesEl2.textContent = 'Sem bateria'; minutesEl2.className = 'battery-minutes font-display font-medium text-gray-400'; }
				var fillEl2 = batteryIndicator.querySelector('.battery-fill');
				if (fillEl2) { fillEl2.style.width = '0%'; fillEl2.className = 'battery-fill absolute inset-0.5 rounded-sm bg-gray-300'; }
			}
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
				if (!r.ok) {
					var err = new Error(data.error || 'Erro ' + r.status);
					err.code = data.code || null;
					throw err;
				}
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

	// ---- Prepaid payment flow ----
	function openPrepaidPayment(customerId, childId) {
		var assetId = window.__SK_SELECTED_ASSET__;
		var packageId = window.__SK_SELECTED_PACKAGE__;
		var pkg = window.__SK_DATA__.packages.find(function(p) { return p.id === packageId; });
		var asset = window.__SK_DATA__.assets.find(function(a) { return a.id === assetId; });

		window.__SK_PREPAID__ = { customerId: customerId, childId: childId, assetId: assetId, packageId: packageId };
		window.__SK_DISCOUNT__ = 0;

		// Populate prepaid summary
		var childEl = document.getElementById('pay-child');
		var guardianEl = document.getElementById('pay-guardian');
		var assetEl = document.getElementById('pay-asset');
		var timeEl = document.getElementById('pay-time');
		if (childEl) childEl.textContent = '';
		if (guardianEl) guardianEl.textContent = '';
		if (assetEl) assetEl.textContent = asset ? '\\u{1F3CE}\\u{FE0F} ' + asset.name + (pkg ? ' \\u{00B7} ' + pkg.name : '') : '';
		if (timeEl) timeEl.textContent = pkg ? '\\u{23F1} ' + pkg.duration_minutes + ' min' : '';

		// Set amount
		var amount = pkg ? pkg.price_cents : 0;
		document.getElementById('payment-amount').textContent = fmtBRL(amount);
		var origEl = document.getElementById('payment-original');
		if (origEl) origEl.classList.add('hidden');

		// Hide overtime breakdown for prepaid
		var otEl = document.getElementById('payment-overtime-breakdown');
		if (otEl) otEl.classList.add('hidden');

		// Hide discount fields
		var discFields = document.getElementById('discount-fields');
		if (discFields) discFields.classList.add('hidden');
		var discRemove = document.getElementById('discount-remove-btn');
		if (discRemove) discRemove.classList.add('hidden');

		// Hide no-register warning (we check on start)
		var noRegEl = document.getElementById('payment-no-register');
		if (noRegEl) noRegEl.classList.add('hidden');

		// Create a fake session for payment handling
		window.__SK_PAYING_SESSION__ = {
			id: null,
			asset_id: assetId,
			amount_cents: amount,
			child_name: null,
			customer_name: null,
			asset_name: asset ? asset.name : '',
			package_name: pkg ? pkg.name : '',
			_prepaid: true
		};

		showPaymentScreen('main');
		setPaymentButtonsEnabled(true);
		document.getElementById('payment-modal').classList.remove('hidden');
	}

	window.startRental = function(customerId, childId, paymentData) {
		var assetId = window.__SK_SELECTED_ASSET__;
		var packageId = window.__SK_SELECTED_PACKAGE__;
		var body = { asset_id: assetId, package_id: packageId };
		if (customerId) body.customer_id = customerId;
		if (childId) body.child_id = childId;
		if (paymentData) {
			body.paid = true;
			if (paymentData.payments) {
				body.payments = paymentData.payments;
			} else {
				body.payment_method = paymentData.payment_method;
				if (paymentData.payment_denominations) body.payment_denominations = paymentData.payment_denominations;
				if (paymentData.change_denominations) body.change_denominations = paymentData.change_denominations;
			}
		}

		api('POST', '/rentals/start', body)
			.then(function(session) {
				window.__SK_SESSIONS__[assetId] = session;
				saveLocal();
				updateCard(assetId, session);
				if (typeof triggerConfetti === 'function') triggerConfetti();
			})
			.catch(function(err) {
				if (err.code === 'NO_REGISTER') {
					alert('Caixa fechado! Abra o caixa antes de iniciar uma locacao.');
					window.location.href = '/cash';
					return;
				}
				alert('Erro ao iniciar: ' + err.message);
			});
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
		['payment-confirm-stop','payment-main','payment-split','payment-cash','payment-waive','payment-success'].forEach(function(id) {
			var el = document.getElementById(id);
			if (el) el.classList.toggle('hidden', id !== 'payment-' + screen);
		});
		// Reset split breakdown visibility on success screen (split success will re-show it)
		if (screen === 'success') {
			var splitBreak = document.getElementById('success-split-breakdown');
			if (splitBreak) splitBreak.classList.add('hidden');
		}
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
				if (btn) btn.disabled = false;

				// If prepaid and no overtime → skip payment, go straight to completion
				if (session.prepaid && session.overtime_cents === 0) {
					delete window.__SK_SESSIONS__[pending.assetId];
					saveLocal();
					updateCard(pending.assetId, null);
					window.__SK_STOP_PENDING__ = null;
					document.getElementById('payment-modal').classList.add('hidden');
					if (typeof triggerConfetti === 'function') triggerConfetti();
					return;
				}

				// If prepaid but has overtime → show payment only for overtime amount
				if (session.prepaid && session.overtime_cents > 0) {
					window.__SK_PAYING_SESSION__ = session;
					window.__SK_PAYING_SESSION__.amount_cents = session.overtime_cents;
					window.__SK_PAYING_SESSION__._overtime_only = true;
					window.__SK_STOP_PENDING__ = null;
					populatePaymentSummary(session);
					var amtEl = document.getElementById('payment-amount');
					if (amtEl) amtEl.textContent = fmtBRL(session.overtime_cents);
					showPaymentScreen('main');
					setPaymentButtonsEnabled(true);
					return;
				}

				window.__SK_PAYING_SESSION__ = session;
				window.__SK_STOP_PENDING__ = null;
				populatePaymentSummary(session);
				showPaymentScreen('main');
				setPaymentButtonsEnabled(true);
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

		// Prepaid mode: start rental with payment
		if (session._prepaid) {
			if (method === 'cash') {
				var amountDue = session.amount_cents;
				window.__SK_CASH_AMOUNT_DUE__ = amountDue;
				document.getElementById('cash-amount-due').textContent = fmtBRL(amountDue);
				clearDenomInputs('pay');
				var changeDisplay = document.getElementById('pay-change-display');
				if (changeDisplay) changeDisplay.classList.add('hidden');
				document.getElementById('cash-confirm-btn').disabled = true;
				showPaymentScreen('cash');
				return;
			}
			// Non-cash prepaid: start rental directly
			setPaymentButtonsEnabled(false);
			var prepaid = window.__SK_PREPAID__;
			window.__SK_SELECTED_ASSET__ = prepaid.assetId;
			window.__SK_SELECTED_PACKAGE__ = prepaid.packageId;
			startRental(prepaid.customerId, prepaid.childId, { payment_method: method });
			// Show success
			var labels = { cash:'Dinheiro', pix:'PIX', debit:'Debito', credit:'Credito' };
			document.getElementById('success-amount').textContent = fmtBRL(session.amount_cents);
			document.getElementById('success-method').textContent = labels[method] || method;
			document.getElementById('success-detail').textContent = session.asset_name || '';
			var successChange = document.getElementById('success-change');
			if (successChange) successChange.classList.add('hidden');
			showPaymentScreen('success');
			return;
		}

		if (method === 'cash') {
			// Show denomination screen for cash payments
			window.__SK_SPLIT_DENOM_MODE__ = false;
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
		var confirmBtn = document.getElementById('cash-confirm-btn');
		var changeDisplay = document.getElementById('pay-change-display');
		var changeAmountEl = document.getElementById('pay-change-amount');
		var breakdownEl = document.getElementById('pay-change-breakdown');
		var impossibleEl = document.getElementById('pay-change-impossible');

		// Split denomination mode: accept any amount > 0, no change
		if (window.__SK_SPLIT_DENOM_MODE__) {
			if (changeDisplay) changeDisplay.classList.add('hidden');
			if (confirmBtn) confirmBtn.disabled = received <= 0;
			return;
		}

		var changeAmt = received - due;
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

		var btn = document.getElementById('cash-confirm-btn');
		if (btn) btn.disabled = true;

		// Split payment cash: save denomination data and return to split screen
		if (window.__SK_SPLIT_CASH_ROW__) {
			var cashRowData = window.__SK_SPLIT_CASH_ROW__;
			cashRowData.payDenoms = payDenoms;
			cashRowData.changeDenoms = {};
			// Cash portion = exact amount of bills inserted
			var centsInput = document.getElementById('split-cents-' + cashRowData.idx);
			if (centsInput) centsInput.value = String(received);
			// Show total on the cash row
			var totalEl = document.getElementById('split-cash-total-' + cashRowData.idx);
			if (totalEl) {
				totalEl.textContent = fmtBRL(received);
				totalEl.classList.remove('hidden');
			}
			window.__SK_SPLIT_DENOM_MODE__ = false;
			if (btn) btn.disabled = false;
			updateSplitRemaining();
			showPaymentScreen('split');
			return;
		}

		// Split payment final submit (legacy path, kept for safety)
		if (window.__SK_SPLIT_DATA__) {
			var rows = window.__SK_SPLIT_DATA__;
			for (var i = 0; i < rows.length; i++) {
				if (rows[i].method === 'cash') {
					rows[i].payment_denominations = payDenoms;
					rows[i].change_denominations = changeDenoms;
					break;
				}
			}
			submitSplitPayment(rows);
			if (btn) btn.disabled = false;
			return;
		}

		// Prepaid cash: start rental with payment data
		if (session._prepaid) {
			var prepaid = window.__SK_PREPAID__;
			window.__SK_SELECTED_ASSET__ = prepaid.assetId;
			window.__SK_SELECTED_PACKAGE__ = prepaid.packageId;
			startRental(prepaid.customerId, prepaid.childId, {
				payment_method: 'cash',
				payment_denominations: payDenoms,
				change_denominations: changeDenoms
			});

			document.getElementById('success-amount').textContent = fmtBRL(session.amount_cents);
			document.getElementById('success-method').textContent = 'Dinheiro';
			document.getElementById('success-detail').textContent = session.asset_name || '';

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
			if (btn) btn.disabled = false;
			return;
		}

		var body = {
			payment_method: 'cash',
			payment_denominations: payDenoms,
			change_denominations: changeDenoms,
		};
		if (discount > 0) body.discount_cents = discount;

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
		window.__SK_SPLIT_DENOM_MODE__ = false;
		if (window.__SK_SPLIT_CASH_ROW__ || window.__SK_SPLIT_DATA__) {
			showPaymentScreen('split');
		} else {
			showPaymentScreen('main');
		}
	};

	// ---- Split Payment ----
	var SPLIT_METHODS = [
		{ key: 'cash', label: 'DIN', bg: 'bg-sk-green-light', border: 'border-sk-green', text: 'text-sk-green-dark' },
		{ key: 'pix', label: 'PIX', bg: 'bg-sk-purple-light', border: 'border-sk-purple', text: 'text-sk-purple' },
		{ key: 'debit', label: 'DEB', bg: 'bg-sk-blue-light', border: 'border-sk-blue', text: 'text-sk-blue-dark' },
		{ key: 'credit', label: 'CRE', bg: 'bg-sk-yellow-light', border: 'border-sk-yellow', text: 'text-sk-yellow-dark' }
	];
	var METHOD_LABELS = { cash: 'Dinheiro', pix: 'PIX', debit: 'Debito', credit: 'Credito' };

	function buildSplitRowHtml(idx) {
		var btns = '';
		for (var m = 0; m < SPLIT_METHODS.length; m++) {
			var sm = SPLIT_METHODS[m];
			btns += '<button type="button" onclick="selectSplitMethod(' + idx + ',\\'' + sm.key + '\\')" '
				+ 'id="split-btn-' + idx + '-' + sm.key + '" '
				+ 'class="split-method-btn px-3 py-2 rounded-sk text-xs font-display font-bold border-2 border-gray-200 bg-gray-50 text-sk-muted">'
				+ sm.label + '</button>';
		}
		var removeBtn = '';
		if (idx >= 2) {
			removeBtn = '<button type="button" onclick="removeSplitRow(' + idx + ')" class="text-sk-danger text-xs hover:underline font-body">Remover</button>';
		}
		return '<div id="split-row-' + idx + '" class="bg-gray-50 rounded-sk p-3 space-y-2" data-split-idx="' + idx + '">'
			+ '<div class="flex items-center justify-between">'
			+ '<span class="text-xs font-display font-semibold text-sk-muted">Pagamento ' + (idx + 1) + '</span>'
			+ removeBtn
			+ '</div>'
			+ '<div class="flex gap-2">' + btns + '</div>'
			// Value input for non-cash methods
			+ '<div id="split-value-' + idx + '" class="flex items-center gap-2">'
			+ '<span class="text-sm font-body text-sk-muted">R$</span>'
			+ '<input type="text" id="split-amount-' + idx + '" value="0,00" '
			+ 'oninput="onSplitAmountInput(this,' + idx + ')" '
			+ 'onfocus="this.select()" '
			+ 'class="flex-1 px-3 py-2 border border-sk-border rounded-sk text-sm font-body text-right focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20" '
			+ 'inputmode="numeric" />'
			+ '<input type="hidden" id="split-cents-' + idx + '" value="0" />'
			+ '</div>'
			// Cash denomination button (hidden by default)
			+ '<div id="split-cash-' + idx + '" class="hidden">'
			+ '<button type="button" onclick="openSplitDenomination(' + idx + ')" '
			+ 'class="btn-touch w-full py-3 bg-sk-green-light border-2 border-sk-green/30 rounded-sk font-display font-bold text-sm text-sk-green-dark active:bg-sk-green/20">'
			+ '\\u{1F4B5} Inserir cedulas</button>'
			+ '<div id="split-cash-total-' + idx + '" class="hidden mt-1 text-center text-sm font-body font-medium text-sk-green-dark"></div>'
			+ '</div>'
			+ '</div>';
	}

	window.openSplitPayment = function() {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;
		var discount = window.__SK_DISCOUNT__ || 0;
		var total = session.amount_cents - discount;
		window.__SK_SPLIT_TOTAL__ = total;
		window.__SK_SPLIT_COUNT__ = 2;
		window.__SK_SPLIT_DATA__ = null;
		window.__SK_SPLIT_CASH_ROW__ = null;

		document.getElementById('split-total-amount').textContent = fmtBRL(total);

		var container = document.getElementById('split-rows');
		container.innerHTML = buildSplitRowHtml(0) + buildSplitRowHtml(1);

		updateSplitRemaining();
		document.getElementById('split-add-btn').classList.remove('hidden');
		showPaymentScreen('split');
	};

	window.cancelSplitPayment = function() {
		window.__SK_SPLIT_DATA__ = null;
		showPaymentScreen('main');
	};

	window.addSplitRow = function() {
		var count = window.__SK_SPLIT_COUNT__ || 2;
		if (count >= 4) return;
		var container = document.getElementById('split-rows');
		var div = document.createElement('div');
		div.innerHTML = buildSplitRowHtml(count);
		container.appendChild(div.firstChild);
		window.__SK_SPLIT_COUNT__ = count + 1;
		if (count + 1 >= 4) {
			document.getElementById('split-add-btn').classList.add('hidden');
		}
		updateSplitRemaining();
	};

	window.removeSplitRow = function(idx) {
		var el = document.getElementById('split-row-' + idx);
		if (el) el.remove();
		updateSplitRemaining();
	};

	window.selectSplitMethod = function(idx, method) {
		for (var m = 0; m < SPLIT_METHODS.length; m++) {
			var sm = SPLIT_METHODS[m];
			var btn = document.getElementById('split-btn-' + idx + '-' + sm.key);
			if (!btn) continue;
			if (sm.key === method) {
				btn.className = 'split-method-btn px-3 py-2 rounded-sk text-xs font-display font-bold border-2 ' + sm.border + ' ' + sm.bg + ' ' + sm.text;
				btn.dataset.selected = '1';
			} else {
				btn.className = 'split-method-btn px-3 py-2 rounded-sk text-xs font-display font-bold border-2 border-gray-200 bg-gray-50 text-sk-muted';
				btn.dataset.selected = '';
			}
		}
		// Toggle value input vs cash denomination button
		var valueEl = document.getElementById('split-value-' + idx);
		var cashEl = document.getElementById('split-cash-' + idx);
		if (valueEl && cashEl) {
			if (method === 'cash') {
				valueEl.classList.add('hidden');
				cashEl.classList.remove('hidden');
				// Reset cents for this row (will be set by denomination screen)
				document.getElementById('split-cents-' + idx).value = '0';
			} else {
				valueEl.classList.remove('hidden');
				cashEl.classList.add('hidden');
				// Clear any denomination data for this row
				if (window.__SK_SPLIT_CASH_ROW__ && window.__SK_SPLIT_CASH_ROW__.idx == idx) {
					window.__SK_SPLIT_CASH_ROW__ = null;
				}
			}
		}
		updateSplitRemaining();
	};

	window.onSplitAmountInput = function(el, idx) {
		var digits = el.value.replace(/\\D/g, '');
		var cents = parseInt(digits, 10) || 0;
		document.getElementById('split-cents-' + idx).value = String(cents);
		el.value = (cents / 100).toFixed(2).replace('.', ',');
		updateSplitRemaining();
	};

	// ---- Split denomination flow ----
	window.openSplitDenomination = function(idx) {
		// Store which split row we're editing
		window.__SK_SPLIT_CASH_ROW__ = { idx: idx, payDenoms: null, changeDenoms: null };
		window.__SK_SPLIT_DENOM_MODE__ = true;
		// Show remaining balance as reference (not enforced)
		var total = window.__SK_SPLIT_TOTAL__ || 0;
		var rows = getSplitRows();
		var otherSum = 0;
		for (var i = 0; i < rows.length; i++) {
			if (rows[i].idx != idx) otherSum += rows[i].amount_cents;
		}
		var cashMax = total - otherSum;
		window.__SK_CASH_AMOUNT_DUE__ = 0; // no minimum enforced in split mode
		document.getElementById('cash-amount-due').textContent = fmtBRL(cashMax) + ' (restante)';
		clearDenomInputs('pay');
		var changeDisplay = document.getElementById('pay-change-display');
		if (changeDisplay) changeDisplay.classList.add('hidden');
		document.getElementById('cash-confirm-btn').disabled = true;
		showPaymentScreen('cash');
	};

	function getSplitRows() {
		var rows = [];
		var container = document.getElementById('split-rows');
		var rowEls = container.querySelectorAll('[data-split-idx]');
		for (var i = 0; i < rowEls.length; i++) {
			var el = rowEls[i];
			var idx = el.dataset.splitIdx;
			var method = null;
			var methodBtns = el.querySelectorAll('.split-method-btn');
			for (var j = 0; j < methodBtns.length; j++) {
				if (methodBtns[j].dataset.selected === '1') {
					method = SPLIT_METHODS[j].key;
					break;
				}
			}
			var centsInput = document.getElementById('split-cents-' + idx);
			var amountCents = centsInput ? parseInt(centsInput.value, 10) || 0 : 0;
			var row = { method: method, amount_cents: amountCents, idx: idx };
			// Attach denomination data if available from cash flow
			var cashRow = window.__SK_SPLIT_CASH_ROW__;
			if (cashRow && cashRow.idx == idx && cashRow.payDenoms) {
				row.payment_denominations = cashRow.payDenoms;
				row.change_denominations = cashRow.changeDenoms || {};
			}
			rows.push(row);
		}
		return rows;
	}

	function updateSplitRemaining() {
		var total = window.__SK_SPLIT_TOTAL__ || 0;
		var rows = getSplitRows();
		var sum = 0;
		for (var i = 0; i < rows.length; i++) sum += rows[i].amount_cents;
		var remaining = total - sum;
		var remainingEl = document.getElementById('split-remaining');
		var boxEl = document.getElementById('split-remaining-box');
		if (remainingEl) remainingEl.textContent = fmtBRL(Math.max(0, remaining));
		if (boxEl) {
			if (remaining <= 0) {
				boxEl.className = 'rounded-sk p-3 text-center mb-4 bg-sk-green-light';
				if (remainingEl) {
					remainingEl.className = 'text-xl font-display font-bold text-sk-green-dark';
					remainingEl.textContent = remaining === 0 ? 'R$ 0,00 \\u2713' : fmtBRL(0);
				}
			} else {
				boxEl.className = 'rounded-sk p-3 text-center mb-4 bg-sk-danger-light';
				if (remainingEl) remainingEl.className = 'text-xl font-display font-bold text-sk-danger';
			}
		}
		var confirmBtn = document.getElementById('split-confirm-btn');
		if (confirmBtn) confirmBtn.disabled = remaining !== 0;
	}

	window.confirmSplitPayment = function() {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;
		var rows = getSplitRows();
		// Validate
		for (var i = 0; i < rows.length; i++) {
			if (!rows[i].method) { alert('Selecione a forma de pagamento para cada parcela.'); return; }
			if (rows[i].amount_cents <= 0) {
				if (rows[i].method === 'cash') {
					alert('Insira as cedulas para o pagamento em dinheiro.');
				} else {
					alert('Informe o valor de cada parcela.');
				}
				return;
			}
		}
		var total = window.__SK_SPLIT_TOTAL__ || 0;
		var sum = 0;
		for (var i = 0; i < rows.length; i++) sum += rows[i].amount_cents;
		if (sum !== total) { alert('A soma dos pagamentos deve ser igual ao total.'); return; }

		// Submit directly (cash denomination data already attached via getSplitRows)
		submitSplitPayment(rows);
	};

	function submitSplitPayment(rows) {
		var session = window.__SK_PAYING_SESSION__;
		if (!session) return;
		var discount = window.__SK_DISCOUNT__ || 0;
		var payments = [];
		for (var i = 0; i < rows.length; i++) {
			var p = { method: rows[i].method, amount_cents: rows[i].amount_cents };
			if (rows[i].payment_denominations) p.payment_denominations = rows[i].payment_denominations;
			if (rows[i].change_denominations) p.change_denominations = rows[i].change_denominations;
			payments.push(p);
		}

		// Prepaid split
		if (session._prepaid) {
			var prepaid = window.__SK_PREPAID__;
			window.__SK_SELECTED_ASSET__ = prepaid.assetId;
			window.__SK_SELECTED_PACKAGE__ = prepaid.packageId;
			startRental(prepaid.customerId, prepaid.childId, { payments: payments });
			showSplitSuccess(payments, session);
			window.__SK_SPLIT_DATA__ = null;
			return;
		}

		// Post-rental split payment
		var body = { payment_method: 'mixed', payments: payments };
		if (discount > 0) body.discount_cents = discount;

		api('POST', '/rentals/' + session.id + '/pay', body)
			.then(function() {
				delete window.__SK_SESSIONS__[session.asset_id];
				saveLocal();
				updateCard(session.asset_id, null);
				showSplitSuccess(payments, session);
				window.__SK_SPLIT_DATA__ = null;
			})
			.catch(function(err) {
				alert('Erro ao registrar pagamento: ' + (err.message || 'Erro'));
			});
	}

	function showSplitSuccess(payments, session) {
		var total = 0;
		for (var i = 0; i < payments.length; i++) total += payments[i].amount_cents;

		// Show success screen first (this resets split breakdown to hidden)
		showPaymentScreen('success');

		document.getElementById('success-amount').textContent = fmtBRL(total);
		document.getElementById('success-method').textContent = 'Misto';
		document.getElementById('success-detail').textContent =
			session._prepaid ? (session.asset_name || '') : ((session.child_name || 'Cliente') + ' \\u{00B7} ' + (session.asset_name || ''));

		// Build breakdown
		var breakdownEl = document.getElementById('success-split-breakdown');
		if (breakdownEl) {
			var html = '';
			for (var i = 0; i < payments.length; i++) {
				var label = METHOD_LABELS[payments[i].method] || payments[i].method;
				html += '<div class="flex justify-between"><span class="text-sk-muted">' + label + '</span><span class="font-medium text-sk-text">' + fmtBRL(payments[i].amount_cents) + '</span></div>';
			}
			breakdownEl.innerHTML = html;
			breakdownEl.classList.remove('hidden');
		}

		// Show change info if cash had change
		var successChange = document.getElementById('success-change');
		var cashRowData = window.__SK_SPLIT_CASH_ROW__;
		if (cashRowData && cashRowData.payDenoms && successChange) {
			var cashReceived = denomMapTotal(cashRowData.payDenoms);
			var cashDue = 0;
			for (var i = 0; i < payments.length; i++) {
				if (payments[i].method === 'cash') { cashDue = payments[i].amount_cents; break; }
			}
			var cashChange = cashReceived - cashDue;
			if (cashChange > 0) {
				document.getElementById('success-change-amount').textContent = fmtBRL(cashChange);
				var brkHtml = renderChangeCards(cashRowData.changeDenoms || {});
				var brkEl = document.getElementById('success-change-breakdown');
				if (brkEl) brkEl.innerHTML = brkHtml;
				var impEl = document.getElementById('success-change-impossible');
				if (impEl) impEl.classList.toggle('hidden', brkHtml.length > 0);
				successChange.classList.remove('hidden');
			} else {
				successChange.classList.add('hidden');
			}
		} else if (successChange) {
			successChange.classList.add('hidden');
		}
		window.__SK_SPLIT_CASH_ROW__ = null;
	}

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

		// Populate CPF and Instagram if available
		var cpfEl = document.getElementById('id-cpf');
		if (cpfEl && customer.cpf) {
			// Format CPF for display
			var raw = customer.cpf.replace(/\\D/g, '');
			var masked = '';
			if (raw.length > 0) masked += raw.substring(0, 3);
			if (raw.length > 3) masked += '.' + raw.substring(3, 6);
			if (raw.length > 6) masked += '.' + raw.substring(6, 9);
			if (raw.length > 9) masked += '-' + raw.substring(9, 11);
			cpfEl.value = masked;
		}
		var igEl = document.getElementById('id-instagram');
		if (igEl && customer.instagram) igEl.value = '@' + customer.instagram;

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

	window.onCpfInput = function(el) {
		var raw = el.value.replace(/\\D/g, '');
		if (raw.length > 11) raw = raw.substring(0, 11);
		var masked = '';
		if (raw.length > 0) masked += raw.substring(0, 3);
		if (raw.length > 3) masked += '.' + raw.substring(3, 6);
		if (raw.length > 6) masked += '.' + raw.substring(6, 9);
		if (raw.length > 9) masked += '-' + raw.substring(9, 11);
		el.value = masked;
	};

	window.toggleAdvancedFields = function() {
		var fields = document.getElementById('id-advanced-fields');
		var arrow = document.getElementById('id-advanced-arrow');
		if (fields.classList.contains('hidden')) {
			fields.classList.remove('hidden');
			if (arrow) arrow.innerHTML = '&#9662;';
		} else {
			fields.classList.add('hidden');
			if (arrow) arrow.innerHTML = '&#9656;';
		}
	};

	function openIdentificationModal() {
		__idState = { customerId: null, childId: null, children: [], isReturning: false };
		document.getElementById('id-phone').value = '';
		document.getElementById('id-guardian-name').value = '';
		document.getElementById('id-guardian-name').classList.remove('bg-sk-yellow-light');
		document.getElementById('id-cpf').value = '';
		var igEl = document.getElementById('id-instagram');
		if (igEl) igEl.value = '';
		var advFields = document.getElementById('id-advanced-fields');
		if (advFields) advFields.classList.add('hidden');
		var advArrow = document.getElementById('id-advanced-arrow');
		if (advArrow) advArrow.innerHTML = '&#9656;';
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
		var cpfRaw = document.getElementById('id-cpf').value.replace(/\\D/g, '');
		var igEl = document.getElementById('id-instagram');
		var instagram = igEl ? igEl.value.replace(/^@/, '').trim() : '';

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
			var quickData = { name: guardianName, phone: phone };
			if (cpfRaw) quickData.cpf = cpfRaw;
			if (instagram) quickData.instagram = instagram;
			customerPromise = api('POST', '/customers/quick', quickData)
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
				// Open prepaid payment modal instead of starting immediately
				openPrepaidPayment(result.customerId, result.childId);
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
		// Sync battery data
		api('GET', '/batteries/installed').then(function(bats) {
			var batMap = {};
			bats.forEach(function(b) { if (b.asset_id) batMap[b.asset_id] = b; });
			window.__SK_BATTERIES__ = batMap;
		}).catch(function() {});
	}, 30000);

	// ---- Battery Toast Alert ----
	window.showBatteryAlert = function(assetId, batteryLabel, mins) {
		var container = document.getElementById('toast-container');
		if (!container) return;
		var asset = (window.__SK_DATA__.assets || []).find(function(a) { return a.id === assetId; });
		var assetName = asset ? asset.name : 'Ativo #' + assetId;
		var toast = document.createElement('div');
		toast.className = 'pointer-events-auto bg-sk-danger text-white px-4 py-3 rounded-sk shadow-sk-md font-body text-sm modal-slide-up max-w-xs';
		toast.innerHTML = '<div class="font-display font-bold">\\u{1F50B} Bateria Baixa!</div>'
			+ '<div>' + assetName + ' \\u{2014} ' + batteryLabel + '</div>'
			+ '<div class="text-white/80 text-xs mt-0.5">' + mins + ' min restantes</div>';
		container.appendChild(toast);
		setTimeout(function() {
			toast.style.opacity = '0';
			toast.style.transition = 'opacity 0.3s';
			setTimeout(function() { toast.remove(); }, 300);
		}, 8000);
	};

	// ---- Battery Swap / Install / Remove ----
	window.showBatterySwap = function(assetId) {
		var bat = window.__SK_BATTERIES__[assetId];
		var asset = (window.__SK_DATA__.assets || []).find(function(a) { return a.id === assetId; });
		window.__SK_SWAP_ASSET_ID__ = assetId;
		window.__SK_SWAP_OLD_BATTERY__ = bat ? bat.id : null;

		var titleEl = document.getElementById('swap-modal-title');
		var nameEl = document.getElementById('swap-asset-name');
		if (nameEl) nameEl.textContent = asset ? asset.name : '';

		var currentSection = document.getElementById('swap-current-section');
		var noCurrent = document.getElementById('swap-no-current');
		var listTitle = document.getElementById('swap-list-title');
		var removeBtn = document.getElementById('swap-remove-btn');

		if (bat) {
			if (titleEl) titleEl.textContent = 'Trocar Bateria';
			if (currentSection) currentSection.classList.remove('hidden');
			if (noCurrent) noCurrent.classList.add('hidden');
			if (listTitle) listTitle.textContent = 'Trocar por outra bateria:';

			var pct = bat.full_charge_minutes > 0 ? Math.round((bat.estimated_minutes_remaining / bat.full_charge_minutes) * 100) : 0;
			var barColor = pct > 50 ? 'bg-sk-green' : pct > 25 ? 'bg-sk-yellow' : 'bg-sk-danger';
			var borderColor = pct > 50 ? 'border-sk-green bg-sk-green-light/30' : pct > 25 ? 'border-sk-yellow bg-sk-yellow-light/30' : 'border-sk-danger bg-sk-danger-light/30';
			var textColor = pct > 50 ? 'text-sk-green-dark' : pct > 25 ? 'text-sk-yellow-dark' : 'text-sk-danger';

			var currentDiv = document.getElementById('swap-current-battery');
			if (currentDiv) currentDiv.className = 'rounded-sk p-3 border-2 ' + borderColor;
			var label = document.getElementById('swap-current-label');
			if (label) label.textContent = bat.label;
			var pctEl = document.getElementById('swap-current-pct');
			if (pctEl) { pctEl.textContent = pct + '%'; pctEl.className = 'text-sm font-display font-bold ' + textColor; }
			var barEl = document.getElementById('swap-current-bar');
			if (barEl) { barEl.style.width = pct + '%'; barEl.className = 'h-full rounded-full transition-all ' + barColor; }
			var levelEl = document.getElementById('swap-current-level');
			if (levelEl) levelEl.textContent = Math.round(bat.estimated_minutes_remaining) + ' min restantes';

			// Hide remove if session is running on this asset
			var sessions = window.__SK_SESSIONS__ || {};
			var sess = sessions[assetId];
			if (removeBtn) {
				if (sess && (sess.status === 'running' || sess.status === 'paused')) {
					removeBtn.classList.add('hidden');
				} else {
					removeBtn.classList.remove('hidden');
				}
			}
		} else {
			if (titleEl) titleEl.textContent = 'Instalar Bateria';
			if (currentSection) currentSection.classList.add('hidden');
			if (noCurrent) noCurrent.classList.remove('hidden');
			if (listTitle) listTitle.textContent = 'Selecione uma bateria para instalar:';
		}

		var listEl = document.getElementById('swap-battery-list');
		var noneEl = document.getElementById('swap-no-batteries');
		var loadingEl = document.getElementById('swap-loading');
		if (listEl) listEl.innerHTML = '';
		if (noneEl) noneEl.classList.add('hidden');
		if (loadingEl) loadingEl.classList.remove('hidden');

		document.getElementById('battery-swap-modal').classList.remove('hidden');

		api('GET', '/batteries/ready').then(function(batteries) {
			if (loadingEl) loadingEl.classList.add('hidden');
			if (!listEl) return;
			if (batteries.length === 0) {
				if (noneEl) noneEl.classList.remove('hidden');
				return;
			}
			batteries.forEach(function(b) {
				var pct = b.full_charge_minutes > 0 ? Math.round((b.estimated_minutes_remaining / b.full_charge_minutes) * 100) : 0;
				var barColor = pct > 50 ? 'bg-sk-green' : pct > 25 ? 'bg-sk-yellow' : 'bg-sk-danger';
				var colorClass = pct > 50 ? 'border-sk-green bg-sk-green-light/30' : pct > 25 ? 'border-sk-yellow bg-sk-yellow-light/30' : 'border-sk-danger bg-sk-danger-light/30';
				var btn = document.createElement('button');
				btn.className = 'btn-touch p-3 border-2 rounded-sk text-left active:opacity-80 w-full ' + colorClass;
				btn.innerHTML = '<div class="flex items-center justify-between mb-1"><span class="font-display font-bold text-sk-text">' + b.label + '</span><span class="text-xs font-display font-bold ' + (pct > 50 ? 'text-sk-green-dark' : pct > 25 ? 'text-sk-yellow-dark' : 'text-sk-danger') + '">' + pct + '%</span></div>'
					+ '<div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden"><div class="h-full rounded-full ' + barColor + '" style="width:' + pct + '%"></div></div>'
					+ '<div class="text-xs font-body text-sk-muted mt-1">' + Math.round(b.estimated_minutes_remaining) + ' min</div>';
				btn.onclick = function() { confirmBatterySwap(b.id); };
				listEl.appendChild(btn);
			});
		}).catch(function() {
			if (loadingEl) loadingEl.classList.add('hidden');
			alert('Erro ao carregar baterias.');
		});
	};

	window.closeBatterySwap = function() {
		document.getElementById('battery-swap-modal').classList.add('hidden');
	};

	function confirmBatterySwap(newBatteryId) {
		var assetId = window.__SK_SWAP_ASSET_ID__;
		var oldBatteryId = window.__SK_SWAP_OLD_BATTERY__;
		var url = '/batteries/' + (oldBatteryId || 0) + '/swap';
		api('POST', url, { asset_id: assetId, new_battery_id: newBatteryId })
			.then(function(result) {
				if (result && result.battery) {
					window.__SK_BATTERIES__[assetId] = result.battery;
					result.battery._lastTick = null;
					result.battery._lowAlertShown = false;
				}
				closeBatterySwap();
				updateTimerDisplays();
			})
			.catch(function() { alert('Erro ao trocar bateria.'); });
	}

	window.removeBattery = function() {
		var assetId = window.__SK_SWAP_ASSET_ID__;
		var oldBatteryId = window.__SK_SWAP_OLD_BATTERY__;
		if (!oldBatteryId) return;
		if (!confirm('Remover bateria deste ativo?')) return;
		api('POST', '/batteries/' + oldBatteryId + '/uninstall', { asset_id: assetId })
			.then(function() {
				delete window.__SK_BATTERIES__[assetId];
				closeBatterySwap();
				updateTimerDisplays();
			})
			.catch(function() { alert('Erro ao remover bateria.'); });
	};

	// ---- Battery Level Adjust ----
	window.__SK_LEVEL_ASSET_ID__ = null;
	window.__SK_LEVEL_BATTERY_ID__ = null;
	window.__SK_LEVEL_FULL__ = 90;

	window.showBatteryLevel = function(assetId) {
		var bat = window.__SK_BATTERIES__[assetId];
		if (!bat) return;
		var asset = (window.__SK_DATA__.assets || []).find(function(a) { return a.id === assetId; });

		window.__SK_LEVEL_ASSET_ID__ = assetId;
		window.__SK_LEVEL_BATTERY_ID__ = bat.id;
		window.__SK_LEVEL_FULL__ = bat.full_charge_minutes || 90;

		var subtitle = document.getElementById('bl-subtitle');
		if (subtitle) subtitle.textContent = (asset ? asset.name : '') + ' \\u2014 ' + bat.label;

		var slider = document.getElementById('bl-slider');
		if (slider) { slider.max = window.__SK_LEVEL_FULL__; slider.value = Math.round(bat.estimated_minutes_remaining); }
		var input = document.getElementById('bl-minutes');
		if (input) { input.value = Math.round(bat.estimated_minutes_remaining); input.max = window.__SK_LEVEL_FULL__; }
		syncLevelPreview();
		document.getElementById('battery-level-modal').classList.remove('hidden');
	};

	window.previewBatteryLevel = function(fraction) {
		var mins = Math.round(window.__SK_LEVEL_FULL__ * fraction);
		var slider = document.getElementById('bl-slider');
		if (slider) slider.value = mins;
		var input = document.getElementById('bl-minutes');
		if (input) input.value = mins;
		syncLevelPreview();
	};

	window.onBatterySlider = function(val) {
		var mins = parseInt(val, 10) || 0;
		var input = document.getElementById('bl-minutes');
		if (input) input.value = mins;
		syncLevelPreview();
	};

	window.onBatteryMinutesInput = function() {
		var input = document.getElementById('bl-minutes');
		var mins = parseInt(input ? input.value : '0', 10) || 0;
		var slider = document.getElementById('bl-slider');
		if (slider) slider.value = Math.min(mins, window.__SK_LEVEL_FULL__);
		syncLevelPreview();
	};

	function syncLevelPreview() {
		var input = document.getElementById('bl-minutes');
		var mins = parseInt(input ? input.value : '0', 10) || 0;
		var full = window.__SK_LEVEL_FULL__;
		var pct = full > 0 ? Math.min(100, Math.round((mins / full) * 100)) : 0;

		var bar = document.getElementById('bl-bar');
		if (bar) {
			bar.style.width = pct + '%';
			bar.className = 'h-full rounded-full transition-all ' + (pct > 50 ? 'bg-sk-green' : pct > 25 ? 'bg-sk-yellow' : 'bg-sk-danger');
		}
		var pctEl = document.getElementById('bl-pct');
		if (pctEl) pctEl.textContent = pct + '%';
		var minsLabel = document.getElementById('bl-mins-label');
		if (minsLabel) minsLabel.textContent = mins + ' min';
	}

	window.saveBatteryLevel = function() {
		var batteryId = window.__SK_LEVEL_BATTERY_ID__;
		var assetId = window.__SK_LEVEL_ASSET_ID__;
		if (!batteryId) return;

		var input = document.getElementById('bl-minutes');
		var mins = parseInt(input ? input.value : '0', 10) || 0;

		api('POST', '/batteries/' + batteryId + '/level', { estimated_minutes_remaining: mins })
			.then(function(updated) {
				if (updated && assetId) {
					window.__SK_BATTERIES__[assetId] = updated;
					updated._lastTick = null;
					updated._lowAlertShown = false;
				}
				closeBatteryLevel();
				updateTimerDisplays();
			})
			.catch(function() { alert('Erro ao salvar nivel.'); });
	};

	window.closeBatteryLevel = function() {
		document.getElementById('battery-level-modal').classList.add('hidden');
	};

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
