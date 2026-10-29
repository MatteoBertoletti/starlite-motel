import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildWorld, setWire } from './world.js';
import { Stick, walkPose } from './stick.js';
import { bakeCrash, sampleCrash, CRASH } from './physics.js';
import { LensShader } from './lens.js';
import * as O from './overlay.js';

const Q = new URLSearchParams(location.search);
const LANG = Q.get('lang') || 'en';
const LAND = Q.get('aspect') === '169';                   // 16:9 version
const FW = LAND ? 1920 : 1080, FH = LAND ? 1080 : 1920, FPS = 30;
const SCALE = parseFloat(Q.get('scale') || '1');          // preview renders at lower res
const out = document.getElementById('film'), ctx = out.getContext('2d');
out.width = FW; out.height = FH; out.style.width = FW + 'px'; out.style.height = FH + 'px';
O.setSize(FW, FH);

// ---------- fonts (local files only) ----------
const fonts = [
  new FontFace('Anton', 'url(./node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2)'),
  new FontFace('JBM', 'url(./node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2)', { weight: '700' }),
];
await Promise.all(fonts.map(f => f.load().then(ff => document.fonts.add(ff))));

// ---------- timing: real word times from the narration, or an estimate before it exists ----------
const SFX_ = LANG === 'en' ? '' : '_' + LANG;
const SCRIPT = await (await fetch(`./story/script${SFX_}.json`)).json();
let TIM = null;
try { const r = await fetch(`./story/timing${SFX_}.json`, { cache: 'no-store' }); if (r.ok) TIM = await r.json(); } catch (e) { }
if (!TIM) TIM = estimateTiming(SCRIPT);
function estimateTiming(S) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').replace(/'/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  let t = S.start_pad; const lines = [], caps = [];
  for (const L of S.lines) {
    const toks = norm(L.say), dur = 0.35 + toks.length * 0.3;
    const tokens = toks.map((w, i) => ({ w, s: t + 0.05 + i * 0.3, e: t + 0.3 + i * 0.3 }));
    let k = 0; const lc = L.caps.map(([a, text]) => { let j = toks.indexOf(a, k); if (j < 0) j = k; k = j + 1; return { text, t: tokens[j].s }; });
    lines.push({ id: L.id, who: L.who, start: t, end: t + dur, dur, tokens, caps: lc }); caps.push(...lc);
    t += dur + (L.gap ?? S.default_gap);
  }
  const duration = t + S.end_pad;
  caps.forEach((c, i) => c.end = Math.min(i + 1 < caps.length ? caps[i + 1].t : duration, c.t + 2.6));
  return { duration, lines, captions: caps, estimated: true };
}
const LN = id => TIM.lines.find(l => l.id === id);
const tok = (id, w, n = 0) => { const ts = LN(id).tokens.filter(x => x.w === w); return (ts[n] || ts[0] || LN(id).tokens[0]).s; };
const cut = id => id === 1 ? 0 : LN(id).start - 0.1;           // cut a hair before the voice
const AN = SCRIPT.anchors;
const tokA = (key, n = 0) => tok(AN[key][0], AN[key][1], n);
const DUR = TIM.duration;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(Math.round(FW * SCALE), Math.round(FH * SCALE), false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, FW / FH, 0.02, 400);
const W = buildWorld(scene, { lang: LANG });
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(FW * SCALE / 2, FH * SCALE / 2), 0.75, 0.55, 0.82));
composer.addPass(new OutputPass());
const lens = new ShaderPass(LensShader); composer.addPass(lens); lens.uniforms.uAspect.value = FW / FH;

// ---------- cast ----------
const you = new Stick({ cap: '#d8261f' });                               // the mark: a red cap
const guest = new Stick({ body: '#dfe4ea' });
const owner = new Stick({ cap: '#d8261f', body: '#e6e0d2' });
const them = Array.from({ length: 7 }, () => new Stick({ body: '#cfd6e2', emissive: 0.1, px: 150, W: 1.6, H: 2.6 }));
const CAST = [you, guest, owner, ...them];
CAST.forEach(s => scene.add(s.mesh));
window.CAST = { you, guest, owner };
const flash = new THREE.SpotLight(0xfff1d6, 0, 10, 0.5, 0.45, 2); flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -0.002; scene.add(flash, flash.target);
const flashGlow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(flashGlow);

