"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GateCallView, GateView } from "@/features/gates/shared/view";
import { nexconnEvents, startNexconn } from "@/features/nexconn/client/engine";
import { CallCode } from "@/features/nexconn/shared/codes";

// What travels with the Nexconn call so the callee knows which gate (and which permit) it is.
export type CallExtra = {
  permitId: string;
  gateId: string | null;
  code: number | null;
  kind: "ring" | "huddle";
};

export type IncomingCall = { callId: string; callerId: string; extra: CallExtra | null };

export type ActiveCall = {
  callId: string;
  permitId: string | null;
  kind: "ring" | "huddle";
  code: number | null;
  startedAt: number;
  maxSec: number;
  muted: boolean;
  connected: boolean;
};

type Permit =
  | { kind: "start"; permitId: string; calleeIds: string[]; maxSec: number }
  | { kind: "join"; permitId: string; callId: string };

const PERMIT_ERRORS: Record<string, string> = {
  calls_disabled: "Calls are turned off for this Tollgate server.",
  closed: "This gate is already decided.",
  budget: "Your team has used today's call minutes.",
  busy: "Someone is starting a huddle on this gate right now. Try Join in a moment.",
  no_callees: "Nobody else on the team can be called.",
  callee_not_allowed: "That person can't be rung about gates.",
  rate_limited: "Too many calls on this gate. Try again later.",
};

function callErrorMessage(code: number): string {
  if (code === CallCode.CallNotEnabled) return "Calling isn't enabled for this Nexconn app yet.";
  if (code === CallCode.AlreadyInCall) return "You're already in a call.";
  return `The call couldn't start (code ${code}).`;
}

export function parseExtra(raw: unknown): CallExtra | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<CallExtra>;
    return typeof value.permitId === "string" && (value.kind === "ring" || value.kind === "huddle")
      ? {
          permitId: value.permitId,
          gateId: value.gateId ?? null,
          code: value.code ?? null,
          kind: value.kind,
        }
      : null;
  } catch {
    return null;
  }
}

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, data };
}

async function callEngine() {
  const session = await startNexconn({ withChatUI: false, withCall: true });
  if (!session.call) throw new Error("Calls are not available");
  return session.call;
}

