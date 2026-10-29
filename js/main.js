import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildWorld, setWire, rng, PAL } from './world.js';
import { Stick, walkPose } from './stick.js';
import { bakeCrash, sampleCrash, CRASH } from './physics.js';
import { LensShader } from './lens.js';
import * as O from './overlay.js';

const FW = 1080, FH = 1920, FPS = 30;
const out = document.getElementById('film'), ctx = out.getContext('2d');

// fonts: local files only
const fonts = [
  new FontFace('Anton', 'url(./node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2)'),
  new FontFace('JBM', 'url(./node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2)', { weight: '700' }),
];
await Promise.all(fonts.map(f => f.load().then(ff => document.fonts.add(ff))));

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(FW, FH, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, FW / FH, 0.02, 400);
const W = buildWorld(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(FW / 2, FH / 2), 0.75, 0.55, 0.82); composer.addPass(bloom);
composer.addPass(new OutputPass());
const lens = new ShaderPass(LensShader); composer.addPass(lens);

// ---------- cast ----------
window.CAST = {};
const you = new Stick({ cap: '#d8261f' });          // the mark: a red cap
const guest = new Stick({ body: '#dfe4ea' });
const owner = new Stick({ cap: '#d8261f', body: '#e6e0d2' });
const them = Array.from({ length: 6 }, (_, i) => new Stick({ body: '#d9dde6', emissive: 0.08, px: 160 }));
[you, guest, owner, ...them].forEach(s => scene.add(s.mesh)); Object.assign(window.CAST, { you, guest, owner });

// owner's flashlight
const flash = new THREE.SpotLight(0xfff1d6, 0, 9, 0.55, 0.5, 2); scene.add(flash, flash.target);
const flashGlow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(flashGlow);

// ---------- physics: simulate once, sample by time ----------
const crash = bakeCrash(10, 120);
const T_HIT = 50.75;                                   // "It hits the pole."
const SIM0 = T_HIT - crash.hitTime;                    // global time when the sim starts
const T_BLACK = T_HIT + 0.45;                          // transformer blows
const T_LAMP_OUT = 52.85;                              // "And your light goes out."