// ---------- story events (all derived from word times) ----------
const crash = bakeCrash(12, 120);
const T_HIT = tokA('hits');
const SIM0 = T_HIT - crash.hitTime;
const T_BLACK = T_HIT + 0.45;
const T_LAMP_OUT = tokA('goes');
const T_R9 = cut(11);
const T_RING0 = tokA('phone'), T_PICK = tokA('picks');
const RING_P = (T_PICK - T_RING0) / 9;
const T_FLICK0 = tokA('flicker'), T_HOLD = tokA('holds');
const KNOCKS = [tokA('knock', 0), tokA('knock', 1)];
const T_GONE = tokA('gone'), T_REACH = tokA('reach');
const T_DOOR_IN = cut(7) + 0.2;                                  // the guest pushes the office door
const T_STEER = SIM0 + 1.6;

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, u) => a + (b - a) * u;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// lamp flicker: deterministic dark/bright pattern between "flicker" and "holds"
const FLICK_HZ = 7;
const lampDark = t => t > T_FLICK0 && t < T_HOLD && hash(Math.floor(t * FLICK_HZ)) < 0.38;
function darkCount(t) { let n = 0, prev = false; for (let x = T_FLICK0; x <= Math.min(t, T_HOLD); x += 1 / FLICK_HZ) { const d = lampDark(x + 0.001); if (d && !prev) n++; prev = d; } return n; }

// ---------- words on screen ----------
const STR = {
  en: { day: 'DAY 1', rule: n => `RULE ${n}`, lcdRing: 'INCOMING · LINE 1', lcdIdle: 'LINE 1', room: 'RM 9', impossible: 'IMPOSSIBLE',
        choiceTitle: 'WHAT DO YOU DO?', openA: 'OPEN IT', openB: 'get the light back', stayA: 'STAY IN THE DARK', stayB: 'with them', comment: 'COMMENT BELOW',
        follow: 'FOLLOW', forDay: 'FOR DAY 2', title: 'THE STARLITE MOTEL', h24: false,
        stick: { 1: [[{ w: 'LIGHT ON' }], [{ w: 'TILL' }, { w: '6 AM', k: 1 }]], 2: [[{ w: 'NO' }, { w: 'ROOM 9', k: 1 }]],
                 3: [[{ w: 'IF' }, { w: '9', k: 1 }, { w: 'CALLS' }], [{ w: 'LET IT RING' }]], 4: [[{ w: 'AFTER' }, { w: '3 AM', k: 1 }], [{ w: 'NEVER OPEN' }]] } },
  it: { day: 'GIORNO 1', rule: n => `REGOLA ${n}`, lcdRing: 'IN ARRIVO · LINEA 1', lcdIdle: 'LINEA 1', room: 'CAM 9', impossible: 'IMPOSSIBILE',
        choiceTitle: 'COSA FAI?', openA: 'APRI', openB: 'riaccendi la luce', stayA: 'RESTA AL BUIO', stayB: 'con loro', comment: 'COMMENTA QUI SOTTO',
        follow: 'SEGUI', forDay: 'PER IL GIORNO 2', title: 'LO STARLITE MOTEL', h24: true,
        stick: { 1: [[{ w: 'LUCE ACCESA' }], [{ w: 'FINO ALLE' }, { w: '6', k: 1 }]], 2: [[{ w: 'LA' }, { w: 'STANZA 9', k: 1 }], [{ w: 'NON ESISTE' }]],
                 3: [[{ w: 'SE CHIAMA LA' }, { w: '9', k: 1 }], [{ w: 'LASCIA SQUILLARE' }]], 4: [[{ w: 'DOPO LE' }, { w: '3', k: 1 }], [{ w: 'NON APRIRE' }]] } },
}[LANG];