// The browser half of calling. Every call starts with a server permit (membership, budget,
// one huddle per gate); billing starts at startCall, so nothing calls it without one.
export function useCalls({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef<ActiveCall | null>(null);
  const endReported = useRef<string | null>(null);

  const setActiveCall = useCallback((call: ActiveCall | null) => {
    activeRef.current = call;
    setActive(call);
  }, []);

  const reportEnd = useCallback(
    async (call: ActiveCall) => {
      if (!call.permitId || endReported.current === call.callId) return;
      endReported.current = call.callId;
      const durationSec = Math.max(0, Math.round((Date.now() - call.startedAt) / 1000));
      await post(`/api/calls/${call.permitId}/ended`, { durationSec }).catch(() => undefined);
      onChange();
    },
    [onChange],
  );

  useEffect(() => {
    if (!enabled) return;
    return nexconnEvents.subscribe((event) => {
      const data = event.data as { callId?: string; callerUserId?: string; extra?: unknown };
      if (event.kind === "callReceived" && data.callId && data.callerUserId) {
        setIncoming({
          callId: data.callId,
          callerId: data.callerUserId,
          extra: parseExtra(data.extra),
        });
      }
      const current = activeRef.current;
      if (event.kind === "callConnected" && current && data.callId === current.callId) {
        setActiveCall({ ...current, connected: true });
      }
      if (event.kind === "callEnded") {
        setIncoming((current) => (current?.callId === data.callId ? null : current));
        const call = activeRef.current;
        if (call && call.callId === data.callId) {
          void reportEnd(call);
          setActiveCall(null);
        }
      }
    });
  }, [enabled, reportEnd, setActiveCall]);

  // The cap the server granted is enforced here; the server's sweeper is the backstop.
  useEffect(() => {
    if (!active) return;
    const left = active.startedAt + active.maxSec * 1000 - Date.now();
    const timer = setTimeout(
      () => {
        toast.info("Call time limit reached.");
        void callEngine().then(({ engine }) => engine.endCall({ callId: active.callId }));
      },
      Math.max(0, left),
    );
    return () => clearTimeout(timer);
  }, [active]);

  const begin = useCallback(
    async (gate: GateView, permit: Permit, kind: "ring" | "huddle") => {
      const call = await callEngine();
      if (permit.kind === "join") {
        const joined = await call.engine.joinCall({ callId: permit.callId });
        if (joined.code !== CallCode.Ok) throw new Error(callErrorMessage(joined.code));
        await post(`/api/calls/${permit.permitId}/joined`, {});
        setActiveCall({
          callId: permit.callId,
          permitId: permit.permitId,
          kind,
          code: gate.code,
          startedAt: Date.now(),
          maxSec: 900,
          muted: false,
          connected: false,
        });
        return;
      }
      const extra: CallExtra = {
        permitId: permit.permitId,
        gateId: gate.id,
        code: gate.code,
        kind,
      };
      const started = await call.engine.startCall({
        calleeIds: permit.calleeIds,
        callType: kind === "ring" ? call.module.NCCallType.SINGLE : call.module.NCCallType.MULTI,
        mediaType: call.module.NCCallMediaType.AUDIO,
        extra: JSON.stringify(extra),
      });
      if (started.code !== CallCode.Ok || !started.callId) {
        throw new Error(callErrorMessage(started.code));
      }
      await post(`/api/calls/${permit.permitId}/joined`, { callId: started.callId });
      setActiveCall({
        callId: started.callId,
        permitId: permit.permitId,
        kind,
        code: gate.code,
        startedAt: Date.now(),
        maxSec: permit.maxSec,
        muted: false,
        connected: false,
      });
      onChange();
    },
    [onChange, setActiveCall],
  );

  const run = useCallback(async (work: () => Promise<void>) => {
    if (activeRef.current) {
      toast.error("Hang up your current call first.");
      return;
    }
    setBusy(true);
    try {
      await work();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The call couldn't start.");
    } finally {
      setBusy(false);
    }
  }, []);

  const ring = useCallback(
    (gate: GateView, calleeUserId: string) =>
      run(async () => {
        const { ok, data } = await post(`/api/gates/${gate.id}/ring`, { userId: calleeUserId });
        if (!ok) throw new Error(PERMIT_ERRORS[String(data.error)] ?? "Couldn't start the call.");
        await begin(gate, data as unknown as Permit, "ring");
      }),
    [begin, run],
  );

  const huddle = useCallback(
    (gate: GateView, memberIds: string[]) =>
      run(async () => {
        const { ok, data } = await post(`/api/gates/${gate.id}/huddle`, {
          onlineMemberIds: memberIds,
        });
        if (!ok) throw new Error(PERMIT_ERRORS[String(data.error)] ?? "Couldn't start the huddle.");
        await begin(gate, data as unknown as Permit, "huddle");
      }),
    [begin, run],
  );

  const join = useCallback(
    (gate: GateView, call: GateCallView) =>
      run(async () => {
        if (!call.callId) throw new Error("This huddle hasn't started yet.");
        await begin(gate, { kind: "join", permitId: call.id, callId: call.callId }, "huddle");
      }),
    [begin, run],
  );

  // Accepting while in a call silently ends that call in the SDK, so the UI asks first.
  const accept = useCallback(async () => {
    const call = incoming;
    if (!call) return;
    setIncoming(null);
    try {
      const { engine } = await callEngine();
      const result = await engine.acceptCall({ callId: call.callId });
      if (result.code !== CallCode.Ok) throw new Error(callErrorMessage(result.code));
      if (call.extra) await post(`/api/calls/${call.extra.permitId}/joined`, {});
      setActiveCall({
        callId: call.callId,
        permitId: call.extra?.permitId ?? null,
        kind: call.extra?.kind ?? "ring",
        code: call.extra?.code ?? null,
        startedAt: Date.now(),
        maxSec: 900,
        muted: false,
        connected: true,
      });
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't answer the call.");
    }
  }, [incoming, onChange, setActiveCall]);

  const decline = useCallback(async () => {
    const call = incoming;
    setIncoming(null);
    if (call) await callEngine().then(({ engine }) => engine.endCall({ callId: call.callId }));
  }, [incoming]);

  const hangUp = useCallback(async () => {
    const call = activeRef.current;
    if (!call) return;
    setActiveCall(null);
    await callEngine()
      .then(({ engine }) => engine.endCall({ callId: call.callId }))
      .catch(() => undefined);
    await reportEnd(call);
  }, [reportEnd, setActiveCall]);

  const toggleMute = useCallback(async () => {
    const call = activeRef.current;
    if (!call) return;
    const { engine } = await callEngine();
    const result = await engine.enableMicrophone(call.muted);
    if (result.code === CallCode.Ok) setActiveCall({ ...call, muted: !call.muted });
  }, [setActiveCall]);

  return { incoming, active, busy, ring, huddle, join, accept, decline, hangUp, toggleMute };
}
