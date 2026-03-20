export interface Package {
	id: number;
	name: string;
	duration_minutes: number;
	price_cents: number;
	overtime_block_minutes: number;
	overtime_block_price_cents: number;
	grace_period_minutes: number;
	active: number;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface AssetType {
	id: number;
	name: string;
	label: string;
	created_at: string;
}

export interface Asset {
	id: number;
	name: string;
	asset_type: string;
	status: "available" | "in_use" | "maintenance" | "retired";
	pos_id: number | null;
	model: string | null;
	photo_url: string | null;
	battery_level: number | null;
	uses_battery: number;
	max_weight_kg: number | null;
	min_age: number | null;
	max_age: number | null;
	sort_order: number;
	last_maintenance_at: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface Customer {
	id: number;
	name: string;
	phone: string | null;
	email: string | null;
	cpf: string | null;
	instagram: string | null;
	notes: string | null;
	total_rentals: number;
	total_spent_cents: number;
	loyalty_points: number;
	created_at: string;
	updated_at: string;
}

export interface Child {
	id: number;
	customer_id: number;
	name: string;
	age: number;
	birth_date: string | null;
	created_at: string;
	updated_at: string;
}

export interface RentalSession {
	id: string;
	asset_id: number;
	package_id: number;
	pos_id: number | null;
	attendant_id: number | null;
	customer_id: number | null;
	child_id: number | null;
	cash_register_id: number | null;
	status: "running" | "paused" | "completed" | "cancelled";
	start_time: string;
	pause_time: string | null;
	total_paused_ms: number;
	end_time: string | null;
	duration_minutes: number;
	amount_cents: number;
	overtime_minutes: number;
	overtime_cents: number;
	payment_method: "cash" | "credit" | "debit" | "pix" | "mixed" | null;
	paid: number;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface SessionPause {
	id: number;
	session_id: string;
	paused_at: string;
	resumed_at: string | null;
	duration_ms: number | null;
	created_at: string;
}

/** Rental session joined with asset and package info for dashboard display */
export interface RentalSessionView extends RentalSession {
	asset_name: string;
	asset_type: string;
	asset_photo_url: string | null;
	package_name: string;
	customer_name: string | null;
	customer_phone: string | null;
	child_name: string | null;
	child_age: number | null;
}

export interface User {
	id: number;
	name: string;
	email: string;
	password_hash: string;
	salt: string;
	role: "operator" | "manager" | "owner";
	active: number;
	created_at: string;
	updated_at: string;
}

export interface AuthSession {
	id: string;
	user_id: number;
	expires_at: string;
	created_at: string;
}

export interface OperationLog {
	id: number;
	user_id: number | null;
	action: string;
	entity_type: string;
	entity_id: string | null;
	details: string | null;
	ip_address: string | null;
	created_at: string;
}

export interface Shift {
	id: number;
	user_id: number;
	name: string | null;
	started_at: string;
	ended_at: string | null;
	notes: string | null;
	created_at: string;
}

export interface CashRegister {
	id: number;
	shift_id: number | null;
	opened_by: number;
	closed_by: number | null;
	opening_balance_cents: number;
	closing_balance_cents: number | null;
	expected_balance_cents: number | null;
	status: "open" | "closed";
	opened_at: string;
	closed_at: string | null;
	created_at: string;
}

export interface CashTransaction {
	id: number;
	cash_register_id: number;
	rental_session_id: string | null;
	product_sale_id: number | null;
	type: "rental_payment" | "product_sale" | "adjustment" | "withdrawal" | "deposit";
	amount_cents: number;
	payment_method: string | null;
	description: string | null;
	recorded_by: number | null;
	created_at: string;
}

export interface Product {
	id: number;
	name: string;
	description: string | null;
	price_cents: number;
	category: string | null;
	photo_url: string | null;
	active: number;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface ProductSale {
	id: number;
	cash_register_id: number | null;
	customer_id: number | null;
	attendant_id: number | null;
	total_cents: number;
	discount_cents: number;
	payment_method: "cash" | "credit" | "debit" | "pix" | "mixed" | null;
	paid: number;
	notes: string | null;
	created_at: string;
}

export interface ProductSaleItem {
	id: number;
	product_sale_id: number;
	product_id: number;
	product_name: string;
	quantity: number;
	unit_price_cents: number;
	total_cents: number;
	created_at: string;
}

export interface CashRegisterDenomination {
	id: number;
	cash_register_id: number;
	cash_transaction_id: number | null;
	event_type: "opening" | "closing" | "payment_in" | "change_out" | "deposit" | "withdrawal";
	denomination_cents: number;
	quantity: number;
	created_at: string;
}

export interface Battery {
	id: number;
	label: string;
	asset_id: number | null;
	status: "charging" | "ready" | "in_use" | "depleted" | "retired";
	full_charge_minutes: number;
	charge_time_minutes: number;
	estimated_minutes_remaining: number;
	last_charged_at: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface BatteryView extends Battery {
	asset_name: string | null;
}

export interface BusinessConfig {
	id: number;
	name: string;
	cnpj: string | null;
	address: string | null;
	phone: string | null;
	receipt_footer: string | null;
	updated_at: string;
}
