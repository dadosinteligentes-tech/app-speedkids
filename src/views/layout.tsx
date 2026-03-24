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
						+ '<div style="font-family:Fredoka,sans-serif;font-size:24px;font-weight:700;color:white;text-shadow:1px 1px 2px rgba(0,0,0,0.2)">META ALCANCADA!</div>'
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
		</body>
	</html>
	);
};
