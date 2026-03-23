import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { LoginPage } from "../../views/login";

export const loginPages = new Hono<AppEnv>();

loginPages.get("/login", async (c) => {
	const tenant = c.get("tenant");
	return c.html(<LoginPage tenant={tenant} />);
});
