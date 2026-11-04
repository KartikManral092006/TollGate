"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { redact } from "@/features/gates/shared/redact";
import type { GateView } from "@/features/gates/shared/view";
import { cn } from "@/lib/utils";

const COPY = {
  deny: {
    title: (code: number) => `Deny TG-${code}`,
    description:
      "Your reason goes to the agent as its next instruction, so say what it should do instead.",
    placeholder: "e.g. Rename the column instead of dropping it, and back up first.",
    label: "Reason",
    submit: "Deny",
    quick: [
      "Back up the data first.",
      "Wrong environment: use staging.",
      "Not now: wait until after the release.",
      "Do a dry run and show me the output.",
    ],
  },
  ask: {
    title: (code: number) => `Ask the agent about TG-${code}`,
    description:
      "The gate closes and the agent gets your question. It answers when it runs the command again, and the team decides then.",
    placeholder: "e.g. Which tables and rows does this change?",
    label: "Question",
    submit: "Send question",
    quick: [
      "Which tables and rows does this change?",
      "Is there a backup? Where is it?",
      "Why does this need to run now?",
      "How do we roll this back if it goes wrong?",
    ],
  },
} as const;

// The text is the point: a deny reason reaches the agent verbatim as its next instruction, and
// a question reaches it as something to answer before the team decides.
export function DenyDrawer({
  gate,
  mode = "deny",
  onClose,
  onSubmit,
  replies = [],
}: {
  gate: GateView | null;
  mode?: keyof typeof COPY;
  onClose: () => void;
  onSubmit: (gate: GateView, text: string) => Promise<boolean>;
  // The gate's chat replies: a teammate's reply can become the reason the agent gets.
  replies?: { id: string; name: string; text: string }[];
}) {
  const copy = COPY[mode];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    setReason("");
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!gate || !reason.trim()) return;
    setBusy(true);
    try {
      if (await onSubmit(gate, reason.trim())) close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={gate !== null} onOpenChange={(open) => !open && close()} showSwipeHandle>
      <DrawerContent className="mx-auto w-full max-w-lg">
        <form onSubmit={submit} className="flex flex-col">
          <DrawerHeader>
            <DrawerTitle>{gate ? copy.title(gate.code) : null}</DrawerTitle>
            <DrawerDescription>{copy.description}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.placeholder}
              rows={3}
              maxLength={mode === "ask" ? 500 : 1000}
              autoFocus
              required
              aria-label={copy.label}
              className="text-base sm:text-sm"
            />
            {mode === "deny" && replies.length > 0 && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">
                  Use a reply as the reason
                </legend>
                {replies.slice(-4).map((reply) => (
                  <button
                    key={reply.id}
                    type="button"
                    // Secrets are hidden before the text is shown, so what's in the box is
                    // exactly what the agent will read. The server redacts again.
                    onClick={() => setReason(redact(reply.text).text.slice(0, 1000))}
                    className="rounded-lg border px-3 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="font-medium">{reply.name}</span>{" "}
                    <span className="text-muted-foreground">{reply.text}</span>
                  </button>
                ))}
              </fieldset>
            )}
            <div className="flex flex-wrap gap-2">
              {copy.quick.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setReason(quick)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
          <DrawerFooter className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(
                "h-11",
                mode === "deny" &&
                  "bg-gate-denied text-white hover:bg-gate-denied/90 dark:text-black",
              )}
              disabled={busy || !reason.trim()}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {copy.submit}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
