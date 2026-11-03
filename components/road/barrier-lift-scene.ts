import * as THREE from "three";

// A single toll barrier, close up: the arm lifts and the light turns green, then rendering
// stops. Used for "all clear". replay() runs it again (on hover).

export function createBarrierLift(canvas: HTMLCanvasElement, options: { reduced: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(2.2, 2.3, 6.6);
  camera.lookAt(0.1, 1.15, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2b2f33, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.8);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };
  const material = (params: THREE.MeshStandardMaterialParameters) =>
    keep(new THREE.MeshStandardMaterial({ roughness: 0.8, ...params }));

  const road = new THREE.Mesh(
    keep(new THREE.CircleGeometry(1.9, 48)),
    material({ color: 0x363b40 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.x = 0.1;
  scene.add(road);
  const dash = material({ color: 0xf4f5f2 });
  for (const z of [-1.1, 0, 1.1]) {
    const line = new THREE.Mesh(keep(new THREE.BoxGeometry(0.08, 0.01, 0.6)), dash);
    line.position.set(-0.4, 0.01, z);
    scene.add(line);
  }

  const post = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.16, 0.2, 1.2, 24)),
    material({ color: 0xd6d9d4 }),
  );
  post.position.set(0.9, 0.6, 0);
  scene.add(post);
  const lightMaterial = material({ color: 0xc8102e, emissive: 0xc8102e, emissiveIntensity: 2 });
  const light = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 20, 20)), lightMaterial);
  light.position.set(0.9, 1.3, 0);
  scene.add(light);

  const canvas2d = document.createElement("canvas");
  canvas2d.width = 256;
  canvas2d.height = 32;
  const ctx = canvas2d.getContext("2d")!;
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
  const stripes = keep(new THREE.CanvasTexture(canvas2d));
  stripes.colorSpace = THREE.SRGBColorSpace;
  const pivot = new THREE.Group();
  pivot.position.set(0.9, 1.02, 0);
  const arm = new THREE.Mesh(
    keep(new THREE.BoxGeometry(2.1, 0.14, 0.1)),
    material({ map: stripes, roughness: 0.5 }),
  );
  arm.position.x = -1.05;
  pivot.add(arm);
  scene.add(pivot);

  const resize = () => {
    const parent = canvas.parentElement!;
    renderer.setSize(parent.clientWidth, parent.clientHeight, false);
    camera.aspect = parent.clientWidth / Math.max(1, parent.clientHeight);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  resize();

  const LIFT_MS = 900;
  let frame = 0;
  const pose = (t: number) => {
    const x = Math.min(1, t / LIFT_MS);
    const eased = 1 - Math.pow(1 - x, 3);
    // Arm reaches out along -x, so lifting is a negative turn about z.
    pivot.rotation.z = -1.0 * eased;
    const color = x > 0.35 ? 0x2eb67d : 0xc8102e;
    lightMaterial.color.setHex(color);
    lightMaterial.emissive.setHex(color);
    renderer.render(scene, camera);
  };

  const play = () => {
    cancelAnimationFrame(frame);
    if (options.reduced) {
      pose(LIFT_MS);
      return;
    }
    pose(0);
    // Hold the barrier down for a beat, lift it, then stop rendering.
    const start = performance.now() + 350;
    const run = (now: number) => {
      const t = Math.max(0, now - start);
      pose(t);
      if (t < LIFT_MS) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);

  return {
    play,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const item of disposables) item.dispose();
      renderer.dispose();
    },
  };
}
