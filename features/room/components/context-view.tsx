import { TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { DATA_LOSS } from "@/features/insights/shared/signals";
import { cn } from "@/lib/utils";

const KEYWORDS =
  /\b(ALTER|CREATE|DROP|TABLE|COLUMN|INDEX|ADD|RENAME|TO|DELETE|FROM|WHERE|UPDATE|SET|INSERT|INTO|VALUES|TRUNCATE|NOT|NULL|DEFAULT|PRIMARY|KEY|REFERENCES|ON|CONSTRAINT|UNIQUE|TYPE|IF|EXISTS|CASCADE|BEGIN|COMMIT|SCHEMA|DATABASE)\b/gi;

// The data-loss rule a line breaks, if any: the same rules as the risk signals above it.
export function lossOf(line: string): string | null {
  return DATA_LOSS.find((rule) => rule.pattern.test(line))?.text ?? null;
}

function Highlighted({ line }: { line: string }) {
  const parts = line.split(KEYWORDS);
  return (
    <>
      {parts.map((part, index) =>
        // split() with a capture group puts the matches at odd indexes.
        index % 2 === 1 ? (
          <span key={index} className="font-semibold text-primary">
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// The gate's context (newest migration SQL, last commit) with the lines that destroy data
// marked in red, so an approver sees where the risk is, not only that it exists.
export function ContextView({ text }: { text: string }) {
  return (
    <div className="max-h-72 overflow-auto rounded-md bg-muted py-2 font-mono text-xs leading-relaxed">
      {text.split("\n").map((line, index) => {
        const loss = lossOf(line);
        const heading = /^(Newest migration|Last commit)\b/.test(line);
        return (
          <div
            key={index}
            className={cn(
              "flex min-h-5 items-start gap-3 px-3",
              loss && "bg-gate-denied-bg text-gate-denied-fg",
              heading && "pt-1 font-sans font-semibold text-muted-foreground",
            )}
          >
            <span className="min-w-0 flex-1 break-all whitespace-pre-wrap">
              {heading || loss ? line : <Highlighted line={line} />}
            </span>
            {loss && (
              <span className="flex shrink-0 items-center gap-1 font-sans font-semibold">
                <TriangleAlert className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{loss}</span>
                <span className="sr-only sm:hidden">{loss}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
