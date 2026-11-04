// Motion-graphics film: black stage, glowing flat pictograms, rule cards, full-sentence captions.
// window.seek(t) draws frame t and is a pure function of time; every beat is keyed to word times.
import { ICONS, C, T, rings } from './icons.js';

const Q = new URLSearchParams(location.search);
const EP = Q.get('ep') || 'ep01_citofono';
const FW = 1920, FH = 1080, FPS = 30;
const out = document.getElementById('film'); out.width = FW; out.height = FH;
const ctx = out.getContext('2d');
const stage = document.createElement('canvas'); stage.width = FW; stage.height = FH; const sc = stage.getContext('2d');

for (const [w, f] of [['600', 'montserrat-latin-600-normal'], ['800', 'montserrat-latin-800-normal'], ['900', 'montserrat-latin-900-normal']]) {
  const ff = new FontFace('Montserrat', `url(./node_modules/@fontsource/montserrat/files/${f}.woff2)`, { weight: w }); await ff.load(); document.fonts.add(ff);
}
const SCRIPT = await (await fetch(`./episodes/${EP}/script.json`)).json();
let TIM = null;
try { const r = await fetch(`./episodes/${EP}/timing.json`, { cache: 'no-store' }); if (r.ok) TIM = await r.json(); } catch (e) { }
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’-]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
if (!TIM) {                         // estimate until the real narration exists
  let t = SCRIPT.start_pad; const lines = [];
  for (const L of SCRIPT.lines) { const toks = norm(L.say), d = 0.4 + toks.length * 0.4;
    lines.push({ id: L.id, start: t, end: t + d, tokens: toks.map((w, i) => ({ w, s: t + 0.1 + i * 0.4, e: t + 0.45 + i * 0.4 })) }); t += d + (L.gap ?? SCRIPT.default_gap); }
  TIM = { duration: t + SCRIPT.end_pad, lines, estimated: true };
}
const LINES = SCRIPT.lines.map(L => ({ ...L, ...TIM.lines.find(x => x.id === L.id) }));
LINES.forEach((L, i) => { L.cut = i === 0 ? 0 : L.start - 0.08; });
LINES.forEach((L, i) => { L.next = i + 1 < LINES.length ? LINES[i + 1].cut : TIM.duration; });
const DUR = TIM.duration;
const at = (L, word, n = 0) => {                 // seconds into the line where `word` starts
  if (word === undefined || word === null) return 0;
  const w = norm(String(word))[0]; const hits = L.tokens.filter(x => x.w === w || x.w.startsWith(w));
  const h = hits[n] || hits[0]; return h ? Math.max(0, h.s - L.cut) : 0;
};

// ---------- helpers ----------
const clamp01 = x => Math.max(0, Math.min(1, x));
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const backOut = x => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const CX = FW / 2, CY = 450, UX = 720, UY = 330, US = 430;   // stage centre and units
const GLOW = { white: 'rgba(242,239,232,0.75)', gold: 'rgba(245,196,81,0.95)', red: 'rgba(229,50,45,0.95)' };
const colOf = n => n === 'red' ? C.red : n === 'gold' ? C.gold : n === 'green' ? C.green : n === 'dim' ? '#8d8981' : C.w;

