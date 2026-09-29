import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { GameEvent, GameState, Player } from '../sim/types';
import { buildArena, type ArenaDef, type ArenaView } from './arena';
import { frameRect, loadCharacterArt, type CharacterArt } from './characterArt';
import { charById } from '../sim/characters';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const PLAYER_HEIGHT = 3.0;
const TRAIL_STEP = 1 / 60; // seconds of game time between trail samples
const RUN_TO_IDLE = 0.12; // seconds of standing still before the run cycle gives way to idle

class PlayerView {
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  aura: THREE.Sprite;
  tex: THREE.Texture;
  anim = 'idle';
  animT = 0;
  constructor(public art: CharacterArt, public side: number, auraColor: string) {
    this.tex = art.texture.clone();
    this.tex.needsUpdate = true;
    this.tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.05 });
    // A sprite is a camera-facing quad: it leans back with the view, so a disc behind the fighter but up at
    // chest height is nearer the camera than the sprite there and drew over him. Keep the sprite's look, but
    // give the depth test an upright card standing at the feet: each corner gets the depth of the point where
    // its view ray meets the vertical plane through the feet (facing the camera). Depth is linear across that
    // plane on screen, so this is exact for every pixel.
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <logdepthbuf_vertex>', `{
        vec3 feetW = modelMatrix[ 3 ].xyz;
        vec3 nW = cameraPosition - feetW; nW.y = 0.0; nW = normalize( nW );
        vec3 nV = ( viewMatrix * vec4( nW, 0.0 ) ).xyz;
        float t = dot( nV, modelViewMatrix[ 3 ].xyz ) / dot( nV, mvPosition.xyz );
        vec4 onCard = projectionMatrix * vec4( mvPosition.xyz * t, 1.0 );
        gl_Position.z = onCard.z / onCard.w * gl_Position.w;
      }
      #include <logdepthbuf_vertex>`);
    };
    this.sprite = new THREE.Sprite(mat);
    this.showFrame('idle', 0);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(1.3, 0.8, 1);
    this.shadow.position.y = 0.01;
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(auraColor).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.aura.center.set(0.5, 0.2);
    this.aura.scale.set(2.4, 3.2, 1);
    this.aura.visible = false;
  }

  /** `restart`: the requested anim changed this frame, so a one-shot re-entered (throw, hold, throw) plays again. */
  setFrame(want: string, dt: number, restart = false) {
    const meta = this.art.meta;
    // Run -> idle only after standing still for a moment. The CPU's steering (and key tapping) flips
    // walk/idle every tick while tracking a moving target, which restarted the run cycle each frame.
    if (want === 'idle' && this.anim === 'run') {
      this.idleFor += dt;
      if (this.idleFor < RUN_TO_IDLE) want = 'run';
    } else this.idleFor = 0;
    // The sim leaves throw/lob/block/knock after ~0.2 s but most real one-shot anims run longer. Let the
    // current one-shot finish instead of snapping to idle or hold. Moving (run) and new actions still cut in.
    const cur = meta.anims[this.anim];
    const curPlaying = !!cur && !cur.loop && this.animT < cur.frames / cur.fps;
    const anim = want !== this.anim && curPlaying && (want === 'idle' || want === 'hold') ? this.anim : want;
    const a = meta.anims[anim] ?? meta.anims.idle;
    if (anim !== this.anim || (restart && want === this.anim && !a.loop)) { this.anim = anim; this.animT = 0; }
    this.animT += dt;
    let f = Math.floor(this.animT * a.fps);
    f = a.loop ? f % a.frames : Math.min(f, a.frames - 1);
    this.showFrame(anim, f);
    if (this.art.meta.interim || a.interim) this.applyMotion(anim);
    else this.resetMotion();
  }

  /** Point the texture at one frame and size + anchor the sprite from its rect (frames differ in size). */
  private showFrame(anim: string, f: number) {
    const r = frameRect(this.art.meta, anim, f);
    const k = (PLAYER_HEIGHT * (this.art.meta.heightScale ?? 1)) / r.refH; // world units per atlas px
    this.baseW = r.w * k;
    this.baseH = r.h * k;
    const u0 = r.x / r.atlasW, du = r.w / r.atlasW;
    const v0 = 1 - (r.y + r.h) / r.atlasH, dv = r.h / r.atlasH; // textures are bottom-up
    const fx = r.footX / r.w, fy = r.footY / r.h;
    // Art faces right; right-side player faces left => mirror around the feet.
    if (this.side > 0) {
      this.tex.repeat.set(-du, dv);
      this.tex.offset.set(u0 + du, v0);
      this.sprite.center.set(1 - fx, fy);
    } else {
      this.tex.repeat.set(du, dv);
      this.tex.offset.set(u0, v0);
      this.sprite.center.set(fx, fy);
    }
  }

  /**
   * Interim art has one pose per animation, so fake the motion: lean (rotation about the
   * feet anchor), squash/stretch and hops. Disabled once real multi-frame sheets land.
   */
  private applyMotion(anim: string) {
    const t = this.animT;
    let lean = 0, sx = 1, sy = 1, hop = 0;
    switch (anim) {
      case 'idle': sy = 1 + 0.018 * Math.sin(t * 6); sx = 1 - 0.01 * Math.sin(t * 6); break;
      case 'run': {
        const c = Math.abs(Math.sin(t * 13));
        hop = c * 0.14; lean = 0.13; sy = 0.95 + c * 0.07; sx = 1.04 - c * 0.05;
        break;
      }
      case 'dash': lean = 0.38; sx = 1.16; sy = 0.84; break;
      case 'hold': lean = -0.09 + 0.02 * Math.sin(t * 9); sy = 0.97; break;
      case 'throw': { const k = Math.max(0, 1 - t * 5); lean = 0.28 * (1 - k * 0.5); sx = 1 + 0.12 * k; sy = 1 - 0.06 * k; break; }
      case 'lob': lean = -0.12; sy = 1.07; break;
      case 'block': sy = 1.09; sx = 0.95; hop = 0.08; break;
      case 'knock': lean = -0.3 + 0.05 * Math.sin(t * 60); break;
      case 'win': hop = Math.abs(Math.sin(t * 6)) * 0.35; sy = 1 + Math.sin(t * 12) * 0.04; break;
      case 'lose': lean = 0.22; sy = 0.9; sx = 1.05; break;
    }
    const facing = this.side < 0 ? 1 : -1;
    (this.sprite.material as THREE.SpriteMaterial).rotation = -lean * facing;
    this.sprite.scale.set(this.baseW * sx, this.baseH * sy, 1);
    this.hop = hop;
  }
  private resetMotion() {
    (this.sprite.material as THREE.SpriteMaterial).rotation = 0;
    this.sprite.scale.set(this.baseW, this.baseH, 1);
    this.hop = 0;
  }
  dispose() {
    this.tex.dispose(); // this fighter's own texture object (the atlas image is shared and cached)
    (this.sprite.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    (this.aura.material as THREE.Material).dispose(); // the glow texture itself is shared: kept
  }
  /** true when the current frame already shows the disc in hand (so the 3D disc is hidden) */
  get discInArt() {
    return this.anim === 'hold' && !!this.art.meta.anims.hold?.discInArt;
  }
  hop = 0;
  lastWant = '';
  idleFor = 0;
  baseW = 1;
  baseH = 1;
}

