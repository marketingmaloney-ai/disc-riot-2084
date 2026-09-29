import * as THREE from 'three';
import { hasAsset } from './assets';
import * as C from '../sim/constants';

export interface ArenaDef {
  id: string;
  name: string;
  subtitle: string;
  sky: [string, string, string]; // top, mid, horizon
  sand: [string, string];
  neonA: string;
  neonB: string;
  night: boolean;
  scene: 'sunset' | 'city' | 'boardwalk' | 'space';
  bigZone: number; // half-width of the 5-point goal zone (gameplay variety per court)
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'sunset', name: 'SUNSET STRIP', subtitle: 'MIAMI 2084',
    sky: ['#1a0638', '#8a1f7a', '#ff8a3d'], sand: ['#f0b98a', '#d98a6a'],
    neonA: '#ff2e9a', neonB: '#19e6ff', night: false, scene: 'sunset', bigZone: 1.65,
  },
  {
    id: 'pier', name: 'NEON PIER', subtitle: 'NEO-TOKYO BAY',
    sky: ['#03020d', '#1b0a3a', '#5a1a6e'], sand: ['#3a2a52', '#221a36'],
    neonA: '#19e6ff', neonB: '#ff2e9a', night: true, scene: 'city', bigZone: 1.35,
  },
  {
    id: 'lagoon', name: 'LASER LAGOON', subtitle: 'VENICE BEACH 2084',
    sky: ['#2a7bff', '#ff8ad8', '#ffd28a'], sand: ['#f6d2a0', '#e0a878'],
    neonA: '#b6ff2e', neonB: '#ff2e9a', night: false, scene: 'boardwalk', bigZone: 2.05,
  },
  {
    id: 'orbital', name: 'ORBITAL CABANA', subtitle: 'LOW EARTH ORBIT',
    sky: ['#000000', '#07051a', '#1a0f4a'], sand: ['#cfd6ff', '#8a8fc0'],
    neonA: '#ffe600', neonB: '#19e6ff', night: true, scene: 'space', bigZone: 1.1,
  },
];

