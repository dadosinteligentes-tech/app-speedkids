/**
 * Stateless email verification tokens using HMAC-SHA256.
 * Token format: base64url(payload) + "." + base64url(signature)
 * Payload: tenantId:customerId:email:expiryUnixSeconds
 */

const TOKEN_EXPIRY_HOURS = 72;

function toBase64Url(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (str.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function hmacSign(secret: string, data: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
	return toBase64Url(signature);
}

export async function generateVerificationToken(
	secret: string,
	tenantId: number,
	customerId: number,
	email: string,
): Promise<string> {
	const expiry = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_HOURS * 3600;
	const payload = `${tenantId}:${customerId}:${email}:${expiry}`;
	const payloadEncoded = toBase64Url(new TextEncoder().encode(payload).buffer as ArrayBuffer);
	const signature = await hmacSign(secret, payload);
	return `${payloadEncoded}.${signature}`;
}

export interface VerificationResult {
	valid: boolean;
	tenantId?: number;
	customerId?: number;
	email?: string;
	error?: string;
}

export async function verifyVerificationToken(
	secret: string,
	token: string,
): Promise<VerificationResult> {
	const parts = token.split(".");
	if (parts.length !== 2) return { valid: false, error: "Token inválido" };

	const [payloadEncoded, signature] = parts;

	let payload: string;
	try {
		payload = new TextDecoder().decode(fromBase64Url(payloadEncoded));
	} catch {
		return { valid: false, error: "Token inválido" };
	}

	const segments = payload.split(":");
	if (segments.length < 4) return { valid: false, error: "Token inválido" };

	const tenantId = parseInt(segments[0], 10);
	const customerId = parseInt(segments[1], 10);
	const email = segments.slice(2, -1).join(":"); // email may contain colons
	const expiry = parseInt(segments[segments.length - 1], 10);

	if (isNaN(tenantId) || isNaN(customerId) || isNaN(expiry)) {
		return { valid: false, error: "Token inválido" };
	}

	// Check expiry
	if (Math.floor(Date.now() / 1000) > expiry) {
		return { valid: false, error: "Token expirado" };
	}

	// Verify signature
	const expectedSignature = await hmacSign(secret, payload);
	if (signature !== expectedSignature) {
		return { valid: false, error: "Assinatura inválida" };
	}

	return { valid: true, tenantId, customerId, email };
}
