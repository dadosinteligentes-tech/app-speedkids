// ── Report Query Interfaces ──

export interface FinancialSummary {
	total_revenue_cents: number;
	rental_count: number;
	avg_ticket_cents: number;
	cash_cents: number;
	credit_cents: number;
	debit_cents: number;
	pix_cents: number;
	unpaid_count: number;
	cancelled_count: number;
	total_minutes: number;
}

export interface DailyRevenueTrend {
	day: string;
	revenue_cents: number;
	rental_count: number;
}

export interface PackageRevenue {
	package_id: number;
	package_name: string;
	duration_minutes: number;
	price_cents: number;
	rental_count: number;
	revenue_cents: number;
	revenue_pct: number;
}

export interface AssetUtilization {
	asset_id: number;
	asset_name: string;
	asset_type: string;
	rental_count: number;
	revenue_cents: number;
	total_minutes: number;
	utilization_pct: number;
}

export interface HourBucket {
	hour: number;
	rental_count: number;
	revenue_cents: number;
}

export interface DayBucket {
	dow: number;
	rental_count: number;
	revenue_cents: number;
}

export interface OperatorPerformance {
	user_id: number;
	user_name: string;
	role: string;
	rentals_started: number;
	revenue_cents: number;
	shift_count: number;
	shift_hours: number;
	cash_discrepancy_cents: number;
}

export interface CashRegisterReport {
	id: number;
	opened_by_name: string;
	closed_by_name: string | null;
	opened_at: string;
	closed_at: string | null;
	opening_balance_cents: number;
	closing_balance_cents: number | null;
	expected_balance_cents: number | null;
	discrepancy_cents: number | null;
	status: string;
	rental_payment_cents: number;
	withdrawal_cents: number;
	deposit_cents: number;
	adjustment_cents: number;
	rental_count: number;
}

export interface TopCustomer {
	customer_id: number;
	customer_name: string;
	phone: string | null;
	rental_count: number;
	revenue_cents: number;
}

export interface AgeGroup {
	age_group: string;
	count: number;
}

export interface CustomerStats {
	total_customers: number;
	new_customers: number;
	returning_customers: number;
	avg_spent_cents: number;
}

export interface UnpaidSession {
	id: number;
	child_name: string | null;
	customer_name: string | null;
	asset_name: string;
	package_name: string;
	start_time: string;
	end_time: string | null;
	amount_cents: number;
	payment_method: string | null;
	notes: string | null;
	attendant_name: string | null;
}

export interface CancelledSession {
	id: number;
	child_name: string | null;
	customer_name: string | null;
	asset_name: string;
	package_name: string;
	start_time: string;
	end_time: string | null;
	amount_cents: number;
	notes: string | null;
	attendant_name: string | null;
}

export interface ShiftReport {
	shift_id: number;
	shift_name: string | null;
	user_name: string;
	started_at: string;
	ended_at: string | null;
	rental_count: number;
	revenue_cents: number;
	cash_cents: number;
	credit_cents: number;
	debit_cents: number;
	pix_cents: number;
	courtesy_count: number;
}

// ── Query Functions ──

const EMPTY_FINANCIAL: FinancialSummary = {
	total_revenue_cents: 0,
	rental_count: 0,
	avg_ticket_cents: 0,
	cash_cents: 0,
	credit_cents: 0,
	debit_cents: 0,
	pix_cents: 0,
	unpaid_count: 0,
	cancelled_count: 0,
	total_minutes: 0,
};

