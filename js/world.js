// The Starlite Motel: low-poly sets, real lights, real shadows.
import * as THREE from 'three';
import { CRASH } from './physics.js';

export const PAL = {
  sky: 0x070b16, fog: 0x0a1120,
  asphalt: 0x24272c, dirt: 0x1d2119, line: 0xbdb59c,
  wall: 0xb4a78c, trim: 0x5b2a2a, door: 0x2c5658, roof: 0x3a2f2c,
  panel: 0x5a4130, floor: 0x3b403c, counter: 0x6a4a33, top: 0x8a7a5e,
  amber: 0xffad55, cold: 0x7f9fe0, red: 0xff2a2a,
};

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...o });
const E = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 1 });

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(rt, rb, h, seg, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
// seeded RNG so every load builds the identical world
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function textTex(draw, w = 256, h = 256) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function noiseTex(base, amp, seed, size = 256, rep = 1) {
  const r = rng(seed);
  const t = textTex((c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h * 0.25; i++) { const v = (r() - 0.5) * amp; c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; c.fillRect(r() * w, r() * h, 2, 2); }
  }, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}

export function buildWorld(scene) {
  const W = { lights: {}, groups: {}, mats: {}, doors: [], streetLights: [], doorLamps: [] };
  scene.background = new THREE.Color(PAL.sky);
  scene.fog = new THREE.FogExp2(PAL.fog, 0.011);

  // ---------- lights: cold moon fill (shadows), dim hemisphere ----------
  const hemi = new THREE.HemisphereLight(0x2a3c66, 0x0b0c10, 0.55); scene.add(hemi); W.lights.hemi = hemi;
  const moon = new THREE.DirectionalLight(PAL.cold, 1.25);
  moon.position.set(-18, 34, 52); moon.target.position.set(4, 0, 8);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target); W.lights.moon = moon;

  // ---------- ground ----------
  const ground = new THREE.Group(); scene.add(ground);
  const asphalt = M(0xffffff, { map: noiseTex('#26292e', 0.18, 7, 256, 14), roughness: 0.95 });
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), asphalt); lot.rotation.x = -Math.PI / 2; lot.position.set(10, 0, 9.5); lot.receiveShadow = true; ground.add(lot);
  const dirtM = M(0xffffff, { map: noiseTex('#1c2018', 0.25, 9, 256, 40) });
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), dirtM); dirt.rotation.x = -Math.PI / 2; dirt.position.y = -0.02; dirt.receiveShadow = true; ground.add(dirt);
  const hw = new THREE.Mesh(new THREE.PlaneGeometry(260, 8.6), M(0xffffff, { map: noiseTex('#1f2125', 0.15, 11, 256, 20) }));
  hw.rotation.x = -Math.PI / 2; hw.position.set(10, 0.01, 28.7); hw.receiveShadow = true; ground.add(hw);
  const lineM = M(PAL.line, { roughness: 0.7 }), yel = M(0xc9a23a, { roughness: 0.7 });
  for (let x = -120; x < 140; x += 6) { const d = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.15), yel); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, 28.7); d.receiveShadow = true; ground.add(d); }
  [24.6, 32.8].forEach(z => { const e = new THREE.Mesh(new THREE.PlaneGeometry(260, 0.15), lineM); e.rotation.x = -Math.PI / 2; e.position.set(10, 0.02, z); ground.add(e); });
  for (let i = 0; i <= 10; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5), lineM); s.rotation.x = -Math.PI / 2; s.position.set(0.15 + i * 3.3, 0.015, 4.5); s.receiveShadow = true; ground.add(s); }

  // ---------- motel row (2 floors, rooms 1-8, [9], 10 / 11-20) ----------
  const row = new THREE.Group(); scene.add(row); W.groups.row = row;
  const wallM = M(PAL.wall), trimM = M(PAL.trim), doorM = M(PAL.door), roofM = M(PAL.roof), darkM = M(0x111316);
  box(34, 6.4, 8, wallM, 17, 3.2, -4, row);                       // main mass (front face at z=0)
  box(34.6, 0.5, 9.0, roofM, 17, 6.65, -3.6, row);                // roof slab
  box(34.6, 0.25, 2.0, M(0x4a4440), 17, 3.1, 1.0, row);           // balcony slab / ground-floor canopy
  box(34.6, 0.18, 0.12, trimM, 17, 3.0, 2.0, row);
  for (let i = 0; i <= 10; i++) box(0.18, 3.0, 0.18, trimM, 0.15 + i * 3.3, 1.5, 1.85, row); // posts, on the stall lines
  box(34.4, 0.08, 0.08, trimM, 17, 4.25, 1.9, row);               // rail
  box(34.4, 0.06, 0.06, trimM, 17, 3.7, 1.9, row);
  for (let x = 0.3; x < 34; x += 0.42) box(0.04, 1.0, 0.04, trimM, x, 3.75, 1.9, row, false);
  // stairs at the east end
  for (let k = 0; k < 14; k++) box(1.4, 0.2, 0.32, M(0x4a4440), 34.9, 0.1 + k * 0.22, 1.6 - k * 0.0 + 0, row).position.set(35.0, 0.12 + k * 0.226, 4.6 - k * 0.3);

  const numTex = n => textTex((c, w, h) => { c.fillStyle = '#b8924a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1208'; c.font = 'bold 190px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, h / 2 + 10); }, 256, 256);
  const curtainTex = textTex((c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#d9c39a' : '#a8916b'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128, 128);
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 10; i++) {
    const num = fl === 0 ? (i < 8 ? i + 1 : (i === 8 ? 9 : 10)) : 11 + i;
    const g = new THREE.Group(); g.position.set(1.8 + 3.3 * i, fl * 3.25, 0); row.add(g);
    const door = box(1.0, 2.1, 0.08, doorM, 0, 1.05, 0.04, g);
    box(1.16, 0.08, 0.1, trimM, 0, 2.14, 0.05, g); box(0.08, 2.14, 0.1, trimM, -0.58, 1.07, 0.05, g); box(0.08, 2.14, 0.1, trimM, 0.58, 1.07, 0.05, g);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: numTex(num), roughness: 0.4, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 })); plaque.material.emissiveMap = plaque.material.map;
    plaque.position.set(0, 1.65, 0.09); g.add(plaque);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0xb8924a, { metalness: 0.8, roughness: 0.3 })); knob.position.set(0.38, 1.0, 0.11); g.add(knob);
    // window = frame around a recess, curtain behind
    const curtM = new THREE.MeshStandardMaterial({ map: curtainTex, color: 0x6b604f, emissive: 0xffb36a, emissiveMap: curtainTex, emissiveIntensity: 0, roughness: 1 });
    const curt = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.0), curtM); curt.position.set(1.35, 1.55, 0.005); g.add(curt);
    box(1.26, 0.08, 0.1, trimM, 1.35, 2.08, 0.05, g); box(1.26, 0.08, 0.1, trimM, 1.35, 1.02, 0.05, g);
    box(0.08, 1.14, 0.1, trimM, 0.76, 1.55, 0.05, g); box(0.08, 1.14, 0.1, trimM, 1.94, 1.55, 0.05, g); box(0.05, 1.0, 0.06, trimM, 1.35, 1.55, 0.04, g);
    // wall lamp
    const lampM = E(0xffc27a, fl === 0 ? 2.2 : 0.9);
    box(0.16, 0.22, 0.1, darkM, -0.8, 2.35, 0.06, g, false);
    const bulb = box(0.12, 0.16, 0.06, lampM, -0.8, 2.35, 0.12, g, false);
    const rec = { group: g, num, floor: fl, door, plaque, curtM, lampM, bulb };
    W.doors.push(rec); if (fl === 0) W.doorLamps.push(rec);
    if (fl === 0 && i === 8) { rec.slot9 = true; W.room9 = rec; }
  }
  // the wall that hides room 9 most of the night
  W.wall9 = box(3.1, 3.0, 0.14, wallM, 1.8 + 3.3 * 8 + 0.6, 1.5, 0.07, row);
  // a few warm pools of light along the ground floor (no shadows: cheap)
  [1, 4, 7, 8, 9].forEach(i => { const L = new THREE.PointLight(PAL.amber, 7, 7, 2); L.position.set(1.0 + 3.3 * i, 2.5, 0.7); row.add(L); W.doors[i].pt = L; });
  // room 9 behind-the-curtain glow
  const r9L = new THREE.PointLight(0xff6a3a, 0, 5, 2); r9L.position.set(1.8 + 3.3 * 8 + 1.35, 1.6, 0.9); row.add(r9L); W.lights.r9 = r9L;

  // ---------- office (x -9..-3, z -2..4) ----------
  const off = new THREE.Group(); scene.add(off); W.groups.office = off;
  const panelM = M(PAL.panel), floorM = M(0xffffff, { map: textTex((c, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#3d4440' : '#5a5e55'; c.fillRect(x * w / 8, y * h / 8, w / 8, h / 8); } }, 256, 256) });
  floorM.map.wrapS = floorM.map.wrapT = THREE.RepeatWrapping; floorM.map.repeat.set(3, 3);
  const extM = M(PAL.wall);
  box(6, 0.1, 6, floorM, -6, 0.05, 1, off);
  box(6.4, 0.3, 6.4, roofM, -6, 3.35, 1, off);
  box(0.2, 3.2, 6, panelM, -9.1, 1.6, 1, off); box(0.2, 3.2, 6, panelM, -2.9, 1.6, 1, off); box(6, 3.2, 0.2, panelM, -6, 1.6, -2.1, off);
  // front wall at z=4 with a real window hole (-8.4..-5.8, 0.9..2.5) and a door hole (-5.0..-4.0, 0..2.15)
  const fw = (x0, x1, y0, y1) => box(x1 - x0, y1 - y0, 0.2, panelM, (x0 + x1) / 2, (y0 + y1) / 2, 4.1, off);
  fw(-9.2, -8.4, 0, 3.2); fw(-5.8, -5.0, 0, 3.2); fw(-4.0, -2.8, 0, 3.2);
  fw(-8.4, -5.8, 0, 0.9); fw(-8.4, -5.8, 2.5, 3.2); fw(-5.0, -4.0, 2.15, 3.2);
  // exterior skin & trim
  const sk = (x0, x1, y0, y1) => box(x1 - x0, y1 - y0, 0.04, extM, (x0 + x1) / 2, (y0 + y1) / 2, 4.22, off);
  sk(-9.2, -8.4, 0, 3.2); sk(-5.8, -5.0, 0, 3.2); sk(-4.0, -2.8, 0, 3.2); sk(-8.4, -5.8, 0, 0.9); sk(-8.4, -5.8, 2.5, 3.2); sk(-5.0, -4.0, 2.15, 3.2);
  [[-8.4, -5.8, 0.9, 2.5]].forEach(([a, b, y0, y1]) => {
    box(b - a + 0.16, 0.08, 0.3, trimM, (a + b) / 2, y0, 4.1, off); box(b - a + 0.16, 0.08, 0.3, trimM, (a + b) / 2, y1, 4.1, off);
    box(0.08, y1 - y0, 0.3, trimM, a, (y0 + y1) / 2, 4.1, off); box(0.08, y1 - y0, 0.3, trimM, b, (y0 + y1) / 2, 4.1, off);
    box(0.05, y1 - y0, 0.06, trimM, (a + b) / 2, (y0 + y1) / 2, 4.1, off);
  });
  box(0.08, 2.2, 0.3, trimM, -5.04, 1.1, 4.1, off); box(0.08, 2.2, 0.3, trimM, -3.96, 1.1, 4.1, off); box(1.16, 0.08, 0.3, trimM, -4.5, 2.19, 4.1, off);
  // office door with peephole + mail slot
  const offDoor = new THREE.Group(); offDoor.position.set(-4.98, 0, 4.1); off.add(offDoor); W.offDoor = offDoor;
  box(0.96, 2.12, 0.07, M(0x3f2c22), 0.48, 1.07, 0, offDoor);
  const ph = cyl(0.03, 0.03, 0.09, 12, M(0xb8924a, { metalness: 0.8, roughness: 0.3 }), 0.48, 1.62, 0, offDoor); ph.rotation.x = Math.PI / 2;
  box(0.34, 0.07, 0.09, M(0xb8924a, { metalness: 0.8, roughness: 0.3 }), 0.48, 1.0, 0, offDoor);
  box(0.24, 0.025, 0.1, darkM, 0.48, 1.0, 0, offDoor, false);
  // OFFICE sign over the door
  const offSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.2,
    emissiveMap: textTex((c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.font = 'bold 90px sans-serif'; c.fillStyle = '#ffcf8a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('OFFICE', w / 2, h / 2 + 4); }, 512, 128) }));
  offSign.position.set(-4.5, 2.7, 4.26); off.add(offSign); W.offSign = offSign;

  // interior: counter, lamp, phone, answering machine, bell, key board
  const counter = new THREE.Group(); off.add(counter);
  box(3.4, 1.0, 0.6, M(PAL.counter), -7.0, 0.5, 1.9, counter);
  box(3.6, 0.06, 0.75, M(PAL.top, { roughness: 0.6 }), -7.0, 1.03, 1.88, counter);
  const lamp = new THREE.Group(); lamp.position.set(-5.95, 1.06, 1.95); counter.add(lamp); W.lamp = lamp;
  cyl(0.11, 0.13, 0.04, 12, M(0x2b2420, { metalness: 0.6 }), 0, 0.02, 0, lamp);
  const arm = cyl(0.015, 0.015, 0.42, 6, M(0x2b2420, { metalness: 0.6 }), 0, 0.23, 0, lamp);
  const shade = cyl(0.07, 0.17, 0.18, 14, M(0x1d4a3a, { roughness: 0.5, side: THREE.DoubleSide }), 0, 0.47, 0, lamp); shade.castShadow = true;
  shade.material = M(0x1d4a3a, { roughness: 0.5, side: THREE.DoubleSide });
  W.lampBulbM = E(0xffd9a0, 4);
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), W.lampBulbM); bulbMesh.position.set(0, 0.4, 0); lamp.add(bulbMesh);
  const lampL = new THREE.PointLight(0xffa24f, 9, 12, 2); lampL.position.set(-5.95, 1.42, 1.95); lampL.castShadow = true;
  lampL.shadow.mapSize.set(1024, 1024); lampL.shadow.bias = -0.002; lampL.shadow.radius = 3; off.add(lampL); W.lights.lamp = lampL;
  // desk phone
  const phone = new THREE.Group(); phone.position.set(-7.35, 1.06, 1.85); counter.add(phone); W.phone = phone;
  box(0.36, 0.08, 0.26, M(0xcabd9f), 0, 0.04, 0, phone); box(0.34, 0.06, 0.08, M(0xbfb294), 0, 0.11, -0.07, phone);
  W.phoneLedM = E(0xff2020, 0); box(0.04, 0.02, 0.04, W.phoneLedM, 0.12, 0.09, 0.07, phone, false);
  // answering machine
  const am = new THREE.Group(); am.position.set(-8.15, 1.06, 1.85); counter.add(am); W.am = am;
  box(0.3, 0.08, 0.22, M(0x1d1f22), 0, 0.04, 0, am); W.amLedM = E(0xff2020, 1.5); box(0.03, 0.02, 0.03, W.amLedM, 0.1, 0.085, 0.07, am, false);
  // bell
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xc9a24a, { metalness: 0.9, roughness: 0.25 })); bell.position.set(-6.6, 1.06, 2.05); bell.castShadow = true; counter.add(bell);
  // key board on back wall: hooks 1-8, gap, 10
  const kb = new THREE.Group(); kb.position.set(-6.4, 1.9, -1.98); off.add(kb); W.keyBoard = kb;
  box(2.0, 0.9, 0.04, M(0x3a2a1e), 0, 0, 0, kb);
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  W.keyTags = {};
  nums.forEach((n, i) => {
    const x = -0.81 + (i % 5) * 0.405, y = i < 5 ? 0.2 : -0.22;
    box(0.02, 0.02, 0.06, M(0xb8924a, { metalness: 0.8 }), x, y + 0.12, 0.04, kb, false);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.015), new THREE.MeshStandardMaterial({ map: numTex(n), roughness: 0.5, metalness: 0.4 }));
    tag.position.set(x, y, 0.06); tag.castShadow = true; kb.add(tag); W.keyTags[n] = tag;
  });
  W.keyTags[9].visible = false;
  // cold window fill inside the office (night shots go black after compression)
  const winFill = new THREE.SpotLight(0x6f8fe0, 30, 14, 0.6, 0.6, 2); winFill.position.set(-7.0, 3.2, 8.5); winFill.target.position.set(-7.0, 0.8, 0.5);
  winFill.castShadow = true; winFill.shadow.mapSize.set(1024, 1024); winFill.shadow.bias = -0.001; scene.add(winFill, winFill.target); W.lights.winFill = winFill;
  // little stool and a wall calendar for texture
  cyl(0.18, 0.18, 0.05, 10, M(0x7a2c25), -7.0, 0.7, 0.6, off); cyl(0.03, 0.03, 0.68, 6, M(0x2a2a2a), -7.0, 0.34, 0.6, off);
  box(0.4, 0.55, 0.02, M(0xd8cfbf), -8.95, 1.9, 0.0, off).rotation.y = Math.PI / 2;

  // ---------- neon sign ----------
  const sign = new THREE.Group(); sign.position.set(-1.2, 0, 6.5); scene.add(sign); W.sign = sign;
  cyl(0.16, 0.2, 7.2, 8, M(0x3b3b3e, { metalness: 0.5 }), 0, 3.6, 0, sign);
  box(4.6, 2.0, 0.4, M(0x15171b), 0, 8.0, 0, sign);
  const neonTex = (txt, col, font) => textTex((c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 18; c.fillStyle = col; c.fillText(txt, w / 2, h / 2 + 6); c.fillText(txt, w / 2, h / 2 + 6); }, 1024, 256);
  W.neonStar = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveIntensity: 2.4, emissiveMap: neonTex('STARLITE', '#ffb14a', 'italic bold 170px serif') });
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.05), W.neonStar); s1.position.set(0, 8.35, 0.21); sign.add(s1);
  const motelM = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: neonTex('M O T E L', '#9fd0ff', 'bold 120px sans-serif') });
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), motelM); s2.position.set(0, 7.5, 0.21); sign.add(s2); W.neonMotel = motelM;
  box(3.4, 0.9, 0.3, M(0x15171b), 0, 6.2, 0, sign);
  W.neonVac = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveIntensity: 3, emissiveMap: neonTex('VACANCY', '#ff2a2a', 'bold 150px sans-serif') });
  const s3 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), W.neonVac); s3.position.set(0, 6.2, 0.16); sign.add(s3);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), E(0xffd27a, 3)); star.position.set(1.9, 9.4, 0); sign.add(star); W.neonStarTop = star.material;
  const neonL = new THREE.PointLight(PAL.red, 14, 14, 2); neonL.position.set(0, 6.0, 1.2); sign.add(neonL); W.lights.neon = neonL;
  const neonL2 = new THREE.PointLight(0xffa04a, 8, 14, 2); neonL2.position.set(0, 8.4, 1.4); sign.add(neonL2); W.lights.neon2 = neonL2;

  // ---------- highway streetlights (far side) ----------
  const poleM = M(0x4a4d52, { metalness: 0.5 });
  for (let x = -46; x <= 74; x += 20) {
    const g = new THREE.Group(); g.position.set(x, 0, 34.2); scene.add(g);
    cyl(0.1, 0.14, 8, 6, poleM, 0, 4, 0, g); box(0.1, 0.1, 2.2, poleM, 0, 7.95, -1.05, g);
    const hm = E(0xcfe2ff, 3); box(0.5, 0.12, 0.3, hm, 0, 7.85, -2.0, g, false);
    const L = new THREE.SpotLight(0xa9c8ff, 700, 26, 0.8, 0.5, 2); L.position.set(x, 7.7, 32.2); L.target.position.set(x, 0, 30.5); scene.add(L, L.target);
    W.streetLights.push({ x, hm, L });
  }

  // ---------- power poles + wires (near side, z=22.6) ----------
  const woodM = M(0x4b3a2c);
  W.poles = [];
  const mkPole = (x, z, parent) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    cyl(0.16, 0.2, 9, 7, woodM, 0, 4.5, 0, g); box(2.4, 0.14, 0.14, woodM, 0, 8.4, 0, g);
    [-1.05, 0, 1.05].forEach(o => cyl(0.04, 0.04, 0.16, 6, M(0x9fb0a0), o, 8.55, 0, g));
    return g;
  };
  for (const x of [-22, -4, 32, 50]) W.poles.push({ x, g: mkPole(x, CRASH.pole[1], scene) });
  // the one that gets hit: a group posed from the physics bake (origin = body centre)
  const hp = new THREE.Group(); scene.add(hp); W.hitPole = hp;
  const inner = mkPole(0, 0, hp); inner.position.set(0, -4.5, 0);
  const tr = cyl(0.32, 0.32, 0.8, 10, M(0x6f7478, { metalness: 0.6 }), 0.0, 7.2 - 4.5, 0.3, hp);
  W.transformerLocal = new THREE.Vector3(0, 7.2 - 4.5, 0.3);
  W.poleTopLocal = [-1.05, 0, 1.05].map(o => new THREE.Vector3(o, 8.55 - 4.5, 0));
  const wireM = new THREE.LineBasicMaterial({ color: 0x0c0d10 });
  W.wires = [];
  const xs = [-22, -4, CRASH.pole[0], 32, 50];
  for (let i = 0; i < xs.length - 1; i++) for (const o of [-1.05, 0, 1.05]) {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    const ln = new THREE.Line(geo, wireM); ln.frustumCulled = false; scene.add(ln);
    W.wires.push({ ln, a: xs[i], b: xs[i + 1], o });
  }

  // ---------- parked cars ----------
  const car = (x, z, col, rot = 0) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    box(1.9, 0.6, 4.3, M(col, { roughness: 0.5, metalness: 0.3 }), 0, 0.6, 0, g);
    box(1.7, 0.55, 2.2, M(col, { roughness: 0.5, metalness: 0.3 }), 0, 1.15, -0.2, g);
    box(1.72, 0.42, 2.0, M(0x0e1218, { roughness: 0.2, metalness: 0.6 }), 0, 1.17, -0.2, g, false);
    [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]].forEach(([a, b]) => { const w = cyl(0.36, 0.36, 0.28, 10, M(0x111111), a, 0.36, b, g); w.rotation.z = Math.PI / 2; });
    return g;
  };
  car(8.4, 3.6, 0x5b6b5e); car(18.3, 3.8, 0x7a3b30); car(11.7, 3.7, 0x8c8a7c, 0.05);

  // ---------- treeline + hills (fog swallows them; keep them near enough to read) ----------
  const r = rng(42), treeM = M(0x101a16), treeM2 = M(0x0d1512);
  for (let i = 0; i < 70; i++) {
    const side = i % 2, x = -60 + r() * 130, z = side ? -14 - r() * 18 : 42 + r() * 22, h = 5 + r() * 7;
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.4 + r() * 1.2, h, 6), r() > 0.5 ? treeM : treeM2);
    t.position.set(x, h / 2, z); t.castShadow = true; scene.add(t);
  }

  // ---------- the truck ----------
  const truck = { cab: new THREE.Group(), tr: new THREE.Group() }; scene.add(truck.cab, truck.tr); W.truck = truck;
  const cabM = M(0x2f4f7a, { roughness: 0.45, metalness: 0.4 });
  // physics cab box: half (1.7, 1.4, 1.25), front = -x
  box(3.4, 1.9, 2.5, cabM, 0, 0.35, 0, truck.cab); box(1.5, 0.9, 2.5, cabM, 0.6, 1.25 + 0.05, 0, truck.cab);
  box(0.08, 0.7, 2.2, M(0x0b0f14, { roughness: 0.15, metalness: 0.7 }), -1.71, 0.9, 0, truck.cab, false);
  box(0.1, 0.6, 1.6, M(0x9aa0a6, { metalness: 0.8, roughness: 0.3 }), -1.72, -0.1, 0, truck.cab, false);
  W.headM = E(0xfff2cc, 4); [-0.85, 0.85].forEach(z => box(0.06, 0.22, 0.34, W.headM, -1.74, -0.25, z, truck.cab, false));
  [[-1.0, 1.2], [-1.0, -1.2], [1.0, 1.2], [1.0, -1.2]].forEach(([a, b]) => { const w = cyl(0.5, 0.5, 0.4, 12, M(0x111111), a, -0.9, b, truck.cab); w.rotation.x = Math.PI / 2; });
  const hl = new THREE.SpotLight(0xfff0d0, 120, 40, 0.5, 0.4, 2); hl.position.set(-1.8, -0.2, 0); hl.target.position.set(-12, -1.4, 0); truck.cab.add(hl, hl.target); W.lights.truckHL = hl;
  // trailer: half (5.5, 1.7, 1.3)
  const trTex = textTex((c, w, h) => { c.fillStyle = '#d8d6cf'; c.fillRect(0, 0, w, h); c.fillStyle = '#b3332c'; c.fillRect(0, h * 0.62, w, h * 0.1); c.fillStyle = '#25282c'; c.font = 'bold 120px sans-serif'; c.fillText('ROADHAUL', 60, h * 0.45); }, 1024, 256);
  box(11, 2.8, 2.6, M(0xffffff, { map: trTex, roughness: 0.7 }), 0, 0.3, 0, truck.tr);
  [[3.2, 1.2], [3.2, -1.2], [4.4, 1.2], [4.4, -1.2]].forEach(([a, b]) => { const w = cyl(0.5, 0.5, 0.4, 12, M(0x111111), a, -1.2, b, truck.tr); w.rotation.x = Math.PI / 2; });
  W.tailM = E(0xff2a1a, 2.5); [-1.0, 1.0].forEach(z => box(0.06, 0.2, 0.3, W.tailM, 5.52, -0.9, z, truck.tr, false));

  // ---------- sparks + fire (deterministic particle systems) ----------
  const N = 140, sp = new Float32Array(N * 3);
  const sg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3));
  W.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffd08a, size: 0.13, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  W.sparks.frustumCulled = false; scene.add(W.sparks);
  const rr = rng(1234); W.sparkSeed = Array.from({ length: N }, () => [rr() - 0.5, rr(), rr() - 0.5, rr()]);
  W.flashL = new THREE.PointLight(0xbfe0ff, 0, 40, 2); scene.add(W.flashL);
  W.fireL = new THREE.PointLight(0xff7a2a, 0, 16, 2); scene.add(W.fireL);
  W.fire = new THREE.Group(); scene.add(W.fire);
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 6), E(i % 2 ? 0xff8a2a : 0xffc25a, 3)); f.position.set((i - 3) * 0.3, 0.6, (i % 3 - 1) * 0.25); W.fire.add(f); }
  W.fire.visible = false;

  return W;
}

// catenary-ish sag between two points
export function setWire(line, a, b, sag) {
  const pos = line.geometry.attributes.position, n = pos.count;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); pos.setXYZ(i, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - sag * 4 * u * (1 - u), a.z + (b.z - a.z) * u); }
  pos.needsUpdate = true;
}
