"use client";

import { Check, KeyRound, MessagesSquare, Terminal, UserCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/features/landing/motion/gsap";
import { cn } from "@/lib/utils";

const VIEW = { w: 800, h: 480 };
const PATH = "M 90 110 H 400 C 560 110 700 150 700 240 C 700 330 560 370 400 370 H 90";
const STATIONS = [
  { x: 90, y: 110, icon: Terminal },
  { x: 400, y: 110, icon: KeyRound },
  { x: 700, y: 240, icon: MessagesSquare },
  { x: 400, y: 370, icon: UserCheck },
  { x: 90, y: 370, icon: Check },
];

const STEPS = [
  {
    title: "The hook catches it",
    body: "Claude Code calls Tollgate before every Bash command. Everyday ones run. Risky ones stop here.",
  },
  {
    title: "Secrets stay on your laptop",
    body: "Tokens, passwords and .env values are stripped before anything leaves your machine.",
  },
  {
    title: "Your team sees it live",
    body: "A gate card lands in the team's room with what it really runs and what could break.",
  },
  {
    title: "Someone decides",
    body: "Approve it, or deny it with a reason. Not sure? Ask the agent a question first.",
  },
  {
    title: "The agent follows",
    body: "Approved, it runs once. Denied, your reason becomes the agent's next instruction.",
  },
];

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

// Where along the track each station sits, as 0..1. getPointAtLength is slow on phones, so the
// track is sampled once, coarsely, for every station together, then each station's best sample
// is refined between its neighbours: about 180 reads instead of 2,000 while the page starts.
function stationPositions(track: SVGPathElement, length: number): number[] {
  const COARSE = 120;
  const FINE = 12;
  const distanceAt = (t: number, station: { x: number; y: number }) => {
    const point = track.getPointAtLength(t * length);
    return Math.hypot(point.x - station.x, point.y - station.y);
  };
  const samples = Array.from({ length: COARSE + 1 }, (_, i) =>
    track.getPointAtLength((i / COARSE) * length),
  );
  return STATIONS.map((station) => {
    let best = 0;
    let bestDistance = Infinity;
    samples.forEach((point, i) => {
      const distance = Math.hypot(point.x - station.x, point.y - station.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i / COARSE;
      }
    });
    const from = Math.max(0, best - 1 / COARSE);
    const to = Math.min(1, best + 1 / COARSE);
    for (let i = 0; i <= FINE; i++) {
      const t = from + ((to - from) * i) / FINE;
      const distance = distanceAt(t, station);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = t;
      }
    }
    return best;
  });
}
// The visual's own size; it's scaled to fit its column.
const DESIGN = { w: 720, h: 432 };

