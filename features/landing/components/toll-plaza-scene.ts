import * as THREE from "three";

// The landing page's toll plaza in plain Three.js: an agent's command drives up, the barrier
// drops and the light turns red while the team decides, then it's approved, the arm lifts and
// the command drives through. Loaded only in the browser (dynamic import), paused off screen.

export type PlazaPhase = "approach" | "blocked" | "approved" | "pass";

const TIMELINE: { phase: PlazaPhase; ms: number }[] = [
  { phase: "approach", ms: 1900 },
  { phase: "blocked", ms: 2800 },
  { phase: "approved", ms: 1000 },
  { phase: "pass", ms: 2000 },
];
const LOOP_MS = TIMELINE.reduce((total, step) => total + step.ms, 0);

const ASPHALT = 0x2b2f33;
const ROAD = 0x363b40;
const LANE_WHITE = 0xf4f5f2;
const HIGHWAY_GREEN = 0x00704a;
const SIGNAL = 0xf2a900;
const BARRIER_RED = 0xc8102e;
const GO_GREEN = 0x2eb67d;

const START_Z = -34;
const STOP_Z = -1.9;
const END_Z = 16;

function phaseAt(t: number): { phase: PlazaPhase; progress: number } {
  let elapsed = t % LOOP_MS;
  for (const step of TIMELINE) {
    if (elapsed < step.ms) return { phase: step.phase, progress: elapsed / step.ms };
    elapsed -= step.ms;
  }
  return { phase: "approach", progress: 0 };
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn = (x: number) => x * x * x;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function textTexture(
  lines: string[],
  options: { width: number; height: number; bg: string; fg: string; font: string; border?: string },
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = options.bg;
  ctx.fillRect(0, 0, options.width, options.height);
  if (options.border) {
    ctx.strokeStyle = options.border;
    ctx.lineWidth = options.height * 0.06;
    const inset = options.height * 0.09;
    ctx.beginPath();
    ctx.roundRect(inset, inset, options.width - inset * 2, options.height - inset * 2, inset);
    ctx.stroke();
  }
  ctx.fillStyle = options.fg;
  ctx.font = options.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = options.height / (lines.length + 1);
  lines.forEach((line, i) => ctx.fillText(line, options.width / 2, step * (i + 1)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function stripes(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 32);
  ctx.fillStyle = "#c8102e";
  for (let x = -32; x < 288; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x + 20, 0);
    ctx.lineTo(x + 40, 0);
    ctx.lineTo(x + 20, 32);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTollPlaza(
  canvas: HTMLCanvasElement,
  options: { reduced: boolean; onPhase?: (phase: PlazaPhase) => void },
) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(ASPHALT, 14, 42);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const cameraBase = new THREE.Vector3(3.4, 3.3, 8.6);
  const lookAt = new THREE.Vector3(-1.2, 0.7, -3.2);

  scene.add(new THREE.HemisphereLight(0xffffff, ASPHALT, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(6, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  scene.add(sun);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };
  const material = (params: THREE.MeshStandardMaterialParameters) =>
    keep(new THREE.MeshStandardMaterial({ roughness: 0.85, ...params }));
  const box = (w: number, h: number, d: number) => keep(new THREE.BoxGeometry(w, h, d));

  // The road, its edges and the dashed centre line.
  const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(9, 80)), material({ color: ROAD }));
  road.rotation.x = -Math.PI / 2;
  road.position.z = -12;
  road.receiveShadow = true;
  scene.add(road);
  const ground = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(80, 80)),
    material({ color: ASPHALT }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, -12);
  scene.add(ground);
  const laneMaterial = material({ color: LANE_WHITE, roughness: 0.6 });
  for (const x of [-4.2, 4.2]) {
    const edge = new THREE.Mesh(box(0.12, 0.02, 80), laneMaterial);
    edge.position.set(x, 0.01, -12);
    scene.add(edge);
  }
  const dashGeometry = box(0.14, 0.02, 1.4);
  for (let z = 10; z > -50; z -= 3.2) {
    const dash = new THREE.Mesh(dashGeometry, laneMaterial);
    dash.position.set(0, 0.01, z);
    scene.add(dash);
  }

  // The gantry with a highway sign: the product's promise, over the road.
  const pole = box(0.18, 4.6, 0.18);
  const steel = material({ color: 0x9aa1a7, metalness: 0.4, roughness: 0.5 });
  for (const x of [-4.5, 4.5]) {
    const post = new THREE.Mesh(pole, steel);
    post.position.set(x, 2.3, -9);
    post.castShadow = true;
    scene.add(post);
  }
  const beam = new THREE.Mesh(box(9.2, 0.18, 0.18), steel);
  beam.position.set(0, 4.3, -9);
  scene.add(beam);
  const signTexture = keep(
    textTexture(["YOUR TEAM DECIDES", "before your agent acts"], {
      width: 1024,
      height: 320,
      bg: "#00704a",
      fg: "#ffffff",
      font: "700 92px Overpass, system-ui, sans-serif",
      border: "#ffffff",
    }),
  );
  const sign = new THREE.Mesh(box(5.2, 1.62, 0.12), [
    material({ color: HIGHWAY_GREEN }),
    material({ color: HIGHWAY_GREEN }),
    material({ color: HIGHWAY_GREEN }),
    material({ color: HIGHWAY_GREEN }),
    material({ map: signTexture, roughness: 0.7 }),
    material({ color: HIGHWAY_GREEN }),
  ]);
  sign.position.set(-0.6, 3.5, -8.9);
  sign.castShadow = true;
  scene.add(sign);

  // The toll booth beside the lane.
  const booth = new THREE.Group();
  const body = new THREE.Mesh(box(1.4, 2.2, 1.8), material({ color: 0xd6d9d4 }));
  body.position.y = 1.1;
  body.castShadow = true;
  const glass = new THREE.Mesh(
    box(1.42, 0.8, 1.2),
    material({ color: 0x1d2a30, roughness: 0.2, metalness: 0.3 }),
  );
  glass.position.y = 1.5;
  const roof = new THREE.Mesh(box(2.2, 0.2, 2.6), material({ color: 0x9aa1a7, roughness: 0.6 }));
  roof.position.y = 2.32;
  roof.castShadow = true;
  booth.add(body, glass, roof);
  booth.position.set(3.2, 0, 1.2);
  scene.add(booth);

  // The barrier: a post with a signal light and a striped arm pivoting at the post.
  const post = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 20)),
    material({ color: 0xd6d9d4 }),
  );
  post.position.set(2.1, 0.65, 0.6);
  post.castShadow = true;
  scene.add(post);
  const lightMaterial = material({
    color: BARRIER_RED,
    emissive: BARRIER_RED,
    emissiveIntensity: 2,
  });
  const light = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 20, 20)), lightMaterial);
  light.position.set(2.1, 1.42, 0.6);
  scene.add(light);
  const glow = new THREE.PointLight(BARRIER_RED, 3, 4);
  glow.position.copy(light.position);
  scene.add(glow);
  const pivot = new THREE.Group();
  pivot.position.set(2.1, 1.12, 0.6);
  const armTexture = keep(stripes());
  armTexture.wrapS = THREE.RepeatWrapping;
  armTexture.repeat.set(3, 1);
  const arm = new THREE.Mesh(box(4.2, 0.16, 0.12), material({ map: armTexture, roughness: 0.5 }));
  arm.position.x = -2.1;
  arm.castShadow = true;
  pivot.add(arm);
  scene.add(pivot);

  // The agent's command, as a capsule with its text on top, and a tag that floats above it.
  const capsule = new THREE.Group();
  const shell = new THREE.Mesh(box(1.7, 0.7, 2.6), material({ color: SIGNAL, roughness: 0.45 }));
  shell.position.y = 0.45;
  shell.castShadow = true;
  const commandTexture = keep(
    textTexture(["npx prisma", "migrate deploy"], {
      width: 512,
      height: 768,
      bg: "#f2a900",
      fg: "#2b2100",
      font: "600 88px 'Overpass Mono', ui-monospace, monospace",
    }),
  );
  const top = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(1.55, 2.4)),
    material({
      map: commandTexture,
      emissive: 0xffffff,
      emissiveMap: commandTexture,
      emissiveIntensity: 0.25,
    }),
  );
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = Math.PI;
  top.position.y = 0.81;
  const stripe = new THREE.Mesh(
    box(1.72, 0.08, 2.62),
    material({ color: 0x2b2100, roughness: 0.5 }),
  );
  stripe.position.y = 0.22;
  capsule.add(shell, top, stripe);
  scene.add(capsule);

  const tagCanvasTextures: Record<"wait" | "ok", THREE.CanvasTexture> = {
    wait: keep(
      textTexture(["TG-17  waiting on your team"], {
        width: 640,
        height: 120,
        bg: "#f2a900",
        fg: "#2b2100",
        font: "700 46px Overpass, system-ui, sans-serif",
      }),
    ),
    ok: keep(
      textTexture(["Ana approved TG-17"], {
        width: 640,
        height: 120,
        bg: "#2eb67d",
        fg: "#0e2a1d",
        font: "700 46px Overpass, system-ui, sans-serif",
      }),
    ),
  };
  const tagMaterial = keep(
    new THREE.SpriteMaterial({ map: tagCanvasTextures.wait, depthTest: false }),
  );
  const tag = new THREE.Sprite(tagMaterial);
  tag.scale.set(2.9, 0.54, 1);
  scene.add(tag);

  // Pointer parallax: the camera leans a little towards where you point.
  const pointer = new THREE.Vector2();
  const lean = new THREE.Vector2();

  let width = 0;
  let height = 0;
  const resize = () => {
    const parent = canvas.parentElement!;
    width = parent.clientWidth;
    height = parent.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    // Narrow screens see the plaza from further back so the whole story fits.
    camera.position.copy(cameraBase).multiplyScalar(camera.aspect < 1 ? 1.35 : 1);
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);

  let lastPhase: PlazaPhase | null = null;
  const pose = (t: number) => {
    const { phase, progress } = phaseAt(t);
    if (phase !== lastPhase) {
      lastPhase = phase;
      options.onPhase?.(phase);
    }

    let z = START_Z;
    let armAngle = 0;
    let green = false;
    if (phase === "approach") {
      z = START_Z + (STOP_Z - START_Z) * easeOut(progress);
      armAngle = Math.max(0, 1.25 * (1 - progress * 2.5));
    } else if (phase === "blocked") {
      z = STOP_Z;
    } else if (phase === "approved") {
      z = STOP_Z;
      armAngle = 1.25 * easeInOut(Math.min(1, progress * 1.4));
      green = true;
    } else {
      z = STOP_Z + (END_Z - STOP_Z) * easeIn(progress);
      armAngle = 1.25;
      green = true;
    }

    capsule.position.set(-1.9, 0, z);
    // The arm reaches out along -x from the pivot, so lifting it is a negative turn about z.
    pivot.rotation.z = -armAngle;
    const signal = green ? GO_GREEN : BARRIER_RED;
    lightMaterial.color.setHex(signal);
    lightMaterial.emissive.setHex(signal);
    glow.color.setHex(signal);
    // A slow pulse on the red light while the team decides.
    lightMaterial.emissiveIntensity = phase === "blocked" ? 1.6 + Math.sin(t / 180) * 0.8 : 2;

    const showTag = phase === "blocked" || phase === "approved";
    tag.visible = showTag;
    tagMaterial.map = green ? tagCanvasTextures.ok : tagCanvasTextures.wait;
    tag.position.set(-1.9, 2.1 + Math.sin(t / 400) * 0.06, z);

    lean.lerp(pointer, 0.05);
    camera.position.x +=
      (cameraBase.x * (camera.aspect < 1 ? 1.35 : 1) + lean.x * 0.9 - camera.position.x) * 0.1;
    camera.position.y +=
      (cameraBase.y * (camera.aspect < 1 ? 1.35 : 1) + lean.y * 0.5 - camera.position.y) * 0.1;
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  };

  let frame = 0;
  let running = false;
  // Where the loop is, so pausing off screen and coming back carries on from the same moment.
  let elapsed = 0;
  let last = 0;
  // Reduced motion: one still frame of the moment that matters (barrier down, waiting).
  const STILL = TIMELINE[0]!.ms + 600;
  const loop = (now: number) => {
    elapsed += Math.min(250, now - last);
    last = now;
    pose(elapsed);
    frame = requestAnimationFrame(loop);
  };

  return {
    play() {
      if (options.reduced) {
        pose(STILL);
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
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const item of disposables) item.dispose();
      renderer.dispose();
    },
  };
}

export type TollPlaza = ReturnType<typeof createTollPlaza>;
