import type { FC, PropsWithChildren } from "hono/jsx";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { CashStatusBadge } from "../lib/cash-status";
import type { Tenant } from "../db/schema";
import { generateBrandPalette } from "../lib/color-utils";

interface LayoutProps {
	title?: string;
	headScripts?: HtmlEscapedString | Promise<HtmlEscapedString>;
	bodyScripts?: HtmlEscapedString | Promise<HtmlEscapedString>;
	user?: { name: string; role: string } | null;
	cashStatus?: CashStatusBadge | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

function formatBadgeCurrency(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const ROLE_LABELS: Record<string, string> = {
	operator: "Operador",
	manager: "Gerente",
	owner: "Sócio",
};

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({ title, children, headScripts, bodyScripts, user, cashStatus, tenant, isPlatformAdmin }) => {
	const brandName = tenant?.name || "SpeedKids";
	const brandColor = tenant?.primary_color || "#FF7043";
	const brandPalette = generateBrandPalette(brandColor);
	const logoUrl = tenant?.logo_url || "/logo.svg";

	return (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
			<meta name="theme-color" content={brandColor} />
			<title>{title ?? brandName}</title>
			<link rel="icon" type="image/svg+xml" href={logoUrl} />
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
			<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
			<script src="https://cdn.tailwindcss.com"></script>
			{html`
				<script>
				tailwind.config = {
					theme: {
						extend: {
							colors: {
								'sk-yellow':  { DEFAULT: '#FFC107', light: '#FFF8E1', dark: '#F9A825' },
								'sk-orange':  { DEFAULT: '${brandPalette.DEFAULT}', light: '${brandPalette.light}', dark: '${brandPalette.dark}' },
								'sk-blue':    { DEFAULT: '#0288D1', light: '#E1F5FE', dark: '#01579B' },
								'sk-green':   { DEFAULT: '#388E3C', light: '#E8F5E9', dark: '#1B5E20' },
								'sk-danger':  { DEFAULT: '#EF5350', light: '#FFEBEE' },
								'sk-purple':  { DEFAULT: '#AB47BC', light: '#F3E5F5' },
								'sk-bg':      '#FFF9F0',
								'sk-surface': '#FFFFFF',
								'sk-text':    '#3E2723',
								'sk-muted':   '#6D4C41',
								'sk-border':  '#FFCC80',
							},
							fontFamily: {
								'display': ['Fredoka', 'Baloo 2', 'sans-serif'],
								'body':    ['Quicksand', 'Poppins', 'sans-serif'],
							},
							borderRadius: {
								'sk':    '16px',
								'sk-lg': '24px',
								'sk-xl': '32px',
							},
							boxShadow: {
								'sk-sm': '0 2px 8px rgba(255,152,0,0.10)',
								'sk-md': '0 4px 16px rgba(255,152,0,0.12)',
								'sk-lg': '0 8px 32px rgba(255,152,0,0.15)',
								'sk-xl': '0 12px 48px rgba(255,152,0,0.18)',
							},
						},
					},
				}
				</script>
			`}
			{html`
				<style>
					/* === Animations === */
					@keyframes sk-bounce {
						0%, 100% { transform: scale(1); }
						50% { transform: scale(0.92); }
					}
					.btn-bounce:active { animation: sk-bounce 0.15s ease-out; }

					@keyframes sk-wobble {
						0% { transform: rotate(0deg); }
						25% { transform: rotate(-1deg); }
						50% { transform: rotate(1deg); }
						75% { transform: rotate(-0.5deg); }
						100% { transform: rotate(0deg); }
					}
					.card-wobble:hover { animation: sk-wobble 0.4s ease-in-out; }

					@keyframes sk-pulse-red {
						0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,83,80,0.4); }
						50% { opacity: 0.85; box-shadow: 0 0 0 8px rgba(239,83,80,0); }
					}
					.animate-sk-pulse { animation: sk-pulse-red 1.5s ease-in-out infinite; }

					@keyframes sk-slide-up {
						from { transform: translateY(100%); opacity: 0.5; }
						to { transform: translateY(0); opacity: 1; }
					}
					.modal-slide-up { animation: sk-slide-up 0.3s ease-out; }

					@keyframes sk-fade-in {
						from { opacity: 0; }
						to { opacity: 1; }
					}
					.overlay-fade { animation: sk-fade-in 0.2s ease-out; }

					@keyframes sk-float {
						0%, 100% { transform: translateY(0px); }
						50% { transform: translateY(-6px); }
					}
					.sk-float { animation: sk-float 3s ease-in-out infinite; }

					@keyframes sk-confetti-fall {
						0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
						100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
					}
					.confetti-piece {
						position: fixed;
						width: 8px; height: 8px;
						border-radius: 2px;
						top: -10px; z-index: 9999;
						pointer-events: none;
						animation: sk-confetti-fall 2.5s ease-in forwards;
					}

					@keyframes badge-pop {
						0% { transform: scale(0.5); }
						70% { transform: scale(1.2); }
						100% { transform: scale(1); }
					}

					/* === Utilities === */
					.btn-touch { min-height: 48px; min-width: 48px; }
					.timer-display { font-variant-numeric: tabular-nums; }

					/* === Wave separator === */
					.wave-separator {
						width: 100%; height: 40px;
						background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 40'%3E%3Cpath fill='%23FFF9F0' d='M0,20 C360,40 720,0 1080,20 C1260,30 1380,25 1440,20 L1440,40 L0,40 Z'/%3E%3C/svg%3E") no-repeat center;
						background-size: cover;
						margin-top: -1px;
					}

					/* === Balloon celebration === */
					@keyframes sk-balloon-rise {
						0% { transform: translateY(100vh) scale(0.5) rotate(0deg); opacity: 0; }
						10% { opacity: 1; }
						90% { opacity: 1; }
						100% { transform: translateY(-120vh) scale(1) rotate(15deg); opacity: 0; }
					}
					.sk-balloon {
						position: fixed;
						bottom: -80px;
						z-index: 9999;
						pointer-events: none;
						font-size: 48px;
						animation: sk-balloon-rise 3.5s ease-out forwards;
					}
					@keyframes sk-goal-banner-in {
						0% { transform: scale(0.3) translateY(40px); opacity: 0; }
						60% { transform: scale(1.1) translateY(-5px); opacity: 1; }
						100% { transform: scale(1) translateY(0); opacity: 1; }
					}
					@keyframes sk-goal-banner-out {
						0% { opacity: 1; transform: scale(1); }
						100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
					}
					.sk-goal-banner {
						position: fixed;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						z-index: 10000;
						animation: sk-goal-banner-in 0.6s ease-out forwards;
					}
					.sk-goal-banner.fade-out {
						animation: sk-goal-banner-out 0.4s ease-in forwards;
					}

					/* === Reduced motion === */
					@media (prefers-reduced-motion: reduce) {
						.card-wobble:hover, .btn-bounce:active, .sk-float,
						.confetti-piece, .animate-sk-pulse, .modal-slide-up, .overlay-fade,
						.sk-balloon, .sk-goal-banner {
							animation: none !important;
						}
					}

					/* === Sort buttons === */
					.sort-btn {
						background: #f3f4f6;
						color: #6b7280;
						border: 1px solid #e5e7eb;
					}
					.sort-btn:active { transform: scale(0.95); }
					.sort-btn-active {
						background: #0288D1;
						color: white;
						border-color: #0288D1;
						box-shadow: 0 1px 3px rgba(2,136,209,0.3);
					}

					/* === Print === */
					@media print {
						nav, .wave-separator, .print\:hidden { display: none !important; }
						main { max-width: 100% !important; padding: 0 !important; }
						body { background: white !important; }
					}
				</style>
			`}
			{headScripts ?? ""}
		</head>
		<body class="bg-sk-bg min-h-screen font-body text-sk-text">
			<nav class="bg-gradient-to-r from-sk-orange-dark to-sk-orange text-white shadow-lg" aria-label="Navegacao principal">
				<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
					<a href="/" class="flex items-center gap-2">
						<img src={logoUrl} alt={brandName} class="h-9" />
					</a>
					<div class="flex items-center gap-3">
						<span id="online-status" class="flex items-center gap-1 text-sm">
							<span class="w-2 h-2 rounded-full bg-white"></span>
							Online
						</span>
						{user && (
							<>
								{cashStatus && (
									<a
										href="/cash"
										class={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-display font-medium ${
											cashStatus.open
												? "bg-white/20 text-white"
												: "bg-sk-danger-light text-sk-danger"
										}`}
									>
										<span class={`w-2 h-2 rounded-full ${cashStatus.open ? "bg-sk-green" : "bg-sk-danger"}`}></span>
										{cashStatus.open ? `Caixa: ${formatBadgeCurrency(cashStatus.balance_cents ?? 0)}` : "Sem caixa"}
									</a>
								)}
								<a href="/rentals" class="text-sm text-white hover:text-white/90 font-body">Locações</a>
								<a href="/shift" class="text-sm text-white hover:text-white/90 font-body">Turno</a>
								<a href="/cash" class="text-sm text-white hover:text-white/90 font-body">Caixa</a>
								<a href="/products" class="text-sm text-white hover:text-white/90 font-body">Produtos</a>
								{(user.role === "manager" || user.role === "owner") && (
									<a href="/admin" class="text-sm text-white hover:text-white/90 font-body">Admin</a>
								)}
								{isPlatformAdmin && (
									<a href="/platform" class="text-sm bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-body">Platform</a>
								)}
								<span class="text-sm text-white/90">
									{user.name} <span class="text-white/90 text-xs">({ROLE_LABELS[user.role] ?? user.role})</span>
								</span>
								<button
									onclick="fetch('/api/auth/logout',{method:'POST'}).then(function(){location.href='/login'})"
									class="text-sm text-white hover:text-white/90 underline font-body"
								>
									Sair
								</button>
							</>
						)}
					</div>
				</div>
			</nav>
			<div class="wave-separator"></div>
			<main class="max-w-7xl mx-auto px-4 py-6 font-body">{children}</main>

			{/* Safelist div — ensures Tailwind CDN generates classes used dynamically in JS */}
			{html`<div class="hidden
				bg-sk-green-light border-sk-green bg-sk-blue-light border-sk-blue
				bg-sk-yellow-light border-sk-yellow bg-sk-danger-light border-sk-danger
				bg-sk-blue/50 border-sk-blue/50 bg-sk-blue/60 border-sk-blue/30
				bg-sk-green bg-sk-blue bg-sk-yellow bg-sk-danger bg-sk-purple
				bg-sk-green-dark bg-sk-blue-dark bg-sk-yellow-dark bg-sk-orange-dark bg-sk-danger-light
				text-sk-text text-sk-muted text-sk-green-dark text-sk-blue-dark text-sk-yellow-dark text-sk-orange-dark text-sk-danger text-sk-purple
				bg-sk-surface bg-sk-orange-light bg-sk-purple-light bg-sk-yellow-light/50
				border-sk-border border-sk-green/30 border-sk-blue/30 border-sk-yellow/30 border-sk-purple/30 border-sk-danger/30
				rounded-sk rounded-sk-lg rounded-sk-xl rounded-t-sk-xl
				shadow-sk-sm shadow-sk-md shadow-sk-lg shadow-sk-xl
				font-display font-body
				animate-sk-pulse card-wobble btn-bounce modal-slide-up overlay-fade sk-float
				bg-sk-blue/20 bg-sk-green/20 bg-sk-yellow/20 bg-sk-blue/30
				bg-gray-100 bg-gray-600 text-gray-700
				bg-sky-100 bg-sky-600 text-sky-700
				bg-orange-100 bg-orange-500 text-orange-700
				bg-yellow-100 bg-yellow-500 text-yellow-700
				bg-violet-100 bg-violet-500 text-violet-700
				bg-purple-100 bg-purple-500 text-purple-700
				bg-blue-100 bg-blue-500 text-blue-700
				bg-amber-100 bg-amber-600 text-amber-700
				bg-zinc-200 bg-zinc-500 text-zinc-600
			" aria-hidden="true"></div>`}

			{html`<script>
				function triggerConfetti() {
					var colors = ['#FFC107','${brandPalette.DEFAULT}','#29B6F6','#66BB6A','#AB47BC','#EF5350'];
					var container = document.createElement('div');
					container.id = 'sk-confetti';
					container.setAttribute('aria-hidden', 'true');
					document.body.appendChild(container);
					for (var i = 0; i < 25; i++) {
						var piece = document.createElement('span');
						piece.className = 'confetti-piece';
						piece.style.left = (Math.random() * 100) + 'vw';
						piece.style.backgroundColor = colors[i % colors.length];
						piece.style.animationDelay = (Math.random() * 0.5) + 's';
						piece.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
						container.appendChild(piece);
					}
					setTimeout(function() { container.remove(); }, 4000);
				}

				/* Balloon celebration for goal achievements */
				function celebrateGoal(goalTitle) {
					var balloons = ['🎈','🎉','🎊','🏆','⭐'];
					var container = document.createElement('div');
					container.id = 'sk-balloons';
					container.setAttribute('aria-hidden', 'true');
					document.body.appendChild(container);

					for (var i = 0; i < 15; i++) {
						var balloon = document.createElement('span');
						balloon.className = 'sk-balloon';
						balloon.textContent = balloons[i % balloons.length];
						balloon.style.left = (5 + Math.random() * 90) + 'vw';
						balloon.style.animationDelay = (Math.random() * 1.5) + 's';
						balloon.style.animationDuration = (2.5 + Math.random() * 2) + 's';
						balloon.style.fontSize = (36 + Math.random() * 24) + 'px';
						container.appendChild(balloon);
					}

					/* Show banner */
					var banner = document.createElement('div');
					banner.className = 'sk-goal-banner';
					banner.innerHTML = '<div style="background:linear-gradient(135deg,#FFC107,${brandPalette.DEFAULT});padding:24px 40px;border-radius:24px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,0.25)">'
						+ '<div style="font-size:48px;margin-bottom:8px">🎯🏆🎯</div>'
						+ '<div style="font-family:Fredoka,sans-serif;font-size:24px;font-weight:700;color:white;text-shadow:1px 1px 2px rgba(0,0,0,0.2)">META ALCANÇADA!</div>'
						+ '<div style="font-family:Quicksand,sans-serif;font-size:16px;color:white;margin-top:4px;opacity:0.95">' + (goalTitle || '') + '</div>'
						+ '</div>';
					document.body.appendChild(banner);

					triggerConfetti();

					setTimeout(function() {
						banner.classList.add('fade-out');
						setTimeout(function() { banner.remove(); }, 500);
					}, 3500);

					setTimeout(function() { container.remove(); }, 5000);
				}

				/* Check goal achievements after a sale/payment */
				function checkGoalAchievements() {
					fetch('/api/sales-goals/check-achievements')
						.then(function(r) { return r.ok ? r.json() : null; })
						.then(function(data) {
							if (data && data.achievements && data.achievements.length > 0) {
								data.achievements.forEach(function(a, idx) {
									setTimeout(function() { celebrateGoal(a.title); }, idx * 4500);
								});
							}
						})
						.catch(function() { /* silent */ });
				}
			</script>`}

			{bodyScripts ?? ""}

			{/* Footer */}
			<footer style="padding:12px 16px;text-align:center;font-size:11px;color:#94A3B8;font-family:Quicksand,sans-serif;border-top:1px solid #E2E8F0;margin-top:auto">
				<span>DADOS INTELIGENTES LTDA — CNPJ: 47.773.826/0001-57</span>
				<span style="margin:0 8px">|</span>
				<a href="/legal/terms" style="color:#94A3B8;text-decoration:underline" target="_blank">Termos</a>
				<span style="margin:0 4px">&middot;</span>
				<a href="/legal/privacy" style="color:#94A3B8;text-decoration:underline" target="_blank">Privacidade</a>
				<span style="margin:0 4px">&middot;</span>
				<a href="/legal/lgpd" style="color:#94A3B8;text-decoration:underline" target="_blank">LGPD</a>
			</footer>

			{/* ── Support Chat Widget ── */}
			{user && html`
			<div id="sk-chat-widget" style="position:fixed;bottom:20px;right:20px;z-index:9999">
				<div id="sk-chat-panel" style="display:none;width:360px;max-height:500px;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);overflow:hidden;flex-direction:column;border:2px solid ${brandPalette.DEFAULT}">
					<!-- Header -->
					<div style="background:linear-gradient(135deg,${brandPalette.DEFAULT},${brandPalette.dark});padding:14px 16px;color:white;display:flex;align-items:center;justify-content:space-between">
						<div style="display:flex;align-items:center;gap:8px">
							<span style="font-size:18px">💬</span>
							<span style="font-family:Fredoka,sans-serif;font-weight:700;font-size:14px" id="sk-chat-title">Suporte</span>
						</div>
						<button onclick="skChatToggle()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:0;line-height:1">&times;</button>
					</div>
					<!-- Ticket list / conversation -->
					<div id="sk-chat-body" style="flex:1;overflow-y:auto;max-height:350px;min-height:200px">
						<div style="padding:20px;text-align:center;color:#999;font-family:Quicksand,sans-serif;font-size:13px">Carregando...</div>
					</div>
					<!-- Input area -->
					<div id="sk-chat-input" style="display:none;padding:10px;border-top:1px solid #eee;background:#fafafa">
						<div id="sk-chat-attachment-preview" style="display:none;padding:4px 8px;margin-bottom:6px;background:#fff7ed;border:1px solid #fdba74;border-radius:6px;font-size:12px;font-family:Quicksand,sans-serif;display:none;align-items:center;gap:6px">
							<span>📎</span><span id="sk-chat-attachment-name"></span>
							<button onclick="skChatClearAttachment()" style="background:none;border:none;color:#999;cursor:pointer;font-size:14px;margin-left:auto">&times;</button>
						</div>
						<form onsubmit="skChatSend(event)" style="display:flex;gap:8px;align-items:center">
							<label style="cursor:pointer;font-size:18px;padding:4px;flex-shrink:0" title="Anexar arquivo">
								📎
								<input id="sk-chat-file" type="file" style="display:none" onchange="skChatFileSelected(this)" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
							</label>
							<input id="sk-chat-msg" type="text" placeholder="Digite sua mensagem..." style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-family:Quicksand,sans-serif;font-size:13px;outline:none" autocomplete="off" />
							<button type="submit" style="background:${brandPalette.DEFAULT};color:white;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:Fredoka,sans-serif;font-weight:700;font-size:13px">Enviar</button>
						</form>
					</div>
				</div>
				<!-- FAB with pulse animation -->
				<style>
					@keyframes sk-pulse {
						0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
						70% { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
						100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
					}
					.sk-fab-pulse { animation: sk-pulse 1.5s infinite; }
				</style>
				<button id="sk-chat-fab" onclick="skChatToggle()" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,${brandPalette.DEFAULT},${brandPalette.dark});color:white;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-size:24px;display:flex;align-items:center;justify-content:center;margin-left:auto;margin-top:8px;position:relative;transition:transform 0.2s">
					💬
					<span id="sk-chat-badge" style="position:absolute;top:-4px;right:-4px;background:#EF4444;color:white;font-size:11px;font-weight:bold;border-radius:50%;width:20px;height:20px;align-items:center;justify-content:center;font-family:sans-serif;display:none">0</span>
				</button>
			</div>
			<script>
${raw(`
var skChatOpen = false;
var skChatView = 'list'; // list | conversation | new
var skChatCurrentTicket = null;
var skChatLastMsgId = 0;
var skChatPollTimer = null;

function skChatToggle() {
	skChatOpen = !skChatOpen;
	var panel = document.getElementById('sk-chat-panel');
	panel.style.display = skChatOpen ? 'flex' : 'none';
	if (skChatOpen) {
		skChatLoadList();
	} else {
		if (skChatPollTimer) { clearInterval(skChatPollTimer); skChatPollTimer = null; }
	}
}

function skChatLoadList() {
	skChatView = 'list';
	skChatCurrentTicket = null;
	if (skChatPollTimer) { clearInterval(skChatPollTimer); skChatPollTimer = null; }
	document.getElementById('sk-chat-title').textContent = 'Suporte';
	document.getElementById('sk-chat-input').style.display = 'none';
	var body = document.getElementById('sk-chat-body');
	body.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:13px">Carregando...</div>';

	fetch('/api/support-tickets')
		.then(function(r) {
			if (r.status === 403) return r.json().then(function(d) { throw { noAccess: true, msg: d.error }; });
			return r.json();
		})
		.then(function(tickets) {
			var html = '<div style="padding:8px">';
			html += '<button onclick="skChatNewTicket()" style="width:100%;padding:10px;background:#F97316;color:white;border:none;border-radius:8px;font-family:Fredoka,sans-serif;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px">+ Nova conversa</button>';
			if (tickets.length === 0) {
				html += '<p style="text-align:center;color:#999;font-size:13px;padding:16px;font-family:Quicksand,sans-serif">Nenhum chamado aberto</p>';
			}
			tickets.forEach(function(t) {
				var statusColors = { open: '#22C55E', awaiting_reply: '#F97316', resolved: '#6B7280', closed: '#9CA3AF' };
				var statusLabels = { open: 'Aberto', awaiting_reply: 'Aguardando', resolved: 'Resolvido', closed: 'Fechado' };
				var dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (statusColors[t.status] || '#999') + ';margin-right:6px"></span>';
				var unread = t.unread_count > 0 ? '<span style="background:#EF4444;color:white;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:auto">' + t.unread_count + '</span>' : '';
				html += '<div onclick="skChatOpenTicket(' + t.id + ',\\'' + t.subject.replace(/'/g, "\\\\'") + '\\')" style="padding:10px 12px;border:1px solid #eee;border-radius:8px;margin-bottom:4px;cursor:pointer;display:flex;align-items:center;gap:4px;transition:background 0.15s" onmouseover="this.style.background=\\'#f5f5f5\\'" onmouseout="this.style.background=\\'white\\'">';
				html += '<div style="flex:1;min-width:0"><div style="font-family:Fredoka,sans-serif;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + dot + t.subject + '</div>';
				html += '<div style="font-size:11px;color:#999;font-family:Quicksand,sans-serif;margin-top:2px">' + (statusLabels[t.status] || t.status) + ' · ' + t.message_count + ' msgs</div></div>' + unread + '</div>';
			});
			html += '</div>';
			body.innerHTML = html;
		})
		.catch(function(err) {
			if (err && err.noAccess) {
				body.innerHTML = '<div style="padding:24px;text-align:center">'
					+ '<div style="font-size:32px;margin-bottom:8px">🔒</div>'
					+ '<p style="font-family:Fredoka,sans-serif;font-weight:700;font-size:14px;color:#333;margin-bottom:4px">Suporte por tickets</p>'
					+ '<p style="font-family:Quicksand,sans-serif;font-size:12px;color:#999;margin-bottom:12px">' + (err.msg || 'Seu plano não inclui esta funcionalidade.') + '</p>'
					+ '<a href="/admin/plan" style="display:inline-block;padding:8px 16px;background:#F97316;color:white;border-radius:8px;font-family:Fredoka,sans-serif;font-weight:700;font-size:12px;text-decoration:none">Ver planos</a>'
					+ '</div>';
			}
		});
}

function skChatNewTicket() {
	skChatView = 'new';
	document.getElementById('sk-chat-title').textContent = 'Novo chamado';
	document.getElementById('sk-chat-input').style.display = 'none';
	var body = document.getElementById('sk-chat-body');
	body.innerHTML = '<div style="padding:16px">'
		+ '<input id="sk-new-subject" type="text" placeholder="Assunto" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:Quicksand,sans-serif;font-size:13px;margin-bottom:8px;box-sizing:border-box;outline:none" />'
		+ '<textarea id="sk-new-message" placeholder="Descreva sua dúvida ou problema..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:Quicksand,sans-serif;font-size:13px;height:100px;resize:none;box-sizing:border-box;outline:none"></textarea>'
		+ '<div style="display:flex;gap:8px;margin-top:8px">'
		+ '<button onclick="skChatSubmitNew()" style="flex:1;padding:10px;background:#F97316;color:white;border:none;border-radius:8px;font-family:Fredoka,sans-serif;font-weight:700;font-size:13px;cursor:pointer">Enviar</button>'
		+ '<button onclick="skChatLoadList()" style="flex:1;padding:10px;background:#eee;color:#333;border:none;border-radius:8px;font-family:Fredoka,sans-serif;font-weight:600;font-size:13px;cursor:pointer">Cancelar</button>'
		+ '</div></div>';
}

function skChatSubmitNew() {
	var subject = document.getElementById('sk-new-subject').value.trim();
	var message = document.getElementById('sk-new-message').value.trim();
	if (!subject || !message) return;
	fetch('/api/support-tickets', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ subject: subject, message: message })
	})
	.then(function(r) { return r.json(); })
	.then(function(t) { skChatOpenTicket(t.id, t.subject); });
}

function skChatOpenTicket(id, subject) {
	skChatView = 'conversation';
	skChatCurrentTicket = id;
	skChatLastMsgId = 0;
	document.getElementById('sk-chat-title').innerHTML = '<span onclick="skChatLoadList()" style="cursor:pointer;margin-right:6px">&larr;</span> ' + subject;
	document.getElementById('sk-chat-input').style.display = 'block';
	document.getElementById('sk-chat-body').innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:13px">Carregando...</div>';
	skChatFetchMessages(false);
	if (skChatPollTimer) clearInterval(skChatPollTimer);
	skChatPollTimer = setInterval(function() { skChatFetchMessages(true); }, 5000);
}

var skChatPendingFile = null;

function skChatRenderAttachment(m) {
	if (!m.attachment_url) return '';
	var name = m.attachment_name || 'Anexo';
	var isImage = /\\.(jpg|jpeg|png|gif|webp)$/i.test(name);
	if (isImage) {
		return '<div style="margin-top:6px"><img src="' + m.attachment_url + '" alt="' + name + '" style="max-width:200px;max-height:150px;border-radius:8px;cursor:pointer" onclick="window.open(this.src)" /></div>';
	}
	return '<div style="margin-top:6px"><a href="' + m.attachment_url + '" target="_blank" style="color:inherit;text-decoration:underline;font-size:12px">📎 ' + name + '</a></div>';
}

function skChatFetchMessages(isPolling) {
	var url = '/api/support-tickets/' + skChatCurrentTicket + '/messages';
	if (isPolling && skChatLastMsgId > 0) url += '?after=' + skChatLastMsgId;
	fetch(url)
		.then(function(r) { return r.json(); })
		.then(function(data) {
			var body = document.getElementById('sk-chat-body');
			if (!isPolling || skChatLastMsgId === 0) body.innerHTML = '';
			data.messages.forEach(function(m) {
				skChatLastMsgId = Math.max(skChatLastMsgId, m.id);
				var isMine = m.sender_type === 'tenant';
				var align = isMine ? 'flex-end' : 'flex-start';
				var bg = isMine ? '#F97316' : '#f0f0f0';
				var color = isMine ? 'white' : '#333';
				var time = m.created_at ? m.created_at.slice(11, 16) : '';
				var attachHtml = skChatRenderAttachment(m);
				var div = document.createElement('div');
				div.style.cssText = 'display:flex;flex-direction:column;align-items:' + align + ';padding:4px 12px';
				div.innerHTML = '<div style="max-width:80%;padding:8px 12px;border-radius:12px;background:' + bg + ';color:' + color + ';font-family:Quicksand,sans-serif;font-size:13px;line-height:1.4;word-break:break-word">' + m.message.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>') + attachHtml + '</div>'
					+ '<div style="font-size:10px;color:#999;margin-top:2px;font-family:sans-serif">' + (isMine ? '' : m.sender_name + ' · ') + time + '</div>';
				body.appendChild(div);
			});
			if (!isPolling || data.messages.length > 0) body.scrollTop = body.scrollHeight;
			if (data.ticket && (data.ticket.status === 'closed')) {
				document.getElementById('sk-chat-input').style.display = 'none';
			}
		});
}

function skChatFileSelected(input) {
	if (input.files && input.files[0]) {
		skChatPendingFile = input.files[0];
		document.getElementById('sk-chat-attachment-name').textContent = skChatPendingFile.name;
		document.getElementById('sk-chat-attachment-preview').style.display = 'flex';
	}
}

function skChatClearAttachment() {
	skChatPendingFile = null;
	document.getElementById('sk-chat-file').value = '';
	document.getElementById('sk-chat-attachment-preview').style.display = 'none';
}

function skChatSend(e) {
	e.preventDefault();
	var input = document.getElementById('sk-chat-msg');
	var msg = input.value.trim();
	if (!msg && !skChatPendingFile) return;
	input.value = '';

	if (skChatPendingFile) {
		var formData = new FormData();
		formData.append('message', msg || '📎 ' + skChatPendingFile.name);
		formData.append('file', skChatPendingFile);
		skChatClearAttachment();
		fetch('/api/support-tickets/' + skChatCurrentTicket + '/messages', {
			method: 'POST',
			body: formData
		}).then(function() { skChatFetchMessages(true); });
	} else {
		fetch('/api/support-tickets/' + skChatCurrentTicket + '/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: msg })
		}).then(function() { skChatFetchMessages(true); });
	}
}

// Poll unread count for badge + pulse animation
setInterval(function() {
	if (skChatOpen && skChatView === 'conversation') return;
	fetch('/api/support-tickets/unread')
		.then(function(r) { return r.json(); })
		.then(function(d) {
			var badge = document.getElementById('sk-chat-badge');
			var fab = document.getElementById('sk-chat-fab');
			if (d.count > 0) {
				badge.textContent = d.count;
				badge.style.display = 'flex';
				fab.classList.add('sk-fab-pulse');
			} else {
				badge.style.display = 'none';
				fab.classList.remove('sk-fab-pulse');
			}
		})
		.catch(function(){});
}, 15000);
// Initial check on load
setTimeout(function() {
	fetch('/api/support-tickets/unread')
		.then(function(r) { return r.json(); })
		.then(function(d) {
			if (d.count > 0) {
				document.getElementById('sk-chat-badge').textContent = d.count;
				document.getElementById('sk-chat-badge').style.display = 'flex';
				document.getElementById('sk-chat-fab').classList.add('sk-fab-pulse');
			}
		}).catch(function(){});
}, 2000);
`)}
			</script>
			`}

		</body>
	</html>
	);
};