export async function getFinancialSummary(
	db: D1Database,
	from: string,
	to: string,
): Promise<FinancialSummary> {
	const row = await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN status = 'completed' AND paid = 1 THEN amount_cents ELSE 0 END), 0) AS total_revenue_cents,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) AS rental_count,
				COALESCE(AVG(CASE WHEN status = 'completed' AND paid = 1 THEN amount_cents END), 0) AS avg_ticket_cents,
				COALESCE(SUM(CASE WHEN payment_method = 'cash'   AND paid = 1 THEN amount_cents ELSE 0 END), 0) AS cash_cents,
				COALESCE(SUM(CASE WHEN payment_method = 'credit' AND paid = 1 THEN amount_cents ELSE 0 END), 0) AS credit_cents,
				COALESCE(SUM(CASE WHEN payment_method = 'debit'  AND paid = 1 THEN amount_cents ELSE 0 END), 0) AS debit_cents,
				COALESCE(SUM(CASE WHEN payment_method = 'pix'    AND paid = 1 THEN amount_cents ELSE 0 END), 0) AS pix_cents,
				COUNT(CASE WHEN status = 'completed' AND paid = 0 THEN 1 END) AS unpaid_count,
				COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count,
				COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END), 0) AS total_minutes
			FROM rental_sessions
			WHERE start_time >= ? AND start_time < date(?, '+1 day')`,
		)
		.bind(from, to)
		.first<FinancialSummary>();

	return row ?? EMPTY_FINANCIAL;
}

export async function getDailyRevenueTrend(
	db: D1Database,
	from: string,
	to: string,
): Promise<DailyRevenueTrend[]> {
	const { results } = await db
		.prepare(
			`SELECT
				date(start_time) AS day,
				COALESCE(SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END), 0) AS revenue_cents,
				COUNT(*) AS rental_count
			FROM rental_sessions
			WHERE start_time >= ? AND start_time < date(?, '+1 day')
				AND status = 'completed'
			GROUP BY date(start_time)
			ORDER BY day ASC`,
		)
		.bind(from, to)
		.all<DailyRevenueTrend>();
	return results;
}

export async function getPackageRevenue(
	db: D1Database,
	from: string,
	to: string,
): Promise<PackageRevenue[]> {
	const { results } = await db
		.prepare(
			`SELECT
				p.id AS package_id,
				p.name AS package_name,
				p.duration_minutes,
				p.price_cents,
				COUNT(rs.id) AS rental_count,
				COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) AS revenue_cents
			FROM packages p
			LEFT JOIN rental_sessions rs
				ON rs.package_id = p.id
				AND rs.status = 'completed'
				AND rs.start_time >= ?
				AND rs.start_time < date(?, '+1 day')
			GROUP BY p.id, p.name, p.duration_minutes, p.price_cents
			ORDER BY revenue_cents DESC`,
		)
		.bind(from, to)
		.all<Omit<PackageRevenue, "revenue_pct">>();

	const total = results.reduce((s, r) => s + r.revenue_cents, 0);
	return results.map((r) => ({
		...r,
		revenue_pct: total > 0 ? Math.round((r.revenue_cents / total) * 100) : 0,
	}));
}

export async function getAssetUtilization(
	db: D1Database,
	from: string,
	to: string,
): Promise<AssetUtilization[]> {
	const { results } = await db
		.prepare(
			`SELECT
				a.id AS asset_id,
				a.name AS asset_name,
				a.asset_type,
				COUNT(rs.id) AS rental_count,
				COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) AS revenue_cents,
				COALESCE(SUM(rs.duration_minutes), 0) AS total_minutes
			FROM assets a
			LEFT JOIN rental_sessions rs
				ON rs.asset_id = a.id
				AND rs.status = 'completed'
				AND rs.start_time >= ?
				AND rs.start_time < date(?, '+1 day')
			WHERE a.status != 'retired'
			GROUP BY a.id, a.name, a.asset_type
			ORDER BY revenue_cents DESC`,
		)
		.bind(from, to)
		.all<Omit<AssetUtilization, "utilization_pct">>();

	const periodDays = Math.max(
		1,
		Math.ceil(
			(new Date(to).getTime() - new Date(from).getTime()) / 86400000,
		) + 1,
	);
	const maxMinutes = periodDays * 8 * 60;

	return results.map((r) => ({
		...r,
		utilization_pct: Math.min(
			100,
			Math.round((r.total_minutes / maxMinutes) * 100),
		),
	}));
}

export async function getPeakHours(
	db: D1Database,
	from: string,
	to: string,
): Promise<{ byHour: HourBucket[]; byDay: DayBucket[] }> {
	const [hourRes, dayRes] = await Promise.all([
		db
			.prepare(
				`SELECT
					CAST(strftime('%H', start_time) AS INTEGER) AS hour,
					COUNT(*) AS rental_count,
					COALESCE(SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END), 0) AS revenue_cents
				FROM rental_sessions
				WHERE status = 'completed'
					AND start_time >= ? AND start_time < date(?, '+1 day')
				GROUP BY hour
				ORDER BY hour ASC`,
			)
			.bind(from, to)
			.all<HourBucket>(),

		db
			.prepare(
				`SELECT
					CAST(strftime('%w', start_time) AS INTEGER) AS dow,
					COUNT(*) AS rental_count,
					COALESCE(SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END), 0) AS revenue_cents
				FROM rental_sessions
				WHERE status = 'completed'
					AND start_time >= ? AND start_time < date(?, '+1 day')
				GROUP BY dow
				ORDER BY dow ASC`,
			)
			.bind(from, to)
			.all<DayBucket>(),
	]);

	return { byHour: hourRes.results, byDay: dayRes.results };
}

export async function getOperatorPerformance(
	db: D1Database,
	from: string,
	to: string,
): Promise<OperatorPerformance[]> {
	const rentalRows = await db
		.prepare(
			`SELECT
				u.id AS user_id,
				u.name AS user_name,
				u.role,
				COUNT(rs.id) AS rentals_started,
				COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) AS revenue_cents
			FROM users u
			LEFT JOIN rental_sessions rs
				ON rs.attendant_id = u.id
				AND rs.start_time >= ?
				AND rs.start_time < date(?, '+1 day')
			WHERE u.active = 1
			GROUP BY u.id, u.name, u.role
			ORDER BY revenue_cents DESC`,
		)
		.bind(from, to)
		.all<{
			user_id: number;
			user_name: string;
			role: string;
			rentals_started: number;
			revenue_cents: number;
		}>();

	const shiftRows = await db
		.prepare(
			`SELECT
				user_id,
				COUNT(*) AS shift_count,
				COALESCE(SUM(
					(julianday(COALESCE(ended_at, datetime('now'))) - julianday(started_at)) * 24
				), 0) AS shift_hours
			FROM shifts
			WHERE started_at >= ? AND started_at < date(?, '+1 day')
			GROUP BY user_id`,
		)
		.bind(from, to)
		.all<{ user_id: number; shift_count: number; shift_hours: number }>();

	const cashRows = await db
		.prepare(
			`SELECT
				opened_by AS user_id,
				COALESCE(SUM(ABS(
					COALESCE(closing_balance_cents, expected_balance_cents) -
					COALESCE(expected_balance_cents, closing_balance_cents)
				)), 0) AS cash_discrepancy_cents
			FROM cash_registers
			WHERE status = 'closed'
				AND opened_at >= ?
				AND opened_at < date(?, '+1 day')
				AND closing_balance_cents IS NOT NULL
				AND expected_balance_cents IS NOT NULL
			GROUP BY opened_by`,
		)
		.bind(from, to)
		.all<{ user_id: number; cash_discrepancy_cents: number }>();

	const shiftMap = new Map(
		shiftRows.results.map((r) => [r.user_id, r]),
	);
	const cashMap = new Map(
		cashRows.results.map((r) => [r.user_id, r]),
	);

	return rentalRows.results.map((r) => ({
		...r,
		shift_count: shiftMap.get(r.user_id)?.shift_count ?? 0,
		shift_hours:
			Math.round((shiftMap.get(r.user_id)?.shift_hours ?? 0) * 10) / 10,
		cash_discrepancy_cents:
			cashMap.get(r.user_id)?.cash_discrepancy_cents ?? 0,
	}));
}

export async function getCashReconciliation(
	db: D1Database,
	from: string,
	to: string,
	limit = 20,
	offset = 0,
): Promise<{ registers: CashRegisterReport[]; total: number }> {
	const countResult = await db
		.prepare(
			`SELECT COUNT(*) AS total FROM cash_registers
			WHERE opened_at >= ? AND opened_at < date(?, '+1 day')`,
		)
		.bind(from, to)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(
			`SELECT
				cr.id,
				u1.name AS opened_by_name,
				u2.name AS closed_by_name,
				cr.opened_at,
				cr.closed_at,
				cr.opening_balance_cents,
				cr.closing_balance_cents,
				cr.expected_balance_cents,
				CASE
					WHEN cr.closing_balance_cents IS NOT NULL AND cr.expected_balance_cents IS NOT NULL
					THEN cr.closing_balance_cents - cr.expected_balance_cents
					ELSE NULL
				END AS discrepancy_cents,
				cr.status,
				COALESCE(SUM(CASE WHEN ct.type = 'rental_payment' THEN ct.amount_cents ELSE 0 END), 0) AS rental_payment_cents,
				COALESCE(SUM(CASE WHEN ct.type = 'withdrawal' THEN ct.amount_cents ELSE 0 END), 0) AS withdrawal_cents,
				COALESCE(SUM(CASE WHEN ct.type = 'deposit' THEN ct.amount_cents ELSE 0 END), 0) AS deposit_cents,
				COALESCE(SUM(CASE WHEN ct.type = 'adjustment' THEN ct.amount_cents ELSE 0 END), 0) AS adjustment_cents,
				COUNT(DISTINCT ct.rental_session_id) AS rental_count
			FROM cash_registers cr
			JOIN users u1 ON cr.opened_by = u1.id
			LEFT JOIN users u2 ON cr.closed_by = u2.id
			LEFT JOIN cash_transactions ct ON ct.cash_register_id = cr.id
			WHERE cr.opened_at >= ? AND cr.opened_at < date(?, '+1 day')
			GROUP BY cr.id
			ORDER BY cr.opened_at DESC
			LIMIT ? OFFSET ?`,
		)
		.bind(from, to, limit, offset)
		.all<CashRegisterReport>();

	return { registers: results, total: countResult?.total ?? 0 };
}

export async function getCustomerAnalysis(
	db: D1Database,
	from: string,
	to: string,
): Promise<{
	topByRevenue: TopCustomer[];
	topByFrequency: TopCustomer[];
	ageGroups: AgeGroup[];
	stats: CustomerStats;
}> {
	const [topRevRes, topFreqRes, ageRes, statsRes, newRes] =
		await Promise.all([
			db
				.prepare(
					`SELECT
						c.id AS customer_id,
						c.name AS customer_name,
						c.phone,
						COUNT(rs.id) AS rental_count,
						COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) AS revenue_cents
					FROM customers c
					JOIN rental_sessions rs ON rs.customer_id = c.id
					WHERE rs.status = 'completed'
						AND rs.start_time >= ?
						AND rs.start_time < date(?, '+1 day')
					GROUP BY c.id, c.name, c.phone
					ORDER BY revenue_cents DESC
					LIMIT 10`,
				)
				.bind(from, to)
				.all<TopCustomer>(),

			db
				.prepare(
					`SELECT
						c.id AS customer_id,
						c.name AS customer_name,
						c.phone,
						COUNT(rs.id) AS rental_count,
						COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) AS revenue_cents
					FROM customers c
					JOIN rental_sessions rs ON rs.customer_id = c.id
					WHERE rs.status = 'completed'
						AND rs.start_time >= ?
						AND rs.start_time < date(?, '+1 day')
					GROUP BY c.id, c.name, c.phone
					ORDER BY rental_count DESC
					LIMIT 10`,
				)
				.bind(from, to)
				.all<TopCustomer>(),

			db
				.prepare(
					`SELECT
						CASE
							WHEN ch.age BETWEEN 1  AND 2  THEN '1-2'
							WHEN ch.age BETWEEN 3  AND 5  THEN '3-5'
							WHEN ch.age BETWEEN 6  AND 8  THEN '6-8'
							WHEN ch.age BETWEEN 9  AND 12 THEN '9-12'
							WHEN ch.age >= 13              THEN '13+'
							ELSE 'Outros'
						END AS age_group,
						COUNT(*) AS count
					FROM rental_sessions rs
					JOIN children ch ON rs.child_id = ch.id
					WHERE rs.status = 'completed'
						AND rs.start_time >= ?
						AND rs.start_time < date(?, '+1 day')
					GROUP BY age_group
					ORDER BY age_group ASC`,
				)
				.bind(from, to)
				.all<AgeGroup>(),

			db
				.prepare(
					`SELECT
						COUNT(DISTINCT customer_id) AS total_customers,
						COALESCE(AVG(customer_revenue), 0) AS avg_spent_cents
					FROM (
						SELECT customer_id,
							SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END) AS customer_revenue
						FROM rental_sessions
						WHERE status = 'completed'
							AND start_time >= ? AND start_time < date(?, '+1 day')
							AND customer_id IS NOT NULL
						GROUP BY customer_id
					)`,
				)
				.bind(from, to)
				.first<{ total_customers: number; avg_spent_cents: number }>(),

			db
				.prepare(
					`SELECT COUNT(*) AS new_customers
					FROM (
						SELECT customer_id, MIN(start_time) AS first_rental
						FROM rental_sessions
						WHERE status = 'completed' AND customer_id IS NOT NULL
						GROUP BY customer_id
					)
					WHERE first_rental >= ? AND first_rental < date(?, '+1 day')`,
				)
				.bind(from, to)
				.first<{ new_customers: number }>(),
		]);

	const total = statsRes?.total_customers ?? 0;
	const newCount = newRes?.new_customers ?? 0;

	return {
		topByRevenue: topRevRes.results,
		topByFrequency: topFreqRes.results,
		ageGroups: ageRes.results,
		stats: {
			total_customers: total,
			new_customers: newCount,
			returning_customers: Math.max(0, total - newCount),
			avg_spent_cents: Math.round(statsRes?.avg_spent_cents ?? 0),
		},
	};
}

export async function getShiftReport(
	db: D1Database,
	from: string,
	to: string,
): Promise<ShiftReport[]> {
	const { results } = await db
		.prepare(`
			SELECT
				s.id as shift_id,
				s.name as shift_name,
				u.name as user_name,
				s.started_at,
				s.ended_at,
				COUNT(rs.id) as rental_count,
				COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as revenue_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'cash' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as cash_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'credit' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as credit_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'debit' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as debit_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'pix' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as pix_cents,
				COUNT(CASE WHEN rs.payment_method = 'courtesy' THEN 1 END) as courtesy_count
			FROM shifts s
			JOIN users u ON s.user_id = u.id
			LEFT JOIN rental_sessions rs ON rs.attendant_id = s.user_id
				AND rs.start_time >= s.started_at
				AND (s.ended_at IS NULL OR rs.start_time <= s.ended_at)
				AND rs.status = 'completed'
			WHERE s.started_at >= ? AND s.started_at < date(?, '+1 day')
			GROUP BY s.id
			ORDER BY s.started_at DESC
		`)
		.bind(from, to)
		.all<ShiftReport>();
	return results;
}

export async function getShiftReportById(
	db: D1Database,
	shiftId: number,
): Promise<ShiftReport | null> {
	return db
		.prepare(`
			SELECT
				s.id as shift_id,
				s.name as shift_name,
				u.name as user_name,
				s.started_at,
				s.ended_at,
				COUNT(rs.id) as rental_count,
				COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as revenue_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'cash' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as cash_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'credit' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as credit_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'debit' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as debit_cents,
				COALESCE(SUM(CASE WHEN rs.payment_method = 'pix' AND rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as pix_cents,
				COUNT(CASE WHEN rs.payment_method = 'courtesy' THEN 1 END) as courtesy_count
			FROM shifts s
			JOIN users u ON s.user_id = u.id
			LEFT JOIN rental_sessions rs ON rs.attendant_id = s.user_id
				AND rs.start_time >= s.started_at
				AND (s.ended_at IS NULL OR rs.start_time <= s.ended_at)
				AND rs.status = 'completed'
			WHERE s.id = ?
			GROUP BY s.id
		`)
		.bind(shiftId)
		.first<ShiftReport>();
}

export async function getUnpaidSessions(
	db: D1Database,
	from: string,
	to: string,
): Promise<UnpaidSession[]> {
	const { results } = await db
		.prepare(
			`SELECT rs.id, ch.name AS child_name, cu.name AS customer_name,
				a.name AS asset_name, p.name AS package_name,
				rs.start_time, rs.end_time, rs.amount_cents,
				rs.payment_method, rs.notes, u.name AS attendant_name
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			LEFT JOIN customers cu ON rs.customer_id = cu.id
			LEFT JOIN children ch ON rs.child_id = ch.id
			LEFT JOIN users u ON rs.attendant_id = u.id
			WHERE rs.status = 'completed'
				AND (rs.paid = 0 OR rs.payment_method = 'courtesy')
				AND rs.start_time >= ? AND rs.start_time < date(?, '+1 day')
			ORDER BY rs.start_time DESC`,
		)
		.bind(from, to)
		.all<UnpaidSession>();
	return results;
}

export async function getCancelledSessions(
	db: D1Database,
	from: string,
	to: string,
): Promise<CancelledSession[]> {
	const { results } = await db
		.prepare(
			`SELECT rs.id, ch.name AS child_name, cu.name AS customer_name,
				a.name AS asset_name, p.name AS package_name,
				rs.start_time, rs.end_time, rs.amount_cents,
				rs.notes, u.name AS attendant_name
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			LEFT JOIN customers cu ON rs.customer_id = cu.id
			LEFT JOIN children ch ON rs.child_id = ch.id
			LEFT JOIN users u ON rs.attendant_id = u.id
			WHERE rs.status = 'cancelled'
				AND rs.start_time >= ? AND rs.start_time < date(?, '+1 day')
			ORDER BY rs.start_time DESC`,
		)
		.bind(from, to)
		.all<CancelledSession>();
	return results;
}
