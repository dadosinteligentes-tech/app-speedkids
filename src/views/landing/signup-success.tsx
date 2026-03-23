import type { FC } from "hono/jsx";

interface SuccessProps {
	tenantSlug: string;
	domain: string;
}

export const SignupSuccess: FC<SuccessProps> = ({ tenantSlug, domain }) => (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>Conta Criada - Dados Inteligentes</title>
			<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
			<script src="https://cdn.tailwindcss.com"></script>
			<style>{`body { font-family: 'Inter', sans-serif; }`}</style>
		</head>
		<body class="bg-gray-50 min-h-screen flex items-center justify-center">
			<div class="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
				<div class="text-5xl mb-4">🎉</div>
				<h1 class="text-2xl font-bold mb-2">Sua conta foi criada!</h1>
				<p class="text-gray-600 mb-6">
					Seu sistema esta pronto. Voce recebera um email com suas credenciais de acesso.
				</p>
				<div class="bg-blue-50 rounded-xl p-4 mb-6">
					<p class="text-sm text-gray-500 mb-1">Seu endereco:</p>
					<p class="text-lg font-bold text-blue-700">
						{tenantSlug}.{domain}
					</p>
				</div>
				<a
					href={`https://${tenantSlug}.${domain}/login`}
					class="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
				>
					Acessar meu sistema
				</a>
			</div>
		</body>
	</html>
);
