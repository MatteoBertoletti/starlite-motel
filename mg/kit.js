// Second element kit (Shorts 009-022): hook card, phone lists/chats, floor plan, stairwell, table, alarm, camera, gallery...
// Every element is a pure function of (lt = seconds into the line, tt = film time). Word keys: true = always, 'word' = when it is spoken.
import { ICONS, C } from './icons.js';
let H; export const setH = h => { H = h; };
const cl = x => Math.max(0, Math.min(1, x));
const TX = (c, s, x, y, sz, wt, col, al = 'center', sp = 0) => H.txt(c, s, x, y, sz, wt, col, al, 'middle', sp);
const fitSz = (c, s, maxW, sz, wt) => { c.font = `${wt} ${sz}px Montserrat`; const w = c.measureText(s).width; return w > maxW ? sz * maxW / w : sz; };
const TF = (c, s, x, y, sz, maxW, wt, col, al = 'center', sp = 0) => TX(c, s, x, y, fitSz(c, s, maxW, sz, wt), wt, col, al, sp);
const RR = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const GL = (c, n, b) => { c.shadowColor = glowOf(n); c.shadowBlur = b; };
const NG = c => { c.shadowBlur = 0; };
const OR = '#ff9a2e', BL = '#4aa3ff', GR = '#27a85c', DIM = '#8d8981';
const colOf = n => ({ red: C.red, gold: C.gold, green: C.green, dim: DIM, blue: BL, orange: OR, white: C.w }[n] || n || C.w);
const glowOf = n => n === 'red' ? 'rgba(229,50,45,0.95)' : n === 'gold' ? 'rgba(245,196,81,0.95)' : n === 'blue' ? 'rgba(74,163,255,.9)' : n === 'orange' ? 'rgba(255,154,46,.95)' : n === 'green' ? 'rgba(127,217,160,.9)' : 'rgba(242,239,232,0.75)';
const T_ = (L, el, v) => v === undefined || v === null || v === false ? null : v === true ? -99 : H.at(L, v) + (el._dt || 0);
const K = (L, el, k) => T_(L, el, el[k]);
const isOn = (L, el, lt, k) => { const t = K(L, el, k); return t !== null && lt >= t; };
const since = (L, el, lt, k, d = 0.3) => { const t = K(L, el, k); return t === null ? 0 : cl((lt - t) / d); };
const t0Of = (L, el) => el.at !== undefined ? H.at(L, el.at) + (el._dt || 0) : 0;
const heart = (c, x, y, s, col) => { c.beginPath(); c.moveTo(x, y + s * 0.4); c.bezierCurveTo(x - s * 0.95, y - s * 0.2, x - s * 0.5, y - s * 0.9, x, y - s * 0.4); c.bezierCurveTo(x + s * 0.5, y - s * 0.9, x + s * 0.95, y - s * 0.2, x, y + s * 0.4); c.fillStyle = col; c.fill(); };
const wifi = (c, x, y, s, n, col) => { for (let i = 0; i < 4; i++) { c.fillStyle = i < n ? col : 'rgba(242,239,232,0.22)'; c.fillRect(x + i * s * 0.34, y - (i + 1) * s * 0.22, s * 0.24, (i + 1) * s * 0.22); } };
const phone = (c, w, h, u, lit = true) => { RR(c, -w / 2, -h / 2, w, h, u * 7); c.fillStyle = '#111114'; c.fill(); c.lineWidth = u * 1.1; c.strokeStyle = '#d9d5cc'; c.stroke(); NG(c);
  if (lit) { const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#152434'); g.addColorStop(1, '#07090d'); RR(c, -w / 2 + u * 2, -h / 2 + u * 2, w - u * 4, h - u * 4, u * 5.5); c.fillStyle = g; c.fill(); } };
const person = (c, x, y, r, col, glow) => { c.save(); if (glow) { c.shadowColor = glow; c.shadowBlur = 18; } c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - r * 1.9, y + r * 3.4); c.bezierCurveTo(x - r * 1.9, y + r * 1.3, x - r, y + r * 1.15, x, y + r * 1.15); c.bezierCurveTo(x + r, y + r * 1.15, x + r * 1.9, y + r * 1.3, x + r * 1.9, y + r * 3.4); c.closePath(); c.fill(); c.restore(); };
const PLACE = { salotto: [-18, -26], cucina: [20, -26], corridoio: [-18, 0], porta: [-18, 4.2], camera: [-18, 26], bagno: [20, 26], router: [10, 0], letto: [-24, 30] };

export const SCN = {
  // ---------- frame 0: a huge notification card ----------
  hook(c, el, L, lt, tt, size) {
    const u = size / 40, W2 = 46 * u, lines = (el.lines || []).map(l => typeof l === 'string' ? { t: l } : l);
    let used = 14 + (el.tag ? 9 : 0) + lines.reduce((a, l) => a + (l.s || 11.5) * 1.2, 0) + (el.foot ? 11 : 0) + 4;
    const hh = Math.max(used, el.minh || 64), top = -hh * u / 2 + (el.dy || 0) * u;
    if (el.title) { c.save(); GL(c, 'red', 24); TF(c, el.title, 0, top - 9 * u, u * 6.4, W2 * 2.2, '900', C.red, 'center', 3); c.restore(); }
    c.save(); GL(c, el.g || 'white', 40); RR(c, -W2, top, 2 * W2, hh * u, 5 * u); c.fillStyle = '#1f1f24'; c.fill(); c.restore();
    c.lineWidth = u * 0.5; c.strokeStyle = 'rgba(242,239,232,0.6)'; RR(c, -W2, top, 2 * W2, hh * u, 5 * u); c.stroke();
    RR(c, -W2 + 4 * u, top + 4 * u, 6 * u, 6 * u, 1.5 * u); c.fillStyle = colOf(el.bc || 'gold'); c.fill(); TF(c, el.app || '', -W2 + 12 * u, top + 7 * u, u * 3, 50 * u, '900', '#cfcac0', 'left', 2);
    if (el.time) TX(c, el.time, W2 - 4 * u, top + 7 * u, u * 3, '800', DIM, 'right');
    if (el.bars) wifi(c, W2 - 18 * u, top + 9 * u, u * 6, el.bars, C.red);
    if (el.dot) { c.save(); const p = 1 + 0.12 * Math.sin(tt * 6); GL(c, el.dot, 40); c.beginPath(); c.arc(W2 - 9 * u, top + 11 * u, 5.6 * u * p, 0, 7); c.fillStyle = colOf(el.dot); c.fill(); c.restore(); }
    let y = top + 14 * u + (hh - used) * u / 2;
    if (el.tag) { TF(c, el.tag, -W2 + 4 * u, y + 3 * u, u * 5.4, 2 * W2 - 8 * u, '900', C.gold, 'left', 3); y += 9 * u; }
    for (const l of lines) { const s = l.s || 11.5, cy = y + s * 0.6 * u; c.save(); if (l.col === 'red') GL(c, 'red', 26); TF(c, l.t, -W2 + 4 * u, cy, u * s, 2 * W2 - 8 * u, '900', colOf(l.col), 'left'); c.restore(); y += s * 1.2 * u; }
    if (el.foot) { c.save(); if (el.fcol === 'red') GL(c, 'red', 22); TF(c, el.foot, -W2 + 4 * u, y + 5 * u, u * 5, 2 * W2 - 8 * u, '900', colOf(el.fcol || 'dim'), 'left', 1); c.restore(); }
  },
  // ---------- a phone showing a list (members, alarms, apps, wifi...) ----------
  plist(c, el, L, lt, tt, size) {
    const h = size * 2.2 * (el.hs || 1), w = h * 0.49, u = w / 50; phone(c, w, h, u);
    TF(c, el.title || '', -w / 2 + u * 7, -h / 2 + u * 9, u * 4.6, w - u * 14, '900', C.w, 'left');
    if (el.sub) TF(c, el.sub, -w / 2 + u * 7, -h / 2 + u * 14.2, u * 3, w - u * 14, '700', DIM, 'left');
    const rh = (el.rh || 11) * u, y0 = -h / 2 + u * (el.sub ? 22 : 19);
    (el.rows || []).forEach((r, i) => { const t = r.at === undefined ? -99 : T_(L, el, r.at); if (lt < t) return; const k = cl((lt - t) / 0.22), y = y0 + i * rh;
      const hot = r.hot !== undefined && isOn(L, { ...el, h: r.hot, _dt: el._dt }, lt, 'h'), red = hot || r.col === 'red';
      c.save(); c.globalAlpha *= k; c.translate((1 - k) * 10 * u, 0);
      RR(c, -w / 2 + u * 3.5, y - rh / 2 + u * 0.6, w - u * 7, rh - u * 1.2, u * 2.4); c.fillStyle = hot ? 'rgba(229,50,45,0.22)' : 'rgba(242,239,232,0.1)'; c.fill();
      if (hot) { c.save(); GL(c, 'red', 22); c.lineWidth = u * 0.7; c.strokeStyle = C.red; c.stroke(); c.restore(); }
      let tx = -w / 2 + u * 7;
      if (r.av) { c.beginPath(); c.arc(tx + u * 3.6, y, u * 3.6, 0, 7); c.fillStyle = red ? 'rgba(229,50,45,0.35)' : 'rgba(242,239,232,0.2)'; c.fill(); TX(c, r.av, tx + u * 3.6, y, u * 4, '900', red ? C.red : C.w); tx += u * 9.5; }
      TF(c, r.t, tx, r.sub ? y - u * 2 : y, u * (r.sz || 3.9), w - u * 16 - (tx + w / 2), '800', red ? C.red : colOf(r.col), 'left');
      if (r.sub) TF(c, r.sub, tx, y + u * 3, u * 2.8, w - u * 16 - (tx + w / 2), '700', DIM, 'left');
      if (r.r) TX(c, r.r, w / 2 - u * 6, y, u * 3.2, '800', DIM, 'right');
      if (r.bars !== undefined) wifi(c, w / 2 - u * 14, y + u * 3, u * 9, r.bars, r.bars >= 4 ? C.red : C.w);
      c.restore(); });
  },
  // ---------- a chat ----------
  chatg(c, el, L, lt, tt, size) {
    const h = size * 2.2 * (el.hs || 1), w = h * 0.49, u = w / 50; phone(c, w, h, u);
    c.beginPath(); c.arc(-w / 2 + u * 9, -h / 2 + u * 9, u * 3.6, 0, 7); c.fillStyle = 'rgba(242,239,232,0.25)'; c.fill();
    TF(c, el.title || '', -w / 2 + u * 15, -h / 2 + u * 9, u * 4.2, w - u * 24, '900', C.w, 'left');
    let y = -h / 2 + u * 19; const step = (el.step || 13) * u;
    (el.msgs || []).forEach((m, i) => { const t = m.at === undefined ? -99 : T_(L, el, m.at); if (lt < t) return; const k = cl((lt - t) / 0.2), me = m.who === 'me', s = u * (m.sz || 3.8);
      c.font = `800 ${s}px Montserrat`; const bw = Math.min(w - u * 10, c.measureText(m.t).width + u * 7), bx = me ? w / 2 - u * 4 - bw : -w / 2 + u * 4, by = y + (m.n ? u * 3 : 0);
      c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 8 * u);
      if (m.n) TX(c, m.n, bx + u * 1, y + u * 0.4, u * 2.6, '800', m.col === 'red' ? C.red : DIM, 'left');
      c.save(); if (m.col === 'red') GL(c, 'red', 22); RR(c, bx, by, bw, u * 8.6, u * 3); c.fillStyle = m.col === 'red' ? 'rgba(229,50,45,0.9)' : me ? '#1f4d3a' : '#2a2a30'; c.fill(); c.restore();
      TX(c, m.t, bx + bw / 2, by + u * 4.4, s, '800', C.w);
      if (m.react) { const rt = T_(L, el, m.react); if (rt !== null && lt >= rt) { const kk = H.backOut(cl((lt - rt) / 0.35)); c.save(); c.translate(bx + bw - u * 2, by + u * 8.6); c.scale(kk, kk); GL(c, 'red', 24); c.beginPath(); c.arc(0, 0, u * 3.2, 0, 7); c.fillStyle = '#1f1f24'; c.fill(); c.lineWidth = u * 0.4; c.strokeStyle = C.red; c.stroke(); heart(c, 0, 0.3 * u, u * 2.4, C.red); c.restore(); } }
      c.restore(); y += step + (m.n ? u * 3 : 0); });
    if (el.typing) { const t = T_(L, el, el.typing); if (t !== null && lt >= t) for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(-w / 2 + u * 9 + j * u * 3.4, y + u * 4, u * 1.1 * (0.7 + 0.3 * Math.sin(tt * 8 + j)), 0, 7); c.fillStyle = DIM; c.fill(); } }
  },
  // ---------- a big number: marks / countdown ----------
  counter(c, el, L, lt, tt, size) {
    const u = size / 40; let v = el.v ?? '', t0 = -99;
    if (el.vals) { v = ''; for (const [val, w] of el.vals) { const t = T_(L, el, w); if (t !== null && lt >= t) { v = val; t0 = t; } } }
    if (el.down) { const d = el.down, ts = T_(L, el, d.at) ?? 0, k = cl((lt - ts) / d.dur); v = String(Math.ceil(d.from + (d.to - d.from) * k)); t0 = ts; }
    const kk = lt - t0, pop = t0 > -90 ? 1 + 0.3 * (1 - H.easeOut(kk / 0.22)) : 1, col = colOf(el.col || 'white');
    if (el.label) TX(c, el.label, 0, -(el.sz || 24) * 0.62 * u, u * 4.2, '900', DIM, 'center', 4);
    c.save(); c.scale(pop, pop); GL(c, el.col || 'white', 34); TX(c, v, 0, 0, u * (el.sz || 24), '900', col); c.restore();
    if (el.unit) TX(c, el.unit, 0, (el.sz || 24) * 0.62 * u, u * 5, '900', DIM, 'center', 4);
  },
  // ---------- the flat from above, with moving dots ----------
  mapz(c, el, L, lt, tt, size) {
    const u = size / 40, R = { salotto: [-38, -46, 38, 40, 'SALOTTO'], cucina: [2, -46, 36, 40, 'CUCINA'], corridoio: [-38, -6, 76, 12, ''], camera: [-38, 6, 38, 40, 'CAMERA'], bagno: [2, 6, 36, 40, 'BAGNO'] };
    for (const [key, [x, y, w, h, lab]] of Object.entries(R)) { c.save(); const hot = el.hot === key; if (hot) GL(c, 'red', 30); c.lineWidth = u * 0.8; c.strokeStyle = hot ? C.red : 'rgba(242,239,232,0.7)'; c.strokeRect(x * u, y * u, w * u, h * u); c.restore(); if (lab) TX(c, lab, (x + 2) * u, (y + 4) * u, u * 3, '900', hot ? C.red : '#6f6c66', 'left', 3); }
    c.fillStyle = C.w; c.fillRect(-22 * u, 5.4 * u, 8 * u, 1.3 * u); // your door, closed
    if (el.router) { const [rx, ry] = PLACE.router; c.save(); GL(c, 'white', 14); RR(c, (rx - 3) * u, (ry - 1.4) * u, 6 * u, 2.8 * u, u * 0.7); c.fillStyle = C.w; c.fill(); c.fillRect((rx - 2.4) * u, (ry - 4) * u, 0.5 * u, 2.6 * u); c.fillRect((rx + 1.9) * u, (ry - 4) * u, 0.5 * u, 2.6 * u); c.restore(); TX(c, 'ROUTER', rx * u, (ry + 5.6) * u, u * 2.6, '900', DIM, 'center', 2);
      for (let j = 0; j < 2; j++) { const ph = (tt * 0.5 + j / 2) % 1; c.beginPath(); c.arc(rx * u, ry * u, (3 + ph * 14) * u, 0, 7); c.strokeStyle = `rgba(242,239,232,${0.35 * (1 - ph)})`; c.lineWidth = u * 0.4; c.stroke(); } }
    for (const d of el.dots || []) {
      let p = PLACE[d.at], prev = p; const pts = [p];
      for (const [pl, w] of d.path || []) { const t = T_(L, el, w); if (t === null || lt < t) break; const to = PLACE[pl], k = H.easeOut(cl((lt - t) / 0.7)); prev = p; p = [p[0] + (to[0] - p[0]) * k, p[1] + (to[1] - p[1]) * k]; pts.push(to); if (k < 1) break; p = to; }
      c.save(); c.lineWidth = u * 0.5; c.setLineDash([u * 1.2, u * 1.2]); c.strokeStyle = glowOf(d.c).replace('0.95', '0.5').replace('.9)', '.5)'); c.beginPath(); pts.forEach((q, j) => j ? c.lineTo(q[0] * u, q[1] * u) : c.moveTo(q[0] * u, q[1] * u)); c.lineTo(p[0] * u, p[1] * u); c.stroke(); c.restore();
      const ph = (tt * 0.9) % 1; c.save(); GL(c, d.c, 24); c.beginPath(); c.arc(p[0] * u, p[1] * u, (d.r || 2.6) * u, 0, 7); c.fillStyle = colOf(d.c); c.fill(); c.restore();
      c.beginPath(); c.arc(p[0] * u, p[1] * u, (2.6 + ph * 6) * u, 0, 7); c.strokeStyle = glowOf(d.c).replace(/[\d.]+\)$/, `${0.6 * (1 - ph)})`); c.lineWidth = u * 0.5; c.stroke();
      TX(c, d.n, p[0] * u, (p[1] - 5.2) * u, u * 2.8, '900', colOf(d.c), 'center', 2);
      if (d.sig) { const t = T_(L, el, d.sig); if (t !== null && lt >= t) { for (let j = 0; j < 3; j++) { const q = ((lt - t) * 0.7 + j / 3) % 1; c.beginPath(); c.arc(p[0] * u, p[1] * u, (4 + q * 22) * u, 0, 7); c.strokeStyle = `rgba(242,239,232,${0.45 * (1 - q)})`; c.lineWidth = u * 0.5; c.stroke(); } wifi(c, (p[0] + 4) * u, (p[1] + 2) * u, u * 8, 4, C.red); } }
      if (d.ring) { const t = T_(L, el, d.ring); if (t !== null && lt >= t) { const k = cl((lt - t) / 0.4), ox = (d.off?.[0] ?? 0) * u, oy = (d.off?.[1] ?? -7) * u; c.save(); GL(c, 'red', 30); c.beginPath(); c.arc(p[0] * u + ox, p[1] * u + oy, 6.5 * u * (1 + 0.1 * Math.sin(tt * 7)), 0, 7 * k); c.lineWidth = u * 0.9; c.strokeStyle = C.red; c.stroke(); wifi(c, p[0] * u + ox - 3 * u, p[1] * u + oy + 2.5 * u, u * 6, 4, C.red); c.restore(); } }
    }
    if (el.head) { c.save(); RR(c, -40 * u, -56 * u, 80 * u, 7.4 * u, 3.7 * u); c.fillStyle = '#1c1c21'; c.fill(); c.beginPath(); c.arc(-35 * u, -52.3 * u, 1.6 * u, 0, 7); c.fillStyle = colOf(el.hc || 'blue'); c.fill(); TF(c, el.head, -31 * u, -52.3 * u, u * 3.6, 66 * u, '900', C.w, 'left'); c.restore(); }
  },
  // ---------- a cat's face, eyes that follow a path ----------
  catface(c, el, L, lt, tt, size) {
    const u = size / 40; let gx = 0, gy = 0, pts = el.gaze || [[true, 0, 0]], px = 0, py = 0, pt = -99;
    for (const [w, x, y] of pts) { const t = T_(L, el, w); if (t === null) continue; if (lt >= t) { const k = H.easeOut(cl((lt - t) / 0.9)); gx = px + (x - px) * k; gy = py + (y - py) * k; px = x; py = y; } }
    if (pts.length) { /* resolve: last reached target blended */ let lastT = -99, lx = 0, ly = 0, fx = 0, fy = 0; for (const [w, x, y] of pts) { const t = T_(L, el, w); if (t !== null && lt >= t) { fx = lx; fy = ly; lastT = t; lx = x; ly = y; } } const k = H.easeOut(cl((lt - lastT) / 0.9)); gx = fx + (lx - fx) * k; gy = fy + (ly - fy) * k; }
    c.save(); c.fillStyle = C.w; GL(c, 'white', 30);
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 8 * u, -10 * u); c.lineTo(sd * 18 * u, -26 * u); c.lineTo(sd * 20 * u, -4 * u); c.closePath(); c.fill(); }
    c.beginPath(); c.ellipse(0, 0, 21 * u, 17 * u, 0, 0, 7); c.fill(); NG(c);
    for (const sd of [-1, 1]) { const ex = sd * 9 * u, ey = -2 * u; c.fillStyle = '#0b0b0d'; c.beginPath(); c.ellipse(ex, ey, 5.6 * u, 6.2 * u, 0, 0, 7); c.fill(); c.save(); GL(c, el.eye || 'gold', 18); c.fillStyle = colOf(el.eye || 'gold'); c.beginPath(); c.ellipse(ex, ey, 4.6 * u, 5.2 * u, 0, 0, 7); c.fill(); c.restore();
      c.fillStyle = '#050506'; c.beginPath(); c.ellipse(ex + gx * u * 2.6, ey + gy * u * 2.2, 1.1 * u, 4.2 * u, 0, 0, 7); c.fill(); }
    c.fillStyle = '#e58c8c'; c.beginPath(); c.moveTo(-1.6 * u, 6 * u); c.lineTo(1.6 * u, 6 * u); c.lineTo(0, 8 * u); c.closePath(); c.fill();
    c.strokeStyle = '#2a2a2e'; c.lineWidth = u * 0.4; for (const sd of [-1, 1]) for (const dy of [-1, 1]) { c.beginPath(); c.moveTo(sd * 6 * u, (8 + dy) * u); c.lineTo(sd * 20 * u, (8 + dy * 3) * u); c.stroke(); }
    c.restore();
  },
  // ---------- the bed from above: mattress dip, a cat, a dashed red path ----------
  bedtop(c, el, L, lt, tt, size) {
    const u = size / 40; c.fillStyle = '#12151c'; c.fillRect(-32 * u, -42 * u, 64 * u, 84 * u); c.lineWidth = u * 0.5; c.strokeStyle = 'rgba(242,239,232,0.25)'; c.strokeRect(-30 * u, -40 * u, 60 * u, 80 * u);
    c.fillStyle = '#2a2a33'; c.fillRect(-15 * u, -22 * u, 30 * u, 52 * u); c.fillStyle = '#d9d5cc'; RR(c, -11 * u, -20 * u, 22 * u, 8 * u, 2 * u); c.fill();
    c.fillStyle = '#5a6b7d'; RR(c, -9 * u, -6 * u, 18 * u, 32 * u, 3 * u); c.fill(); c.fillStyle = C.w; c.beginPath(); c.arc(0, -10 * u, 4 * u, 0, 7); c.fill();
    const dk = since(L, el, lt, 'dip', 0.9); if (dk > 0) { const g = c.createRadialGradient(-11 * u, 8 * u, 1, -11 * u, 8 * u, 14 * u); g.addColorStop(0, `rgba(0,0,0,${0.75 * dk})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-15 * u, -6 * u, 18 * u, 28 * u);
      c.strokeStyle = `rgba(229,50,45,${0.7 * dk})`; c.lineWidth = u * 0.5; for (let j = 1; j <= 3; j++) { c.beginPath(); c.ellipse(-11 * u, 8 * u, j * 3.4 * u * dk, j * 4.6 * u * dk, 0, 0, 7); c.stroke(); } }
    const mv = since(L, el, lt, 'catmove', 0.8), cx = (el.catx ?? 9) + (el.catto ?? 0) * H.easeOut(mv), cy = el.caty ?? 20;
    if (el.cat !== false) { c.save(); GL(c, 'white', 16); c.fillStyle = '#e8e4da'; c.beginPath(); c.ellipse(cx * u, cy * u, 4.4 * u, 6 * u, 0, 0, 7); c.fill(); c.beginPath(); c.arc(cx * u, (cy - 6.4) * u, 3 * u, 0, 7); c.fill();
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo((cx + sd * 1) * u, (cy - 8.4) * u); c.lineTo((cx + sd * 3.2) * u, (cy - 10.6) * u); c.lineTo((cx + sd * 3.2) * u, (cy - 7.6) * u); c.fill(); } c.restore(); }
    const dt = T_(L, el, el.dash); if (dt !== null && lt >= dt) { const k = cl((lt - dt) / (el.dur || 1.6)); const P = [[27, -34], [26, -12], [18, 4], [16, 14]]; let tot = 0; const seg = []; for (let j = 1; j < P.length; j++) { const d = Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]); seg.push(d); tot += d; }
      c.save(); GL(c, 'red', 18); c.strokeStyle = C.red; c.lineWidth = u * 0.9; c.setLineDash([u * 1.6, u * 1.2]); c.lineDashOffset = -tt * 8; c.beginPath(); c.moveTo(P[0][0] * u, P[0][1] * u); let acc = 0;
      for (let j = 1; j < P.length; j++) { const f = cl((k * tot - acc) / seg[j - 1]); c.lineTo((P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f) * u, (P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f) * u); acc += seg[j - 1]; if (f < 1) break; } c.stroke(); c.restore(); }
  },
  // ---------- the stairwell in section: floors, buttons, a climbing figure ----------
  tower(c, el, L, lt, tt, size) {
    const u = size / 40, fh = 16, n = 5, y0 = 40; c.lineWidth = u * 0.8; c.strokeStyle = 'rgba(242,239,232,0.7)'; c.strokeRect(-26 * u, (y0 - n * fh) * u, 52 * u, n * fh * u);
    for (let f = 0; f < n; f++) { const yb = (y0 - f * fh) * u, yt = (y0 - (f + 1) * fh) * u; if (f) { c.beginPath(); c.moveTo(-26 * u, yb); c.lineTo(26 * u, yb); c.strokeStyle = 'rgba(242,239,232,0.4)'; c.lineWidth = u * 0.5; c.stroke(); }
      c.strokeStyle = 'rgba(242,239,232,0.6)'; c.lineWidth = u * 0.6; c.strokeRect(-23 * u, yb - 11 * u, 6 * u, 11 * u); TX(c, f ? String(f) : 'PT', -20 * u, yt + 3.2 * u, u * 3, '900', f === 4 ? C.gold : '#6f6c66');
      let lit = false; for (const [fl, w] of el.lit || []) if (fl === f) { const t = T_(L, el, w); if (t !== null && lt >= t) lit = true; }
      c.save(); if (lit) GL(c, 'orange', 34); c.beginPath(); c.arc(20 * u, yb - 6 * u, 2 * u, 0, 7); c.fillStyle = lit ? OR : 'rgba(255,154,46,0.25)'; c.fill(); c.restore(); }
    let fl = 0, from = 0, tk = 1; for (const [f, w] of el.path || []) { const t = T_(L, el, w); if (t !== null && lt >= t) { from = fl; fl = f; tk = H.easeOut(cl((lt - t) / 0.5)); } }
    const fy = (from + (fl - from) * tk), py = (y0 - fy * fh - 2) * u, px = -4 * u + (fy % 2 ? 6 : 0) * u; if (el.path) { c.save(); GL(c, 'white', 16); person(c, px, py - 5 * u, 2.2 * u, C.w); c.restore(); }
  },
  // ---------- the light button on the landing ----------
  lbtn(c, el, L, lt, tt, size) {
    const u = size / 40, k = since(L, el, lt, 'lit', 0.25), p = since(L, el, lt, 'press', 0.2);
    c.save(); GL(c, 'white', 18); RR(c, -18 * u, -26 * u, 36 * u, 52 * u, 4 * u); c.fillStyle = '#26262b'; c.fill(); c.lineWidth = u * 0.6; c.strokeStyle = '#d9d5cc'; c.stroke(); c.restore();
    c.save(); const on = Math.max(k, p); GL(c, 'orange', 10 + 60 * on); c.beginPath(); c.arc(0, 0, 9 * u * (1 - 0.06 * p), 0, 7); c.fillStyle = on > 0 ? OR : 'rgba(255,154,46,0.3)'; c.fill(); c.restore();
    c.beginPath(); c.arc(0, 0, 12 * u, 0, 7); c.lineWidth = u * 0.6; c.strokeStyle = on > 0 ? OR : 'rgba(255,154,46,0.35)'; c.stroke();
    if (on > 0) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(0, 0, 4 * u, 0, 0, 40 * u); g.addColorStop(0, 'rgba(255,154,46,0.5)'); g.addColorStop(1, 'rgba(255,154,46,0)'); c.fillStyle = g; c.fillRect(-44 * u, -44 * u, 88 * u, 88 * u); c.restore(); }
    TX(c, 'LUCE', 0, 19.5 * u, u * 3.4, '900', DIM, 'center', 3); if (el.num) TX(c, el.num, 0, -19.5 * u, u * 5, '900', C.gold);
  },
  // ---------- the fridge in a dark kitchen, the "door open" alarm ----------
  fridgeK(c, el, L, lt, tt, size) {
    const u = size / 40; c.fillStyle = 'rgba(242,239,232,0.08)'; c.fillRect(-60 * u, 40 * u, 120 * u, 0.5 * u);
    c.save(); GL(c, 'white', 20); RR(c, -15 * u, -42 * u, 30 * u, 82 * u, 3 * u); c.fillStyle = '#e9e5dc'; c.fill(); c.restore(); c.fillStyle = '#0a0a0c'; c.fillRect(-15 * u, -12 * u, 30 * u, 0.9 * u);
    const hk = since(L, el, lt, 'handle', 0.35); c.save(); c.translate(9 * u, -28 * u); c.rotate(-0.35 * hk + (hk > 0 && hk < 1 ? Math.sin(tt * 60) * 0.05 : 0)); c.fillStyle = '#0a0a0c'; RR(c, -1.1 * u, -7 * u, 2.2 * u, 14 * u, 1 * u); c.fill(); c.restore();
    c.fillStyle = '#0a0a0c'; RR(c, 9 * u - 1.1 * u, -5 * u, 2.2 * u, 12 * u, 1 * u); c.fill();
    const al = !el.off, flash = al && (Math.floor(tt * 2) % 2 === 0 || isOn(L, el, lt, 'beep') && Math.sin(tt * 40) > 0);
    c.fillStyle = '#050506'; RR(c, -11 * u, -38 * u, 17 * u, 9 * u, 1.2 * u); c.fill();
    if (al) { c.save(); if (flash) GL(c, 'red', 20); TF(c, 'PORTA', -2.5 * u, -35.6 * u, u * 3, 14 * u, '900', flash ? C.red : '#5a1d1b'); TF(c, 'APERTA', -2.5 * u, -32 * u, u * 3, 14 * u, '900', flash ? C.red : '#5a1d1b'); c.restore(); }
    if (hk > 0) { c.save(); GL(c, 'gold', 24); c.fillStyle = C.gold; c.globalAlpha *= hk; c.fillRect(14.6 * u, -42 * u, 0.9 * u * hk * 2, 52 * u); c.restore(); }
    if (el.beeps) for (const w of el.beeps) { const t = T_(L, el, w); if (t !== null && lt >= t && lt < t + 0.9) { const q = (lt - t) / 0.9; for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(-2.5 * u, -33 * u, (8 + (q + j * 0.3) * 22) * u, -0.9, 0.9 + 1.2); c.strokeStyle = `rgba(229,50,45,${0.6 * (1 - q)})`; c.lineWidth = u * 0.6; c.stroke(); } } }
  },
  // ---------- fridge shelves bending ----------
  shelves(c, el, L, lt, tt, size) {
    const u = size / 40, bend = since(L, el, lt, 'bend', 1.2), gone = since(L, el, lt, 'gone', 0.5);
    c.save(); GL(c, 'white', 16); RR(c, -24 * u, -40 * u, 48 * u, 80 * u, 3 * u); c.fillStyle = '#10161c'; c.fill(); c.lineWidth = u * 0.7; c.strokeStyle = '#d9d5cc'; c.stroke(); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, -40 * u, 0, 40 * u); g.addColorStop(0, 'rgba(160,215,255,0.22)'); g.addColorStop(1, 'rgba(160,215,255,0)'); c.fillStyle = g; c.fillRect(-24 * u, -40 * u, 48 * u, 80 * u); c.restore();
    for (let j = 0; j < 4; j++) { if (j === 2 && gone > 0) continue; const y = (-24 + j * 18) * u, a = bend * (3 + j) * u * (1 + 0.15 * Math.sin(tt * 2 + j)); c.beginPath(); c.moveTo(-22 * u, y); c.quadraticCurveTo(0, y + a * 2, 22 * u, y); c.lineWidth = u * 1.1; c.strokeStyle = C.w; c.stroke(); }
    if (gone > 0 && gone < 1) { const y = (-24 + 36) * u; c.save(); c.globalAlpha = 1 - gone; c.beginPath(); c.moveTo(-22 * u, y); c.lineTo(22 * u, y); c.strokeStyle = C.red; c.lineWidth = u * 1.1; c.stroke(); c.restore(); }
  },
  // ---------- the table from above: plates, people, the sixth place ----------
  tableTop(c, el, L, lt, tt, size) {
    const u = size / 40; c.save(); GL(c, 'white', 14); c.beginPath(); c.arc(0, 0, 31 * u, 0, 7); c.fillStyle = '#26211c'; c.fill(); c.lineWidth = u * 0.7; c.strokeStyle = 'rgba(242,239,232,0.7)'; c.stroke(); c.restore();
    const six = since(L, el, lt, 'six', 0.4);
    for (let k = 0; k < 6; k++) { const a = (-90 + 60 * k) * Math.PI / 180, last = k === 3, px = Math.cos(a) * 20 * u, py = Math.sin(a) * 20 * u, hx = Math.cos(a) * 41 * u, hy = Math.sin(a) * 41 * u;
      c.save(); if (last && six > 0) GL(c, 'red', 26 * six); c.beginPath(); c.arc(px, py, 7 * u, 0, 7); c.fillStyle = '#eceae3'; c.fill(); c.beginPath(); c.arc(px, py, 4.6 * u, 0, 7); c.strokeStyle = '#b9b5ab'; c.lineWidth = u * 0.4; c.stroke();
      if (last && six > 0) { c.beginPath(); c.arc(px, py, 10.5 * u, 0, 7 * six); c.lineWidth = u * 0.8; c.strokeStyle = C.red; c.stroke(); } c.restore();
      if (!last) { c.save(); c.translate(hx, hy); c.fillStyle = C.w; GL(c, 'white', 14); c.beginPath(); c.arc(0, 0, 4.2 * u, 0, 7); c.fill(); c.rotate(a + Math.PI / 2); c.beginPath(); c.ellipse(0, 6.4 * u, 7 * u, 3 * u, 0, 0, 7); c.fill(); c.restore(); }
      else { c.save(); c.translate(hx, hy + 4 * u); c.fillStyle = '#3a3a40'; RR(c, -6 * u, -4 * u, 12 * u, 8 * u, 1.5 * u); c.fill(); c.strokeStyle = 'rgba(242,239,232,0.5)'; c.lineWidth = u * 0.4; c.stroke(); c.restore();
        c.beginPath(); c.arc(px + 9 * u, py - 5 * u, 2 * u, 0, 7); c.strokeStyle = C.w; c.lineWidth = u * 0.5; c.stroke(); c.fillStyle = '#d9d5cc'; c.fillRect(px - 14 * u, py - 3 * u, 5 * u, 6 * u);
        const cr = since(L, el, lt, 'cross', 0.25); if (cr > 0) { c.save(); GL(c, 'white', 12); c.strokeStyle = C.w; c.lineWidth = u * 0.9; c.beginPath(); c.moveTo(px - 5 * u, py - 5 * u); c.lineTo(px + 5 * u, py + 5 * u); c.moveTo(px + 5 * u, py - 5 * u); c.lineTo(px - 5 * u, py + 5 * u); c.stroke(); c.restore(); }
        if (isOn(L, el, lt, 'steam')) for (let j = 0; j < 3; j++) { const q = (tt * 0.6 + j / 3) % 1; c.beginPath(); c.moveTo(px + (j - 1) * 3 * u, py - 2 * u); c.quadraticCurveTo(px + (j - 1) * 3 * u + Math.sin(tt * 3 + j) * 2 * u, py - 8 * u - q * 8 * u, px + (j - 1) * 3 * u, py - 12 * u - q * 8 * u); c.strokeStyle = `rgba(242,239,232,${0.5 * (1 - q)})`; c.lineWidth = u * 0.5; c.stroke(); } } }
  },
  // ---------- the alarm on the phone ----------
  alarmUI(c, el, L, lt, tt, size) {
    const h = size * 2.2, w = h * 0.49, u = w / 50, ringT = since(L, el, lt, 'ring', 0.1) > 0 && !isOn(L, el, lt, 'stop'); phone(c, w, h, u);
    const sh = ringT ? Math.sin(tt * 70) * u * 0.5 : 0; c.save(); c.translate(sh, 0);
    TX(c, 'SVEGLIA', 0, -h * 0.34, u * 3.6, '900', DIM, 'center', 4);
    c.save(); GL(c, 'red', 36); TX(c, el.time || '04:04', 0, -h * 0.22, u * 15, '900', ringT || el.red ? C.red : C.w); c.restore();
    if (el.label) { const k = since(L, el, lt, 'labelat', 0.2); c.save(); c.globalAlpha *= el.labelat === undefined ? 1 : k; TF(c, el.label, 0, -h * 0.11, u * 6, w - u * 12, '900', C.gold); c.restore(); }
    if (el.made) { c.globalAlpha *= since(L, el, lt, 'madeat', 0.25) || (el.madeat === undefined ? 1 : 0); TF(c, el.made, 0, -h * 0.03, u * 3.2, w - u * 10, '800', DIM); c.globalAlpha = 1; }
    c.beginPath(); RR(c, -9 * u, h * 0.06, 18 * u, 9 * u, 4.5 * u); c.fillStyle = C.green; c.fill(); c.beginPath(); c.arc(4.5 * u, h * 0.06 + 4.5 * u, 3.4 * u, 0, 7); c.fillStyle = C.w; c.fill(); TX(c, 'attiva · ogni giorno', 0, h * 0.06 + 14 * u, u * 3, '800', DIM);
    c.restore();
    if (ringT) for (let j = 0; j < 2; j++) { const q = (tt * 1.3 + j / 2) % 1; c.beginPath(); c.arc(0, -h * 0.22, (24 + q * 22) * u, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = `rgba(229,50,45,${0.7 * (1 - q)})`; c.lineWidth = u * 0.8; c.stroke(); }
  },
  // ---------- the phone's camera dot, big ----------
  camUI(c, el, L, lt, tt, size) {
    const h = size * 2.2, w = h * 0.49, u = w / 50, org = isOn(L, el, lt, 'orange'), dc = org ? 'orange' : (el.dot || 'green'); phone(c, w, h, u);
    TX(c, el.time || '23:47', -w / 2 + u * 8, -h / 2 + u * 7.4, u * 3.6, '800', C.w, 'left');
    const lx = 0, ly = -h / 2 + u * 7.4; c.beginPath(); c.arc(lx, ly, u * 2.2, 0, 7); c.fillStyle = '#000'; c.fill(); c.lineWidth = u * 0.4; c.strokeStyle = '#3a3a40'; c.stroke();
    const dx = w / 2 - u * 8, dy = ly; c.save(); GL(c, dc, 34 + 10 * Math.sin(tt * 5)); c.beginPath(); c.arc(dx, dy, u * 2.6 * (el.dotbig || 1), 0, 7); c.fillStyle = colOf(dc); c.fill(); c.restore();
    if (el.pill) { RR(c, -w / 2 + u * 9, ly + u * 8, w - u * 18, u * 8, u * 4); c.fillStyle = 'rgba(39,168,92,0.2)'; c.fill(); c.beginPath(); c.arc(-w / 2 + u * 14, ly + u * 12, u * 1.6, 0, 7); c.fillStyle = C.green; c.fill(); TF(c, el.pill, -w / 2 + u * 18, ly + u * 12, u * 3.2, w - u * 30, '900', C.w, 'left'); }
    const cv = since(L, el, lt, 'cover', 0.45); if (cv > 0) { c.save(); c.translate(lx + (1 - H.easeOut(cv)) * u * 8, ly + u * 12 * (1 - H.easeOut(cv)) + u * 12); c.rotate(-0.15); c.scale(u * 26, u * 26); GL(c, 'white', 10); ICONS.hand(c, {}); c.restore(); }
  },
  // ---------- the photo gallery: a black 0:07 video ----------
  galUI(c, el, L, lt, tt, size) {
    const h = size * 2.2, w = h * 0.49, u = w / 50; phone(c, w, h, u); TX(c, 'Galleria', -w / 2 + u * 7, -h / 2 + u * 9, u * 4.6, '900', C.w, 'left'); TX(c, 'Tutti', w / 2 - u * 7, -h / 2 + u * 9, u * 3.2, '800', DIM, 'right');
    const cw = (w - u * 12) / 3, hot = since(L, el, lt, 'hl', 0.3);
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) { const x = -w / 2 + u * 4 + q * (cw + u * 2), y = -h / 2 + u * 15 + r * (cw + u * 2), first = !r && !q;
      c.save(); RR(c, x, y, cw, cw, u * 1.6); c.fillStyle = first ? '#000' : `hsl(${210 + 30 * H.hash(r * 3 + q)},14%,${16 + 12 * H.hash(r * 7 + q + 3)}%)`; c.fill();
      if (first) { c.lineWidth = u * (0.5 + hot); c.strokeStyle = hot > 0 ? C.red : 'rgba(242,239,232,0.5)'; if (hot > 0) GL(c, 'red', 26 * hot); c.stroke(); } c.restore();
      if (first) { RR(c, x + u * 1.6, y + cw - u * 6.4, u * 9, u * 4.6, u * 2.3); c.fillStyle = 'rgba(0,0,0,0.7)'; c.fill(); c.lineWidth = u * 0.3; c.strokeStyle = 'rgba(242,239,232,0.5)'; c.stroke(); TX(c, '0:07', x + u * 6.1, y + cw - u * 4.1, u * 3, '900', C.w); } }
    if (el.stamp) { const k = since(L, el, lt, 'stampat', 0.3); c.save(); c.globalAlpha *= el.stampat === undefined ? 1 : k; GL(c, 'red', 22); TX(c, el.stamp, 0, h * 0.38, u * 6, '900', C.red); c.restore(); }
  },
  // ---------- the video seen from the floor, rising towards the bed ----------
  vidUI(c, el, L, lt, tt, size) {
    const u = size / 40, k = lt - t0Of(L, el), ld = Math.max(0.5, (L.next ?? (L.cut + 4)) - L.cut), p = el.p0 !== undefined ? (el.p0 + (el.p1 - el.p0) * cl(lt / ld)) : cl(k / (el.dur || 7)), off = (1 - H.easeOut(p)) * 34;
    c.save(); RR(c, -32 * u, -46 * u, 64 * u, 92 * u, 3 * u); c.clip(); c.fillStyle = '#0c0f14'; c.fillRect(-34 * u, -48 * u, 68 * u, 96 * u);
    c.fillStyle = '#161b22'; c.fillRect(-34 * u, (30 + off) * u, 68 * u, 30 * u); for (let j = 0; j < 5; j++) { c.fillStyle = 'rgba(242,239,232,0.06)'; c.fillRect(-34 * u, (34 + off + j * 6) * u, 68 * u, 0.4 * u); }
    c.fillStyle = '#26303c'; c.fillRect(-34 * u, (-6 + off) * u, 68 * u, 36 * u); c.fillStyle = '#2f3b4a'; RR(c, -30 * u, (-14 + off) * u, 60 * u, 14 * u, 6 * u); c.fill();
    c.fillStyle = '#3a4757'; RR(c, -14 * u, (-26 + off * 0.8) * u, 28 * u, 14 * u, 7 * u); c.fill();
    const hy = (-30 + off * 0.8) * u; c.fillStyle = '#cfcac0'; c.beginPath(); c.arc(0, hy, 6.4 * u, 0, 7); c.fill();
    const ek = el.eyes === undefined ? 0 : cl((lt - T_(L, el, el.eyes)) / 0.25);
    for (const sd of [-1, 1]) { const ex = sd * 2.6 * u, ey = hy - 0.6 * u; if (ek > 0) { c.save(); GL(c, 'red', 14 * ek); c.fillStyle = '#050506'; c.beginPath(); c.ellipse(ex, ey, 1.5 * u, 1.5 * u * ek, 0, 0, 7); c.fill(); c.fillStyle = C.red; c.beginPath(); c.arc(ex, ey, 0.5 * u * ek, 0, 7); c.fill(); c.restore(); } else { c.beginPath(); c.moveTo(ex - 1.3 * u, ey); c.quadraticCurveTo(ex, ey + 0.8 * u, ex + 1.3 * u, ey); c.lineWidth = u * 0.5; c.strokeStyle = '#050506'; c.stroke(); } }
    c.restore(); c.lineWidth = u * 0.5; c.strokeStyle = 'rgba(242,239,232,0.5)'; RR(c, -32 * u, -46 * u, 64 * u, 92 * u, 3 * u); c.stroke();
    const sec = Math.min(7, Math.floor(p * 7.4)); c.fillStyle = 'rgba(242,239,232,0.25)'; c.fillRect(-26 * u, 38 * u, 52 * u, 0.8 * u); c.fillStyle = C.red; c.fillRect(-26 * u, 38 * u, 52 * u * p, 0.8 * u); TX(c, `0:0${sec}`, -26 * u, 42 * u, u * 3, '900', C.w, 'left'); TX(c, '0:07', 26 * u, 42 * u, u * 3, '800', DIM, 'right');
  },
  // ---------- two big eyes that open and look at the lens ----------
  eyesBig(c, el, L, lt, tt, size) {
    const u = size / 40, k = H.easeOut(cl((lt - (T_(L, el, el.open) ?? 0)) / (el.dur || 0.6)));
    for (const sd of [-1, 1]) { const ex = sd * 17 * u; c.save(); GL(c, 'white', 24); c.beginPath(); c.ellipse(ex, 0, 14 * u, 8 * u * Math.max(0.04, k), 0, 0, 7); c.fillStyle = '#ece8df'; c.fill(); c.clip(); NG(c);
      c.beginPath(); c.arc(ex, 0, 6.4 * u, 0, 7); c.fillStyle = '#2a0d0d'; c.fill(); c.beginPath(); c.arc(ex, 0, 3 * u, 0, 7); c.fillStyle = '#050506'; c.fill(); c.beginPath(); c.arc(ex - 1.4 * u, -1.4 * u, 1 * u, 0, 7); c.fillStyle = C.red; c.fill(); c.restore();
      c.beginPath(); c.moveTo(ex - 14 * u, 0); c.quadraticCurveTo(ex, -8 * u * Math.max(0.04, k) * 1.3, ex + 14 * u, 0); c.lineWidth = u * 0.7; c.strokeStyle = '#cfcac0'; c.stroke(); }
  },
  // ---------- the building seen from above: a car with its lights on, a figure at the wheel, the street door ----------
  carTop(c, el, L, lt, tt, size) {
    const u = size / 40; c.fillStyle = '#16161a'; c.fillRect(-44 * u, -46 * u, 88 * u, 14 * u); c.lineWidth = u * 0.6; c.strokeStyle = 'rgba(242,239,232,0.7)'; c.strokeRect(-44 * u, -46 * u, 88 * u, 14 * u);
    for (let j = 0; j < 5; j++) { const x = (-36 + j * 14) * u, mine = j === 2; c.save(); if (mine) GL(c, 'gold', 20); c.fillStyle = mine ? C.gold : '#2a2f3a'; c.fillRect(x, -43 * u, 7 * u, 5 * u); c.restore(); }
    TX(c, 'TU', 0.5 * u, -49.6 * u, u * 3, '900', C.gold);
    c.fillStyle = '#0d0d10'; c.fillRect(-44 * u, -32 * u, 88 * u, 60 * u); c.strokeStyle = 'rgba(242,239,232,0.2)'; c.setLineDash([u * 3, u * 3]); c.beginPath(); c.moveTo(-44 * u, 24 * u); c.lineTo(44 * u, 24 * u); c.stroke(); c.setLineDash([]);
    const on = !isOn(L, el, lt, 'lightsoff'); if (on) { c.save(); c.globalCompositeOperation = 'lighter'; for (const sd of [-1, 1]) { const g = c.createLinearGradient(0, -2 * u, 0, -28 * u); g.addColorStop(0, 'rgba(245,230,170,0.55)'); g.addColorStop(1, 'rgba(245,230,170,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(sd * 6 * u, -2 * u); c.lineTo(sd * 3 * u, -28 * u); c.lineTo(sd * 12 * u, -28 * u); c.closePath(); c.fill(); } c.restore(); }
    c.save(); GL(c, 'white', 14); RR(c, -8 * u, -3 * u, 16 * u, 30 * u, 4 * u); c.fillStyle = '#d9d5cc'; c.fill(); NG(c); c.fillStyle = '#1b1d22'; RR(c, -6.4 * u, 0, 12.8 * u, 7 * u, 2 * u); c.fill(); RR(c, -6.4 * u, 18 * u, 12.8 * u, 6 * u, 2 * u); c.fill(); c.restore();
    const fg = since(L, el, lt, 'fig', 0.4); if (fg > 0) { c.save(); c.globalAlpha *= fg; GL(c, 'red', 16); c.fillStyle = '#050506'; c.beginPath(); c.arc(-3.4 * u, 12 * u, 2.7 * u, 0, 7); c.fill(); c.beginPath(); c.ellipse(-3.4 * u, 16.4 * u, 4.2 * u, 2.4 * u, 0, 0, 7); c.fill(); c.restore(); }
    const dk = since(L, el, lt, 'door', 0.6); c.save(); c.translate(20 * u, -32 * u); c.fillStyle = '#c8c3b8'; c.fillRect(0, -1.2 * u, 10 * u, 2.4 * u); c.restore();
    c.save(); c.translate(20 * u, -32 * u); c.rotate(-Math.PI / 2 * 0.0 + dk * 1.15); c.fillStyle = dk > 0 ? C.gold : '#5c5c62'; c.fillRect(0, -0.8 * u, 10 * u, 1.6 * u); c.restore();
    if (dk > 0) { c.save(); GL(c, 'gold', 30); c.fillStyle = 'rgba(245,196,81,0.5)'; c.fillRect(20 * u, -33 * u, 10 * u, 2 * u); c.restore(); }
  },
  // ---------- a window at night, 4th floor, a sill ----------
  winK(c, el, L, lt, tt, size) {
    const u = size / 40; c.fillStyle = '#0a0d12'; c.fillRect(-26 * u, -40 * u, 52 * u, 66 * u); for (let j = 0; j < 9; j++) { c.fillStyle = `rgba(245,196,81,${0.2 + 0.3 * H.hash(j)})`; c.fillRect((-22 + (j % 3) * 15 + H.hash(j + 9) * 4) * u, (-36 + Math.floor(j / 3) * 9) * u, 2 * u, 2 * u); }
    c.save(); GL(c, 'white', 18); c.lineWidth = u * 1.1; c.strokeStyle = C.w; c.strokeRect(-26 * u, -40 * u, 52 * u, 66 * u); c.beginPath(); c.moveTo(0, -40 * u); c.lineTo(0, 26 * u); c.moveTo(-26 * u, -8 * u); c.lineTo(26 * u, -8 * u); c.stroke(); c.restore();
    c.fillStyle = '#d9d5cc'; RR(c, -31 * u, 26 * u, 62 * u, 4 * u, u); c.fill(); TX(c, '4° PIANO', -26 * u, -46 * u, u * 3.4, '900', C.gold, 'left', 3);
    const w = T_(L, el, el.waves); if (w !== null && lt >= w) for (let j = 0; j < 3; j++) { const q = ((lt - w) * 0.8 + j / 3) % 1; c.beginPath(); c.arc(0, 28 * u, (6 + q * 34) * u, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = `rgba(229,50,45,${0.8 * (1 - q)})`; c.lineWidth = u * 0.9; c.stroke(); }
  },
  // ---------- a figure ("tu") whose voice is a sound wave ----------
  swYou(c, el, L, lt, tt, size) {
    const u = size / 40; c.save(); c.translate(-8 * u, 0); c.scale(u * 60, u * 60); GL(c, 'white', 14); ICONS.you(c, {}); c.restore();
    const w = T_(L, el, el.waves) ?? 0; if (lt >= w) for (let j = 0; j < 3; j++) { const q = ((lt - w) * 0.8 + j / 3) % 1; c.beginPath(); c.arc(-3 * u, -14 * u, (6 + q * 26) * u, -0.7, 0.7); c.strokeStyle = `rgba(229,50,45,${0.85 * (1 - q)})`; c.lineWidth = u * 1; c.stroke(); }
  },
  // ---------- your door seen from inside (frosted glass, knocks, scratches, light under it) ----------
  doorin(c, el, L, lt, tt, size) {
    const u = size / 40, kn = T_(L, el, el.knock), kt = kn === null ? 9 : lt - kn, sh = kt > 0 && kt < 0.5 ? Math.sin(kt * 120) * 5 * (1 - kt / 0.5) * u : 0;
    c.save(); c.translate(sh, 0); c.fillStyle = '#121214'; c.fillRect(-60 * u, -60 * u, 120 * u, 120 * u); c.fillStyle = '#1b1b1f'; c.fillRect(-19 * u, -44 * u, 38 * u, 78 * u); c.lineWidth = u * 0.9; c.strokeStyle = 'rgba(242,239,232,0.8)'; c.strokeRect(-21 * u, -46 * u, 42 * u, 80 * u);
    if (el.glass) { const g = c.createLinearGradient(0, -40 * u, 0, -10 * u); g.addColorStop(0, 'rgba(210,225,240,0.5)'); g.addColorStop(1, 'rgba(210,225,240,0.28)'); c.fillStyle = g; c.fillRect(-12 * u, -40 * u, 24 * u, 32 * u); c.lineWidth = u * 0.4; c.strokeStyle = 'rgba(242,239,232,0.6)'; c.strokeRect(-12 * u, -40 * u, 24 * u, 32 * u);
      const sk = since(L, el, lt, 'sil', 0.8); if (sk > 0) { c.save(); c.globalAlpha *= sk; c.fillStyle = 'rgba(8,8,10,0.92)'; c.filter = 'blur(2px)'; c.beginPath(); c.arc(0, -29 * u, 4.4 * u, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, -14 * u, 8.5 * u, 8 * u, 0, 0, 7); c.fill(); c.restore(); } }
    else for (const [y, h] of [[-38, 30], [-4, 28]]) { c.lineWidth = u * 0.35; c.strokeStyle = 'rgba(242,239,232,0.3)'; c.strokeRect(-14 * u, y * u, 28 * u, h * u); }
    c.beginPath(); c.arc(14 * u, 0, 1.5 * u, 0, 7); c.fillStyle = '#cfcac0'; c.fill();
    const sc = T_(L, el, el.scratch); if (sc !== null && lt >= sc) { c.save(); GL(c, 'white', 10); c.strokeStyle = '#d9d5cc'; c.lineWidth = u * 0.7; for (let j = 0; j < 3; j++) { const k = cl((lt - sc - j * 0.15) / 0.18), x = (-6 + j * 4) * u; c.beginPath(); c.moveTo(x, 6 * u); c.lineTo(x + 3 * u * k, (6 + 22 * k) * u); c.stroke(); } c.restore(); }
    if (kn !== null && kt > 0 && kt < 0.7) { c.beginPath(); c.arc(0, -2 * u, (8 + kt * 40) * u, 0, 7); c.strokeStyle = `rgba(242,239,232,${0.7 * (1 - kt / 0.7)})`; c.lineWidth = u * 0.8; c.stroke(); }
    c.restore();
    if (el.glow) { c.save(); c.fillStyle = 'rgba(242,239,232,0.25)'; c.fillRect(-60 * u, 34 * u, 120 * u, 0.4 * u); const g = c.createLinearGradient(0, 34 * u, 0, 46 * u); g.addColorStop(0, 'rgba(245,196,81,0.5)'); g.addColorStop(1, 'rgba(245,196,81,0)'); c.fillStyle = g; c.fillRect(-19 * u, 34 * u, 38 * u, 12 * u); c.restore(); }
  },
  // ---------- the landing: the neighbour's door (bowl, leash) and yours ----------
  landing2(c, el, L, lt, tt, size) {
    const u = size / 40; c.fillStyle = 'rgba(242,239,232,0.1)'; c.fillRect(-60 * u, 34 * u, 120 * u, 0.5 * u);
    for (const [x, mine] of [[-20, false], [20, true]]) { c.save(); GL(c, mine ? 'gold' : 'white', 14); c.fillStyle = '#1b1b1f'; c.fillRect((x - 14) * u, -34 * u, 28 * u, 68 * u); c.lineWidth = u * 0.8; c.strokeStyle = mine ? C.gold : 'rgba(242,239,232,0.8)'; c.strokeRect((x - 14) * u, -34 * u, 28 * u, 68 * u); c.restore();
      c.beginPath(); c.arc((x + (mine ? -9 : 9)) * u, 2 * u, 1.3 * u, 0, 7); c.fillStyle = '#cfcac0'; c.fill(); if (mine) TX(c, 'TU', x * u, -40 * u, u * 3.6, '900', C.gold, 'center', 3); else TX(c, 'VICINO', x * u, -40 * u, u * 3, '900', DIM, 'center', 3); }
    c.save(); c.translate(-20 * u, 32 * u); c.scale(u * 18, u * 18); ICONS.bowl(c, {}); c.restore();
    const hx = -8 * u, hy = -20 * u, sw = Math.sin(tt * 1.2) * 0.4 * u; c.fillStyle = '#cfcac0'; c.beginPath(); c.arc(hx, hy, 1 * u, 0, 7); c.fill();
    c.save(); GL(c, 'white', 8); c.strokeStyle = C.red; c.lineWidth = u * 1.1; c.beginPath(); c.moveTo(hx, hy); c.bezierCurveTo(hx + 3 * u + sw, hy + 8 * u, hx + 3 * u, hy + 14 * u, hx - 2 * u + sw, hy + 18 * u); c.stroke(); c.beginPath(); c.arc(hx - 2.6 * u + sw, hy + 21 * u, 3 * u, 0, 7); c.stroke(); c.restore();
  },
  // ---------- mum's phone, off ----------
  momoff(c, el, L, lt, tt, size) {
    const h = size * 2.2 * (el.hs || 0.8), w = h * 0.49, u = w / 50; phone(c, w, h, u, false); c.beginPath(); c.arc(0, 0, u * 6, -1.2, 1.2 + Math.PI); c.lineWidth = u * 1; c.strokeStyle = '#3a3a40'; c.stroke(); c.beginPath(); c.moveTo(0, -u * 8); c.lineTo(0, -u * 2); c.stroke();
    TX(c, el.label || 'MAMMA · SPENTO', 0, h * 0.3, u * 3.6, '900', DIM, 'center', 3);
  },

  // ---------- a row of family members (dim until named), and an extra, red one ----------
  fam(c, el, L, lt, tt, size) {
    const u = size / 40, names = el.names || ['TU', 'MAMMA', 'PAPÀ', 'SORELLA'], ats = el.ats || [], n = names.length + (el.ghost !== undefined ? 1 : 0), sp = el.sp || 17, x0 = -(n - 1) * sp / 2;
    names.forEach((nm, i) => { const t = ats[i] === undefined ? -99 : T_(L, el, ats[i]), on = t !== null && lt >= t, k = on ? H.backOut(cl((lt - t) / 0.35)) : 0, x = (x0 + i * sp) * u;
      c.save(); c.globalAlpha *= on ? 1 : 0.22; c.translate(x, 0); c.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); person(c, 0, -4 * u, 4.4 * u, i === 0 ? C.gold : C.w, on ? glowOf(i === 0 ? 'gold' : 'white') : null); TX(c, nm, 0, 18 * u, u * 2.9, '900', i === 0 ? C.gold : on ? C.w : DIM, 'center', 2); c.restore(); });
    if (el.ghost !== undefined) { const t = T_(L, el, el.ghost), on = t !== null && lt >= t; if (on) { const k = H.backOut(cl((lt - t) / 0.4)), x = (x0 + names.length * sp) * u; c.save(); c.translate(x, 0); c.scale(k, k); c.globalAlpha *= 0.55 + 0.45 * Math.abs(Math.sin(tt * 5));
      GL(c, 'red', 28); person(c, 0, -4 * u, 4.4 * u, C.red, 'rgba(229,50,45,0.9)'); NG(c); TX(c, '?', 0, 1 * u, u * 5, '900', '#050506'); TX(c, el.gname || 'NESSUN NOME', 0, 18 * u, u * 2.9, '900', C.red, 'center', 2); c.restore(); } }
  },
  // ---------- any ICON with a gentle sway / pulse and a coloured glow ----------
  ic(c, el, L, lt, tt, size) {
    const k = lt - t0Of(L, el); c.rotate((el.sway ? Math.sin(tt * (el.sway === true ? 5 : el.sway)) * 0.06 : 0) + (el.tilt || 0)); if (el.flip) c.scale(-1, 1); c.scale(size, size); GL(c, el.g || 'white', 30); ICONS[el.n](c, { col: el.col ? colOf(el.col) : undefined, tt, k });
  },
};
