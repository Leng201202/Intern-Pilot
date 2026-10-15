import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  randomUrlSafe,
  sha256Hex,
} from "../_shared/crypto.ts";

function base64Key(fill: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(fill)));
}

describe("server-side secret protection helpers", () => {
  it("encrypts with randomized AES-GCM and decrypts correctly", async () => {
    const key = base64Key(7);
    const first = await encryptSecret("synthetic-refresh-token", key);
    const second = await encryptSecret("synthetic-refresh-token", key);

    expect(first).not.toBe(second);
    await expect(decryptSecret(first, key)).resolves.toBe(
      "synthetic-refresh-token",
    );
    await expect(decryptSecret(first, base64Key(8))).rejects.toThrow();
  });

  it("creates URL-safe state and stable SHA-256 hashes", async () => {
    const state = randomUrlSafe();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(sha256Hex("state")).resolves.toMatch(/^[a-f0-9]{64}$/);
  });
});
