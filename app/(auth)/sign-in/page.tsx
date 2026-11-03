import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/logo";
import { CommandStream } from "@/features/landing/components/command-stream";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { AuthNotConfiguredError, githubEnabled, googleEnabled } from "@/features/auth/server/auth";
import { getOptionalSession } from "@/features/auth/server/session";
import { signInErrorMessage } from "@/features/auth/shared/errors";
import { safeCallbackPath } from "@/features/auth/shared/routes";
import { env } from "@/lib/env";

export const instant = false;

export const metadata: Metadata = {
  title: "Sign in · Tollgate",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  await connection();
  const params = await searchParams;
  const callbackURL = safeCallbackPath(first(params.callbackURL));

  let signedIn = false;
  try {
    signedIn = (await getOptionalSession()) !== null;
  } catch (error) {
    if (!(error instanceof AuthNotConfiguredError)) throw error;
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {signInErrorMessage("AUTH_NOT_CONFIGURED")}
        </p>
      </main>
    );
  }
  if (signedIn) redirect(callbackURL);

  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      {/* The road: on phones a compact band, on desktop a full panel with the moving gate. */}
      {/* The product in one picture: commands streaming through a gate, risky ones held. */}
      <section className="dark relative isolate flex flex-col gap-6 overflow-hidden bg-[#101417] px-5 pt-6 pb-8 text-white lg:justify-between lg:px-12 lg:py-12">
        <CommandStream className="absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(16_20_23/0.2),rgb(16_20_23/0.75))]"
        />
        <Logo className="text-white" />
        <div className="max-w-lg">
          <p className="text-3xl leading-tight font-extrabold tracking-tight text-balance lg:text-5xl">
            Human approval for AI coding agents
          </p>
          <ul className="mt-5 hidden flex-col gap-2.5 text-white/70 lg:flex">
            {[
              "Risky commands wait for your team; everyday ones run untouched",
              "Deny with a reason and the agent changes its plan",
              "Secrets are redacted before anything leaves the laptop",
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#2eb67d]" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-sm text-white/45 lg:block">
          Red dots are risky commands held at the gate. Green ones were approved.
        </p>
      </section>

      <section className="flex justify-center px-4 py-8 lg:items-center lg:px-12 lg:py-10">
        <SignInForm
          callbackURL={callbackURL}
          googleEnabled={googleEnabled()}
          githubEnabled={githubEnabled()}
          devEmailLog={env.NODE_ENV === "development" && !env.EMAIL_API_KEY}
          initialError={signInErrorMessage(first(params.error), { google: googleEnabled() })}
        />
      </section>
    </main>
  );
}
