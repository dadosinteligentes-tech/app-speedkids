import type { FC } from "hono/jsx";
import { toBrazilDateTime, toBrazilDate, todayBrazilISO, daysAgoBrazilISO } from "./timezone";

/** Format integer cents as "R$ 1.234,56" */
export function formatCurrency(cents: number): string {
	return (
		"R$ " +
		(cents / 100).toLocaleString("pt-BR", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
	);
}

/** Format ISO datetime string as "14/03/2026 09:30" (Brazil timezone) */
export function formatDateTime(iso: string): string {
	return toBrazilDateTime(iso);
}

/** Format ISO date string as "14/03/2026" (Brazil timezone) */
export function formatDate(iso: string): string {
	return toBrazilDate(iso);
}

/** Returns today's date in YYYY-MM-DD (Brazil timezone) */
export function todayISO(): string {
	return todayBrazilISO();
}

/** Returns YYYY-MM-DD for N days ago (Brazil timezone) */
export function daysAgoISO(n: number): string {
	return daysAgoBrazilISO(n);
}

interface HBarProps {
	label: string;
	value: number;
	pct: number;
	display: string;
	color?: string;
}

/** CSS-only horizontal bar chart row */
export const HBar: FC<HBarProps> = ({
	label,
	value,
	pct,
	display,
	color = "bg-sk-orange",
}) => (
	<div class="flex items-center gap-3 py-1.5">
		<span
			class="w-32 text-xs font-body text-sk-muted truncate flex-shrink-0"
			title={label}
		>
			{label}
		</span>
		<div class="flex-1 bg-sk-yellow-light rounded-full h-3 overflow-hidden">
			<div
				class={`h-full ${color} rounded-full`}
				style={`width:${Math.max(pct, 1)}%`}
				role="progressbar"
				aria-valuenow={String(value) as any}
				aria-valuemin="0"
				aria-valuemax="100"
			/>
		</div>
		<span class="w-28 text-xs font-body text-sk-text text-right flex-shrink-0">
			{display}
		</span>
	</div>
);
