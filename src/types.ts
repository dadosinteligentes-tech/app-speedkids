import type { Hono } from "hono";

export type Bindings = { DB: D1Database; B_BUCKET_SPEEDKIDS: R2Bucket };

export type AppVariables = {
	user: { id: number; name: string; email: string; role: string } | null;
	posId: number | null;
	_rolePermissions?: string[];
};

export type AppEnv = {
	Bindings: Bindings;
	Variables: AppVariables;
};
