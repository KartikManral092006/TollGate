// What happened when an approved call ran (CLI 0.3+). Shared by the hook contract, the server
// and the room, so it has no Node imports.
export const GATE_OUTCOMES = ["succeeded", "failed", "interrupted"] as const;
export type GateOutcome = (typeof GATE_OUTCOMES)[number];

export const OUTPUT_TAIL_MAX = 1000;
