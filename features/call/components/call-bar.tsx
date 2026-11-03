"use client";

import { Mic, MicOff, PhoneOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ActiveCall } from "@/features/call/client/use-calls";

function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallBar({
  call,
  onMute,
  onHangUp,
}: {
  call: ActiveCall;
  onMute: () => void;
  onHangUp: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - call.startedAt) / 1000));
  const left = call.maxSec - elapsed;

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      role="status"
      aria-live="polite"
      className="mx-auto mb-2 flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-emerald-700 px-3 py-2 text-white shadow-lg dark:bg-emerald-600"
    >
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
        <span className="relative inline-flex size-2.5 rounded-full bg-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {call.kind === "huddle" ? "Huddle" : "Call"}
          {call.code != null && ` · TG-${call.code}`}
          {!call.connected && " · ringing…"}
        </p>
        <p className="text-xs text-white/80 tabular-nums">
          {clock(elapsed)}
          {left <= 60 && ` · ends in ${Math.max(0, left)} s`}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="text-white hover:bg-white/15 hover:text-white"
        aria-label={call.muted ? "Unmute" : "Mute"}
        aria-pressed={call.muted}
        onClick={onMute}
      >
        {call.muted ? <MicOff /> : <Mic />}
      </Button>
      <Button
        size="icon"
        className="bg-red-600 text-white hover:bg-red-600/90"
        aria-label="Hang up"
        onClick={onHangUp}
      >
        <PhoneOff />
      </Button>
    </motion.div>
  );
}
