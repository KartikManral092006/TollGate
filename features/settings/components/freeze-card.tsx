"use client";

import { Loader2, Siren, Snowflake } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FreezeBanner, FREEZE_RULES } from "@/features/room/components/freeze-banner";
import {
  durationLabel,
  FREEZE_MINUTES,
  FREEZE_REASON_MAX,
  type FreezeKind,
  type FreezeView,
} from "@/features/teams/shared/freeze";

// Owners and approvers turn on a freeze (a release, a holiday) or incident mode (something is
// on fire) for a while. Everyone else sees whether one is on.
export function FreezeSettings({
  teamId,
  canManage,
  initial,
}: {
  teamId: string;
  canManage: boolean;
  initial: FreezeView | null;
}) {
  const [freeze, setFreeze] = useState(initial);
  const [kind, setKind] = useState<FreezeKind>("incident");
  const [minutes, setMinutes] = useState<number>(240);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/freeze`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          minutes,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      if (!response.ok) {
        toast.error("Couldn't start it. Try again.");
        return;
      }
      setFreeze(((await response.json()) as { freeze: FreezeView }).freeze);
      setReason("");
      toast.success(
        kind === "incident"
          ? "Incident mode is on. Nothing is approved automatically."
          : "Freeze is on. Nothing is approved automatically.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FreezeBanner
        teamId={teamId}
        freeze={freeze}
        canEnd={canManage}
        onChange={setFreeze}
        className="-mx-4 rounded-lg sm:mx-0 [&>div]:rounded-lg [&>div]:border"
      />
      {!freeze && <p className="text-sm text-muted-foreground">{FREEZE_RULES}</p>}
      {canManage ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>What&apos;s happening</Label>
            <ToggleGroup
              value={[kind]}
              onValueChange={(value: string[]) => value[0] && setKind(value[0] as FreezeKind)}
              variant="outline"
              className="w-fit"
            >
              <ToggleGroupItem value="incident" aria-label="Incident">
                <Siren aria-hidden /> Incident
              </ToggleGroupItem>
              <ToggleGroupItem value="freeze" aria-label="Release or holiday freeze">
                <Snowflake aria-hidden /> Freeze
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>For</Label>
            <ToggleGroup
              value={[String(minutes)]}
              onValueChange={(value: string[]) => value[0] && setMinutes(Number(value[0]))}
              variant="outline"
              className="w-fit flex-wrap"
            >
              {FREEZE_MINUTES.map((value) => (
                <ToggleGroupItem key={value} value={String(value)}>
                  {durationLabel(value)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="freeze-reason">Why (shown to everyone)</Label>
            <Input
              id="freeze-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={FREEZE_REASON_MAX}
              placeholder={
                kind === "incident" ? "e.g. Checkout is down, investigating" : "e.g. Release week"
              }
              className="h-10 text-base sm:h-9 sm:text-sm"
            />
          </div>
          <Button className="w-fit" onClick={start} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {freeze ? "Change it" : kind === "incident" ? "Start incident mode" : "Start freeze"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Owners and approvers can start one.</p>
      )}
    </div>
  );
}
