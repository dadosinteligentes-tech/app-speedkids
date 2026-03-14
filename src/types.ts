import type { Hono } from "hono";

export type Bindings = { DB: D1Database };

export type AppVariables = {
	user: { id: number; name: string; email: string; role: string } | null;
	posId: number | null;
};

export type AppEnv = {
	Bindings: Bindings;
	Variables: AppVariables;
};
