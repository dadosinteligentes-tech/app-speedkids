import type { FC } from "hono/jsx";
import type { Asset, RentalSessionView } from "../../db/schema";

interface AssetCardProps {
	asset: Asset;
	session: RentalSessionView | null;
}

export const AssetCard: FC<AssetCardProps> = ({ asset, session }) => {
	const isAvailable = !session && asset.status === "available";
	const isMaintenance = asset.status === "maintenance";
	const isRunning = session?.status === "running";
	const isPaused = session?.status === "paused";
	const isPendingPayment = session?.status === "completed" && !session?.paid;
	const hasSession = isRunning || isPaused || isPendingPayment;

	let cardStyle = "bg-sk-green-light border-sk-green";
	let statusText = "Disponivel";

	if (isMaintenance) {
		cardStyle = "bg-gray-100 border-gray-300";
		statusText = "Manutencao";
	} else if (isPendingPayment) {
		cardStyle = "bg-sk-yellow-light border-sk-yellow";
		statusText = "PAGAMENTO PENDENTE";
	} else if (isRunning) {
		cardStyle = "bg-sk-blue-light border-sk-blue";
		statusText = "Em uso";
	} else if (isPaused) {
		cardStyle = "bg-sk-blue-light border-sk-blue/50 opacity-75";
		statusText = "PAUSADO";
	}

	const photoUrl = asset.photo_url;

	return (
		<div
			data-asset-id={String(asset.id)}
			class={`rounded-sk border-2 p-4 shadow-sk-sm transition-all card-wobble ${cardStyle}`}
		>
			{/* Header with optional photo */}
			<div class="flex items-center gap-3 mb-2">
				{photoUrl ? (
					<img
						src={photoUrl}
						alt={asset.name}
						class="asset-photo w-10 h-10 rounded-sk object-cover flex-shrink-0"
					/>
				) : (
					<div class="asset-photo w-10 h-10 rounded-sk bg-sk-yellow-light flex items-center justify-center flex-shrink-0 text-2xl sk-float">
						🎮
					</div>
				)}
				<h3 class="font-display font-bold text-sk-text truncate flex-1">{asset.name}</h3>
				<span class={`status-dot w-3 h-3 rounded-full flex-shrink-0 ${
					isMaintenance ? "bg-gray-400" :
					isPendingPayment ? "bg-sk-yellow" :
					isRunning ? "bg-sk-blue" :
					isPaused ? "bg-sk-blue/60" :
					"bg-sk-green"
				}`}></span>
			</div>

			{/* Person info (guardian + child) */}
			<div class={`person-info text-xs mb-2 ${hasSession && session?.child_name ? "" : "hidden"}`}>
				{hasSession && session?.child_name && (
					<div class="bg-white/70 rounded-sk px-2 py-1.5">
						<div class="font-display font-semibold text-sk-text truncate">
							👦 {session.child_name}{session.child_age ? ` (${session.child_age} anos)` : ""}
						</div>
						{session.customer_name && (
							<div class="text-sk-muted truncate">
								👤 {session.customer_name}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Timer */}
			<div class="text-center my-3">
				<div class="timer-display text-4xl font-display font-bold text-sk-text">
					{session && (isRunning || isPaused) ? "" : ""}
				</div>
				<div class="status-text text-sm font-display font-semibold uppercase tracking-wide mt-1 text-sk-muted">
					{statusText}
				</div>
				<div class="overtime-display text-xs font-display font-bold text-sk-danger mt-1 hidden"></div>
				<div class="package-name text-xs text-sk-muted mt-0.5 font-body">
					{session ? session.package_name : ""}
				</div>
			</div>

			{/* Actions */}
			<div class="card-actions flex gap-2 mt-3">
				{isMaintenance ? (
					<span class="text-sm text-sk-muted w-full text-center py-3 font-body">Indisponivel</span>
				) : isAvailable ? (
					<button
						onclick={`showPackageSelector(${asset.id})`}
						class="btn-touch btn-bounce w-full py-3 bg-sk-green text-white rounded-sk font-display font-bold text-lg active:bg-sk-green-dark shadow-sk-sm"
						aria-label={`Iniciar locacao para ${asset.name}`}
					>
						INICIAR
					</button>
				) : isPendingPayment && session ? (
					<button
						onclick={`reopenPayment('${session.id}',${asset.id})`}
						class="btn-touch btn-bounce w-full py-3 bg-sk-yellow text-sk-text rounded-sk font-display font-bold text-lg active:bg-sk-yellow-dark shadow-sk-sm"
						aria-label="Registrar pagamento"
					>
						PAGAR
					</button>
				) : isPaused && session ? (
					<>
						<button
							onclick={`resumeRental('${session.id}',${asset.id})`}
							class="btn-touch btn-bounce flex-1 py-3 bg-sk-blue text-white rounded-sk font-display font-bold active:bg-sk-blue-dark"
							aria-label="Retomar locacao"
						>
							RETOMAR
						</button>
						<button
							onclick={`stopRental('${session.id}',${asset.id})`}
							class="btn-touch btn-bounce flex-1 py-3 bg-sk-danger text-white rounded-sk font-display font-bold active:bg-red-700"
							aria-label="Parar locacao"
						>
							PARAR
						</button>
					</>
				) : isRunning && session ? (
					<>
						<button
							onclick={`pauseRental('${session.id}',${asset.id})`}
							class="btn-touch btn-bounce flex-1 py-3 bg-sk-yellow text-sk-text rounded-sk font-display font-bold active:bg-sk-yellow-dark"
							aria-label="Pausar locacao"
						>
							PAUSAR
						</button>
						<button
							onclick={`stopRental('${session.id}',${asset.id})`}
							class="btn-touch btn-bounce flex-1 py-3 bg-sk-danger text-white rounded-sk font-display font-bold active:bg-red-700"
							aria-label="Parar locacao"
						>
							PARAR
						</button>
					</>
				) : null}
			</div>
		</div>
	);
};
