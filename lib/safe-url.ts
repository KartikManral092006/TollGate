import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Teams type in the base URL of their AI provider and the server calls it, so the URL must not
// reach internal services (SSRF): https only, no credentials in the URL, and every address the
// host resolves to must be public. Resolving right before the request narrows, but doesn't
// fully close, DNS rebinding; provider calls also never follow redirects.

export class UnsafeUrlError extends Error {
  override readonly name = "UnsafeUrlError";
}

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

function ipv6Private(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return ipv4Private(mapped[1]!);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Private(ip);
  if (version === 6) return ipv6Private(ip);
  return true;
}

export function parseProviderUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid URL");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("The provider URL must use https");
  if (url.username || url.password)
    throw new UnsafeUrlError("Put credentials in the API key field");
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".internal")
  ) {
    throw new UnsafeUrlError("The provider URL must be a public address");
  }
  return url;
}

export async function assertPublicUrl(
  raw: string,
  resolve: (host: string) => Promise<{ address: string }[]> = (host) => lookup(host, { all: true }),
): Promise<URL> {
  const url = parseProviderUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError("The provider's host name doesn't resolve");
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeUrlError("The provider URL must be a public address");
  }
  return url;
}
