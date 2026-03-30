export interface Tenant {
	id: number;
	slug: string;
	name: string;
	status: "active" | "suspended" | "cancelled";
	plan: string;
	logo_url: string | null;
	primary_color: string;
	timezone: string;
	owner_email: string;
	max_users: number;
	max_assets: number;
	setup_completed: number;
	created_at: string;
	updated_at: string;
}

export interface Package {
	id: number;
	tenant_id: number;
	name: string;
	duration_minutes: number;
	price_cents: number;
	overtime_block_minutes: number;
	overtime_block_price_cents: number;
	grace_period_minutes: number;
	active: number;
	is_extension: number;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface AssetType {
	id: number;
	tenant_id: number;
	name: string;
	label: string;
	created_at: string;
}

export interface Asset {
	id: number;
	tenant_id: number;
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
	tenant_id: number;
	name: string;
	phone: string | null;
	email: string | null;
	cpf: string | null;
	instagram: string | null;
	notes: string | null;
	total_rentals: number;
	total_spent_cents: number;
	loyalty_points: number;
	email_verified: number;
	email_verified_at: string | null;
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
	tenant_id: number;
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
	promotion_id: number | null;
	discount_cents: number;
	loyalty_discount_cents: number;
	loyalty_points_redeemed: number;
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
	tenant_id: number;
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
	tenant_id: number;
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
	tenant_id: number;
	user_id: number;
	name: string | null;
	started_at: string;
	ended_at: string | null;
	notes: string | null;
	created_at: string;
}

export interface CashRegister {
	id: number;
	tenant_id: number;
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
	tenant_id: number;
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
	tenant_id: number;
	cash_register_id: number | null;
	customer_id: number | null;
	attendant_id: number | null;
	total_cents: number;
	discount_cents: number;
	promotion_id: number | null;
	payment_method: "cash" | "credit" | "debit" | "pix" | "mixed" | null;
	paid: number;
	loyalty_discount_cents: number;
	loyalty_points_redeemed: number;
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
	tenant_id: number;
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
	tenant_id: number;
	name: string;
	cnpj: string | null;
	address: string | null;
	phone: string | null;
	receipt_footer: string | null;
	updated_at: string;
}

export interface Permission {
	id: number;
	key: string;
	label: string;
	description: string | null;
	category: string;
	sort_order: number;
	created_at: string;
}

export interface RolePermission {
	role: string;
	permission_key: string;
	created_at: string;
}

export interface Subscription {
	id: number;
	tenant_id: number;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	plan: string;
	status: "active" | "past_due" | "cancelled" | "trialing";
	current_period_start: string | null;
	current_period_end: string | null;
	created_at: string;
	updated_at: string;
}

export interface EmailLog {
	id: number;
	tenant_id: number | null;
	recipient: string;
	subject: string;
	event_type: string;
	status: "sent" | "failed" | "skipped";
	error_message: string | null;
	metadata: string | null;
	created_at: string;
}

export interface Promotion {
	id: number;
	tenant_id: number;
	name: string;
	description: string | null;
	discount_type: "percentage" | "fixed";
	discount_value: number;
	active: number;
	created_at: string;
	updated_at: string;
}

export interface SalesGoal {
	id: number;
	tenant_id: number;
	title: string;
	goal_type: "revenue" | "rental_count" | "product_sale_count";
	period_type: "daily" | "weekly" | "monthly" | "custom";
	target_value: number;
	user_id: number | null;
	start_date: string;
	end_date: string;
	active: number;
	celebration_message: string | null;
	created_by: number;
	created_at: string;
	updated_at: string;
}

export interface GoalAchievement {
	id: number;
	goal_id: number;
	user_id: number;
	achieved_at: string;
	achieved_value: number;
}

export interface SalesGoalProgress extends SalesGoal {
	current_value: number;
	percentage: number;
	achieved: boolean;
	user_name: string | null;
	created_by_name: string;
}

export interface SupportTicket {
	id: number;
	tenant_id: number;
	subject: string;
	status: "open" | "awaiting_reply" | "resolved" | "closed";
	priority: "low" | "normal" | "high" | "urgent";
	created_by: number;
	created_at: string;
	updated_at: string;
}

export interface TicketMessage {
	id: number;
	ticket_id: number;
	sender_type: "tenant" | "platform";
	sender_id: number;
	sender_name: string;
	message: string;
	attachment_key: string | null;
	attachment_name: string | null;
	attachment_type: string | null;
	read: number;
	created_at: string;
}

export interface CrmLead {
	id: number;
	company_name: string;
	contact_name: string;
	contact_role: string | null;
	email: string | null;
	whatsapp: string | null;
	social_profile: string | null;
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	location_type: "shopping" | "condominio" | "praca" | "evento" | null;
	status: "novo" | "contatado" | "proposta_enviada" | "negociacao" | "ganho" | "perdido";
	loss_reason: string | null;
	lead_source: "maps" | "indicacao" | "ativo";
	last_contact_at: string | null;
	next_followup_at: string | null;
	flow_potential: "baixo" | "medio" | "alto";
	has_competition: number;
	map_embed: string | null;
	estimated_value_cents: number;
	tags: string | null;
	temperature: "frio" | "morno" | "quente";
	converted_tenant_id: number | null;
	created_at: string;
	updated_at: string;
}

export interface CrmLeadNote {
	id: number;
	lead_id: number;
	user_id: number;
	user_name: string;
	note: string;
	next_step: string;
	created_at: string;
}

export interface DocumentTemplate {
	id: number;
	tenant_id: number;
	name: string;
	description: string | null;
	content: string;
	print_mode: "mandatory" | "optional";
	is_active: number;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface RentalSignedDocument {
	id: number;
	rental_session_id: string;
	template_id: number;
	tenant_id: number;
	printed_at: string;
	printed_by: number | null;
}

export interface LoyaltyConfig {
	id: number;
	tenant_id: number;
	enabled: number;
	points_per_real: number;
	min_redemption_points: number;
	points_value_cents: number;
	tiers_json: string | null;
	expiry_months: number | null;
	bonus_first_purchase: number;
	bonus_birthday: number;
	bonus_referral: number;
	double_points_weekends: number;
	redemption_options_json: string | null;
	created_at: string;
	updated_at: string;
}

export interface LoyaltyTier {
	name: string;
	min_points: number;
}

export interface LoyaltyRedemptionOption {
	type: "discount" | "extra_time" | "gift" | "cashback";
	label: string;
	points_cost: number;
	value: string;
	active: boolean;
}

export interface LoyaltyTransaction {
	id: number;
	tenant_id: number;
	customer_id: number;
	type: "earned" | "redeemed" | "adjusted" | "expired";
	points: number;
	balance_after: number;
	reference_type: string | null;
	reference_id: string | null;
	description: string | null;
	recorded_by: number | null;
	created_at: string;
}

export interface BlogPost {
	id: number;
	slug: string;
	title: string;
	description: string;
	icon: string;
	cover_image_url: string | null;
	reading_time: string;
	sections: string; // JSON stringified array of { heading, content }
	cta_text: string | null;
	cta_href: string | null;
	published: number;
	published_at: string | null;
	created_at: string;
	updated_at: string;
}
