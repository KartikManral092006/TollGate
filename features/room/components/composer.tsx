"use client";

import { ArrowUp, Lock, MessageSquareReply, Paperclip, Quote as QuoteIcon, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { CHAT_MAX_CHARS, mentionedIds } from "@/features/room/shared/chat";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// "@" then up to a few letters, right before the caret: the mention being typed.
const MENTION_RE = /(?:^|\s)@([^\s@]{0,24})$/;

export function Composer({
  disabled,
  onSend,
  reply = null,
  onCancelReply,
  quote = null,
  onCancelQuote,
  members = [],
  hasClients = false,
  onAttach,
}: {
  disabled: boolean;
  // `mentions`: the Nexconn ids of the people @mentioned in the text. `teamOnly`: keep it
  // from the team's clients.
  onSend: (text: string, mentions: string[], teamOnly: boolean) => Promise<boolean>;
  // The team has client (guest) members, so a message can be kept to the team.
  hasClients?: boolean;
  // Send a picture or file (into the reply's gate when replying).
  onAttach?: (file: File) => void;
  // Teammates who can be @mentioned (not you).
  members?: { id: string; name: string }[];
  // Replying on a gate card: the message is sent as "TG-17 · …" attached to that gate.
  reply?: { id: string; code: number } | null;
  onCancelReply?: () => void;
  // Quoting an earlier message: who wrote it and a snippet.
  quote?: { id: string; name: string; text: string } | null;
  onCancelQuote?: () => void;
}) {
  const [text, setText] = useState("");
  const [teamOnly, setTeamOnly] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const picked = useRef(new Map<string, string>());
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const candidates =
    query === null
      ? []
      : members
          .filter((member) =>
            member.name
              .toLowerCase()
              .split(/\s+/)
              .some((word) => word.startsWith(query.toLowerCase())),
          )
          .slice(0, 5);

  function track(value: string, caret: number) {
    const match = MENTION_RE.exec(value.slice(0, caret));
    setQuery(match ? match[1]! : null);
    setActive(0);
  }

  function pick(member: { id: string; name: string }) {
    const input = field.current;
    const caret = input?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([^\s@]{0,24})$/, `@${member.name} `);
    const next = before + text.slice(caret);
    picked.current.set(member.name, member.id);
    setText(next);
    setQuery(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(before.length, before.length);
    });
  }

  useEffect(() => {
    if (reply || quote) field.current?.focus();
  }, [reply, quote]);

  async function send() {
    const value = text.trim();
    if (!value) return;
    setText("");
    setQuery(null);
    const mentions = mentionedIds(value, picked.current);
    if (await onSend(value, mentions, hasClients && teamOnly)) picked.current.clear();
    else setText(value);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <AnimatePresence initial={false}>
        {quote && (
          <motion.div
            key={`quote-${quote.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-1.5 pb-1.5 text-xs text-muted-foreground">
              <QuoteIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1">
                Quoting <span className="font-medium text-foreground">{quote.name}</span>
                {quote.text && <span className="block truncate">{quote.text}</span>}
              </p>
              <button
                type="button"
                onClick={onCancelQuote}
                aria-label={`Stop quoting ${quote.name}`}
                className="rounded-sm p-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div className="relative">
        <AnimatePresence>
          {candidates.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              role="listbox"
              aria-label="Mention a teammate"
              className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg"
            >
              {candidates.map((member, index) => (
                <li key={member.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    // Keeps focus (and the caret) in the text box.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(member)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm",
                      index === active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <PersonAvatar id={member.id} name={member.name} size="sm" />
                    {member.name}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        <InputGroup className="rounded-2xl bg-background shadow-xs">
          <InputGroupTextarea
            ref={field}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              track(event.target.value, event.target.selectionStart);
            }}
            onKeyDown={(event) => {
              if (candidates.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive((index) => (index + step + candidates.length) % candidates.length);
                  return;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  pick(candidates[active]!);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQuery(null);
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
              if (event.key === "Escape" && reply) onCancelReply?.();
            }}
            placeholder={
              disabled
                ? "Chat isn't available right now"
                : teamOnly && hasClients
                  ? "Message the team (clients won't see it)"
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
            {onAttach && (
              <>
                <input
                  ref={filePicker}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.log,.sql,.csv,.json,.md,.yaml,.yml"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (file.size > MAX_FILE_BYTES) {
                      toast.error("That file is over 20 MB.");
                      return;
                    }
                    onAttach(file);
                  }}
                />
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full"
                  disabled={disabled}
                  aria-label="Attach a picture or file (files aren't checked for secrets)"
                  title="Attach a picture or file. Unlike messages, files aren't checked for secrets."
                  onClick={() => filePicker.current?.click()}
                >
                  <Paperclip />
                </InputGroupButton>
              </>
            )}
            {hasClients && (
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant={teamOnly ? "secondary" : "ghost"}
                className={cn("rounded-full", teamOnly && "text-gate-pending-fg")}
                aria-pressed={teamOnly}
                aria-label={
                  teamOnly ? "Team only: clients won't see this" : "Visible to clients too"
                }
                title={teamOnly ? "Team only: clients won't see this" : "Keep this from clients"}
                onClick={() => setTeamOnly((value) => !value)}
              >
                <Lock />
              </InputGroupButton>
            )}
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
      </div>
    </form>
  );
}
