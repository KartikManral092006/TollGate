import { z } from "zod";
import { WINDOW_MINUTES, type WindowMinutes } from "./windows";

export const voteSchema = z
  .object({
    decision: z.enum(["approve", "deny"]),
    reason: z.string().trim().max(1000).optional(),
    // The card message the reply quoted, when the deny came from the composer.
    quotedMessageId: z.string().max(64).optional(),
    // Approve the same kind of gate from this agent for a while (see windows.ts).
    windowMinutes: z
      .number()
      .refine((minutes): minutes is WindowMinutes =>
        (WINDOW_MINUTES as readonly number[]).includes(minutes),
      )
      .optional(),
  })
  .strict()
  .refine((vote) => vote.decision === "approve" || (vote.reason?.length ?? 0) > 0, {
    message: "A deny needs a reason: it becomes the agent's next instruction",
    path: ["reason"],
  })
  .refine((vote) => vote.decision === "approve" || vote.windowMinutes === undefined, {
    message: "Only an approval can open a window",
    path: ["windowMinutes"],
  });

export const huddleSchema = z
  .object({ onlineMemberIds: z.array(z.string().regex(/^[A-Za-z0-9]{1,64}$/)).max(31) })
  .strict();

export const ringSchema = z.object({ userId: z.string().regex(/^[A-Za-z0-9]{32}$/) }).strict();

export const callJoinedSchema = z
  .object({ callId: z.string().min(1).max(128).optional() })
  .strict();

export const callEndedSchema = z
  .object({
    durationSec: z
      .number()
      .min(0)
      .max(24 * 3600),
  })
  .strict();

// Ask the agent instead of deciding. The question closes the gate and reaches the agent.
export const askSchema = z.object({ question: z.string().trim().min(1).max(500) }).strict();

// Accept or dismiss one of the suggested team rules ("preset:env:action").
export const ruleSuggestionSchema = z
  .object({
    repoId: z.string().regex(/^[A-Za-z0-9]{1,64}$/),
    key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}:(staging|other):(one_approval|auto_approve)$/),
    dismiss: z.boolean().optional(),
  })
  .strict();
