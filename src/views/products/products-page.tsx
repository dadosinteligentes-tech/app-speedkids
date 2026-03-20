import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Product } from "../../db/schema";
import type { CashStatusBadge } from "../../lib/cash-status";
import { Layout } from "../layout";
import { DenominationInput } from "../components/denomination-input";
import { ChangeDisplay } from "../components/change-display";

interface ProductsPageProps {
	products: Product[];
	user: { name: string; role: string } | null;
	cashStatus: CashStatusBadge | null;
}

function fmtPrice(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

export const ProductsPage: FC<ProductsPageProps> = ({ products, user, cashStatus }) => {
	const activeProducts = products.filter((p) => p.active);
	const inactiveProducts = products.filter((p) => !p.active);
	const uniqueCategories = [...new Set(products.filter((p) => p.category).map((p) => p.category!))].sort();

	const script = html`<script>
${raw(`
var PRODUCTS = ${JSON.stringify(products.map((p) => ({ id: p.id, name: p.name, price_cents: p.price_cents, active: p.active, description: p.description ?? "", category: p.category ?? "", sort_order: p.sort_order, photo_url: p.photo_url ?? "" })))};
var CART = {};
var DENOM_VALUES = [20000,10000,5000,2000,1000,500,200,100,50,25,10,5];
var PS_DISCOUNT = 0;
var CURRENT_CATEGORY = '';
var CURRENT_SEARCH = '';
var __PS_CUSTOMER_ID__ = null;
var __PS_SEARCH_TIMER__ = null;
var __PS_MANAGE_MODE__ = false;
var __PF_PHOTO_FILE__ = null;
var __PF_PHOTO_REMOVE__ = false;

function fmtBRL(cents) {
	return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

// ── Search & Filter ──────────────────────────────────────────────
function filterProducts() {
	CURRENT_SEARCH = (document.getElementById('product-search').value || '').toLowerCase();
	applyFilters();
}

function filterByCategory(cat) {
	CURRENT_CATEGORY = cat.toLowerCase();
	var tabs = document.querySelectorAll('.category-tab');
	for (var i = 0; i < tabs.length; i++) {
		var tabCat = tabs[i].getAttribute('data-cat') || '';
		var isActive = tabCat.toLowerCase() === CURRENT_CATEGORY;
		if (isActive) {
			tabs[i].className = 'category-tab px-3 py-1.5 rounded-full text-xs font-display font-medium bg-sk-orange text-white whitespace-nowrap';
		} else {
			tabs[i].className = 'category-tab px-3 py-1.5 rounded-full text-xs font-display font-medium bg-gray-200 text-sk-muted whitespace-nowrap';
		}
	}
	applyFilters();
}

function applyFilters() {
	var cards = document.querySelectorAll('.product-card');
	var visible = 0;
	for (var i = 0; i < cards.length; i++) {
		var name = cards[i].getAttribute('data-name') || '';
		var category = cards[i].getAttribute('data-category') || '';
		var matchesSearch = !CURRENT_SEARCH || name.indexOf(CURRENT_SEARCH) !== -1;
		var matchesCategory = !CURRENT_CATEGORY || category === CURRENT_CATEGORY;
		var show = matchesSearch && matchesCategory;
		cards[i].style.display = show ? '' : 'none';
		if (show) visible++;
	}
	var noResults = document.getElementById('no-filter-results');
	if (noResults) noResults.classList.toggle('hidden', visible > 0);
}

// ── Cart ──────────────────────────────────────────────────────────
function addToCart(id) {
	if (__PS_MANAGE_MODE__) return;
	CART[id] = (CART[id] || 0) + 1;
	updateCartUI();
}
function removeFromCart(id) {
	if (CART[id]) { CART[id]--; if (CART[id] <= 0) delete CART[id]; }
	updateCartUI();
}
function clearCart() {
	CART = {};
	updateCartUI();
	var expanded = document.getElementById('cart-items-expanded');
	if (expanded) expanded.classList.add('hidden');
}

function updateCartUI() {
	var total = 0; var count = 0;
	PRODUCTS.forEach(function(p) {
		var qty = CART[p.id] || 0;
		var badge = document.getElementById('prod-qty-' + p.id);
		var decBtn = document.getElementById('prod-dec-' + p.id);
		if (badge) { badge.textContent = qty; badge.classList.toggle('hidden', qty === 0); }
		if (decBtn) decBtn.classList.toggle('hidden', qty === 0 || __PS_MANAGE_MODE__);
		total += p.price_cents * qty;
		count += qty;
	});
	var bar = document.getElementById('cart-bar');
	if (bar) bar.classList.toggle('hidden', count === 0);
	var el = document.getElementById('cart-total');
	if (el) el.textContent = fmtBRL(total);
	var ce = document.getElementById('cart-count');
	if (ce) ce.textContent = count + (count === 1 ? ' item' : ' itens');
	// Update expanded cart if visible
	var expanded = document.getElementById('cart-items-expanded');
	if (expanded && !expanded.classList.contains('hidden')) updateCartItemsList();
}

function getCartTotal() {
	var total = 0;
	for (var id in CART) { var p = PRODUCTS.find(function(x){return x.id == id;}); if (p) total += p.price_cents * CART[id]; }
	return total;
}

// ── Cart expand ──────────────────────────────────────────────────
function toggleCartExpand() {
	var expanded = document.getElementById('cart-items-expanded');
	if (!expanded) return;
	expanded.classList.toggle('hidden');
	if (!expanded.classList.contains('hidden')) updateCartItemsList();
}

function updateCartItemsList() {
	var container = document.getElementById('cart-items-list');
	if (!container) return;
	var h = '';
	for (var id in CART) {
		var p = PRODUCTS.find(function(x) { return x.id == id; });
		if (!p) continue;
		h += '<div class="flex items-center justify-between text-sm font-body py-1">'
			+ '<div class="flex items-center gap-2">'
			+ '<button onclick="event.stopPropagation();removeFromCart(' + p.id + ')" class="w-6 h-6 rounded-full bg-sk-danger text-white text-xs flex items-center justify-center shrink-0">&minus;</button>'
			+ '<span class="text-sk-text">' + CART[id] + 'x ' + p.name + '</span>'
			+ '</div>'
			+ '<span class="font-medium text-sk-text whitespace-nowrap ml-2">' + fmtBRL(p.price_cents * CART[id]) + '</span>'
			+ '</div>';
	}
	container.innerHTML = h || '<div class="text-center text-sk-muted text-xs py-2">Carrinho vazio</div>';
}

// ── Product CRUD ──────────────────────────────────────────────────
function showProductForm(product) {
	var modal = document.getElementById('product-form-modal');
	document.getElementById('pf-id').value = product ? product.id : '';
	document.getElementById('pf-name').value = product ? product.name : '';
	document.getElementById('pf-price').value = product ? (product.price_cents / 100).toFixed(2) : '';
	document.getElementById('pf-desc').value = product ? (product.description || '') : '';
	document.getElementById('pf-category').value = product ? (product.category || '') : '';
	document.getElementById('pf-title').textContent = product ? 'Editar Produto' : 'Novo Produto';
	// Reset photo state
	__PF_PHOTO_FILE__ = null;
	__PF_PHOTO_REMOVE__ = false;
	var fileInput = document.getElementById('pf-photo');
	if (fileInput) fileInput.value = '';
	var preview = document.getElementById('pf-photo-preview');
	var addBtn = document.getElementById('pf-photo-add-btn');
	var removeBtn = document.getElementById('pf-photo-remove-btn');
	// Show current photo or placeholder
	var photoUrl = product ? product.photo_url : '';
	if (preview) {
		if (photoUrl) {
			preview.innerHTML = '<img src="/api/products/photo/' + photoUrl + '" class="w-20 h-20 object-cover rounded-sk" />';
			preview.classList.remove('hidden');
			if (addBtn) addBtn.textContent = 'Trocar foto';
			if (removeBtn) removeBtn.classList.remove('hidden');
		} else {
			preview.innerHTML = '';
			preview.classList.add('hidden');
			if (addBtn) addBtn.textContent = 'Adicionar foto';
			if (removeBtn) removeBtn.classList.add('hidden');
		}
	}
	modal.classList.remove('hidden');
}
function closeProductForm() { document.getElementById('product-form-modal').classList.add('hidden'); }

function onPhotoSelected(input) {
	if (!input.files || !input.files[0]) return;
	var file = input.files[0];
	if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande. Maximo 2MB'); input.value = ''; return; }
	if (['image/jpeg','image/png','image/webp'].indexOf(file.type) === -1) { alert('Use JPEG, PNG ou WebP'); input.value = ''; return; }
	__PF_PHOTO_FILE__ = file;
	__PF_PHOTO_REMOVE__ = false;
	var preview = document.getElementById('pf-photo-preview');
	var addBtn = document.getElementById('pf-photo-add-btn');
	var removeBtn = document.getElementById('pf-photo-remove-btn');
	if (preview) {
		var reader = new FileReader();
		reader.onload = function(e) {
			preview.innerHTML = '<img src="' + e.target.result + '" class="w-20 h-20 object-cover rounded-sk" />';
			preview.classList.remove('hidden');
		};
		reader.readAsDataURL(file);
	}
	if (addBtn) addBtn.textContent = 'Trocar foto';
	if (removeBtn) removeBtn.classList.remove('hidden');
}

function removeProductPhoto() {
	__PF_PHOTO_FILE__ = null;
	__PF_PHOTO_REMOVE__ = true;
	var fileInput = document.getElementById('pf-photo');
	if (fileInput) fileInput.value = '';
	var preview = document.getElementById('pf-photo-preview');
	if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
	var addBtn = document.getElementById('pf-photo-add-btn');
	if (addBtn) addBtn.textContent = 'Adicionar foto';
	var removeBtn = document.getElementById('pf-photo-remove-btn');
	if (removeBtn) removeBtn.classList.add('hidden');
}

function saveProduct() {
	var id = document.getElementById('pf-id').value;
	var name = document.getElementById('pf-name').value.trim();
	var price = parseFloat(document.getElementById('pf-price').value || '0');
	var desc = document.getElementById('pf-desc').value.trim();
	var category = document.getElementById('pf-category').value.trim();
	if (!name || price <= 0) { alert('Informe nome e preco validos'); return; }
	var payload = { name: name, price_cents: Math.round(price * 100), description: desc || null, category: category || null };
	var url = id ? '/api/products/' + id : '/api/products';
	var method = id ? 'PUT' : 'POST';
	fetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
		.then(function(r) {
			if (!r.ok) return r.json().then(function(d){ alert(d.error||'Erro'); return Promise.reject('err'); });
			return r.json();
		})
		.then(function(product) {
			var productId = product.id || id;
			if (!productId) { location.reload(); return; }
			// Handle photo upload or removal
			if (__PF_PHOTO_FILE__) {
				var fd = new FormData();
				fd.append('photo', __PF_PHOTO_FILE__);
				return fetch('/api/products/' + productId + '/photo', { method: 'POST', body: fd })
					.then(function() { location.reload(); });
			} else if (__PF_PHOTO_REMOVE__ && id) {
				return fetch('/api/products/' + productId + '/photo', { method: 'DELETE' })
					.then(function() { location.reload(); });
			} else {
				location.reload();
			}
		})
		.catch(function(e) { if (e !== 'err') alert('Erro: ' + (e.message || e)); });
}

function toggleProduct(id) {
	fetch('/api/products/' + id + '/toggle', { method: 'PATCH' })
		.then(function(r) { if (r.ok) location.reload(); else alert('Erro'); });
}

// ── Manage mode toggle ────────────────────────────────────────────
function toggleManageMode() {
	__PS_MANAGE_MODE__ = !__PS_MANAGE_MODE__;
	var section = document.getElementById('inactive-section');
	if (section) section.classList.toggle('hidden', !__PS_MANAGE_MODE__);
	var btn = document.getElementById('manage-toggle-btn');
	if (btn) btn.textContent = __PS_MANAGE_MODE__ ? 'Voltar' : 'Gerenciar';
	// Toggle manage overlays on active product cards
	var overlays = document.querySelectorAll('.manage-actions');
	for (var i = 0; i < overlays.length; i++) {
		overlays[i].classList.toggle('hidden', !__PS_MANAGE_MODE__);
	}
	// Hide minus buttons in manage mode
	PRODUCTS.forEach(function(p) {
		var decBtn = document.getElementById('prod-dec-' + p.id);
		if (decBtn && __PS_MANAGE_MODE__) decBtn.classList.add('hidden');
	});
}

// ── Denomination helpers (same as cash register) ──────────────────
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
	var total = 0; for (var k in map) total += Number(k) * (map[k] || 0); return total;
}
function updateDenomBadge(prefix, cents) {
	var input = document.getElementById(prefix + '-d-' + cents);
	var badge = document.getElementById(prefix + '-badge-' + cents);
	var decBtn = document.getElementById(prefix + '-dec-' + cents);
	var val = input ? parseInt(input.value, 10) || 0 : 0;
	if (badge) { badge.textContent = val; badge.classList.toggle('hidden', val === 0); if (val > 0) { badge.style.animation = 'none'; badge.offsetHeight; badge.style.animation = 'badge-pop 0.2s ease-out'; } }
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
	if (prefix === 'ps-cash') updateCashChange();
}

// ── Customer search ──────────────────────────────────────────────
function searchPsCustomer(query) {
	if (__PS_SEARCH_TIMER__) clearTimeout(__PS_SEARCH_TIMER__);
	var resultsEl = document.getElementById('ps-customer-results');
	if (query.length < 2) { resultsEl.classList.add('hidden'); return; }
	__PS_SEARCH_TIMER__ = setTimeout(function() {
		fetch('/api/customers/search?q=' + encodeURIComponent(query))
			.then(function(r) { return r.json(); })
			.then(function(customers) {
				if (!customers || customers.length === 0) {
					resultsEl.innerHTML = '<div class="px-3 py-2 text-xs text-sk-muted font-body">Nenhum cliente encontrado</div>';
				} else {
					var h = '';
					for (var i = 0; i < customers.length; i++) {
						var c = customers[i];
						var safeName = c.name.replace(/'/g, "\\\\'");
						h += '<button type="button" onclick="selectPsCustomer(' + c.id + ',\\'' + safeName + '\\')" '
							+ 'class="w-full text-left px-3 py-2 hover:bg-sk-yellow-light text-sm font-body border-b border-gray-100">'
							+ '<span class="font-medium text-sk-text">' + c.name + '</span>'
							+ (c.phone ? ' <span class="text-xs text-sk-muted">' + c.phone + '</span>' : '')
							+ '</button>';
					}
					resultsEl.innerHTML = h;
				}
				resultsEl.classList.remove('hidden');
			});
	}, 300);
}

function selectPsCustomer(id, name) {
	__PS_CUSTOMER_ID__ = id;
	document.getElementById('ps-customer-name').textContent = name;
	document.getElementById('ps-customer-selected').classList.remove('hidden');
	document.getElementById('ps-customer-search-wrap').classList.add('hidden');
	document.getElementById('ps-customer-clear').classList.remove('hidden');
	document.getElementById('ps-customer-results').classList.add('hidden');
}

function clearPsCustomer() {
	__PS_CUSTOMER_ID__ = null;
	document.getElementById('ps-customer-selected').classList.add('hidden');
	document.getElementById('ps-customer-search-wrap').classList.remove('hidden');
	document.getElementById('ps-customer-clear').classList.add('hidden');
	document.getElementById('ps-customer-input').value = '';
}

// ── Discount ─────────────────────────────────────────────────────
function togglePsDiscount() {
	var fields = document.getElementById('ps-discount-fields');
	fields.classList.toggle('hidden');
	if (!fields.classList.contains('hidden')) {
		document.getElementById('ps-discount-value').focus();
	}
}

function applyPsDiscount() {
	var subtotal = getCartTotal();
	var type = document.getElementById('ps-discount-type').value;
	var val = parseFloat(document.getElementById('ps-discount-value').value) || 0;
	if (val <= 0) return;
	var discount = type === 'pct'
		? Math.round(subtotal * val / 100)
		: Math.round(val * 100);
	discount = Math.min(discount, subtotal);
	PS_DISCOUNT = discount;

	var finalAmount = subtotal - discount;
	window.__PS_TOTAL__ = finalAmount;
	document.getElementById('pay-total').textContent = finalAmount > 0 ? fmtBRL(finalAmount) : 'CORTESIA';
	document.getElementById('pay-original').textContent = fmtBRL(subtotal);
	document.getElementById('pay-original').classList.remove('hidden');
	document.getElementById('ps-discount-remove-btn').classList.remove('hidden');
	document.getElementById('ps-discount-applied').textContent = '(-' + fmtBRL(discount) + ')';
	document.getElementById('ps-discount-applied').classList.remove('hidden');
	// Show/hide courtesy button for 100% discount
	var courtesyBtn = document.getElementById('ps-courtesy-btn');
	var payBtns = document.getElementById('ps-pay-buttons');
	if (courtesyBtn && payBtns) {
		if (finalAmount <= 0) {
			courtesyBtn.classList.remove('hidden');
			payBtns.classList.add('hidden');
		} else {
			courtesyBtn.classList.add('hidden');
			payBtns.classList.remove('hidden');
		}
	}
}

function removePsDiscount() {
	PS_DISCOUNT = 0;
	var subtotal = getCartTotal();
	window.__PS_TOTAL__ = subtotal;
	document.getElementById('pay-total').textContent = fmtBRL(subtotal);
	document.getElementById('pay-original').classList.add('hidden');
	document.getElementById('ps-discount-fields').classList.add('hidden');
	document.getElementById('ps-discount-remove-btn').classList.add('hidden');
	document.getElementById('ps-discount-applied').classList.add('hidden');
	document.getElementById('ps-discount-value').value = '';
	// Restore payment buttons
	var courtesyBtn = document.getElementById('ps-courtesy-btn');
	var payBtns = document.getElementById('ps-pay-buttons');
	if (courtesyBtn) courtesyBtn.classList.add('hidden');
	if (payBtns) payBtns.classList.remove('hidden');
}

function submitCourtesy() {
	submitSale('cash', null, null);
}

// ── Payment flow ──────────────────────────────────────────────────
function openPayment() {
	var total = getCartTotal();
	if (total <= 0) return;
	PS_DISCOUNT = 0;
	window.__PS_TOTAL__ = total;
	document.getElementById('pay-total').textContent = fmtBRL(total);
	document.getElementById('pay-original').classList.add('hidden');
	document.getElementById('ps-discount-fields').classList.add('hidden');
	document.getElementById('ps-discount-remove-btn').classList.add('hidden');
	document.getElementById('ps-discount-applied').classList.add('hidden');
	document.getElementById('ps-discount-value').value = '';
	// Reset customer
	__PS_CUSTOMER_ID__ = null;
	document.getElementById('ps-customer-selected').classList.add('hidden');
	document.getElementById('ps-customer-search-wrap').classList.remove('hidden');
	document.getElementById('ps-customer-clear').classList.add('hidden');
	document.getElementById('ps-customer-input').value = '';
	document.getElementById('ps-customer-results').classList.add('hidden');
	// Reset notes
	var notesEl = document.getElementById('ps-notes');
	if (notesEl) notesEl.value = '';
	// Reset courtesy/pay buttons
	var courtesyBtn = document.getElementById('ps-courtesy-btn');
	var payBtns = document.getElementById('ps-pay-buttons');
	if (courtesyBtn) courtesyBtn.classList.add('hidden');
	if (payBtns) payBtns.classList.remove('hidden');
	// Build items summary
	var h = '';
	for (var id in CART) {
		var p = PRODUCTS.find(function(x){return x.id == id;});
		if (p) h += '<div class="flex justify-between text-sm font-body"><span>' + CART[id] + 'x ' + p.name + '</span><span>' + fmtBRL(p.price_cents * CART[id]) + '</span></div>';
	}
	document.getElementById('pay-items-list').innerHTML = h;
	showScreen('pay-main');
	document.getElementById('payment-modal').classList.remove('hidden');
}
function closePayment() { document.getElementById('payment-modal').classList.add('hidden'); }
function showScreen(id) {
	var screens = document.querySelectorAll('.pay-screen');
	for (var i = 0; i < screens.length; i++) screens[i].classList.add('hidden');
	document.getElementById(id).classList.remove('hidden');
}

function selectPayment(method) {
	if (method === 'cash') {
		clearDenomInputs('ps-cash');
		var changeEl = document.getElementById('ps-cash-change-display');
		if (changeEl) changeEl.classList.add('hidden');
		var dueLbl = document.getElementById('pay-cash-due');
		if (dueLbl) dueLbl.textContent = fmtBRL(window.__PS_TOTAL__);
		showScreen('pay-cash');
	} else {
		submitSale(method, null, null);
	}
}

var __PS_CHANGE_DENOMS__ = {};
var __PS_CHANGE_TIMER__ = null;

function updateCashChange() {
	var payMap = getDenomMap('ps-cash');
	var paid = denomMapTotal(payMap);
	var due = window.__PS_TOTAL__;
	var changeAmt = paid - due;
	var changeDisplay = document.getElementById('ps-cash-change-display');
	var changeAmountEl = document.getElementById('ps-cash-change-amount');
	if (paid > 0 && changeAmt >= 0) {
		if (changeDisplay) changeDisplay.classList.remove('hidden');
		if (changeAmountEl) changeAmountEl.textContent = fmtBRL(changeAmt);
		// Calculate change denominations from register inventory
		if (changeAmt > 0) {
			if (__PS_CHANGE_TIMER__) clearTimeout(__PS_CHANGE_TIMER__);
			__PS_CHANGE_TIMER__ = setTimeout(function() {
				fetch('/api/cash-registers/active')
					.then(function(r) { return r.ok ? r.json() : null; })
					.then(function(reg) {
						if (!reg) { __PS_CHANGE_DENOMS__ = {}; return; }
						return fetch('/api/cash-registers/' + reg.id + '/calculate-change', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ amount_due_cents: due, payment_denominations: payMap })
						}).then(function(r) { return r.json(); });
					})
					.then(function(result) {
						if (result && result.exact && result.denominations) {
							__PS_CHANGE_DENOMS__ = result.denominations;
						} else {
							__PS_CHANGE_DENOMS__ = {};
						}
					})
					.catch(function() { __PS_CHANGE_DENOMS__ = {}; });
			}, 300);
		} else {
			__PS_CHANGE_DENOMS__ = {};
		}
	} else {
		if (changeDisplay) changeDisplay.classList.add('hidden');
		__PS_CHANGE_DENOMS__ = {};
	}
}

