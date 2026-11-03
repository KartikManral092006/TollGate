import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/logo";
import { SignPanel } from "@/components/road/sign-panel";
import { TollPlaza } from "@/features/landing/components/toll-plaza";
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
      <section className="relative flex flex-col gap-6 overflow-hidden bg-asphalt px-5 pt-6 pb-8 text-white lg:justify-between lg:px-12 lg:py-12">
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-3 h-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.28)_0_28px,transparent_28px_52px)] lg:bottom-8"
        />
        <Logo className="text-white" />
        <SignPanel className="max-w-xl" innerClassName="lg:px-8 lg:py-8">
          <p className="text-2xl leading-tight font-extrabold tracking-tight text-balance lg:text-4xl">
            Your team&apos;s toll gate for coding agents
          </p>
          <p className="mt-2 text-sm text-white/85 lg:text-base">
            Risky commands stop here until a teammate says yes.
          </p>
        </SignPanel>
        <div className="hidden lg:block">
          <TollPlaza />
        </div>
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
