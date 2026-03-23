/**
 * Central timezone utilities.
 * Store UTC in DB, convert to display time ONLY for presentation and date filtering.
 * Default timezone is America/Sao_Paulo but can be overridden per-tenant.
 */

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

let _currentTimezone = DEFAULT_TIMEZONE;

/** Set the active timezone (called per-request from tenant config) */
export function setTimezone(tz: string): void {
	if (tz && tz !== _currentTimezone) {
		_currentTimezone = tz;
		_dtfCache.clear();
	}
}

/** Get the active timezone */
export function getTimezone(): string {
	return _currentTimezone;
}

// Formatter cache — recreated when timezone changes
const _dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const cacheKey = `${key}:${_currentTimezone}`;
	let fmt = _dtfCache.get(cacheKey);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: _currentTimezone });
		_dtfCache.set(cacheKey, fmt);
	}
	return fmt;
}

function getISOFormatter(): Intl.DateTimeFormat {
	const cacheKey = `iso:${_currentTimezone}`;
	let fmt = _dtfCache.get(cacheKey);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat("en-CA", {
			timeZone: _currentTimezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		_dtfCache.set(cacheKey, fmt);
	}
	return fmt;
}

/** Format UTC ISO string → "14/03/2026 09:30" in tenant time */
export function toBrazilDateTime(iso: string): string {
	return getFormatter("datetime", {
		day: "2-digit", month: "2-digit", year: "numeric",
		hour: "2-digit", minute: "2-digit",
	}).format(new Date(iso));
}

/** Format UTC ISO string → "14/03/2026" in tenant time */
export function toBrazilDate(iso: string): string {
	return getFormatter("date", {
		day: "2-digit", month: "2-digit", year: "numeric",
	}).format(new Date(iso));
}

/** Format UTC ISO string → "09:30" in tenant time */
export function toBrazilTime(iso: string): string {
	return getFormatter("time", {
		hour: "2-digit", minute: "2-digit",
	}).format(new Date(iso));
}

/** Today's date as YYYY-MM-DD in tenant timezone */
export function todayBrazilISO(): string {
	return getISOFormatter().format(new Date());
}

/** YYYY-MM-DD for N days ago in tenant timezone */
export function daysAgoBrazilISO(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return getISOFormatter().format(d);
}

// Keep legacy export name for backward compat
export const TIMEZONE = DEFAULT_TIMEZONE;
