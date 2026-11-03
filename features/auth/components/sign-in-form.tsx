"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/auth/client/auth-client";
import { signInErrorMessage } from "@/features/auth/shared/errors";
import { SIGN_IN_PATH } from "@/features/auth/shared/routes";
import { clientEnv } from "@/lib/env.client";

type Status = "idle" | "sending" | "sent" | "redirecting";

type ClientError = { status?: number; code?: string } | null;

function describeError(error: ClientError, via: "email" | "google", google: boolean): string {
  const code =
    error?.status === 429
      ? via === "google"
        ? "RATE_LIMITED"
        : "TOO_MANY_REQUESTS"
      : (error?.code ?? "UNKNOWN");
  return signInErrorMessage(code, { google, appUrl: clientEnv.NEXT_PUBLIC_APP_URL }) ?? "";
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.26 6.62l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

export function SignInForm(props: {
  callbackURL: string;
  googleEnabled: boolean;
  githubEnabled: boolean;
  devEmailLog: boolean;
  initialError: string | null;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [provider, setProvider] = useState<"google" | "github">("google");
  const [error, setError] = useState<string | null>(props.initialError);
  const busy = status === "sending" || status === "redirecting";

  // Back from Google restores this page from the back-forward cache with the old state,
  // which would leave the form disabled on "Opening Google…".
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setStatus((current) =>
          current === "redirecting" || current === "sending" ? "idle" : current,
        );
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // What the box shows: text typed before the page finished loading is in the field but not
    // yet in React state.
    const typed = new FormData(event.currentTarget).get("email");
    const address = (typeof typed === "string" ? typed : email).trim();
    setEmail(address);
    setError(null);
    setStatus("sending");
    try {
      const result = await authClient.signIn.magicLink({
        email: address,
        callbackURL: props.callbackURL,
        errorCallbackURL: SIGN_IN_PATH,
      });
      if (result.error) {
        setError(describeError(result.error, "email", props.googleEnabled));
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError(describeError(null, "email", props.googleEnabled));
      setStatus("idle");
    }
  }

  async function signInWithSocial(next: "google" | "github") {
    setError(null);
    setProvider(next);
    setStatus("redirecting");
    try {
      const result = await authClient.signIn.social({
        provider: next,
        callbackURL: props.callbackURL,
        errorCallbackURL: SIGN_IN_PATH,
      });
      if (result.error) {
        setError(describeError(result.error, "google", props.googleEnabled));
        setStatus("idle");
      }
    } catch {
      setError(describeError(null, "google", props.googleEnabled));
      setStatus("idle");
    }
  }

  return (
    <Card className="w-full max-w-sm border-0 bg-transparent shadow-none ring-0">
      <CardHeader className="px-0">
        <CardTitle>
          <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
        </CardTitle>
        <CardDescription>
          No password: we email you a sign-in link. New here? The same link creates your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {status === "sent" ? (
          <div className="flex flex-col gap-3" role="status">
            <p className="text-sm">
              Check your inbox at <span className="font-medium break-all">{email.trim()}</span>. The
              link works once and expires in 10 minutes.
            </p>
            {props.devEmailLog && (
              <p className="text-sm text-muted-foreground">
                Development: the link is in the terminal running <code>pnpm dev</code>.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setStatus("idle")}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={sendLink}>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              className="h-11"
            />
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
            </Button>
          </form>
        )}

        {(props.googleEnabled || props.githubEnabled) && status !== "sent" && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            {props.githubEnabled && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={busy}
                onClick={() => void signInWithSocial("github")}
              >
                <GitHubMark />
                {status === "redirecting" && provider === "github"
                  ? "Opening GitHub…"
                  : "Continue with GitHub"}
              </Button>
            )}
            {props.googleEnabled && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={busy}
                onClick={() => void signInWithSocial("google")}
              >
                <GoogleMark />
                {status === "redirecting" && provider === "google"
                  ? "Opening Google…"
                  : "Continue with Google"}
              </Button>
            )}
          </>
        )}

        <p aria-live="polite" className="min-h-5 text-sm text-destructive">
          {error}
        </p>
      </CardContent>
    </Card>
  );
}