function confirmCashPayment() {
	var payDenoms = getDenomMap('ps-cash');
	var received = denomMapTotal(payDenoms);

	// Split payment cash: save denomination data and return to split screen
	if (window.__PS_SPLIT_CASH_ROW__) {
		var cashRowData = window.__PS_SPLIT_CASH_ROW__;
		cashRowData.payDenoms = payDenoms;
		cashRowData.changeDenoms = __PS_CHANGE_DENOMS__ || {};
		var centsInput = document.getElementById('split-cents-' + cashRowData.idx);
		if (centsInput) centsInput.value = String(received);
		var totalEl = document.getElementById('split-cash-total-' + cashRowData.idx);
		if (totalEl) {
			totalEl.textContent = fmtBRL(received);
			totalEl.classList.remove('hidden');
		}
		window.__PS_SPLIT_DENOM_MODE__ = false;
		updateSplitRemaining();
		showScreen('pay-split');
		return;
	}

	// Regular cash payment
	var due = window.__PS_TOTAL__;
	if (received < due) { alert('Valor insuficiente. Faltam ' + fmtBRL(due - received)); return; }
	submitSale('cash', payDenoms, null);
}

// ── Mixed payment (same experience as rentals) ──────────────────
var SPLIT_METHODS = [
	{ key: 'cash', label: 'DIN', bg: 'bg-sk-green-light', border: 'border-sk-green', text: 'text-sk-green-dark' },
	{ key: 'pix', label: 'PIX', bg: 'bg-sk-purple-light', border: 'border-sk-purple', text: 'text-sk-purple' },
	{ key: 'debit', label: 'DEB', bg: 'bg-sk-blue-light', border: 'border-sk-blue', text: 'text-sk-blue-dark' },
	{ key: 'credit', label: 'CRE', bg: 'bg-sk-yellow-light', border: 'border-sk-yellow', text: 'text-sk-yellow-dark' }
];

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
		+ '<div id="split-value-' + idx + '" class="flex items-center gap-2">'
		+ '<span class="text-sm font-body text-sk-muted">R$</span>'
		+ '<input type="text" id="split-amount-' + idx + '" value="0,00" '
		+ 'oninput="onSplitAmountInput(this,' + idx + ')" '
		+ 'onfocus="this.select()" '
		+ 'class="flex-1 px-3 py-2 border border-sk-border rounded-sk text-sm font-body text-right focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20" '
		+ 'inputmode="numeric" />'
		+ '<input type="hidden" id="split-cents-' + idx + '" value="0" />'
		+ '</div>'
		+ '<div id="split-cash-' + idx + '" class="hidden">'
		+ '<button type="button" onclick="openSplitDenomination(' + idx + ')" '
		+ 'class="btn-touch w-full py-3 bg-sk-green-light border-2 border-sk-green/30 rounded-sk font-display font-bold text-sm text-sk-green-dark active:bg-sk-green/20">'
		+ '\\u{1F4B5} Inserir cedulas</button>'
		+ '<div id="split-cash-total-' + idx + '" class="hidden mt-1 text-center text-sm font-body font-medium text-sk-green-dark"></div>'
		+ '</div>'
		+ '</div>';
}

