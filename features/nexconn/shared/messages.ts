import { z } from "zod";

export const TG = {
  Gate: "TG:Gate",
  Huddle: "TG:Huddle",
  Recap: "TG:Recap",
} as const;

export type TgMessageType = (typeof TG)[keyof typeof TG];

export const MAX_CONTENT_BYTES = 10 * 1024;
export const MAX_CUSTOM_TYPE_LENGTH = 32;

export const gateStatusSchema = z.enum(["pending", "approved", "denied", "parked", "expired"]);
export type GateStatusValue = z.infer<typeof gateStatusSchema>;

// The card the bot sends to a team's group. Everything here is already redacted.
export const gateCardSchema = z.object({
  gateId: z.string().min(1),
  code: z.number().int().positive(),
  preset: z.string().min(1).max(64),
  env: z.string().min(1).max(32),
  repo: z.string().min(1).max(200),
  branch: z.string().max(200).nullable(),
  cmd: z.string().min(1).max(4000),
  ctx: z.string().max(2048),
  redactions: z.number().int().nonnegative(),
  quorum: z.number().int().positive(),
  requester: z.string().min(1).max(64),
  requesterId: z.string().min(1),
});

export type GateCardPayload = z.infer<typeof gateCardSchema>;

export const huddleCardSchema = z.object({
  callId: z.string().min(1),
  kind: z.enum(["huddle", "ring"]),
  gateId: z.string().min(1).nullable(),
  code: z.number().int().positive().nullable(),
  startedBy: z.string().min(1).max(64),
  startedById: z.string().min(1),
});

export type HuddleCardPayload = z.infer<typeof huddleCardSchema>;

export function isValidCustomType(messageType: string): boolean {
  return (
    messageType.length > 0 &&
    messageType.length <= MAX_CUSTOM_TYPE_LENGTH &&
    !messageType.startsWith("RC:") &&
    !messageType.startsWith("NC:")
  );
}

export function encodeContent(value: unknown): string {
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).byteLength > MAX_CONTENT_BYTES) {
    throw new Error(`Message content exceeds ${MAX_CONTENT_BYTES} bytes`);
  }
  return json;
}

export function decodeContent<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

const METADATA_KEY_RE = /^[A-Za-z0-9+=_-]{1,32}$/;
const METADATA_VALUE_MAX = 4096;

export function toMetadata(
  values: Record<string, string | number | boolean>,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!METADATA_KEY_RE.test(key)) throw new Error(`Invalid metadata key "${key}"`);
    const stringValue = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
    if (stringValue.length > METADATA_VALUE_MAX)
      throw new Error(`Metadata value for "${key}" is too long`);
    metadata[key] = stringValue;
  }
  return metadata;
}

// Up to MAX_VOTE_SLOTS votes are mirrored as v01..v09 = "userId:a" | "userId:d".
export const MAX_VOTE_SLOTS = 9;

export type GateMetadataInput = {
  status: GateStatusValue;
  approvals: number;
  quorum: number;
  votes: { userId: string; decision: "approve" | "deny" }[];
  decidedBy?: string | null;
  grantExpiresAt?: Date | null;
};

export function gateMetadata(input: GateMetadataInput): Record<string, string> {
  const values: Record<string, string> = {
    st: input.status,
    q: `${Math.min(input.approvals, input.quorum)}/${input.quorum}`,
  };
  input.votes.slice(0, MAX_VOTE_SLOTS).forEach((vote, index) => {
    values[`v${String(index + 1).padStart(2, "0")}`] =
      `${vote.userId}:${vote.decision === "approve" ? "a" : "d"}`;
  });
  if (input.decidedBy) values.by = input.decidedBy;
  if (input.grantExpiresAt) values.exp = String(input.grantExpiresAt.getTime());
  return toMetadata(values);
}

export function readGateMetadata(metadata: Record<string, string>): {
  status: GateStatusValue | null;
  quorum: string | null;
  votes: { userId: string; decision: "approve" | "deny" }[];
} {
  const status = gateStatusSchema.safeParse(metadata.st);
  const votes = Object.keys(metadata)
    .filter((key) => /^v\d{2}$/.test(key))
    .sort()
    .flatMap((key) => {
      const [userId, flag] = (metadata[key] ?? "").split(":");
      if (!userId || (flag !== "a" && flag !== "d")) return [];
      return [{ userId, decision: flag === "a" ? ("approve" as const) : ("deny" as const) }];
    });
  return { status: status.success ? status.data : null, quorum: metadata.q ?? null, votes };
}

export function huddleMetadata(input: {
  live: boolean;
  participants: number;
  durationSec?: number | null;
}): Record<string, string> {
  return toMetadata({
    st: input.live ? "live" : "ended",
    n: input.participants,
    ...(input.durationSec == null ? {} : { dur: input.durationSec }),
  });
}
