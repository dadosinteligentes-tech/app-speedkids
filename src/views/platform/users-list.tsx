import type { FC } from "hono/jsx";
import { PlatformLayout } from "./layout";

interface UsersListProps {
	users: Array<{ id: number; name: string; email: string; role: string; active: number; created_at: string; tenant_name: string; tenant_slug: string; last_login: string | null }>;
	user: { name: string; email: string } | null;
}

const ROLE_LABELS: Record<string, string> = { owner: "Socio", manager: "Gerente", operator: "Operador" };

function daysAgo(dateStr: string | null): string {
	if (!dateStr) return "Nunca";
	const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
	if (diff === 0) return "Hoje";
	if (diff === 1) return "Ontem";
	return `${diff} dias atras`;
}

export const PlatformUsersList: FC<UsersListProps> = ({ users, user }) => {
	return (
		<PlatformLayout
			title="Todos os Usuarios"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Usuarios" }]}
		>
			<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
				<div class="px-6 py-4 border-b flex items-center justify-between">
					<h2 class="font-semibold text-gray-900">Usuarios</h2>
					<span class="text-xs text-gray-400">{users.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
								<th class="px-5 py-3 font-medium">Nome</th>
								<th class="px-5 py-3 font-medium">Email</th>
								<th class="px-5 py-3 font-medium">Tenant</th>
								<th class="px-5 py-3 font-medium">Perfil</th>
								<th class="px-5 py-3 font-medium text-center">Status</th>
								<th class="px-5 py-3 font-medium">Ultimo Login</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{users.map((u) => (
								<tr class="hover:bg-blue-50/30 transition-colors">
									<td class="px-5 py-3 font-medium text-gray-900">{u.name}</td>
									<td class="px-5 py-3 text-gray-500">{u.email}</td>
									<td class="px-5 py-3">
										<a href={`/platform/tenants/${u.id}`} class="text-blue-600 hover:text-blue-800 font-medium transition-colors">
											{u.tenant_name}
										</a>
										<p class="text-xs text-gray-400">{u.tenant_slug}</p>
									</td>
									<td class="px-5 py-3">
										<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
											{ROLE_LABELS[u.role] || u.role}
										</span>
									</td>
									<td class="px-5 py-3 text-center">
										{u.active
											? <span class="inline-block w-2 h-2 rounded-full bg-green-500" title="Ativo"></span>
											: <span class="inline-block w-2 h-2 rounded-full bg-red-500" title="Inativo"></span>
										}
									</td>
									<td class="px-5 py-3 text-gray-400 text-xs">{daysAgo(u.last_login)}</td>
								</tr>
							))}
						</tbody>
					</table>
					{users.length === 0 && (
						<div class="text-center py-12 text-gray-400">
							<p class="text-sm">Nenhum usuario encontrado</p>
						</div>
					)}
				</div>
			</div>
		</PlatformLayout>
	);
};
