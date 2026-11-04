"use client";

import { ArrowUp, MessageSquareReply, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { CHAT_MAX_CHARS } from "@/features/room/shared/chat";

export function Composer({
  disabled,
  onSend,
  reply = null,
  onCancelReply,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<boolean>;
  // Replying on a gate card: the message is sent as "TG-17 · …" attached to that gate.
  reply?: { id: string; code: number } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (reply) field.current?.focus();
  }, [reply]);

  async function send() {
    const value = text.trim();
    if (!value) return;
    setText("");
    if (!(await onSend(value))) setText(value);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <AnimatePresence initial={false}>
        {reply && (
          <motion.div
            key={reply.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="flex items-center gap-1.5 pb-1.5 text-xs text-muted-foreground">
              <MessageSquareReply className="size-3.5" aria-hidden />
              Replying on{" "}
              <span className="font-mono font-medium text-foreground">TG-{reply.code}</span>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label={`Stop replying on TG-${reply.code}`}
                className="ms-1 rounded-sm p-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <InputGroup className="rounded-2xl bg-background shadow-xs">
        <InputGroupTextarea
          ref={field}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
            if (event.key === "Escape" && reply) onCancelReply?.();
          }}
          placeholder={
            disabled
              ? "Chat isn't available right now"
              : reply
                ? `Reply on TG-${reply.code}`
                : "Message your team"
          }
          aria-label={reply ? `Reply on TG-${reply.code}` : "Message"}
          rows={1}
          // Leaves room for the "TG-17 · " prefix within the message limit.
          maxLength={reply ? CHAT_MAX_CHARS - 12 : CHAT_MAX_CHARS}
          disabled={disabled}
          className="max-h-40 min-h-11 text-base sm:text-sm"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            className="rounded-full"
            disabled={disabled || !text.trim()}
            aria-label="Send"
          >
            <ArrowUp />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
