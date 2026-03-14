import type { FC } from "hono/jsx";
import type { Asset, RentalSessionView } from "../../db/schema";
import { Layout } from "../layout";

interface AssetHistoryProps {
	asset: Asset;
	sessions: RentalSessionView[];
	total: number;
	page: number;
	user: { name: string; role: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
	running: "Em uso",
	paused: "Pausado",
	completed: "Concluído",
	cancelled: "Cancelado",
};

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const AssetHistory: FC<AssetHistoryProps> = ({ asset, sessions, total, page, user }) => {
	const perPage = 50;
	const totalPages = Math.ceil(total / perPage);

	return (
		<Layout title={`SpeedKids - Histórico: ${asset.name}`} user={user}>
			<div class="mb-4">
				<a href="/" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Dashboard</a>
			</div>

			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">Histórico: {asset.name}</h2>
				<span class="text-sm text-sk-muted font-body">{total} locações</span>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-left text-sk-muted">
						<tr>
							<th class="px-4 py-3 font-medium">Data</th>
							<th class="px-4 py-3 font-medium">Pacote</th>
							<th class="px-4 py-3 font-medium">Duração</th>
							<th class="px-4 py-3 font-medium">Valor</th>
							<th class="px-4 py-3 font-medium">Status</th>
							<th class="px-4 py-3 font-medium hidden md:table-cell">Pagamento</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{sessions.map((s) => (
							<tr class="hover:bg-sk-yellow-light">
								<td class="px-4 py-3 text-xs text-sk-muted whitespace-nowrap">{formatDate(s.start_time)}</td>
								<td class="px-4 py-3">{s.package_name}</td>
								<td class="px-4 py-3 text-sk-muted">{s.duration_minutes} min</td>
								<td class="px-4 py-3 text-sk-muted">R$ {(s.amount_cents / 100).toFixed(2).replace(".", ",")}</td>
								<td class="px-4 py-3">
									<span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
										s.status === "completed" ? "bg-sk-green-light text-sk-green-dark" :
										s.status === "cancelled" ? "bg-sk-danger-light text-sk-danger" :
										"bg-sk-blue-light text-sk-blue-dark"
									}`}>
										{STATUS_LABELS[s.status] ?? s.status}
									</span>
								</td>
								<td class="px-4 py-3 text-sk-muted text-xs hidden md:table-cell">
									{s.paid ? (s.payment_method ?? "—") : "Não pago"}
								</td>
							</tr>
						))}
						{sessions.length === 0 && (
							<tr>
								<td colspan={6} class="px-4 py-8 text-center text-sk-muted font-body">Nenhuma locação registrada</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div class="flex justify-center gap-2 mt-4">
					{page > 1 && (
						<a href={`?page=${page - 1}`} class="px-3 py-1 bg-sk-surface border rounded-sk text-sm font-body hover:bg-sk-yellow-light">Anterior</a>
					)}
					<span class="px-3 py-1 text-sm text-sk-muted font-body">Página {page} de {totalPages}</span>
					{page < totalPages && (
						<a href={`?page=${page + 1}`} class="px-3 py-1 bg-sk-surface border rounded-sk text-sm font-body hover:bg-sk-yellow-light">Próxima</a>
					)}
				</div>
			)}
		</Layout>
	);
};
