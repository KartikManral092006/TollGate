"use client";

import { Loader2, Share2, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/features/settings/components/copy-field";
import { cn } from "@/lib/utils";

const STORE_KEY = (gateId: string) => `tollgate:gate-invite:${gateId}`;

// For the one moment a solo user can't get past: their own gate, which they can't approve.
// Mints a single-use, 48-hour link for one person to join and decide it, shown as a QR code
// for the phone next to the laptop. The link is shown once by the server, so it is kept for
// the browser session to survive a reload (and to show the same link in the guide and card).
export function GateInvite({
  gateId,
  code,
  className,
}: {
  gateId: string;
  code: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanShare("share" in navigator);
      try {
        const saved = window.sessionStorage.getItem(STORE_KEY(gateId));
        if (saved) setUrl(saved);
      } catch {
        // storage blocked: the button mints a fresh link
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [gateId]);

  async function create() {
    setBusy(true);
    try {
      const response = await fetch(`/api/gates/${gateId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!body.url) {
        toast.error(
          body.error === "decided"
            ? `TG-${code} has already been decided.`
            : body.error === "forbidden"
              ? "Only the team owner can invite people."
              : "Couldn't create an invite link.",
        );
        return;
      }
      setUrl(body.url);
      try {
        window.sessionStorage.setItem(STORE_KEY(gateId), body.url);
      } catch {
        // storage blocked: the link still shows until the page reloads
      }
    } finally {
      setBusy(false);
    }
  }

  async function share(link: string) {
    try {
      await navigator.share({ title: `Decide TG-${code} on Tollgate`, url: link });
    } catch {
      // dismissed, or sharing isn't available: the link is right there to copy
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {url ? (
          <motion.div
            key="link"
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <motion.div
              initial={{ scale: 0.86, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="self-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/10 sm:self-auto"
            >
              <QrCode
                value={url}
                label={`QR code for the invite to decide TG-${code}`}
                className="size-36"
              />
            </motion.div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm font-medium">
                Scan it with a phone, or send the link to a teammate or client.
              </p>
              <CopyField value={url} label="invite link" mono={false} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-xs text-muted-foreground">
                  For one person. It expires in 48 hours and opens straight onto TG-{code}.
                </p>
                {canShare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void share(url)}
                  >
                    <Share2 aria-hidden /> Share
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="button" exit={{ opacity: 0, y: -4 }}>
            <Button variant="outline" className="h-10" onClick={create} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
              Invite someone to decide TG-{code}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
