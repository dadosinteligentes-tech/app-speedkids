import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { OperationLogView } from "../../db/queries/logs";
import { AdminLayout } from "./layout";
import { toBrazilDateTime } from "../../lib/timezone";
import type { Tenant } from "../../db/schema";

interface OperationLogsProps {
	logs: OperationLogView[];
	total: number;
	page: number;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const ACTION_LABELS: Record<string, string> = {
	"rental.start": "Locação iniciada",
	"rental.pause": "Locação pausada",
	"rental.resume": "Locação retomada",
	"rental.stop": "Locação encerrada",
	"rental.pay": "Pagamento registrado",
	"rental.extend": "Tempo estendido",
	"asset.create": "Ativo criado",
	"asset.update": "Ativo atualizado",
	"asset.retire": "Ativo aposentado",
	"package.create": "Pacote criado",
	"package.update": "Pacote atualizado",
	"package.toggle": "Pacote ativado/desativado",
	"user.create": "Usuário criado",
	"user.update": "Usuário atualizado",
	"user.deactivate": "Usuário desativado",
	"auth.login": "Login",
	"auth.logout": "Logout",
};

function formatDate(iso: string): string {
	return toBrazilDateTime(iso);
}

export const OperationLogs: FC<OperationLogsProps> = ({ logs, total, page, user, tenant, isPlatformAdmin, planFeatures }) => {
	const perPage = 50;
	const totalPages = Math.ceil(total / perPage);

	const script = html`<script>
${raw(`
function filterLogs() {
	var type = document.getElementById('filter-type').value;
	var params = new URLSearchParams(window.location.search);
	if (type) params.set('entity_type', type);
	else params.delete('entity_type');
	params.delete('page');
	window.location.search = params.toString();
}
`)}
</script>`;

	return (
		<AdminLayout title="Logs de Operação" user={user} activeTab="/admin/logs" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">Logs de Operação</h2>
				<div class="flex items-center gap-2">
					<select id="filter-type" onchange="filterLogs()" class="px-3 py-2 border border-sk-border rounded-sk text-sm font-body focus:ring-sk-blue/30 focus:border-sk-blue">
						<option value="">Todos</option>
						<option value="rental">Locações</option>
						<option value="asset">Ativos</option>
						<option value="package">Pacotes</option>
						<option value="user">Usuários</option>
						<option value="auth">Autenticação</option>
					</select>
				</div>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-x-auto">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium">Data</th>
							<th class="px-4 py-3 font-medium">Usuário</th>
							<th class="px-4 py-3 font-medium">Ação</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Detalhes</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{logs.map((log) => (
							<tr class="hover:bg-sk-yellow-light">
								<td class="px-4 py-3 text-sk-muted text-xs whitespace-nowrap">{formatDate(log.created_at)}</td>
								<td class="px-4 py-3">{log.user_name ?? "Sistema"}</td>
								<td class="px-4 py-3">{ACTION_LABELS[log.action] ?? log.action}</td>
								<td class="px-4 py-3 text-sk-muted text-xs hidden md:table-cell max-w-xs truncate">
									{log.details ?? "—"}
								</td>
							</tr>
						))}
						{logs.length === 0 && (
							<tr>
								<td colspan={4} class="px-4 py-8 text-center text-gray-400 font-body">Nenhum registro encontrado</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div class="flex justify-center gap-2 mt-4">
					{page > 1 && (
						<a href={`?page=${page - 1}`} class="btn-bounce px-3 py-1 bg-sk-surface text-sk-muted rounded-sk border text-sm hover:bg-sk-yellow-light">Anterior</a>
					)}
					<span class="px-3 py-1 text-sm text-sk-muted font-body">Página {page} de {totalPages}</span>
					{page < totalPages && (
						<a href={`?page=${page + 1}`} class="btn-bounce px-3 py-1 bg-sk-surface text-sk-muted rounded-sk border text-sm hover:bg-sk-yellow-light">Próxima</a>
					)}
				</div>
			)}
		</AdminLayout>
	);
};
