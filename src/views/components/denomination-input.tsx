import type { FC } from "hono/jsx";
import { DENOMINATIONS } from "../../lib/denominations";

interface DenominationInputProps {
	/** Unique prefix for element IDs (e.g., 'open', 'close', 'pay', 'tx') */
	prefix: string;
	/** Whether to show a total display */
	showTotal?: boolean;
	/** Label for the total display */
	totalLabel?: string;
}

/** Color map for each denomination (bg, text, badge) */
const DENOM_STYLES: Record<number, { bg: string; text: string; badge: string }> = {
	20000: { bg: "bg-gray-100", text: "text-gray-700", badge: "bg-gray-600" },
	10000: { bg: "bg-sky-100", text: "text-sky-700", badge: "bg-sky-600" },
	5000: { bg: "bg-orange-100", text: "text-orange-700", badge: "bg-orange-500" },
	2000: { bg: "bg-yellow-100", text: "text-yellow-700", badge: "bg-yellow-500" },
	1000: { bg: "bg-violet-100", text: "text-violet-700", badge: "bg-violet-500" },
	500: { bg: "bg-purple-100", text: "text-purple-700", badge: "bg-purple-500" },
	200: { bg: "bg-blue-100", text: "text-blue-700", badge: "bg-blue-500" },
	100: { bg: "bg-amber-100", text: "text-amber-700", badge: "bg-amber-600" },
	50: { bg: "bg-amber-100", text: "text-amber-700", badge: "bg-amber-600" },
	25: { bg: "bg-zinc-200", text: "text-zinc-600", badge: "bg-zinc-500" },
	10: { bg: "bg-zinc-200", text: "text-zinc-600", badge: "bg-zinc-500" },
	5: { bg: "bg-zinc-200", text: "text-zinc-600", badge: "bg-zinc-500" },
};

export const DenominationInput: FC<DenominationInputProps> = ({
	prefix,
	showTotal = true,
	totalLabel = "Total",
}) => {
	const notes = DENOMINATIONS.filter((d) => d.type === "note");
	const coins = DENOMINATIONS.filter((d) => d.type === "coin");

	return (
		<div id={`${prefix}-denom-grid`} class="space-y-3">
			<p class="text-xs font-display font-medium text-sk-muted uppercase tracking-wide">
				Notas
			</p>
			<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
				{notes.map((d) => {
					const s = DENOM_STYLES[d.cents];
					return (
						<div
							class={`relative ${s.bg} ${s.text} rounded-sk p-3 min-h-[64px] cursor-pointer select-none active:scale-95 transition-transform flex items-center justify-center`}
							onclick={`denomIncrement('${prefix}',${d.cents})`}
						>
							<input type="hidden" id={`${prefix}-d-${d.cents}`} value="0" />
							<span class="text-lg font-display font-bold">{d.label}</span>
							<span
								id={`${prefix}-badge-${d.cents}`}
								class={`hidden absolute -top-2 -right-2 w-7 h-7 rounded-full ${s.badge} text-white font-bold text-sm flex items-center justify-center shadow-md`}
							>
								0
							</span>
							<button
								id={`${prefix}-dec-${d.cents}`}
								type="button"
								class="hidden absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white/80 text-sk-danger font-bold text-base shadow-sm active:scale-90 transition-transform flex items-center justify-center"
								onclick={`event.stopPropagation();denomDecrement('${prefix}',${d.cents})`}
							>
								&minus;
							</button>
						</div>
					);
				})}
			</div>

			<p class="text-xs font-display font-medium text-sk-muted uppercase tracking-wide">
				Moedas
			</p>
			<div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
				{coins.map((d) => {
					const s = DENOM_STYLES[d.cents];
					return (
						<div
							class={`relative ${s.bg} ${s.text} rounded-sk p-2 min-h-[56px] cursor-pointer select-none active:scale-95 transition-transform flex items-center justify-center`}
							onclick={`denomIncrement('${prefix}',${d.cents})`}
						>
							<input type="hidden" id={`${prefix}-d-${d.cents}`} value="0" />
							<span class="text-base font-display font-bold">{d.label}</span>
							<span
								id={`${prefix}-badge-${d.cents}`}
								class={`hidden absolute -top-2 -right-2 w-7 h-7 rounded-full ${s.badge} text-white font-bold text-sm flex items-center justify-center shadow-md`}
							>
								0
							</span>
							<button
								id={`${prefix}-dec-${d.cents}`}
								type="button"
								class="hidden absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white/80 text-sk-danger font-bold text-base shadow-sm active:scale-90 transition-transform flex items-center justify-center"
								onclick={`event.stopPropagation();denomDecrement('${prefix}',${d.cents})`}
							>
								&minus;
							</button>
						</div>
					);
				})}
			</div>

			{showTotal && (
				<div class="bg-sk-green-light rounded-sk p-3 text-center mt-2">
					<p class="text-xs text-sk-muted font-body">{totalLabel}</p>
					<p
						id={`${prefix}-denom-total`}
						class="text-2xl font-display font-bold text-sk-green-dark"
					>
						R$ 0,00
					</p>
				</div>
			)}
		</div>
	);
};

/** Export DENOM_STYLES for use in change display rendering */
export { DENOM_STYLES };