/** Free the GPU memory of everything under `root` (geometry, materials and their textures). Each match and each
 * attract-demo loop builds a new arena; without this the old ones piled up until phones ran out of memory. */
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
    (o as THREE.InstancedMesh).dispose?.();
  });
}

let _glow: THREE.Texture | null = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

interface Particle { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; size: number }

class Particles {
  points: THREE.Points;
  private list: Particle[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  constructor(max = 600) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, scale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor;
        uniform float scale;
        void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor;
        void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vColor*t.a*2.0, t.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < max; i++) this.list.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, color: new THREE.Color(), size: 0 });
  }
  burst(x: number, y: number, z: number, color: string, n: number, speed: number, size = 0.35, life = 0.5) {
    const c = new THREE.Color(color);
    for (const p of this.list) {
      if (n <= 0) break;
      if (p.alive) continue;
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.8);
      Object.assign(p, { alive: true, x, y, z, vx: Math.cos(th) * Math.sin(ph) * s, vy: Math.abs(Math.cos(ph)) * s * 0.8, vz: Math.sin(th) * Math.sin(ph) * s, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8) });
      p.max = p.life;
      p.color.copy(c);
      n--;
    }
  }
  update(dt: number) {
    this.list.forEach((p, i) => {
      if (p.alive) {
        p.life -= dt;
        if (p.life <= 0) p.alive = false;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 6 * dt;
        p.vx *= 0.96; p.vz *= 0.96;
      }
      const k = p.alive ? p.life / p.max : 0;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.color.r * k; this.col[i * 3 + 1] = p.color.g * k; this.col[i * 3 + 2] = p.color.b * k;
      this.size[i] = p.alive ? p.size * (0.5 + k) : 0;
    });
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}