// ---------- story clock ----------
const CLOCK = [[0, 1438], [cut(7), 1471], [cut(12), 1570], [cut(17), 1660], [cut(20), 1724], [DUR, 1732]];
function clockAt(t) {
  let m = CLOCK[0][1];
  for (let i = 0; i < CLOCK.length - 1; i++) {
    const [a, ma] = CLOCK[i], [b, mb] = CLOCK[i + 1];
    if (t >= a) { const hold = Math.max(a, b - 1.0), base = mb - ma > 6 ? Math.min(ma + (hold - a) / 5, mb) : 0;
      m = t >= b ? mb : (mb - ma <= 6 ? lerp(ma, mb, (t - a) / (b - a)) : (t < hold ? Math.min(ma + (t - a) / 5, mb) : lerp(base, mb, smooth((t - hold) / (b - hold))))); }
  }
  m = Math.floor(m) % 1440; const h = Math.floor(m / 60), mm = m % 60;
  if (STR.h24) return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ---------- world state: a pure function of t ----------
function worldState(t) {
  let lamp = 1;
  if (lampDark(t)) lamp = 0.05;
  if (t >= T_LAMP_OUT) lamp = 0;
  else if (t >= T_BLACK) lamp = (Math.floor(t * 14) % 3 === 0) ? 0.2 : 0.8;
  W.lights.lamp.intensity = 4.5 * lamp; W.lampBulbM.emissiveIntensity = 1.6 * lamp;

  const powerOut = t >= T_BLACK;
  W.doorLamps.forEach((d, i) => { const off = t >= T_BLACK + 0.25 + i * 0.06; d.lampM.emissiveIntensity = off ? 0 : 2.2; if (d.pt) d.pt.intensity = off ? 0 : 7; });
  W.doors.filter(d => d.floor === 1).forEach(d => d.lampM.emissiveIntensity = powerOut ? 0 : 0.9);
  W.streetLights.forEach(s => { const off = t >= T_BLACK + Math.abs(s.x - CRASH.pole[0]) / 60; s.hm.emissiveIntensity = off ? 0 : 3; s.L.intensity = off ? 0 : 700; });
  const neonOn = !(t >= T_BLACK + 0.15) || (t < T_BLACK + 0.7 && hash(Math.floor(t * 20)) > 0.6);
  W.neonStar.emissiveIntensity = neonOn ? 2.4 : 0; W.neonMotel.emissiveIntensity = neonOn ? 1.6 : 0; W.neonStarTop.emissiveIntensity = neonOn ? 3 : 0;
  W.neonVac.emissiveIntensity = neonOn ? 3 : 0; W.lights.neon.intensity = neonOn ? 14 : 0; W.lights.neon2.intensity = neonOn ? 8 : 0;
  W.offSign.material.emissiveIntensity = powerOut ? 0 : 1.2;
  W.porchM.emissiveIntensity = powerOut ? 0 : 2.2; W.lights.porch.intensity = powerOut ? 0 : 6; W.lights.kb.intensity = t >= T_LAMP_OUT ? 0 : 6;
  W.lights.moon.intensity = powerOut ? 1.7 : 1.25; W.lights.winFill.intensity = powerOut ? 45 : 30;

  // room 9: a wall until the guest walks to it
  const r9 = t >= T_R9;
  W.wall9.visible = !r9; W.room9.group.visible = r9;
  W.room9.curtM.emissive.setHex(0xff7a44); W.room9.curtM.emissiveIntensity = r9 ? (powerOut ? 0.6 : 0.9) : 0;   // room 9 stays lit in the blackout
  W.lights.r9.intensity = r9 ? 6 : 0;
  W.room9.plaque.material.emissiveIntensity = r9 ? 0.35 : 0;
  W.doors.forEach(d => { if (!d.slot9 && d.floor === 0) d.curtM.emissiveIntensity = (!powerOut && [2, 5].includes(d.num)) ? 0.5 : 0; });

  // phone + machine
  const ringing = t > T_RING0 && t < T_PICK, ringPh = ((t - T_RING0) / RING_P) % 1;
  W.phoneLedM.emissiveIntensity = ringing && ringPh < 0.55 ? 4 : 0;
  W.handset.position.y = 0.1 + (ringing && ringPh < 0.55 ? Math.abs(Math.sin(t * 60)) * 0.004 : 0);
  W.amLedM.emissiveIntensity = t > T_PICK && t < cut(17) ? (Math.floor(t * 4) % 2 ? 2 : 0.2) : 0.8;
  const spin = t > T_PICK && t < cut(17) ? (t - T_PICK) * 5 : 0;
  W.reels.forEach((r, i) => r.rotation.y = -spin * (i ? 1.3 : 1));

  // the card slides in on "slides", the hand withdraws on "rules"
  const l2 = LN(2), ts = tokA('slides'), tr = tokA('rules');
  const slide = smooth((t - ts + 0.1) / 0.7), back = smooth((t - tr) / 0.5);
  W.card.visible = t > l2.start - 1 && t < cut(12);
  W.card.position.x = lerp(-6.25, -6.9, slide); W.card.rotation.z = lerp(0.35, 0.06, slide);
  W.hand.visible = t > cut(2) - 0.2 && t < cut(3);
  W.hand.position.x = lerp(-5.9, -6.58, slide) + back * 0.8;

  // office door: the guest pushes it open, it swings shut behind him
  const dOpen = smooth((t - T_DOOR_IN) / 0.5) * (1 - smooth((t - (T_DOOR_IN + 1.6)) / 0.6));
  W.offDoor.rotation.y = 1.25 * dOpen;
  // knocks rattle the door
  let kick = 0; KNOCKS.forEach(k => { const d = t - k; if (d > 0 && d < 0.25) kick += Math.sin(d * 90) * 0.012 * (1 - d / 0.25); });
  W.offDoor.position.z = 4.1 + kick;

  // truck + pole from the physics bake
  const st = t - SIM0;
  const showTruck = st > -0.3 && t > cut(19);
  W.truck.cab.visible = W.truck.tr.visible = showTruck;
  for (const [g, k] of [[W.truck.cab, 'cab'], [W.truck.tr, 'tr'], [W.hitPole, 'pole']]) {
    const s = sampleCrash(crash, k, Math.max(0, st)); g.position.set(s[0], s[1], s[2]); g.quaternion.set(s[3], s[4], s[5], s[6]);
  }
  const hl = showTruck && st < crash.hitTime + 1.5;
  W.lights.truckHL.intensity = hl ? 120 : 0; W.headM.emissiveIntensity = hl ? 4 : 0.2;
  W.hitPole.updateMatrixWorld();
  const poleX = CRASH.pole[0], pz = CRASH.pole[1];
  W.wires.forEach(w => {
    const endP = x => x === poleX ? W.hitPole.localToWorld(v3(w.o, 8.55 - 4.5, 0)) : v3(x + w.o, 8.55, pz);
    let a = endP(w.a), b = endP(w.b), sag = 0.45;
    if ((w.a === poleX || w.b === poleX) && t > T_HIT + 0.2) {
      const drop = smooth((t - T_HIT - 0.2) / 0.8);
      const fixed = w.a === poleX ? b : a, free = w.a === poleX ? a : b;
      const ground = v3(lerp(free.x, fixed.x, 0.25), 0.05, free.z - 1.5 * Math.sign(w.o + 0.01));
      const f2 = free.clone().lerp(ground, drop);
      if (w.a === poleX) a = f2; else b = f2; sag = 0.45 + 1.5 * drop;
    }
    setWire(w.ln, a, b, sag);
  });
  // sparks: impact, transformer, wire on the ground
  const pos = W.sparks.geometry.attributes.position; let anyS = false;
  const tf = W.hitPole.localToWorld(W.transformerLocal.clone());
  const bursts = [[T_HIT + 0.05, null], [T_BLACK, null], [T_HIT + 1.0, v3(poleX - 2, 0.1, pz - 1.5)]];
  W.sparkSeed.forEach((sd, i) => {
    const [bt, at] = bursts[i % 3]; const dt = t - bt - sd[3] * 0.25;
    if (dt > 0 && dt < 1.3) { const o = at || tf, sp = 7 + sd[1] * 9;
      pos.setXYZ(i, o.x + sd[0] * sp * dt, Math.max(0.03, o.y + (2 + sd[1] * 5) * dt - 4.9 * dt * dt), o.z + sd[2] * sp * dt); anyS = true;
    } else pos.setXYZ(i, 0, -50, 0);
  });
  pos.needsUpdate = true; W.sparks.visible = anyS;
  const fl = t - T_BLACK; W.flashL.position.copy(tf);
  W.flashL.intensity = fl > 0 && fl < 0.5 ? 260 * (1 - fl / 0.5) * (hash(Math.floor(t * 30)) * 0.6 + 0.4) : (t - T_HIT > 0 && t - T_HIT < 0.2 ? 90 : 0);
  lens.uniforms.uFlash.value = fl > 0 && fl < 0.1 ? 0.22 * (1 - fl / 0.1) : 0;
  const fireOn = t > T_HIT + 1.2;
  W.fire.visible = fireOn; W.fireL.intensity = fireOn ? 30 * (0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3)) : 0;
  if (fireOn) { const c = sampleCrash(crash, 'cab', st); W.fire.position.set(c[0] - 1.2, 0, c[2] + 1.6); W.fireL.position.set(c[0] - 1.2, 1.4, c[2] + 1.6);
    W.fire.children.forEach((f, i) => { f.scale.y = 0.7 + 0.5 * Math.abs(Math.sin(t * (6 + i) + i)); }); }

  CAST.forEach(s => s.mesh.visible = false);
  flash.intensity = 0; flashGlow.visible = false;
  backgroundCast(t);
}