function openSplitPayment() {
	var total = window.__PS_TOTAL__;
	window.__PS_SPLIT_COUNT__ = 2;
	window.__PS_SPLIT_CASH_ROW__ = null;
	document.getElementById('split-total-amount').textContent = fmtBRL(total);
	var container = document.getElementById('split-rows');
	container.innerHTML = buildSplitRowHtml(0) + buildSplitRowHtml(1);
	document.getElementById('split-add-btn').classList.remove('hidden');
	updateSplitRemaining();
	showScreen('pay-split');
}

function addSplitRow() {
	var count = window.__PS_SPLIT_COUNT__ || 2;
	if (count >= 4) return;
	var container = document.getElementById('split-rows');
	var div = document.createElement('div');
	div.innerHTML = buildSplitRowHtml(count);
	container.appendChild(div.firstChild);
	window.__PS_SPLIT_COUNT__ = count + 1;
	if (count + 1 >= 4) document.getElementById('split-add-btn').classList.add('hidden');
	updateSplitRemaining();
}

function removeSplitRow(idx) {
	var el = document.getElementById('split-row-' + idx);
	if (el) el.remove();
	updateSplitRemaining();
}

function selectSplitMethod(idx, method) {
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
	var valueEl = document.getElementById('split-value-' + idx);
	var cashEl = document.getElementById('split-cash-' + idx);
	if (valueEl && cashEl) {
		if (method === 'cash') {
			valueEl.classList.add('hidden');
			cashEl.classList.remove('hidden');
			document.getElementById('split-cents-' + idx).value = '0';
		} else {
			valueEl.classList.remove('hidden');
			cashEl.classList.add('hidden');
			if (window.__PS_SPLIT_CASH_ROW__ && window.__PS_SPLIT_CASH_ROW__.idx == idx) {
				window.__PS_SPLIT_CASH_ROW__ = null;
			}
		}
	}
	updateSplitRemaining();
}

