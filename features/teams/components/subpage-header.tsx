import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SubpageHeader({
  teamId,
  teamName,
  title,
  actions,
}: {
  teamId: string;
  teamName: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-2 py-2 sm:px-4">
        <Link
          href={`/teams/${teamId}`}
          aria-label={`Back to ${teamName}`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{teamName}</p>
          <h1 className="truncate text-base leading-tight font-semibold">{title}</h1>
        </div>
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
