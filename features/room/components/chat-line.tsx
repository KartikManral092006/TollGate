import { AlertCircle, CheckCheck } from "lucide-react";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { clockTime } from "@/features/room/shared/format";
import { replyBody, type ChatLine } from "@/features/room/shared/chat";
import { cn } from "@/lib/utils";

// "@Ana Ruiz" in the text, set apart for each person the message really mentions.
function withMentions(text: string, names: string[]) {
  if (names.length === 0) return text;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="rounded bg-brand/10 px-0.5 font-semibold text-brand">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// A chat message in the same flat layout as gate entries: avatar, name and time, then the text.
// A reply on a gate shows the gate's code as a chip that jumps to its card. A message that
// @mentions you is marked; on your own mentions, who has read them.
export function ChatLineView({
  line,
  name,
  gate,
  onJump,
  mentionNames = [],
  mentionsMe = false,
  readBy = [],
}: {
  line: ChatLine;
  name: string;
  gate?: { id: string; code: number } | null;
  onJump?: (gateId: string) => void;
  mentionNames?: string[];
  mentionsMe?: boolean;
  readBy?: string[];
}) {
  const code = gate?.code ?? line.gateCode;
  const body = code !== null ? replyBody(line.text) : line.text;
  return (
    <div
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b py-3 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-x-4",
        mentionsMe && "-mx-3 border-s-2 border-s-brand bg-brand/5 px-3",
      )}
    >
      <PersonAvatar id={line.senderId} name={line.mine ? "You" : name} />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{line.mine ? "You" : name}</span>
          {line.local === "failed" ? (
            <span className="inline-flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" aria-hidden /> Not sent
            </span>
          ) : (
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {clockTime(line.sentTime)}
            </span>
          )}
        </p>
        <p
          className={cn(
            "text-sm whitespace-pre-wrap",
            line.local === "sending" && "text-muted-foreground",
          )}
        >
          {code !== null &&
            (gate && onJump ? (
              <button
                type="button"
                onClick={() => onJump(gate.id)}
                aria-label={`Go to TG-${code}`}
                className="me-1.5 inline-flex rounded-md bg-gate-pending/15 px-1.5 py-px align-baseline font-mono text-xs font-semibold text-gate-pending-fg transition-colors hover:bg-gate-pending/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                TG-{code}
              </button>
            ) : (
              <span className="me-1.5 inline-flex rounded-md bg-muted px-1.5 py-px font-mono text-xs font-semibold">
                TG-{code}
              </span>
            ))}
          {withMentions(body, mentionNames)}
        </p>
        {line.mine && line.mentions.length > 0 && line.local === null && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCheck className={cn("size-3.5", readBy.length > 0 && "text-brand")} aria-hidden />
            {readBy.length > 0 ? `Read by ${readBy.join(", ")}` : "Not read yet"}
          </p>
        )}
      </div>
    </div>
  );
}