function onSplitAmountInput(el, idx) {
	var digits = el.value.replace(/\\D/g, '');
	var cents = parseInt(digits, 10) || 0;
	document.getElementById('split-cents-' + idx).value = String(cents);
	el.value = (cents / 100).toFixed(2).replace('.', ',');
	updateSplitRemaining();
}

function openSplitDenomination(idx) {
	window.__PS_SPLIT_CASH_ROW__ = { idx: idx, payDenoms: null, changeDenoms: null };
	var total = window.__PS_TOTAL__ || 0;
	var rows = getSplitRows();
	var otherSum = 0;
	for (var i = 0; i < rows.length; i++) {
		if (rows[i].idx != idx) otherSum += rows[i].amount_cents;
	}
	var cashMax = total - otherSum;
	clearDenomInputs('ps-cash');
	var changeDisplay = document.getElementById('ps-cash-change-display');
	if (changeDisplay) changeDisplay.classList.add('hidden');
	var dueLbl = document.getElementById('pay-cash-due');
	if (dueLbl) dueLbl.textContent = fmtBRL(cashMax) + ' (restante)';
	window.__PS_SPLIT_DENOM_MODE__ = true;
	showScreen('pay-cash');
}

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
		var cashRow = window.__PS_SPLIT_CASH_ROW__;
		if (cashRow && cashRow.idx == idx && cashRow.payDenoms) {
			row.payment_denominations = cashRow.payDenoms;
			row.change_denominations = cashRow.changeDenoms || {};
		}
		rows.push(row);
	}
	return rows;
}

