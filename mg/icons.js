// Flat, rounded pictograms: white shapes with black cut-outs, drawn in a unit box (-0.5..0.5).
// Every icon is our own drawing; style follows the brief (minimal, glowing white, red/gold accents).
export const C = { bg: '#050506', w: '#f2efe8', dim: '#5f5c57', red: '#e5322d', gold: '#f5c451', green: '#27a85c' };

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const W = (c, col) => { c.fillStyle = col || C.w; c.fill(); };
const B = c => { c.fillStyle = C.bg; c.fill(); };
const S = (c, lw, col) => { c.lineWidth = lw; c.strokeStyle = col || C.w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };
const clamp01 = x => Math.max(0, Math.min(1, x));
export function T(c, text, x, y, size, weight = '800', col = C.bg, align = 'center', base = 'middle') {
  c.save(); c.translate(x, y); c.scale(size / 100, size / 100); c.font = `${weight} 100px Montserrat`; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(text, 0, 0); c.restore();
}

function bust(c, o = {}) {                       // head + shoulders
  const col = o.col || C.w;
  circ(c, 0, -0.2, 0.16); W(c, col);
  c.beginPath(); c.moveTo(-0.34, 0.46); c.bezierCurveTo(-0.34, 0.08, -0.2, 0.0, 0, 0.0); c.bezierCurveTo(0.2, 0.0, 0.34, 0.08, 0.34, 0.46); c.closePath(); W(c, col);
}
function eyes(c, o = {}) { if (o.faceless) return; c.fillStyle = o.eyeCol || C.bg; circ(c, -0.055, -0.21, 0.022); c.fill(); circ(c, 0.055, -0.21, 0.022); c.fill(); }

