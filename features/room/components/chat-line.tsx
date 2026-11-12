"use client";

import {
  AlertCircle,
  CheckCheck,
  FileText,
  Languages,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Quote as QuoteIcon,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { clockTime } from "@/features/room/shared/format";
import type { Translation } from "@/features/room/client/use-translate";
import { replyBody, type ChatLine } from "@/features/room/shared/chat";
import { cn } from "@/lib/utils";

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
  onEdit,
  onDelete,
  translation,
  onTranslate,
  onHideTranslation,
  onQuote,
  quotedName,
}: {
  line: ChatLine;
  name: string;
  gate?: { id: string; code: number } | null;
  onJump?: (gateId: string) => void;
  mentionNames?: string[];
  mentionsMe?: boolean;
  readBy?: string[];
  // Your own sent messages: change or delete them for everyone.
  onEdit?: (messageId: string, text: string) => Promise<boolean>;
  onDelete?: (messageId: string) => Promise<boolean>;
  // Someone else's message, machine-translated into your language on request.
  translation?: Translation;
  onTranslate?: (messageId: string, text: string) => void;
  onHideTranslation?: (messageId: string) => void;
  // Reply quoting this message (sent as a Nexconn reference message).
  onQuote?: (line: ChatLine) => void;
  // Who wrote the message this one quotes.
  quotedName?: string;
}) {
  const code = gate?.code ?? line.gateCode;
  const body = code !== null ? replyBody(line.text) : line.text;
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const canChange = line.mine && line.local === null && (onEdit || onDelete);
  const canTranslate =
    !line.mine && onTranslate !== undefined && !translation && line.attachment === null;
  const canQuote = onQuote !== undefined && line.local === null && line.attachment === null;

  async function save() {
    if (editing === null || !onEdit) return;
    if (!editing.trim() || editing.trim() === body) return setEditing(null);
    setBusy(true);
    const ok = await onEdit(line.id, editing);
    setBusy(false);
    if (ok) setEditing(null);
    else toast.error("Couldn't save your edit. Try again.");
  }

  async function confirmDelete() {
    if (!onDelete) return;
    setBusy(true);
    const ok = await onDelete(line.id);
    setBusy(false);
    setConfirming(false);
    if (!ok) toast.error("Couldn't delete the message.");
  }
  return (
    <div
      className={cn(
        "group grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b py-3 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-x-4",
        mentionsMe && "-mx-3 border-s-2 border-s-brand bg-brand/5 px-3",
      )}
    >
      <PersonAvatar id={line.senderId} name={line.why ? "Tollgate" : line.mine ? "You" : name} />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{line.why ? "Tollgate" : line.mine ? "You" : name}</span>
          {line.why && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 text-[11px] font-medium text-brand">
              <Sparkles className="size-3" aria-hidden /> Why? shared by {line.why.by}
            </span>
          )}
          {line.teamOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gate-pending/15 px-1.5 text-[11px] font-medium text-gate-pending-fg">
              <Lock className="size-3" aria-hidden /> Team only
            </span>
          )}
          {line.local === "failed" ? (
            <span className="inline-flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" aria-hidden /> Not sent
            </span>
          ) : (
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {clockTime(line.sentTime)}
              {line.edited && " (edited)"}
            </span>
          )}
          {(canChange || canTranslate || canQuote) && editing === null && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ms-auto size-7 text-muted-foreground opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0"
                    aria-label="Message actions"
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {canQuote && (
                  <DropdownMenuItem onClick={() => onQuote(line)}>
                    <QuoteIcon /> Quote in reply
                  </DropdownMenuItem>
                )}
                {canTranslate && (
                  <DropdownMenuItem onClick={() => onTranslate(line.id, body)}>
                    <Languages /> Translate
                  </DropdownMenuItem>
                )}
                {canChange && onEdit && line.attachment === null && line.quote === null && (
                  <DropdownMenuItem onClick={() => setEditing(body)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                )}
                {canChange && onDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                    <Trash2 /> Delete for everyone
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </p>
        {line.quote && (
          <blockquote className="mt-1 mb-1 border-s-2 border-border ps-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{quotedName ?? "A teammate"}</span>
            {line.quote.text ? <span className="block truncate">{line.quote.text}</span> : null}
          </blockquote>
        )}
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
          {editing === null && withMentions(body, mentionNames)}
          {line.why && !line.why.complete && (
            <span
              aria-label="Still arriving"
              className="ms-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-brand/60 align-middle"
            />
          )}
        </p>
        {line.attachment?.kind === "image" &&
          (line.attachment.url ? (
            <a
              href={line.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block overflow-hidden rounded-lg border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Open the picture"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Nexconn-hosted, any size */}
              <img
                src={line.attachment.url}
                alt="Picture sent to the room"
                loading="lazy"
                decoding="async"
                // The small preview carried in the message shows until the full picture loads.
                style={
                  line.attachment.thumb
                    ? {
                        backgroundImage: `url(data:image/jpeg;base64,${line.attachment.thumb})`,
                        backgroundSize: "cover",
                      }
                    : undefined
                }
                className="max-h-56 max-w-full object-contain"
              />
            </a>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Uploading picture…</p>
          ))}
        {line.attachment?.kind === "file" && (
          <a
            href={line.attachment.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-1 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              !line.attachment.url && "pointer-events-none opacity-60",
            )}
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-medium">{line.attachment.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {line.attachment.url ? fileSize(line.attachment.size) : "Uploading…"}
            </span>
          </a>
        )}
        {translation && (
          <div className="mt-1.5 border-s-2 border-border ps-2.5 text-sm" aria-live="polite">
            {translation.state === "loading" ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Translating…
              </span>
            ) : translation.state === "failed" ? (
              <span className="text-muted-foreground">Couldn&apos;t translate this one.</span>
            ) : (
              <p className="whitespace-pre-wrap">{translation.text}</p>
            )}
            <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Languages className="size-3" aria-hidden /> Machine translation
              </span>
              <button
                type="button"
                onClick={() => onHideTranslation?.(line.id)}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Hide
              </button>
            </p>
          </div>
        )}
        {editing !== null && (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              value={editing}
              onChange={(event) => setEditing(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void save();
                }
                if (event.key === "Escape") setEditing(null);
              }}
              rows={2}
              maxLength={480}
              autoFocus
              aria-label="Edit your message"
              className="text-base sm:text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()} disabled={busy}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {confirming && (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>Delete this message for everyone?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={busy}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        )}
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
