import type { FC } from "hono/jsx";
import { ReportLayout } from "./layout";
import { formatCurrency } from "../../lib/report-utils";
import type { HourBucket, DayBucket } from "../../db/queries/reports";

interface Props {
	byHour: HourBucket[];
	byDay: DayBucket[];
	from: string;
	to: string;
	user: { name: string; role: string } | null;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export const PeakHoursView: FC<Props> = ({
	byHour,
	byDay,
	from,
	to,
	user,
}) => {
	const maxHourCount = Math.max(...byHour.map((h) => h.rental_count), 1);
	const maxDayCount = Math.max(...byDay.map((d) => d.rental_count), 1);

	// Fill all 24 hours (some may be missing from query)
	const hourMap = new Map(byHour.map((h) => [h.hour, h]));
	const allHours = Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		rental_count: hourMap.get(i)?.rental_count ?? 0,
		revenue_cents: hourMap.get(i)?.revenue_cents ?? 0,
	}));

	// Fill all 7 days
	const dayMap = new Map(byDay.map((d) => [d.dow, d]));
	const allDays = Array.from({ length: 7 }, (_, i) => ({
		dow: i,
		rental_count: dayMap.get(i)?.rental_count ?? 0,
		revenue_cents: dayMap.get(i)?.revenue_cents ?? 0,
	}));

	const hasData = byHour.length > 0 || byDay.length > 0;

	return (
		<ReportLayout
			title="Horarios de Pico"
			user={user}
			activeReport="/admin/reports/peak-hours"
			from={from}
			to={to}
		>
			{!hasData && (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center">
					<p class="text-sk-muted font-body">
						Nenhuma locacao encontrada no período selecionado.
					</p>
				</div>
			)}

			{hasData && (
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* By Hour */}
					<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4">
						<h3 class="text-sm font-display font-bold text-sk-text mb-3">
							Por Hora do Dia
						</h3>
						<div class="space-y-1">
							{allHours.map((h) => {
								const pct =
									maxHourCount > 0
										? Math.round(
												(h.rental_count / maxHourCount) * 100,
											)
										: 0;
								const isPeak =
									h.rental_count === maxHourCount && h.rental_count > 0;
								return h.rental_count > 0 ? (
									<a href={`/admin/reports/detail?filter=hour&hour=${h.hour}&from=${from}&to=${to}`} class="flex items-center gap-2 py-0.5 hover:opacity-80 cursor-pointer">
										<span class="w-8 text-xs font-body text-sk-muted text-right">
											{String(h.hour).padStart(2, "0")}h
										</span>
										<div class="flex-1 bg-sk-yellow-light rounded-full h-3 overflow-hidden">
											<div
												class={`h-full rounded-full ${isPeak ? "bg-sk-orange" : "bg-sk-blue"}`}
												style={`width:${Math.max(pct, 2)}%`}
											/>
										</div>
										<span class="w-6 text-xs font-body text-sk-text text-right">
											{h.rental_count} <span class="text-sk-muted">&#8250;</span>
										</span>
									</a>
								) : (
									<div class="flex items-center gap-2 py-0.5">
										<span class="w-8 text-xs font-body text-sk-muted text-right">
											{String(h.hour).padStart(2, "0")}h
										</span>
										<div class="flex-1 bg-sk-yellow-light rounded-full h-3 overflow-hidden" />
										<span class="w-6 text-xs font-body text-sk-text text-right">
											0
										</span>
									</div>
								);
							})}
						</div>
					</div>

					{/* By Day of Week */}
					<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4">
						<h3 class="text-sm font-display font-bold text-sk-text mb-3">
							Por Dia da Semana
						</h3>
						<div class="space-y-2">
							{allDays.map((d) => {
								const pct =
									maxDayCount > 0
										? Math.round(
												(d.rental_count / maxDayCount) * 100,
											)
										: 0;
								const isPeak =
									d.rental_count === maxDayCount && d.rental_count > 0;
								const Wrapper = d.rental_count > 0 ? "a" : "div";
								const wrapperProps = d.rental_count > 0
									? { href: `/admin/reports/detail?filter=dow&dow=${d.dow}&from=${from}&to=${to}`, class: "flex items-center gap-3 py-1 hover:opacity-80 cursor-pointer" }
									: { class: "flex items-center gap-3 py-1" };
								return (
									<Wrapper {...wrapperProps}>
										<span class="w-8 text-xs font-body text-sk-muted font-medium">
											{DAY_NAMES[d.dow]}
										</span>
										<div class="flex-1 bg-sk-yellow-light rounded-full h-4 overflow-hidden">
											<div
												class={`h-full rounded-full ${isPeak ? "bg-sk-orange" : "bg-sk-blue"}`}
												style={`width:${Math.max(pct, d.rental_count > 0 ? 3 : 0)}%`}
											/>
										</div>
										<div class="text-right w-24">
											<span class="text-xs font-body text-sk-text font-medium">
												{d.rental_count} loc.
											</span>
											<span class="text-xs font-body text-sk-muted ml-1">
												{formatCurrency(d.revenue_cents)}
											</span>
											{d.rental_count > 0 && <span class="text-sk-muted text-xs ml-1">&#8250;</span>}
										</div>
									</Wrapper>
								);
							})}
						</div>

						{/* Summary */}
						<div class="mt-4 pt-3 border-t border-sk-border">
							<p class="text-xs text-sk-muted font-body">
								Pico:{" "}
								<span class="font-medium text-sk-orange-dark">
									{(() => {
										const peak = allDays.reduce(
											(best, d) =>
												d.rental_count > best.rental_count
													? d
													: best,
											allDays[0],
										);
										return `${DAY_NAMES[peak.dow]} (${peak.rental_count} locacoes)`;
									})()}
								</span>
							</p>
							<p class="text-xs text-sk-muted font-body mt-1">
								Hora mais movimentada:{" "}
								<span class="font-medium text-sk-orange-dark">
									{(() => {
										const peak = allHours.reduce(
											(best, h) =>
												h.rental_count > best.rental_count
													? h
													: best,
											allHours[0],
										);
										return `${String(peak.hour).padStart(2, "0")}h (${peak.rental_count} locacoes)`;
									})()}
								</span>
							</p>
						</div>
					</div>
				</div>
			)}
		</ReportLayout>
	);
};
