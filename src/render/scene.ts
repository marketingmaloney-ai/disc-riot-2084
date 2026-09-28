import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { GameEvent, GameState, Player } from '../sim/types';
import { buildArena, type ArenaDef, type ArenaView } from './arena';
import { loadCharacterArt, type CharacterArt } from './characterArt';
import { charById } from '../sim/characters';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const PLAYER_HEIGHT = 2.35;

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
    const m = art.meta;
    this.tex.repeat.set(1 / m.cols, 1 / m.rows);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.05 }));
    this.sprite.center.set(0.5, m.anchorY);
    const aspect = m.cell[0] / m.cell[1];
    this.sprite.scale.set(PLAYER_HEIGHT * aspect, PLAYER_HEIGHT, 1);
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

  setFrame(anim: string, dt: number) {
    const meta = this.art.meta;
    const a = meta.anims[anim] ?? meta.anims.idle;
    if (anim !== this.anim) { this.anim = anim; this.animT = 0; }
    this.animT += dt;
    let f = Math.floor(this.animT * a.fps);
    f = a.loop ? f % a.frames : Math.min(f, a.frames - 1);
    const u = 1 / meta.cols, v = 1 / meta.rows;
    const row = meta.rows - 1 - a.row; // textures are bottom-up
    // Art faces right; right-side player faces left => mirror.
    if (this.side > 0) {
      this.tex.repeat.set(-u, v);
      this.tex.offset.set((f + 1) * u, row * v);
    } else {
      this.tex.repeat.set(u, v);
      this.tex.offset.set(f * u, row * v);
    }
  }
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
  push(p: THREE.Vector3, width: number, active: boolean) {
    if (!active) { this.pts.length = 0; }
    else { this.pts.unshift(p.clone()); if (this.pts.length > this.n) this.pts.pop(); }
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
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.82);
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
    this.scene.add(this.disc, this.discGlow, this.discShadow, this.reticle, this.trail.mesh, this.particles.points);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
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

  async setup(arena: ArenaDef, p1: string, p2: string) {
    if (this.arena) this.scene.remove(this.arena.group);
    for (const p of this.players) this.scene.remove(p.sprite, p.shadow, p.aura);
    this.arena = await buildArena(arena);
    this.scene.add(this.arena.group);
    (this.scene.fog as THREE.Fog).color.set(arena.sky[1]);
    const arts = await Promise.all([loadCharacterArt(p1), loadCharacterArt(p2)]);
    this.players = arts.map((a, i) => new PlayerView(a, i === 0 ? -1 : 1, charById(i === 0 ? p1 : p2).colors.primary));
    for (const p of this.players) this.scene.add(p.sprite, p.shadow, p.aura);
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
    this.time += dt;
    this.arena?.update(this.time);
    const d = g.disc;

    g.players.forEach((p, i) => {
      const v = this.players[i];
      if (!v) return;
      const x = lerp(p.px, p.x, alpha), z = lerp(p.pz, p.z, alpha);
      v.sprite.position.set(x, 0, z);
      v.shadow.position.set(x, 0.01, z);
      v.aura.position.set(x, 0, z - 0.05);
      v.aura.visible = p.charged;
      if (p.charged) {
        const s = 1 + 0.12 * Math.sin(this.time * 18);
        v.aura.scale.set(2.4 * s, 3.2 * s, 1);
      }
      v.setFrame(this.animFor(p, g), dt);
      v.sprite.renderOrder = 10 + Math.round(z * 10);
    });

    const visible = d.mode !== 'dead' || g.phase === 'point';
    const dx = lerp(d.px, d.x, alpha), dz = lerp(d.pz, d.z, alpha), dh = lerp(d.ph, d.h, alpha);
    this.disc.visible = this.discShadow.visible = this.discGlow.visible = visible;
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
    this.trail.push(this.disc.position, w, flying && g.hitstop === 0 ? true : flying);
    if (d.kind === 'super' && flying && Math.random() < 0.7) this.particles.burst(dx, dh, dz, tc, 2, 2, 0.35, 0.35);

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
