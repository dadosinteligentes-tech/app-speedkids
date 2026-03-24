import type { FC } from "hono/jsx";
import type { Asset, Battery, RentalSessionView } from "../../db/schema";

interface AssetCardProps {
	asset: Asset;
	session: RentalSessionView | null;
	battery?: Battery | null;
}

export const AssetCard: FC<AssetCardProps> = ({ asset, session, battery }) => {
	const isAvailable = !session && asset.status === "available";
	const isMaintenance = asset.status === "maintenance";
	const isRunning = session?.status === "running";
	const isPaused = session?.status === "paused";
	const isPendingPayment = session?.status === "completed" && !session?.paid;
	const hasSession = isRunning || isPaused || isPendingPayment;
	const usesBattery = !!asset.uses_battery;

	let cardStyle = "bg-sk-green-light border-sk-green";
	let statusText = "Disponível";

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

	const cardStatus = isMaintenance ? "maintenance"
		: isPendingPayment ? "pending_payment"
		: isRunning ? "running"
		: isPaused ? "paused"
		: "available";

	return (
		<div
			data-asset-id={String(asset.id)}
			data-asset-name={asset.name}
			data-sort-order={String(asset.sort_order)}
			data-asset-type={asset.asset_type}
			data-card-status={cardStatus}
			data-uses-battery={usesBattery ? "1" : "0"}
			data-battery-minutes={battery ? String(battery.estimated_minutes_remaining) : ""}
			data-battery-full={battery ? String(battery.full_charge_minutes) : ""}
			data-battery-id={battery ? String(battery.id) : ""}
			class={`rounded-sk border-2 p-4 shadow-sk-sm transition-all card-wobble ${cardStyle}`}
		>
			{/* Header with optional photo */}
			<div class="flex items-center gap-3 mb-2">
				{photoUrl ? (
					<img
						src={`/api/assets/photo/${photoUrl}`}
						alt={asset.name}
						class="asset-photo w-16 h-16 rounded-sk object-cover flex-shrink-0"
					/>
				) : (
					<div class="asset-photo w-16 h-16 rounded-sk bg-sk-yellow-light flex items-center justify-center flex-shrink-0 text-3xl sk-float">
						🎮
					</div>
				)}
				<h3 class="font-display font-bold text-sk-text truncate flex-1">{asset.name}</h3>
				{usesBattery && (
					<button
						onclick={`showBatterySwap(${asset.id})`}
						class="battery-swap-btn text-lg flex-shrink-0 active:scale-90 transition-transform"
						title="Trocar bateria"
					>
						🔋
					</button>
				)}
				<span class={`status-dot w-3 h-3 rounded-full flex-shrink-0 ${
					isMaintenance ? "bg-gray-400" :
					isPendingPayment ? "bg-sk-yellow" :
					isRunning ? "bg-sk-blue" :
					isPaused ? "bg-sk-blue/60" :
					"bg-sk-green"
				}`}></span>
			</div>

			{/* Asset restrictions info */}
			{(asset.max_weight_kg || asset.min_age || asset.max_age) && (
				<div class="text-xs text-sk-muted font-body mb-1 flex gap-2 flex-wrap">
					{asset.max_weight_kg ? <span>Max {asset.max_weight_kg}kg</span> : null}
					{(asset.min_age || asset.max_age) ? (
						<span>{asset.min_age ?? "?"}-{asset.max_age ?? "?"} anos</span>
					) : null}
				</div>
			)}

			{/* Battery indicator */}
			{usesBattery && (
				<div class="battery-indicator mb-1 cursor-pointer active:opacity-70" onclick={`showBatteryLevel(${asset.id})`}>
					<div class="flex items-center gap-1.5 text-xs">
						<div class="battery-icon w-6 h-3 border border-current rounded-sm relative flex-shrink-0">
							<div class={`battery-fill absolute inset-0.5 rounded-sm transition-all ${
								battery
									? battery.estimated_minutes_remaining / battery.full_charge_minutes > 0.5 ? "bg-sk-green" :
									  battery.estimated_minutes_remaining / battery.full_charge_minutes > 0.25 ? "bg-sk-yellow" :
									  "bg-sk-danger"
									: "bg-gray-300"
							}`} style={battery ? `width:${Math.round((battery.estimated_minutes_remaining / battery.full_charge_minutes) * 100)}%` : "width:0%"}></div>
							<div class="absolute -right-1 top-0.5 w-0.5 h-1.5 bg-current rounded-r-sm"></div>
						</div>
						<span class={`battery-minutes font-display font-medium ${
							battery
								? battery.estimated_minutes_remaining / battery.full_charge_minutes > 0.5 ? "text-sk-green-dark" :
								  battery.estimated_minutes_remaining / battery.full_charge_minutes > 0.25 ? "text-sk-yellow-dark" :
								  "text-sk-danger"
								: "text-gray-400"
						}`}>{battery ? `${battery.estimated_minutes_remaining} min` : "Sem bateria"}</span>
					</div>
				</div>
			)}

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
				<div class="delivery-time text-xs text-sk-muted mt-1 font-body hidden"></div>
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
						{session.paid ? (
							<button
								onclick={`window.open('/receipts/rental/${session.id}','_blank')`}
								class="btn-touch px-3 py-3 bg-white/80 text-sk-text rounded-sk text-lg active:bg-white"
								title="Imprimir comprovante"
							>
								&#128424;
							</button>
						) : null}
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
						{session.paid ? (
							<button
								onclick={`window.open('/receipts/rental/${session.id}','_blank')`}
								class="btn-touch px-3 py-3 bg-white/80 text-sk-text rounded-sk text-lg active:bg-white"
								title="Imprimir comprovante"
							>
								&#128424;
							</button>
						) : null}
					</>
				) : null}
			</div>
		</div>
	);
};