async function tryTexture(url: string): Promise<THREE.Texture | null> {
  try {
    if (!(await hasAsset(url))) return null;
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  } catch {
    return null;
  }
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Procedural court: top-down, u along x (length), v along z (width). */
function proceduralCourt(a: ArenaDef) {
  return canvasTex(2048, 1152, (g) => {
    const W = 2048, H = 1152;
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, a.sand[1]);
    grd.addColorStop(0.5, a.sand[0]);
    grd.addColorStop(1, a.sand[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // grain
    const img = g.getImageData(0, 0, W, H);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * (a.night ? 10 : 22);
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    if (a.night) {
      // wet planks
      g.globalAlpha = 0.35;
      for (let y = 0; y < H; y += 64) {
        g.fillStyle = y % 128 ? '#2b2044' : '#1d1530';
        g.fillRect(0, y, W, 60);
      }
      g.globalAlpha = 1;
    }
    // big center emblem
    g.save();
    g.translate(W / 2, H / 2);
    g.globalAlpha = 0.22;
    const sun = g.createLinearGradient(0, -260, 0, 260);
    sun.addColorStop(0, '#ffe600');
    sun.addColorStop(1, a.neonA);
    g.fillStyle = sun;
    g.beginPath();
    g.arc(0, 0, 250, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) g.fillRect(-260, 20 + i * 30, 520, 6 + i * 2);
    g.restore();
    g.globalAlpha = 1;
    // lines
    const line = (x1: number, y1: number, x2: number, y2: number, col: string, w: number) => {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.shadowColor = col;
      g.shadowBlur = 28;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.shadowBlur = 0;
    };
    const m = 18;
    g.strokeStyle = a.neonB;
    line(m, m, W - m, m, a.neonB, 10);
    line(m, H - m, W - m, H - m, a.neonB, 10);
    line(m, m, m, H - m, a.neonA, 10);
    line(W - m, m, W - m, H - m, a.neonA, 10);
    line(W / 2, m, W / 2, H - m, '#ffffff', 12);
    // dashed "no-go" zone near net
    g.setLineDash([30, 24]);
    line(W / 2 - (C.PLAYER_MIN_X / (2 * C.COURT_HALF_LEN)) * W, m, W / 2 - (C.PLAYER_MIN_X / (2 * C.COURT_HALF_LEN)) * W, H - m, a.neonB, 5);
    line(W / 2 + (C.PLAYER_MIN_X / (2 * C.COURT_HALF_LEN)) * W, m, W / 2 + (C.PLAYER_MIN_X / (2 * C.COURT_HALF_LEN)) * W, H - m, a.neonB, 5);
    g.setLineDash([]);
    // quarter arcs
    g.globalAlpha = 0.7;
    for (const sx of [0, W]) {
      g.strokeStyle = a.neonA;
      g.lineWidth = 7;
      g.beginPath();
      g.arc(sx, H / 2, H * 0.32, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

function drawSpace(g: CanvasRenderingContext2D, W: number, H: number) {
  // Earth limb below, glowing atmosphere, orbital ring structure.
  const cx = W / 2, cy = H * 1.55, r = H * 1.05;
  const atm = g.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.08);
  atm.addColorStop(0, 'rgba(80,200,255,0.9)');
  atm.addColorStop(1, 'rgba(80,120,255,0)');
  g.fillStyle = atm;
  g.beginPath(); g.arc(cx, cy, r * 1.08, 0, Math.PI * 2); g.fill();
  const earth = g.createLinearGradient(0, cy - r, 0, H);
  earth.addColorStop(0, '#2a7bff');
  earth.addColorStop(0.3, '#0b3a8a');
  earth.addColorStop(1, '#03122e');
  g.fillStyle = earth;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.5;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    const a = Math.PI * 1.2 + (i / 40) * Math.PI * 0.6;
    g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, 40 + (i % 5) * 20, 8, a + Math.PI / 2, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // ring station arcs
  g.strokeStyle = '#ffe600'; g.lineWidth = 6; g.shadowColor = '#ffe600'; g.shadowBlur = 24;
  g.beginPath(); g.ellipse(cx, H * 0.35, W * 0.55, 60, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.strokeStyle = '#19e6ff'; g.shadowColor = '#19e6ff';
  g.beginPath(); g.ellipse(cx, H * 0.38, W * 0.62, 80, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.shadowBlur = 0;
}

function proceduralSky(a: ArenaDef) {
  return canvasTex(2048, 1024, (g) => {
    const W = 2048, H = 1024;
    const hz = H * 0.62;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, a.sky[0]);
    sky.addColorStop(0.6, a.sky[1]);
    sky.addColorStop(1, a.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hz);
    // stars
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#fff';
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = rnd() * (a.night ? 0.9 : 0.4);
      g.fillRect(rnd() * W, rnd() * hz * 0.6, 2, 2);
    }
    g.globalAlpha = 1;
    if (a.scene === 'space') {
      drawSpace(g, W, H);
      return;
    }
    if (!a.night) {
      // striped synthwave sun
      const r = 250;
      const sun = g.createLinearGradient(0, hz - r, 0, hz);
      sun.addColorStop(0, '#ffe66b');
      sun.addColorStop(0.5, '#ff8a3d');
      sun.addColorStop(1, '#ff2e9a');
      g.save();
      g.shadowColor = '#ff5ec4';
      g.shadowBlur = 90;
      g.fillStyle = sun;
      g.beginPath();
      g.arc(W / 2, hz, r, Math.PI, 0);
      g.fill();
      g.restore();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9; i++) g.fillRect(W / 2 - r, hz - 120 + i * 15, r * 2, 3 + i * 1.3);
      g.globalCompositeOperation = 'source-over';
    } else {
      // city skyline with neon windows
      for (let x = 0; x < W; ) {
        const bw = 40 + rnd() * 90;
        const bh = 80 + rnd() * 300;
        g.fillStyle = '#0a0618';
        g.fillRect(x, hz - bh, bw, bh);
        for (let wy = hz - bh + 10; wy < hz - 10; wy += 16)
          for (let wx = x + 6; wx < x + bw - 8; wx += 12)
            if (rnd() < 0.3) {
              g.fillStyle = rnd() < 0.5 ? a.neonA : a.neonB;
              g.globalAlpha = 0.5 + rnd() * 0.5;
              g.fillRect(wx, wy, 5, 7);
            }
        g.globalAlpha = 1;
        if (rnd() < 0.2) {
          g.fillStyle = rnd() < 0.5 ? a.neonA : a.neonB;
          g.shadowColor = g.fillStyle as string;
          g.shadowBlur = 30;
          g.fillRect(x + 6, hz - bh - 50, bw - 12, 34);
          g.shadowBlur = 0;
        }
        x += bw + 4;
      }
    }
    // ocean grid
    const sea = g.createLinearGradient(0, hz, 0, H);
    sea.addColorStop(0, a.night ? '#12082a' : '#3a0f5a');
    sea.addColorStop(1, a.night ? '#05030d' : '#12052a');
    g.fillStyle = sea;
    g.fillRect(0, hz, W, H - hz);
    g.strokeStyle = a.neonB;
    g.globalAlpha = 0.55;
    g.lineWidth = 2;
    for (let i = 1; i < 16; i++) {
      const y = hz + Math.pow(i / 16, 2) * (H - hz);
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    for (let i = -30; i <= 30; i++) {
      g.beginPath(); g.moveTo(W / 2 + i * 12, hz); g.lineTo(W / 2 + i * 160, H); g.stroke();
    }
    g.globalAlpha = 1;
    // palms
    const palm = (px: number, s: number) => {
      g.fillStyle = '#0b0416';
      g.strokeStyle = '#0b0416';
      g.lineWidth = 16 * s;
      g.beginPath();
      g.moveTo(px, H);
      g.quadraticCurveTo(px + 40 * s, H - 250 * s, px + 20 * s, H - 440 * s);
      g.stroke();
      for (let k = 0; k < 7; k++) {
        const ang = -Math.PI + (k / 6) * Math.PI;
        g.beginPath();
        g.moveTo(px + 20 * s, H - 440 * s);
        g.quadraticCurveTo(
          px + 20 * s + Math.cos(ang) * 120 * s, H - 500 * s + Math.sin(ang) * 40 * s,
          px + 20 * s + Math.cos(ang) * 220 * s, H - 400 * s + Math.abs(Math.cos(ang)) * 90 * s,
        );
        g.lineWidth = 12 * s;
        g.stroke();
      }
    };
    palm(120, 1.1); palm(330, 0.75); palm(W - 180, 1.2); palm(W - 420, 0.8);
  });
}

const BACKDROP_W = 34;
const BACKDROP_LEAN = 0.62; // radians, top toward the camera
const BACKDROP_BOTTOM_Y = -1.2;
const BACKDROP_BACK = 1.0;

export interface ArenaView {
  group: THREE.Group;
  goalZones: THREE.Mesh[][]; // [side 0 left, side 1 right] -> meshes
  flashGoal(side: number, big: boolean): void;
  update(t: number): void;
}

export async function buildArena(def: ArenaDef): Promise<ArenaView> {
  const group = new THREE.Group();
  const L = C.COURT_HALF_LEN, W = C.COURT_HALF_WID;
  const base = `assets/arenas/${def.id}/`;
  const [courtTex, skyTex] = await Promise.all([tryTexture(base + 'court.jpg'), tryTexture(base + 'backdrop.jpg')]);

  // Fighters are camera-facing cards that lean back, so a back-row fighter's legs and body sit geometrically
  // behind the far wall and its glass even though they stand in front of them. Everything behind the court
  // is therefore painted as background: drawn in order right after the backdrop, with no depth test, so
  // anything on the court (fighters, disc, effects) always draws over it.
  const asBackground = (m: THREE.Mesh, order: number) => {
    const mat = m.material as THREE.Material;
    mat.depthTest = false;
    mat.depthWrite = false;
    m.renderOrder = order;
    group.add(m);
  };

  // floor apron (outside court). With a painted backdrop the apron stops where the backdrop meets the
  // floor: the backdrop is drawn as a background layer (see below), so floor past that line would paint over it.
  const APRON_NEAR = 15;
  const apronFar = skyTex
    ? -W - 0.6 - BACKDROP_BACK - BACKDROP_BOTTOM_Y * Math.tan(BACKDROP_LEAN)
    : -15;
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(60, APRON_NEAR - apronFar),
    new THREE.MeshStandardMaterial({ color: def.night ? '#0d0718' : '#2a0f3a', roughness: def.night ? 0.25 : 0.9, metalness: def.night ? 0.5 : 0 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.02, (APRON_NEAR + apronFar) / 2);
  asBackground(apron, -999.5); // floor: under everything, and must not paint over the far wall

  // court
  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * L, 2 * W),
    new THREE.MeshStandardMaterial({
      map: courtTex ?? proceduralCourt(def),
      // painted courts already carry their own lighting: tone them down so bright ones don't bloom out
      color: courtTex ? '#b8b8b8' : '#ffffff',
      roughness: courtTex ? 1 : def.night ? 0.35 : 0.95,
      metalness: courtTex ? 0 : def.night ? 0.25 : 0,
    }),
  );
  court.rotation.x = -Math.PI / 2;
  court.receiveShadow = true;
  group.add(court);

  // backdrop: huge curved-ish plane far behind
  let sky: THREE.Mesh;
  if (skyTex) {
    // Painted backdrop: a plane leaning back toward the camera (≈ perpendicular to the view), bottom edge
    // tucked behind the far wall, so the image's crowd/skyline fills the band above the court.
    const img = skyTex.image as { width: number; height: number };
    const w = BACKDROP_W, h = w / (img.width / img.height), lean = BACKDROP_LEAN;
    // The leaning plane cuts through the air above the back of the court, so it is drawn first and without
    // depth: a background layer. Otherwise it hides fighters standing at the back and deep lobs.
    // Held just under the bloom threshold (0.9): bright painted skies otherwise bloom into a haze that
    // washes out any fighter standing in front of them (same reason the painted courts are toned down).
    sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTex, color: new THREE.Color(0.88, 0.88, 0.88), toneMapped: false, fog: false }));
    sky.rotation.x = lean;
    sky.position.set(0, BACKDROP_BOTTOM_Y + (h / 2) * Math.cos(lean), -W - 0.6 + (h / 2) * Math.sin(lean) - BACKDROP_BACK);
  } else {
    sky = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 20),
      new THREE.MeshBasicMaterial({ map: proceduralSky(def), toneMapped: false, fog: false }),
    );
    sky.position.set(0, 5.2, -10);
    sky.rotation.x = 0.3;
  }
  asBackground(sky, -1000);

  // far wall (front face on the court edge, where the sim's wall is)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1a0f2e', metalness: 0.8, roughness: 0.3 });
  const farWall = new THREE.Mesh(new THREE.BoxGeometry(2 * L + 0.6, 0.9, 0.3), wallMat);
  farWall.position.set(0, 0.45, -W - 0.15);
  asBackground(farWall, -997);
  const neonMat = (c: string, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2 * L + 0.6, 0.08, 0.05), neonMat(def.neonB, 1.7)); // top of the far wall: brighter blooms over back-row fighters
  strip.position.set(0, 0.86, -W + 0.01);
  asBackground(strip, -996);
  const strip2 = new THREE.Mesh(strip.geometry, neonMat(def.neonA, 2));
  strip2.position.set(0, 0.2, -W + 0.01);
  asBackground(strip2, -996);
  // Glass barrier above the far wall (think hockey glass). Fighters at the back of the court are drawn over
  // the backdrop; without a barrier they read as standing up in the crowd. Tinted glass + a neon top rail
  // puts them visibly in front of the arena wall. Purely visual: the sim's walls are unchanged. Painted as
  // background like the wall; it stays in the opaque pass (CustomBlending keeps its alpha there) so it
  // draws right after the backdrop.
  const GLASS_H = 2.3;
  const glassMat = new THREE.MeshBasicMaterial({
    color: def.night ? '#140a36' : '#2a1050', opacity: 0.5, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * L + 0.6, GLASS_H), glassMat);
  glass.position.set(0, 0.9 + GLASS_H / 2, -W - 0.15);
  asBackground(glass, -999);
  const glassRail = new THREE.Mesh(new THREE.BoxGeometry(2 * L + 0.6, 0.06, 0.06), neonMat(def.neonB, 1.15));
  glassRail.position.set(0, 0.9 + GLASS_H, -W - 0.15);
  asBackground(glassRail, -998);
  for (let i = -4; i <= 4; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, GLASS_H, 0.04), neonMat(def.neonA, 0.9));
    post.position.set((i / 4) * (L + 0.3), 0.9 + GLASS_H / 2, -W - 0.15);
    asBackground(post, -998);
  }
  // near rail (low so it doesn't hide players)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2 * L + 0.6, 0.04, 0.04), neonMat(def.neonB, 1.2));
  rail.position.set(0, 0.1, W + 0.1);
  group.add(rail);

  // net (holographic)
  const netMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.neonA).multiplyScalar(1.5), transparent: true, opacity: 0.35, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 0.7), netMat);
  net.rotation.y = Math.PI / 2;
  net.position.set(0, 0.35, 0);
  group.add(net);
  const netTop = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 2 * W), neonMat(def.neonA, 1.1));
  netTop.position.set(0, 0.7, 0);
  group.add(netTop);
  for (const z of [-W, W]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0), new THREE.MeshStandardMaterial({ color: '#c0c8d8', metalness: 1, roughness: 0.2 }));
    post.position.set(0, 0.5, z);
    group.add(post);
  }

  // goals: zones on back walls
  const goalZones: THREE.Mesh[][] = [[], []];
  const segs: [number, number, boolean][] = [
    [-W, -def.bigZone, false],
    [-def.bigZone, def.bigZone, true],
    [def.bigZone, W, false],
  ];
  for (const side of [0, 1]) {
    const x = side === 0 ? -L - 0.1 : L + 0.1;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.9, 2 * W + 0.5), new THREE.MeshStandardMaterial({ color: '#241638', metalness: 0.9, roughness: 0.35 }));
    frame.position.set(x + (side === 0 ? -0.2 : 0.2), 0.95, 0);
    group.add(frame);
    for (const [z0, z1, big] of segs) {
      const col = big ? '#ff2e9a' : '#ffd21a';
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.3), transparent: true, opacity: 0.85, toneMapped: false });
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0 - 0.12, 1.5), m);
      zone.rotation.y = side === 0 ? Math.PI / 2 : -Math.PI / 2;
      zone.position.set(x + (side === 0 ? -0.06 : 0.06), 0.85, (z0 + z1) / 2);
      zone.userData.baseColor = new THREE.Color(col).multiplyScalar(1.3);
      zone.userData.flash = 0;
      group.add(zone);
      goalZones[side].push(zone);
      // points label
      const label = canvasTex(256, 128, (g) => {
        g.font = 'bold 96px "Orbitron", "Arial Black", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#1a0b2e';
        g.fillText(big ? '5' : '3', 128, 68);
      });
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: label, transparent: true, toneMapped: false }));
      lbl.rotation.y = zone.rotation.y;
      lbl.position.set(zone.position.x + (side === 0 ? 0.01 : -0.01), 1.1, zone.position.z);
      group.add(lbl);
    }
  }

  // crowd/stands behind far wall: rows of glowing light sticks for life
  const lightCount = 220;
  const lightGeo = new THREE.SphereGeometry(0.06, 6, 4);
  const lights = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), lightCount);
  const dummy = new THREE.Object3D();
  const cA = new THREE.Color(def.neonA).multiplyScalar(2.5), cB = new THREE.Color(def.neonB).multiplyScalar(2.5), cW = new THREE.Color('#ffe600').multiplyScalar(2);
  const lightBase: THREE.Vector3[] = [];
  for (let i = 0; i < lightCount; i++) {
    const row = i % 4;
    dummy.position.set(-L - 3 + ((i * 7.31) % (2 * L + 6)), 1.2 + row * 0.35, -W - 1.0 - row * 0.6);
    lightBase.push(dummy.position.clone());
    dummy.updateMatrix();
    lights.setMatrixAt(i, dummy.matrix);
    lights.setColorAt(i, i % 3 === 0 ? cA : i % 3 === 1 ? cB : cW);
  }
  lights.visible = !skyTex; // painted backdrops have their own crowd
  group.add(lights);

  // lighting
  const hemi = new THREE.HemisphereLight(def.night ? '#6a5aff' : '#ffd0b0', def.night ? '#1a0a2a' : '#5a2a4a', def.night ? 1.4 : 2.0);
  group.add(hemi);
  const key = new THREE.DirectionalLight(def.night ? '#b08aff' : '#ffb27a', def.night ? 1.2 : 2.2);
  key.position.set(-8, 14, 6);
  group.add(key);
  const rim = new THREE.PointLight(def.neonA, 30, 30);
  rim.position.set(0, 4, -W);
  group.add(rim);

  function flashGoal(side: number, big: boolean) {
    for (const z of goalZones[side]) {
      const isBig = z === goalZones[side][1];
      if (isBig === big) z.userData.flash = 1;
    }
  }

  function update(t: number) {
    for (const s of goalZones)
      for (const z of s) {
        const f = z.userData.flash as number;
        const m = z.material as THREE.MeshBasicMaterial;
        m.color.copy(z.userData.baseColor).multiplyScalar(1 + f * 0.9 * (0.5 + 0.5 * Math.sin(t * 40)));
        z.userData.flash = Math.max(0, f - 0.025);
      }
    for (let i = 0; i < lightCount; i += 1) {
      const b = lightBase[i];
      dummy.position.set(b.x + Math.sin(t * 3 + i) * 0.12, b.y + Math.abs(Math.sin(t * 4 + i * 1.7)) * 0.15, b.z);
      dummy.updateMatrix();
      lights.setMatrixAt(i, dummy.matrix);
    }
    lights.instanceMatrix.needsUpdate = true;
    netMat.opacity = 0.28 + 0.08 * Math.sin(t * 5);
  }

  return { group, goalZones, flashGoal, update };
}
