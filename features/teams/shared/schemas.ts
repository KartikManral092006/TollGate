import { z } from "zod";

export const TEAM_ID_RE = /^[A-Za-z0-9]{32}$/;
export const ID_RE = TEAM_ID_RE;

export const createTeamSchema = z.object({ name: z.string().trim().min(1).max(64) }).strict();

export const createInviteSchema = z
  .object({
    role: z.enum(["approver", "guest"]).default("approver"),
    maxUses: z.number().int().min(1).max(50).default(10),
    ttlHours: z
      .number()
      .int()
      .min(1)
      .max(24 * 14)
      .default(72),
  })
  .strict();

// "owner/name" or a plain name; shown on cards, never used as a path.
export const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}(\/[A-Za-z0-9._-]{1,100})?$/;

export const createRepoSchema = z
  .object({
    name: z.string().trim().regex(REPO_NAME_RE),
    mode: z.enum(["guard", "delegate"]).default("guard"),
  })
  .strict();

export type TeamRoleValue = "owner" | "approver" | "requester" | "guest";

// Who may vote on gates. Requesters raise gates; guests (clients) approve their team's gates.
export function canVote(role: TeamRoleValue): boolean {
  return role === "owner" || role === "approver" || role === "guest";
}

export function canManageTeam(role: TeamRoleValue): boolean {
  return role === "owner";
}
