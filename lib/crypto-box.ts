import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encrypts secrets stored in the database (a team's AI provider key) with AES-256-GCM.
// Format: "v1.<iv>.<tag>.<ciphertext>" in base64url. The key comes from AI_KEYS_SECRET (any
// long random string; hashed to 32 bytes), so a database leak alone doesn't expose keys.

const VERSION = "v1";

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function openSecret(sealed: string, secret: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext)
    throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function lastFour(secret: string): string {
  return secret.length <= 4 ? "••••" : secret.slice(-4);
}
