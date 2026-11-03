"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
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
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");

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
      <InputGroup className="rounded-2xl bg-background shadow-xs">
        <InputGroupTextarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={disabled ? "Chat isn't available right now" : "Message your team"}
          aria-label="Message"
          rows={1}
          maxLength={CHAT_MAX_CHARS}
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
