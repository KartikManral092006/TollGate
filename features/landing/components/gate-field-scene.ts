import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// The landing hero: an agent's commands streaming out of the dark toward a gate of light.
// Everyday commands fly straight past; risky ones stop at the gate, get scanned, then are
// either approved (they turn green and go on) or denied (they break apart). Scrolling flies
// the camera through the gate. Plain Three.js, loaded only in the browser.

const COMMANDS: { text: string; risky: boolean }[] = [
  { text: "vercel --prod", risky: true },
  { text: "npx prisma migrate deploy", risky: true },
  { text: "npm publish --access public", risky: true },
  { text: "terraform apply -auto-approve", risky: true },
  { text: "aws s3 rm s3://backups --recursive", risky: true },
  { text: "pnpm db:deploy", risky: true },
  { text: "fly deploy -a billing", risky: true },
  { text: "drizzle-kit push", risky: true },
  { text: "rm -rf ../shared", risky: true },
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
  { text: "node scripts/seed.ts", risky: false },
  { text: "git log --oneline -5", risky: false },
  { text: "tsc --noEmit", risky: false },
  { text: "pnpm add zod", risky: false },
  { text: "curl localhost:3000/api/health", risky: false },
];

const SAFE = new THREE.Color(0x8fb8d8);
const RISKY = new THREE.Color(0xff3b5c);
const APPROVED = new THREE.Color(0x2ee59d);
const AMBER = new THREE.Color(0xf2a900);

const ROW_PX = 64;
const ATLAS_W = 1024;

type Flyer = {
  row: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  risky: boolean;
  state: "fly" | "held" | "approved" | "denied";
  heldMs: number;
  holdFor: number;
  denyChance: number;
  fade: number;
};

