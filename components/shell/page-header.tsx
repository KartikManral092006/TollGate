import { cn } from "@/lib/utils";

// The top of every signed-in page: title and one line of context on the left, actions on
// the right, a hairline underneath. No boxes.
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b px-4 py-5 sm:flex-row sm:items-end sm:px-6 lg:px-10 lg:py-7",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight lg:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <div className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
