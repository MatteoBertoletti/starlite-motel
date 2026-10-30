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
const colOf = n => n === 'red' ? C.red : n === 'gold' ? C.gold : n === 'green' ? C.green : C.w;

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
  else if (ICONS[i] || ['you', 'admin', 'bruni', 'mother', 'shadow'].includes(i)) {
    // per-icon live parameters
    if (i === 'note') { o.write = el.a === 'write' ? clamp01(k / 2.2) : 1; if (el.flip) { const f = lt - at(L, el.flip); if (f > 0) { const s2 = Math.cos(clamp01(f / 0.5) * Math.PI); c.scale(Math.abs(s2) || 0.01, 1); if (s2 < 0) { o.back = true; } } } }
    if (i === 'door') { if (el.open) { const ot = typeof el.open === 'string' ? at(L, el.open) : 0; o.openK = easeOut((lt - ot) / 0.6); if (el.close) o.openK *= 1 - easeOut((lt - at(L, el.close)) / 0.4); }
      if (el.gap) { const gt = typeof el.gap === 'string' ? at(L, el.gap) : 0; o.gapK = clamp01((lt - gt) / 0.2); }
      if (el.tape) { const tt2 = typeof el.tape === 'string' ? at(L, el.tape) : 0; o.tapeK = clamp01((lt - tt2) / 0.3); }
      if (el.zoomgap) { const z = easeOut(lt / 3); c.translate(0, -size * 0.3 * z); c.scale(1 + 0.8 * z, 1 + 0.8 * z); } }
    if (i === 'elevator') { o.openK = el.open === true ? 1 : el.open ? easeOut((lt - at(L, el.open)) / 0.8) : 0; o.sinkK = el.sink ? easeOut((lt - at(L, el.sink)) / 1.5) : 0; if (el.sink) c.translate(0, o.sinkK * size * 0.04); }
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
  wrap(c, text, 0, 225, 1500, 62, '800', C.w, 76);
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
  const f = v.focus;
  card(CX - 420, 1, f === 1 || f === 0, C.red); card(CX + 420, 7, f === 7 || f === 0, C.green);
  if (f === 0) {
    c.save(); c.translate(CX, CY - 20); c.shadowColor = GLOW.gold; c.shadowBlur = 40; c.scale(160, 160); ICONS.intercom(c, {}); c.restore();
    const ck = v.crack ? clamp01((lt - at(L, v.crack)) / 0.3) : 0;
    if (ck > 0) { c.save(); c.strokeStyle = C.red; c.shadowColor = GLOW.red; c.shadowBlur = 30; c.lineWidth = 6; c.beginPath();
      [[0, -90], [-14, -40], [12, 0], [-10, 40], [8, 90]].slice(0, 1 + Math.floor(ck * 4)).forEach(([x, y], i) => i ? c.lineTo(CX + x, CY - 20 + y) : c.moveTo(CX + x, CY - 20 + y)); c.stroke(); c.restore(); }
  }
}
function choice(c, L, lt) {
  c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 30;
  txt(c, 'COSA FAI?', CX, 230, 110, '900', C.w, 'center', 'middle');
  const btn = (x, col, a, b, d) => { const k = backOut((lt - d) / 0.35); c.save(); c.translate(x, 520); c.scale(k, k);
    c.shadowColor = col === C.red ? GLOW.red : 'rgba(39,168,92,0.9)'; c.beginPath(); c.roundRect(-380, -140, 760, 280, 30); c.fillStyle = col; c.fill(); c.shadowBlur = 0;
    c.font = '900 84px Montserrat'; const fs = Math.min(1, 680 / c.measureText(a).width); c.save(); c.scale(fs, fs); txt(c, a, 0, -20 / fs, 84, '900', C.w, 'center', 'middle'); c.restore(); txt(c, b, 0, 70, 34, '600', 'rgba(255,255,255,0.85)', 'center', 'middle'); c.restore(); };
  btn(CX - 430, C.green, 'RISPONDI', 'infrangi la regola 1', 0.3);
  btn(CX + 430, C.red, 'NON RISPONDERE', 'lasci fuori te stesso', 0.6);
  c.globalAlpha = clamp01((lt - 1.2) / 0.4); txt(c, 'SCRIVILO NEI COMMENTI', CX, 780, 54, '900', C.gold, 'center', 'middle', 4);
  c.restore();
}
function endCard(c, L, lt) {
  c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 30; const k = easeOut(lt / 0.5);
  c.globalAlpha = k; txt(c, 'ISCRIVITI', CX, 380, 170, '900', C.w, 'center', 'middle');
  c.shadowColor = GLOW.red; txt(c, 'LA NOTTE 2 È GIÀ COMINCIATA', CX, 540, 62, '900', C.red, 'center', 'middle');
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
window.EVENTS = { duration: DUR, estimated: !!TIM.estimated, ev, lines: LINES.map(L => ({ id: L.id, cut: L.cut, start: L.start, end: L.end })) };
window.SHOTS = LINES.map(L => [L.id, L.cut]);
window.ready = true;