function buildAtlas(fontFamily: string) {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_W;
  canvas.height = ROW_PX * COMMANDS.length;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 34px ${fontFamily}, ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  const widths: number[] = [];
  COMMANDS.forEach((command, row) => {
    const label = `$ ${command.text}`;
    ctx.fillText(label, 8, row * ROW_PX + ROW_PX / 2);
    widths.push(Math.min(ATLAS_W, ctx.measureText(label).width + 16));
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.anisotropy = 4;
  texture.colorSpace = THREE.NoColorSpace;
  return { texture, widths };
}

const flyerVertex = /* glsl */ `
  attribute float aRow;
  attribute float aWidth;
  attribute vec3 aTint;
  attribute float aAlpha;
  uniform float uRows;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vAlpha;
  varying float vDepth;
  void main() {
    vUv = vec2(uv.x * aWidth, (aRow + 1.0 - uv.y) / uRows);
    vTint = aTint;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const flyerFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vAlpha;
  varying float vDepth;
  void main() {
    float glyph = texture2D(uAtlas, vUv).a;
    // Far commands fade into the dark; ones about to hit the lens fade out too.
    float fog = smoothstep(78.0, 26.0, vDepth) * smoothstep(0.6, 3.5, vDepth);
    float a = glyph * vAlpha * fog;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint * a, a);
  }
`;

export function createGateField(
  canvas: HTMLCanvasElement,
  options: { reduced: boolean; light: boolean; fontFamily: string },
) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const pixelRatio = Math.min(window.devicePixelRatio, options.light ? 1.25 : 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  // On the scene, not as the clear colour: through the bloom chain a clear colour skips colour
  // management and comes out sRGB-encoded twice (a washed-out grey instead of near-black).
  scene.background = new THREE.Color(0x0b0f12);
  scene.fog = new THREE.Fog(0x0b0f12, 30, 85);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
  const BASE_Z = 13;
  camera.position.set(0, 0.6, BASE_Z);

  // Everything sits in a rig, shifted right on wide screens to clear the headline.
  const rig = new THREE.Group();
  scene.add(rig);

  // ---------- The gate: a frame of light with a scanning membrane ----------
  const GATE_W = 7.2;
  const GATE_H = 4.6;
  const gate = new THREE.Group();
  rig.add(gate);

  const barMaterial = new THREE.MeshBasicMaterial({
    color: AMBER.clone().multiplyScalar(2.2),
    toneMapped: false,
  });
  const bar = (w: number, h: number, x: number, y: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), barMaterial);
    mesh.position.set(x, y, 0);
    gate.add(mesh);
    return mesh;
  };
  const T = 0.05;
  bar(GATE_W, T, 0, GATE_H / 2);
  bar(GATE_W, T, 0, -GATE_H / 2);
  bar(T, GATE_H, -GATE_W / 2, 0);
  bar(T, GATE_H, GATE_W / 2, 0);
  // Corner brackets, brighter: the "viewfinder" of the gate.
  const corner = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffd27a).multiplyScalar(3),
    toneMapped: false,
  });
  for (const [sx, sy] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.09), corner);
    h.position.set(sx * (GATE_W / 2 - 0.35 + 0.05), sy * (GATE_H / 2 + 0.02), 0.01);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.7), corner);
    v.position.set(sx * (GATE_W / 2 + 0.02), sy * (GATE_H / 2 - 0.35 + 0.05), 0.01);
    gate.add(h, v);
  }

  const membraneUniforms = {
    uTime: { value: 0 },
    uHold: { value: 0 },
    uDeny: { value: 0 },
    uApprove: { value: 0 },
    uOpen: { value: 1 },
  };
  const membrane = new THREE.Mesh(
    new THREE.PlaneGeometry(GATE_W, GATE_H, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: membraneUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uHold, uDeny, uApprove, uOpen;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv;
          // Fine scan grid.
          vec2 g = abs(fract(p * vec2(48.0, 30.0)) - 0.5);
          float grid = smoothstep(0.47, 0.5, max(g.x, g.y)) * 0.018;
          // The scanning sweep, faster while something is held.
          float sweep = fract(uTime * (0.18 + uHold * 0.5));
          float line = exp(-pow((p.y - sweep) * 60.0, 2.0)) * (0.12 + uHold * 0.55);
          // Edges glow; the middle stays clear so commands read through it.
          float edge = pow(max(abs(p.x - 0.5), abs(p.y - 0.5)) * 2.0, 14.0) * 0.12;
          vec3 amber = vec3(1.0, 0.66, 0.05);
          vec3 col = amber * (grid + line + edge);
          col += vec3(1.0, 0.18, 0.3) * uDeny * (0.08 + edge * 3.0);
          col += vec3(0.15, 1.0, 0.6) * uApprove * (0.06 + edge * 3.0);
          gl_FragColor = vec4(col * uOpen, 1.0);
        }
      `,
    }),
  );
  gate.add(membrane);

  // ---------- The floor: a perspective grid scrolling toward the viewer ----------
  const floorUniforms = { uTime: { value: 0 } };
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: floorUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vWorld;
        void main() {
          vec2 p = vWorld + vec2(0.0, uTime * 4.0);
          vec2 g = abs(fract(p / 2.0) - 0.5);
          float line = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
          float dist = length(vWorld - vec2(0.0, 0.0));
          float fade = smoothstep(70.0, 8.0, dist);
          // A warm pool of light under the gate.
          float pool = exp(-pow(length(vWorld - vec2(0.0, -0.5)) / 6.0, 2.0));
          vec3 col = mix(vec3(0.16, 0.36, 0.48), vec3(1.0, 0.6, 0.1), pool * 0.8);
          float a = line * fade * (0.22 + pool * 0.6);
          gl_FragColor = vec4(col * a, a);
        }
      `,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -GATE_H / 2 - 0.2;
  rig.add(floor);

  // ---------- The commands ----------
  const { texture, widths } = buildAtlas(options.fontFamily);
  const COUNT = options.light ? 70 : 160;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const aRow = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  const aWidth = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  const aTint = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  for (const attr of [aTint, aAlpha]) attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aRow", aRow);
  geometry.setAttribute("aWidth", aWidth);
  geometry.setAttribute("aTint", aTint);
  geometry.setAttribute("aAlpha", aAlpha);
  const flyerMaterial = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: texture }, uRows: { value: COMMANDS.length } },
    vertexShader: flyerVertex,
    fragmentShader: flyerFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const flyers = new THREE.InstancedMesh(geometry, flyerMaterial, COUNT);
  flyers.frustumCulled = false;
  rig.add(flyers);

  const LINE_H = 0.34;
  const riskyRows = COMMANDS.map((c, i) => (c.risky ? i : -1)).filter((i) => i >= 0);
  const safeRows = COMMANDS.map((c, i) => (c.risky ? -1 : i)).filter((i) => i >= 0);
  const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
  let held: Flyer | null = null;

  const spawn = (f: Partial<Flyer> = {}, anywhere = false): Flyer => {
    // About one in six is risky; only one waits at the gate at a time.
    const risky = Math.random() < 0.12;
    const row = risky ? pick(riskyRows) : pick(safeRows);
    // Risky ones head for the gate's opening; the rest stream past all around it.
    let x: number;
    let y: number;
    if (risky) {
      x = (Math.random() - 0.5) * (GATE_W - 3);
      y = (Math.random() - 0.5) * (GATE_H - 1.4);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4.6 + Math.random() * 9;
      x = Math.cos(angle) * radius * 1.4;
      y = Math.sin(angle) * radius * 0.6 + 0.8;
    }
    const next: Flyer = {
      row,
      x,
      y,
      z: anywhere ? -80 + Math.random() * 90 : -80 - Math.random() * 20,
      speed: (risky ? 9 : 11) + Math.random() * 7,
      risky,
      state: "fly",
      heldMs: 0,
      holdFor: 1600 + Math.random() * 1400,
      denyChance: 0.3,
      fade: 1,
    };
    // Anything spawned already past the gate on load counts as approved.
    if (anywhere && risky && next.z > -0.5) next.state = "approved";
    return Object.assign(f, next) as Flyer;
  };
  const list: Flyer[] = Array.from({ length: COUNT }, () => spawn({}, true));
  list.forEach((f, i) => {
    aRow.setX(i, f.row);
    aWidth.setX(i, widths[f.row]! / ATLAS_W);
  });

  // ---------- Particles: a denied command breaking apart ----------
  const SPARKS = 500;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("aLife", new THREE.BufferAttribute(sparkLife, 1));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.ShaderMaterial({
      uniforms: { uPixel: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `
        attribute float aLife;
        uniform float uPixel;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (2.0 + aLife * 5.0) * uPixel * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vLife;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(1.0, 0.25, 0.35) * a * 2.0, a);
        }
      `,
    }),
  );
  sparks.frustumCulled = false;
  rig.add(sparks);
  let sparkCursor = 0;
  const burst = (x: number, y: number, z: number, width: number) => {
    for (let n = 0; n < 70; n++) {
      const i = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARKS;
      sparkPos[i * 3] = x + (Math.random() - 0.5) * width;
      sparkPos[i * 3 + 1] = y + (Math.random() - 0.5) * LINE_H;
      sparkPos[i * 3 + 2] = z;
      sparkVel[i * 3] = (Math.random() - 0.5) * 4;
      sparkVel[i * 3 + 1] = (Math.random() - 0.2) * 3;
      sparkVel[i * 3 + 2] = -Math.random() * 3;
      sparkLife[i] = 1;
    }
  };

  // ---------- Post-processing: bloom makes the gate and the held command glow ----------
  const composer = options.light ? null : new EffectComposer(renderer);
  let bloom: UnrealBloomPass | null = null;
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    // Only what's brighter than white blooms: the frame, the held command, sparks.
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.45, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---------- Layout, input, scroll ----------
  const pointer = new THREE.Vector2();
  const lean = new THREE.Vector2();
  let scroll = 0;
  const resize = () => {
    const parent = canvas.parentElement!;
    const width = parent.clientWidth;
    const height = Math.max(1, parent.clientHeight);
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    bloom?.resolution.set(width / 2, height / 2);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Wide screens: gate to the right of the headline. Narrow: centred, a little smaller.
    const wide = camera.aspect > 1.15;
    rig.position.x = wide ? 3.6 : 0;
    rig.position.y = wide ? 0 : -4.2;
    rig.scale.setScalar(wide ? 1 : 0.56);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);

  const matrix = new THREE.Matrix4();
  const tmpColor = new THREE.Color();
  const pulses = { hold: 0, deny: 0, approve: 0 };

  const step = (dt: number, t: number) => {
    const s = dt / 1000;
    const gateZ = 0;
    let holding = false;
    for (let i = 0; i < COUNT; i++) {
      const f = list[i]!;
      if (f.state === "held") {
        holding = true;
        f.heldMs += dt;
        if (f.heldMs > f.holdFor) {
          if (Math.random() < f.denyChance) {
            f.state = "denied";
            pulses.deny = 1;
            burst(f.x, f.y, f.z, (widths[f.row]! / ROW_PX) * LINE_H);
          } else {
            f.state = "approved";
            pulses.approve = 1;
          }
          held = null;
        }
      } else if (f.state === "denied") {
        f.fade -= s * 3.5;
        if (f.fade <= 0) spawn(f);
      } else {
        const before = f.z;
        f.z += f.speed * s * (f.state === "approved" ? 1.5 : 1);
        if (f.risky && f.state === "fly" && before < gateZ - 0.4 && f.z >= gateZ - 0.4) {
          if (held === null) {
            f.z = gateZ - 0.4;
            f.state = "held";
            f.heldMs = 0;
            held = f;
          } else {
            // The gate is busy with another: this one goes back to the end of the line.
            spawn(f);
          }
        }
        if (f.z > BASE_Z + 2) spawn(f);
      }

      const w = (widths[f.row]! / ROW_PX) * LINE_H;
      const bump = f.state === "held" ? 1.18 + Math.sin(t * 0.01) * 0.03 : 1;
      matrix.makeScale(w * bump, LINE_H * bump, 1);
      matrix.setPosition(f.x, f.y, f.z);
      flyers.setMatrixAt(i, matrix);

      const color = !f.risky ? SAFE : f.state === "approved" ? APPROVED : RISKY;
      const boost = f.state === "held" ? 2.8 : f.risky ? 0.95 : 0.5;
      tmpColor.copy(color).multiplyScalar(boost);
      aTint.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      aAlpha.setX(i, f.state === "denied" ? Math.max(0, f.fade) : 1);
      aRow.setX(i, f.row);
      aWidth.setX(i, widths[f.row]! / ATLAS_W);
    }
    flyers.instanceMatrix.needsUpdate = true;
    aTint.needsUpdate = true;
    aAlpha.needsUpdate = true;
    aRow.needsUpdate = true;
    aWidth.needsUpdate = true;

    // Sparks drift and die.
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i]! <= 0) continue;
      sparkLife[i] = Math.max(0, sparkLife[i]! - s * 1.1);
      sparkVel[i * 3 + 1]! -= s * 2.2;
      sparkPos[i * 3]! += sparkVel[i * 3]! * s;
      sparkPos[i * 3 + 1]! += sparkVel[i * 3 + 1]! * s;
      sparkPos[i * 3 + 2]! += sparkVel[i * 3 + 2]! * s;
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    sparkGeo.attributes.aLife!.needsUpdate = true;

    pulses.hold += ((holding ? 1 : 0) - pulses.hold) * Math.min(1, s * 4);
    pulses.deny = Math.max(0, pulses.deny - s * 1.6);
    pulses.approve = Math.max(0, pulses.approve - s * 1.6);
    membraneUniforms.uTime.value = t / 1000;
    membraneUniforms.uHold.value = pulses.hold;
    membraneUniforms.uDeny.value = pulses.deny;
    membraneUniforms.uApprove.value = pulses.approve;
    floorUniforms.uTime.value = t / 1000;
    barMaterial.color
      .copy(AMBER)
      .lerp(RISKY, pulses.deny * 0.8)
      .lerp(APPROVED, pulses.approve * 0.7)
      .multiplyScalar(2.2 + pulses.hold * 1.2);

    // Camera: leans with the pointer; scrolling flies it through the gate.
    lean.lerp(pointer, 0.05);
    const fly = scroll * scroll;
    camera.position.x = lean.x * 1.1 + rig.position.x * fly;
    camera.position.y = 0.6 + lean.y * 0.6 - rig.position.y * -fly;
    camera.position.z = BASE_Z - fly * (BASE_Z + 3);
    camera.lookAt(rig.position.x * (0.35 + fly * 0.65), rig.position.y * 0.6, -20);
    membraneUniforms.uOpen.value = 1 - fly * 0.6;

    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  let frame = 0;
  let running = false;
  let elapsed = 0;
  let last = 0;
  const loop = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    elapsed += dt;
    step(dt, elapsed);
    frame = requestAnimationFrame(loop);
  };

  return {
    play() {
      if (options.reduced) {
        // One still frame, with a command waiting at the gate.
        for (let i = 0; i < 220; i++) step(30, i * 30);
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
      pointer.set(x, y);
    },
    // 0 at the top of the page, 1 once the hero has scrolled away.
    scrollTo(progress: number) {
      scroll = Math.max(0, Math.min(1, progress));
      if (options.reduced) step(0, elapsed);
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      texture.dispose();
      geometry.dispose();
      flyerMaterial.dispose();
      sparkGeo.dispose();
      (sparks.material as THREE.Material).dispose();
      membrane.geometry.dispose();
      (membrane.material as THREE.Material).dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      barMaterial.dispose();
      corner.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
}

export type GateField = ReturnType<typeof createGateField>;
