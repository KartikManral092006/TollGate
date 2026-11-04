import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/logo";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { githubEnabled, googleEnabled } from "@/features/auth/server/auth";
import { getOptionalSession } from "@/features/auth/server/session";
import { CommandStream } from "@/features/landing/components/command-stream";
import { AcceptInvite } from "@/features/teams/components/accept-invite";
import { getInvitePreview, type InvitePreview } from "@/features/teams/server/teams";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isWellFormedSecret } from "@/lib/secret-token";

export const instant = false;

export const metadata: Metadata = {
  title: "Join a team · Tollgate",
  robots: { index: false, follow: false },
};

const ENV_LABEL: Record<string, string> = {
  prod: "Production",
  staging: "Staging",
  other: "Not production",
};

function GatePreview({ gate }: { gate: NonNullable<InvitePreview["gate"]> }) {
  const waiting = gate.status === "pending" || gate.status === "parked";
  return (
    <div className="max-w-lg border-l-2 border-[#f2a900] py-1 pl-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="relative flex size-2">
          {waiting && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f2a900] opacity-60 motion-reduce:hidden" />
          )}
          <span
            className={`relative inline-flex size-2 rounded-full ${waiting ? "bg-[#f2a900]" : "bg-white/40"}`}
          />
        </span>
        {waiting ? `TG-${gate.code} is waiting for you` : `TG-${gate.code} has been decided`}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-white/50">Repo</dt>
        <dd className="font-mono break-all text-white/85">{gate.repo}</dd>
        <dt className="text-white/50">Where</dt>
        <dd className="text-white/85">{ENV_LABEL[gate.env] ?? gate.env}</dd>
        <dt className="text-white/50">Kind</dt>
        <dd className="font-mono text-white/85">{gate.preset}</dd>
      </dl>
      {gate.command && (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/50 px-3 py-2 font-mono text-sm text-white/90">
          <span className="text-white/40 select-none">$ </span>
          {gate.command}
        </pre>
      )}
      {!gate.command && waiting && (
        <p className="mt-3 text-xs text-white/50">
          The command itself shows after you sign in, with secrets hidden.
        </p>
      )}
    </div>
  );
}

// Approvers and clients land here from an invite link, often by scanning a QR code on the
// requester's screen. Before sign-in it says who is asking, for which team and which gate,
// then signs them in right here and brings them back to join with one tap.
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  await connection();
  const { token } = await params;
  const preview = isWellFormedSecret(token, "inv") ? await getInvitePreview(db, token) : null;

  if (!preview) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 px-4">
        <Logo />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
          This invite link isn’t valid
        </h1>
        <p className="text-sm text-muted-foreground">
          It may have been mistyped or withdrawn. Ask whoever sent it for a new link.
        </p>
        <Link href="/" className="text-sm font-medium underline underline-offset-4">
          What is Tollgate?
        </Link>
      </main>
    );
  }

  const user = await getOptionalSession();
  const inviter = preview.inviterName;
  const gate = preview.gate;
  const waiting = gate !== null && (gate.status === "pending" || gate.status === "parked");
  const returnTo = `/invite/${token}`;

  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      <section className="dark relative isolate flex flex-col gap-6 overflow-hidden bg-[#101417] px-5 pt-6 pb-8 text-white lg:justify-center lg:gap-10 lg:px-12 lg:py-12">
        <CommandStream className="absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(16_20_23/0.55),rgb(16_20_23/0.85))]"
        />
        <Logo className="text-white lg:absolute lg:top-12 lg:left-12" />
        <div className="max-w-lg">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance lg:text-5xl">
            {inviter
              ? `${inviter} invited you to ${waiting ? "decide" : "approve"} for ${preview.teamName}`
              : `You’re invited to ${preview.teamName}`}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Their AI coding agents ask before they deploy, migrate or delete. You see exactly what
            will run, with secrets hidden, and approve it or deny it with a reason the agent
            follows.
          </p>
        </div>
        {gate && <GatePreview gate={gate} />}
      </section>

      <section className="flex justify-center px-4 py-8 lg:items-center lg:px-12 lg:py-10">
        {preview.status !== "ok" ? (
          <div className="flex w-full max-w-sm flex-col gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {preview.status === "expired" ? "This invite has expired" : "This invite was used"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {preview.status === "expired"
                ? "Invite links stop working after a while, so a forwarded one can’t be used later."
                : "Each link made for a gate lets one person in."}{" "}
              Ask {inviter ?? "whoever sent it"} for a new link.
            </p>
          </div>
        ) : user ? (
          <div className="flex w-full max-w-sm flex-col gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Join {preview.teamName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You’ll join as {preview.role === "guest" ? "a client" : "an approver"}, signed in as{" "}
                {user.email}.
              </p>
            </div>
            <AcceptInvite
              token={token}
              label={waiting ? `Join and decide TG-${gate.code}` : "Join the team"}
            />
          </div>
        ) : (
          <SignInForm
            heading={{ text: waiting ? "Sign in to decide" : "Sign in to join", level: "h2" }}
            callbackURL={returnTo}
            googleEnabled={googleEnabled()}
            githubEnabled={githubEnabled()}
            devEmailLog={env.NODE_ENV === "development" && !env.EMAIL_API_KEY}
            initialError={null}
          />
        )}
      </section>
    </main>
  );
}