// ---------- story clock ----------
const CLOCK = [[0, 1438], [16.6, 1471], [29.6, 1570], [40.6, 1660], [47.6, 1724], [56.4, 1727], [78, 1733]];
function clockAt(t) {
  let m = CLOCK[0][1];
  for (let i = 0; i < CLOCK.length - 1; i++) {
    const [a, ma] = CLOCK[i], [b, mb] = CLOCK[i + 1];
    if (t >= a) { const hold = Math.max(a, b - 1.0);       // ticks a minute every ~4 s, then spins forward
      m = t >= b ? mb : t < hold ? Math.min(ma + (t - a) / 4, mb) : lerp(Math.min(ma + (hold - a) / 4, mb), mb, smooth((t - hold) / (b - hold))); }
  }
  m = Math.floor(m) % 1440; const h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`;
}

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---------- world state as a pure function of t ----------
function worldState(t) {
  // lamp flicker during the 3:40 sequence, dead after the blackout
  let lamp = 1;
  if (t > 40.9 && t < 47.6) { const k = Math.floor(t * 9); lamp = hash(k) < 0.42 ? 0.06 : 1; if (t > 45.4) lamp = 1; }
  if (t >= T_LAMP_OUT) lamp = 0;
  else if (t >= T_BLACK) lamp = (Math.floor(t * 14) % 3 === 0) ? 0.25 : 0.85;   // brownout before it dies
  W.lights.lamp.intensity = 4.5 * lamp; W.lampBulbM.emissiveIntensity = 1.6 * lamp;
  you.mat.emissiveIntensity = 0.14;

  const powerOut = t >= T_BLACK;
  W.doorLamps.forEach((d, i) => { const off = t >= T_BLACK + 0.25 + i * 0.06; d.lampM.emissiveIntensity = off ? 0 : (d.floor ? 0.9 : 2.2); if (d.pt) d.pt.intensity = off ? 0 : 7; });
  W.doors.filter(d => d.floor === 1).forEach(d => d.lampM.emissiveIntensity = powerOut ? 0 : 0.9);
  W.streetLights.forEach(s => { const off = t >= T_BLACK + Math.abs(s.x - CRASH.pole[0]) / 60; s.hm.emissiveIntensity = off ? 0 : 3; s.L.intensity = off ? 0 : 700; });
  const neonOn = !(t >= T_BLACK + 0.15) || (t < T_BLACK + 0.7 && hash(Math.floor(t * 20)) > 0.6);
  W.neonStar.emissiveIntensity = neonOn ? 2.4 : 0; W.neonMotel.emissiveIntensity = neonOn ? 1.6 : 0; W.neonStarTop.emissiveIntensity = neonOn ? 3 : 0;
  W.neonVac.emissiveIntensity = neonOn ? 3 : 0; W.lights.neon.intensity = neonOn ? 14 : 0; W.lights.neon2.intensity = neonOn ? 8 : 0;
  W.offSign.material.emissiveIntensity = powerOut ? 0 : 1.2;
  // moon gets a touch stronger after the blackout so the frame never crushes
  W.lights.moon.intensity = powerOut ? 1.6 : 1.25; W.lights.winFill.intensity = powerOut ? 40 : 30;

  // room 9: a wall until the guest asks for it
  const r9 = t >= 23.6;
  W.wall9.visible = !r9; W.room9.group.visible = r9;
  W.room9.curtM.emissiveIntensity = r9 && !powerOut ? 0.9 : (r9 ? 0.55 : 0);   // room 9 stays lit in the blackout
  W.room9.curtM.emissive.setHex(0xff7a44);
  W.lights.r9.intensity = r9 ? 6 : 0;
  W.doors.forEach(d => { if (!d.slot9 && d.floor === 0) d.curtM.emissiveIntensity = (!powerOut && [2, 5].includes(d.num)) ? 0.5 : 0; });
  W.room9.plaque.material.emissiveIntensity = r9 ? 0.35 : 0;

  // phone LED
  W.phoneLedM.emissiveIntensity = (t > 29.6 && t < 36.6 && Math.floor(t * 3) % 2 === 0) ? 4 : 0;
  W.amLedM.emissiveIntensity = (t > 34 && t < 40.6) ? (Math.floor(t * 4) % 2 ? 3 : 0.3) : 1.5;

  // truck + pole from the physics bake
  const st = t - SIM0;
  const showTruck = st > -0.5 && t > 46;
  W.truck.cab.visible = W.truck.tr.visible = showTruck;
  for (const [g, k] of [[W.truck.cab, 'cab'], [W.truck.tr, 'tr'], [W.hitPole, 'pole']]) {
    const s = sampleCrash(crash, k, Math.max(0, st)); g.position.set(s[0], s[1], s[2]); g.quaternion.set(s[3], s[4], s[5], s[6]);
  }
  W.lights.truckHL.intensity = showTruck && st < crash.hitTime + 1.5 ? 120 : 0; W.headM.emissiveIntensity = showTruck && st < crash.hitTime + 1.5 ? 4 : 0.2;
  // wires follow the pole top; the ones on the hit pole snap and droop after the hit
  W.hitPole.updateMatrixWorld();
  const poleX = CRASH.pole[0], pz = CRASH.pole[1];
  W.wires.forEach(w => {
    const endP = x => x === poleX ? W.hitPole.localToWorld(v3(w.o, 8.55 - 4.5, 0)) : v3(x + w.o, 8.55, pz);
    let a = endP(w.a), b = endP(w.b), sag = 0.45;
    if ((w.a === poleX || w.b === poleX) && t > T_HIT + 0.2) {
      // snapped: the free end drops to the ground near the pole
      const drop = smooth((t - T_HIT - 0.2) / 0.8);
      const fixed = w.a === poleX ? b : a, free = w.a === poleX ? a : b;
      const ground = v3(lerp(free.x, fixed.x, 0.25), 0.05, free.z - 1.5 * Math.sign(w.o + 0.01));
      const f2 = free.clone().lerp(ground, drop);
      if (w.a === poleX) a = f2; else b = f2; sag = 0.45 + 1.5 * drop;
    }
    setWire(w.ln, a, b, sag);
  });

  // sparks: two bursts (impact at the transformer, then the wire hitting the ground)
  const pos = W.sparks.geometry.attributes.position; let anyS = false;
  const tf = W.hitPole.localToWorld(W.transformerLocal.clone());
  const bursts = [[T_HIT + 0.05, null], [T_BLACK, null], [T_HIT + 1.0, v3(poleX - 2, 0.1, pz - 1.5)]];
  W.sparkSeed.forEach((sd, i) => {
    const [bt, at] = bursts[i % 3]; const dt = t - bt - sd[3] * 0.25;
    if (dt > 0 && dt < 1.3) {
      const o = at || tf; const sp = 7 + sd[1] * 9;
      pos.setXYZ(i, o.x + sd[0] * sp * dt, Math.max(0.03, o.y + (2 + sd[1] * 5) * dt - 4.9 * dt * dt), o.z + sd[2] * sp * dt); anyS = true;
    } else pos.setXYZ(i, 0, -50, 0);
  });
  pos.needsUpdate = true; W.sparks.visible = anyS;
  const fl = t - T_BLACK; W.flashL.position.copy(tf);
  W.flashL.intensity = fl > 0 && fl < 0.5 ? 260 * (1 - fl / 0.5) * (hash(Math.floor(t * 30)) * 0.6 + 0.4) : (t - T_HIT > 0 && t - T_HIT < 0.2 ? 90 : 0);
  lens.uniforms.uFlash.value = fl > 0 && fl < 0.1 ? 0.22 * (1 - fl / 0.12) : 0;
  // fire by the jackknifed cab after the crash
  const fireOn = t > T_HIT + 1.2;
  W.fire.visible = fireOn; W.fireL.intensity = fireOn ? 30 * (0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3)) : 0;
  if (fireOn) { const c = sampleCrash(crash, 'cab', st); W.fire.position.set(c[0] - 1.2, 0, c[2] + 1.6); W.fireL.position.set(c[0] - 1.2, 1.4, c[2] + 1.6);
    W.fire.children.forEach((f, i) => { f.scale.y = 0.7 + 0.5 * Math.abs(Math.sin(t * (6 + i) + i)); }); }

  // reset cast
  [you, guest, owner, ...them].forEach(s => s.mesh.visible = false);
  flash.intensity = 0; flashGlow.visible = false;
}

// ---------- shots: one entry per voice line (times will snap to word timings) ----------
const L = (text) => text.split(' ').map(w => w.startsWith('*') ? { w: w.slice(1), k: 1 } : { w });
const SHOTS = [];
function shot(t0, t1, caps, fn, lensCfg = {}) { SHOTS.push({ t0, t1, caps, fn, lensCfg }); }
function lookCam(p, at, fov) { camera.position.copy(p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(at); }

function youAtDesk(pose = {}) {
  you.mesh.visible = true; you.mesh.position.set(-7.0, 0.1, 1.0);
  you.draw({ face: 0, hip: [0, 0.95], arms: [{ sh: -0.35, el: 0.6 }, { sh: 0.35, el: -0.6 }], legs: [{ th: -0.07, kn: 0 }, { th: 0.07, kn: 0 }], ...pose });
}

// 1 · opener: tight on your face, pull out through the window to the motel
shot(0, 4.2, [[0, 0.8, L('IMAGINE')], [0.8, 2.6, L('*11:58 *PM')], [2.6, 4.2, L('NIGHT CLERK')]], (lt, t) => {
  youAtDesk({ look: [0, 0.0] });
  const u = smooth(lt / 4.2) * 0.85 + 0.15 * (lt / 4.2);
  const path = new THREE.CatmullRomCurve3([v3(-7.0, 1.76, 1.6), v3(-7.05, 1.8, 3.0), v3(-7.1, 1.85, 4.6), v3(-5.2, 2.8, 10), v3(-3.8, 2.4, 17)]);
  const at = v3(-7.0, 1.76, 1.0).lerp(v3(-4.3, 4.4, 3.0), smooth(lt / 3.6));
  lookCam(path.getPoint(u), at, lerp(38, 62, smooth(lt / 3)));
});
// 3 · RULE 1 — macro on the desk lamp
shot(6.8, 9.6, [[0.9, 2.8, L('UNTIL *6 *AM')]], (lt) => {
  youAtDesk();
  lookCam(v3(-4.95 - lt * 0.05, 1.24, 2.15 + lt * 0.02), v3(-5.95, 1.38, 1.92), 44);
}, { exposure: 0.7, sticker: [1, [[{ w: 'LIGHT ON' }], [{ w: 'TILL' }, { w: '6 AM', k: 1 }]]] });
// 11 · the ninth door
shot(26.4, 29.6, [[0.3, 1.6, L('A *NINTH DOOR')], [1.6, 3.2, L('WASN\'T THERE')]], (lt, t) => {
  guest.mesh.visible = true; guest.mesh.position.set(28.2, 0, 0.85);
  guest.draw({ face: 'back', hip: [0, 0.94], arms: [{ sh: -0.12, el: 0.05 }, { sh: 0.12, el: -0.05 }], wet: t });
  lookCam(v3(24.9 + lt * 0.3, 1.5, 5.6 - lt * 0.3), v3(28.6, 1.4, 0.3), 52);
});
// 12 · POV: the phone lights up, Room 9
shot(29.6, 32.6, [[0.2, 1.4, L('2:10 AM')], [1.6, 3.0, L('*ROOM *9')]], (lt) => {
  youAtDesk();
  lookCam(v3(-7.15, 1.95, 1.25), v3(-7.35, 1.05, 1.95), 60);
}, { phone: true, dim: 0.5, blur: 10 });
// 21 · the pole comes down — from the upstairs balcony
shot(50.6, 52.6, [[0.15, 2.0, L('IT *HITS THE POLE')]], (lt) => {
  const sh = (t => Math.max(0, 1 - Math.abs(t - 0.2) * 2))(lt) * 0.06;
  lookCam(v3(16.0 + Math.sin(lt * 50) * sh, 4.75 + Math.cos(lt * 43) * sh, 0.7), v3(12.5, 2.6, 22.6), 62);
});
// 26 · peephole: he's wearing a red cap
shot(62.2, 64.0, [[0.25, 1.8, L('*RED CAP')]], (lt, t) => {
  owner.mesh.visible = true; owner.mesh.position.set(-4.45, 0.0, 5.05 - lt * 0.12);
  owner.draw({ face: 0, hip: [0, 0.93], lean: 0, headTilt: 0, look: [0, 0.0],
    arms: [{ hand: [-0.22, 1.28], bend: 1 }, { sh: 0.12, el: -0.05 }],
    props: [{ type: 'flashlight', hand: 0, angle: -Math.PI / 2 - 0.25 }, { type: 'gascan', hand: 1 }] });
  owner.face(camera); owner.mesh.updateMatrixWorld();
  const hand = owner.world([-0.2, 1.42]);
  flash.position.copy(hand); flash.target.position.copy(owner.world([0, 1.9])).add(v3(0, 0, -0.3)); flash.intensity = 6;
  flashGlow.position.copy(owner.world([-0.19, 1.5])); flashGlow.visible = true;
  lookCam(v3(-4.5, 1.62, 4.16), v3(-4.5, 1.72, 6.0), 96);
}, { fish: 0.85, circle: 0.535, vig: 0.2, chroma: 0.006 });

// default: a slow establishing drift (until every line has its own shot)
function fallback(t) { lookCam(v3(-4 + t * 0.05, 7, 20), v3(4, 1.5, 0), 60); }

function findShot(t) { return SHOTS.find(s => t >= s.t0 && t < s.t1); }

// ---------- the one entry point: pure function of time ----------
window.seek = (t) => {
  worldState(t);
  const s = findShot(t), lt = s ? t - s.t0 : 0;
  const cfg = { fish: 0, circle: 0, vig: 0.55, chroma: 0.0025, grain: 0.055, ...(s?.lensCfg || {}) };
  if (s) s.fn(lt, t); else fallback(t);
  [you, guest, owner, ...them].forEach(st => { if (st.mesh.visible) { st.face(camera); st.update(); } });
  lens.uniforms.uFish.value = cfg.fish; lens.uniforms.uCircle.value = cfg.circle; lens.uniforms.uVig.value = cfg.vig;
  lens.uniforms.uChroma.value = cfg.chroma; lens.uniforms.uGrain.value = cfg.grain; lens.uniforms.uSeed.value = Math.round(t * FPS) % 97;
  renderer.toneMappingExposure = cfg.exposure ?? 1.15;
  composer.render();
  ctx.save(); ctx.clearRect(0, 0, FW, FH);
  if (cfg.blur) ctx.filter = `blur(${cfg.blur}px)`;
  ctx.drawImage(renderer.domElement, 0, 0, FW, FH); ctx.filter = 'none';
  if (cfg.dim) { ctx.fillStyle = `rgba(0,0,0,${cfg.dim})`; ctx.fillRect(0, 0, FW, FH); }
  ctx.restore();
  if (cfg.phone) O.phonePOV(ctx, lt);
  if (cfg.sticker) O.sticker(ctx, cfg.sticker[0], cfg.sticker[1], lt);
  O.hud(ctx, 1, clockAt(t), t);
  if (s) for (const [a, b, words] of s.caps) if (lt >= a && lt < b) O.caption(ctx, words, lt - a, cfg.phone ? 470 : 1440);
};
window.SHOTS = SHOTS.map(s => [s.t0, s.t1]);
window.CRASH_INFO = { hit: crash.hitTime, SIM0, T_HIT };
window.ready = true;
