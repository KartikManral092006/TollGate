// The landing hero: an agent's command stream drifting left to right, in lanes at different
// depths, toward a single gate line. Everyday commands pass faintly through it; a risky one
// stops at the line while a ring pulses and the commands behind it queue up, then it either
// turns green and goes on or turns red and fades. Plain 2D canvas: every command is drawn
// once into a small image and each frame only copies those images, so it stays smooth on
// modest laptops and phones.

const COMMANDS: { text: string; risky: boolean }[] = [
  { text: "vercel --prod", risky: true },
  { text: "npx prisma migrate deploy", risky: true },
  { text: "npm publish --access public", risky: true },
  { text: "terraform apply -auto-approve", risky: true },
  { text: "aws s3 rm s3://backups --recursive", risky: true },
  { text: "pnpm db:deploy", risky: true },
  { text: "drizzle-kit push", risky: true },
  { text: "kubectl delete ns staging", risky: true },
  { text: "git status", risky: false },
  { text: "pnpm test", risky: false },
  { text: "ls -la src/", risky: false },
  { text: "git diff --stat", risky: false },
  { text: "cat package.json", risky: false },
  { text: "pnpm lint --fix", risky: false },
  { text: "rg 'legacy_total' src", risky: false },
  { text: "git commit -m 'fix: totals'", risky: false },
  { text: "pnpm build", risky: false },
  { text: "tsc --noEmit", risky: false },
  { text: "git log --oneline -5", risky: false },
  { text: "pnpm add zod", risky: false },
];

// Muted on purpose: colour is only for the moments that matter.
const INK = { safe: "#93a8b8", risky: "#e0a43a", held: "#ff6b7f", approved: "#3fd6a0" } as const;
type Ink = keyof typeof INK;

const FONT_PX = 13;
const TRAIL_PX = 56;
const GAP = 34;

type Sprite = { canvas: HTMLCanvasElement; textW: number; h: number };
type Flyer = {
  cmd: number;
  x: number; // left edge of the text, in CSS pixels
  lane: number; // index into lanes
  risky: boolean;
  state: "fly" | "held" | "approved" | "denied";
  heldMs: number;
  holdFor: number;
  fade: number;
};

