/**
 * Request parsing helpers for Hono route handlers.
 * Combines JSON parsing + Zod validation in one step.
 */
import type { Context } from "hono";
import type { z } from "zod";
import { parseBody } from "./validation";

/**
 * Parse and validate request JSON body against a Zod schema.
 * Returns validated data or throws an HTTPException with 400 status.
 */
export async function validateJson<T>(c: Context, schema: z.ZodSchema<T>): Promise<T> {
	let raw: unknown;
	try {
		raw = await c.req.json();
	} catch {
		throw new HttpValidationError("Invalid JSON body");
	}
	const result = parseBody(schema, raw);
	if (!result.success) {
		throw new HttpValidationError(result.error);
	}
	return result.data;
}

export class HttpValidationError extends Error {
	public readonly status = 400;
	constructor(message: string) {
		super(message);
		this.name = "HttpValidationError";
	}
}
