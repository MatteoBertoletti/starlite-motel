// Flat 2D stickman drawn with canvas strokes onto its own texture, on a camera-facing plane.
// Alpha-tested so it casts a real shadow; slight emissive so it reads in the dark.
import * as THREE from 'three';

export const LEN = { torso: 0.6, neck: 0.07, head: 0.18, thigh: 0.47, shin: 0.47, uarm: 0.33, farm: 0.31 };
const OUT = 0.1, IN = 0.056;            // outline / fill stroke widths in metres

const dirA = a => [Math.sin(a), -Math.cos(a)];   // angle 0 = straight down, + = toward +x
const add = (p, a, l) => { const d = dirA(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };

// 2-bone IK in the sprite plane. bend = +1 / -1 picks which side the middle joint goes.
export function ik2(root, target, a, b, bend) {
  let dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy); const maxd = a + b - 1e-4;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  const base = Math.atan2(dx, -dy);                       // same convention as dirA
  const k = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const mid = add(root, base + bend * k, a);
  return [mid, [root[0] + dx, root[1] + dy]];
}

export class Stick {
  constructor(opts = {}) {
    this.o = { body: '#ece7dc', line: '#121418', cap: null, W: 1.6, H: 2.3, px: 240, pad: 0.06, emissive: 0.14, ...opts };
    const { W, H, px } = this.o;
    this.cv = document.createElement('canvas'); this.cv.width = Math.round(W * px); this.cv.height = Math.round(H * px);
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(W, H); geo.translate(0, H / 2 - this.o.pad, 0);
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, metalness: 0,
      emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: this.o.emissive });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.mesh.customDistanceMaterial = new THREE.MeshDistanceMaterial({ map: this.tex, alphaTest: 0.5 });
    this.joints = null;
  }
  // sprite coords (m, origin = ground under the hips) -> canvas px
  P(p) { const { W, H, px, pad } = this.o; return [(p[0] + W / 2) * px, (H - pad - p[1]) * px]; }

  // Face the camera around the vertical axis only.
  face(camera) { const m = this.mesh; m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), 0); }
  // world position of a sprite-space point (after face())
  world(p) { return this.mesh.localToWorld(new THREE.Vector3(p[0], p[1], 0)); }

  /* pose: { hip:[x,y], lean, headTilt, face: 1|-1|0|'back', look:[dx,dy],
             arms:[back, front] each {sh, el} or {hand:[x,y], bend},
             legs:[back, front] each {th, kn} or {foot:[x,y]},
             props:[{type, hand:0|1}], wet:t, capOff:bool } */
  draw(pose) {
    const c = this.ctx, o = this.o, s = o.px;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    const f = pose.face === 'back' ? 0 : (pose.face ?? 0);
    const hip = pose.hip || [0, 0.95];
    const lean = pose.lean || 0;
    const neck = add(hip, Math.PI + lean, LEN.torso);
    const headC = add(neck, Math.PI + lean + (pose.headTilt || 0), LEN.neck + LEN.head);
    const sh = add(hip, Math.PI + lean, LEN.torso - 0.06);
    const limb = (root, spec, a, b, bendDefault) => {
      if (spec.hand || spec.foot) { const [m, e] = ik2(root, spec.hand || spec.foot, a, b, spec.bend ?? bendDefault); return [root, m, e]; }
      const m = add(root, (spec.sh ?? spec.th) + lean * (spec.sh !== undefined ? 1 : 0), a);
      const e = add(m, (spec.sh ?? spec.th) + lean * (spec.sh !== undefined ? 1 : 0) + (spec.el ?? spec.kn), b);
      return [root, m, e];
    };
    const legs = (pose.legs || [{ th: -0.14, kn: 0 }, { th: 0.14, kn: 0 }]).map(L => limb(hip, L, LEN.thigh, LEN.shin, f >= 0 ? 1 : -1));
    const arms = (pose.arms || [{ sh: -0.2, el: 0.1 }, { sh: 0.2, el: -0.1 }]).map(A => limb(sh, A, LEN.uarm, LEN.farm, f >= 0 ? -1 : 1));
    this.joints = { hip, neck, headC, sh, legs, arms };

    c.lineCap = 'round'; c.lineJoin = 'round';
    const stroke = (pts, col, w) => { c.strokeStyle = col; c.lineWidth = w * s; c.beginPath(); pts.forEach((p, i) => { const q = this.P(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); };
    const part = pts => { stroke(pts, o.line, OUT); stroke(pts, o.body, IN); };

    // back limbs, torso, front limbs, head
    part(arms[0]); part(legs[0]);
    part([hip, neck]);
    part(legs[1]);
    this.drawProps(pose, arms, 'back');
    part(arms[1]);
    this.drawProps(pose, arms, 'front');

    // head
    const hc = this.P(headC), r = LEN.head * s;
    c.fillStyle = o.body; c.strokeStyle = o.line; c.lineWidth = (OUT - IN) * s * 1.1;
    c.beginPath(); c.arc(hc[0], hc[1], r, 0, Math.PI * 2); c.fill(); c.stroke();
    if (pose.face !== 'back') {                         // dot eyes, no mouth
      const look = pose.look || [0, 0];
      const ex = f === 0 ? [-0.06, 0.06] : [f * 0.04, f * 0.115];
      c.fillStyle = o.line;
      ex.forEach(x => { c.beginPath(); c.arc(hc[0] + (x + look[0]) * s, hc[1] - (-0.035 + look[1]) * s, 0.027 * s, 0, Math.PI * 2); c.fill(); });
    }
    if (o.cap && !pose.capOff) this.drawCap(hc, r, f, pose.face === 'back');
    if (pose.wet !== undefined) this.drawDrips(pose.wet, headC, arms);
  }

  drawCap(hc, r, f, back) {
    const c = this.ctx, o = this.o;
    c.fillStyle = o.cap; c.strokeStyle = o.line; c.lineWidth = (OUT - IN) * o.px * 1.1;
    c.beginPath(); c.arc(hc[0], hc[1] - r * 0.28, r * 1.0, Math.PI * 1.0, Math.PI * 2.0); c.closePath(); c.fill(); c.stroke();
    if (back) return;
    c.beginPath();
    if (f === 0) c.ellipse(hc[0], hc[1] - r * 0.3, r * 1.12, r * 0.17, 0, 0, Math.PI * 2);
    else { const x0 = hc[0] + f * r * 0.2, x1 = hc[0] + f * r * 1.7; const y = hc[1] - r * 0.3;
      c.moveTo(x0, y - r * 0.12); c.lineTo(x1, y); c.lineTo(x1, y + r * 0.14); c.lineTo(x0, y + r * 0.14); c.closePath(); }
    c.fill(); c.stroke();
  }

  drawDrips(t, headC, arms) {
    const c = this.ctx; c.fillStyle = 'rgba(200,225,255,0.95)';
    for (let i = 0; i < 9; i++) {
      const src = i % 3 === 0 ? headC : arms[i % 2][2];
      const ph = ((t * 1.3 + i * 0.37) % 1);
      const p = this.P([src[0] + ((i * 0.071) % 0.16) - 0.08, src[1] - 0.1 - ph * 0.9]);
      c.beginPath(); c.ellipse(p[0], p[1], 0.012 * this.o.px, 0.026 * this.o.px, 0, 0, Math.PI * 2); c.fill();
    }
  }

  drawProps(pose, arms, layer) {
    for (const pr of pose.props || []) {
      const front = (pr.hand ?? 1) === 1;
      if ((layer === 'front') !== front) continue;
      const h = arms[pr.hand ?? 1][2], p = this.P(h), s = this.o.px, c = this.ctx;
      c.lineWidth = 0.022 * s; c.strokeStyle = this.o.line; c.lineJoin = 'round';
      if (pr.type === 'gascan') {
        c.fillStyle = '#c4302b';
        const w = 0.27 * s, hh = 0.33 * s, x = p[0] - w / 2, y = p[1] + 0.03 * s;
        c.beginPath(); c.roundRect(x, y, w, hh, 0.03 * s); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(x + w * 0.25, y); c.lineTo(x + w * 0.25, y - 0.05 * s); c.lineTo(x + w * 0.75, y - 0.05 * s); c.lineTo(x + w * 0.75, y); c.stroke();
        c.beginPath(); c.moveTo(x + w * 0.15, y + hh * 0.25); c.lineTo(x + w * 0.85, y + hh * 0.75); c.moveTo(x + w * 0.85, y + hh * 0.25); c.lineTo(x + w * 0.15, y + hh * 0.75); c.stroke();
      } else if (pr.type === 'flashlight') {
        const a = pr.angle ?? -Math.PI / 2;   // canvas angle the beam points to
        c.save(); c.translate(p[0], p[1]); c.rotate(a);
        c.fillStyle = '#2a2d33'; c.beginPath(); c.roundRect(-0.04 * s, -0.035 * s, 0.22 * s, 0.07 * s, 0.015 * s); c.fill(); c.stroke();
        c.fillStyle = '#fff6d8'; c.beginPath(); c.roundRect(0.16 * s, -0.045 * s, 0.05 * s, 0.09 * s, 0.01 * s); c.fill(); c.stroke();
        c.restore();
      }
    }
  }
  update() { this.tex.needsUpdate = true; }
}

// Walk with planted feet. d = distance travelled along the path, k = how the path direction
// projects onto the sprite's x axis (sign = facing). Returns a pose fragment.
export function walkPose(d, k, step = 0.62) {
  const S = step, ST = 0.6;
  const foot = off => {
    const e = d - off, n = Math.floor(e / (2 * S)), u = e / (2 * S) - n;
    const plant = off + 2 * S * n + ST * S;
    let pos, lift = 0;
    if (u < ST) pos = plant;
    else { const w = (u - ST) / (1 - ST), sm = w * w * (3 - 2 * w); pos = plant + 2 * S * sm; lift = 0.13 * Math.sin(Math.PI * w); }
    return [(pos - d) * k, lift];
  };
  const fa = foot(0), fb = foot(S);
  const ph = (d / (2 * S)) * Math.PI * 2;
  const bob = 0.025 * Math.cos(ph * 2);
  const sw = 0.35 * Math.sin(ph) * Math.sign(k || 1);
  return {
    hip: [0, 0.91 + bob], lean: 0.06 * Math.sign(k),
    legs: [{ foot: [fa[0], fa[1]] }, { foot: [fb[0], fb[1]] }],
    arms: [{ sh: sw, el: 0.25 * Math.sign(k) }, { sh: -sw, el: 0.25 * Math.sign(k) }],
    face: Math.abs(k) < 0.3 ? 0 : Math.sign(k),
  };
}
