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
import type { GateView } from "@/features/gates/shared/view";

const QUICK_REASONS = [
  "Back up the data first.",
  "Wrong environment: use staging.",
  "Not now: wait until after the release.",
  "Do a dry run and show me the output.",
];

// The reason is the point: it reaches the agent verbatim as its next instruction.
export function DenyDrawer({
  gate,
  onClose,
  onSubmit,
}: {
  gate: GateView | null;
  onClose: () => void;
  onSubmit: (gate: GateView, reason: string) => Promise<boolean>;
}) {
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
            <DrawerTitle>Deny TG-{gate?.code}</DrawerTitle>
            <DrawerDescription>
              Your reason goes to the agent as its next instruction, so say what it should do
              instead.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Rename the column instead of dropping it, and back up first."
              rows={3}
              maxLength={1000}
              autoFocus
              required
              aria-label="Reason"
              className="text-base sm:text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((quick) => (
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
              className="h-11 bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-400 dark:text-black"
              disabled={busy || !reason.trim()}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Deny
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