// people who exist in the world regardless of which shot is looking
function backgroundCast(t) {
  // you, behind the counter, all night
  you.mesh.visible = true; you.mesh.position.set(-7.0, 0.1, 1.0);
  you.pose = { face: 0, hip: [0, 0.95], arms: [{ sh: -0.35, el: 0.6 }, { sh: 0.35, el: -0.6 }], capOff: t >= T_GONE };
  // them: at the edge of the lot while the lamp flickers
  if (t > cut(17) - 0.2 && t < cut(20)) {
    const n = darkCount(t), retreat = smooth((t - T_HOLD) / 2.2);
    them.forEach((s, i) => {
      s.mesh.visible = true;
      const bx = -9.6 + i * 0.95 + (hash(i) - 0.5) * 0.5, bz = 20 + hash(i + 9) * 3;
      const z = bz - n * 2.7 + retreat * (n * 2.7 + 1.5); s.mesh.scale.setScalar(1.12);
      s.mesh.position.set(bx + (hash(i + 3) - 0.5) * n * 0.6, 0, z);
      s.pose = { face: 0, hip: [0, 1.05], lean: (hash(i + 5) - 0.5) * 0.1, headTilt: (hash(i + 7) - 0.5) * 0.4,
        arms: [{ sh: -0.08, el: 0.0 }, { sh: 0.08, el: 0.0 }], legs: [{ th: -0.06, kn: 0 }, { th: 0.06, kn: 0 }] };
    });
  }
  // the owner outside the office door, from the knocks on
  if (t > cut(23) - 0.2 && t < cut(28) + 10) {
    owner.mesh.visible = true; owner.mesh.position.set(-4.45, 0, 4.85);
    owner.pose = { face: 0, hip: [0, 0.93], arms: [{ hand: [-0.24, 0.98], bend: 1 }, { sh: 0.12, el: -0.05 }],
      props: [{ type: 'flashlight', hand: 0, angle: Math.PI * 0.5 }, { type: 'gascan', hand: 1 }] };
    owner.flashMode = 'door';
  }
}

