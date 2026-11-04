import type { CustomMessageRegistration } from "@nexconn/chat";
import type { ChatUICustomMessageRegistration } from "@nexconn/chatui";
import { TG } from "@/features/nexconn/shared/messages";

// Every TG:* type, registered in one call. ChatUI forwards its list to
// NCEngine.registerCustomMessages, so when ChatUI is mounted it must carry all of them too.
export const TG_REGISTRATIONS: CustomMessageRegistration[] = [
  { messageType: TG.Gate, isPersisted: true, isCounted: true },
  { messageType: TG.Huddle, isPersisted: true, isCounted: false },
  { messageType: TG.Recap, isPersisted: true, isCounted: false },
  { messageType: TG.Agent, isPersisted: true, isCounted: false },
];

const DIGESTS: Record<string, string> = {
  [TG.Gate]: "[Gate]",
  [TG.Huddle]: "[Call]",
  [TG.Recap]: "[Recap]",
  [TG.Agent]: "[Agent session]",
};

// ChatUI shows only DMs, where TG:* cards never appear, so no element is registered: an
// entry without `component` creates no tag (docs/nexconn.md §5.5).
export function chatUIRegistrations(): ChatUICustomMessageRegistration[] {
  return TG_REGISTRATIONS.map((registration) => ({
    ...registration,
    digest: () => DIGESTS[registration.messageType] ?? "[Message]",
  }));
}