// ---------- story clock in the HUD ----------
const CLK = LINES.filter(L => L.clock).map(L => [L.cut, L.clock.split(':').map(Number).reduce((h, m) => h * 60 + m)]);
function clockAt(t) {
  let m = CLK[0][1];
  for (let i = 0; i < CLK.length; i++) {
    const [a, ma] = CLK[i], nxt = CLK[i + 1];
    if (t >= a) m = nxt ? Math.min(ma + Math.floor((t - a) / 9), (nxt[1] - 1 + 1440) % 1440 >= ma ? nxt[1] - 1 : ma + 59) : ma + Math.floor((t - a) / 9);
  }
  m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
const RULE_AT = {}; LINES.forEach(L => { if (L.rule) RULE_AT[L.rule] = L.cut; });
const rulesSeen = t => Object.entries(RULE_AT).filter(([n, c]) => t >= c).map(([n]) => +n);

// ---------- one element ----------
function drawEl(c, el, L, lt, tt) {
  // an element waits for its word; but if every element on the line waits, the first one is there from the cut
  const t0 = el.at !== undefined && !el._lead ? at(L, el.at) : 0;
  const k = lt - t0; if (k < 0) return;
  const x = (el._local ? 0 : CX) + (el.x || 0) * UX, y = (el._local ? 0 : CY) + (el.y || 0) * UY, size = US * (el.s || 1);
  let dx = 0, dy = 0, sc = 1, rot = 0, al = 1;
  const a = el.a || 'pop', e = clamp01(k / 0.35);
  if (a === 'pop') { sc = 0.6 + 0.4 * backOut(k / 0.4); al = clamp01(k / 0.12); }
  else if (a === 'slide') { dx = (1 - easeOut(k / 0.45)) * 160 * (el.x > 0 ? 1 : -1); al = clamp01(k / 0.2); }
  else if (a === 'rise') { dy = (1 - easeOut(k / 0.5)) * 120; al = clamp01(k / 0.25); }
  else if (a === 'drop') { dy = -(1 - backOut(k / 0.45)) * 140; al = clamp01(k / 0.15); }
  else if (a === 'fade') al = clamp01(k / 0.6);
  else if (a === 'zoom') { sc = 0.85 + 0.25 * easeOut(k / 3); al = clamp01(k / 0.2); }
  else if (a === 'approach') { dx = easeOut(k / 2.2) * 0.3 * UX; sc = 0.9 + 0.15 * easeOut(k / 2.2); }
  else if (a === 'slam') { sc = 1 + 0.6 * (1 - easeOut(k / 0.18)); al = clamp01(k / 0.06); }
  else if (a === 'flicker') al = k < 0.6 ? (hash(Math.floor(tt * 20)) > 0.4 ? 1 : 0.1) : 1;
  else if (a === 'slidein') { dy = 0; dx = -(1 - easeOut(k / 0.6)) * 260; al = clamp01(k / 0.2); }
  else if (a === 'push') { dx = (1 - easeOut(k / 0.6)) * 120; }
  else if (a === 'insert') { dx = (1 - easeOut(k / 0.5)) * -160; al = clamp01(k / 0.15); }
  const until = el.until !== undefined ? at(L, el.until) : Infinity;
  if (el.hide !== undefined && lt > at(L, el.hide) + 0.15) return;
  if (el.hide !== undefined && lt > at(L, el.hide)) al *= 1 - (lt - at(L, el.hide)) / 0.15;
  if (el.fadeto !== undefined) { const f = clamp01((lt - at(L, el.fadeto)) / 1.2); al *= 1 - 0.8 * f; if (f > 0 && f < 1 && hash(Math.floor(tt * 24)) > 0.6) dx += (hash(Math.floor(tt * 24) + 1) - 0.5) * 30; }
  if (a === 'shake' || a === 'ring' || a === 'fumble' || el.knock) { const on = lt < until ? 1 : 0; dx += on * Math.sin(tt * 70) * 6; rot += on * Math.sin(tt * 53) * 0.02; }
  if (a === 'pulse') sc *= 1 + 0.04 * Math.sin(tt * 6);
  if (a === 'float' || !el.a) dy += Math.sin(tt * 1.3 + (el.x || 0) * 3) * 4;
  if (el.knock) { const kt = lt - at(L, el.knock); if (kt > 0 && kt < 0.7) { dx += Math.sin(kt * 90) * 10 * (1 - kt / 0.7); } }

  c.save(); c.translate(x + dx, y + dy); c.rotate(rot); c.globalAlpha *= al;
  const glow = el.g ? GLOW[el.g] : GLOW.white; c.shadowColor = glow; c.shadowBlur = el.g ? 42 : 26;
  const o = { ...el, col: el.col ? colOf(el.col) : undefined };
  const i = el.i;
  if (i === 'clock') { c.scale(sc, sc); txt(c, el.text, 0, 0, 250, '800', colOf(el.col), 'center', 'middle'); c.shadowBlur = 0; txt(c, SCRIPT.night, 0, -150, 34, '600', C.dim, 'center', 'middle', 10); }
  else if (i === 'text') { c.scale(sc, sc); txt(c, el.text, 0, 0, 120 * (el.s || 1), '900', colOf(el.col), 'center', 'middle'); }
  else if (i === 'quote') { const n = Math.floor(clamp01(k / Math.max(0.5, el.text.length * 0.028)) * el.text.length); txt(c, el.text.slice(0, n), 0, 0, 64, '900', colOf(el.col), 'center', 'middle'); }
  else if (i === 'count') { const v = markVal(el.marks, L, lt); if (v !== null) { const kk = lt - markTime(el.marks, L, lt); c.scale(1 + 0.4 * (1 - easeOut(kk / 0.2)), 1 + 0.4 * (1 - easeOut(kk / 0.2))); txt(c, v, 0, 0, 200, '900', colOf(el.col), 'center', 'middle'); } }
  else if (i === 'timer') timer(c, el, L, lt, sc, size);
  else if (i === 'floor') floor(c, el, L, lt, size, tt);
  else if (i === 'screen') screen(c, el, L, lt, tt, size, sc);
  else if (i === 'static') { }
  else if (i === 'call') { c.scale(sc, sc); callUI(c, el, L, lt, tt, size); }
  else if (i === 'chat') { c.scale(sc, sc); chatUI(c, el, L, lt, tt, size); }
  else if (i === 'calllog') { c.scale(sc, sc); logUI(c, el, L, lt, tt, size); }
  else if (i === 'boxes') { c.scale(sc, sc); boxesUI(c, el, L, lt, tt, size); }
  else if (i === 'waveform') { c.scale(sc, sc); waveUI(c, el, L, lt, tt, size); }
  else if (i === 'nav') { c.scale(sc, sc); navUI(c, el, L, lt, tt, size); }
  else if (i === 'windshield') { c.scale(sc, sc); windUI(c, el, L, lt, tt, size); }
  else if (i === 'hall') { c.scale(sc, sc); hallUI(c, el, L, lt, tt, size); }
  else if (i === 'plan') { c.scale(sc, sc); planUI(c, el, L, lt, tt, size); }
  else if (i === 'bill') { c.scale(sc, sc); billUI(c, el, L, lt, tt, size); }
  else if (i === 'inventory') { c.scale(sc, sc); invUI(c, el, L, lt, tt, size); }
  else if (i === 'keys') { c.scale(sc, sc); keysUI(c, el, L, lt, tt, size); }
  else if (i === 'phone' && (el.flipto || el.off || el.word)) { c.scale(sc, sc); phoneFx(c, el, L, lt, tt, size, o); }
  else if (ICONS[i] || ['you', 'admin', 'bruni', 'mother', 'shadow'].includes(i)) {
    // per-icon live parameters
    if (i === 'phoneback') o.haloK = el.halo ? clamp01((lt - at(L, el.halo)) / 0.6) : 0;
    if (i === 'note') { o.write = el.a === 'write' ? clamp01(k / 2.2) : 1; if (el.flip) { const f = lt - at(L, el.flip); if (f > 0) { const s2 = Math.cos(clamp01(f / 0.5) * Math.PI); c.scale(Math.abs(s2) || 0.01, 1); if (s2 < 0) { o.back = true; } } } }
    if (i === 'door') { if (el.open) { const ot = typeof el.open === 'string' ? at(L, el.open) : 0; o.openK = easeOut((lt - ot) / 0.6); if (el.close) o.openK *= 1 - easeOut((lt - at(L, el.close)) / 0.4); }
      if (el.gap) { const gt = typeof el.gap === 'string' ? at(L, el.gap) : 0; o.gapK = clamp01((lt - gt) / 0.2); }
      if (el.tape) { const tt2 = typeof el.tape === 'string' ? at(L, el.tape) : 0; o.tapeK = clamp01((lt - tt2) / 0.3); }
      if (el.zoomgap) { const z = easeOut(lt / 3); c.translate(0, -size * 0.3 * z); c.scale(1 + 0.8 * z, 1 + 0.8 * z); } }
    if (i === 'elevator') { o.openK = el.open === true ? 1 : el.open ? easeOut((lt - at(L, el.open)) / 0.8) : 0; o.sinkK = el.sink ? easeOut((lt - at(L, el.sink)) / 1.5) : 0; if (el.sink) c.translate(0, o.sinkK * size * 0.04); }
    const wk = w => w === true ? 1 : w ? clamp01((lt - at(L, w)) / 0.5) : 0;
    if (i === 'car') o.openK = el.open ? easeOut(wk(el.open)) : 0;
    if (i === 'mirror') o.ghostK = el.ghost === true ? 0.85 : el.ghost ? 0.85 * clamp01((lt - at(L, el.ghost)) / 1.2) : 0;
    if (i === 'padlock') o.openK = el.open ? backOut(wk(el.open)) : 0;
    if (i === 'note' && el.blank) o.blankK = el.blank === true ? 1 : clamp01((lt - at(L, el.blank)) / 0.25);
    if (i === 'switch') o.pressK = el.press ? clamp01((lt - at(L, el.press)) / 0.1) : 0;
    if (i === 'steps') { o.phase = el.still ? 0 : Math.floor(tt * 3) % 4; o.reveal = clamp01(k / 1.0); if (el.until && lt > at(L, el.until)) o.phase = 0; }
    if (i === 'waves') o.phase = (tt * 0.8) % 1;
    if (i === 'map') o.drawK = easeOut(k / 1.6);
    if (i === 'doc') { o.signK = el.sign ? clamp01((lt - at(L, el.sign)) / 0.8) : 1; o.circleK = el.circle ? clamp01((lt - at(L, el.circle)) / 0.6) : 0; }
    if (i === 'peephole') { o.darkK = el.darken ? clamp01((lt - at(L, el.darken)) / 0.4) : 0; o.eyeK = el.eye ? clamp01((lt - at(L, el.eye)) / 0.5) : 0; }
    if (i === 'key' && el.turn) { const tk = lt - at(L, el.turn); if (tk > 0) rot += -Math.PI * 0.5 * easeOut(tk / 0.35) - (tk > 0.5 ? Math.PI * 0.5 * easeOut((tk - 0.5) / 0.35) : 0); c.rotate(rot); }
    if (el.flip) c.scale(-1, 1);
    if (i === 'slash') { o.k = easeOut(k / 0.3); c.shadowColor = GLOW.red; }
    c.scale(size * sc, size * sc);
    (ICONS[i])(c, o);
    if (i === 'intercom' && el.a === 'ring' && lt < until) rings(c, (tt * 1.4) % 1, C.gold);
    if (i === 'handset' && el.a === 'shake' && lt < until) rings(c, (tt * 1.4) % 1, C.gold);
  }
  c.restore();
}
function txt(c, s, x, y, size, weight, col, align = 'center', base = 'middle', spacing = 0) {
  c.font = `${weight} ${size}px Montserrat`; c.fillStyle = col; c.textAlign = align; c.textBaseline = base;
  if (spacing) c.letterSpacing = spacing + 'px'; c.fillText(s, x, y); if (spacing) c.letterSpacing = '0px';
}
function markTime(marks, L, lt) { let tm = -1; for (const [w] of marks) { const a = at(L, w); if (lt >= a) tm = a; } return tm; }
function markVal(marks, L, lt) { let v = null; for (const [w, val] of marks) if (lt >= at(L, w)) v = val; return v; }
function timer(c, el, L, lt, sc, size) {
  let v; if (el.marks) v = markVal(el.marks, L, lt) ?? el.marks[0][1]; else { const d = L.next - L.cut; v = Math.round(el.from + (el.to - el.from) * clamp01(lt / Math.max(0.5, d - 0.2))); }
  const n = +v, col = el.col ? colOf(el.col) : n <= 10 ? C.red : C.w, r = size * 0.42;
  c.save(); c.lineWidth = 12; c.strokeStyle = '#26241f'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = col; c.shadowColor = col === C.red ? GLOW.red : GLOW.white; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * n / 60); c.stroke();
  txt(c, String(n), 0, 6, size * 0.38, '900', col, 'center', 'middle'); txt(c, 'SEC', 0, size * 0.2, size * 0.07, '600', C.dim, 'center', 'middle', 4); c.restore();
}
function floor(c, el, L, lt, size, tt) {
  let v;
  if (el.marks) v = markVal(el.marks, L, lt) ?? '';
  else { const seq = el.seq.split(','), d = L.next - L.cut; v = seq[Math.min(seq.length - 1, Math.floor(clamp01(lt / d) * seq.length))]; if (el.a === 'flicker' && hash(Math.floor(tt * 12)) > 0.7) v = String(Math.floor(hash(Math.floor(tt * 12) + 3) * 9)); }
  const w = size * 0.9, h = size * 0.62;
  c.save(); c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 18); c.lineWidth = 10; c.strokeStyle = C.w; c.stroke();
  c.beginPath(); c.moveTo(-w * 0.32, -h * 0.18); c.lineTo(-w * 0.26, -h * 0.3); c.lineTo(-w * 0.2, -h * 0.18); c.lineWidth = 6; c.stroke();
  const col = el.col ? colOf(el.col) : C.red; c.shadowColor = GLOW.red; c.shadowBlur = 40;
  txt(c, v, w * 0.08, 8, h * 0.62, '900', col, 'center', 'middle'); c.restore();
}
function screen(c, el, L, lt, tt, size, sc) {
  const w = size * 1.45, h = size * 0.95, on = el.on ? clamp01((lt - at(L, el.on)) / 0.25) : 1;
  c.save(); c.scale(sc, sc);
  c.beginPath(); c.roundRect(-w / 2 - 18, -h / 2 - 18, w + 36, h + 36, 26); c.fillStyle = C.w; c.fill();
  c.shadowBlur = 0; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 10); c.fillStyle = '#000'; c.fill();
  c.save(); c.clip();
  if (on > 0) {
    c.globalAlpha *= on; c.fillStyle = '#0d1418'; c.fillRect(-w / 2, -h / 2, w, h);
    for (const ch of el.els || []) {
      if (ch.i === 'static' || (lt - (el.on ? at(L, el.on) : 0)) < 0.5) {             // tv static
        for (let i = 0; i < 260; i++) { const r = hash(i * 7 + Math.floor(tt * 30) * 131); c.fillStyle = `rgba(230,236,240,${0.15 + 0.5 * hash(i + Math.floor(tt * 30))})`; c.fillRect(-w / 2 + r * w, -h / 2 + hash(i * 3 + Math.floor(tt * 30)) * h, 3 + hash(i) * 30, 2); }
        if (ch.i === 'static') continue;
      }
      drawEl(c, { ...ch, _local: true, x: (ch.x || 0) * (w / 2) / UX, y: (ch.y || 0) * (h / 2) / UY, s: (ch.s || 1) * size / US }, L, lt, tt);
    }
    for (let yy = -h / 2; yy < h / 2; yy += 6) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-w / 2, yy, w, 2); }   // scanlines
    c.fillStyle = 'rgba(140,200,220,0.06)'; c.fillRect(-w / 2, -h / 2, w, h);
    txt(c, 'CAM 01 · PORTONE', -w / 2 + 24, -h / 2 + 30, 22, '800', 'rgba(242,239,232,0.8)', 'left', 'middle', 3);
    if (Math.floor(tt * 2) % 2) { c.beginPath(); c.arc(w / 2 - 34, -h / 2 + 30, 8, 0, 7); c.fillStyle = C.red; c.fill(); }
  }
  c.restore(); c.restore();
}

