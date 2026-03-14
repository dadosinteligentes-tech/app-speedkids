const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const ALGORITHM = "SHA-256";

export function generateSalt(): string {
	const buffer = new Uint8Array(16);
	crypto.getRandomValues(buffer);
	return bufferToHex(buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: hexToBuffer(salt),
			iterations: ITERATIONS,
			hash: ALGORITHM,
		},
		keyMaterial,
		KEY_LENGTH * 8,
	);

	return bufferToHex(new Uint8Array(derivedBits));
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
	const computed = await hashPassword(password, salt);
	// Constant-time comparison
	if (computed.length !== hash.length) return false;
	let diff = 0;
	for (let i = 0; i < computed.length; i++) {
		diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
	}
	return diff === 0;
}

function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBuffer(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}
