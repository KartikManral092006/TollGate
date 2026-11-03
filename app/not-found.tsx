import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The room may not exist, or the link may be incomplete.
      </p>
      <Link href="/home" className={buttonVariants({ className: "h-11" })}>
        Go to your teams
      </Link>
    </main>
  );
}
