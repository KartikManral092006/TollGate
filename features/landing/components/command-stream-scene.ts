import * as THREE from "three";

// The landing hero's background: agent commands as particles streaming left to right through
// a gate. Routine commands pass straight through; risky ones (red) stop at the gate, wait,
// turn green when "approved" and go on. Plain Three.js, loaded only in the browser.

const SAFE = new THREE.Color(0xa9c7e0);
const RISKY = new THREE.Color(0xff5a6e);
const APPROVED = new THREE.Color(0x2eb67d);

type Particle = {
  lane: number;
  x: number;
  speed: number;
  risky: boolean;
  state: "moving" | "waiting" | "approved";
  waitedMs: number;
  waitFor: number;
  size: number;
};

const vertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 tint;
  attribute float glow;
  varying vec3 vTint;
  varying float vGlow;
  uniform float pixelRatio;
  void main() {
    vTint = tint;
    vGlow = glow;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelRatio * (34.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vGlow;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float halo = smoothstep(0.5, 0.15, d) * vGlow;
    gl_FragColor = vec4(vTint * (core + halo), core * 0.9 + halo * 0.5);
    if (gl_FragColor.a < 0.02) discard;
  }
`;

export function createCommandStream(
  canvas: HTMLCanvasElement,
  options: { reduced: boolean; density?: number },
) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  const LANES = 13;
  const COUNT = Math.round(700 * (options.density ?? 1));
  let halfWidth = 12;
  let gateX = 2.5;

  const laneY = (lane: number) => (lane - (LANES - 1) / 2) * 0.62;
  const laneZ = (lane: number) => Math.sin(lane * 1.7) * 1.6;
  // Lanes undulate gently, so the stream reads as flowing rather than ruled lines.
  const waveY = (lane: number, x: number, t: number) =>
    laneY(lane) + Math.sin(x * 0.35 + lane * 0.9 + t * 0.0004) * 0.18;

  const particles: Particle[] = [];
  const spawn = (p?: Particle, anywhere = false): Particle => {
    const risky = Math.random() < 0.06;
    const next: Particle = {
      lane: Math.floor(Math.random() * LANES),
      x: anywhere ? -halfWidth + Math.random() * halfWidth * 2 : -halfWidth - Math.random() * 4,
      speed: (risky ? 0.0028 : 0.0034) + Math.random() * 0.0022,
      risky,
      state: "moving",
      waitedMs: 0,
      waitFor: 1600 + Math.random() * 3200,
      size: risky ? 2.2 + Math.random() * 0.6 : 0.7 + Math.random() * 0.9,
    };
    // Risky commands already past the gate when the page loads count as approved.
    if (anywhere && risky && next.x > gateX) next.state = "approved";
    if (p) Object.assign(p, next);
    return next;
  };
  for (let i = 0; i < COUNT; i++) particles.push(spawn(undefined, true));

  // Each command draws a short light trail behind it: TRAIL points, fading and shrinking.
  const TRAIL = 6;
  const POINTS = COUNT * TRAIL;
  const positions = new Float32Array(POINTS * 3);
  const tints = new Float32Array(POINTS * 3);
  const sizes = new Float32Array(POINTS);
  const glows = new Float32Array(POINTS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("glow", new THREE.BufferAttribute(glows, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { pixelRatio: { value: pixelRatio } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // The gate: a thin vertical beam of light the risky commands stop at.
  const gateMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float time;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float beam = pow(1.0 - x, 6.0);
        float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float pulse = 0.75 + 0.25 * sin(time * 0.002 + vUv.y * 9.0);
        vec3 color = mix(vec3(0.95, 0.66, 0.0), vec3(1.0, 0.85, 0.4), beam);
        gl_FragColor = vec4(color * beam * fade * pulse, beam * fade * 0.85);
      }
    `,
  });
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 10.5), gateMaterial);
  scene.add(gate);

  const pointer = new THREE.Vector2();
  const lean = new THREE.Vector2();

  const resize = () => {
    const parent = canvas.parentElement!;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfWidth = (visibleHeight * camera.aspect) / 2 + 1.5;
    // The gate sits right of centre on wide screens (behind the visual, clear of the text).
    gateX = camera.aspect > 1.2 ? halfWidth * 0.32 : halfWidth * 0.55;
    gate.position.x = gateX;
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);

  const step = (dt: number, t: number) => {
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i]!;
      if (p.state === "waiting") {
        p.waitedMs += dt;
        if (p.waitedMs > p.waitFor) p.state = "approved";
      } else {
        const before = p.x;
        p.x += p.speed * dt * (p.state === "approved" ? 1.6 : 1);
        // A risky command reaching the gate stops there until the team approves it.
        if (p.risky && p.state === "moving" && before < gateX - 0.25 && p.x >= gateX - 0.25) {
          p.x = gateX - 0.25 - Math.random() * 0.15;
          p.state = "waiting";
        }
      }
      if (p.x > halfWidth + 1) spawn(p);

      const color = !p.risky ? SAFE : p.state === "approved" ? APPROVED : RISKY;
      // Commands fade in and out at the edges; waiting ones breathe.
      const edge = Math.max(0, Math.min(1, (halfWidth - Math.abs(p.x)) / 3));
      const breathe = p.state === "waiting" ? 0.75 + 0.25 * Math.sin(t * 0.006 + i) : 1;
      // A stopped command's trail collapses into it.
      const spacing =
        p.state === "waiting" ? 0 : (p.risky ? 0.18 : 0.17) * (p.state === "approved" ? 1.6 : 1);
      for (let k = 0; k < TRAIL; k++) {
        const j = i * TRAIL + k;
        const x = p.x - k * spacing;
        const fade = Math.pow(1 - k / TRAIL, 1.6) * (k > 0 && spacing === 0 ? 0 : 1);
        positions[j * 3] = x;
        positions[j * 3 + 1] = waveY(p.lane, x, t);
        positions[j * 3 + 2] = laneZ(p.lane);
        const strength = edge * breathe * fade;
        tints[j * 3] = color.r * strength;
        tints[j * 3 + 1] = color.g * strength;
        tints[j * 3 + 2] = color.b * strength;
        sizes[j] = p.size * (p.state === "waiting" ? 1.25 : 1) * (1 - k * 0.11);
        glows[j] = k === 0 ? (p.risky ? 1 : 0.4) : 0;
      }
    }
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.tint!.needsUpdate = true;
    geometry.attributes.size!.needsUpdate = true;
    geometry.attributes.glow!.needsUpdate = true;
    gateMaterial.uniforms.time!.value = t;

    lean.lerp(pointer, 0.04);
    camera.position.x = lean.x * 0.8;
    camera.position.y = lean.y * 0.5;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };

  let frame = 0;
  let running = false;
  let elapsed = 0;
  let last = 0;
  const loop = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    elapsed += dt;
    step(dt, elapsed);
    frame = requestAnimationFrame(loop);
  };

  return {
    play() {
      if (options.reduced) {
        // One still frame, with some commands caught at the gate.
        for (let i = 0; i < 160; i++) step(32, i * 32);
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
      geometry.dispose();
      material.dispose();
      gate.geometry.dispose();
      gateMaterial.dispose();
      renderer.dispose();
    },
  };
}

export type CommandStream = ReturnType<typeof createCommandStream>;
