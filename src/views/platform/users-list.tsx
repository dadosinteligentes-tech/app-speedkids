import type { FC } from "hono/jsx";
import { PlatformLayout } from "./layout";

interface UsersListProps {
	users: Array<{ id: number; name: string; email: string; role: string; active: number; created_at: string; tenant_name: string; tenant_slug: string; last_login: string | null }>;
	user: { name: string; email: string } | null;
}

const ROLE_LABELS: Record<string, string> = { owner: "Socio", manager: "Gerente", operator: "Operador" };

function daysAgo(dateStr: string | null): string {
	if (!dateStr) return "Nunca";
	const d = new Date(dateStr + (dateStr.endsWith("Z") ? "" : "Z"));
	const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
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
			<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
					<h2 class="font-display font-semibold text-sk-text">Usuarios</h2>
					<span class="font-body text-xs text-sk-muted">{users.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-5 py-3 font-display font-medium">Nome</th>
								<th class="px-5 py-3 font-display font-medium">Email</th>
								<th class="px-5 py-3 font-display font-medium">Tenant</th>
								<th class="px-5 py-3 font-display font-medium">Perfil</th>
								<th class="px-5 py-3 font-display font-medium text-center">Status</th>
								<th class="px-5 py-3 font-display font-medium">Ultimo Login</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{users.map((u) => (
								<tr class="hover:bg-sk-blue-light/30 transition-colors">
									<td class="px-5 py-3 font-display font-medium text-sk-text">{u.name}</td>
									<td class="px-5 py-3 font-body text-sk-muted">{u.email}</td>
									<td class="px-5 py-3">
										<a href={`/platform/tenants/${u.id}`} class="font-display text-sk-blue hover:text-sk-blue-dark font-medium transition-colors">
											{u.tenant_name}
										</a>
										<p class="font-body text-xs text-sk-muted">{u.tenant_slug}</p>
									</td>
									<td class="px-5 py-3">
										<span class="bg-sk-yellow-light text-sk-yellow-dark px-2 py-0.5 rounded text-xs font-display font-medium">
											{ROLE_LABELS[u.role] || u.role}
										</span>
									</td>
									<td class="px-5 py-3 text-center">
										{u.active
											? <span class="inline-block w-2 h-2 rounded-full bg-sk-green" title="Ativo"></span>
											: <span class="inline-block w-2 h-2 rounded-full bg-sk-danger" title="Inativo"></span>
										}
									</td>
									<td class="px-5 py-3 font-body text-sk-muted text-xs">{daysAgo(u.last_login)}</td>
								</tr>
							))}
						</tbody>
					</table>
					{users.length === 0 && (
						<div class="text-center py-12 text-sk-muted">
							<p class="font-body text-sm">Nenhum usuario encontrado</p>
						</div>
					)}
				</div>
			</div>
		</PlatformLayout>
	);
};