// "How it works" as one command's journey: it travels the track from the agent to the team
// and back, and each station shows what happens there. On wide screens the section pins
// and scrolling drives it; on phones it plays on its own while in view.
export function Pipeline() {
  const root = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const fit = () => element.style.setProperty("--fit", String(element.clientWidth / DESIGN.w));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const track = q("[data-track]")[0] as SVGPathElement | undefined;
      const token = q("[data-token]")[0] as HTMLElement | undefined;
      if (!track || !token) return;
      const length = track.getTotalLength();
      const at = stationPositions(track, length);
      const travel = { p: 0 };
      const place = () => {
        const point = track.getPointAtLength(travel.p * length);
        token.style.left = pct(point.x, VIEW.w);
        token.style.top = pct(point.y, VIEW.h);
      };
      place();

      const build = () => {
        const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        const steps = q("[data-step]");
        const focus = (index: number, position: string | number) => {
          tl.to(steps, { opacity: 0.45, duration: 0.3 }, position);
          tl.to(steps[index] ?? [], { opacity: 1, duration: 0.3 }, position);
          tl.to(
            q(`[data-station="${index}"]`),
            { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.4)" },
            position,
          );
          tl.to(
            q(`[data-station-ring="${index}"]`),
            { scale: 2.4, opacity: 0, duration: 0.9, ease: "power2.out" },
            position,
          );
        };
        const travelTo = (index: number) => {
          tl.addLabel(`s${index}`);
          tl.to(travel, { p: at[index]!, duration: 1, onUpdate: place }, `s${index}`);
          tl.to(q("[data-lit]"), { drawSVG: `0% ${at[index]! * 100}%`, duration: 1 }, `s${index}`);
          focus(index, `s${index}+=0.85`);
        };

        tl.set(q("[data-station]"), { scale: 0.4, opacity: 0.35 })
          .set(q("[data-lit]"), { drawSVG: "0% 0%" })
          .set(q("[data-overlay]"), { autoAlpha: 0, y: 14 })
          .set(token, { scale: 0, autoAlpha: 0 })
          .set(q("[data-token-text]"), { textContent: "prisma migrate deploy" })
          .set(q("[data-secret]"), { textContent: "DATABASE_URL=postgres://ana:hunter2@db" })
          .set(q("[data-reason]"), { textContent: "" })
          .set(token, { "--tint": "#e9eef2" });

        // 1. Caught by the hook.
        tl.to(token, { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2)" });
        focus(0, "<");
        tl.to(q('[data-overlay="hook"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, "<+=0.2");

        // 2. Secrets stripped.
        travelTo(1);
        tl.to(q('[data-overlay="secret"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, "<");
        tl.to(q("[data-secret]"), {
          duration: 0.9,
          ease: "none",
          scrambleText: { text: "DATABASE_URL=•••••••• redacted", chars: "•#*", speed: 1 },
        });

        // 3. A gate card in the team's room.
        travelTo(2);
        tl.to(token, { "--tint": "#f2a900", duration: 0.4 }, "<+=0.5");
        tl.to(
          q('[data-overlay="card"]'),
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)" },
          "<",
        );

        // 4. A teammate denies it, with a reason.
        travelTo(3);
        tl.to(q('[data-overlay="decide"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, "<");
        tl.to(q("[data-deny]"), {
          backgroundColor: "rgb(255 59 92 / 0.22)",
          borderColor: "rgb(255 59 92 / 0.7)",
          duration: 0.3,
        });
        tl.to(q("[data-reason]"), {
          duration: 1,
          ease: "none",
          scrambleText: { text: "Rename it, don't drop it.", chars: "lowerCase", speed: 1 },
        });

        // 5. Back to the agent, which replans.
        travelTo(4);
        tl.to(token, { "--tint": "#2ee59d", duration: 0.4 }, "<+=0.6");
        tl.to(
          q("[data-token-text]"),
          {
            duration: 0.8,
            ease: "none",
            scrambleText: { text: "rename column, then backfill", chars: "01<>/", speed: 1 },
          },
          "<",
        );
        tl.to(q('[data-overlay="done"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, "<+=0.3");
        tl.to({}, { duration: 0.6 });
        return tl;
      };

      const mm = gsap.matchMedia();
      mm.add(
        {
          wide: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          narrow: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const tl = build();
          const { wide, narrow } = context.conditions as Record<string, boolean>;
          if (wide) {
            tl.pause();
            gsap.to(tl, {
              progress: 1,
              ease: "none",
              scrollTrigger: {
                trigger: q("[data-stage]")[0],
                start: "center center",
                end: "+=2600",
                pin: true,
                scrub: 0.9,
              },
            });
          } else if (narrow) {
            tl.repeat(-1).repeatDelay(1.6).pause();
            gsap.timeline({
              scrollTrigger: {
                trigger: q("[data-stage]")[0],
                start: "top 75%",
                end: "bottom 25%",
                onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
              },
            });
          } else {
            // No motion: the finished picture, with every step readable, not just the last.
            tl.progress(1).pause();
            gsap.set(q("[data-step]"), { opacity: 1 });
          }
        },
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} id="how" className="relative scroll-mt-20 px-4 py-20 sm:px-6 lg:py-0">
      <div
        data-stage
        className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:min-h-dvh lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div>
          <p className="mb-4 font-mono text-xs text-[#f2a900]">How it works</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            One hook, one room, one decision the agent follows
          </h2>
          <ol className="mt-8 flex flex-col gap-5">
            {STEPS.map((step, index) => (
              <li key={step.title} data-step className="flex gap-4">
                <span className="mt-0.5 font-mono text-sm text-white/60 tabular-nums">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/60">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Laid out at one design size and scaled as a whole, so labels and the track keep
            their proportions on any screen. */}
        <div
          ref={frame}
          className="relative aspect-[5/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0d1216] bg-[radial-gradient(60%_60%_at_50%_50%,rgb(242_169_0/0.07),transparent_70%)]"
          aria-hidden
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: DESIGN.w, height: DESIGN.h, scale: "var(--fit, 1)" }}
          >
            {/* Faint grid behind the track. */}
            <div className="absolute inset-0 rounded-3xl bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] [mask-image:radial-gradient(75%_75%_at_50%_50%,#000,transparent)] bg-[size:32px_32px]" />
            <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 size-full">
              <defs>
                <linearGradient id="pipeline-lit" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#e9eef2" />
                  <stop offset="45%" stopColor="#f2a900" />
                  <stop offset="70%" stopColor="#ff3b5c" />
                  <stop offset="100%" stopColor="#2ee59d" />
                </linearGradient>
              </defs>
              <path
                d={PATH}
                fill="none"
                stroke="rgb(255 255 255 / 0.12)"
                strokeWidth={2}
                strokeDasharray="4 8"
              />
              {/* A wide faint copy instead of an SVG blur filter, which repaints every frame. */}
              <path
                data-lit
                d={PATH}
                fill="none"
                stroke="url(#pipeline-lit)"
                strokeWidth={12}
                strokeLinecap="round"
                opacity={0.12}
              />
              <path
                data-track
                data-lit
                d={PATH}
                fill="none"
                stroke="url(#pipeline-lit)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </svg>

            {STATIONS.map((station, index) => (
              <div
                key={index}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: pct(station.x, VIEW.w), top: pct(station.y, VIEW.h) }}
              >
                <span
                  data-station-ring={index}
                  className="absolute inset-0 rounded-full border border-[#f2a900]"
                />
                <span
                  data-station={index}
                  className="relative grid size-11 place-items-center rounded-full border border-white/15 bg-[#151b20] text-white/85 shadow-[0_0_30px_-6px_rgb(242_169_0/0.6)]"
                >
                  <station.icon className="size-5" />
                </span>
              </div>
            ))}

            {/* What happens at each station. */}
            <span
              data-overlay="hook"
              className="absolute rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/70"
              style={{ left: pct(60, VIEW.w), top: pct(30, VIEW.h) }}
            >
              PreToolUse hook
            </span>
            <span
              data-overlay="secret"
              className="absolute -translate-x-1/2 rounded-md border border-[#2ee59d]/30 bg-[#2ee59d]/10 px-2 py-1 font-mono text-[11px] whitespace-nowrap text-[#7ff0c3]"
              style={{ left: pct(400, VIEW.w), top: pct(152, VIEW.h) }}
            >
              <span data-secret />
            </span>
            <div
              data-overlay="card"
              className="absolute w-[42%] -translate-x-1/2 -translate-y-1/2 scale-95 rounded-xl border border-[#f2a900]/40 bg-[#12181c]/95 p-3 shadow-[0_20px_60px_-20px_rgb(242_169_0/0.5)]"
              style={{ left: "47%", top: "50%" }}
            >
              <p className="flex items-center justify-between text-[11px] text-white/55">
                <span className="font-mono font-semibold text-white">TG-17</span>
                <span className="flex items-center gap-1 text-[#f2c14e]">
                  <span className="size-1.5 animate-pulse rounded-full bg-[#f2a900]" /> Waiting
                </span>
              </p>
              <p className="mt-1.5 truncate rounded-md bg-black/50 px-2 py-1 font-mono text-[11px] text-white/85">
                prisma migrate deploy
              </p>
              <p className="mt-1.5 text-[11px] text-[#ff7a90]">Drops column legacy_total</p>
            </div>
            <div
              data-overlay="decide"
              className="absolute flex -translate-x-1/2 items-center gap-2 text-[11px]"
              style={{ left: pct(400, VIEW.w), top: pct(410, VIEW.h) }}
            >
              <span className="rounded-md border border-white/15 px-2 py-1 text-white/60">
                Approve
              </span>
              <span data-deny className="rounded-md border border-white/15 px-2 py-1 text-white">
                Deny
              </span>
              <span className="font-mono whitespace-nowrap text-[#ff9aab]">
                “<span data-reason />”
              </span>
            </div>
            <span
              data-overlay="done"
              className="absolute -translate-x-1/2 rounded-md border border-[#2ee59d]/30 bg-[#2ee59d]/10 px-2 py-1 text-[11px] whitespace-nowrap text-[#7ff0c3]"
              style={{ left: pct(90, VIEW.w), top: pct(410, VIEW.h) }}
            >
              Agent replans
            </span>

            {/* The command itself, travelling the track. */}
            <div
              data-token
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 font-mono text-xs whitespace-nowrap",
                "border-[color:var(--tint)] bg-[#0b0f12] text-[color:var(--tint)] shadow-[0_0_24px_-4px_var(--tint)]",
              )}
              style={{ ["--tint" as string]: "#e9eef2" }}
            >
              $ <span data-token-text>prisma migrate deploy</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
