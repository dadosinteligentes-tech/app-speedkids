import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Tenant } from "../db/schema";
import { Layout } from "./layout";

export const LoginPage: FC<{ tenant?: Tenant | null }> = ({ tenant }) => {
	const loginScript = html`<script>
${raw(`
document.getElementById('login-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var btn = document.getElementById('login-btn');
	var errEl = document.getElementById('login-error');
	btn.disabled = true;
	btn.textContent = 'Entrando...';
	errEl.classList.add('hidden');

	fetch('/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: document.getElementById('email').value,
			password: document.getElementById('password').value
		})
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok) {
			window.location.href = '/';
		} else {
			errEl.textContent = res.data.error || 'Erro ao fazer login';
			errEl.classList.remove('hidden');
			btn.disabled = false;
			btn.textContent = 'Entrar';
		}
	})
	.catch(function() {
		errEl.textContent = 'Erro de conexao. Tente novamente.';
		errEl.classList.remove('hidden');
		btn.disabled = false;
		btn.textContent = 'Entrar';
	});
});
`)}
</script>`;

	return (
		<Layout title={tenant?.name ? `${tenant.name} - Login` : "Login"} bodyScripts={loginScript} tenant={tenant}>
			<div class="flex items-center justify-center min-h-[70vh] relative">
				{/* Decorative floating elements */}
				<span class="sk-float absolute top-10 left-10 text-4xl opacity-60 pointer-events-none" style="animation-delay: 0s" aria-hidden="true">🎈</span>
				<span class="sk-float absolute top-20 right-16 text-3xl opacity-50 pointer-events-none" style="animation-delay: 1s" aria-hidden="true">⭐</span>
				<span class="sk-float absolute bottom-20 left-20 text-3xl opacity-50 pointer-events-none" style="animation-delay: 0.5s" aria-hidden="true">🏎️</span>
				<span class="sk-float absolute bottom-32 right-12 text-4xl opacity-60 pointer-events-none" style="animation-delay: 1.5s" aria-hidden="true">🎠</span>

				<div class="bg-sk-surface rounded-sk-xl shadow-sk-lg p-8 w-full max-w-sm relative z-10">
					<div class="text-center mb-6">
						<img src={tenant?.logo_url || "/logo.svg"} alt={tenant?.name || "Logo"} class="h-16 mx-auto mb-2" />
						<p class="text-sk-muted font-body text-sm mt-1">Faca login para continuar</p>
					</div>

					<div id="login-error" class="hidden mb-4 p-3 bg-sk-danger-light border border-sk-danger/30 text-sk-danger rounded-sk font-body text-sm"></div>

					<form id="login-form" class="space-y-4">
						<div>
							<label for="email" class="block text-sm font-display font-medium text-sk-text mb-1">
								Email
							</label>
							<input
								type="email"
								id="email"
								name="email"
								required
								autocomplete="email"
								class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue text-base"
								placeholder="seu@email.com"
							/>
						</div>

						<div>
							<label for="password" class="block text-sm font-display font-medium text-sk-text mb-1">
								Senha
							</label>
							<input
								type="password"
								id="password"
								name="password"
								required
								autocomplete="current-password"
								class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue text-base"
								placeholder="Sua senha"
							/>
						</div>

						<button
							type="submit"
							id="login-btn"
							class="btn-touch btn-bounce w-full py-3 bg-sk-orange text-white rounded-sk font-display font-bold text-lg active:bg-sk-orange-dark shadow-sk-sm disabled:opacity-50"
						>
							Entrar
						</button>
					</form>
				</div>
			</div>
		</Layout>
	);
};