// ---------- shots ----------
const PEEP = { fish: 0.85, circle: LAND ? 0.93 : 0.535, vig: 0.2, chroma: 0.006, exposure: 1.15 };
const SH = {};       // line id -> { fn(lt, t), lens }
const LANDK = 0.62;     // 16:9: vertical lens = portrait lens squeezed, so subjects stay the same size and we see more sideways
function lookCam(p, at, fov) { camera.position.copy(p); camera.fov = LAND ? 2 * Math.atan(Math.tan(fov * Math.PI / 360) * LANDK) * 180 / Math.PI : fov; camera.aspect = FW / FH; camera.updateProjectionMatrix(); camera.lookAt(at); }
const STICK = { 1: [1, STR.stick[1]], 2: [2, STR.stick[2]], 3: [3, STR.stick[3]], 4: [4, STR.stick[4]] };

// 1 · opener: tight on your face, pull out through the window
SH[1] = { fn: (lt) => {
  const D = cut(2);
  const u = smooth(lt / D) * 0.85 + 0.15 * (lt / D);
  const path = new THREE.CatmullRomCurve3([v3(-7.0, 1.76, 1.6), v3(-7.05, 1.8, 3.0), v3(-7.1, 1.85, 4.6), v3(-5.6, 2.6, 10.5), v3(-4.2, 2.6, 17.5)]);
  const at = v3(-7.0, 1.76, 1.0).lerp(v3(-4.0, 4.6, 3.0), smooth(lt / (D * 0.85)));
  lookCam(path.getPoint(Math.min(1, u)), at, lerp(38, 64, smooth(lt / (D * 0.7))));
} };
// 2 · the owner slides you a card — macro, top-down on the counter
SH[2] = { lens: { exposure: 0.9 }, fn: (lt, t) => {
  const r = tokA('rules') - cut(2);
  if (lt < r - 0.05) lookCam(v3(-6.75 - lt * 0.03, 1.72, 2.6), v3(-6.6, 1.06, 1.93), 44);
  else lookCam(v3(-6.9, 1.4 - (lt - r) * 0.03, 2.02), v3(-6.9, 1.06, 1.94), 40);   // the card itself
} };
// 3 · RULE 1 — macro on the desk lamp
SH[3] = { fn: (lt) => lookCam(v3(-4.95 - lt * 0.05, 1.24, 2.15 + lt * 0.02), v3(-5.95, 1.38, 1.92), 44), lens: { exposure: 0.7 }, sticker: STICK[1] };
// 4 · RULE 2 — the key board: hooks 1..8, a gap, 10
SH[4] = { fn: (lt) => lookCam(v3(-6.0, 1.7, -0.45 - lt * 0.12), v3(-6.0, 1.95, -1.98), 58), lens: { exposure: 1.3 }, sticker: STICK[2] };
// 5 · RULE 3 — the desk phone
SH[5] = { fn: (lt) => lookCam(v3(-7.0 - lt * 0.03, 1.42, 2.42 - lt * 0.05), v3(-7.33, 1.22, 1.85), 42), lens: { exposure: 1.1 }, sticker: STICK[3] };
// 6 · RULE 4 — low angle on the office door, light leaking under it
SH[6] = { fn: (lt) => lookCam(v3(-4.25, 0.32 + lt * 0.02, 2.6 - lt * 0.08), v3(-4.5, 1.15, 4.1), 62), lens: { exposure: 1.3 }, sticker: STICK[4] };
// 7 · 12:31 — the guest walks in, soaking wet (third person, wide inside the office)
SH[7] = { fn: (lt, t) => {
  const u = smooth(clamp01((t - T_DOOR_IN - 0.25) / 2.3));
  const p0 = v3(-4.5, 0.1, 5.0), p1 = v3(-5.6, 0.1, 2.75);
  guest.mesh.visible = true; guest.mesh.position.copy(p0.clone().lerp(p1, u));
  lookCam(v3(-8.6 + lt * 0.05, 1.65, 0.0), v3(-5.0, 1.15, 3.6), 58);
  const k = p1.clone().sub(p0).normalize().dot(v3(1, 0, 0).applyQuaternion(camera.quaternion));
  guest.pose = u < 1 ? { ...walkPose(p0.distanceTo(p1) * u, Math.abs(k) < 0.35 ? 0.35 * Math.sign(k || -1) : k), wet: t }
                     : { face: 0, hip: [0, 0.94], arms: [{ sh: -0.1, el: 0 }, { sh: 0.1, el: 0 }], wet: t };
}, lens: { exposure: 1.3 } };
// 8 · he wants Room 9 — close on his face over the counter
SH[8] = { fn: (lt, t) => {
  guest.mesh.visible = true; guest.mesh.position.set(-6.6, 0.1, 2.75);
  guest.pose = { face: 0, hip: [0, 0.94], arms: [{ sh: -0.1, el: 0 }, { hand: [0.32, 1.05], bend: -1 }], wet: t, look: [0, -0.01] };
  lookCam(v3(-6.85, 1.78, 1.55 + lt * 0.09), v3(-6.6, 1.85, 2.75), 40);
}, lens: { exposure: 1.4 } };
// 9 · "We're full." — your reaction
SH[9] = { fn: (lt, t) => {
  you.pose = { ...you.pose, look: [0.02, 0], headTilt: -0.05 };
  lookCam(v3(-7.0 + lt * 0.02, 1.82, 2.25 - lt * 0.06), v3(-7.0, 1.82, 1.0), 38);
}, lens: { exposure: 1.4 } };
// 10 · he walks out, down the row — from the upstairs walkway
SH[10] = { fn: (lt, t) => {
  const D = cut(11) - cut(10), u = clamp01(lt / D);
  const x0 = 15.5, x1 = 15.5 + 1.25 * D, x = lerp(x0, x1, u);
  guest.mesh.visible = true; guest.mesh.position.set(x, 0, 2.7);
  lookCam(v3(12.0 + lt * 0.7, 4.6, 7.2), v3(x + 1.4, 0.9, 2.7), 50);
  const right = v3(1, 0, 0).applyQuaternion(camera.quaternion);
  guest.pose = { ...walkPose((x - x0), right.x), wet: t };
}, lens: { exposure: 1.2 } };
// 11 · the ninth door
SH[11] = { fn: (lt, t) => {
  guest.mesh.visible = true; guest.mesh.position.set(28.2, 0, 0.85);
  guest.pose = { face: 'back', hip: [0, 0.94], arms: [{ sh: -0.12, el: 0.05 }, { sh: 0.12, el: -0.05 }], wet: t };
  const u = smooth(clamp01((t - tokA('hour')) / 1.4));
  lookCam(v3(lerp(24.9, 27.2, u) + lt * 0.15, lerp(1.5, 1.66, u), lerp(5.6, 2.2, u) - lt * 0.1), v3(lerp(28.6, 28.2, u), lerp(1.4, 1.64, u), 0.3), lerp(52, 30, u));
} };
// 12 · POV: the phone lights up — Room 9
SH[12] = { fn: () => lookCam(v3(-7.15, 1.95, 1.25), v3(-7.35, 1.05, 1.95), 60), lens: { phone: true, dim: 0.5, blur: 10 } };
// 13 · you let it ring — thumbs pull away
SH[13] = { fn: () => lookCam(v3(-7.15, 1.95, 1.25), v3(-7.35, 1.05, 1.95), 60), lens: { phone: true, dim: 0.55, blur: 10, pull: true } };
// 14 · nine rings, then the machine picks up — macro on the tape
SH[14] = { fn: (lt) => lookCam(v3(-7.85 - lt * 0.03, 1.32, 2.3 - lt * 0.04), v3(-8.13, 1.12, 1.84), 40), lens: { exposure: 1.5 } };
// 15 · the voice on the tape is yours — your face, slow push, dutch
SH[15] = { fn: (lt, t) => {
  you.pose = { ...you.pose, headTilt: 0.06, arms: [{ sh: -0.2, el: 1.6 }, { sh: 0.35, el: -0.6 }] };
  lookCam(v3(-7.0, 1.84, 2.1 - lt * 0.22), v3(-7.0, 1.84, 1.0), 36); camera.rotateZ(0.08 + lt * 0.02);
}, lens: { exposure: 1.4, vig: 0.75 } };
// 16 · tape: "Don't let him in." — zoom through your window: he is outside room 9, looking at you
SH[16] = { fn: (lt, t) => {
  guest.mesh.visible = true; guest.mesh.position.set(28.2, 0, 1.4);
  guest.pose = { face: 0, hip: [0, 0.94], arms: [{ sh: -0.06, el: 0 }, { sh: 0.06, el: 0 }] };
  lookCam(v3(-3.6, 1.6, 1.0), v3(28.2, 1.15, 1.4), lerp(8, 5.5, smooth(lt / 2)));
}, lens: { exposure: 1.6, chroma: 0.006 } };
// 17 · 3:40 — the lamp flickers; something waits at the edge of the lot
SH[17] = { fn: (lt) => lookCam(v3(-7.75, 1.45, 0.2 + lt * 0.05), v3(-6.6, 1.35, 4.2), 56), lens: { exposure: 1.3 } };
// 18 · every time it goes dark, they're closer — POV through the window
SH[18] = { fn: (lt) => lookCam(v3(-7.75, 1.66, 3.6), v3(-6.8, 1.2, 18), 34), lens: { exposure: 1.6 } };
// 19 · when it holds, they back away
SH[19] = { fn: (lt) => lookCam(v3(-7.75, 1.66, 3.6 + lt * 0.04), v3(-6.8, 1.2, 18), 34 + lt * 3), lens: { exposure: 1.6 } };
// 20 · 4:44 — a truck takes the bend too fast (from the balcony, following it)
SH[20] = { fn: (lt, t) => {
  const c = sampleCrash(crash, 'cab', Math.max(0, t - SIM0));
  const tgt = v3(c[0], 1.2, c[2]).lerp(v3(CRASH.pole[0], 2.5, CRASH.pole[1]), 0.35);
  lookCam(v3(20.5, 4.75, 0.8), tgt, 56);
} };
// 21 · it hits the pole
SH[21] = { fn: (lt) => {
  const sh = Math.max(0, 1 - Math.abs(lt - (T_HIT - cut(21)) - 0.15) * 2) * 0.06;
  lookCam(v3(16.0 + Math.sin(lt * 50) * sh, 4.75 + Math.cos(lt * 43) * sh, 0.7), v3(12.5, 2.6, 22.6), 62);
} };
// 22 · and your light goes out
SH[22] = { fn: (lt) => lookCam(v3(-6.25, 1.55, 2.75 - lt * 0.05), v3(-6.9, 1.45, 1.0), 50), lens: { exposure: 1.5 }, broken: true };
// 23 · knock, knock — low on the door: a flashlight under the gap, two feet
SH[23] = { fn: (lt) => lookCam(v3(-4.42, 0.16, 3.25), v3(-4.5, 0.2, 4.1), 52), lens: { exposure: 1.7 } };
// 24 · "It's the owner…" — the mail slot, light pushing through
SH[24] = { fn: (lt) => { owner.flashMode = 'slot'; lookCam(v3(-4.52 + lt * 0.02, 1.06, 3.3 + lt * 0.12), v3(-4.5, 1.0, 4.1), 46); }, lens: { exposure: 1.6 } };
// 25 · through the peephole: the owner with a gas can
SH[25] = { fn: (lt, t) => { owner.flashMode = 'face'; owner.mesh.position.set(-4.45, 0, 6.1 - lt * 0.35); owner.pose = ownerPeep(0); peepCam(); }, lens: PEEP };
// 26 · he's wearing a red cap
SH[26] = { fn: (lt, t) => { owner.flashMode = 'face'; owner.mesh.position.set(-4.45, 0, 5.05 - lt * 0.12); owner.pose = ownerPeep(lt); peepCam(); }, lens: PEEP };
// 27 · you reach for yours — it's gone
SH[27] = { fn: (lt, t) => {
  const up = smooth((t - T_REACH) / 0.5);
  you.pose = { ...you.pose, look: [0, 0.01], arms: [{ sh: -0.35, el: 0.6 }, { hand: [lerp(0.4, 0.06, up), lerp(0.75, 1.98, up)], bend: -1 }] };
  lookCam(v3(-7.0, 1.82, 2.15 - lt * 0.05), v3(-7.0, 1.82, 1.0), 40);
}, lens: { exposure: 1.6 } };
// 28 · the choice
SH[28] = { fn: (lt, t) => { owner.flashMode = 'face'; owner.mesh.position.set(-4.45, 0, 4.95); owner.pose = ownerPeep(2); peepCam(); }, lens: { ...PEEP }, choice: true };
// 29 · end card
SH[29] = { fn: (lt, t) => { owner.flashMode = 'face'; owner.mesh.position.set(-4.45, 0, 4.9); owner.pose = ownerPeep(2.5); peepCam(); }, lens: { ...PEEP }, end: true };

