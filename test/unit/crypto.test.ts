import { describe, it, expect } from "vitest";
import { generateSalt, hashPassword, verifyPassword } from "../../src/lib/crypto";

describe("generateSalt", () => {
	it("generates a 32-character hex string (16 bytes)", () => {
		const salt = generateSalt();
		expect(salt).toHaveLength(32);
		expect(salt).toMatch(/^[0-9a-f]{32}$/);
	});

	it("generates unique salts", () => {
		const salts = new Set(Array.from({ length: 10 }, () => generateSalt()));
		expect(salts.size).toBe(10);
	});
});

describe("hashPassword", () => {
	it("produces a 64-character hex string (32 bytes)", async () => {
		const salt = generateSalt();
		const hash = await hashPassword("test123", salt);
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces deterministic output for same inputs", async () => {
		const salt = "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8";
		const hash1 = await hashPassword("password", salt);
		const hash2 = await hashPassword("password", salt);
		expect(hash1).toBe(hash2);
	});

	it("produces different hashes for different passwords", async () => {
		const salt = generateSalt();
		const hash1 = await hashPassword("password1", salt);
		const hash2 = await hashPassword("password2", salt);
		expect(hash1).not.toBe(hash2);
	});

	it("produces different hashes for different salts", async () => {
		const hash1 = await hashPassword("password", generateSalt());
		const hash2 = await hashPassword("password", generateSalt());
		expect(hash1).not.toBe(hash2);
	});
});

describe("verifyPassword", () => {
	it("returns true for correct password", async () => {
		const salt = generateSalt();
		const hash = await hashPassword("correct-password", salt);
		const result = await verifyPassword("correct-password", salt, hash);
		expect(result).toBe(true);
	});

	it("returns false for incorrect password", async () => {
		const salt = generateSalt();
		const hash = await hashPassword("correct-password", salt);
		const result = await verifyPassword("wrong-password", salt, hash);
		expect(result).toBe(false);
	});

	it("returns false for tampered hash", async () => {
		const salt = generateSalt();
		const hash = await hashPassword("password", salt);
		const tamperedHash = "0".repeat(64);
		const result = await verifyPassword("password", salt, tamperedHash);
		expect(result).toBe(false);
	});

	it("returns false for mismatched hash length", async () => {
		const salt = generateSalt();
		const result = await verifyPassword("password", salt, "short");
		expect(result).toBe(false);
	});
});