// ---------- phone UIs (drawn in pixels around the element centre) ----------
function frame(c, h) {                                  // a smartphone: white body, black screen; returns the screen box
  const w = h * 0.5;
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, w * 0.16); c.fillStyle = C.w; c.fill();
  c.shadowBlur = 0; const m = w * 0.05; const sx = -w / 2 + m, sy = -h / 2 + m, sw = w - 2 * m, sh = h - 2 * m;
  c.beginPath(); c.roundRect(sx, sy, sw, sh, w * 0.12); c.fillStyle = '#050506'; c.fill();
  c.beginPath(); c.roundRect(-w * 0.12, sy + 8, w * 0.24, h * 0.022, 8); c.fillStyle = C.w; c.fill();
  return { x: sx, y: sy, w: sw, h: sh };
}
function btn(c, x, y, r, col, kind, glow) {
  c.save(); if (glow) { c.shadowColor = col; c.shadowBlur = 30 * glow; }
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.fill(); c.restore();
  c.save(); c.translate(x, y); c.rotate(kind === 'down' ? Math.PI * 0.75 : -Math.PI * 0.25); c.fillStyle = C.w;
  c.beginPath(); c.roundRect(-r * 0.5, -r * 0.14, r, r * 0.28, r * 0.14); c.fill();
  c.beginPath(); c.roundRect(-r * 0.55, -r * 0.3, r * 0.26, r * 0.36, r * 0.1); c.fill(); c.beginPath(); c.roundRect(r * 0.29, -r * 0.3, r * 0.26, r * 0.36, r * 0.1); c.fill();
  c.restore();
}
function avatar(c, x, y, r, red) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = '#26241f'; c.fill(); c.clip();
  c.translate(x, y + r * 0.25); c.scale(r * 1.9, r * 1.9); ICONS.mother(c, { col: red ? '#f3d2cf' : '#d9d5cc' }); c.restore();
}
function callUI(c, el, L, lt, tt, size) {
  const h = size * 1.08, S = frame(c, h), u = S.w / 88;
  const t = k => el[k] !== undefined ? at(L, el[k]) : null;
  if (el.on !== undefined && lt < t('on')) return;
  let mode = el.mode || 'in';
  if (el.accept !== undefined && lt >= t('accept')) mode = 'active';
  if (el.end !== undefined && lt >= t('end')) mode = 'ended';
  const cx = 0, red = el.g === 'red';
  const top = { in: 'chiamata in arrivo', active: 'in chiamata', out: 'chiamata in corso…', missed: 'chiamata persa', ended: 'chiamata terminata' }[mode];
  txt(c, top.toUpperCase(), cx, S.y + S.h * 0.12, u * 5.2, '600', mode === 'missed' ? C.red : '#9b978f', 'center', 'middle', 2);
  avatar(c, cx, S.y + S.h * 0.32, u * 17, red);
  c.shadowColor = red ? GLOW.red : GLOW.white; c.shadowBlur = 24;
  c.font = `900 ${u * 15}px Montserrat`; const nw = c.measureText(el.name).width, fs = Math.min(1, S.w * 0.88 / nw);
  txt(c, el.name, cx, S.y + S.h * 0.52, u * 15 * fs, '900', red ? C.red : C.w, 'center', 'middle');
  c.shadowBlur = 0;
  if (mode === 'active' || mode === 'ended') { const secs = mode === 'ended' ? 0 : Math.floor(lt); txt(c, `00:${String(secs).padStart(2, '0')}`, cx, S.y + S.h * 0.6, u * 7, '800', mode === 'ended' ? C.red : '#cfcac0', 'center', 'middle'); }
  const by = S.y + S.h * 0.84, r = u * 11;
  if (mode === 'in') { btn(c, cx - S.w * 0.25, by, r, C.red, 'down', 0); btn(c, cx + S.w * 0.25, by + Math.sin(tt * 8) * u * 1.2, r, C.green, 'up', 0.6 + 0.4 * Math.sin(tt * 6)); }
  else if (mode === 'active' || mode === 'out') btn(c, cx, by, r, C.red, 'down', 0);
  else if (mode === 'missed') { btn(c, cx, by, r, C.green, 'up', 0.8); if (el.thumb) { c.save(); c.translate(cx + r * 0.2, by + r * 1.5); c.rotate(-0.25); c.scale(u * 40, u * 40); ICONS.hand(c, {}); c.restore(); } }
  if (mode === 'out') { for (let k = 0; k < 3; k++) { const a = (tt * 1.5 + k / 3) % 1; c.save(); c.globalAlpha *= 1 - a; c.beginPath(); c.arc(cx, S.y + S.h * 0.32, u * (17 + a * 22), 0, 7); c.lineWidth = u * 1.2; c.strokeStyle = C.w; c.stroke(); c.restore(); } }
}
function bubble(c, S, y, m, u, lt, tt, L) {
  const me = m.who === 'me', pad = u * 4, maxW = S.w * 0.84;
  let bw, bh, lines = [];
  if (m.voice) { bw = S.w * 0.72; bh = u * 15; }
  else { c.font = `800 ${u * 5.6}px Montserrat`; const words = m.text.split(' '); let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst).width > maxW - 2 * pad && cur) { lines.push(cur); cur = w; } else cur = tst; } lines.push(cur);
    bw = Math.min(maxW, Math.max(...lines.map(l => c.measureText(l).width)) + 2 * pad); bh = lines.length * u * 7.4 + 2 * pad - u * 1.6; }
  const x = me ? S.x + S.w - u * 5 - bw : S.x + u * 5;
  const col = m.col === 'red' ? C.red : me ? C.gold : C.w;
  c.save(); if (m.col === 'red') { c.shadowColor = GLOW.red; c.shadowBlur = 30; }
  c.beginPath(); c.roundRect(x, y, bw, bh, u * 4); c.fillStyle = col; c.fill(); c.restore();
  if (m.voice) {
    const cy = y + bh / 2; c.fillStyle = C.bg; c.beginPath(); c.moveTo(x + u * 5, cy - u * 3.5); c.lineTo(x + u * 11, cy); c.lineTo(x + u * 5, cy + u * 3.5); c.closePath(); c.fill();
    const n = 26, x0 = x + u * 15, x1 = x + bw - u * 14, prog = m.play ? clamp01(lt / Math.max(1, (L.next - L.cut) - 0.3)) : 0;
    for (let k = 0; k < n; k++) { const hh = u * (1.5 + 5 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6))); const xx = x0 + (x1 - x0) * k / (n - 1); c.fillStyle = k / n < prog ? C.red : C.bg; c.fillRect(xx - u * 0.6, cy - hh, u * 1.2, hh * 2); }
    txt(c, m.voice, x + bw - u * 3, cy, u * 4, '800', C.bg, 'right', 'middle');
  } else lines.forEach((ln, k) => txt(c, ln, x + pad, y + pad + u * 2.6 + k * u * 7.4, u * 5.6, '800', m.col === 'red' ? C.w : C.bg, 'left', 'middle'));
  if (m.time || m.tick) txt(c, (m.time || '') + (m.tick ? (m.tick === 2 ? '  ✓✓' : '  ✓') : ''), me ? x + bw : x, y + bh + u * 3.4, u * 3.6, '600', '#8d8981', me ? 'right' : 'left', 'middle');
  return bh + u * (m.time || m.tick ? 9 : 5);
}
function chatUI(c, el, L, lt, tt, size) {
  const h = size * 1.12, S = frame(c, h), u = S.w / 78;
  c.fillStyle = '#16161a'; c.fillRect(S.x, S.y + S.h * 0.05, S.w, S.h * 0.11);
  avatar(c, S.x + u * 12, S.y + S.h * 0.105, u * 6, false);
  txt(c, el.head, S.x + u * 22, S.y + S.h * 0.09, u * 6, '900', C.w, 'left', 'middle');
  if (el.status) { const hot = el.statusat !== undefined && lt > at(L, el.statusat); c.save(); if (hot) { c.shadowColor = GLOW.red; c.shadowBlur = 20; }
    txt(c, el.status, S.x + u * 22, S.y + S.h * 0.13, u * 3.8, '600', hot ? C.red : '#8d8981', 'left', 'middle'); c.restore(); }
  const wipe = el.wipe !== undefined ? clamp01((lt - at(L, el.wipe)) / 0.4) : 0;
  let y = S.y + S.h * 0.2;
  c.save(); c.beginPath(); c.rect(S.x, S.y + S.h * 0.17, S.w, S.h * 0.8); c.clip();
  for (const m of el.msgs || []) {
    if (m.at !== undefined && lt < at(L, m.at)) continue;
    const k = m.at !== undefined ? easeOut((lt - at(L, m.at)) / 0.25) : 1;
    c.save(); c.globalAlpha *= k * (1 - wipe); c.translate(-wipe * S.w, (1 - k) * u * 6);
    y += bubble(c, S, y, m, u, lt, tt, L); c.restore();
  }
  if (wipe > 0.6) txt(c, 'CHAT CANCELLATA', 0, S.y + S.h * 0.45, u * 5, '800', '#8d8981', 'center', 'middle', 2);
  c.restore();
}
function logUI(c, el, L, lt, tt, size) {
  const h = size * 1.12, S = frame(c, h), u = S.w / 86;
  txt(c, 'RECENTI', S.x + u * 7, S.y + S.h * 0.1, u * 6, '900', C.w, 'left', 'middle');
  const n = el.n || 8, shown = Math.floor(clamp01(lt / 1.2) * n + 0.999);
  for (let k = 0; k < Math.min(n, 11); k++) {
    const y = S.y + S.h * 0.17 + k * S.h * 0.072; if (k >= shown) break;
    const hot = el.hot && k === 0;
    if (hot) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 20; c.beginPath(); c.roundRect(S.x + u * 3, y - u * 1, S.w - u * 6, S.h * 0.066, u * 2); c.strokeStyle = C.red; c.lineWidth = u * 0.8; c.stroke(); c.restore(); }
    txt(c, el.name, S.x + u * 13, y + S.h * 0.03, u * 5.4, '800', C.red, 'left', 'middle');
    const mm = 39 - k * 3; txt(c, `02:${String(Math.max(0, mm)).padStart(2, '0')}`, S.x + S.w - u * 7, y + S.h * 0.03, u * 4.4, '600', '#8d8981', 'right', 'middle');
    c.save(); c.translate(S.x + u * 7.5, y + S.h * 0.03); c.rotate(Math.PI * 0.75); c.fillStyle = C.red; c.fillRect(-u * 2.2, -u * 0.5, u * 4.4, u * 1); c.restore();
  }
}
function boxesUI(c, el, L, lt, tt, size) {
  const s = size * 0.3, gap = s * 0.22, tot = 7 * s + 6 * gap;
  for (let i = 1; i <= 7; i++) {
    const k = backOut((lt - i * 0.07) / 0.3); if (k <= 0) continue;
    const x = -tot / 2 + (i - 1) * (s + gap) + s / 2, hot = i === el.hot, hot2 = i === el.hot2 && lt >= (el.hot2at ? at(L, el.hot2at) : 0);
    c.save(); c.translate(x, 0); const p = hot ? 1 + 0.06 * Math.sin(tt * 7) : 1; c.scale(k * p, k * p);
    c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * 0.18);
    if (hot) { c.shadowColor = GLOW.red; c.shadowBlur = 50; c.fillStyle = C.red; c.fill(); } else if (hot2) { c.shadowColor = GLOW.gold; c.shadowBlur = 40; c.lineWidth = s * 0.08; c.strokeStyle = C.gold; c.stroke(); } else { c.lineWidth = s * 0.06; c.strokeStyle = C.w; c.stroke(); }
    c.shadowBlur = 0; txt(c, String(i), 0, s * 0.04, s * 0.55, '900', hot2 ? C.gold : C.w, 'center', 'middle'); c.restore();
  }
}
function waveUI(c, el, L, lt, tt, size) {
  const w = size * 1.5, h = size * 0.16, n = 64, col = el.col ? colOf(el.col) : C.w, k = clamp01(lt / 1.0);
  c.shadowColor = el.col === 'red' ? GLOW.red : GLOW.white; c.shadowBlur = 20;
  for (let i = 0; i < n * k; i++) { const hh = h * (0.15 + 0.85 * Math.abs(Math.sin(i * 0.9) * Math.sin(i * 0.23 + 1))); c.fillStyle = col; c.fillRect(-w / 2 + w * i / n, -hh, w / n * 0.55, hh * 2); }
  if (el.label) txt(c, el.label, -w / 2 - 30, 0, size * 0.09, '800', col, 'right', 'middle');
}
function phoneFx(c, el, L, lt, tt, size, o) {
  const flipT = el.flipto !== undefined ? at(L, el.flipto) : null;
  if (flipT !== null) {
    const f = clamp01((lt - flipT) / 0.45), sx = Math.cos(f * Math.PI);
    c.save(); c.scale(Math.max(0.02, Math.abs(sx)), 1);
    if (sx >= 0) { const S = frame(c, size); txt(c, '23:05', 0, S.y + S.h * 0.25, S.w * 0.2, '800', C.w, 'center', 'middle'); }
    else { c.scale(size, size); ICONS.phoneback(c, {}); }
    c.restore(); return;
  }
  const S = frame(c, size), offT = el.off === true ? 0 : el.off !== undefined ? at(L, el.off) : 0;
  if (lt < offT) { c.fillStyle = '#1b1a17'; c.fillRect(S.x, S.y, S.w, S.h); txt(c, 'MAMMA', 0, S.y + S.h * 0.4, S.w * 0.14, '900', C.w, 'center', 'middle'); }
  else if (lt - offT < 0.25) { const k = (lt - offT) / 0.25; c.fillStyle = C.w; c.fillRect(S.x, S.y + S.h / 2 - (1 - k) * S.h / 2, S.w, Math.max(2, (1 - k) * S.h)); }
  if (el.word && lt >= at(L, el.wordat)) { const k = clamp01((lt - at(L, el.wordat)) / 0.2); c.save(); c.globalAlpha *= k; c.shadowColor = GLOW.red; c.shadowBlur = 40;
    c.font = `900 ${S.w * 0.24}px Montserrat`; const fs = Math.min(1, S.w * 0.86 / c.measureText(el.word).width); txt(c, el.word, 0, S.y + S.h * 0.5, S.w * 0.24 * fs, '900', C.red, 'center', 'middle'); c.restore(); }
}


