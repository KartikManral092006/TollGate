import { createHash } from "node:crypto";
import { newAlnumId } from "@/lib/ids";

// Bearer secrets (hook tokens, invite links). Only the sha256 is stored; the plaintext is
// shown once. A prefix tells people which kind of secret they are holding.
export function mintSecret(prefix: "tg" | "inv"): string {
  return `${prefix}_${newAlnumId(40)}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function secretPrefix(secret: string): string {
  return secret.slice(0, 10);
}

const SECRET_RE = /^(tg|inv)_[A-Za-z0-9]{40}$/;

export function isWellFormedSecret(value: string, prefix: "tg" | "inv"): boolean {
  return SECRET_RE.test(value) && value.startsWith(`${prefix}_`);
}