export function createGateStream(
  canvas: HTMLCanvasElement,
  options: { reduced: boolean; light: boolean; fontFamily: string },
) {
  const ctx = canvas.getContext("2d")!;
  let dpr = 1;
  let width = 0;
  let height = 0;
  let gateX = 0;
  // Each lane has one depth, and so one speed: nothing overtakes on a lane.
  let lanes: { y: number; depth: number }[] = [];
  let riskyLanes: number[] = [];
  let fadeFrom = 0;
  let fadeTo = 0;
  let dim = 1;
  let sprites: Record<Ink, Sprite[]> = { safe: [], risky: [], held: [], approved: [] };

  // One image per command and colour: a fading trail, then "$ command".
  const buildSprites = () => {
    const make = (text: string, ink: Ink): Sprite => {
      const c = document.createElement("canvas");
      const g = c.getContext("2d")!;
      const font = `500 ${FONT_PX * dpr}px ${options.fontFamily}, ui-monospace, monospace`;
      g.font = font;
      const textW = Math.ceil(g.measureText(`$ ${text}`).width) + 2 * dpr;
      const h = Math.ceil(FONT_PX * dpr * 1.6);
      c.width = TRAIL_PX * dpr + textW;
      c.height = h;
      const trail = g.createLinearGradient(0, 0, TRAIL_PX * dpr, 0);
      trail.addColorStop(0, "rgba(0,0,0,0)");
      trail.addColorStop(1, INK[ink]);
      g.globalAlpha = 0.35;
      g.fillStyle = trail;
      g.fillRect(0, h / 2 - 0.5 * dpr, TRAIL_PX * dpr - 4 * dpr, dpr);
      g.globalAlpha = 1;
      g.font = font;
      g.textBaseline = "middle";
      g.fillStyle = INK[ink];
      g.fillText(`$ ${text}`, TRAIL_PX * dpr, h / 2 + 0.5 * dpr);
      return { canvas: c, textW, h };
    };
    sprites = {
      safe: COMMANDS.map((c) => make(c.text, "safe")),
      risky: COMMANDS.map((c) => make(c.text, "risky")),
      held: COMMANDS.map((c) => make(c.text, "held")),
      approved: COMMANDS.map((c) => make(c.text, "approved")),
    };
  };

  const riskyIdx = COMMANDS.flatMap((c, i) => (c.risky ? [i] : []));
  const safeIdx = COMMANDS.flatMap((c, i) => (c.risky ? [] : [i]));
  const pick = (list: number[]) => list[Math.floor(Math.random() * list.length)]!;
  const COUNT = options.light ? 26 : 44;
  let flyers: Flyer[] = [];
  let held: Flyer | null = null;

  const depthOf = (f: Flyer) => lanes[f.lane]!.depth;
  const widthOf = (f: Flyer) => (sprites.safe[f.cmd]!.textW / dpr) * depthOf(f);
  const speedOf = (f: Flyer) => (34 + 46 * depthOf(f)) * (f.state === "approved" ? 1.4 : 1);

  const spawn = (f: Partial<Flyer>, anywhere = false): Flyer => {
    const risky = riskyLanes.length > 0 && Math.random() < 0.12;
    const lane = risky ? pick(riskyLanes) : Math.floor(Math.random() * lanes.length);
    const next = Object.assign(f, {
      cmd: risky ? pick(riskyIdx) : pick(safeIdx),
      lane,
      risky,
      state: "fly",
      heldMs: 0,
      holdFor: 1800 + Math.random() * 1400,
      fade: 1,
      x: 0,
    }) as Flyer;
    // Enter behind the last command already on this lane, never on top of it.
    let tail = Infinity;
    for (const other of flyers) {
      if (other !== next && other.lane === lane) tail = Math.min(tail, other.x);
    }
    const scale = lanes[lane]!.depth;
    const room = widthOf(next) + GAP + TRAIL_PX * scale;
    const start = anywhere ? Math.random() * width : -room - Math.random() * width * 0.3;
    next.x = Math.min(start, tail - room);
    if (anywhere && risky && next.x > gateX) next.state = "approved";
    return next;
  };

  // A ring that pulses where a held command meets the gate, and a flash on decisions.
  let pulse = 0;
  let flash: { color: string; life: number; y: number } | null = null;
  const pointer = { x: 0, y: 0 };
  const lean = { x: 0, y: 0 };

  const resize = () => {
    const parent = canvas.parentElement!;
    width = parent.clientWidth;
    height = Math.max(1, parent.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, options.light ? 1.5 : 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const wide = width >= 1024;
    // Wide: the gate stands right of the headline. Narrow: near the right edge, behind it.
    gateX = wide ? width * 0.68 : width * 0.82;
    const top = wide ? height * 0.14 : height * 0.5;
    const bottom = height * 0.92;
    const rows = wide ? 15 : 9;
    lanes = Array.from({ length: rows }, (_, i) => {
      // Near lanes, where risky commands run, alternate with far ones through the middle.
      const middle = i >= rows * 0.3 && i <= rows * 0.72 && i % 2 === 0;
      return {
        y: top + ((bottom - top) * i) / (rows - 1),
        depth: middle ? 1 : 0.55 + ((i * 37) % 10) / 24,
      };
    });
    riskyLanes = lanes.flatMap((lane, i) => (lane.depth === 1 ? [i] : []));
    // Wide: commands appear only to the right of the headline. Narrow: dimmer, behind it.
    fadeFrom = wide ? width * 0.5 : 0;
    fadeTo = wide ? width * 0.62 : 0;
    dim = wide ? 1 : 0.55;
    buildSprites();
    held = null;
    flyers = [];
    for (let i = 0; i < COUNT; i++) flyers.push(spawn({}, true));
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);

  const step = (dt: number) => {
    const s = dt / 1000;

    // Move, then settle each lane front to back so nobody runs into the one ahead (which may
    // be waiting at the gate): a queue forms behind a held command.
    for (const f of flyers) {
      if (f.state === "held") {
        f.heldMs += dt;
        if (f.heldMs > f.holdFor) {
          const denied = Math.random() < 0.3;
          f.state = denied ? "denied" : "approved";
          flash = { color: denied ? "255,107,127" : "63,214,160", life: 1, y: lanes[f.lane]!.y };
          held = null;
        }
        continue;
      }
      if (f.state === "denied") {
        f.fade -= s * 1.6;
        if (f.fade <= 0) spawn(f);
        continue;
      }
      const w = widthOf(f);
      const front = f.x + w;
      f.x += speedOf(f) * s;
      // The front of a risky command reaching the gate stops it there, if the gate is free.
      if (f.risky && f.state === "fly" && front <= gateX - 8 && f.x + w >= gateX - 8) {
        f.x = gateX - 8 - w;
        // Free gate: it's held for a decision. Busy: it waits at the line for its turn.
        if (held === null) {
          f.state = "held";
          f.heldMs = 0;
          held = f;
        }
      }
      if (f.x > width + 40) spawn(f);
    }
    const byLane = new Map<number, Flyer[]>();
    for (const f of flyers) {
      const list = byLane.get(f.lane);
      if (list) list.push(f);
      else byLane.set(f.lane, [f]);
    }
    for (const list of byLane.values()) {
      list.sort((a, b) => b.x - a.x);
      for (let i = 1; i < list.length; i++) {
        const ahead = list[i - 1]!;
        const f = list[i]!;
        const limit = ahead.x - GAP - TRAIL_PX * depthOf(ahead) * 0.4 - widthOf(f);
        if (f.x > limit) f.x = limit;
      }
    }
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    lean.x += (pointer.x - lean.x) * 0.05;
    lean.y += (pointer.y - lean.y) * 0.05;

    // The gate: one slim line, brightest in the middle, with faint ticks.
    const gTop = lanes[0]!.y - 40;
    const gBottom = lanes[lanes.length - 1]!.y + 30;
    const line = ctx.createLinearGradient(0, gTop, 0, gBottom);
    line.addColorStop(0, "rgba(242,169,0,0)");
    line.addColorStop(0.5, `rgba(242,169,0,${0.42 * dim})`);
    line.addColorStop(1, "rgba(242,169,0,0)");
    ctx.fillStyle = line;
    ctx.fillRect(gateX - 0.5, gTop, 1, gBottom - gTop);
    ctx.fillStyle = `rgba(242,169,0,${0.18 * dim})`;
    for (let y = gTop + 40; y < gBottom - 30; y += 22) ctx.fillRect(gateX - 3, y, 6, 1);

    for (const f of flyers) {
      const depth = depthOf(f);
      const ink: Ink = !f.risky
        ? "safe"
        : f.state === "approved"
          ? "approved"
          : f.state === "fly"
            ? "risky"
            : "held";
      const sprite = sprites[ink][f.cmd]!;
      const textW = widthOf(f);
      const enter =
        fadeTo > fadeFrom
          ? Math.min(1, Math.max(0, (f.x + textW - fadeFrom) / (fadeTo - fadeFrom)))
          : 1;
      // Near commands are brighter and drift more with the pointer than far ones.
      const alpha =
        (f.risky ? 0.9 : 0.16 + (depth - 0.55) * 0.75) *
        (f.state === "denied" ? Math.max(0, f.fade) : 1) *
        enter *
        dim;
      if (alpha <= 0.01) continue;
      const px = f.x + lean.x * 10 * depth;
      const py = lanes[f.lane]!.y + lean.y * 6 * depth;
      const showTrail = f.state !== "held" && f.state !== "denied";
      const sx = showTrail ? 0 : TRAIL_PX * dpr;
      const sw = sprite.canvas.width - sx;
      const dw = (sw / dpr) * depth;
      const dh = (sprite.h / dpr) * depth;
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        sprite.canvas,
        sx,
        0,
        sw,
        sprite.h,
        showTrail ? px - TRAIL_PX * depth : px,
        py - dh / 2,
        dw,
        dh,
      );
    }
    ctx.globalAlpha = 1;

    // The held command's ring, pulsing on the gate.
    if (held) {
      const y = lanes[held.lane]!.y + lean.y * 6;
      for (const offset of [0, 0.5]) {
        const t = (pulse + offset) % 1;
        ctx.strokeStyle = `rgba(255,107,127,${0.5 * (1 - t) * dim})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gateX, y, 4 + t * 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,107,127,${0.9 * dim})`;
      ctx.beginPath();
      ctx.arc(gateX, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // A short flash on the gate when a decision lands.
    if (flash) {
      const glow = ctx.createLinearGradient(0, flash.y - 60, 0, flash.y + 60);
      glow.addColorStop(0, `rgba(${flash.color},0)`);
      glow.addColorStop(0.5, `rgba(${flash.color},${0.7 * flash.life * dim})`);
      glow.addColorStop(1, `rgba(${flash.color},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(gateX - 1, flash.y - 60, 2, 120);
    }
  };

  const tick = (dt: number) => {
    step(dt);
    pulse = (pulse + (dt / 1000) * 0.9) % 1;
    if (flash) {
      flash.life -= (dt / 1000) * 1.4;
      if (flash.life <= 0) flash = null;
    }
    draw();
  };

  let frame = 0;
  let running = false;
  let last = 0;
  const loop = (now: number) => {
    tick(Math.min(50, now - last));
    last = now;
    frame = requestAnimationFrame(loop);
  };

  return {
    play() {
      if (options.reduced) {
        // One still frame, with a command waiting at the gate.
        for (let i = 0; i < 160; i++) step(33);
        draw();
        return;
      }
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(frame);
    },
    point(x: number, y: number) {
      pointer.x = x;
      pointer.y = y;
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}

export type GateStream = ReturnType<typeof createGateStream>;
