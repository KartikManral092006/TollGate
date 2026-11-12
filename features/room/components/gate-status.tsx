import {
  CircleCheck,
  CircleX,
  Clock3,
  MessageCircleQuestion,
  PauseCircle,
  ShieldOff,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import type { GateDisplayStatus } from "@/features/gates/shared/view";
import { cn } from "@/lib/utils";

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  stripe: string;
  chip: string;
};

// Every state pairs a colour with an icon and a word, so it never relies on colour alone.
export const STATUS: Record<GateDisplayStatus, StatusMeta> = {
  pending: {
    label: "Waiting",
    icon: Clock3,
    stripe: "bg-gate-pending",
    chip: "bg-gate-pending-bg text-gate-pending-fg",
  },
  approved: {
    label: "Approved",
    icon: CircleCheck,
    stripe: "bg-gate-approved",
    chip: "bg-gate-approved-bg text-gate-approved-fg",
  },
  denied: {
    label: "Denied",
    icon: CircleX,
    stripe: "bg-gate-denied",
    chip: "bg-gate-denied-bg text-gate-denied-fg",
  },
  asked: {
    label: "Question sent",
    icon: MessageCircleQuestion,
    stripe: "bg-gate-pending",
    chip: "bg-gate-pending-bg text-gate-pending-fg",
  },
  parked: {
    label: "Parked",
    icon: PauseCircle,
    stripe: "bg-gate-parked",
    chip: "bg-gate-parked-bg text-gate-parked-fg",
  },
  expired: {
    label: "Expired",
    icon: TimerOff,
    stripe: "bg-gate-parked",
    chip: "bg-gate-parked-bg text-gate-parked-fg",
  },
  // Started with TOLLGATE_BYPASS=1: it ran, but nobody on the team decided.
  bypassed: {
    label: "Bypassed",
    icon: ShieldOff,
    stripe: "bg-gate-denied",
    chip: "bg-gate-denied-bg text-gate-denied-fg",
  },
};

export function StatusChip({
  status,
  className,
}: {
  status: GateDisplayStatus;
  className?: string;
}) {
  const meta = STATUS[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.chip,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export function EnvBadge({ env }: { env: string }) {
  const prod = env === "prod";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide uppercase",
        prod
          ? "bg-gate-denied text-white dark:text-black"
          : env === "staging"
            ? "bg-gate-pending-bg text-gate-pending-fg"
            : "bg-muted text-muted-foreground",
      )}
    >
      {prod ? "PROD" : env}
    </span>
  );
}
