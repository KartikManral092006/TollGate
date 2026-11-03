// Decision aids computed on the server from the team's own history and attached to open gates.
// Plain JSON, like GateView.

// A decided gate from the team's history, in the shape the pure insight functions read.
export type HistoryGate = {
  id: string;
  code: number;
  repo: string;
  preset: string;
  env: string;
  command: string;
  status: "approved" | "denied";
  denyReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  requesterId: string;
  votes: { userId: string; name: string; decision: "approve" | "deny" }[];
};

export type Precedent = {
  gateId: string;
  code: number;
  status: "approved" | "denied";
  // Who decided: the denier, or everyone who approved.
  by: string[];
  reason: string | null;
  decidedAt: string;
  // "same": the same command once secrets, numbers and quoted values are set aside.
  match: "same" | "similar";
  repo: string;
  sameRepo: boolean;
  // Every earlier decision on the same command in this repo, including the one shown.
  tally: { approved: number; denied: number };
};

export type RiskSignal = {
  id: string;
  level: "high" | "medium";
  text: string;
};

export type GateInsights = {
  precedent: Precedent | null;
  signals: RiskSignal[];
};
