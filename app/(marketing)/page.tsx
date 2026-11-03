import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Tollgate
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Your team decides before your coding agent does something you can&apos;t undo.
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Before Claude Code touches prod, a shared database, a package registry or your cloud, it
          asks your team in a live thread. The conversation decides, the agent obeys, and approvals
          still work when nobody is awake.
        </p>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted px-4 py-3 font-mono text-sm">
        npx tollgate init
      </pre>
      <p className="text-sm text-muted-foreground">
        Commands are redacted on your machine before anything is sent.{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
