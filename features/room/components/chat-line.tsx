import { AlertCircle } from "lucide-react";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { clockTime } from "@/features/room/shared/format";
import type { ChatLine } from "@/features/room/shared/chat";
import { cn } from "@/lib/utils";

// A chat message in the same flat layout as gate entries: avatar, name and time, then the text.
export function ChatLineView({ line, name }: { line: ChatLine; name: string }) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b py-3 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-x-4">
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
          {line.text}
        </p>
      </div>
    </div>
  );
}
