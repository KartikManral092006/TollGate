import { ArrowLeft, ArrowRight, Info, TriangleAlert } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import { docPage, type DocHref } from "@/features/docs/pages";
import { cn } from "@/lib/utils";

// Building blocks for docs pages: plain, readable, and the same dark look as the landing.

export function DocTitle({ href }: { href: DocHref }) {
  const { page } = docPage(href);
  return (
    <header className="mb-10 border-b border-white/10 pb-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {page.title}
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/65">{page.summary}</p>
    </header>
  );
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-14 mb-4 scroll-mt-24 text-xl font-bold tracking-tight first:mt-0"
    >
      <a
        href={`#${id}`}
        className="hover:underline hover:decoration-white/30 hover:underline-offset-4"
      >
        {children}
      </a>
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-2 font-bold">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="my-4 max-w-2xl leading-relaxed text-white/75">{children}</p>;
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="my-4 flex max-w-2xl list-disc flex-col gap-2 ps-5 leading-relaxed text-white/75 marker:text-white/30">
      {children}
    </ul>
  );
}

// Inline code.
export function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] whitespace-nowrap text-white/90">
      {children}
    </code>
  );
}

// A command or snippet with a copy button.
export function Command({ value, label }: { value: string; label?: string }) {
  return (
    <div className="my-4 max-w-2xl">
      {label && <p className="mb-1.5 text-xs text-white/45">{label}</p>}
      <CodeBlock size="sm" className="border-white/10 bg-black/40 text-white">
        <CodeBlockContent wrap className="pe-11! text-[13px] break-all">
          {value}
        </CodeBlockContent>
        <CodeBlockActions>
          <CodeBlockCopyButton
            value={value}
            className="bg-white/10! text-white/80 ring-white/20! hover:bg-white/20! hover:text-white"
          />
        </CodeBlockActions>
      </CodeBlock>
    </div>
  );
}

// Output the terminal prints, shown for recognition rather than copying.
export function Output({ children }: { children: string }) {
  return (
    <pre className="my-4 max-w-2xl overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-white/60">
      {children}
    </pre>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="my-6 flex max-w-2xl flex-col gap-8 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="relative ps-11 [counter-increment:step] before:absolute before:top-0 before:left-0 before:grid before:size-7 before:place-items-center before:rounded-full before:border before:border-[#f2a900]/40 before:bg-[#f2a900]/10 before:font-mono before:text-xs before:text-[#f2c14e] before:content-[counter(step)]">
      <h3 className="font-bold">{title}</h3>
      <div className="text-white/75 [&>p]:my-2">{children}</div>
    </li>
  );
}

export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <aside
      className={cn(
        "my-6 flex max-w-2xl gap-3 rounded-xl border-s-2 px-4 py-3 text-sm leading-relaxed",
        tone === "warn"
          ? "border-[#f2a900] bg-[#f2a900]/[0.07]"
          : "border-[#2ee59d] bg-[#2ee59d]/[0.06]",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warn" ? "text-[#f2c14e]" : "text-[#2ee59d]",
        )}
        aria-hidden
      />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <div className="mt-0.5 text-white/70 [&_p]:my-1">{children}</div>
      </div>
    </aside>
  );
}

export function Figure({
  src,
  alt,
  caption,
  narrow = false,
}: {
  src: StaticImageData;
  alt: string;
  caption: string;
  narrow?: boolean;
}) {
  return (
    <figure className={cn("my-8", narrow ? "max-w-xs" : "max-w-2xl")}>
      <Image
        src={src}
        alt={alt}
        placeholder="blur"
        sizes={narrow ? "320px" : "(min-width: 1024px) 672px, 100vw"}
        className="rounded-xl border border-white/10"
      />
      <figcaption className="mt-2 text-xs text-white/45">{caption}</figcaption>
    </figure>
  );
}

// A small reference table: two or three columns of short text.
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="my-6 max-w-2xl overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-xs text-white/55">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-4 py-2.5 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row, index) => (
            <tr key={index} className="align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 text-white/75">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrevNext({ href }: { href: DocHref }) {
  const { previous, next } = docPage(href);
  return (
    <nav
      aria-label="More docs"
      className="mt-16 grid max-w-2xl gap-3 border-t border-white/10 pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={previous.href}
          className="group rounded-xl border border-white/10 px-4 py-3 transition-colors hover:border-white/25"
        >
          <span className="flex items-center gap-1 text-xs text-white/45">
            <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />{" "}
            Previous
          </span>
          <span className="font-semibold">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={next.href}
          className="group rounded-xl border border-white/10 px-4 py-3 text-right transition-colors hover:border-white/25"
        >
          <span className="flex items-center justify-end gap-1 text-xs text-white/45">
            Next <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="font-semibold">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
