import { describe, expect, it } from "vitest";
import { lastFour, openSecret, sealSecret } from "@/lib/crypto-box";
import { assertPublicUrl, isPrivateAddress, UnsafeUrlError } from "@/lib/safe-url";

describe("crypto-box", () => {
  const secret = "server-secret-for-tests-0123456789";

  it("round-trips and never stores the plaintext", () => {
    const sealed = sealSecret("sk-live-abc123", secret);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("sk-live-abc123");
    expect(openSecret(sealed, secret)).toBe("sk-live-abc123");
  });

  it("uses a fresh IV each time", () => {
    expect(sealSecret("same", secret)).not.toBe(sealSecret("same", secret));
  });

  it("refuses a wrong key or tampered data", () => {
    const sealed = sealSecret("sk-live-abc123", secret);
    expect(() => openSecret(sealed, "another-secret-0123456789abcdef")).toThrow();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => openSecret(parts.join("."), secret)).toThrow();
  });

  it("shows only the last four characters", () => {
    expect(lastFour("sk-abcdef1234")).toBe("1234");
    expect(lastFour("abc")).toBe("••••");
  });
});

describe("safe-url", () => {
  const publicDns = async () => [{ address: "203.0.114.10" }];

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "::ffff:10.0.0.1",
    "0.0.0.0",
  ])("treats %s as private", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "203.0.114.10", "2606:4700::1111"])("treats %s as public", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );

  it("accepts a public https provider", async () => {
    await expect(assertPublicUrl("https://api.example.com/v1", publicDns)).resolves.toBeInstanceOf(
      URL,
    );
  });

  it.each([
    ["http://api.example.com/v1", "https"],
    ["https://user:pass@api.example.com/v1", "credentials"],
    ["https://localhost:11434/v1", "public address"],
    ["https://169.254.169.254/latest", "public address"],
    ["not a url", "valid URL"],
  ])("rejects %s", async (url, message) => {
    await expect(assertPublicUrl(url, publicDns)).rejects.toThrow(message);
  });

  it("rejects a public-looking host that resolves to a private address", async () => {
    await expect(
      assertPublicUrl("https://sneaky.example.com/v1", async () => [{ address: "10.0.0.5" }]),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects a host that doesn't resolve", async () => {
    await expect(assertPublicUrl("https://nope.example.com", async () => [])).rejects.toThrow(
      "doesn't resolve",
    );
  });
});