export const ICONS = {
  key(c, o) {
    circ(c, -0.25, 0, 0.16); W(c, o.col); circ(c, -0.25, 0, 0.065); B(c);
    rr(c, -0.12, -0.04, 0.5, 0.08, 0.03); W(c, o.col);
    rr(c, 0.22, 0.02, 0.06, 0.1, 0.02); W(c, o.col); rr(c, 0.32, 0.02, 0.05, 0.13, 0.02); W(c, o.col);
  },
  building(c, o) {
    const fl = o.floors || 6, bw = 0.5, bh = 0.9;
    rr(c, -bw / 2, -bh / 2, bw, bh, 0.03); W(c);
    rr(c, -bw / 2 - 0.03, -bh / 2 - 0.05, bw + 0.06, 0.06, 0.02); W(c);
    const rowH = (bh - 0.2) / fl;
    for (let f = 0; f < fl; f++) for (let k = 0; k < 3; k++) {
      const x = -bw / 2 + 0.07 + k * 0.13, y = bh / 2 - 0.2 - (f + 1) * rowH + 0.02;
      rr(c, x, y, 0.09, rowH * 0.62, 0.015);
      if (o.lit && f + 1 === o.lit && k === 1) { c.save(); c.shadowColor = C.gold; c.shadowBlur = 40; W(c, C.gold); c.restore(); } else B(c);
    }
    rr(c, -0.06, bh / 2 - 0.17, 0.12, 0.17, 0.02); B(c);
  },
  tag(c, o) {
    c.beginPath(); c.moveTo(-0.42, -0.2); c.lineTo(0.25, -0.2); c.lineTo(0.42, 0); c.lineTo(0.25, 0.2); c.lineTo(-0.42, 0.2); c.closePath(); W(c, o.col);
    circ(c, 0.28, 0, 0.035); B(c);
    T(c, o.text || '€', -0.08, 0.015, 0.17, '900');
  },
  slash(c, o) { const k = o.k ?? 1; c.beginPath(); c.moveTo(-0.45, 0.4); c.lineTo(-0.45 + 0.9 * k, 0.4 - 0.8 * k); S(c, 0.07, C.red); },
  note(c, o) {
    c.save(); c.rotate(-0.04);
    rr(c, -0.32, -0.42, 0.64, 0.84, 0.03); W(c);
    if (o.back) { c.scale(-1, 1); T(c, '7.', -0.22, -0.2, 0.12, '900', C.red, 'left', 'alphabetic'); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.22, -0.08 + i * 0.09); c.lineTo(0.2 - i * 0.06, -0.08 + i * 0.09); S(c, 0.02, C.bg); } c.restore(); return; }
    T(c, 'REGOLE', -0.25, -0.3, 0.075, '900', C.bg, 'left', 'alphabetic');
    const n = o.lines ?? 7, wk = o.write ?? 1;
    for (let i = 0; i < n; i++) {
      const k = clamp01(wk * n - i); if (k <= 0) break;
      const y = -0.2 + i * 0.085, len = 0.42 - (i * 37 % 5) * 0.03;
      c.beginPath(); c.moveTo(-0.25, y); c.lineTo(-0.25 + len * k, y); S(c, 0.02, C.bg);
      T(c, String(i + 1), -0.29, y + 0.017, 0.05, '800', C.bg, 'left', 'alphabetic');
    }
    if (n === 7 && wk >= 1) { c.beginPath(); c.moveTo(-0.25, 0.4 - 0.05); c.lineTo(0.2, 0.35); S(c, 0.012, C.red); c.beginPath(); c.moveTo(-0.25, 0.38); c.lineTo(0.2, 0.375); S(c, 0.012, C.red); }
    c.restore();
  },
  bruni(c, o) {
    circ(c, 0, -0.39, 0.075); W(c, o.col);                    // bun
    bust(c, o);
    c.lineWidth = 0.02; c.strokeStyle = C.bg; circ(c, -0.06, -0.2, 0.045); c.stroke(); circ(c, 0.06, -0.2, 0.045); c.stroke();
    c.beginPath(); c.moveTo(-0.015, -0.2); c.lineTo(0.015, -0.2); c.stroke();
    c.fillStyle = C.bg; circ(c, -0.06, -0.2, 0.014); c.fill(); circ(c, 0.06, -0.2, 0.014); c.fill();
    rr(c, -0.08, 0.06, 0.16, 0.04, 0.02); B(c);                // brooch line
  },
  you(c, o) {
    bust(c, o); eyes(c, o);
    c.beginPath(); c.moveTo(-0.16, 0.0); c.quadraticCurveTo(0, 0.08, 0.16, 0.0); c.lineTo(0.17, 0.07); c.quadraticCurveTo(0, 0.15, -0.17, 0.07); c.closePath(); W(c, C.red);
    rr(c, 0.06, 0.06, 0.07, 0.2, 0.03); W(c, C.red);           // scarf tail: the mark
  },
  admin(c, o) {
    bust(c, o); eyes(c, o);
    rr(c, -0.24, -0.33, 0.48, 0.05, 0.02); W(c, o.col); rr(c, -0.14, -0.47, 0.28, 0.16, 0.04); W(c, o.col);  // hat
    rr(c, -0.145, -0.36, 0.29, 0.03, 0.01); B(c);
    c.beginPath(); c.moveTo(0, 0.02); c.lineTo(-0.035, 0.08); c.lineTo(0, 0.3); c.lineTo(0.035, 0.08); c.closePath(); B(c);  // tie
    c.beginPath(); c.moveTo(-0.11, 0.0); c.lineTo(0, 0.1); c.lineTo(0.11, 0.0); S(c, 0.02, C.bg);
  },
  mother(c, o) {
    c.beginPath(); c.moveTo(-0.2, 0.05); c.bezierCurveTo(-0.25, -0.2, -0.2, -0.4, 0, -0.4); c.bezierCurveTo(0.2, -0.4, 0.25, -0.2, 0.2, 0.05); c.closePath(); W(c, o.col);
    bust(c, o); eyes(c, o);
    c.beginPath(); c.arc(0, -0.2, 0.16, Math.PI * 1.05, Math.PI * 1.95); S(c, 0.03, C.bg);
  },
  shadow(c, o) {
    c.save(); c.shadowBlur = 0;
    circ(c, 0, -0.2, 0.16); c.fillStyle = '#000'; c.fill(); S(c, 0.02, C.dim);
    c.beginPath(); c.moveTo(-0.34, 0.46); c.bezierCurveTo(-0.34, 0.08, -0.2, 0.0, 0, 0.0); c.bezierCurveTo(0.2, 0.0, 0.34, 0.08, 0.34, 0.46); c.closePath(); c.fillStyle = '#000'; c.fill(); S(c, 0.02, C.dim);
    c.restore();
    c.save(); c.shadowColor = C.red; c.shadowBlur = 20; c.fillStyle = C.w; circ(c, -0.055, -0.2, 0.018); c.fill(); circ(c, 0.055, -0.2, 0.018); c.fill(); c.restore();
  },
  fridge(c, o) {
    if (o.open) {
      rr(c, -0.24, -0.45, 0.42, 0.9, 0.04); S(c, 0.035);
      for (const y of [-0.15, 0.1]) { c.beginPath(); c.moveTo(-0.2, y); c.lineTo(0.14, y); S(c, 0.02); }
      c.beginPath(); c.moveTo(0.18, -0.45); c.lineTo(0.36, -0.38); c.lineTo(0.36, 0.38); c.lineTo(0.18, 0.45); c.closePath(); W(c);
      return;
    }
    rr(c, -0.22, -0.45, 0.44, 0.9, 0.05); W(c);
    rr(c, -0.22, -0.13, 0.44, 0.025, 0); B(c);
    rr(c, 0.13, -0.36, 0.035, 0.14, 0.015); B(c); rr(c, 0.13, -0.06, 0.035, 0.2, 0.015); B(c);
  },
  bed(c, o) {
    rr(c, -0.45, 0.0, 0.9, 0.16, 0.03); W(c); rr(c, -0.45, -0.22, 0.06, 0.42, 0.02); W(c); rr(c, 0.39, -0.08, 0.06, 0.28, 0.02); W(c);
    rr(c, -0.36, -0.1, 0.2, 0.1, 0.04); W(c); c.beginPath(); c.moveTo(-0.12, 0); c.quadraticCurveTo(0.1, -0.12, 0.38, -0.02); c.lineTo(0.38, 0.0); c.closePath(); W(c);
  },
  intercom(c, o) {
    rr(c, -0.24, -0.45, 0.48, 0.9, 0.06); W(c);
    rr(c, -0.17, -0.37, 0.34, 0.24, 0.03); B(c);                          // little screen
    circ(c, 0, -0.25, 0.03); c.fillStyle = o.lit ? C.gold : '#333'; c.fill();
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) { circ(c, -0.12 + k * 0.06, -0.03 + r * 0.05, 0.012); B(c); }
    for (let k = 0; k < 2; k++) { rr(c, -0.15 + k * 0.17, 0.22, 0.13, 0.1, 0.02); B(c); }
    if (o.finger) { c.save(); c.translate(0.02, 0.36); c.rotate(-0.3); rr(c, -0.04, 0, 0.08, 0.35, 0.04); W(c); c.restore(); }
  },
  handset(c, o) {
    rr(c, -0.12, -0.42, 0.24, 0.84, 0.1); W(c, o.col);
    rr(c, -0.08, -0.36, 0.16, 0.1, 0.04); B(c); rr(c, -0.08, 0.26, 0.16, 0.1, 0.04); B(c);
    c.beginPath(); c.moveTo(0.12, 0.3); c.bezierCurveTo(0.3, 0.35, 0.18, 0.45, 0.32, 0.5); S(c, 0.02, o.col);
  },
  door(c, o) {
    const open = o.openK || 0;
    rr(c, -0.27, -0.47, 0.54, 0.94, 0.02); S(c, 0.035);                     // frame
    if (o.gapK) { c.save(); c.shadowColor = C.gold; c.shadowBlur = 40 * o.gapK; rr(c, -0.25, 0.445, 0.5, 0.02, 0.005); c.fillStyle = `rgba(245,196,81,${o.gapK})`; c.fill(); c.restore(); }
    if (open > 0) { c.save(); c.shadowColor = C.gold; c.shadowBlur = 30; rr(c, -0.24, -0.44, 0.48, 0.88, 0.01); c.fillStyle = `rgba(245,196,81,${0.25 * open})`; c.fill(); c.restore(); }
    const dw = 0.48 * (1 - 0.75 * open);
    rr(c, -0.24, -0.44, dw, 0.86, 0.015); W(c);
    if (open < 0.6) {
      rr(c, -0.2 + 0.0 * open, -0.38, dw - 0.08, 0.3, 0.02); B(c); rr(c, -0.2, -0.02, dw - 0.08, 0.38, 0.02); B(c);
      rr(c, -0.19, -0.37, dw - 0.1, 0.28, 0.02); W(c); rr(c, -0.19, -0.01, dw - 0.1, 0.36, 0.02); W(c);
      circ(c, -0.24 + dw - 0.06, 0.02, 0.025); B(c);
      circ(c, -0.24 + dw / 2, -0.24, 0.018); B(c);                               // peephole
    }
    if (o.label) { rr(c, -0.24 + dw / 2 - 0.05, -0.43, 0.1, 0.06, 0.01); B(c); T(c, o.label, -0.24 + dw / 2, -0.398, 0.045, '800', C.w); }
    if (o.tapeK) { c.save(); c.globalAlpha = o.tapeK; [[0.4], [-0.4]].forEach(([r]) => { c.save(); c.translate(-0.24 + dw - 0.06, 0.02); c.rotate(r); rr(c, -0.12, -0.02, 0.24, 0.04, 0.005); W(c, C.red); c.restore(); }); c.restore(); }
  },
  lamp(c, o) { rr(c, -0.02, -0.3, 0.04, 0.75, 0.01); W(c); rr(c, -0.1, -0.4, 0.2, 0.08, 0.03); W(c, o.col || C.gold); },
  hand(c, o) {
    rr(c, -0.17, -0.05, 0.34, 0.4, 0.12); W(c, o.col);
    [-0.13, -0.045, 0.045, 0.13].forEach((x, i) => { rr(c, x - 0.035, -0.4 + (i === 0 || i === 3 ? 0.08 : 0), 0.07, 0.42, 0.035); W(c, o.col); });
    c.save(); c.translate(-0.17, 0.08); c.rotate(-0.7); rr(c, -0.035, -0.22, 0.07, 0.26, 0.035); W(c, o.col); c.restore();
  },
  vending(c, o) {
    rr(c, -0.26, -0.45, 0.52, 0.9, 0.04); W(c);
    rr(c, -0.2, -0.38, 0.28, 0.5, 0.02); B(c);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { rr(c, -0.18 + k * 0.09, -0.35 + r * 0.12, 0.06, 0.08, 0.015); c.fillStyle = (r + k) % 3 === 0 ? C.gold : '#d8d4cc'; c.fill(); }
    rr(c, 0.12, -0.3, 0.08, 0.2, 0.02); B(c); rr(c, -0.2, 0.22, 0.4, 0.12, 0.02); B(c);
  },
  bottle(c, o) { rr(c, -0.12, -0.2, 0.24, 0.62, 0.06); W(c); rr(c, -0.06, -0.34, 0.12, 0.16, 0.02); W(c); rr(c, -0.07, -0.42, 0.14, 0.07, 0.02); W(c, C.gold); rr(c, -0.12, 0.0, 0.24, 0.16, 0); B(c); },
  phone(c, o) {
    rr(c, -0.23, -0.45, 0.46, 0.9, 0.07); S(c, 0.04); rr(c, -0.19, -0.4, 0.38, 0.8, 0.04); B(c);
    circ(c, 0, -0.41, 0.012); W(c);
    if (o.text) T(c, o.text, 0, -0.12, 0.13, '800', C.w);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) { rr(c, -0.14 + k * 0.1, 0.06 + r * 0.1, 0.07, 0.07, 0.015); c.fillStyle = '#3a3936'; c.fill(); }
  },
  stairs(c, o) {
    const n = 5;
    for (let i = 0; i < n; i++) { rr(c, -0.4 + i * 0.16, 0.4 - (i + 1) * 0.16, 0.16, (i + 1) * 0.16, 0.01); W(c, o.step && i < o.step * 2 ? C.gold : C.w); }
    c.beginPath(); c.moveTo(-0.38, 0.12); for (let i = 0; i < n; i++) c.lineTo(-0.3 + i * 0.16, 0.12 - (i + 1) * 0.16 + 0.08); S(c, 0.02);
  },
  switch(c, o) {
    rr(c, -0.25, -0.25, 0.5, 0.5, 0.06); S(c, 0.035);
    const p = o.pressK || 0; rr(c, -0.15, -0.15 + p * 0.02, 0.3, 0.3, 0.05); W(c);
    c.save(); c.shadowColor = C.gold; c.shadowBlur = 30 * (0.3 + p); circ(c, 0, 0 + p * 0.02, 0.05); W(c, C.gold); c.restore();
  },
  steps(c, o) {
    const foot = (x, y, r) => { c.save(); c.translate(x, y); c.rotate(r); c.beginPath(); c.ellipse(0, 0, 0.06, 0.1, 0, 0, Math.PI * 2); W(c, o.col); c.beginPath(); c.ellipse(0, 0.14, 0.045, 0.045, 0, 0, Math.PI * 2); W(c, o.col); c.restore(); };
    const ph = o.phase || 0, n = 4;
    for (let i = 0; i < n; i++) {
      const vis = clamp01((o.reveal ?? 1) * n - i); if (vis <= 0) continue;
      c.save(); c.globalAlpha *= vis * (0.35 + 0.65 * ((i + ph) % n) / (n - 1));
      const dir = o.dir === 'left' ? -1 : 1;
      foot(dir * (-0.36 + i * 0.24), i % 2 ? -0.08 : 0.08, dir * Math.PI / 2);
      c.restore();
    }
  },
  keyhole(c, o) { rr(c, -0.2, -0.4, 0.4, 0.8, 0.08); W(c); circ(c, 0, -0.06, 0.08); B(c); c.beginPath(); c.moveTo(-0.045, -0.02); c.lineTo(0.045, -0.02); c.lineTo(0.07, 0.2); c.lineTo(-0.07, 0.2); c.closePath(); B(c); },
  waves(c, o) {
    const ph = o.phase || 0;
    for (let i = 0; i < 3; i++) { const a = ((i / 3 + ph) % 1); c.save(); c.globalAlpha *= (1 - a) * (o.soft ? 0.6 : 1); c.beginPath(); c.arc(-0.3, 0, 0.15 + a * 0.5, -0.6, 0.6); S(c, 0.04, o.col); c.restore(); }
  },
  paper(c, o) { rr(c, -0.4, -0.28, 0.8, 0.56, 0.02); W(c); for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-0.3, -0.15 + i * 0.1); c.lineTo(0.25, -0.15 + i * 0.1); S(c, 0.02, C.bg); } },
  doc(c, o) {
    rr(c, -0.34, -0.45, 0.68, 0.9, 0.02); W(c);
    T(c, o.title || '', -0.27, -0.33, 0.07, '900', C.bg, 'left', 'alphabetic');
    T(c, o.body || '', -0.27, -0.22, 0.034, '800', C.bg, 'left', 'alphabetic');
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-0.27, -0.12 + i * 0.07); c.lineTo(0.2 - (i % 2) * 0.12, -0.12 + i * 0.07); S(c, 0.015, '#9a958c'); }
    if (o.signK) { c.beginPath(); const k = o.signK; for (let i = 0; i <= 30 * k; i++) { const x = -0.25 + i * 0.012, y = 0.3 + Math.sin(i * 0.9) * 0.03 - i * 0.002; i ? c.lineTo(x, y) : c.moveTo(x, y); } S(c, 0.012, C.bg); }
    if (o.date) { T(c, o.date, 0.08, 0.33, 0.07, '900', C.bg, 'left', 'alphabetic');
      if (o.circleK) { c.beginPath(); c.ellipse(0.17, 0.31, 0.15, 0.07, -0.1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * o.circleK); S(c, 0.015, C.red); } }
  },
  ear(c, o) {
    c.beginPath(); c.moveTo(0.1, 0.35); c.bezierCurveTo(-0.05, 0.4, -0.12, 0.25, -0.12, 0.15); c.bezierCurveTo(-0.12, 0.02, -0.25, -0.05, -0.25, -0.15);
    c.bezierCurveTo(-0.25, -0.38, 0.0, -0.45, 0.13, -0.35); c.bezierCurveTo(0.27, -0.25, 0.2, -0.08, 0.1, 0.0); S(c, 0.07);
    c.beginPath(); c.arc(-0.03, -0.15, 0.08, Math.PI, Math.PI * 2.2); S(c, 0.045);
  },
  map(c, o) {
    const k = o.drawK ?? 1;
    const pin = (x, y, col) => { c.beginPath(); c.arc(x, y - 0.1, 0.07, Math.PI, 0); c.lineTo(x, y); c.closePath(); W(c, col); circ(c, x, y - 0.1, 0.025); B(c); };
    pin(-0.38, 0.15, C.w); if (k > 0.95) pin(0.38, -0.05, C.gold);
    c.save(); c.setLineDash([0.04, 0.035]); c.beginPath(); c.moveTo(-0.38, 0.05); c.quadraticCurveTo(0, -0.35, -0.38 + 0.76 * k, 0.05 - 0.2 * k); S(c, 0.018); c.restore();
    if (o.label && k > 0.6) T(c, o.label, 0, 0.32, 0.1, '900', C.w);
  },
  peephole(c, o) {
    circ(c, 0, 0, 0.42); S(c, 0.05); circ(c, 0, 0, 0.34); S(c, 0.02);
    const d = o.darkK || 0;
    circ(c, 0, 0, 0.32); c.fillStyle = `rgba(245,196,81,${0.18 * (1 - d)})`; c.fill();
    if (o.eyeK) { c.save(); c.globalAlpha *= o.eyeK; ICONS.eye(c, { col: C.red }); c.restore(); }
  },
  eye(c, o) {
    c.beginPath(); c.moveTo(-0.42, 0); c.quadraticCurveTo(0, -0.34, 0.42, 0); c.quadraticCurveTo(0, 0.34, -0.42, 0); c.closePath(); W(c);
    circ(c, 0, 0, 0.14); c.fillStyle = o.col || C.bg; c.fill(); circ(c, 0, 0, 0.06); B(c); circ(c, 0.04, -0.04, 0.025); W(c);
  },
  frame(c, o) {
    rr(c, -0.36, -0.44, 0.72, 0.88, 0.02); S(c, 0.05); rr(c, -0.28, -0.36, 0.56, 0.72, 0.01); S(c, 0.015);
    T(c, 'IN MEMORIA DI', 0, -0.2, 0.05, '800', C.w); T(c, 'A. BRUNI', 0, -0.08, 0.075, '900', C.w); T(c, o.text || '', 0, 0.12, 0.12, '900', C.red);
    c.beginPath(); c.moveTo(-0.08, 0.24); c.lineTo(0.08, 0.24); c.moveTo(0, 0.18); c.lineTo(0, 0.32); S(c, 0.02);
  },
  elevator(c, o) {
    const open = o.openK ?? 0, sink = o.sinkK || 0;
    rr(c, -0.36, -0.45, 0.72, 0.92, 0.02); S(c, 0.04);
    rr(c, -0.1, -0.56, 0.2, 0.07, 0.02); W(c);
    if (open > 0) { c.save(); c.shadowColor = C.gold; c.shadowBlur = 50; rr(c, -0.31, -0.4 + sink * 0.04, 0.62, 0.82, 0.01); c.fillStyle = `rgba(245,196,81,${0.55 * open})`; c.fill(); c.restore(); }
    const dw = 0.31 * (1 - open);
    rr(c, -0.31, -0.4, dw, 0.82, 0.01); W(c); rr(c, 0.31 - dw, -0.4, dw, 0.82, 0.01); W(c);
    c.beginPath(); c.moveTo(-0.31 + dw, -0.4); c.lineTo(-0.31 + dw, 0.42); S(c, 0.012, C.bg);
  },
};

// sound arcs around a ringing thing
export function rings(c, ph, col) {
  for (let s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const a = (ph + i * 0.5) % 1; c.save(); c.globalAlpha *= 1 - a; c.beginPath(); c.arc(0, 0, 0.42 + a * 0.25, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5); S(c, 0.03, col); c.restore();
  }
}