function updateSplitRemaining() {
	var total = window.__PS_TOTAL__ || 0;
	var rows = getSplitRows();
	var sum = 0;
	for (var i = 0; i < rows.length; i++) sum += rows[i].amount_cents;
	var remaining = total - sum;
	var remainingEl = document.getElementById('split-remaining');
	var boxEl = document.getElementById('split-remaining-box');
	if (remainingEl) remainingEl.textContent = fmtBRL(Math.max(0, remaining));
	if (boxEl) {
		if (remaining <= 0) {
			boxEl.className = 'rounded-sk p-3 text-center mb-3 bg-sk-green-light';
			if (remainingEl) {
				remainingEl.className = 'text-xl font-display font-bold text-sk-green-dark';
				remainingEl.textContent = remaining === 0 ? 'R$ 0,00 \\u2713' : fmtBRL(0);
			}
		} else {
			boxEl.className = 'rounded-sk p-3 text-center mb-3 bg-sk-danger-light';
			if (remainingEl) remainingEl.className = 'text-xl font-display font-bold text-sk-danger';
		}
	}
	var confirmBtn = document.getElementById('split-confirm-btn');
	if (confirmBtn) confirmBtn.disabled = remaining !== 0;
}

function confirmSplitPayment() {
	var rows = getSplitRows();
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
	var total = window.__PS_TOTAL__ || 0;
	var sum = 0;
	for (var i = 0; i < rows.length; i++) sum += rows[i].amount_cents;
	if (sum !== total) { alert('A soma dos pagamentos deve ser igual ao total.'); return; }

	var payments = [];
	for (var i = 0; i < rows.length; i++) {
		var p = { method: rows[i].method, amount_cents: rows[i].amount_cents };
		if (rows[i].payment_denominations) p.payment_denominations = rows[i].payment_denominations;
		if (rows[i].change_denominations) p.change_denominations = rows[i].change_denominations;
		payments.push(p);
	}
	submitSale('mixed', null, payments);
}

// ── Submit sale ───────────────────────────────────────────────────
function submitSale(method, payDenoms, payments) {
	var items = [];
	for (var id in CART) items.push({ product_id: Number(id), quantity: CART[id] });
	var payload = { items: items, payment_method: method };
	if (PS_DISCOUNT > 0) payload.discount_cents = PS_DISCOUNT;
	if (__PS_CUSTOMER_ID__) payload.customer_id = __PS_CUSTOMER_ID__;
	var notesEl = document.getElementById('ps-notes');
	if (notesEl && notesEl.value.trim()) payload.notes = notesEl.value.trim();
	if (payDenoms) payload.payment_denominations = payDenoms;
	if (method === 'cash' && __PS_CHANGE_DENOMS__ && Object.keys(__PS_CHANGE_DENOMS__).length > 0) {
		payload.change_denominations = __PS_CHANGE_DENOMS__;
	}
	if (payments) payload.payments = payments;
	fetch('/api/product-sales', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	}).then(function(r) {
		if (!r.ok) return r.json().then(function(d) {
			if (d.code === 'NO_REGISTER') alert('Abra o caixa antes de registrar uma venda');
			else alert(d.error || 'Erro');
		});
		return r.json().then(function(sale) {
			window.__PS_LAST_SALE__ = sale;
			document.getElementById('success-total').textContent = fmtBRL(sale.total_cents);
			var LABELS = { cash:'Dinheiro', pix:'PIX', debit:'Debito', credit:'Credito', mixed:'Misto' };
			document.getElementById('success-method').textContent = LABELS[sale.payment_method] || sale.payment_method;
			if (sale.discount_cents > 0) {
				document.getElementById('success-discount').textContent = '(-' + fmtBRL(sale.discount_cents) + ')';
				document.getElementById('success-discount-row').classList.remove('hidden');
			} else {
				document.getElementById('success-discount-row').classList.add('hidden');
			}
			var receiptBtn = document.getElementById('success-receipt-btn');
			if (receiptBtn) receiptBtn.onclick = function() { window.open('/receipts/product-sale/' + sale.id, '_blank'); };
			showScreen('pay-success');
			CART = {};
			updateCartUI();
		});
	}).catch(function(e) { alert('Erro: ' + e.message); });
}