// ---------- Caso 003: the car's navigation screen, and the view through the windshield ----------
function navIcon(c, kind, x, y, r) {
  c.save(); c.translate(x, y); c.fillStyle = C.w; c.strokeStyle = C.w; c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'flag') { c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(-r * 0.4, r * 0.7); c.lineTo(-r * 0.4, -r * 0.7); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.4, -r * 0.7); c.lineTo(r * 0.6, -r * 0.4); c.lineTo(-r * 0.4, -r * 0.05); c.closePath(); c.fill(); }
  else if (kind === 'right' || kind === 'up') { if (kind === 'right') c.rotate(0); c.lineWidth = r * 0.22;
    if (kind === 'right') { c.beginPath(); c.moveTo(-r * 0.3, r * 0.75); c.lineTo(-r * 0.3, -r * 0.05); c.quadraticCurveTo(-r * 0.3, -r * 0.3, r * 0.0, -r * 0.3); c.lineTo(r * 0.35, -r * 0.3); c.stroke();
      c.beginPath(); c.moveTo(r * 0.75, -r * 0.3); c.lineTo(r * 0.3, -r * 0.65); c.lineTo(r * 0.3, r * 0.05); c.closePath(); c.fill(); }
    else { c.beginPath(); c.moveTo(0, r * 0.75); c.lineTo(0, -r * 0.2); c.stroke(); c.beginPath(); c.moveTo(0, -r * 0.75); c.lineTo(-r * 0.38, -r * 0.2); c.lineTo(r * 0.38, -r * 0.2); c.closePath(); c.fill(); } }
  else if (kind === 'recalc') { c.lineWidth = r * 0.18; const a = Date.now ? 0 : 0; c.beginPath(); c.arc(0, 0, r * 0.55, -0.3, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.moveTo(r * 0.75, -r * 0.05); c.lineTo(r * 0.3, -r * 0.05); c.lineTo(r * 0.55, -r * 0.5); c.closePath(); c.fill(); }
  c.restore();
}
function carArrow(c, x, y, r, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot); c.shadowColor = col === C.red ? GLOW.red : GLOW.white; c.shadowBlur = 24;
  c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.75, r * 0.8); c.lineTo(0, r * 0.4); c.lineTo(-r * 0.75, r * 0.8); c.closePath(); c.fillStyle = col || C.w; c.fill(); c.restore();
}
function topCar(c, x, y, r, col) {
  c.save(); c.translate(x, y); c.beginPath(); c.roundRect(-r * 0.5, -r, r, r * 2, r * 0.35); c.fillStyle = col; c.fill();
  c.beginPath(); c.roundRect(-r * 0.38, -r * 0.55, r * 0.76, r * 0.4, r * 0.1); c.fillStyle = '#0b1016'; c.fill();
  c.beginPath(); c.roundRect(-r * 0.38, r * 0.35, r * 0.76, r * 0.3, r * 0.1); c.fill(); c.restore();
}
function navUI(c, el, L, lt, tt, size) {
  const w = size * 1.5, h = size * 0.92, u = w / 100, W2 = w / 2, H2 = h / 2;
  const T = k => el[k] !== undefined && el[k] !== true ? at(L, el[k]) : 0;
  const red = el.g === 'red';
  c.beginPath(); c.roundRect(-W2 - u * 1.6, -H2 - u * 1.6, w + u * 3.2, h + u * 3.2, u * 3); c.fillStyle = C.w; c.fill();      // bezel
  c.shadowBlur = 0; c.save(); c.beginPath(); c.roundRect(-W2, -H2, w, h, u * 1.6); c.fillStyle = '#0b1016'; c.fill(); c.clip();
  const dim = el.dimat ? 1 - 0.75 * clamp01((lt - at(L, el.dimat)) / 0.8) : 1;
  c.save(); c.globalAlpha *= dim;
  // field texture
  for (let i = 0; i < 220; i++) { const fx = -W2 + hash(i * 3.1) * w, fy = -H2 + hash(i * 7.7) * h; c.fillStyle = 'rgba(242,239,232,0.10)'; c.fillRect(fx, fy, u * 0.5, u * 0.5); }
  const map = el.map || 'road', carY = H2 * 0.45, jY = el.near ? H2 * 0.05 : -H2 * 0.25;
  const road = (x0, y0, x1, y1, dashed, lw = 6) => { c.save(); c.lineCap = 'round'; if (dashed) c.setLineDash([u * 1.5, u * 1.8]);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = u * lw; c.strokeStyle = dashed ? 'rgba(80,88,98,0.7)' : '#3a4049'; c.stroke(); c.restore(); };
  const route = pts => { c.save(); c.shadowColor = GLOW.gold; c.shadowBlur = 18; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = u * 2.2; c.strokeStyle = C.gold; c.stroke(); c.restore(); };
  const flagY = -H2 * 0.1;
  if (map === 'road') { road(0, H2 + 10, 0, -H2 - 10); road(-W2, -H2 * 0.55, W2, -H2 * 0.55); route([[0, carY], [0, -H2 - 10]]); }
  else if (map === 'branch') { road(0, H2 + 10, 0, -H2 - 10); road(0, jY, W2 * 0.9, jY, true); route([[0, carY], [0, jY], [W2 * 0.9, jY]]); }
  else if (map === 'field') { road(0, H2 + 10, 0, flagY); route([[0, carY], [0, flagY]]); }
  if (el.ghostroad) { const g = clamp01((lt - at(L, el.ghostroad)) / 1.5); c.save(); c.globalAlpha *= g;
    for (let k = 0; k < 5; k++) { const yy = -H2 * 0.8 + k * H2 * 0.35; road(u * 3, yy, W2 * (0.3 + 0.65 * g), yy - H2 * 0.15 * (k % 2 ? 1 : -1), true, 1.6); } c.restore(); }
  if (map === 'field' || el.parked) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 20; navIcon(c, 'flag', u * 2, flagY - u * 4, u * 5); c.restore(); }
  // parked car at the flag
  let pk = 0; if (el.parked) { pk = el.parked === true ? 1 : clamp01((lt - at(L, el.parked)) / 0.3); c.save(); c.globalAlpha *= pk; topCar(c, -u * 8, flagY + u * 2, u * 4.6, red || (el.since && lt >= at(L, el.since)) ? C.red : C.w); c.restore(); }
  // the car arrow
  let ax = 0, ay = carY, ar = 0, aal = 1;
  if (el.veer) { const k = clamp01((lt - at(L, el.veer)) / 1.6); const k1 = clamp01(k * 2), k2 = clamp01(k * 2 - 1);
    ay = carY + (jY - carY) * easeOut(k1); ax = W2 * 0.75 * easeOut(k2); ar = Math.PI / 2 * easeOut(k2) + 0.25 * Math.sin(k2 * 9) * (1 - k2); }
  if (el.vanish) aal = 1 - clamp01((lt - at(L, el.vanish)) / 0.5);
  if (el.stopdot && lt >= at(L, el.stopdot)) { c.beginPath(); c.arc(0, carY, u * 2.2, 0, 7); c.fillStyle = '#8d8981'; c.fill(); aal = 0;
    if (el.chase) { const k = clamp01((lt - at(L, el.chase)) / 1.4); for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + 0.6, dd = (1 - easeOut(k)) * w * 0.6 + u * 3;
      c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 20; c.beginPath(); c.arc(Math.cos(a) * dd, carY + Math.sin(a) * dd * 0.6, u * 1.6, 0, 7); c.fillStyle = C.red; c.globalAlpha *= clamp01((lt - at(L, el.chase)) / 0.2); c.fill(); c.restore(); } } }
  if (aal > 0) { c.save(); c.globalAlpha *= aal; carArrow(c, ax, ay, u * 3.4, ar, C.w); c.restore(); }
  // tooltip on the parked car
  if (el.plate && lt >= T('plate')) { const tx = -W2 + u * 4, ty = -H2 + u * 21, tw2 = u * 33; c.save(); c.globalAlpha *= clamp01((lt - T('plate')) / 0.25);
    c.beginPath(); c.roundRect(tx, ty, tw2, el.since ? u * 13 : u * 7.5, u * 1.5); c.fillStyle = '#f2efe8'; c.fill();
    txt(c, 'TARGA: LA TUA', tx + u * 2, ty + u * 3.9, u * 3.6, '900', C.bg, 'left', 'middle');
    if (el.since && lt >= at(L, el.since)) txt(c, 'DALLE 23:02', tx + u * 2, ty + u * 9.4, u * 4.4, '900', C.red, 'left', 'middle'); c.restore(); }
  c.restore();
  // banner
  if (el.banner !== undefined) { const bh = u * 13, bw = Math.min(w * 0.94, u * 22 + (() => { c.font = `900 ${u * 6}px Montserrat`; return c.measureText(el.banner).width; })());
    c.beginPath(); c.roundRect(-W2 + u * 3, -H2 + u * 3, bw, bh, u * 2); c.fillStyle = red ? C.red : '#141a21'; c.fill();
    if (el.icon && el.icon !== 'none') navIcon(c, el.icon, -W2 + u * 11, -H2 + u * 3 + bh / 2, u * 4.4);
    c.save(); if (red) { c.shadowColor = GLOW.red; c.shadowBlur = 0; }
    txt(c, el.banner, -W2 + u * (el.icon && el.icon !== 'none' ? 19 : 7), -H2 + u * 3 + bh / 2 + u * 0.4, u * 6, '900', C.w, 'left', 'middle'); c.restore(); }
  // bottom bar
  const by = H2 - u * 7; c.fillStyle = 'rgba(5,5,6,0.85)'; c.fillRect(-W2, by - u * 5, w, u * 12);
  if (el.dest) txt(c, el.dest, 0, by + u * 0.6, u * 4, '800', '#d9d5cc', 'center', 'middle', 2);
  if (el.pax) { const v = markVal(el.pax, L, lt) ?? el.pax[0][1]; const hot = el.paxhot && lt >= at(L, el.paxhot);
    c.save(); if (hot) { c.shadowColor = GLOW.red; c.shadowBlur = 30; const pk2 = 1 + 0.25 * (1 - easeOut((lt - at(L, el.paxhot)) / 0.3)); c.translate(-W2 + u * 4, by); c.scale(pk2, pk2); c.translate(W2 - u * 4, -by); }
    txt(c, `PASSEGGERI: ${v}`, -W2 + u * 4, by + u * 0.6, u * 4.6, '900', hot ? C.red : C.w, 'left', 'middle', 1); c.restore(); }
  if (el.vol) { const v = markVal(el.vol, L, lt) ?? el.vol[0][1], vx = W2 - u * 34;
    txt(c, 'VOL', vx, by + u * 0.6, u * 3.6, '800', '#8d8981', 'left', 'middle', 2);
    c.beginPath(); c.roundRect(vx + u * 9, by - u * 0.6, u * 18, u * 2.4, u * 1.2); c.fillStyle = '#26241f'; c.fill();
    if (v > 0) { c.beginPath(); c.roundRect(vx + u * 9, by - u * 0.6, u * 18 * v, u * 2.4, u * 1.2); c.fillStyle = C.w; c.fill(); }
    txt(c, String(Math.round(v * 10)), W2 - u * 4, by + u * 0.6, u * 4.6, '900', v === 0 ? C.red : C.w, 'right', 'middle'); }
  if (el.gear && lt >= at(L, el.gear)) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 24; txt(c, 'R', W2 - u * 7, by + u * 0.6, u * 7, '900', C.red, 'center', 'middle'); c.restore(); }
  c.restore();
}
function windUI(c, el, L, lt, tt, size) {
  const w = size * 2.0, h = size * 1.1, W2 = w / 2, H2 = h / 2, u = w / 100;
  const top = H2 * 0.95, hy = -H2 * 0.02;
  // windshield shape (trapezoid), everything inside is clipped
  const shape = () => { c.beginPath(); c.moveTo(-W2 * 0.78, -top); c.quadraticCurveTo(0, -top - u * 3, W2 * 0.78, -top); c.lineTo(W2, H2 * 0.55); c.quadraticCurveTo(0, H2 * 0.4, -W2, H2 * 0.55); c.closePath(); };
  c.save(); shape(); c.clip(); c.shadowBlur = 0;
  c.fillStyle = '#07080a'; c.fillRect(-W2, -H2 - 20, w, h + 40);
  // ground + headlight beams
  c.fillStyle = '#0d0e10'; c.fillRect(-W2, hy, w, H2 * 2);
  { const g = c.createLinearGradient(0, H2 * 0.55, 0, hy); g.addColorStop(0, 'rgba(245,214,140,0.40)'); g.addColorStop(0.7, 'rgba(245,214,140,0.10)'); g.addColorStop(1, 'rgba(245,214,140,0.02)');
    c.beginPath(); c.moveTo(-W2 * 0.75, H2 * 0.55); c.lineTo(-W2 * 0.1, hy); c.lineTo(W2 * 0.1, hy); c.lineTo(W2 * 0.75, H2 * 0.55); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath(); c.moveTo(-u * 0.6, H2 * 0.5); c.lineTo(-u * 0.25, hy); c.lineTo(u * 0.25, hy); c.lineTo(u * 0.6, H2 * 0.5); c.closePath(); c.fillStyle = 'rgba(242,239,232,0.10)'; c.fill(); }
  c.beginPath(); c.moveTo(-W2, hy); c.lineTo(W2, hy); c.lineWidth = 2; c.strokeStyle = 'rgba(242,239,232,0.25)'; c.stroke();
  // wheat along the horizon
  const fld = el.field ? 1 : 0.55;
  for (let i = 0; i < 160; i++) { const x = -W2 + hash(i * 2.3) * w, hh = u * (1 + hash(i * 5.1) * 2.6) * fld * (el.field && x > 0 ? 2.2 : 1);
    c.beginPath(); c.moveTo(x, hy + u * 0.5); c.lineTo(x + u * 0.3, hy - hh); c.lineWidth = 2; c.strokeStyle = `rgba(245,214,140,${0.15 + 0.25 * hash(i)})`; c.stroke(); }
  // the pole
  if (el.pole) { const k = el.pole === true ? 1 : clamp01((lt - at(L, el.pole)) / 0.4); c.save(); c.globalAlpha *= k; const px = W2 * 0.32;
    c.beginPath(); c.moveTo(px, hy + u * 2); c.lineTo(px + u * 0.4, -H2 * 0.62); c.moveTo(px - u * 4, -H2 * 0.55); c.lineTo(px + u * 4.6, -H2 * 0.57); c.lineWidth = u * 0.9; c.strokeStyle = '#d9d5cc'; c.stroke(); c.restore(); }
  // the sign
  if (el.sign !== undefined) { const k = el.signin ? clamp01((lt - at(L, el.signin)) / 0.5) : 1; c.save(); c.globalAlpha *= k; const sx = -W2 * 0.12, sy = hy - u * 9;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, hy + u * 2); c.lineWidth = u * 0.8; c.strokeStyle = '#d9d5cc'; c.stroke();
    c.shadowColor = GLOW.gold; c.shadowBlur = 30; c.beginPath(); c.roundRect(sx - u * 13, sy - u * 9, u * 26, u * 10, u * 0.8); c.fillStyle = '#f2efe8'; c.fill(); c.shadowBlur = 0;
    if (el.sign) { const rk = el.signat ? clamp01((lt - at(L, el.signat)) / 0.35) : 1; c.globalAlpha *= rk; txt(c, el.sign, sx, sy - u * 4, u * 4.0, '900', C.red, 'center', 'middle'); c.globalAlpha /= Math.max(rk, 0.001); }
    if (!el.sign || (el.signat && lt < at(L, el.signat))) for (let j = 0; j < 3; j++) { c.fillStyle = '#9a958c'; c.fillRect(sx - u * 8, sy - u * 6.8 + j * u * 2.4, u * (16 - j * 4), u * 0.9); }
    c.restore(); }
  c.restore();
  // frame, dashboard, wheel (drawn over the glass)
  c.save(); shape(); c.lineWidth = u * 1.4; c.strokeStyle = C.w; c.stroke();
  c.beginPath(); c.moveTo(-W2 * 1.05, H2 * 0.62); c.quadraticCurveTo(0, H2 * 0.44, W2 * 1.05, H2 * 0.62); c.lineTo(W2 * 1.05, H2 * 1.1); c.lineTo(-W2 * 1.05, H2 * 1.1); c.closePath(); c.fillStyle = '#050506'; c.fill(); c.lineWidth = u * 1.2; c.stroke();
  c.beginPath(); c.arc(-W2 * 0.42, H2 * 1.05, u * 16, Math.PI * 1.08, Math.PI * 1.92); c.lineWidth = u * 2.6; c.stroke();
  c.beginPath(); c.roundRect(W2 * 0.05, H2 * 0.62, u * 18, u * 7, u * 1); c.fillStyle = '#0b1016'; c.fill(); c.lineWidth = u * 0.8; c.stroke();   // the little nav screen in the dash
  c.fillStyle = C.gold; c.beginPath(); c.moveTo(W2 * 0.05 + u * 9, H2 * 0.62 + u * 1.5); c.lineTo(W2 * 0.05 + u * 10.5, H2 * 0.62 + u * 5); c.lineTo(W2 * 0.05 + u * 7.5, H2 * 0.62 + u * 5); c.closePath(); c.fill();
  c.restore();
}


