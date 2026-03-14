import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { LoginPage } from "../../views/login";

export const loginPages = new Hono<AppEnv>();

loginPages.get("/login", async (c) => {
	return c.html(<LoginPage />);
});