function closeSuccess() { closePayment(); }
`)}
</script>`;

	return (
		<Layout title="SpeedKids - Produtos" user={user} bodyScripts={script} cashStatus={cashStatus}>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-display font-bold text-sk-text">Produtos</h2>
				<div class="flex gap-2">
					<button id="manage-toggle-btn" onclick="toggleManageMode()" class="btn-touch px-3 py-2 bg-gray-200 rounded-sk font-display font-medium text-sm">
						Gerenciar
					</button>
					<button onclick="showProductForm(null)" class="btn-touch px-3 py-2 bg-sk-orange text-white rounded-sk font-display font-medium text-sm btn-bounce">
						+ Novo
					</button>
				</div>
			</div>

			{/* Search & category filter */}
			<div class="mb-3 space-y-2">
				<input
					id="product-search"
					type="text"
					placeholder="Buscar produto..."
					oninput="filterProducts()"
					class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20"
				/>
				{uniqueCategories.length > 0 && (
					<div class="flex gap-2 overflow-x-auto pb-1">
						<button onclick="filterByCategory('')" data-cat="" class="category-tab px-3 py-1.5 rounded-full text-xs font-display font-medium bg-sk-orange text-white whitespace-nowrap">
							Todos
						</button>
						{uniqueCategories.map((cat) => (
							<button onclick={`filterByCategory('${cat.replace(/'/g, "\\'")}')`} data-cat={cat} class="category-tab px-3 py-1.5 rounded-full text-xs font-display font-medium bg-gray-200 text-sk-muted whitespace-nowrap">
								{cat}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Active products grid */}
			{activeProducts.length === 0 ? (
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-8 text-center">
					<div class="text-4xl mb-2">🛍️</div>
					<p class="text-sk-muted font-body">Nenhum produto cadastrado</p>
					<button onclick="showProductForm(null)" class="btn-touch mt-4 px-6 py-3 bg-sk-orange text-white rounded-sk font-display font-bold btn-bounce">
						Cadastrar Produto
					</button>
				</div>
			) : (
				<>
					<div id="products-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
						{activeProducts.map((p) => (
							<div
								class="product-card relative bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center cursor-pointer select-none active:scale-95 transition-transform"
								data-product-id={p.id}
								data-name={p.name.toLowerCase()}
								data-category={(p.category || "").toLowerCase()}
								onclick={`addToCart(${p.id})`}
							>
								{/* Manage mode overlay */}
								<div class="manage-actions hidden absolute inset-0 bg-white/90 rounded-sk flex items-center justify-center gap-2 z-10">
									<button
										onclick={`event.stopPropagation();showProductForm(${JSON.stringify({ id: p.id, name: p.name, price_cents: p.price_cents, description: p.description, category: p.category, sort_order: p.sort_order, photo_url: p.photo_url })})`}
										class="btn-touch px-3 py-1.5 bg-sk-blue text-white rounded-sk text-xs font-display font-medium"
									>
										Editar
									</button>
									<button
										onclick={`event.stopPropagation();toggleProduct(${p.id})`}
										class="btn-touch px-3 py-1.5 bg-sk-danger text-white rounded-sk text-xs font-display font-medium"
									>
										Desativar
									</button>
								</div>
								{p.photo_url ? (
									<img src={`/api/products/photo/${p.photo_url}`} alt={p.name} class="w-12 h-12 object-cover rounded-sk mx-auto mb-1" />
								) : (
									<div class="w-12 h-12 rounded-sk bg-sk-yellow-light flex items-center justify-center mx-auto mb-1 text-xl">🛍️</div>
								)}
								<div class="text-sm font-display font-bold text-sk-text leading-tight">{p.name}</div>
								{p.category && <div class="text-xs text-sk-muted font-body mt-0.5">{p.category}</div>}
								<div class="text-lg font-display font-bold text-sk-orange mt-1">{fmtPrice(p.price_cents)}</div>
								<span id={`prod-qty-${p.id}`} class="hidden absolute -top-2 -right-2 w-7 h-7 rounded-full bg-sk-orange text-white font-bold text-sm flex items-center justify-center shadow-md">0</span>
								<button
									id={`prod-dec-${p.id}`}
									type="button"
									class="hidden absolute bottom-1 right-1 w-7 h-7 rounded-full bg-sk-danger text-white font-bold text-base shadow-sm active:scale-90 transition-transform flex items-center justify-center"
									onclick={`event.stopPropagation();removeFromCart(${p.id})`}
								>
									&minus;
								</button>
							</div>
						))}
					</div>
					<div id="no-filter-results" class="hidden bg-sk-surface rounded-sk shadow-sk-sm p-6 text-center mb-4">
						<p class="text-sk-muted font-body text-sm">Nenhum produto encontrado para esta busca.</p>
					</div>
				</>
			)}

			{/* Inactive products (hidden by default) */}
			{inactiveProducts.length > 0 && (
				<div id="inactive-section" class="hidden mb-4">
					<h3 class="text-sm font-display font-bold text-sk-muted mb-2">Inativos</h3>
					<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
						{inactiveProducts.map((p) => (
							<div class="bg-gray-100 rounded-sk p-4 text-center opacity-60">
								{p.photo_url ? (
									<img src={`/api/products/photo/${p.photo_url}`} alt={p.name} class="w-10 h-10 object-cover rounded-sk mx-auto mb-1 grayscale" />
								) : (
									<div class="w-10 h-10 rounded-sk bg-gray-200 flex items-center justify-center mx-auto mb-1 text-lg">🛍️</div>
								)}
								<div class="text-sm font-display font-bold text-sk-muted">{p.name}</div>
								<div class="text-lg font-display font-bold text-sk-muted mt-1">{fmtPrice(p.price_cents)}</div>
								<div class="flex gap-1 mt-2 justify-center">
									<button onclick={`showProductForm(${JSON.stringify({ id: p.id, name: p.name, price_cents: p.price_cents, description: p.description, category: p.category, sort_order: p.sort_order, photo_url: p.photo_url })})`} class="text-xs text-sk-blue hover:underline">Editar</button>
									<button onclick={`toggleProduct(${p.id})`} class="text-xs text-sk-green hover:underline">Ativar</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Cart bar (sticky bottom, expandable) */}
			<div id="cart-bar" class="hidden fixed bottom-0 left-0 right-0 bg-sk-surface shadow-sk-xl border-t-2 border-sk-orange z-40">
				{/* Expandable cart items list */}
				<div id="cart-items-expanded" class="hidden max-h-48 overflow-y-auto border-b border-gray-200">
					<div class="max-w-7xl mx-auto px-4 py-2 space-y-1" id="cart-items-list"></div>
				</div>
				<div class="max-w-7xl mx-auto flex items-center justify-between p-4">
					<div onclick="toggleCartExpand()" class="cursor-pointer flex items-center">
						<span id="cart-count" class="font-display font-bold text-sk-text text-sm">0 itens</span>
						<span class="text-xs text-sk-muted ml-1">&#9660;</span>
						<span id="cart-total" class="text-xl font-display font-bold text-sk-orange ml-3">R$ 0,00</span>
					</div>
					<div class="flex gap-2">
						<button onclick="clearCart()" class="btn-touch px-4 py-2 bg-gray-200 rounded-sk font-display font-medium text-sm">Limpar</button>
						<button onclick="openPayment()" class="btn-touch btn-bounce px-6 py-3 bg-sk-green text-white rounded-sk font-display font-bold text-lg">PAGAR</button>
					</div>
				</div>
			</div>

			{/* Product CRUD modal */}
			<div id="product-form-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up">
					<h3 id="pf-title" class="text-lg font-display font-bold mb-4">Novo Produto</h3>
					<input type="hidden" id="pf-id" />
					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text font-body mb-1">Nome *</label>
							<input id="pf-name" type="text" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" placeholder="Nome do produto" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text font-body mb-1">Preco (R$) *</label>
							<input id="pf-price" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" placeholder="0,00" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text font-body mb-1">Descricao</label>
							<input id="pf-desc" type="text" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" placeholder="Opcional" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text font-body mb-1">Categoria</label>
							<input id="pf-category" type="text" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" placeholder="Ex: Doces, Brinquedos" />
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text font-body mb-1">Foto</label>
							<input type="file" id="pf-photo" accept="image/jpeg,image/png,image/webp" class="hidden" onchange="onPhotoSelected(this)" />
							<div id="pf-photo-preview" class="hidden mb-2"></div>
							<div class="flex gap-2">
								<button type="button" id="pf-photo-add-btn" onclick="document.getElementById('pf-photo').click()" class="btn-touch px-3 py-1.5 bg-sk-blue-light text-sk-blue-dark rounded-sk text-xs font-display font-medium">
									Adicionar foto
								</button>
								<button type="button" id="pf-photo-remove-btn" onclick="removeProductPhoto()" class="hidden btn-touch px-3 py-1.5 bg-sk-danger-light text-sk-danger rounded-sk text-xs font-display font-medium">
									Remover foto
								</button>
							</div>
							<p class="text-xs text-sk-muted font-body mt-1">JPEG, PNG ou WebP. Max 2MB.</p>
						</div>
						<div class="flex gap-2 pt-2">
							<button onclick="saveProduct()" class="btn-touch flex-1 py-2 bg-sk-orange text-white rounded-sk font-display btn-bounce font-medium">Salvar</button>
							<button onclick="closeProductForm()" class="btn-touch flex-1 py-2 bg-gray-200 text-sk-text rounded-sk font-display font-medium">Cancelar</button>
						</div>
					</div>
				</div>
			</div>

			{/* Payment modal */}
			<div id="payment-modal" class="hidden fixed inset-0 bg-black/50 overlay-fade flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl w-full max-w-lg max-h-[90vh] overflow-y-auto modal-slide-up">

					{/* Screen: Main payment */}
					<div id="pay-main" class="pay-screen p-6">
						<h3 class="text-lg font-display font-bold text-sk-text mb-3">Pagamento</h3>
						<div id="pay-items-list" class="space-y-1 mb-3"></div>

						{/* Desconto (colapsavel) */}
						<div class="mb-3">
							<div class="flex items-center gap-2">
								<button onclick="togglePsDiscount()" class="text-xs font-body text-sk-blue-dark hover:underline">
									Aplicar desconto
								</button>
								<button id="ps-discount-remove-btn" onclick="removePsDiscount()" class="hidden text-xs font-body text-sk-danger hover:underline">
									Remover desconto
								</button>
							</div>
							<div id="ps-discount-fields" class="hidden mt-2 flex gap-2 items-end">
								<select id="ps-discount-type" class="px-2 py-1.5 border border-sk-border rounded-sk text-sm font-body">
									<option value="pct">%</option>
									<option value="fixed">R$</option>
								</select>
								<input id="ps-discount-value" type="number" min="0" step="0.01" placeholder="Valor"
									class="w-24 px-3 py-1.5 border border-sk-border rounded-sk text-sm font-body focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20" />
								<button onclick="applyPsDiscount()" class="px-3 py-1.5 bg-sk-blue text-white rounded-sk text-sm font-body btn-bounce active:bg-sk-blue-dark">
									Aplicar
								</button>
							</div>
						</div>

						{/* Total */}
						<div class="bg-sk-green-light rounded-sk p-4 text-center mb-4">
							<p class="text-xs text-sk-muted font-body">Total</p>
							<p id="pay-original" class="hidden text-lg text-sk-muted font-body line-through"></p>
							<p id="pay-total" class="text-3xl font-display font-bold text-sk-green-dark">R$ 0,00</p>
							<p id="ps-discount-applied" class="hidden text-sm text-sk-blue-dark font-body font-medium"></p>
						</div>

						{/* Cliente (opcional) */}
						<div class="mb-3">
							<div class="flex items-center gap-2 mb-1">
								<label class="text-xs font-display font-medium text-sk-muted">Cliente (opcional)</label>
								<button id="ps-customer-clear" onclick="clearPsCustomer()" class="hidden text-xs font-body text-sk-danger hover:underline">Remover</button>
							</div>
							<div id="ps-customer-selected" class="hidden mb-2 bg-sk-blue-light rounded-sk px-3 py-2">
								<span id="ps-customer-name" class="text-sm font-body font-medium text-sk-blue-dark"></span>
							</div>
							<div id="ps-customer-search-wrap">
								<input id="ps-customer-input" type="text" placeholder="Buscar por nome, telefone ou CPF..."
									oninput="searchPsCustomer(this.value)"
									class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20" />
								<div id="ps-customer-results" class="hidden mt-1 bg-sk-surface border border-sk-border rounded-sk shadow-sk-sm max-h-32 overflow-y-auto"></div>
							</div>
						</div>

						{/* Observacoes */}
						<div class="mb-3">
							<label class="block text-xs font-display font-medium text-sk-muted mb-1">Observacoes</label>
							<input id="ps-notes" type="text" placeholder="Opcional"
								class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:border-sk-blue focus:ring-2 focus:ring-sk-blue/20" />
						</div>

						{/* Courtesy button for 100% discount */}
						<button id="ps-courtesy-btn" onclick="submitCourtesy()" class="hidden btn-touch btn-bounce w-full py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg mb-3">CONFIRMAR CORTESIA</button>

						<div id="ps-pay-buttons">
							<div class="grid grid-cols-2 gap-2 mb-3">
								<button onclick="selectPayment('cash')" class="btn-touch btn-bounce py-4 bg-sk-green text-white rounded-sk font-display font-bold">DINHEIRO</button>
								<button onclick="selectPayment('pix')" class="btn-touch btn-bounce py-4 bg-sk-purple text-white rounded-sk font-display font-bold">PIX</button>
								<button onclick="selectPayment('debit')" class="btn-touch btn-bounce py-4 bg-sk-blue text-white rounded-sk font-display font-bold">DEBITO</button>
								<button onclick="selectPayment('credit')" class="btn-touch btn-bounce py-4 bg-sk-yellow text-white rounded-sk font-display font-bold">CREDITO</button>
							</div>
							<button onclick="openSplitPayment()" class="btn-touch w-full py-3 bg-gray-200 rounded-sk font-display font-medium mb-2">PAGAMENTO MISTO</button>
						</div>
						<button onclick="closePayment()" class="btn-touch w-full py-2 text-sk-muted font-body text-sm">Cancelar</button>
					</div>

					{/* Screen: Cash denomination */}
					<div id="pay-cash" class="pay-screen hidden p-6">
						<h3 class="text-lg font-display font-bold text-sk-text mb-3">Pagamento em Dinheiro</h3>
						<div class="bg-sk-green-light rounded-sk p-3 text-center mb-3">
							<p class="text-xs text-sk-muted font-body">Total a pagar</p>
							<p class="text-2xl font-display font-bold text-sk-green-dark">{html`<span id="pay-cash-due"></span>`}</p>
						</div>
						{html`<script>${raw(`document.addEventListener('DOMContentLoaded',function(){var el=document.getElementById('pay-cash-due');if(el)el.textContent=fmtBRL(0);});`)}</script>`}
						<DenominationInput prefix="ps-cash" showTotal={true} totalLabel="Total recebido" />
						<ChangeDisplay prefix="ps-cash" />
						<button onclick="confirmCashPayment()" class="btn-touch btn-bounce w-full mt-4 py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg">CONFIRMAR</button>
						<button onclick="showScreen('pay-main')" class="btn-touch w-full mt-2 py-2 text-sk-muted font-body text-sm">Voltar</button>
					</div>

					{/* Screen: Split payment */}
					<div id="pay-split" class="pay-screen hidden p-6">
						<div class="flex items-center justify-between mb-3">
							<h3 class="text-lg font-display font-bold text-sk-text">Pagamento Misto</h3>
							<button onclick="showScreen('pay-main')" class="w-8 h-8 flex items-center justify-center rounded-full text-sk-muted hover:bg-gray-100 text-lg" title="Voltar">&larr;</button>
						</div>
						<div class="bg-sk-blue-light rounded-sk p-3 text-center mb-4">
							<p class="text-xs text-sk-muted font-body">Total a cobrar</p>
							<p id="split-total-amount" class="text-2xl font-display font-bold text-sk-blue-dark">R$ 0,00</p>
						</div>
						<div id="split-rows" class="space-y-3 mb-3"></div>
						<button id="split-add-btn" onclick="addSplitRow()" class="w-full py-2 text-sm font-body text-sk-blue-dark hover:underline mb-3">+ Adicionar forma de pagamento</button>
						<div id="split-remaining-box" class="rounded-sk p-3 text-center mb-3 bg-sk-danger-light">
							<p class="text-xs text-sk-muted font-body">Restante</p>
							<p id="split-remaining" class="text-xl font-display font-bold text-sk-danger">R$ 0,00</p>
						</div>
						<button id="split-confirm-btn" onclick="confirmSplitPayment()" disabled class="btn-touch btn-bounce w-full py-4 bg-sk-green text-white rounded-sk font-display font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed">CONFIRMAR PAGAMENTO</button>
						<button onclick="showScreen('pay-main')" class="btn-touch w-full mt-2 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted">VOLTAR</button>
					</div>

					{/* Screen: Success */}
					<div id="pay-success" class="pay-screen hidden p-6 text-center">
						<div class="text-5xl mb-3">✅</div>
						<h3 class="text-lg font-display font-bold text-sk-green-dark mb-2">Venda Realizada!</h3>
						<p class="text-sm text-sk-muted font-body mb-1">Valor: <span id="success-total" class="font-bold text-sk-text"></span></p>
						<p id="success-discount-row" class="hidden text-sm text-sk-muted font-body mb-1">Desconto: <span id="success-discount" class="font-bold text-sk-blue-dark"></span></p>
						<p class="text-sm text-sk-muted font-body mb-4">Pagamento: <span id="success-method" class="font-bold text-sk-text"></span></p>
						<button id="success-receipt-btn" class="btn-touch btn-bounce w-full py-3 bg-sk-purple text-white rounded-sk font-display font-medium mb-2">Imprimir Cupom</button>
						<button onclick="closeSuccess()" class="btn-touch w-full py-3 bg-sk-green text-white rounded-sk font-display font-bold">OK</button>
					</div>
				</div>
			</div>

			{/* Spacer for cart bar */}
			<div class="h-20"></div>
		</Layout>
	);
};