// ---------- Caso 004: the flat ----------
function paw(c, x, y, r, rot) { c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.ellipse(0, 0, r, r * 0.85, 0, 0, 7); c.fill();
  for (const [dx, dy] of [[-0.95, -1.05], [-0.32, -1.5], [0.32, -1.5], [0.95, -1.05]]) { c.beginPath(); c.ellipse(dx * r, dy * r, r * 0.33, r * 0.4, 0, 0, 7); c.fill(); } c.restore(); }
function hallUI(c, el, L, lt, tt, size) {
  const w = size * 2.0, W2 = w / 2, u = w / 100, fy = u * 16, dh = u * 34, dw = u * 14;
  const T2 = k => el[k] === true ? 0 : at(L, el[k]);
  c.beginPath(); c.moveTo(-W2, fy); c.lineTo(W2, fy); c.lineWidth = u * 0.8; c.strokeStyle = C.w; c.stroke();            // floor
  const door = (x, label, col = C.w, al = 1, openK = 0) => { c.save(); c.globalAlpha *= al;
    if (openK > 0) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 60 * openK; c.fillStyle = `rgba(20,0,0,${0.9})`; c.fillRect(x - dw / 2, fy - dh, dw, dh); c.restore();
      c.fillStyle = `rgba(229,50,45,${0.25 * openK})`; c.fillRect(x - dw / 2, fy - dh, dw, dh); }
    c.beginPath(); c.rect(x - dw / 2, fy - dh, dw, dh); c.lineWidth = u * 0.9; c.strokeStyle = col; c.stroke();
    const ox = x - dw / 2 + dw * (1 - 0.75 * openK); if (openK > 0) { c.beginPath(); c.moveTo(ox, fy - dh); c.lineTo(ox, fy); c.stroke(); }
    c.beginPath(); c.arc(x + dw * 0.32 * (1 - openK), fy - dh * 0.45, u * 0.9, 0, 7); c.fillStyle = col; c.fill();
    if (label) txt(c, label, x, fy - dh - u * 3.5, u * 3.2, '800', '#8d8981', 'center', 'middle', 3); c.restore(); };
  const xs = { bagno: -W2 * 0.78, quarta: -W2 * 0.38, cucina: W2 * 0.12, camera: W2 * 0.6 };
  door(xs.bagno, 'BAGNO'); door(xs.cucina, 'CUCINA');
  c.save(); c.shadowColor = GLOW.gold; c.shadowBlur = 30; door(xs.camera, 'CAMERA'); c.restore();
  c.save(); c.fillStyle = 'rgba(245,214,140,0.5)'; c.fillRect(xs.camera - dw / 2, fy - u * 0.6, dw, u * 0.6); c.restore();       // light under the bedroom door
  if (el.fourth) { const k = clamp01((lt - T2('fourth')) / 0.5); const ok = el.open ? easeOut(clamp01((lt - T2('open')) / 1.2)) : 0;
    c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 30 * k; door(xs.quarta, '', C.red, k, ok); c.restore(); }
  if (el.wallmark) { const k = clamp01((lt - T2('wallmark')) / 0.4); c.save(); c.globalAlpha *= k * (0.6 + 0.4 * Math.sin(tt * 4)); c.shadowColor = GLOW.gold; c.shadowBlur = 24;
    c.beginPath(); c.arc(xs.quarta + dw * 0.32, fy - dh * 0.45, u * 1.4, 0, 7); c.fillStyle = C.gold; c.fill(); c.restore(); }
  if (el.paws) { const k = clamp01((lt - T2('paws')) / 1.8), n = 10; c.fillStyle = C.w;
    for (let j = 0; j < n * k; j++) { const t = j / (n - 1), x = xs.quarta + (xs.camera - dw * 0.7 - xs.quarta) * t; paw(c, x, fy + u * 3 + (j % 2 ? u * 2 : 0), u * 1.05, Math.PI / 2); } }
  if (el.cat) { c.save(); c.translate(xs.cucina - u * 13, fy - u * 6.2); c.scale(u * 13, u * 13); ICONS.cat(c, { look: 'left' }); c.restore(); }
}
function planUI(c, el, L, lt, tt, size) {
  const w = size * 1.6, h = size * 0.95, W2 = w / 2, H2 = h / 2, u = w / 100;
  c.beginPath(); c.roundRect(-W2 - u * 3, -H2 - u * 6, w + u * 6, h + u * 9, u * 1.5); c.fillStyle = '#f2efe8'; c.fill(); c.shadowBlur = 0;
  txt(c, 'PLANIMETRIA · ALLEGATO B', -W2, -H2 - u * 2.4, u * 2.8, '900', C.bg, 'left', 'middle', 2);
  c.strokeStyle = C.bg; c.lineWidth = u * 1.1; c.strokeRect(-W2 + u * 2, -H2 + u * 3, w - u * 4, h - u * 6);
  const cy = H2 * 0.1, ch = u * 9;                                                              // corridor band
  c.lineWidth = u * 0.7; c.beginPath(); c.moveTo(-W2 + u * 2, cy - ch); c.lineTo(W2 - u * 2, cy - ch); c.moveTo(-W2 + u * 2, cy + ch); c.lineTo(W2 - u * 2, cy + ch);
  c.moveTo(-W2 * 0.45, -H2 + u * 3); c.lineTo(-W2 * 0.45, cy - ch); c.moveTo(W2 * 0.3, -H2 + u * 3); c.lineTo(W2 * 0.3, cy - ch); c.moveTo(0, cy + ch); c.lineTo(0, H2 - u * 3); c.stroke();
  txt(c, 'BAGNO', -W2 * 0.73, -H2 * 0.4, u * 3.4, '900', C.bg); txt(c, 'CUCINA', -W2 * 0.07, -H2 * 0.4, u * 3.4, '900', C.bg);
  txt(c, 'CAMERA', W2 * 0.64, -H2 * 0.4, u * 3.4, '900', C.bg); txt(c, 'SOGGIORNO', -W2 * 0.5, H2 * 0.55, u * 3.4, '900', C.bg); txt(c, 'INGRESSO', W2 * 0.5, H2 * 0.55, u * 3.4, '900', C.bg);
  const doors = [-W2 * 0.73, -W2 * 0.07, W2 * 0.64], mk = el.mark ? lt - at(L, el.mark) : -1;
  doors.forEach((x, j) => { c.fillStyle = '#f2efe8'; c.fillRect(x - u * 4, cy - ch - u * 0.8, u * 8, u * 1.6); c.beginPath(); c.arc(x - u * 4, cy - ch, u * 8, -Math.PI / 2, 0); c.lineWidth = u * 0.4; c.strokeStyle = C.bg; c.stroke();
    if (mk > j * 0.25) { c.save(); c.shadowColor = GLOW.gold; c.shadowBlur = 20; c.beginPath(); c.arc(x, cy, u * 3.2, 0, 7); c.fillStyle = C.gold; c.fill(); c.restore(); txt(c, String(j + 1), x, cy + u * 0.3, u * 3.6, '900', C.bg); } });
  if (mk > 0.9) { c.save(); c.globalAlpha *= clamp01((mk - 0.9) / 0.4); c.setLineDash([u * 1.2, u * 1.2]); c.strokeStyle = C.red; c.lineWidth = u * 0.6; c.strokeRect(-W2 * 0.45 + u * 2, cy - ch - u * 0.6, W2 * 0.3, u * 1.2); c.restore(); }
}
function billUI(c, el, L, lt, tt, size) {
  const w = size * 1.6, h = size * 0.9, W2 = w / 2, H2 = h / 2, u = w / 100;
  c.beginPath(); c.roundRect(-W2, -H2, w, h, u * 1.5); c.fillStyle = '#f2efe8'; c.fill(); c.shadowBlur = 0;
  txt(c, 'BOLLETTA LUCE', -W2 + u * 5, -H2 + u * 7, u * 5, '900', C.bg, 'left', 'middle'); txt(c, 'CONSUMI MEDI PER ORA · NOVEMBRE', -W2 + u * 5, -H2 + u * 12.5, u * 2.6, '800', '#6b675f', 'left', 'middle', 2);
  const k = el.spike ? clamp01((lt - at(L, el.spike)) / 0.6) : 1, bx = -W2 + u * 6, bw = (w - u * 12) / 24, base = H2 - u * 12;
  for (let hh = 0; hh < 24; hh++) { const day = hh >= 7 && hh <= 23 ? 0.35 + 0.35 * Math.abs(Math.sin(hh * 1.3)) : 0.06; const hot = hh === 3; const v = hot ? 0.06 + 0.9 * easeOut(k) : day;
    c.fillStyle = hot ? C.red : '#3a3936'; c.fillRect(bx + hh * bw + bw * 0.15, base - v * (h * 0.55), bw * 0.7, v * (h * 0.55)); }
  [0, 3, 6, 12, 18, 23].forEach(hh => txt(c, String(hh).padStart(2, '0'), bx + hh * bw + bw / 2, base + u * 4, u * 2.6, hh === 3 ? '900' : '800', hh === 3 ? C.red : '#6b675f'));
  if (k > 0.5) { c.save(); c.globalAlpha *= clamp01((k - 0.5) * 2); txt(c, '03:00-04:00', bx + 4 * bw + u * 1, base - h * 0.47, u * 3.4, '900', C.red, 'left', 'middle'); c.restore(); }
}
function invUI(c, el, L, lt, tt, size) {
  const w = size * 1.0, h = size * 1.15, W2 = w / 2, H2 = h / 2, u = w / 100;
  c.beginPath(); c.roundRect(-W2, -H2, w, h, u * 2); c.fillStyle = '#f2efe8'; c.fill(); c.shadowBlur = 0;
  txt(c, 'INVENTARIO', -W2 + u * 8, -H2 + u * 11, u * 8, '900', C.bg, 'left', 'middle'); txt(c, 'ARREDI CONSEGNATI', -W2 + u * 8, -H2 + u * 19, u * 4, '800', '#6b675f', 'left', 'middle', 2);
  ['1  LETTO', '1  ARMADIO', '1  TAVOLO', '2  SEDIE'].forEach((t, j) => txt(c, t, -W2 + u * 8, -H2 + u * (33 + j * 11), u * 6, '800', C.bg, 'left', 'middle'));
  const y = -H2 + u * 79; txt(c, '1  ', -W2 + u * 8, y, u * 6, '800', C.bg, 'left', 'middle');
  for (let j = 0; j < 3; j++) { c.fillStyle = '#6b675f'; c.fillRect(-W2 + u * (20 + j * 22), y - u * 2.2, u * 18, u * 4.4); }
  if (el.strike) { const k = clamp01((lt - at(L, el.strike)) / 0.5); c.save(); c.strokeStyle = C.red; c.lineWidth = u * 1.6; c.shadowColor = GLOW.red; c.shadowBlur = 16; c.beginPath();
    for (let j = 0; j <= 20 * k; j++) { const x = -W2 + u * (18 + j * 3.4), yy = y + Math.sin(j * 1.9) * u * 2.6; j ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); c.restore(); }
  if (el.name && lt >= at(L, el.name)) { c.save(); c.globalAlpha *= clamp01((lt - at(L, el.name)) / 0.3); txt(c, 'UN NOME', W2 - u * 8, y + u * 12, u * 5, '900', C.red, 'right', 'middle'); c.restore(); }
}
function keysUI(c, el, L, lt, tt, size) {
  const n = el.n || 14, cols = 7, s = size * 0.34, gx = s * 0.9, gy = s * 0.5;
  for (let j = 0; j < n; j++) { const k = backOut((lt - j * 0.12) / 0.3); if (k <= 0) continue; const x = (j % cols - (cols - 1) / 2) * gx, y = (Math.floor(j / cols) - 0.5) * gy;
    c.save(); c.translate(x, y); c.scale(k * s, k * s); c.shadowColor = GLOW.gold; c.shadowBlur = 20; ICONS.key(c, { col: C.gold }); c.restore(); }
  if (el.close && lt >= at(L, el.close)) { const k = clamp01((lt - at(L, el.close)) / 0.3); c.save(); c.globalAlpha *= k; c.rotate(-0.12); c.scale(1 + 0.4 * (1 - k), 1 + 0.4 * (1 - k));
    c.shadowColor = GLOW.red; c.shadowBlur = 30; c.lineWidth = 10; c.strokeStyle = C.red; c.strokeRect(-size * 0.55, -size * 0.16, size * 1.1, size * 0.32); txt(c, 'SALDATO', 0, 6, size * 0.2, '900', C.red); c.restore(); }
}