function ownerPeep(lt) {
  return { face: 0, hip: [0, 0.93], headTilt: Math.min(0.18, lt * 0.12), look: [0, 0],
    arms: [{ hand: [-0.22, 1.28], bend: 1 }, { sh: 0.12, el: -0.05 }],
    props: [{ type: 'flashlight', hand: 0, angle: -Math.PI / 2 - 0.25 }, { type: 'gascan', hand: 1 }] };
}
function peepCam() { lookCam(v3(-4.5, 1.62, 4.16), v3(-4.5, 1.72, 6.0), 96); }

// ---------- the one entry point: a pure function of time ----------
const ORDER = TIM.lines.map(l => l.id);
function shotAt(t) { let id = ORDER[0]; for (const i of ORDER) if (t >= cut(i)) id = i; return id; }

window.seek = (t) => {
  worldState(t);
  const id = shotAt(t), s = SH[id] || SH[1], lt = t - cut(id);
  s.fn(lt, t);
  const cfg = { fish: 0, circle: 0, vig: 0.55, chroma: 0.0025, grain: 0.055, exposure: 1.15, ...(s.lens || {}) };
  // the owner's flashlight: at the door (light under the gap) or up at his face (peephole)
  if (owner.mesh.visible) {
    owner.face(camera); owner.mesh.updateMatrixWorld();
    if (owner.flashMode === 'face') {
      flash.position.copy(owner.world([-0.2, 1.42])); flash.target.position.copy(owner.world([0, 1.9])).add(v3(0, 0, -0.3)); flash.intensity = 6;
      flashGlow.position.copy(owner.world([-0.19, 1.5])); flashGlow.visible = true;
    } else if (owner.flashMode === 'slot') {
      flash.position.set(-4.4, 1.3, 5.2); flash.target.position.set(-4.5, 0.9, 3.0); flash.intensity = 3;
    } else {
      flash.position.set(-4.35, 0.75, 5.3); flash.target.position.set(-4.5, 0.0, 3.6); flash.intensity = 40;
    }
  }
  for (const st of CAST) if (st.mesh.visible) { st.face(camera); st.draw(st.pose || {}); st.update(); }
  lens.uniforms.uFish.value = cfg.fish; lens.uniforms.uCircle.value = cfg.circle; lens.uniforms.uVig.value = cfg.vig;
  lens.uniforms.uChroma.value = cfg.chroma; lens.uniforms.uGrain.value = cfg.grain; lens.uniforms.uSeed.value = Math.round(t * FPS) % 97;
  renderer.toneMappingExposure = cfg.exposure;
  composer.render();

  ctx.save(); ctx.clearRect(0, 0, FW, FH);
  if (cfg.blur) ctx.filter = `blur(${cfg.blur}px)`;
  ctx.drawImage(renderer.domElement, 0, 0, FW, FH); ctx.filter = 'none';
  if (cfg.dim) { ctx.fillStyle = `rgba(0,0,0,${cfg.dim})`; ctx.fillRect(0, 0, FW, FH); }
  ctx.restore();
  if (cfg.phone) {
    const ringing = t > T_RING0 && t < T_PICK;
    O.phonePOV(ctx, t - T_RING0, { ring: ringing && ((t - T_RING0) / RING_P) % 1 < 0.55, rings: Math.min(9, Math.max(1, Math.ceil((t - T_RING0) / RING_P))), pull: cfg.pull ? smooth(lt / 0.6) : 0,
      lcdRing: STR.lcdRing, lcdIdle: STR.lcdIdle, label: STR.room });
  }
  const SY = LAND ? 300 : 470, SS = LAND ? 0.62 : 1;
  if (s.sticker) O.sticker(ctx, STR.rule(s.sticker[0]), s.sticker[1], lt, SY, -0.07, SS);
  if (s.broken) O.brokenSticker(ctx, t - T_LAMP_OUT, STR, SY, SS);
  const showHud = !s.choice && !s.end;
  if (showHud) O.hud(ctx, STR.day, clockAt(t), t);
  if (s.choice) O.choice(ctx, lt, STR);
  if (s.end) O.endCard(ctx, lt, STR);
  if (!s.choice && !s.end) {
    const c = TIM.captions.find(c => t >= c.t && t < c.end);
    if (c) {
      const words = c.text.split(' ').map(w => w.startsWith('*') ? { w: w.slice(1), k: 1 } : { w });
      O.caption(ctx, words, t - c.t, LAND ? (cfg.phone ? 150 : 960) : (cfg.phone ? 470 : (s.sticker ? 1500 : 1440)), LAND ? 112 : 132);
    }
  }
};

