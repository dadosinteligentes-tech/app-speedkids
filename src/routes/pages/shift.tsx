import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getActiveShift } from "../../db/queries/shifts";
import { getOpenRegister } from "../../db/queries/cash-registers";
import { getCashStatus } from "../../lib/cash-status";
import { ClockInOut } from "../../views/shift/clock-in-out";

export const shiftPages = new Hono<AppEnv>();

shiftPages.get("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.redirect("/login");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const tenantId = c.get("tenant_id");
	const [shift, register, cashStatus] = await Promise.all([
		getActiveShift(c.env.DB, tenantId, user.id),
		getOpenRegister(c.env.DB, tenantId),
		getCashStatus(c.env.DB, tenantId),
	]);
	return c.html(<ClockInOut shift={shift} register={register} user={user} cashStatus={cashStatus} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});