// ---------- templates ----------
function ruleCard(c, n, lt) {
  const text = SCRIPT.rules[n - 1].toUpperCase();
  const a = easeOut(lt / 0.45);
  c.save(); c.translate(CX, 330 + (1 - a) * 40); c.globalAlpha = clamp01(lt / 0.2);
  c.shadowColor = GLOW.white; c.shadowBlur = 30;
  c.font = '900 150px Montserrat'; const tw = c.measureText('REGOLA').width;
  const bx = tw / 2 + 40, bs = 170, total = tw + 40 + bs;
  txt(c, 'REGOLA', -total / 2, 0, 150, '900', C.w, 'left', 'middle');
  const pk = backOut((lt - 0.15) / 0.35);
  c.save(); c.translate(-total / 2 + tw + 40 + bs / 2, 0); c.scale(pk, pk);
  c.beginPath(); c.roundRect(-bs / 2, -bs / 2, bs, bs, 26); c.fillStyle = C.w; c.fill(); c.shadowBlur = 0; txt(c, String(n), 0, 8, 130, '900', C.bg, 'center', 'middle'); c.restore();
  const lk = easeOut((lt - 0.3) / 0.5); c.shadowColor = GLOW.red; c.beginPath(); c.moveTo(-300, 130); c.lineTo(-300 + 600 * lk, 130); c.lineWidth = 6; c.strokeStyle = C.red; c.stroke();
  c.shadowColor = GLOW.white; c.globalAlpha *= clamp01((lt - 0.45) / 0.3);
  let fsz = 62; const nl = f => { c.font = `800 ${f}px Montserrat`; let n = 1, cur = ''; for (const w of text.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > 1500 && cur) { n++; cur = w; } else cur = t2; } return n; };
  while (fsz > 44 && nl(fsz) > 2) fsz -= 2;
  wrap(c, text, 0, 225, 1500, fsz, '800', C.w, fsz * 1.22);
  c.restore();
  progress(c, CX, 690, 52, n, clamp01((lt - 0.6) / 0.3));
}
function progress(c, x, y, s, cur, al = 1) {
  const seen = new Set(Object.keys(RULE_AT).map(Number).filter(n => n <= cur)); const gap = 12, tot = 7 * s + 6 * gap;
  c.save(); c.globalAlpha *= al;
  for (let i = 1; i <= 7; i++) {
    const bx = x - tot / 2 + (i - 1) * (s + gap), on = i === cur, past = i < cur && seen.has(i);
    c.beginPath(); c.roundRect(bx, y - s / 2, s, s, s * 0.18);
    if (on) { c.shadowColor = GLOW.white; c.shadowBlur = 24; c.fillStyle = C.w; c.fill(); c.shadowBlur = 0; }
    else { c.lineWidth = Math.max(2, s * 0.05); c.strokeStyle = past ? 'rgba(242,239,232,0.75)' : 'rgba(242,239,232,0.25)'; c.stroke(); }
    txt(c, String(i), bx + s / 2, y + s * 0.04, s * 0.48, '800', on ? C.bg : past ? 'rgba(242,239,232,0.85)' : 'rgba(242,239,232,0.3)', 'center', 'middle');
  }
  c.restore();
}
function wrap(c, s, x, y, maxW, size, weight, col, lh) {
  c.font = `${weight} ${size}px Montserrat`; const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => txt(c, ln, x, y + (i - (lines.length - 1) / 2) * lh, size, weight, col, 'center', 'middle'));
  return lines.length;
}
function clash(c, v, L, lt, tt) {
  const card = (x, n, hi, col) => {
    c.save(); c.translate(x, CY - 20); const s = hi ? 1.06 : 0.92; c.scale(s, s); c.globalAlpha = hi ? 1 : 0.35;
    c.shadowColor = col === C.red ? GLOW.red : GLOW.white; c.shadowBlur = hi ? 40 : 0;
    c.beginPath(); c.roundRect(-330, -230, 660, 460, 24); c.lineWidth = 6; c.strokeStyle = col; c.stroke();
    txt(c, `REGOLA ${n}`, 0, -140, 70, '900', col, 'center', 'middle');
    wrap(c, SCRIPT.rules[n - 1].toUpperCase(), 0, 30, 560, 40, '800', C.w, 54); c.restore();
  };
  const f = v.focus, [ra, rb] = SCRIPT.conflict || [1, 7];
  card(CX - 420, ra, f === ra || f === 0, C.red); card(CX + 420, rb, f === rb || f === 0, C.green);
  if (f === 0) {
    c.save(); c.translate(CX, CY - 20); c.shadowColor = GLOW.gold; c.shadowBlur = 40; c.scale(160, 160); (ICONS[v.center || 'intercom'])(c, {}); c.restore();
    const ck = v.crack ? clamp01((lt - at(L, v.crack)) / 0.3) : 0;
    if (ck > 0) { c.save(); c.strokeStyle = C.red; c.shadowColor = GLOW.red; c.shadowBlur = 30; c.lineWidth = 6; c.beginPath();
      [[0, -90], [-14, -40], [12, 0], [-10, 40], [8, 90]].slice(0, 1 + Math.floor(ck * 4)).forEach(([x, y], i) => i ? c.lineTo(CX + x, CY - 20 + y) : c.moveTo(CX + x, CY - 20 + y)); c.stroke(); c.restore(); }
  }
}
function choice(c, L, lt) {
  c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 30;
  const CH = { title: 'COSA FAI?', a: 'RISPONDI', a_sub: 'infrangi la regola 1', b: 'NON RISPONDERE', b_sub: 'lasci fuori te stesso', cta: 'SCRIVILO NEI COMMENTI', ...(SCRIPT.choice || {}) };
  txt(c, CH.title, CX, 230, 110, '900', C.w, 'center', 'middle');
  const cbtn = (x, col, a, b, d) => { const k = backOut((lt - d) / 0.35); c.save(); c.translate(x, 520); c.scale(k, k);
    c.shadowColor = col === C.red ? GLOW.red : 'rgba(39,168,92,0.9)'; c.beginPath(); c.roundRect(-380, -140, 760, 280, 30); c.fillStyle = col; c.fill(); c.shadowBlur = 0;
    c.font = '900 84px Montserrat'; const fs = Math.min(1, 680 / c.measureText(a).width); c.save(); c.scale(fs, fs); txt(c, a, 0, -20 / fs, 84, '900', C.w, 'center', 'middle'); c.restore(); txt(c, b, 0, 70, 34, '600', 'rgba(255,255,255,0.85)', 'center', 'middle'); c.restore(); };
  cbtn(CX - 430, C.green, CH.a, CH.a_sub, 0.3);
  cbtn(CX + 430, C.red, CH.b, CH.b_sub, 0.6);
  c.globalAlpha = clamp01((lt - 1.2) / 0.4); txt(c, CH.cta, CX, 780, 54, '900', C.gold, 'center', 'middle', 4);
  c.restore();
}
function endCard(c, L, lt) {
  c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 30; const k = easeOut(lt / 0.5);
  const EN = { title: 'ISCRIVITI', sub: 'LA NOTTE 2 È GIÀ COMINCIATA', ...(SCRIPT.end || {}) };
  c.globalAlpha = k; txt(c, EN.title, CX, 380, 170, '900', C.w, 'center', 'middle');
  c.shadowColor = GLOW.red; txt(c, EN.sub, CX, 540, 62, '900', C.red, 'center', 'middle');
  c.shadowBlur = 0; txt(c, SCRIPT.case, CX, 660, 30, '600', C.dim, 'center', 'middle', 8);
  progress(c, CX, 760, 40, 8, 1); c.restore();
}

