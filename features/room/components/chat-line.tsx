import { AlertCircle } from "lucide-react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { clockTime } from "@/features/room/shared/format";
import type { ChatLine } from "@/features/room/shared/chat";

export function ChatLineView({ line, name }: { line: ChatLine; name: string }) {
  return (
    <Message align={line.mine ? "end" : "start"}>
      {!line.mine && (
        <MessageAvatar>
          <PersonAvatar id={line.senderId} name={name} />
        </MessageAvatar>
      )}
      <MessageContent>
        {!line.mine && <MessageHeader>{name}</MessageHeader>}
        <Bubble variant={line.mine ? "default" : "muted"} align={line.mine ? "end" : "start"}>
          <BubbleContent className={line.local === "sending" ? "opacity-70" : undefined}>
            <p className="whitespace-pre-wrap">{line.text}</p>
          </BubbleContent>
        </Bubble>
        <span className="px-1 text-[11px] text-muted-foreground group-data-[align=end]/message:self-end">
          {line.local === "failed" ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertCircle className="size-3" aria-hidden /> Not sent
            </span>
          ) : (
            clockTime(line.sentTime)
          )}
        </span>
      </MessageContent>
    </Message>
  );
}
