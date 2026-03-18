/**
 * Central timezone utilities for Brazil (America/Sao_Paulo).
 * Store UTC in DB, convert to Brazil time ONLY for display and date filtering.
 */

export const TIMEZONE = "America/Sao_Paulo";

const dtfDateTime = new Intl.DateTimeFormat("pt-BR", {
	timeZone: TIMEZONE,
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

const dtfDate = new Intl.DateTimeFormat("pt-BR", {
	timeZone: TIMEZONE,
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

const dtfTime = new Intl.DateTimeFormat("pt-BR", {
	timeZone: TIMEZONE,
	hour: "2-digit",
	minute: "2-digit",
});

const dtfISO = new Intl.DateTimeFormat("en-CA", {
	timeZone: TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** Format UTC ISO string → "14/03/2026 09:30" in Brazil time */
export function toBrazilDateTime(iso: string): string {
	return dtfDateTime.format(new Date(iso));
}

/** Format UTC ISO string → "14/03/2026" in Brazil time */
export function toBrazilDate(iso: string): string {
	return dtfDate.format(new Date(iso));
}

/** Format UTC ISO string → "09:30" in Brazil time */
export function toBrazilTime(iso: string): string {
	return dtfTime.format(new Date(iso));
}

/** Today's date as YYYY-MM-DD in Brazil timezone */
export function todayBrazilISO(): string {
	return dtfISO.format(new Date());
}

/** YYYY-MM-DD for N days ago in Brazil timezone */
export function daysAgoBrazilISO(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return dtfISO.format(d);
}