// events for the sound mix (one sound per event), read by the renderer and saved next to the frames
window.EVENTS = {
  duration: DUR, estimated: !!TIM.estimated,
  stickers: [3, 4, 5, 6].map(i => cut(i)), slide: tokA('slides'), doorShut: tokA('rules') + 0.4,
  doorIn: T_DOOR_IN, doorClose: T_DOOR_IN + 2.0, steps10: [cut(10), cut(11)],
  ringStart: T_RING0, ringPeriod: RING_P, rings: 9, pick: T_PICK, tapeSpan: [T_PICK, cut(17)],
  flicker: [T_FLICK0, T_HOLD], steer: T_STEER, truckIn: SIM0, hit: T_HIT, blackout: T_BLACK, lampOut: T_LAMP_OUT,
  knocks: KNOCKS, peep: cut(25), capGone: T_GONE, choice: cut(28), end: cut(29), r9: T_R9,
  cuts: ORDER.map(cut),
  darkOnsets: (() => { const o = []; let prev = false; for (let x = T_FLICK0; x <= T_HOLD; x += 1 / FLICK_HZ) { const d = lampDark(x + 0.001); if (d && !prev) o.push(Math.floor((x + 0.001) * FLICK_HZ) / FLICK_HZ); prev = d; } return o; })(),
};
window.SHOTS = ORDER.map(i => [i, cut(i)]);
window.ready = true;
