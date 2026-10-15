const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  const clean = value.startsWith("\\x") ? value.slice(2) : value;
  if (!/^[a-f0-9]+$/i.test(clean) || clean.length % 2 !== 0)
    throw new Error("invalid_ciphertext");
  return new Uint8Array(
    clean.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)),
  );
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(base64Key);
  if (bytes.length !== 32) throw new Error("invalid_encryption_key");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(
  plaintext: string,
  base64Key: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await importKey(base64Key),
      encoder.encode(plaintext),
    ),
  );
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv);
  combined.set(encrypted, iv.length);
  return `\\x${bytesToHex(combined)}`;
}

export async function decryptSecret(
  ciphertext: string,
  base64Key: string,
): Promise<string> {
  const combined = hexToBytes(ciphertext);
  if (combined.length < 29) throw new Error("invalid_ciphertext");
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await importKey(base64Key),
    encrypted,
  );
  return decoder.decode(plaintext);
}

export async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}

export async function sha256UrlSafe(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function randomUrlSafe(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