// ---------- chrome: HUD + captions + grain + vignette ----------
const GRAIN = Array.from({ length: 6 }, (_, g) => { const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270; const x = cv.getContext('2d'); const im = x.createImageData(480, 270);
  for (let i = 0; i < im.data.length; i += 4) { const v = hash(i * 0.37 + g * 1013) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return cv; });
function hud(c, t, L) {
  c.save();
  txt(c, SCRIPT.case, 70, 58, 24, '600', '#8d8981', 'left', 'middle', 6);
  const seen = rulesSeen(t); const cur = L.rule || (seen.length ? Math.max(...seen) : 0);
  if (seen.length) progress(c, CX, 58, 26, cur, 0.9);
  txt(c, `${SCRIPT.night}  ·  ${clockAt(t)}`, FW - 70, 58, 26, '800', '#d9d5cc', 'right', 'middle', 4);
  c.restore();
}
function caption(c, L, t) {
  const lt = t - L.cut; if (!L.cap || L.v?.t === 'choice' || L.v?.t === 'end') return;
  c.save(); c.globalAlpha = clamp01(lt / 0.15); c.shadowColor = 'rgba(242,239,232,0.55)'; c.shadowBlur = 18;
  wrap(c, L.cap.toUpperCase(), CX, 968, 1640, 50, '800', '#f4f1ea', 62); c.restore();
}

// ---------- the one entry point ----------
window.seek = (t) => {
  let li = 0; for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].cut) li = i;
  const L = LINES[li], lt = t - L.cut, v = L.v || {};
  // stage (everything that can glitch / shake / zoom)
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalAlpha = 1; sc.fillStyle = C.bg; sc.fillRect(0, 0, FW, FH);
  const push = 1 + 0.035 * (1 - easeOut(lt / 0.5));                   // every cut lands with a small push
  const dLine = L.next - L.cut, toEnd = L.next - t;
  const creep = 1 + 0.035 * clamp01(lt / Math.max(1, dLine));          // slow push-in through the line
  const exitK = clamp01(1 - toEnd / 0.16);                             // quick scale-out into the next cut
  const drift = creep * (1 - 0.04 * exitK) * (1 + 0.008 * Math.sin(t * 0.21));
  // dust: a few slow motes (deterministic)
  for (let i = 0; i < 40; i++) { const px = (hash(i) * FW + t * (6 + hash(i + 1) * 14)) % FW, py = (hash(i + 2) * FH - t * (3 + hash(i + 3) * 8) + FH * 10) % FH;
    sc.fillStyle = `rgba(242,239,232,${0.05 + 0.12 * hash(i + 4)})`; sc.beginPath(); sc.arc(px, py, 1 + hash(i + 5) * 1.6, 0, 7); sc.fill(); }
  let shx = 0, shy = 0;
  if (v.fx === 'shake' && lt < 0.5) { shx = Math.sin(t * 90) * 14 * (1 - lt / 0.5); shy = Math.cos(t * 77) * 10 * (1 - lt / 0.5); }
  sc.translate(CX + shx, CY + shy); sc.scale(push * drift, push * drift); sc.translate(-CX, -CY);
  sc.globalAlpha = 1 - 0.85 * exitK;
  if (v.t === 'rule') ruleCard(sc, v.n, lt);
  else if (v.t === 'clash') clash(sc, v, L, lt, t);
  else if (v.t === 'choice') choice(sc, L, lt);
  else if (v.t === 'end') endCard(sc, L, lt);
  else { const els = v.els || []; const lead = els.length && els.every(e => e.at !== undefined);
    els.forEach((el, i) => drawEl(sc, lead && i === 0 ? { ...el, _lead: true, a: el.a === 'shake' ? 'shake' : 'pop' } : el, L, lt, t)); }
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalAlpha = 1;
  // blackout
  if (v.fx && v.fx.startsWith('blackout@')) { const b = clamp01((lt - at(L, v.fx.split('@')[1])) / 0.35); if (b > 0) { sc.fillStyle = `rgba(0,0,0,${b * 0.93})`; sc.fillRect(0, 0, FW, FH); } }

  // composite with optional glitch (RGB split + slice offsets)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, FW, FH);
  let g = 0; if (v.fx && v.fx.startsWith('glitch')) { const w = v.fx.split('@')[1]; const g0 = w ? at(L, w) : 0; const d = lt - g0; if (d >= 0 && d < 0.45) g = 1 - d / 0.45; }
  if (g > 0 && hash(Math.floor(t * 30)) > 0.25) {
    const off = 10 + 22 * g;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7;
    ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg)'; ctx.drawImage(stage, -off, 0);
    ctx.filter = 'sepia(1) saturate(8) hue-rotate(150deg)'; ctx.drawImage(stage, off, 0);
    ctx.filter = 'none'; ctx.globalAlpha = 0.8; ctx.drawImage(stage, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) { const y = hash(i + Math.floor(t * 30) * 7) * FH, h = 8 + hash(i * 3 + Math.floor(t * 30)) * 50; ctx.drawImage(stage, 0, y, FW, h, (hash(i * 5 + Math.floor(t * 30)) - 0.5) * 120 * g, y, FW, h); }
  } else ctx.drawImage(stage, 0, 0);

  // vignette + grain (fixed sequence → deterministic)
  const vg = ctx.createRadialGradient(CX, FH / 2, FH * 0.35, CX, FH / 2, FH * 1.0); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, FW, FH);
  ctx.globalAlpha = 0.035; ctx.globalCompositeOperation = 'screen'; ctx.drawImage(GRAIN[Math.round(t * FPS) % GRAIN.length], 0, 0, FW, FH);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  hud(ctx, t, L);
  caption(ctx, L, t);
  // fade in / out
  const fade = Math.min(clamp01(t / 0.6), clamp01((DUR - t) / 1.2)); if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, FW, FH); }
};

// events for the sound mix: one sound per beat
const ev = [];
for (const L of LINES) {
  const v = L.v || {};
  if (v.t === 'rule') ev.push({ t: L.cut + 0.02, k: 'rule' });
  else ev.push({ t: L.cut, k: 'cut' });
  for (const [k, w] of v.sfx || L.sfx || []) ev.push({ t: L.cut + at(L, w), k });
  if (v.fx && v.fx.startsWith('glitch')) { const w = v.fx.split('@')[1]; ev.push({ t: L.cut + (w ? at(L, w) : 0), k: 'glitch' }); }
  if (v.fx && v.fx.startsWith('blackout@')) ev.push({ t: L.cut + at(L, v.fx.split('@')[1]), k: 'off' });
  if (v.t === 'choice') ev.push({ t: L.cut, k: 'boom' });
  if (v.t === 'end') ev.push({ t: L.cut, k: 'end_hit' });
}
window.EVENTS = { dips: SCRIPT.dips, duration: DUR, estimated: !!TIM.estimated, ev, lines: LINES.map(L => ({ id: L.id, cut: L.cut, start: L.start, end: L.end })) };
window.SHOTS = LINES.map(L => [L.id, L.cut]);
window.ready = true;
