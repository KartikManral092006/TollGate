// The docs, in reading order. The sidebar, page titles and previous/next links read this.
export const DOC_PAGES = [
  { href: "/docs", title: "Quickstart", summary: "From sign-up to your first decided gate." },
  {
    href: "/docs/approvers",
    title: "For approvers",
    summary: "Reading a gate card and deciding it, for teammates and clients.",
  },
  {
    href: "/docs/how-it-works",
    title: "How it works",
    summary: "What gets gated, what leaves your laptop, and what happens if Tollgate is down.",
  },
  {
    href: "/docs/configuration",
    title: "Configuration",
    summary: "Presets, modes, roles, team rules and invites.",
  },
  {
    href: "/docs/troubleshooting",
    title: "Troubleshooting",
    summary: "The usual problems and their fixes.",
  },
  { href: "/docs/cli", title: "CLI reference", summary: "Every tollgate-cli command." },
] as const;

export type DocHref = (typeof DOC_PAGES)[number]["href"];

export function docPage(href: DocHref) {
  const index = DOC_PAGES.findIndex((page) => page.href === href);
  return {
    page: DOC_PAGES[index]!,
    previous: index > 0 ? DOC_PAGES[index - 1]! : null,
    next: index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1]! : null,
  };
}