/** Ribbon trail following the disc. */
class Trail {
  mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private geo: THREE.BufferGeometry;
  private n: number;
  color = new THREE.Color('#ffffff');
  constructor(n = 18) {
    this.n = n;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n * 2), 1));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: this.color } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 color; varying float vA; void main(){ gl_FragColor=vec4(color*vA*2.5, vA);} `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }
  private acc = 0;
  /** One sample per 1/60 s of game time, whatever the screen's refresh rate: sampling per rendered frame made
   * the trail half as long on 120 Hz phones. Between samples the newest point follows the disc. */
  push(p: THREE.Vector3, width: number, active: boolean, dt: number) {
    if (!active) { this.pts.length = 0; this.acc = 0; }
    else {
      this.acc += dt;
      if (!this.pts.length || this.acc >= TRAIL_STEP) {
        this.acc = this.pts.length ? this.acc % TRAIL_STEP : 0;
        this.pts.unshift(p.clone());
        if (this.pts.length > this.n) this.pts.pop();
      } else this.pts[0].copy(p);
    }
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const al = this.geo.attributes.alpha as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)];
      const k = 1 - i / this.n;
      if (!q || this.pts.length < 2) { pos.setXYZ(i * 2, 0, -99, 0); pos.setXYZ(i * 2 + 1, 0, -99, 0); al.setX(i * 2, 0); al.setX(i * 2 + 1, 0); continue; }
      const w = width * k;
      pos.setXYZ(i * 2, q.x, q.y + w, q.z);
      pos.setXYZ(i * 2 + 1, q.x, q.y - w * 0.3, q.z + w * 0.6);
      al.setX(i * 2, k * k); al.setX(i * 2 + 1, k * k);
    }
    pos.needsUpdate = true;
    al.needsUpdate = true;
  }
}

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private arena: ArenaView | null = null;
  private players: PlayerView[] = [];
  private disc: THREE.Group;
  private discGlow: THREE.Sprite;
  private discShadow: THREE.Mesh;
  private reticle: THREE.Mesh;
  private trail = new Trail();
  private particles = new Particles();
  private shake = 0;
  private superZoom = 0;
  private time = 0;
  private camBase = new THREE.Vector3(0, 13.5, 15.0);
  private lookAt = new THREE.Vector3(0, 0, -2.75);

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200);
    this.scene.fog = new THREE.Fog('#1a0638', 40, 90);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // disc
    this.disc = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.3, 0.09, 32),
      new THREE.MeshStandardMaterial({ color: '#ffe600', emissive: '#ff9a00', emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.35 }),
    );
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2e9a').multiplyScalar(3), toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.07), new THREE.MeshBasicMaterial({ color: '#1a0b2e' }));
    this.disc.add(body, ring, stripe);
    this.disc.scale.setScalar(1.15);
    this.discGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#ffd23a').multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.discGlow.scale.set(1.6, 1.6, 1);
    this.discShadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
    this.discShadow.rotation.x = -Math.PI / 2;
    this.discShadow.position.y = 0.015;
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#19e6ff').multiplyScalar(2.5), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.position.y = 0.02;
    // Glow, trail and sparks go after every fighter sprite (renderOrder 10 + z*10, at most ~51). They don't
    // write depth, so a sprite drawn after them painted over them even when the disc was in front; drawn
    // last, the depth test hides them only behind a fighter that is really in front.
    const EFFECTS_LAST = 100;
    this.discGlow.renderOrder = this.trail.mesh.renderOrder = this.particles.points.renderOrder = EFFECTS_LAST;
    this.scene.add(this.disc, this.discGlow, this.discShadow, this.reticle, this.trail.mesh, this.particles.points);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  private sized = { w: 0, h: 0, dpr: 0 };

  /** Resize whenever the container's real size or the pixel ratio changed. Called every frame too:
   * phones (rotation, in-app browsers, toolbars sliding) don't reliably fire window 'resize' after the
   * layout settles, which left the drawing buffer at an old size in a corner of the screen. */
  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const dpr = Math.min(devicePixelRatio, 2);
    if (w === this.sized.w && h === this.sized.h && dpr === this.sized.dpr) return;
    this.sized = { w, h, dpr };
    this.renderer.setPixelRatio(dpr);
    this.composer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    // Keep the whole court visible on narrow screens.
    const minAspect = 16 / 9;
    const k = Math.max(1, minAspect / this.camera.aspect);
    this.camBase.set(0, 13.5 * k, 15.0 * k);
    this.camera.updateProjectionMatrix();
  }

  private setupGen = 0;

  /** Swap in a new arena + fighters. Returns false if a newer setup() started while this one was
   * loading (e.g. the attract demo still loading when the player starts a match): the stale result
   * is discarded, so two setups can never both add their fighters (frozen "ghost" sprites). */
  async setup(arena: ArenaDef, p1: string, p2: string): Promise<boolean> {
    const gen = ++this.setupGen;
    const [built, arts] = await Promise.all([buildArena(arena), Promise.all([loadCharacterArt(p1), loadCharacterArt(p2)])]);
    if (gen !== this.setupGen) return false;
    if (this.arena) { this.scene.remove(this.arena.group); disposeTree(this.arena.group); }
    for (const p of this.players) { this.scene.remove(p.sprite, p.shadow, p.aura); p.dispose(); }
    this.arena = built;
    this.scene.add(this.arena.group);
    (this.scene.fog as THREE.Fog).color.set(arena.sky[1]);
    this.players = arts.map((a, i) => new PlayerView(a, i === 0 ? -1 : 1, charById(i === 0 ? p1 : p2).colors.primary));
    for (const p of this.players) this.scene.add(p.sprite, p.shadow, p.aura);
    return true;
  }

  private animFor(p: Player, g: GameState) {
    if (g.phase === 'serve' && p.state === 'hold') return 'hold';
    switch (p.state) {
      case 'walk': return 'run';
      case 'dash': case 'recover': return 'dash';
      case 'hold': return 'hold';
      case 'throw': return 'throw';
      case 'lob': return 'lob';
      case 'block': return 'block';
      case 'knock': return 'knock';
      case 'win': return 'win';
      case 'lose': return 'lose';
      default: return 'idle';
    }
  }

  handleEvents(events: GameEvent[], g: GameState) {
    for (const e of events) {
      const pc = e.p !== undefined ? charById(g.players[e.p].charId).colors.primary : '#ffffff';
      switch (e.type) {
        case 'catch':
          this.particles.burst(e.x!, 1, e.z!, e.big ? '#ffffff' : pc, e.big ? 60 : 18, e.big ? 9 : 5);
          this.shake = Math.max(this.shake, e.big ? 0.5 : 0.12);
          break;
        case 'wall':
          this.particles.burst(e.x!, 0.8, e.z!, '#19e6ff', 14, 6, 0.3, 0.35);
          this.shake = Math.max(this.shake, 0.08);
          break;
        case 'supersonic':
          this.particles.burst(e.x!, 1, e.z!, '#ffffff', 30, 10);
          this.shake = Math.max(this.shake, 0.25);
          break;
        case 'super':
          this.superZoom = 1;
          this.shake = Math.max(this.shake, 0.3);
          this.particles.burst(e.x ?? 0, 1.2, e.z ?? 0, pc, 80, 11, 0.5, 0.8);
          break;
        case 'charge':
          this.particles.burst(e.x!, 0.3, e.z!, '#ffe600', 50, 7, 0.4, 0.7);
          break;
        case 'score':
          this.shake = Math.max(this.shake, e.big ? 0.7 : 0.45);
          this.particles.burst(e.x!, 1, e.z!, e.big ? '#ff2e9a' : '#ffd21a', 140, 14, 0.55, 1.0);
          this.arena?.flashGoal(e.x! < 0 ? 0 : 1, !!e.big);
          break;
        case 'drop':
          this.particles.burst(e.x!, 0.1, e.z!, '#f0b98a', 40, 5, 0.4, 0.6);
          this.shake = Math.max(this.shake, 0.25);
          break;
        case 'block':
          this.particles.burst(e.x!, 1.2, e.z!, '#19e6ff', 20, 5);
          break;
      }
    }
  }

  render(g: GameState, alpha: number, dt: number) {
    this.resize(); // no-op unless the size / pixel ratio changed
    // During a freeze (catch, goal, super cut-in) the sim stops updating its previous positions, so the
    // interpolation kept sweeping between two old positions and everything buzzed. Hold the latest one instead.
    if (g.hitstop > 0) alpha = 1;
    this.time += dt;
    this.arena?.update(this.time);
    const d = g.disc;

    g.players.forEach((p, i) => {
      const v = this.players[i];
      if (!v) return;
      const x = lerp(p.px, p.x, alpha), z = lerp(p.pz, p.z, alpha);
      v.sprite.position.set(x, v.hop, z);
      v.shadow.position.set(x, 0.01, z);
      v.aura.position.set(x, 0, z - 0.05);
      v.aura.visible = p.charged;
      if (p.charged) {
        const s = 1 + 0.12 * Math.sin(this.time * 18);
        v.aura.scale.set(2.4 * s, 3.2 * s, 1);
      }
      const anim = this.animFor(p, g);
      v.setFrame(anim, dt, anim !== v.lastWant);
      v.lastWant = anim;
      v.sprite.renderOrder = 10 + Math.round(z * 10);
    });

    const visible = d.mode !== 'dead' || g.phase === 'point';
    const dx = lerp(d.px, d.x, alpha), dz = lerp(d.pz, d.z, alpha), dh = lerp(d.ph, d.h, alpha);
    const heldInArt = d.mode === 'held' && d.holder >= 0 && !!this.players[d.holder]?.discInArt;
    this.disc.visible = this.discGlow.visible = visible && !heldInArt;
    this.discShadow.visible = visible;
    this.disc.position.set(dx, dh + 0.05, dz);
    this.disc.rotation.y = d.spin;
    this.disc.rotation.z = d.mode === 'lob' ? 0.5 : d.mode === 'held' ? 0.25 : 0.1 * Math.sin(this.time * 20);
    this.discGlow.position.copy(this.disc.position);
    this.discShadow.position.set(dx, 0.015, dz);
    const hs = 1 / (1 + dh * 0.25);
    this.discShadow.scale.setScalar(hs);
    (this.discShadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * hs;

    const kindColor: Record<string, string> = { normal: '#ffd23a', supersonic: '#ffffff', curve: '#19e6ff', super: '#ff2e9a', lob: '#b6ff2e', toss: '#ffe600' };
    let tc = kindColor[d.kind] ?? '#ffffff';
    if (d.kind === 'super' && d.thrower >= 0) tc = charById(g.players[d.thrower].charId).colors.primary;
    this.trail.color.set(tc);
    (this.discGlow.material as THREE.SpriteMaterial).color.set(tc).multiplyScalar(d.mode === 'held' ? 0.35 : d.kind === 'super' ? 3 : 1.2);
    const flying = d.mode === 'flight' || d.mode === 'ground' || d.mode === 'lob';
    const w = d.kind === 'super' ? 0.45 : d.kind === 'supersonic' ? 0.32 : 0.16;
    this.trail.push(this.disc.position, w, flying, dt);
    if (d.kind === 'super' && flying && Math.random() < 0.7 * Math.min(1, dt * 60)) this.particles.burst(dx, dh, dz, tc, 2, 2, 0.35, 0.35);

    this.reticle.visible = d.mode === 'lob' && !!d.lob;
    if (d.lob) {
      this.reticle.position.set(d.lob.tx, 0.02, d.lob.tz);
      const k = d.lob.t / d.lob.T;
      this.reticle.scale.setScalar(1.6 - k * 0.6);
      (this.reticle.material as THREE.MeshBasicMaterial).color.set(d.lob.superLob ? '#ff2e9a' : '#19e6ff').multiplyScalar(2 + Math.sin(this.time * 25));
    }

    this.particles.update(dt);

    // camera: gentle sway + shake + super punch-in
    this.shake *= Math.pow(0.02, dt);
    this.superZoom *= Math.pow(0.15, dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const follow = g.phase === 'play' ? dx * 0.06 : 0;
    this.camera.position.set(this.camBase.x + follow + sx + Math.sin(this.time * 0.3) * 0.15, this.camBase.y + sy - this.superZoom * 1.2, this.camBase.z - this.superZoom * 1.5);
    this.camera.lookAt(this.lookAt.x + follow, this.lookAt.y, this.lookAt.z);
    this.bloom.strength = 0.7 + this.superZoom * 0.8;

    this.composer.render();
  }
}
