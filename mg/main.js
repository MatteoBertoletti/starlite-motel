// Motion-graphics film: black stage, glowing flat pictograms, rule cards, full-sentence captions.
// window.seek(t) draws frame t and is a pure function of time; every beat is keyed to word times.
import { ICONS, C, T, rings } from './icons.js';

const Q = new URLSearchParams(location.search);
const EP = Q.get('ep') || 'ep01_citofono';

for (const [w, f] of [['600', 'montserrat-latin-600-normal'], ['800', 'montserrat-latin-800-normal'], ['900', 'montserrat-latin-900-normal']]) {
  const ff = new FontFace('Montserrat', `url(./node_modules/@fontsource/montserrat/files/${f}.woff2)`, { weight: w }); await ff.load(); document.fonts.add(ff);
}
const SCRIPT = await (await fetch(`./episodes/${EP}/script.json`)).json();
const VERT = SCRIPT.format === 'vertical';                      // 9:16 shorts: the whole stage is drawn at 1080x1920, nothing is cropped
const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080, FPS = 30;
const out = document.getElementById('film'); out.width = FW; out.height = FH; out.style.width = FW + 'px'; out.style.height = FH + 'px';
const ctx = out.getContext('2d');
const stage = document.createElement('canvas'); stage.width = FW; stage.height = FH; const sc = stage.getContext('2d');
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
const CX = FW / 2, CY = VERT ? 768 : 450, UX = VERT ? 400 : 720, UY = VERT ? 420 : 330, US = VERT ? 400 : 430;   // stage centre and units
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
  const t0 = el.at !== undefined && !el._lead ? at(L, el.at) + (el._dt || 0) : 0;
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
  else if (a === 'buzz') { const on = (k < 0.4 || (k > 0.55 && k < 0.95)) ? 1 : 0; dx = on * Math.sin(k * 140) * 14; rot = on * Math.sin(k * 110) * 0.012; }
  else if (a === 'impact') { sc = 1 + 0.35 * (1 - easeOut(k / 0.22)); }
  else if (a === 'impactdrift') { sc = 1 + 0.35 * (1 - easeOut(k / 0.22)) + 0.06 * k; dx = k * 45; rot = Math.sin(k * 2.2) * 0.015; }
  else if (a === 'buzzdrift') { const ph = k % 1.1, on = ph < 0.45 ? 1 : 0; dx = on * Math.sin(k * 140) * 14 + k * 30; dy = -k * 18; rot = on * Math.sin(k * 110) * 0.012; }
  else if (a === 'surge') { sc = 1 + 0.35 * (1 - easeOut(k / 0.22)) + (SCRIPT.surge || 0.14) * k; dy = -k * 34; rot = Math.sin(k * 2.0) * 0.035; }   // a word that keeps coming at you
  else if (a === 'still') { }
  else if (a === 'insert') { dx = (1 - easeOut(k / 0.5)) * -160; al = clamp01(k / 0.15); }
  if (SCRIPT.alive && !VERT && a !== 'impactdrift' && a !== 'surge') { const kk = Math.max(0, k - 0.3), big = ['classroom', 'corridor', 'register', 'board', 'notebook'].includes(el.i);   // nothing sits still: a slow grow, and small things sway
    sc *= 1 + SCRIPT.alive * kk; if (!big) { rot += Math.sin(kk * 1.6 + (el.x || 0) * 2) * 0.03 * clamp01(kk); dy += Math.sin(kk * 2.1) * 12 * clamp01(kk); } }
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
  if (!VERT && (i === 'classroom' || i === 'corridor')) { c.beginPath(); c.rect(-(x + dx) - 600, -(y + dy) - 600, FW + 1200, 600 + 835); c.clip(); }
  if (el.sweat) { c.save(); c.shadowBlur = 0; for (let j = 0; j < 3; j++) { const ph = (tt * 0.9 + j / 3) % 1, sx = size * (j === 1 ? 0.2 : -0.17 + j * 0.05), sy = -size * 0.36 + ph * size * 0.28;
    c.save(); c.globalAlpha *= 1 - ph; c.translate(sx, sy); c.beginPath(); c.moveTo(0, -size * 0.035); c.quadraticCurveTo(size * 0.025, 0, 0, size * 0.02); c.quadraticCurveTo(-size * 0.025, 0, 0, -size * 0.035); c.fillStyle = '#9fd3ff'; c.fill(); c.restore(); } c.restore(); }
  if (i === 'clock') { c.scale(sc, sc); txt(c, el.text, 0, 0, 250, '800', colOf(el.col), 'center', 'middle'); c.shadowBlur = 0; txt(c, SCRIPT.night, 0, -150, 34, '600', C.dim, 'center', 'middle', 10); }
  else if (i === 'bigbubble') { c.scale(sc, sc); const ls = el.lines || [el.text], fs = 118 * (el.s || 1), w = 940 * (el.s || 1), h = (ls.length * 1.15 + 0.7) * fs;
    c.shadowColor = GLOW.red; c.shadowBlur = 60; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, fs * 0.5); c.fillStyle = C.red; c.fill(); c.shadowBlur = 0;
    ls.forEach((t2, j) => txt(c, t2, 0, -h / 2 + fs * 0.35 + fs * 1.15 * (j + 0.5), fs, '900', C.w, 'center', 'middle')); }
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
  else if (i === 'vchat') { c.scale(sc, sc); vchatUI(c, el, L, lt, tt, size); }
  else if (i === 'mic') { c.scale(sc, sc); micUI(c, el, L, lt, tt, size); }
  else if (i === 'assistant') { c.scale(sc, sc); assistantUI(c, el, L, lt, tt, size); }
  else if (i === 'lights') { c.scale(sc, sc); lightsUI(c, el, L, lt, tt, size); }
  else if (i === 'applog') { c.scale(sc, sc); applogUI(c, el, L, lt, tt, size); }
  else if (i === 'devices') { c.scale(sc, sc); devicesUI(c, el, L, lt, tt, size); }
  else if (i === 'rooms') { c.scale(sc, sc); roomsUI(c, el, L, lt, tt, size); }
  else if (i === 'plug') { c.scale(sc, sc); plugUI(c, el, L, lt, tt, size); }
  else if (i === 'tally') { c.scale(sc, sc); tallyUI(c, el, L, lt, tt, size); }
  else if (i === 'box') { c.scale(sc, sc); boxUI(c, el, L, lt, tt, size); }
  else if (i === 'entry') { c.scale(sc, sc); entryUI(c, el, L, lt, tt, size); }
  else if (i === 'wallclock') { c.scale(sc, sc); wallclockUI(c, el, L, lt, tt, size); }
  else if (i === 'blackout') { }
  else if (i === 'topfloor') { c.scale(sc, sc); floorUI(c, el, L, lt, tt, size); }
  else if (i === 'hall') { c.scale(sc, sc); hallUI(c, el, L, lt, tt, size); }
  else if (i === 'plan') { c.scale(sc, sc); planUI(c, el, L, lt, tt, size); }
  else if (i === 'bill') { c.scale(sc, sc); billUI(c, el, L, lt, tt, size); }
  else if (i === 'inventory') { c.scale(sc, sc); invUI(c, el, L, lt, tt, size); }
  else if (i === 'keys') { c.scale(sc, sc); keysUI(c, el, L, lt, tt, size); }
  else if (i === 'youhp') { c.scale(sc, sc); youhpUI(c, el, L, lt, tt, size); }
  else if (i === 'vnote') { c.scale(sc, sc); vnoteUI(c, el, L, lt, tt, size); }
  else if (i === 'kitchen') { c.scale(sc, sc); kitchenUI(c, el, L, lt, tt, size); }
  else if (i === 'micplan') { c.scale(sc, sc); micplanUI(c, el, L, lt, tt, size); }
  else if (i === 'wavebump') { c.scale(sc, sc); wavebumpUI(c, el, L, lt, tt, size); }
  else if (i === 'landing') { c.scale(sc, sc); landingUI(c, el, L, lt, tt, size); }
  else if (i === 'sig') { c.scale(sc, sc); sigUI(c, el, L, lt, tt, size); }
  else if (i === 'flat') { c.scale(sc, sc); flatUI(c, el, L, lt, tt, size); }
  else if (i === 'tilt') { c.scale(sc, sc); tiltUI(c, el, L, lt, tt, size); }
  else if (i === 'doorgap') { c.scale(sc, sc); doorgapUI(c, el, L, lt, tt, size); }
  else if (i === 'delchat') { c.scale(sc, sc); delchatUI(c, el, L, lt, tt, size); }
  else if (i === 'lockphone') { c.scale(sc, sc); lockUI(c, el, L, lt, tt, size); }
  else if (i === 'house') { c.scale(sc, sc); houseUI(c, el, L, lt, tt, size); }
  else if (i === 'doorlight') { c.scale(sc, sc); doorlightUI(c, el, L, lt, tt, size); }
  else if (i === 'youface') { c.scale(sc, sc); youfaceUI(c, el, L, lt, tt, size); }
  else if (i === 'tablephone') { c.scale(sc, sc); tablephoneUI(c, el, L, lt, tt, size); }
  else if (i === 'recenti') { c.scale(sc, sc); calllogUI(c, el, L, lt, tt, size); }
  else if (i === 'lamp2') { c.scale(sc, sc); lampUI(c, el, L, lt, tt, size); }
  else if (i === 'stairwell') { c.scale(sc, sc); stairwellUI(c, el, L, lt, tt, size); }
  else if (i === 'classroom' || i === 'corridor') { c.save(); c.scale(sc, sc); (i === 'classroom' ? classroomUI : corridorUI)(c, el, L, lt, tt, size); c.restore();
    if (!VERT) { const g = c.createLinearGradient(0, 715 - (y + dy), 0, 835 - (y + dy)); g.addColorStop(0, 'rgba(5,5,6,0)'); g.addColorStop(1, 'rgba(5,5,6,1)'); c.shadowBlur = 0; c.fillStyle = g; c.fillRect(-(x + dx) - 600, 715 - (y + dy), FW + 1200, 121); } }
  else if (i === 'register') { c.scale(sc, sc); registerUI(c, el, L, lt, tt, size); }
  else if (i === 'board') { c.scale(sc, sc); boardUI(c, el, L, lt, tt, size); }
  else if (i === 'notebook') { c.scale(sc, sc); notebookUI(c, el, L, lt, tt, size); }
  else if (i === 'backpack') { c.scale(sc, sc); backpackUI(c, el, L, lt, tt, size); }
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
    o.tt = tt;
    if (i === 'shoe') { o.steamK = el.steam ? (el.steam === true ? 1 : clamp01((lt - at(L, el.steam) - (el._dt || 0)) / 0.4)) : 0; o.emptyK = el.empty ? 1 : 0; }
    if (i === 'sofa') o.sitterK = el.sitter ? (el.sitter === true ? 1 : (lt >= at(L, el.sitter) ? 1 : 0)) : 0;
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
    for (let k = 0; k < n; k++) { const hh = m.flat ? u * 0.6 : u * (1.5 + 5 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6))); const xx = x0 + (x1 - x0) * k / (n - 1); c.fillStyle = k / n < prog ? C.red : C.bg; c.fillRect(xx - u * 0.6, cy - hh, u * 1.2, hh * 2); }
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



// ---------- shorts: a big generic chat (no app, no logo) and the microphone button ----------
function vchatUI(c, el, L, lt, tt, size) {
  const W = size * 2.3, u = W / 100, W2 = W / 2; let y = 0;
  if (el.phone) { c.save(); c.beginPath(); c.roundRect(-W2 - u * 5, -u * 12, W + u * 10, u * (el.phoneh || 150), u * 9); c.lineWidth = u * 1.2; c.strokeStyle = '#8d8981'; c.stroke(); c.restore(); }
  if (el.head) { c.beginPath(); c.arc(-W2 + u * 5, y, u * 4.2, 0, 7); c.fillStyle = '#26241f'; c.fill(); c.lineWidth = u * 0.5; c.strokeStyle = '#8d8981'; c.stroke();
    c.beginPath(); c.arc(-W2 + u * 5, y - u * 1, u * 1.6, 0, 7); c.fillStyle = '#8d8981'; c.fill(); c.beginPath(); c.arc(-W2 + u * 5, y + u * 3.6, u * 2.8, Math.PI * 1.15, Math.PI * 1.85); c.fill();
    const st = el.status && (el.statusat === undefined || lt >= at(L, el.statusat) + (el._dt || 0)) && !(el.statusoff !== undefined && lt >= at(L, el.statusoff) + (el._dt || 0) && !(el.statuson !== undefined && lt >= at(L, el.statuson) + (el._dt || 0)));
    const hf = el.bighead ? 1.6 : 1;
    txt(c, el.head, -W2 + u * 12, el.sub || st ? y - u * 2.6 * hf : y, u * 5.2 * hf, '900', C.w, 'left', 'middle', 2);
    if (st) txt(c, el.status, -W2 + u * 12, y + u * 3.6 * hf, u * 3.4 * hf, '800', '#7fd9a0', 'left', 'middle', 1);
    else if (el.sub) txt(c, el.sub, -W2 + u * 12, y + u * 3.6 * hf, u * 3.4 * hf, '800', '#8d8981', 'left', 'middle', 1);
    if (el.clock) txt(c, el.clock, W2, y, u * 5.2, '800', '#8d8981', 'right', 'middle', 2);
    c.fillStyle = '#26241f'; c.fillRect(-W2, y + u * 7 * (el.bighead ? 1.6 : 1), W, u * 0.4); y += u * 14 * (el.bighead ? 1.5 : 1); }
  for (const m of el.msgs || []) {
    if (m.at !== undefined && lt < at(L, m.at)) continue;
    const k = m.at !== undefined ? easeOut((lt - at(L, m.at)) / 0.25) : 1, me = m.who === 'me';
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * u * 5);
    let bw, bh; const col = m.col === 'red' ? C.red : me ? C.gold : C.w;
    let text = m.text; if (m.typing && m.textat !== undefined && lt >= at(L, m.textat)) text = m.typing;   // dots, then the words
    const dots = m.typing && text === m.text && m.text === '…';
    if (m.from) txt(c, m.from, me ? W2 : -W2, y - u * 0.5, u * 3.2, '800', '#8d8981', me ? 'right' : 'left', 'alphabetic', 1);
    if (m.from) { y += u * 2; }
    if (m.voice) { bw = u * (m.full ? 100 : 86); bh = u * (m.full ? 24 : 19); }
    else { const fz = m.big ? 10 : 6.4; c.font = `800 ${u * fz}px Montserrat`; bw = dots ? u * (m.big ? 40 : 24) : Math.min(u * 86, c.measureText(text).width + u * 10); bh = u * (m.big ? 21 : 15); }
    const x = me ? W2 - bw : -W2;
    c.save(); if (m.col === 'red' || m.glow) { c.shadowColor = m.col === 'red' ? GLOW.red : GLOW.white; c.shadowBlur = 36; }
    c.beginPath(); c.roundRect(x, y, bw, bh, u * 5); c.fillStyle = col; c.fill(); c.restore();
    const cy = y + bh / 2;
    if (m.voice) {
      c.fillStyle = C.bg; c.beginPath(); c.moveTo(x + u * 6, cy - u * 4); c.lineTo(x + u * 13, cy); c.lineTo(x + u * 6, cy + u * 4); c.closePath(); c.fill();
      const n = 22, x0 = x + u * 18, x1 = x + bw - u * 26;
      const prog = m.play !== undefined ? clamp01((lt - at(L, m.play)) / 2.2) : 0;
      for (let j = 0; j < n; j++) { const pulse = m.pulse ? u * (0.5 + 1.1 * Math.max(0, Math.sin(tt * 7 - j * 0.35))) : u * 0.5; const hh = m.flat ? pulse : u * (1.2 + 5.5 * Math.abs(Math.sin(j * 1.7) * Math.cos(j * 0.6))); const xx = x0 + (x1 - x0) * j / (n - 1); c.fillStyle = j / n < prog ? C.red : C.bg; c.fillRect(xx - u * 0.7, cy - hh, u * 1.4, hh * 2); }
      txt(c, m.voice, x + bw - u * 4, cy + u * 0.3, u * 9, '900', C.bg, 'right', 'middle');
    } else if (dots) { const off = m.stop !== undefined && lt >= at(L, m.stop) + (el._dt || 0) && !(m.restart !== undefined && lt >= at(L, m.restart) + (el._dt || 0));
      const dz = m.big ? 1.7 : 1; for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + u * (6 + j * 6) * dz, cy + (off ? 0 : Math.sin(tt * 8 - j * 0.9) * u * 1.2 * dz), u * 1.6 * dz, 0, 7); c.fillStyle = off ? '#9a958c' : C.bg; c.fill(); } }
    else txt(c, text, x + u * 5, cy + u * 0.3, u * (m.big ? 10 : 6.4), '800', m.col === 'red' ? C.w : C.bg, 'left', 'middle');
    if (m.strike !== undefined && lt >= at(L, m.strike) + 0.25) { const sk = clamp01((lt - at(L, m.strike) - 0.25) / 0.2); c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 20;
      c.beginPath(); c.moveTo(x - u * 2, cy + u * 4); c.lineTo(x - u * 2 + (bw + u * 4) * sk, cy - u * 4); c.lineWidth = u * 1.6; c.strokeStyle = C.red; c.stroke(); c.restore(); }
    if (m.time) txt(c, m.time, me ? W2 : -W2, y + bh + u * 4, u * 3.8, '800', '#8d8981', me ? 'right' : 'left', 'middle', 2);
    c.restore(); y += bh + u * (m.time ? 10 : 5);
  }
}
function micUI(c, el, L, lt, tt, size) {
  const pressT = el.press !== undefined ? at(L, el.press) + (el._dt || 0) : null, r = size * 0.42, rec = (el.rec !== undefined && lt >= at(L, el.rec) + (el._dt || 0)) || el.rec === true || (pressT !== null && lt >= pressT + 0.12);
  const squash = pressT !== null && lt >= pressT ? 1 - 0.06 * Math.sin(clamp01((lt - pressT) / 0.25) * Math.PI) : 1; c.scale(squash, squash);
  if (rec) for (let k = 0; k < 3; k++) { const a = (tt * 1.2 + k / 3) % 1; c.save(); c.globalAlpha *= 1 - a; c.beginPath(); c.arc(0, 0, r * (1 + a * 0.9), 0, 7); c.lineWidth = 8; c.strokeStyle = C.red; c.stroke(); c.restore(); }
  c.save(); c.shadowColor = rec ? GLOW.red : GLOW.white; c.shadowBlur = 40; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = rec ? C.red : C.w; c.fill(); c.restore();
  const ink = rec ? C.w : C.bg; c.fillStyle = ink; c.strokeStyle = ink; c.lineCap = 'round';
  c.beginPath(); c.roundRect(-r * 0.17, -r * 0.5, r * 0.34, r * 0.62, r * 0.17); c.fill();
  c.beginPath(); c.arc(0, -r * 0.08, r * 0.3, 0.15, Math.PI - 0.15); c.lineWidth = r * 0.07; c.stroke(); c.beginPath(); c.moveTo(0, r * 0.22); c.lineTo(0, r * 0.4); c.stroke();
  if (el.timer && rec) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 30; txt(c, el.timer, 0, -r * 1.55, r * 0.62, '900', C.red, 'center', 'middle'); c.restore(); }
  if (el.thumb !== undefined) {                                   // the thumb rises from below and stops just above the button
    const k = easeOut(clamp01((lt - (el.thumb === true ? 0 : at(L, el.thumb) + (el._dt || 0))) / 0.6)); let ty = r * 2.6 - k * r * 1.75, hover = k >= 1 && pressT === null ? Math.sin(tt * 3) * 4 : 0;
    if (pressT !== null && lt >= pressT) ty -= r * 0.45 * easeOut(clamp01((lt - pressT) / 0.12));
    if (el.pressed) { ty = r * 0.4; hover = 0; }
    c.save(); c.translate(r * 0.15, ty + hover); c.rotate(-0.18);
    c.beginPath(); c.roundRect(-r * 0.36, -r * 0.2, r * 0.72, r * 1.0, r * 0.36); c.fillStyle = '#d9d5cc'; c.fill(); c.lineWidth = 6; c.strokeStyle = C.bg; c.stroke();
    c.beginPath(); c.roundRect(-r * 0.22, -r * 0.08, r * 0.44, r * 0.5, r * 0.14); c.fillStyle = '#f2efe8'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#9a958c'; c.stroke();
    c.restore(); }
}


// ---------- Short 002: the floor seen from above, footprints of one foot only ----------
function footprint(c, x, y, s, rot) { c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.ellipse(0, 0, s * 0.42, s, 0, 0, 7); c.fill();
  [[-0.32, -1.25, 0.2], [-0.05, -1.38, 0.17], [0.18, -1.32, 0.15], [0.36, -1.18, 0.13], [0.48, -0.98, 0.11]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, 7); c.fill(); }); c.restore(); }
function floorUI(c, el, L, lt, tt, size) {
  const w = size * 2.2, h = size * 2.6, W2 = w / 2, H2 = h / 2, u = w / 100;
  c.fillStyle = '#121214'; c.fillRect(-W2, -H2, w, h);
  for (let j = 1; j < 12; j++) { c.fillStyle = 'rgba(242,239,232,0.05)'; c.fillRect(-W2, -H2 + j * h / 12, w, 2); }     // floorboards
  c.lineWidth = u * 1.4; c.strokeStyle = C.w; c.strokeRect(-W2, -H2, w, h);
  const dx = W2 * 0.45; c.fillStyle = '#121214'; c.fillRect(dx - u * 12, -H2 - u, u * 24, u * 2.5);                   // the door, top
  c.beginPath(); c.moveTo(dx - u * 12, -H2); c.lineTo(dx - u * 12, -H2 + u * 24); c.lineWidth = u * 1.0; c.stroke(); c.beginPath(); c.arc(dx - u * 12, -H2, u * 24, 0, Math.PI / 2); c.lineWidth = u * 0.4; c.setLineDash([u, u]); c.stroke(); c.setLineDash([]);
  txt(c, 'PORTA', dx, -H2 + u * 5, u * 3.6, '800', '#8d8981', 'center', 'middle', 3);
  const sx = -W2 * 0.35, sy = H2 - u * 18;                                                                               // the sofa, bottom, top-down
  c.beginPath(); c.roundRect(sx - u * 30, sy - u * 9, u * 60, u * 22, u * 3); c.fillStyle = '#3a3936'; c.fill(); c.lineWidth = u * 0.8; c.stroke();
  c.beginPath(); c.roundRect(sx - u * 26, sy - u * 9, u * 52, u * 14, u * 2); c.fillStyle = '#4a4844'; c.fill();
  txt(c, 'DIVANO', sx, sy + u * 8.5, u * 3.6, '800', '#d9d5cc', 'center', 'middle', 3);
  if (el.prints !== undefined) { const k = clamp01((lt - (el.prints === true ? -9 : at(L, el.prints) + (el._dt || 0))) / 2.0), n = 6;
    c.save(); c.fillStyle = C.red; c.shadowColor = GLOW.red; c.shadowBlur = 16;
    for (let j = 0; j < n * k; j++) { const t = j / (n - 1), x = dx + (sx + u * 8 - dx) * t + Math.sin(j * 2.1) * u * 1.5, y = -H2 + u * 30 + (sy - u * 16 - (-H2 + u * 30)) * t;
      footprint(c, x, y, u * 5.2, Math.atan2(sx - dx, -(sy + H2))); }
    c.restore(); }
}


// ---------- Caso 005: the voice assistant ----------
const W_ = (L, el, k) => el[k] === true ? -99 : el[k] === undefined || el[k] === false ? null : at(L, el[k]) + (el._dt || 0);
function ringDraw(c, rx, ry, mode, lt, tt, k) {          // the light ring on top of the cylinder
  if (!mode || k <= 0) { c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.lineWidth = ry * 0.5; c.strokeStyle = '#2a2a2e'; c.stroke(); return; }
  const col = mode === 'red' ? C.red : '#8fd3ff', glow = mode === 'red' ? GLOW.red : 'rgba(143,211,255,0.9)';
  c.save(); c.globalAlpha *= k; c.shadowColor = glow; c.shadowBlur = 40; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.lineWidth = ry * 0.5; c.strokeStyle = col; c.stroke();
  if (mode === 'listen') { const a0 = tt * 4; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, a0, a0 + 1.4); c.lineWidth = ry * 0.8; c.strokeStyle = '#fff'; c.stroke(); }
  c.restore();
}
function assistantUI(c, el, L, lt, tt, size) {
  const w = size * 0.55, h = size * 0.75, rx = w / 2, ry = w * 0.16, top = -h / 2;
  if (el.cable) { c.save(); c.lineWidth = size * 0.02; c.strokeStyle = '#d9d5cc'; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(rx * 1.6, h / 2 - size * 0.04, size * 0.13 - j * size * 0.015, size * 0.05 - j * size * 0.004, 0, 0, 7); c.stroke(); }
    c.beginPath(); c.moveTo(rx * 0.7, h / 2 - size * 0.08); c.quadraticCurveTo(rx * 1.2, h / 2, rx * 1.6 - size * 0.13, h / 2 - size * 0.04); c.stroke(); c.restore(); }
  if (el.unplugged) { c.save(); c.lineWidth = size * 0.02; c.strokeStyle = '#d9d5cc'; c.beginPath(); c.moveTo(rx * 0.7, h / 2 - size * 0.08); c.bezierCurveTo(rx * 1.4, h / 2 + size * 0.1, rx * 2.2, h / 2 - size * 0.05, rx * 2.4, h / 2 + size * 0.02); c.stroke();
    c.fillStyle = '#d9d5cc'; c.fillRect(rx * 2.4, h / 2 - size * 0.03, size * 0.09, size * 0.1); c.fillRect(rx * 2.4 + size * 0.09, h / 2 - size * 0.01, size * 0.04, size * 0.015); c.fillRect(rx * 2.4 + size * 0.09, h / 2 + size * 0.04, size * 0.04, size * 0.015); c.restore(); }
  c.beginPath(); c.moveTo(-rx, top); c.lineTo(-rx, h / 2 - ry); c.ellipse(0, h / 2 - ry, rx, ry, 0, Math.PI, 0, true); c.lineTo(rx, top); c.closePath();
  c.fillStyle = '#18181b'; c.fill(); c.lineWidth = size * 0.012; c.strokeStyle = C.w; c.stroke();
  c.save(); c.clip(); for (let j = 0; j < 140; j++) { c.fillStyle = 'rgba(242,239,232,0.10)'; c.beginPath(); c.arc(-rx + hash(j * 1.3) * w, top + hash(j * 4.7) * h, size * 0.004, 0, 7); c.fill(); } c.restore();   // fabric
  c.save(); c.translate(0, top); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fillStyle = '#232326'; c.fill(); c.lineWidth = size * 0.012; c.strokeStyle = C.w; c.stroke();
  const t0 = W_(L, el, 'ring'), mode = el.ring === true || (typeof el.ring === 'string' && !['red', 'listen'].includes(el.ring)) ? 'on' : el.ring;
  const k = el.ring === undefined || el.ring === false ? 0 : (typeof el.ring === 'string' && !['red', 'listen'].includes(el.ring) ? clamp01((lt - t0) / 0.4) : 1);
  ringDraw(c, rx * 0.86, ry * 0.86, mode === 'on' ? 'on' : mode, lt, tt, k); c.restore();
}
function lightsUI(c, el, L, lt, tt, size) {
  const w = size * 2.0, h = size * 1.15, W2 = w / 2, H2 = h / 2, u = w / 100;
  const rooms = [['SALOTTO', -W2, -H2, w * 0.42, h * 0.62], ['CAMERA', -W2 + w * 0.42, -H2, w * 0.33, h * 0.62], ['RIPOST.', -W2 + w * 0.75, -H2, w * 0.25, h * 0.3],
    ['CUCINA', -W2, -H2 + h * 0.62, w * 0.42, h * 0.38], ['BAGNO', -W2 + w * 0.42, -H2 + h * 0.62, w * 0.33, h * 0.38], ['INGRESSO', -W2 + w * 0.75, -H2 + h * 0.3, w * 0.25, h * 0.7]];
  c.lineWidth = u * 0.8; c.strokeStyle = C.w;
  rooms.forEach(([n, x, y, rw, rh]) => { c.fillStyle = '#121214'; c.fillRect(x, y, rw, rh); c.strokeRect(x, y, rw, rh); txt(c, n, x + u * 2, y + u * 3.5, u * 2.8, '800', '#8d8981', 'left', 'middle', 2); });
  const z7 = el.zoom7 ? 1 : 0; if (z7) { const [, x, y, rw, rh] = rooms[2]; c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 30; c.lineWidth = u * 1.2; c.strokeStyle = C.red; c.strokeRect(x, y, rw, rh); c.restore(); }
  const bulbs = [[-W2 + w * 0.12, -H2 + h * 0.3], [-W2 + w * 0.3, -H2 + h * 0.3], [-W2 + w * 0.52, -H2 + h * 0.3], [-W2 + w * 0.66, -H2 + h * 0.3], [-W2 + w * 0.21, -H2 + h * 0.82], [-W2 + w * 0.58, -H2 + h * 0.82]];
  const s7 = el.seventh === undefined ? null : (el.seventh === true ? 0 : at(L, el.seventh) + (el._dt || 0)); const show7 = s7 !== null && lt >= s7;
  const list = show7 ? [...bulbs, [-W2 + w * 0.875, -H2 + h * 0.17]] : bulbs, off0 = W_(L, el, 'off');
  if (el.echo !== undefined) { const e0 = W_(L, el, 'echo'); if (lt >= e0) rooms.forEach(([, x, y, rw, rh], j) => { const ph = ((lt - e0) * 0.8 + j * 0.17) % 1; c.save(); c.globalAlpha *= 1 - ph; c.beginPath(); c.arc(x + rw / 2, y + rh / 2, ph * Math.min(rw, rh) * 0.5, 0, 7); c.lineWidth = u * 0.5; c.strokeStyle = '#8fd3ff'; c.stroke(); c.restore(); }); }
  if (el.sockets !== undefined) { const s0 = W_(L, el, 'sockets'); rooms.forEach(([, x, y, rw, rh], j) => { const on = lt >= s0 + j * 0.12; const sx = x + rw - u * 4, sy = y + rh - u * 4;
    c.save(); if (on) { c.shadowColor = GLOW.red; c.shadowBlur = 24; } c.beginPath(); c.roundRect(sx - u * 2, sy - u * 2, u * 4, u * 4, u * 0.8); c.fillStyle = on ? C.red : '#3a3936'; c.fill(); c.restore();
    c.fillStyle = C.bg; c.fillRect(sx - u * 1, sy - u * 0.3, u * 0.5, u * 0.9); c.fillRect(sx + u * 0.5, sy - u * 0.3, u * 0.5, u * 0.9); }); }
  if (!el.nolights) list.forEach(([x, y], j) => { const lit = off0 === null || lt < off0 + j * 0.18; const is7 = j === 6, col = el.red || is7 ? C.red : C.gold;
    c.save(); if (lit) { c.shadowColor = el.red || is7 ? GLOW.red : GLOW.gold; c.shadowBlur = 40; } c.beginPath(); c.arc(x, y, u * 2.6, 0, 7); c.fillStyle = lit ? col : '#2a2a2e'; c.fill(); c.lineWidth = u * 0.4; c.strokeStyle = lit ? col : '#5a5852'; c.stroke(); c.restore();
    if (el.count) txt(c, String(j + 1), x, y + u * 6, u * 3.4, '900', is7 ? C.red : C.w, 'center', 'middle'); });
}
function applogUI(c, el, L, lt, tt, size) {
  const w = size * 2.1, W2 = w / 2, u = w / 100, rh = u * 7.2, n = el.n || 6, h = u * 14 + n * rh, H2 = h / 2;
  c.beginPath(); c.roundRect(-W2, -H2, w, h, u * 2); c.fillStyle = '#141416'; c.fill(); c.lineWidth = u * 0.4; c.strokeStyle = '#3a3936'; c.stroke();
  txt(c, 'REGISTRO ATTIVITÀ', -W2 + u * 4, -H2 + u * 6, u * 3.6, '900', C.w, 'left', 'middle', 2);
  const r0 = W_(L, el, 'rows') ?? -99, hot = W_(L, el, 'hot');
  for (let j = 0; j < n; j++) { if (lt < r0 + j * 0.15) continue; const y = -H2 + u * 14 + j * rh + rh / 2;
    c.fillStyle = j % 2 ? '#18181b' : '#1d1d20'; c.fillRect(-W2 + u * 2, y - rh / 2 + u * 0.4, w - u * 4, rh - u * 0.8);
    txt(c, `SERA ${j + 1}`, -W2 + u * 4, y, u * 2.8, '800', '#8d8981', 'left', 'middle', 2);
    txt(c, '00:00 «BUONANOTTE» → «GRAZIE»', -W2 + u * 15, y, u * 2.7, '800', C.w, 'left', 'middle');
    const h2 = hot !== null && lt >= hot; const res = el.blank ? 'RICHIESTA: —' : '00:02 · CONFERMATA';
    txt(c, res, W2 - u * 4, y, u * 2.9, '900', h2 || el.blank ? C.red : C.gold, 'right', 'middle'); }
}
function devicesUI(c, el, L, lt, tt, size) {
  const w = size * 1.7, W2 = w / 2, u = w / 100, rh = u * 9, rows = [['ASSISTENTE · SALOTTO', 'ATTIVO'], ['LUCI · 7', 'ATTIVO'], ['PRESE · 9', 'ATTIVO'], ["PORTA D'INGRESSO", 'ATTIVO']];
  const h = u * 16 + (rows.length + 1) * rh, H2 = h / 2;
  c.beginPath(); c.roundRect(-W2, -H2, w, h, u * 2); c.fillStyle = '#141416'; c.fill(); c.lineWidth = u * 0.4; c.strokeStyle = '#3a3936'; c.stroke();
  txt(c, 'DISPOSITIVI', -W2 + u * 4, -H2 + u * 7, u * 4.4, '900', C.w, 'left', 'middle', 2);
  rows.forEach(([a, b], j) => { const y = -H2 + u * 16 + j * rh + rh / 2; txt(c, a, -W2 + u * 4, y, u * 3.6, '800', C.w, 'left', 'middle'); txt(c, b, W2 - u * 4, y, u * 3.2, '900', '#8fd3ff', 'right', 'middle', 2); });
  const y = -H2 + u * 16 + rows.length * rh + rh / 2;
  if (el.me) { const m0 = W_(L, el, 'meat') ?? -99; if (lt >= m0) { const k = clamp01((lt - m0) / 0.3); c.save(); c.globalAlpha *= k; c.shadowColor = GLOW.red; c.shadowBlur = 24;
    c.fillStyle = 'rgba(229,50,45,0.15)'; c.fillRect(-W2 + u * 2, y - rh / 2, w - u * 4, rh); c.shadowBlur = 0;
    for (let j = 0; j < 3; j++) { c.fillStyle = C.w; c.fillRect(-W2 + u * (4 + j * 9), y - u * 1.6, u * 7.5, u * 3.2); }
    txt(c, el.me, W2 - u * 4, y, u * 3.2, '900', C.red, 'right', 'middle', 2); c.restore(); } }
}
function roomsUI(c, el, L, lt, tt, size) {
  const w = size * 1.9, W2 = w / 2, u = w / 100, h = size * 0.85, H2 = h / 2;
  for (const [n, x] of [['SALOTTO', -W2], ['CAMERA', 0]]) { c.lineWidth = u * 0.8; c.strokeStyle = C.w; c.strokeRect(x, -H2, W2, h); txt(c, n, x + W2 / 2, -H2 + u * 5, u * 3.4, '800', '#8d8981', 'center', 'middle', 3); }
  const m = W_(L, el, 'move'), b = W_(L, el, 'back'); let x = -W2 / 2; if (m !== null && lt >= m) x = -W2 / 2 + W2 * easeOut(clamp01((lt - m) / 0.6)); if (b !== null && lt >= b) x = -W2 / 2;
  if (b !== null && lt >= b && lt < b + 0.3 && hash(Math.floor(tt * 30)) > 0.5) x += u * 3;
  c.save(); c.translate(x, u * 4); assistantUI(c, { ring: true }, L, lt, tt, size * 0.6); c.restore();
}
function plugUI(c, el, L, lt, tt, size) {
  const u = size / 100; c.beginPath(); c.roundRect(-u * 30, -u * 34, u * 44, u * 60, u * 6); c.fillStyle = '#e6e1d6'; c.fill();
  c.fillStyle = C.bg; for (const dx of [-u * 15, -u * 1]) { c.beginPath(); c.arc(dx, -u * 4, u * 3, 0, 7); c.fill(); }
  const o0 = W_(L, el, 'out'), k = o0 === null ? 0 : easeOut(clamp01((lt - o0) / 0.4)), px = u * 4 + k * u * 44;
  c.save(); c.translate(px, -u * 4); c.fillStyle = '#d9d5cc'; c.fillRect(0, -u * 9, u * 20, u * 18); c.fillRect(-u * 9 * (1 - k), -u * 5, u * 9 * (1 - k) + 1, u * 2.4); c.fillRect(-u * 9 * (1 - k), u * 2.6, u * 9 * (1 - k) + 1, u * 2.4);
  if (k > 0) { c.fillRect(-u * 9, -u * 5, u * 9, u * 2.4); c.fillRect(-u * 9, u * 2.6, u * 9, u * 2.4); }
  c.beginPath(); c.moveTo(u * 20, 0); c.quadraticCurveTo(u * 45, u * 2, u * 52, u * 30); c.lineWidth = u * 3; c.strokeStyle = '#d9d5cc'; c.stroke(); c.restore();
}
function tallyUI(c, el, L, lt, tt, size) {
  const n = el.n || 6, u = size / 100, gx = u * 22;
  for (let j = 0; j < 7; j++) { const x = (j - 3) * gx, k = backOut((lt - j * 0.18) / 0.3); if (k <= 0) continue; c.save(); c.translate(x, 0); c.scale(k, k);
    if (j < n) { c.shadowColor = GLOW.gold; c.shadowBlur = 24; txt(c, 'GRAZIE', 0, u * 30, u * 6, '900', C.gold); c.fillStyle = C.gold; c.fillRect(-u * 3, -u * 30, u * 6, u * 50); }
    else { c.setLineDash([u * 3, u * 3]); c.lineWidth = u * 1.6; c.strokeStyle = C.red; c.strokeRect(-u * 3, -u * 30, u * 6, u * 50); c.setLineDash([]); txt(c, '7?', 0, u * 30, u * 6, '900', C.red); }
    c.restore(); }
}
function boxUI(c, el, L, lt, tt, size) {
  const u = size / 100; c.beginPath(); c.moveTo(-u * 40, -u * 10); c.lineTo(u * 40, -u * 10); c.lineTo(u * 40, u * 40); c.lineTo(-u * 40, u * 40); c.closePath(); c.fillStyle = '#6b5233'; c.fill(); c.lineWidth = u * 1.6; c.strokeStyle = C.w; c.stroke();
  c.beginPath(); c.moveTo(-u * 40, -u * 10); c.lineTo(-u * 52, -u * 30); c.lineTo(u * 0, -u * 30); c.lineTo(u * 12, -u * 10); c.closePath(); c.fillStyle = '#7d6140'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(u * 40, -u * 10); c.lineTo(u * 52, -u * 30); c.lineTo(u * 4, -u * 30); c.lineTo(-u * 8, -u * 10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(242,239,232,0.85)'; c.fillRect(-u * 6, u * 5, u * 12, u * 3); c.fillRect(-u * 20, u * 14, u * 40, u * 2);
}


// ---------- Short 003: the entrance in the dark, a phone buzzing on the floor; a wall clock ----------
function entryUI(c, el, L, lt, tt, size) {
  const w = size * 2.4, h = size * 3.0, W2 = w / 2, H2 = h / 2, u = w / 100, vx = 0, vy = -H2 * 0.15;
  const dw = u * 26, dh = u * 52, dx0 = vx - dw / 2, dy0 = vy - dh * 0.55;
  c.lineWidth = u * 0.8; c.strokeStyle = 'rgba(242,239,232,0.55)';
  [[-W2, -H2, dx0, dy0], [W2, -H2, dx0 + dw, dy0], [-W2, H2, dx0, dy0 + dh], [W2, H2, dx0 + dw, dy0 + dh]].forEach(([a, b, x2, y2]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x2, y2); c.stroke(); });
  c.fillStyle = '#0d0d0f'; c.fillRect(dx0, dy0, dw, dh); c.lineWidth = u * 1.0; c.strokeStyle = C.w; c.strokeRect(dx0, dy0, dw, dh);       // the front door
  c.beginPath(); c.arc(dx0 + dw * 0.82, dy0 + dh * 0.52, u * 1.2, 0, 7); c.fillStyle = C.w; c.fill();
  c.beginPath(); c.roundRect(dx0 + dw * 0.77, dy0 + dh * 0.58, u * 2.2, u * 3.2, u * 0.5); c.fillStyle = '#5a5852'; c.fill();             // the lock
  const p0 = el.buzz === undefined ? null : (el.buzz === true ? -99 : at(L, el.buzz) + (el._dt || 0)); const on = p0 !== null && lt >= p0;
  const bz = on ? Math.sin(tt * 90) * u * 0.5 * (Math.sin(tt * 6) > -0.2 ? 1 : 0) : 0, px = vx + u * 3 + bz, py = dy0 + dh + u * 18;
  if (on) { const g = c.createRadialGradient(px, py, 2, px, py, u * 26); g.addColorStop(0, 'rgba(143,211,255,0.35)'); g.addColorStop(1, 'rgba(143,211,255,0)'); c.fillStyle = g; c.fillRect(px - u * 30, py - u * 30, u * 60, u * 60); }
  c.save(); c.translate(px, py); c.transform(1, 0, -0.5, 0.45, 0, 0); c.beginPath(); c.roundRect(-u * 5, -u * 9, u * 10, u * 18, u * 1.6); c.fillStyle = on ? '#bfe6ff' : '#2a2a2e'; c.fill(); c.lineWidth = u * 0.5; c.strokeStyle = C.w; c.stroke(); c.restore();
  if (on) for (const s of [-1, 1]) for (let k = 1; k <= 2; k++) { c.beginPath(); c.arc(px, py, u * (8 + k * 4), s > 0 ? -0.5 : Math.PI - 0.5 + 1, s > 0 ? 0.5 : Math.PI + 0.5 + 0); c.lineWidth = u * 0.6; c.strokeStyle = `rgba(143,211,255,${0.7 - k * 0.25})`; c.stroke(); }
}
function wallclockUI(c, el, L, lt, tt, size) {
  const r = size * 0.42; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = '#f2efe8'; c.fill(); c.lineWidth = r * 0.08; c.strokeStyle = '#3a3936'; c.stroke();
  for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); c.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); c.lineWidth = r * 0.04; c.strokeStyle = C.bg; c.stroke(); }
  const [hh, mm0] = (el.time || '23:40').split(':').map(Number), tk = el.tick !== undefined ? W_el(L, el, 'tick') : null, mm = mm0 + (tk !== null ? easeOut(clamp01((lt - tk) / 0.6)) : 0), sec = tk !== null ? 45 + clamp01((lt - tk + 0.6) / 1.2) * 15 : (tt % 60);
  const hand = (a, l, wdt, col) => { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - Math.PI / 2) * l, Math.sin(a - Math.PI / 2) * l); c.lineWidth = wdt; c.strokeStyle = col; c.lineCap = 'round'; c.stroke(); };
  hand(((hh % 12) + mm / 60) * Math.PI / 6, r * 0.5, r * 0.08, C.bg); hand(mm * Math.PI / 30, r * 0.75, r * 0.05, C.bg); hand(sec * Math.PI / 30, r * 0.8, r * 0.02, C.red);
  c.beginPath(); c.arc(0, 0, r * 0.05, 0, 7); c.fillStyle = C.red; c.fill();
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
// ---------- Caso 006: the classroom ----------
function scrib(c, seed, x0, y0, w, h, k, col, lw) {          // a handwritten name: the same seed always gives the same hand
  const n = 7 + Math.floor(hash(seed) * 3), steps = 140, m = Math.floor(steps * clamp01(k)); if (m < 2) return;
  c.beginPath();
  for (let i = 0; i <= m; i++) { const t = i / steps, ph = t * n * Math.PI * 2, g = Math.floor(t * n), amp = h * (0.35 + 0.45 * hash(seed * 7 + g)) * (g === 0 ? 1.6 : 1);
    const x = x0 + t * w + Math.sin(ph) * h * 0.18, y = y0 - Math.max(0, -Math.cos(ph)) * amp + Math.sin(ph * 0.5) * h * 0.05;
    i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function pupil(c, x, y, f, u, col, hand, handK) {            // a pupil seen from behind: shoulders + head; optional raised hand
  if (hand && handK > 0) { const hk = easeOut(handK / 0.25), hx = x + u * 2.3 * f, top = y - u * (2.2 + 3.4 * hk) * f;
    c.beginPath(); c.moveTo(hx - u * 0.3 * f, y - u * 0.8 * f); c.lineTo(hx + u * 0.4 * f, top); c.lineWidth = u * 1.25 * f; c.strokeStyle = col; c.lineCap = 'round'; c.stroke();
    c.beginPath(); c.ellipse(hx + u * 0.5 * f, top - u * 0.9 * f, u * 1.0 * f, u * 1.35 * f, 0.12, 0, 7); c.fillStyle = col; c.fill();
    c.beginPath(); c.ellipse(hx - u * 0.45 * f, top - u * 0.5 * f, u * 0.32 * f, u * 0.7 * f, -0.7, 0, 7); c.fill(); }
  c.beginPath(); c.ellipse(x, y, u * 3.0 * f, u * 1.7 * f, 0, Math.PI, 0); c.fillStyle = col; c.fill();
  c.beginPath(); c.arc(x, y - u * 2.6 * f, u * 1.75 * f, 0, 7); c.fillStyle = col; c.fill();
}
function bagShape(c, x, y, s, col, glow) {                    // a closed backpack, front view; s = height
  c.save(); if (glow) { c.shadowColor = glow; c.shadowBlur = s * 0.5; }
  c.beginPath(); c.arc(x, y - s * 0.52, s * 0.12, Math.PI, 0); c.lineWidth = s * 0.06; c.strokeStyle = col; c.stroke();
  c.beginPath(); c.roundRect(x - s * 0.34, y - s * 0.5, s * 0.68, s * 0.98, s * 0.2); c.fillStyle = col; c.fill(); c.shadowBlur = 0;
  c.beginPath(); c.roundRect(x - s * 0.25, y + s * 0.02, s * 0.5, s * 0.36, s * 0.1); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
  c.beginPath(); c.moveTo(x - s * 0.22, y - s * 0.14); c.quadraticCurveTo(x, y - s * 0.24, x + s * 0.22, y - s * 0.14); c.lineWidth = s * 0.025; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.stroke();
  c.restore();
}
function classroomUI(c, el, L, lt, tt, size) {
  const w = size * 2.7, u = w / 100, R = 4, Cn = 6, E = [3, 5], Y = [1, 1];
  const f = r => 0.62 + 0.14 * r, ry = r => -u * 3 + r * u * 9.5, cx = (r, j) => (j - 2.5) * u * 13.2 * f(r);
  // walls, window wall on the right, the board and the teacher's desk
  c.lineWidth = u * 0.35; c.strokeStyle = 'rgba(242,239,232,0.35)';
  c.beginPath(); c.moveTo(-u * 34, -u * 14); c.lineTo(-u * 56, u * 34); c.moveTo(u * 34, -u * 14); c.lineTo(u * 56, u * 34); c.moveTo(-u * 34, -u * 14); c.lineTo(u * 34, -u * 14); c.stroke();
  for (let k = 0; k < 3; k++) { const a = k / 3, b = (k + 0.8) / 3, x1 = u * (35 + 21 * a), x2 = u * (35 + 21 * b), t1 = -u * (30 - 4 * a), t2 = -u * (30 - 4 * b), b1 = -u * 14 + u * 48 * a, b2 = -u * 14 + u * 48 * b;
    c.beginPath(); c.moveTo(x1, t1 + (b1 + u * 14) * 0.45); c.lineTo(x2, t2 + (b2 + u * 14) * 0.45); c.lineTo(x2, b2 - u * 4); c.lineTo(x1, b1 - u * 4); c.closePath();
    c.fillStyle = 'rgba(143,211,255,0.10)'; c.fill(); c.lineWidth = u * 0.3; c.strokeStyle = 'rgba(143,211,255,0.55)'; c.stroke(); }
  c.fillStyle = '#18241d'; c.fillRect(-u * 24, -u * 30, u * 48, u * 13); c.lineWidth = u * 0.6; c.strokeStyle = '#8a6f4e'; c.strokeRect(-u * 24, -u * 30, u * 48, u * 13);
  txt(c, el.date || 'LUNEDÌ', u * 21, -u * 27.3, u * 1.9, '700', 'rgba(242,239,232,0.8)', 'right', 'middle', 1);
  if (el.boardname !== undefined) { const b0 = W_(L, el, 'boardname'); if (lt >= b0) scrib(c, 6, u * 10, -u * 23.5, u * 10, u * 2.2, (lt - b0) / 1.4, el.namecol ? colOf(el.namecol) : 'rgba(242,239,232,0.85)', u * 0.35); }
  for (let j = 0; j < 3; j++) { c.beginPath(); c.moveTo(-u * 20, -u * (26 - j * 2.6)); c.lineTo(-u * (8 + j * 3), -u * (26 - j * 2.6)); c.lineWidth = u * 0.3; c.strokeStyle = 'rgba(242,239,232,0.35)'; c.stroke(); }
  if (el.teacher !== false) { const tg = W_(L, el, 'tgaze');
    c.save(); if (tg !== null && lt >= tg) { c.shadowColor = GLOW.red; c.shadowBlur = 20; }
    pupil(c, 0, -u * 12.5, 0.75, u, el.tred && lt >= (W_(L, el, 'tred') ?? 0) ? C.red : '#cfcac0', false, 0); c.restore();
    c.fillStyle = '#6b5233'; c.fillRect(-u * 9, -u * 12.6, u * 18, u * 3.2); c.lineWidth = u * 0.3; c.strokeStyle = C.w; c.strokeRect(-u * 9, -u * 12.6, u * 18, u * 3.2);
    if (el.books) { const b0 = W_(L, el, 'books') ?? -99; for (let j = 0; j < 24; j++) { if (lt < b0 + j * 0.05) break; const bx = -u * 8.2 + (j % 12) * u * 0.72, by = -u * 13.4 - Math.floor(j / 12) * u * 1.5; c.fillStyle = j === 23 ? C.red : ['#c9c3b6', '#8d8981', '#e6e1d6'][j % 3]; c.fillRect(bx, by, u * 0.6, u * 1.4); } }
    if (tg !== null && lt >= tg) { const k = clamp01((lt - tg) / 0.5), ex = cx(E[0], E[1]), ey = ry(E[0]) - u * 3; c.save(); c.setLineDash([u, u * 0.8]); c.beginPath(); c.moveTo(0, -u * 14); c.lineTo(ex * k, -u * 14 + (ey + u * 14) * k); c.lineWidth = u * 0.4; c.strokeStyle = C.gold; c.stroke(); c.restore(); } }
  const hot = W_(L, el, 'hot'), mine = W_(L, el, 'mine'), out = W_(L, el, 'youout'), hands = W_(L, el, 'hands'), chorus = W_(L, el, 'chorus'), echo = W_(L, el, 'echo'), num = W_(L, el, 'num'), look = W_(L, el, 'look');
  let idx = 0;
  for (let r = 0; r < R; r++) for (let j = 0; j < Cn; j++) {
    const s = f(r), x = cx(r, j), y = ry(r), isE = r === E[0] && j === E[1], isY = el.you && r === Y[0] && j === Y[1];
    const order = r * Cn + j; idx++;
    if (isE) { const gk = mine !== null && lt >= mine ? 'gold' : hot !== null && lt >= hot ? 'red' : null;
      if (gk) { c.save(); c.shadowColor = GLOW[gk]; c.shadowBlur = 40; c.lineWidth = u * 0.6; c.strokeStyle = gk === 'gold' ? C.gold : C.red; c.beginPath(); c.roundRect(x - u * 6 * s, y - u * 9 * s, u * 12 * s, u * 13 * s, u * s); c.stroke(); c.restore(); }
      const gh = W_(L, el, 'ghost'); if (gh !== null && lt >= gh) { c.save(); c.globalAlpha *= 0.85 * clamp01((lt - gh) / 1.2); c.shadowColor = GLOW.red; c.shadowBlur = 30; pupil(c, x, y - u * 1.4 * s, s, u, '#3a1210', false, 0);
        c.fillStyle = C.red; for (const ex of [-0.6, 0.6]) { c.beginPath(); c.arc(x + ex * u * s, y - u * 4.2 * s, u * 0.28 * s, 0, 7); c.fill(); } c.restore(); }
      else if (el.bag !== false) bagShape(c, x, y - u * 2.6 * s, u * 5.2 * s, gk === 'gold' ? C.gold : '#7f93a8', gk ? GLOW[gk] : null);
      if (echo !== null && lt >= echo) { const k = backOut((lt - echo) / 0.3); c.save(); c.translate(x, y - u * 10 * s); c.scale(k, k); c.shadowColor = GLOW.red; c.shadowBlur = 24; c.beginPath(); c.roundRect(-u * 6, -u * 1.8, u * 12, u * 3.6, u * 1.8); c.fillStyle = C.red; c.fill(); c.shadowBlur = 0; txt(c, 'PRESENTE', 0, u * 0.1, u * 1.9, '900', C.w); c.restore(); }
    } else {
      const tk = W_(L, el, 'taken'), taken = isY && tk !== null && lt >= tk; const col = taken ? C.red : isY ? C.gold : C.w; let al = 1; if (isY && !taken && out !== null && lt >= out) al = 1 - clamp01((lt - out) / 0.8) * 0.88;
      c.save(); c.globalAlpha *= al; if (isY) { c.shadowColor = taken ? GLOW.red : GLOW.gold; c.shadowBlur = 30; }
      const mh = isY ? W_(L, el, 'myhand') : null; pupil(c, x, y - u * 1.4 * s, s, u, col, (hands !== null && !isY) || mh !== null, mh !== null ? lt - mh : hands === null ? 0 : lt - hands - (order % 23) * 0.025); c.restore();
      if (chorus !== null && !isY && lt >= chorus + (order % 23) * 0.02) { const k = clamp01((lt - chorus - (order % 23) * 0.02) / 0.15); c.save(); c.globalAlpha *= k * 0.9; c.beginPath(); c.roundRect(x - u * 3.2 * s, y - u * 9.2 * s, u * 6.4 * s, u * 2 * s, u * s); c.fillStyle = C.w; c.fill(); txt(c, 'PRESENTE', x, y - u * 8.2 * s, u * 1.05 * s, '900', C.bg); c.restore(); }
    }
    c.beginPath(); c.roundRect(x - u * 4.6 * s, y, u * 9.2 * s, u * 2.4 * s, u * 0.4 * s); c.fillStyle = '#2b2824'; c.fill(); c.lineWidth = u * 0.3 * s; c.strokeStyle = 'rgba(242,239,232,0.7)'; c.stroke();
    if (num !== null && !(el.numstop && r * Cn + j + 1 > el.numstop)) { const n = r * Cn + j + 1, k2 = lt - num - (n - 1) * (el.numstep || 0.07); if (k2 >= 0) { const red = n === 24; c.save(); c.shadowColor = red ? GLOW.red : GLOW.white; c.shadowBlur = 18; txt(c, String(n), x, y + u * 1.25 * s, u * 1.9 * s, '900', red ? C.red : C.w); c.restore(); } }
  }
  if (look !== null && el.you && lt >= look) { const k = clamp01((lt - look) / 0.5), x0 = cx(Y[0], Y[1]), y0 = ry(Y[0]) - u * 4, x1 = cx(E[0], E[1]), y1 = ry(E[0]) - u * 4;
    c.save(); c.setLineDash([u, u * 0.8]); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); c.lineWidth = u * 0.5; c.strokeStyle = C.red; c.shadowColor = GLOW.red; c.shadowBlur = 20; c.stroke(); c.restore(); }
}
function registerUI(c, el, L, lt, tt, size) {
  const w = size * 2.1, u = w / 100, h = u * 62, W2 = w / 2, H2 = h / 2, rh = u * 3.6, n = el.n || 24;
  c.save(); c.rotate(el.rot ?? -0.015); c.beginPath(); c.roundRect(-W2, -H2, w, h, u * 0.8); c.fillStyle = el.old ? '#cfc6b2' : '#f2efe8'; c.fill();
  txt(c, el.title || 'REGISTRO DI CLASSE · 3ª B', -W2 + u * 4, -H2 + u * 4.5, u * 2.6, '900', C.bg, 'left', 'middle', 1);
  txt(c, el.sub || 'APPELLO', W2 - u * 4, -H2 + u * 4.5, u * 2.0, '800', '#6b675f', 'right', 'middle', 2);
  const r0 = W_(L, el, 'rows') ?? -99, rd = W_(L, el, 'read'), ex = W_(L, el, 'extra'), ag = W_(L, el, 'ag'), tw = W_(L, el, 'twice');
  const pos = i => { const col = i < 12 ? 0 : 1, row = i % 12; return [-W2 + u * 4 + col * W2, -H2 + u * 10 + row * rh * 1.18]; };
  for (let i = 0; i < Math.min(n, 24); i++) { if (lt < r0 + i * 0.04) continue; const [x, y] = pos(i), last = i === 23;
    c.beginPath(); c.moveTo(x, y + rh * 0.55); c.lineTo(x + W2 - u * 8, y + rh * 0.55); c.lineWidth = u * 0.12; c.strokeStyle = '#a8a397'; c.stroke();
    txt(c, String(i + 1).padStart(2, '0'), x, y, u * 1.8, '800', '#6b675f', 'left', 'middle');
    const len = u * (12 + 14 * hash(i * 3.3 + 1));
    if (last && el.erased) { c.fillStyle = 'rgba(160,154,142,0.55)'; c.fillRect(x + u * 3.5, y - rh * 0.4, u * 30, rh * 0.8); scrib(c, 24, x + u * 4.5, y + u * 0.8, len, u * 1.4, 1, 'rgba(40,38,35,0.45)', u * 0.25); }
    else if (last && ex !== null && lt >= ex) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 20; c.fillStyle = 'rgba(229,50,45,0.2)'; c.fillRect(x - u, y - rh * 0.55, W2 - u * 6, rh * 1.1); c.restore(); scrib(c, 24, x + u * 4.5, y + u * 0.8, len, u * 1.4, 1, C.red, u * 0.3); }
    else scrib(c, i + 1, x + u * 4.5, y + u * 0.8, len, u * 1.4, 1, '#1a1917', u * 0.25);
    if (el.ticks && !last) txt(c, 'P', x + W2 - u * 10, y, u * 1.7, '900', '#1a1917', 'center', 'middle'); }
  if (ag !== null && lt >= ag) { const [x, y] = pos(23); for (let j = 0; j < 4; j++) { const k = lt - ag - j * 0.25; if (k < 0) break; c.save(); c.globalAlpha *= clamp01(k / 0.15); c.fillStyle = C.red; c.fillRect(x + u * (31 + j * 3.4), y - rh * 0.42, u * 3.0, rh * 0.84); txt(c, 'AG', x + u * (32.5 + j * 3.4), y + u * 0.05, u * 1.5, '900', C.w, 'center', 'middle'); c.restore(); } }
  if (tw !== null && lt >= tw) { const k = clamp01((lt - tw) / 0.3); c.save(); c.globalAlpha *= k; for (const i of [8, 23]) { const [x, y] = pos(i); c.save(); c.shadowColor = GLOW.gold; c.shadowBlur = 24; c.lineWidth = u * 0.4; c.strokeStyle = C.gold; c.strokeRect(x - u, y - rh * 0.55, W2 - u * 6, rh * 1.1); c.restore(); scrib(c, 77, x + u * 4.5, y + u * 0.8, u * 20, u * 1.4, 1, '#b5821c', u * 0.32); } c.restore(); }
  if (rd !== null && lt >= rd) { const dur = el.readdur || 3, i = Math.min(23, Math.floor(clamp01((lt - rd) / dur) * 24)), [x, y] = pos(i); c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 16; c.fillStyle = C.red; c.beginPath(); c.moveTo(x - u * 2.6, y - u * 0.9); c.lineTo(x - u * 1.2, y); c.lineTo(x - u * 2.6, y + u * 0.9); c.closePath(); c.fill(); c.restore(); }
  if (el.close !== undefined) { const k = clamp01((lt - W_(L, el, 'close')) / 0.4); if (k > 0) { c.fillStyle = '#3a2f24'; c.fillRect(W2 - w * k, -H2, w * k, h); c.lineWidth = u * 0.4; c.strokeStyle = C.w; c.strokeRect(W2 - w * k, -H2, w * k, h);
    if (k > 0.7) { c.globalAlpha *= (k - 0.7) / 0.3; c.fillStyle = '#e6e1d6'; c.fillRect(-u * 22, -u * 9, u * 44, u * 18); txt(c, 'REGISTRO DI CLASSE', 0, -u * 3, u * 3.4, '900', C.bg, 'center', 'middle', 2); txt(c, '3ª B', 0, u * 4, u * 4, '900', '#9a2a22', 'center', 'middle'); } } }
  c.restore();
}
function boardUI(c, el, L, lt, tt, size) {
  const w = size * 2.5, u = w / 100, h = u * 44, W2 = w / 2, H2 = h / 2;
  c.fillStyle = '#18241d'; c.fillRect(-W2, -H2, w, h); c.lineWidth = u * 1.2; c.strokeStyle = '#8a6f4e'; c.strokeRect(-W2, -H2, w, h);
  c.fillStyle = '#8a6f4e'; c.fillRect(-W2, H2, w, u * 1.6); c.fillStyle = '#e6e1d6'; c.fillRect(-W2 + u * 10, H2 - u * 0.6, u * 4, u * 0.9);
  for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(-W2 + u * 6, -H2 + u * (10 + j * 6)); c.lineTo(-W2 + u * (40 - j * 7), -H2 + u * (10 + j * 6)); c.lineWidth = u * 0.5; c.strokeStyle = 'rgba(242,239,232,0.22)'; c.stroke(); }
  txt(c, el.date || 'LUNEDÌ 2 NOVEMBRE', W2 - u * 6, -H2 + u * 7, u * 3.4, '700', 'rgba(242,239,232,0.85)', 'right', 'middle', 1);
  const w0 = W_(L, el, 'write'); if (w0 !== null && lt >= w0) { const red = el.red && lt >= (W_(L, el, 'red') ?? 0);
    c.save(); if (red) { c.shadowColor = GLOW.red; c.shadowBlur = 24; } scrib(c, 6, W2 - u * 36, -H2 + u * 18, u * 30, u * 5, (lt - w0) / (el.wdur || 1.6), red ? C.red : 'rgba(242,239,232,0.9)', u * 0.6); c.restore(); }
  if (el.label) { txt(c, el.label, W2 - u * 21, -H2 + u * 25, u * 2.2, '800', 'rgba(242,239,232,0.6)', 'center', 'middle', 2); }
}
function notebookUI(c, el, L, lt, tt, size) {
  const w = size * 1.8, u = w / 100, h = u * 62, W2 = w / 2, H2 = h / 2;
  c.save(); c.rotate(el.rot ?? 0.02); c.beginPath(); c.roundRect(-W2, -H2, w, h, u); c.fillStyle = '#f2efe8'; c.fill();
  for (let j = 0; j < 12; j++) { c.beginPath(); c.moveTo(-W2, -H2 + u * (8 + j * 4.6)); c.lineTo(W2, -H2 + u * (8 + j * 4.6)); c.lineWidth = u * 0.15; c.strokeStyle = 'rgba(80,140,200,0.5)'; c.stroke(); }
  c.beginPath(); c.moveTo(-W2 + u * 12, -H2); c.lineTo(-W2 + u * 12, H2); c.lineWidth = u * 0.25; c.strokeStyle = 'rgba(229,50,45,0.7)'; c.stroke();
  for (let j = 0; j < 3; j++) scrib(c, 40 + j, -W2 + u * 15, -H2 + u * (16.6 + j * 4.6), u * (50 - j * 9), u * 2, 1, 'rgba(30,30,40,0.55)', u * 0.25);
  const w0 = W_(L, el, 'write'); if (w0 !== null && lt >= w0) { const red = el.red && lt >= (W_(L, el, 'red') ?? 0);
    c.save(); if (red) { c.shadowColor = GLOW.red; c.shadowBlur = 20; } scrib(c, 6, -W2 + u * 15, -H2 + u * 35, u * 52, u * 7, (lt - w0) / (el.wdur || 1.6), red ? C.red : '#1d2a6b', u * 0.7); c.restore(); }
  if (el.pen) { const k = w0 === null ? 0 : clamp01((lt - w0) / (el.wdur || 1.6)); const px = -W2 + u * 15 + u * 52 * k, py = -H2 + u * 33 + Math.sin(tt * 18) * u * (k < 1 ? 1.2 : 0);
    c.save(); c.translate(px, py); c.rotate(0.6); c.fillStyle = '#d9d5cc'; c.fillRect(-u * 1, -u * 22, u * 2, u * 20); c.fillStyle = '#1d2a6b'; c.beginPath(); c.moveTo(-u, -u * 2); c.lineTo(u, -u * 2); c.lineTo(0, 0); c.closePath(); c.fill(); c.restore(); }
  c.restore();
}
function corridorUI(c, el, L, lt, tt, size) {
  const w = size * 2.8, u = w / 100, vy = -u * 10, H = u * 30;
  c.lineWidth = u * 0.3; c.strokeStyle = 'rgba(242,239,232,0.4)';
  for (const [x, y] of [[-u * 50, H], [u * 50, H], [-u * 50, -u * 32], [u * 50, -u * 32]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x * 0.08, vy + (y - vy) * 0.08); c.stroke(); }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const d = 1 / (1 + k * 0.9), d2 = 1 / (1 + (k + 0.35) * 0.9), x1 = s * u * 50 * d, x2 = s * u * 50 * d2;
    c.beginPath(); c.moveTo(x1, vy + (u * 14 - vy) * d); c.lineTo(x1, vy + (-u * 18 - vy) * d); c.lineTo(x2, vy + (-u * 18 - vy) * d2); c.lineTo(x2, vy + (u * 14 - vy) * d2); c.fillStyle = '#121214'; c.fill(); c.stroke(); }
  const cnt = W_(L, el, 'count'), last = W_(L, el, 'last'), stop = el.stop || 24, n = 24, step = el.step || 0.1;
  for (let i = n - 1; i >= 0; i--) { const d = 1 / (1 + i * 0.085), x = -u * 22 * d + (i % 2 ? 1 : -1) * u * 1.6 * d, y = vy + (H - vy) * d, bob = Math.sin(tt * 3 + i) * u * 0.25 * d;
    const red = i === 23 && last !== null && lt >= last; c.save(); if (red) { c.shadowColor = GLOW.red; c.shadowBlur = 30; }
    pupil(c, x, y + bob, d * 2.2, u, red ? C.red : i % 3 === 1 ? '#d9d5cc' : C.w, false, 0); c.restore();
    const show = (cnt !== null && i < stop && lt >= cnt + i * step) || (i === 23 && last !== null && lt >= last);
    if (show) { const k = backOut((lt - (i === 23 && last !== null && i >= stop ? last : cnt + i * step)) / 0.25); c.save(); c.translate(x + u * 5.5 * d, y - u * 9 * d); c.scale(k, k); txt(c, String(i + 1), 0, 0, u * 3.6 * d + u * 0.8, '900', i === 23 ? C.red : C.gold); c.restore(); } }
  if (el.bidello) { const bx = u * 34, by = u * 18; pupil(c, bx, by, 2.0, u, '#8d8981', false, 0);
    c.save(); c.translate(bx + u * 9, by - u * 8); c.rotate(-0.08); c.fillStyle = '#6b5233'; c.fillRect(-u * 5, -u * 6.5, u * 10, u * 13); c.fillStyle = '#f2efe8'; c.fillRect(-u * 4.2, -u * 5.2, u * 8.4, u * 11);
    txt(c, el.bidello, 0, u * 0.6, u * 5, '900', C.bg); c.restore(); }
}
function backpackUI(c, el, L, lt, tt, size) {
  const s = size * 1.1, lab = W_(L, el, 'label'), gold = W_(L, el, 'gold') ;
  const g = gold !== null && lt >= gold; bagShape(c, 0, 0, s, g ? C.gold : '#7f93a8', g ? GLOW.gold : null);
  c.save(); const sw = Math.sin(tt * 1.4) * 0.06; c.translate(s * 0.2, -s * 0.36); c.rotate(0.25 + sw);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, s * 0.14); c.lineWidth = s * 0.01; c.strokeStyle = '#d9d5cc'; c.stroke();
  const zk = lab !== null && lt >= lab ? easeOut((lt - lab) / 0.5) : 0; c.translate(0, s * 0.14); c.scale(1 + zk * 0.6, 1 + zk * 0.6);
  c.beginPath(); c.roundRect(-s * 0.13, 0, s * 0.26, s * 0.15, s * 0.02); c.fillStyle = '#e6e1d6'; c.fill();
  scrib(c, 24, -s * 0.1, s * 0.1, s * 0.2, s * 0.035, 1, 'rgba(40,38,35,0.28)', s * 0.006); c.restore();
}
// ---------- Short 004: the ring ----------
function tablephoneUI(c, el, L, lt, tt, size) {          // a phone lying on a table, seen from above at an angle
  const u = size / 28, W_ = (k) => W_el(L, el, k), on = W_('on'), ring = W_('ring'), dark = el.dark;
  const lit = on === null ? !!el.lit : lt >= on, rk = ring !== null && lt >= ring;
  // table top
  c.beginPath(); c.moveTo(-u * 40, -u * 30); c.lineTo(u * 40, -u * 30); c.lineTo(u * 60, u * 27); c.lineTo(-u * 60, u * 27); c.closePath();
  c.fillStyle = dark ? '#0c0b0a' : '#2a2119'; c.fill(); c.lineWidth = u * 0.5; c.strokeStyle = dark ? 'rgba(242,239,232,0.12)' : 'rgba(242,239,232,0.45)'; c.stroke();
  const bz = rk ? Math.sin(tt * 95) * u * 0.9 * (Math.sin(tt * 7) > -0.1 ? 1 : 0) : 0;
  c.save(); c.translate(bz, 0); c.transform(1, 0, -0.12, 0.8, 0, 0); c.rotate(el.rot ?? -0.06);
  if (lit) { const g = c.createRadialGradient(0, 0, u * 4, 0, 0, u * 60); g.addColorStop(0, 'rgba(160,215,255,0.32)'); g.addColorStop(1, 'rgba(160,215,255,0)'); c.fillStyle = g; c.fillRect(-u * 70, -u * 80, u * 140, u * 160); }
  c.beginPath(); c.roundRect(-u * 17, -u * 34, u * 34, u * 68, u * 5); c.fillStyle = '#1a1a1d'; c.fill(); c.lineWidth = u * 1.0; c.strokeStyle = '#d9d5cc'; c.stroke();
  c.beginPath(); c.roundRect(-u * 15, -u * 31.5, u * 30, u * 63, u * 3.5); c.fillStyle = lit ? '#0e1b26' : '#050506'; c.fill();
  c.restore();
  if (rk && el.waves !== false) for (let k = 0; k < 3; k++) { const a = (tt * 1.6 + k / 3) % 1; c.save(); c.globalAlpha *= (1 - a) * 0.8; c.beginPath(); c.ellipse(bz, 0, u * (26 + a * 22), u * (26 + a * 22) * 0.8, 0, 0, 7); c.lineWidth = u * 0.8; c.strokeStyle = el.red ? C.red : '#a0d7ff'; c.stroke(); c.restore(); }
  if (lit) {            // the screen text, upright so it reads
    c.save(); c.translate(bz, 0); c.shadowColor = GLOW.white; c.shadowBlur = 18;
    if (el.q) { const qk = el.qat === undefined ? 1 : clamp01((lt - at(L, el.qat)) / 0.25); c.globalAlpha *= qk; c.shadowColor = GLOW.red; wrap(c, el.q.toUpperCase(), 0, -u * 2, u * 27, u * 5.6, '900', C.red, u * 6.6); }
    else { txt(c, el.top || 'CHIAMATA IN ARRIVO', 0, -u * 13, u * 2.4, '700', el.top ? C.red : '#9fb6c8', 'center', 'middle', 2);
      txt(c, el.name || 'Numero sconosciuto', 0, -u * 4, u * 3.7, '900', C.w, 'center', 'middle'); txt(c, el.num || '+39 0•• ••• ••••', 0, u * 3, u * 3.2, '700', '#cfcac0', 'center', 'middle', 1); }
    if (el.badge) { c.shadowColor = GLOW.red; c.shadowBlur = 24; c.beginPath(); c.arc(u * 15, -u * 22, u * 6, 0, 7); c.fillStyle = C.red; c.fill(); c.shadowBlur = 0; txt(c, el.badge, u * 15, -u * 21.6, u * 7, '900', C.w); }
    c.restore(); }
}
function W_el(L, el, k) { const v = el[k]; if (v === undefined) return null; if (v === true) return -99; return at(L, v) + (el._dt || 0); }
function calllogUI(c, el, L, lt, tt, size) {
  const h = size * 1.12, S = frame(c, h), u = S.w / 86, hot = W_el(L, el, 'hot');
  txt(c, 'RECENTI', S.x + u * 7, S.y + S.h * 0.1, u * 6, '900', C.w, 'left', 'middle');
  const rows = [['Numero sconosciuto', '23:41', '0:00', true], ['Mamma', '20:12', '4:37'], ['Ufficio', '17:55', '1:02'], ['Numero sconosciuto', '23:40', '0:00', true], ['Giulia', '13:08', '0:48'], ['Farmacia', '10:21', '0:31']];
  rows.forEach(([n, t, d, unk], k) => { const y = S.y + S.h * 0.2 + k * S.h * 0.11; if (lt < k * 0.08) return;
    const h1 = k === 0 && hot !== null && lt >= hot;
    if (h1) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 22; c.beginPath(); c.roundRect(S.x + u * 3, y - S.h * 0.045, S.w - u * 6, S.h * 0.09, u * 2); c.lineWidth = u * 0.9; c.strokeStyle = C.red; c.stroke(); c.restore(); }
    txt(c, n, S.x + u * 7, y - S.h * 0.012, u * 4.6, '800', unk ? C.red : C.w, 'left', 'middle'); txt(c, t, S.x + u * 7, y + S.h * 0.025, u * 3.4, '600', '#8d8981', 'left', 'middle');
    c.save(); if (h1) { c.shadowColor = GLOW.red; c.shadowBlur = 20; } txt(c, d, S.x + S.w - u * 7, y, h1 ? u * 8 : u * 4.4, '900', d === '0:00' ? C.red : '#cfcac0', 'right', 'middle'); c.restore(); });
}
function lampUI(c, el, L, lt, tt, size) {                // a table lamp and a hand on its switch
  const u = size / 50, off = W_el(L, el, 'off'), k = off === null ? 0 : clamp01((lt - off) / 0.12), on = 1 - k;
  if (on > 0) { c.save(); c.globalAlpha *= on; const g = c.createRadialGradient(0, -u * 18, u * 4, 0, u * 10, u * 70); g.addColorStop(0, 'rgba(245,196,81,0.45)'); g.addColorStop(1, 'rgba(245,196,81,0)'); c.fillStyle = g; c.fillRect(-u * 80, -u * 60, u * 160, u * 130); c.restore(); }
  c.beginPath(); c.moveTo(-u * 12, -u * 30); c.lineTo(u * 12, -u * 30); c.lineTo(u * 20, -u * 12); c.lineTo(-u * 20, -u * 12); c.closePath(); c.fillStyle = on > 0.5 ? '#f5c451' : '#2a2a2e'; c.fill(); c.lineWidth = u * 0.6; c.strokeStyle = C.w; c.stroke();
  c.fillStyle = '#d9d5cc'; c.fillRect(-u * 1, -u * 12, u * 2, u * 30); c.beginPath(); c.ellipse(0, u * 19, u * 11, u * 3, 0, 0, 7); c.fill();
  c.beginPath(); c.moveTo(u * 6, u * 6); c.quadraticCurveTo(u * 18, u * 14, u * 22, u * 22); c.lineWidth = u * 0.5; c.strokeStyle = '#8d8981'; c.stroke();     // cord
  c.beginPath(); c.roundRect(u * 19, u * 20, u * 7, u * 4, u * 1); c.fillStyle = '#e6e1d6'; c.fill();                                                  // switch
  const hk = off === null ? 0 : easeOut(clamp01((lt - off + 0.35) / 0.35)); c.save(); c.translate(u * (40 - 16 * hk), u * (30 - 6 * hk)); c.rotate(-0.9); c.scale(u * 22, u * 22); ICONS.hand(c, {}); c.restore();
}
function stairwellUI(c, el, L, lt, tt, size) {           // a dark stairwell from the bottom floor; a phone light climbing
  const u = size / 50, F = 5, fh = u * 26, x0 = -u * 22, x1 = u * 22, top = -fh * F / 2;
  c.lineWidth = u * 0.5; c.strokeStyle = 'rgba(242,239,232,0.28)'; c.strokeRect(x0 - u * 6, top - u * 4, x1 - x0 + u * 12, fh * F + u * 8);
  for (let f = 0; f < F; f++) { const yb = top + fh * (F - f), ym = yb - fh / 2;
    c.beginPath(); c.moveTo(x0, yb); c.lineTo(x1, ym); c.moveTo(x1, ym); c.lineTo(x0, yb - fh); c.lineWidth = u * 0.9; c.strokeStyle = 'rgba(242,239,232,0.35)'; c.stroke();
    c.beginPath(); c.moveTo(x0 - u * 6, yb); c.lineTo(x0 + u * 4, yb); c.moveTo(x1 - u * 4, ym); c.lineTo(x1 + u * 6, ym); c.lineWidth = u * 1.4; c.stroke();
    txt(c, String(f === 0 ? 'T' : f), x0 - u * 11, yb - u * 3, u * 3.4, '800', 'rgba(242,239,232,0.35)', 'center', 'middle');
    if (f === (el.yours ?? 4)) { c.save(); c.shadowColor = GLOW.gold; c.shadowBlur = 20; c.fillStyle = C.gold; c.fillRect(x0 - u * 5, yb - u * 14, u * 4, u * 11); c.restore(); } }
  const c0 = W_el(L, el, 'climb'), p = c0 === null ? 0 : Math.max(0, lt - c0) * (el.speed || 1.1);        // half-floors climbed
  const seg = Math.floor(p), fr = p - seg, f = Math.floor(seg / 2), up = seg % 2 === 0;
  const yb = top + fh * (F - f), ya = up ? yb : yb - fh / 2, yz = up ? yb - fh / 2 : yb - fh, xa = up ? x0 : x1, xz = up ? x1 : x0;
  const px = xa + (xz - xa) * fr, py = ya + (yz - ya) * fr - u * 3;
  const g = c.createRadialGradient(px, py, 1, px, py, u * 18); g.addColorStop(0, 'rgba(170,220,255,0.75)'); g.addColorStop(1, 'rgba(170,220,255,0)'); c.fillStyle = g; c.fillRect(px - u * 20, py - u * 20, u * 40, u * 40);
  c.beginPath(); c.arc(px, py, u * 1.3, 0, 7); c.fillStyle = '#e8f5ff'; c.fill();
}
// ---------- Short 005: the deleted message ----------
function delBubble(c, x, y, bw, bh, u, big) {           // WhatsApp-style "this message was deleted"
  c.beginPath(); c.roundRect(x, y, bw, bh, u * 5); c.fillStyle = '#1d1d21'; c.fill(); c.lineWidth = u * 0.6; c.strokeStyle = '#8d8981'; c.stroke();
  const cy = y + bh / 2, r = u * (big ? 3.4 : 2.4), ix = x + u * 4 + r; c.beginPath(); c.arc(ix, cy, r, 0, 7); c.moveTo(ix - r * 0.7, cy + r * 0.7); c.lineTo(ix + r * 0.7, cy - r * 0.7); c.lineWidth = u * 0.6; c.strokeStyle = '#9a958c'; c.stroke();
  txt(c, 'Questo messaggio è stato eliminato', ix + r + u * 2.5, cy + u * 0.3, u * (big ? 6.2 : 4.2), 'italic 600', '#b5b0a6', 'left', 'middle');
}
function delchatUI(c, el, L, lt, tt, size) {             // a chat with "Mamma": bubbles that turn into "deleted"
  const W = size * 1.6, u = W / 100, W2 = W / 2; let y = 0;
  c.beginPath(); c.roundRect(-W2 - u * 5, -u * 12, W + u * 10, u * (el.phoneh || 150), u * 9); c.lineWidth = u * 1.2; c.strokeStyle = '#8d8981'; c.stroke();
  c.beginPath(); c.arc(-W2 + u * 5, y, u * 4.2, 0, 7); c.fillStyle = '#26241f'; c.fill(); c.lineWidth = u * 0.5; c.strokeStyle = '#8d8981'; c.stroke();
  c.beginPath(); c.arc(-W2 + u * 5, y - u * 1, u * 1.6, 0, 7); c.fillStyle = '#8d8981'; c.fill(); c.beginPath(); c.arc(-W2 + u * 5, y + u * 3.6, u * 2.8, Math.PI * 1.15, Math.PI * 1.85); c.fill();
  txt(c, 'Mamma', -W2 + u * 12, y - u * 2.6, u * 6.4, '900', C.w, 'left', 'middle', 2);
  const tw = el.typingat !== undefined && lt >= W_el(L, el, 'typingat') && !(el.typingoff !== undefined && lt >= W_el(L, el, 'typingoff'));
  txt(c, tw ? 'sta scrivendo…' : (el.sub || 'online'), -W2 + u * 12, y + u * 3.8, u * 3.8, '800', tw || !el.sub ? '#7fd9a0' : '#8d8981', 'left', 'middle', 1);
  txt(c, el.clock || '03:12', W2, y, u * 5.2, '800', '#8d8981', 'right', 'middle', 2);
  c.fillStyle = '#26241f'; c.fillRect(-W2, y + u * 8, W, u * 0.4); y += u * 18;
  for (const m of el.msgs || []) {
    if (m.at !== undefined && lt < W_el(L, m, 'at')) continue;
    const k = m.at !== undefined ? easeOut((lt - W_el(L, m, 'at')) / 0.25) : 1, big = !!m.big, bh = u * (big ? 21 : 15);
    const dl = m.del === true || (m.del !== undefined && lt >= W_el(L, m, 'del'));
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * u * 5);
    if (dl) { const dk = m.del === true ? 1 : clamp01((lt - W_el(L, m, 'del')) / 0.18); c.font = `italic 600 ${u * (big ? 6.2 : 4.2)}px Montserrat`;
      const bw = c.measureText('Questo messaggio è stato eliminato').width + u * (big ? 18 : 14); c.save(); c.globalAlpha *= dk; delBubble(c, -W2, y, Math.min(bw, W + u * 4), bh, u, big); c.restore();
      if (dk < 1) { c.save(); c.globalAlpha *= 1 - dk; c.shadowColor = GLOW.red; c.shadowBlur = 40; c.beginPath(); c.roundRect(-W2, y, bw, bh, u * 5); c.fillStyle = C.red; c.fill(); c.restore(); } }
    else { c.font = `800 ${u * (big ? 10 : 8)}px Montserrat`; const bw = c.measureText(m.text).width + u * 10; c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 24; c.beginPath(); c.roundRect(-W2, y, bw, bh, u * 5); c.fillStyle = C.w; c.fill(); c.restore();
      txt(c, m.text, -W2 + u * 5, y + bh / 2 + u * 0.3, u * (big ? 10 : 8), '800', C.bg, 'left', 'middle'); }
    txt(c, m.time || '03:12', -W2, y + bh + u * 4, u * 3.8, '800', '#8d8981', 'left', 'middle', 2);
    c.restore(); y += bh + u * 11;
  }
}
function lockUI(c, el, L, lt, tt, size) {                // phone lock screen: off / on, the time big, one notification
  const h = size * 2.2, w = h * 0.49, u = w / 50, off = W_el(L, el, 'off'), on = W_el(L, el, 'on');
  const lit = !(off !== null && lt >= off && !(on !== null && lt >= on));
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, u * 7); c.fillStyle = '#111114'; c.fill(); c.lineWidth = u * 1.1; c.strokeStyle = '#d9d5cc'; c.stroke();
  if (!lit) return;
  const fk = on !== null && lt >= on ? easeOut((lt - on) / 0.25) : 1; c.save(); c.globalAlpha *= fk;
  const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#152434'); g.addColorStop(1, '#07090d'); c.beginPath(); c.roundRect(-w / 2 + u * 2, -h / 2 + u * 2, w - u * 4, h - u * 4, u * 5.5); c.fillStyle = g; c.fill();
  c.shadowColor = GLOW.white; c.shadowBlur = 30; txt(c, el.time || '03:12', 0, -h * 0.26, u * 15, '800', C.w, 'center', 'middle'); c.shadowBlur = 0;
  txt(c, el.date || 'notte', 0, -h * 0.36, u * 3.6, '700', '#9fb6c8', 'center', 'middle', 2);
  if (el.notif) { const y0 = -h * 0.08; c.beginPath(); c.roundRect(-w / 2 + u * 5, y0, w - u * 10, u * 16, u * 3); c.fillStyle = 'rgba(242,239,232,0.14)'; c.fill();
    txt(c, el.app || 'WHATSAPP · MAMMA', -w / 2 + u * 9, y0 + u * 5, u * 2.8, '800', '#cfcac0', 'left', 'middle', 1);
    const hl = el.hl === undefined ? null : W_el(L, el, 'hl'), on2 = hl !== null && lt >= hl; c.save(); if (on2) { c.shadowColor = GLOW.red; c.shadowBlur = 24; }
    txt(c, el.notif, -w / 2 + u * 9, y0 + u * 11, u * (el.nsz || 3.4), el.app ? '800' : 'italic 600', on2 ? C.red : C.w, 'left', 'middle'); c.restore();
    if (on2) { c.beginPath(); c.roundRect(-w / 2 + u * 5, y0, w - u * 10, u * 16, u * 3); c.lineWidth = u * 0.7; c.strokeStyle = C.red; c.stroke(); } }
  c.restore();
}
function houseUI(c, el, L, lt, tt, size) {               // the flat from above: mum's room, kitchen, your room
  const u = size / 40, hot = el.hot, hk = el.hotat === undefined ? 1 : clamp01((lt - W_el(L, el, 'hotat')) / 0.25);
  const R = { mom: [-36, -46, 34, 40, 'MAMMA'], kit: [2, -46, 34, 40, 'CUCINA'], me: [-36, -2, 72, 40, 'TU'] };
  for (const [key, [x, y, w, h, lab]] of Object.entries(R)) { c.save(); if (hot === key) { c.globalAlpha *= 1; c.shadowColor = key === 'me' ? GLOW.gold : GLOW.red; c.shadowBlur = 36 * hk; }
    c.lineWidth = u * 0.9; c.strokeStyle = hot === key ? (key === 'me' ? C.gold : C.red) : 'rgba(242,239,232,0.7)'; c.strokeRect(x * u, y * u, w * u, h * u); c.restore();
    txt(c, lab, (x + 2) * u, (y + 4) * u, u * 3.2, '900', hot === key ? (key === 'me' ? C.gold : C.red) : '#8d8981', 'left', 'middle', 3); }
  // doors: mum's closed (a solid bar), the kitchen open (an arc)
  c.fillStyle = C.w; c.fillRect(-26 * u, -7 * u, 12 * u, 1.6 * u); c.beginPath(); c.arc(8 * u, -6 * u, 10 * u, Math.PI, Math.PI * 1.5); c.lineWidth = u * 0.4; c.strokeStyle = 'rgba(242,239,232,0.5)'; c.stroke();
  // mum asleep: bed + head
  c.save(); c.translate(-20 * u, -26 * u); c.beginPath(); c.roundRect(-9 * u, -12 * u, 18 * u, 26 * u, u * 2); c.fillStyle = '#2a2a2e'; c.fill(); c.strokeStyle = 'rgba(242,239,232,0.5)'; c.lineWidth = u * 0.4; c.stroke();
  c.beginPath(); c.arc(0, -7 * u, 3 * u, 0, 7); c.fillStyle = '#cfcac0'; c.fill(); c.fillStyle = '#3a3a40'; c.fillRect(-8 * u, -2 * u, 16 * u, 14 * u); c.restore();
  if (lt % 2.4 < 1.2) txt(c, 'z', -11 * u, -38 * u, u * 3.4, '800', '#8d8981');
  // kitchen counter + phone charging
  c.fillStyle = '#3a2f24'; c.fillRect(20 * u, -46 * u, 16 * u, 40 * u); c.save(); c.translate(28 * u, -26 * u); const pg = 0.5 + 0.5 * Math.sin(tt * 2.2);
  c.shadowColor = 'rgba(127,217,160,0.9)'; c.shadowBlur = 20 + 14 * pg; c.beginPath(); c.roundRect(-3 * u, -6 * u, 6 * u, 12 * u, u * 1.2); c.fillStyle = '#0e1b26'; c.fill(); c.lineWidth = u * 0.5; c.strokeStyle = '#d9d5cc'; c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#7fd9a0'; c.fillRect(-1.2 * u, -2 * u, 2.4 * u, 4 * u * (0.4 + 0.6 * pg)); c.beginPath(); c.moveTo(0, 6 * u); c.quadraticCurveTo(4 * u, 12 * u, 8 * u, 14 * u); c.lineWidth = u * 0.5; c.strokeStyle = '#8d8981'; c.stroke(); c.restore();
  // you in bed with your phone lit
  c.save(); c.translate(14 * u, 20 * u); c.rotate(Math.PI / 2); c.beginPath(); c.roundRect(-9 * u, -14 * u, 18 * u, 28 * u, u * 2); c.fillStyle = '#2a2a2e'; c.fill(); c.strokeStyle = 'rgba(242,239,232,0.5)'; c.lineWidth = u * 0.4; c.stroke();
  c.beginPath(); c.arc(0, -9 * u, 3 * u, 0, 7); c.fillStyle = C.gold; c.fill(); c.restore();
  const gg = c.createRadialGradient(4 * u, 22 * u, 1, 4 * u, 22 * u, 10 * u); gg.addColorStop(0, 'rgba(160,215,255,0.7)'); gg.addColorStop(1, 'rgba(160,215,255,0)'); c.fillStyle = gg; c.fillRect(-6 * u, 12 * u, 20 * u, 20 * u);
  c.fillStyle = '#a0d7ff'; c.fillRect(2.5 * u, 20 * u, 3 * u, 5 * u);
}
function doorlightUI(c, el, L, lt, tt, size) {           // a closed door, a line of light under it
  const u = size / 40, off = W_el(L, el, 'off'), lk = off === null ? 1 : lt < off ? 1 : 0, fl = el.flicker ? (Math.sin(tt * 23) > 0.85 ? 0.6 : 1) : 1;
  c.fillStyle = '#121214'; c.fillRect(-60 * u, -60 * u, 120 * u, 120 * u);
  c.fillStyle = '#1b1b1f'; c.fillRect(-17 * u, -44 * u, 34 * u, 74 * u); c.lineWidth = u * 0.8; c.strokeStyle = 'rgba(242,239,232,0.75)'; c.strokeRect(-19 * u, -46 * u, 38 * u, 76 * u);
  for (const [y, h] of [[-38, 30], [-2, 26]]) { c.lineWidth = u * 0.35; c.strokeStyle = 'rgba(242,239,232,0.3)'; c.strokeRect(-12 * u, y * u, 24 * u, h * u); }
  c.beginPath(); c.arc(12 * u, -6 * u, 1.4 * u, 0, 7); c.fillStyle = '#cfcac0'; c.fill();
  c.fillStyle = 'rgba(242,239,232,0.25)'; c.fillRect(-60 * u, 30 * u, 120 * u, 0.4 * u);
  if (lk > 0) { c.save(); c.globalAlpha *= lk * fl; const g = c.createLinearGradient(0, 30 * u, 0, 44 * u); g.addColorStop(0, 'rgba(245,196,81,0.55)'); g.addColorStop(1, 'rgba(245,196,81,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-17 * u, 30 * u); c.lineTo(17 * u, 30 * u); c.lineTo(30 * u, 44 * u); c.lineTo(-30 * u, 44 * u); c.closePath(); c.fill();
    c.shadowColor = GLOW.gold; c.shadowBlur = 30; c.fillStyle = '#f5c451'; c.fillRect(-17 * u, 29 * u, 34 * u, 1.2 * u); c.restore(); }
}
function youfaceUI(c, el, L, lt, tt, size) {             // you, still, the phone lighting your face from below
  const u = size / 40;
  c.save(); c.scale(u * 70, u * 70); c.translate(0, -0.05); ICONS.you(c, {}); c.restore();
  c.save(); c.globalCompositeOperation = 'lighter'; const fl = 0.85 + 0.15 * Math.sin(tt * 9) * Math.sin(tt * 3.1);
  const g = c.createRadialGradient(0, 30 * u, 2 * u, 0, 0, 46 * u); g.addColorStop(0, `rgba(120,190,255,${0.55 * fl})`); g.addColorStop(1, 'rgba(120,190,255,0)'); c.fillStyle = g; c.fillRect(-50 * u, -50 * u, 100 * u, 100 * u); c.restore();
  c.save(); c.translate(0, 34 * u); c.rotate(-0.1); c.shadowColor = 'rgba(160,215,255,0.9)'; c.shadowBlur = 40; c.beginPath(); c.roundRect(-7 * u, -11 * u, 14 * u, 22 * u, u * 2); c.fillStyle = '#cfe8ff'; c.fill(); c.restore();
}
// ---------- Short 006: the parcel ----------
function parcelShape(c, w, h, u, col) {                  // a cardboard box, front view, label and tape
  c.beginPath(); c.roundRect(-w / 2, -h, w, h, u * 0.8); c.fillStyle = col || '#9a7448'; c.fill(); c.lineWidth = u * 0.6; c.strokeStyle = '#e6d2b0'; c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-w / 2, -h, w, h * 0.12); c.fillStyle = '#c9b48a'; c.fillRect(-w * 0.07, -h, w * 0.14, h);
  c.fillStyle = '#f2efe8'; c.fillRect(w * 0.12, -h * 0.62, w * 0.32, h * 0.3); scrib(c, 11, w * 0.15, -h * 0.42, w * 0.24, h * 0.06, 1, '#1a1917', u * 0.3);
}
function landingUI(c, el, L, lt, tt, size) {             // the landing: your door, the parcel in front, you with the keys
  const u = size / 40;
  c.fillStyle = 'rgba(242,239,232,0.25)'; c.fillRect(-60 * u, 30 * u, 120 * u, 0.4 * u);
  const g = c.createRadialGradient(6 * u, -40 * u, 2 * u, 6 * u, -10 * u, 60 * u); g.addColorStop(0, 'rgba(245,196,81,0.18)'); g.addColorStop(1, 'rgba(245,196,81,0)'); c.fillStyle = g; c.fillRect(-60 * u, -60 * u, 120 * u, 90 * u);
  c.fillStyle = '#1b1b1f'; c.fillRect(-6 * u, -44 * u, 30 * u, 74 * u); c.lineWidth = u * 0.8; c.strokeStyle = 'rgba(242,239,232,0.75)'; c.strokeRect(-8 * u, -46 * u, 34 * u, 76 * u);
  c.beginPath(); c.arc(19 * u, -6 * u, 1.3 * u, 0, 7); c.fillStyle = '#cfcac0'; c.fill(); c.fillStyle = '#cfcac0'; c.fillRect(18 * u, -2 * u, 2 * u, 3 * u);
  c.save(); c.translate(9 * u, 30 * u); const hk = el.hot === undefined ? 0 : clamp01((lt - W_el(L, el, 'hot')) / 0.3);
  if (hk) { c.shadowColor = GLOW.red; c.shadowBlur = 40 * hk; } parcelShape(c, 20 * u, 14 * u, u); c.restore();
  c.save(); c.translate(-26 * u, 6 * u); c.scale(u * 40, u * 40); ICONS.you(c, {}); c.restore();
  c.save(); c.translate(-12 * u, 4 * u + Math.sin(tt * 5) * u * 0.6); c.rotate(-0.5 + Math.sin(tt * 3) * 0.08); c.shadowColor = GLOW.gold; c.shadowBlur = 16; c.scale(u * 9, u * 9); ICONS.key(c, { col: C.gold }); c.restore();
}
function sigUI(c, el, L, lt, tt, size) {                  // the signature on the courier's receipt; the smudge on the last letter
  const u = size / 40, ring = W_el(L, el, 'ring'), wr = W_el(L, el, 'write');
  c.save(); c.rotate(-0.03); c.beginPath(); c.roundRect(-34 * u, -22 * u, 68 * u, 44 * u, u * 1.2); c.fillStyle = '#f2efe8'; c.fill();
  txt(c, 'FIRMA DEL DESTINATARIO', -30 * u, -16 * u, 2.6 * u, '900', '#6b675f', 'left', 'middle', 2);
  c.beginPath(); c.moveTo(-30 * u, 10 * u); c.lineTo(30 * u, 10 * u); c.lineWidth = u * 0.25; c.strokeStyle = '#a8a397'; c.stroke();
  const k = wr === null ? 1 : clamp01((lt - wr) / 1.0), n = 6, w = 44 * u, steps = 220, m = Math.floor(steps * k);     // a looping cursive hand
  c.beginPath(); for (let i = 0; i <= m; i++) { const t = i / steps, ph = t * n * Math.PI * 2, g = Math.floor(t * n), a = (2.2 + 2.4 * hash(31 + g * 7)) * u * (g === 0 ? 1.7 : 1);
    const x = -26 * u + t * w + Math.sin(ph) * w / (n * 2.4), y = 6 * u - (1 - Math.cos(ph)) * a * 0.5 - Math.sin(t * 3.1) * u * 1.2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.lineWidth = u * 0.6; c.strokeStyle = '#1d2a6b'; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  if (k >= 1) { c.save(); c.globalAlpha *= 0.55; c.beginPath(); c.ellipse(20.5 * u, 4.5 * u, 3.4 * u, 1.3 * u, -0.35, 0, 7); c.fillStyle = '#1d2a6b'; c.fill();
    c.beginPath(); c.moveTo(19 * u, 5 * u); c.quadraticCurveTo(24 * u, 6.5 * u, 26.5 * u, 4 * u); c.lineWidth = u * 0.5; c.strokeStyle = '#1d2a6b'; c.stroke(); c.restore(); }
  if (ring !== null && lt >= ring) { const rk = clamp01((lt - ring) / 0.35); c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 20; c.beginPath(); c.ellipse(21 * u, 3.5 * u, 8.5 * u, 6 * u, -0.2, -1.2, -1.2 + Math.PI * 2.1 * rk); c.lineWidth = u * 0.9; c.strokeStyle = C.red; c.stroke(); c.restore(); }
  c.restore();
}
function flatUI(c, el, L, lt, tt, size) {                 // the empty flat from above; the door locked, the key in it from outside
  const u = size / 40;
  c.lineWidth = u * 0.9; c.strokeStyle = 'rgba(242,239,232,0.75)'; c.strokeRect(-34 * u, -44 * u, 68 * u, 74 * u);
  c.lineWidth = u * 0.5; c.beginPath(); c.moveTo(-34 * u, -6 * u); c.lineTo(-6 * u, -6 * u); c.moveTo(6 * u, -6 * u); c.lineTo(34 * u, -6 * u); c.moveTo(0, -44 * u); c.lineTo(0, -6 * u); c.stroke();
  for (const [x, y, t] of [[-32, -40, 'CAMERA'], [2, -40, 'CUCINA'], [-32, -2, 'INGRESSO']]) txt(c, t, x * u, y * u, u * 2.8, '900', '#6b675f', 'left', 'middle', 3);
  if (el.empty !== false) txt(c, 'VUOTA', 0, 14 * u, u * 6, '900', 'rgba(242,239,232,0.18)', 'center', 'middle', 8);
  c.fillStyle = '#05050600'; c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 24 * (el.hotdoor ? 1 : 0); c.fillStyle = el.hotdoor ? C.red : C.w; c.fillRect(-7 * u, 29 * u, 14 * u, 2 * u); c.restore();
  c.save(); c.translate(0, 37 * u); c.rotate(Math.PI / 2); c.shadowColor = GLOW.gold; c.shadowBlur = 20; c.scale(u * 9, u * 9); ICONS.key(c, { col: C.gold }); c.restore();
  if (el.you) { c.save(); c.translate(-20 * u, 44 * u); c.scale(u * 14, u * 14); ICONS.you(c, {}); c.restore(); }
}
function tiltUI(c, el, L, lt, tt, size) {                 // hands tilting the parcel; something inside slides
  const u = size / 40, t0 = W_el(L, el, 'tilt'), k = t0 === null ? 0 : Math.max(0, lt - t0), ang = 0.32 * Math.sin(Math.min(k, 2.5) * 1.3) * (el.dir || 1);
  c.save(); c.rotate(ang);
  c.save(); c.translate(0, 14 * u); parcelShape(c, 40 * u, 28 * u, u); c.restore();
  c.save(); c.beginPath(); c.rect(-19 * u, -13 * u, 38 * u, 26 * u); c.clip(); const sx = clamp01(0.5 + ang * 1.6) * 26 * u - 13 * u;
  c.globalAlpha *= 0.62; c.fillStyle = '#120c06'; c.beginPath(); c.ellipse(sx, 4 * u, 8 * u, 4.5 * u, 0, 0, 7); c.fill(); c.beginPath(); c.arc(sx - 6 * u, 1 * u, 3.4 * u, 0, 7); c.fill(); c.restore();
  for (const sd of [-1, 1]) { c.save(); c.translate(sd * 24 * u, 4 * u); c.rotate(sd * Math.PI / 2); c.scale(u * 16, u * 16); ICONS.hand(c, {}); c.restore(); }
  c.restore();
}
function doorgapUI(c, el, L, lt, tt, size) {              // your door, from the landing: it opens a few centimetres by itself, then closes
  const u = size / 40, op = W_el(L, el, 'open'), cl = W_el(L, el, 'close');
  let k = el.ajar || 0; if (op !== null && lt >= op) k = easeOut(clamp01((lt - op) / 0.9)); if (cl !== null && lt >= cl) k = (el.ajar ?? 1) * (1 - clamp01((lt - cl) / (el.cdur || 1.2)));
  const g = c.createRadialGradient(0, -50 * u, 2 * u, 0, -10 * u, 60 * u); g.addColorStop(0, 'rgba(245,196,81,0.16)'); g.addColorStop(1, 'rgba(245,196,81,0)'); c.fillStyle = g; c.fillRect(-60 * u, -60 * u, 120 * u, 100 * u);
  c.fillStyle = 'rgba(242,239,232,0.25)'; c.fillRect(-60 * u, 30 * u, 120 * u, 0.4 * u);
  c.lineWidth = u * 0.9; c.strokeStyle = 'rgba(242,239,232,0.8)'; c.strokeRect(-19 * u, -46 * u, 38 * u, 76 * u);
  const gap = k * 6 * u; c.fillStyle = '#000'; c.fillRect(17 * u - gap, -44 * u, gap + 2 * u * k, 74 * u);
  c.fillStyle = '#1b1b1f'; c.fillRect(-17 * u, -44 * u, 34 * u - gap, 74 * u);
  c.fillStyle = 'rgba(242,239,232,0.5)'; c.fillRect(17 * u - gap - 0.5 * u, -44 * u, 0.5 * u, 74 * u);
  c.beginPath(); c.arc(12 * u - gap, -6 * u, 1.4 * u, 0, 7); c.fillStyle = '#cfcac0'; c.fill();
  if (el.key !== false) { c.save(); c.translate(12 * u - gap, 0); c.shadowColor = GLOW.gold; c.shadowBlur = 14; c.scale(u * 7, u * 7); ICONS.key(c, { col: C.gold }); c.restore(); }
}
// ---------- Short 007: the headphones ----------
function micIcon(c, x, y, s, col, on, tt) {
  c.save(); c.translate(x, y); if (on) { c.shadowColor = GLOW.red; c.shadowBlur = 24; }
  c.beginPath(); c.roundRect(-s * 0.3, -s, s * 0.6, s * 1.1, s * 0.3); c.fillStyle = col; c.fill();
  c.beginPath(); c.arc(0, -s * 0.2, s * 0.5, 0.15, Math.PI - 0.15); c.lineWidth = s * 0.12; c.strokeStyle = col; c.stroke();
  c.fillRect(-s * 0.06, s * 0.3, s * 0.12, s * 0.35); c.fillRect(-s * 0.3, s * 0.62, s * 0.6, s * 0.1); c.restore();
  if (on) for (let k = 0; k < 2; k++) { const a = (tt * 0.9 + k / 2) % 1; c.save(); c.globalAlpha *= (1 - a) * 0.7; c.beginPath(); c.arc(x, y - s * 0.3, s * (0.9 + a * 1.8), 0, 7); c.lineWidth = s * 0.08; c.strokeStyle = C.red; c.stroke(); c.restore(); }
}
function youhpUI(c, el, L, lt, tt, size) {              // you with headphones on; your hand; the headphones coming off
  const K = size * 0.95, hand = W_el(L, el, 'hand'), stop = W_el(L, el, 'stop'), off = W_el(L, el, 'off'), glow = W_el(L, el, 'glow');
  const ok = off !== null && lt >= off ? easeOut(clamp01((lt - off) / 0.35)) : 0;
  if (off !== null && lt >= off) for (let k = 0; k < 4; k++) { const a = ((lt - off) * 0.9 + k / 4) % 1; c.save(); c.globalAlpha *= (1 - a) * 0.85; c.shadowColor = GLOW.red; c.shadowBlur = 20;
    c.beginPath(); c.arc(0, -0.2 * K, K * (0.3 + a * 0.75), Math.PI * 0.95, Math.PI * 2.05); c.lineWidth = K * 0.025; c.strokeStyle = C.red; c.stroke(); c.restore(); }
  if (el.bed) { c.fillStyle = '#2a2a2e'; c.beginPath(); c.roundRect(-0.7 * K, 0.3 * K, 1.4 * K, 0.4 * K, 0.05 * K); c.fill(); c.fillStyle = '#d9d5cc'; c.beginPath(); c.roundRect(-0.45 * K, -0.05 * K, 0.9 * K, 0.22 * K, 0.08 * K); c.fill(); }
  c.save(); c.scale(K, K); ICONS.you(c, {}); c.restore();
  // headphones
  c.save(); c.translate(ok * 0.55 * K, -ok * 0.35 * K); c.rotate(ok * 0.5); const g = glow !== null && lt >= glow;
  if (g) { c.shadowColor = 'rgba(160,215,255,0.95)'; c.shadowBlur = 30 + 12 * Math.sin(tt * 6); }
  c.beginPath(); c.arc(0, -0.2 * K, 0.215 * K, Math.PI + 0.35, -0.35); c.lineWidth = 0.045 * K; c.strokeStyle = g ? '#cfe8ff' : '#3a3a40'; c.stroke();
  c.lineWidth = 0.012 * K; c.strokeStyle = C.w; c.stroke();
  for (const sd of [-1, 1]) { c.beginPath(); c.roundRect(sd * 0.2 * K - 0.045 * K, -0.27 * K, 0.09 * K, 0.15 * K, 0.035 * K); c.fillStyle = g ? '#a0d7ff' : '#26262b'; c.fill(); c.lineWidth = 0.012 * K; c.strokeStyle = C.w; c.stroke(); }
  c.restore();
  // the hand going up to the headphones
  if (hand !== null) { let hk = easeOut(clamp01((lt - hand) / 0.9)); if (stop !== null && lt >= stop) hk = Math.min(hk, hand === -99 ? 1 : easeOut(clamp01((stop - hand) / 0.9))) - 0.06 * Math.min(1, Math.max(0, lt - stop) / 0.3);
    if (ok) hk = 1; const tr = stop !== null && lt >= stop && !ok ? Math.sin(tt * 40) * 0.006 * K : 0;
    c.save(); c.translate(0.46 * K - 0.18 * K * hk + tr, 0.62 * K - 0.78 * hk * K); c.rotate(-0.25 - 0.3 * hk); c.scale(0.42 * K, 0.42 * K); ICONS.hand(c, {}); c.restore(); }
  if (el.phone) { c.save(); c.translate(-0.3 * K, 0.36 * K); c.rotate(0.15); c.shadowColor = 'rgba(160,215,255,0.9)'; c.shadowBlur = 26; c.beginPath(); c.roundRect(-0.06 * K, -0.1 * K, 0.12 * K, 0.2 * K, 0.02 * K); c.fillStyle = '#cfe8ff'; c.fill(); c.restore(); }
}
function vnoteUI(c, el, L, lt, tt, size) {              // a voice message on the phone: 0:03, a flat waveform (and a bump)
  const h = size * 2.0, w = h * 0.5, u = w / 50, bump = W_el(L, el, 'bump'), bk = bump === null ? 0 : easeOut(clamp01((lt - bump) / 0.4));
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, u * 7); c.fillStyle = '#111114'; c.fill(); c.lineWidth = u * 1.1; c.strokeStyle = '#d9d5cc'; c.stroke();
  txt(c, el.from || 'Sconosciuto', -w / 2 + u * 6, -h / 2 + u * 10, u * 4.2, '900', C.w, 'left', 'middle'); txt(c, '03:12', w / 2 - u * 6, -h / 2 + u * 10, u * 3.2, '800', '#8d8981', 'right', 'middle');
  c.fillStyle = '#26241f'; c.fillRect(-w / 2 + u * 3, -h / 2 + u * 16, w - u * 6, u * 0.4);
  const by = -u * 6, bw = w - u * 8; c.beginPath(); c.roundRect(-bw / 2, by - u * 9, bw, u * 18, u * 5); c.fillStyle = '#1d2a22'; c.fill();
  c.beginPath(); c.moveTo(-bw / 2 + u * 4, by - u * 3.5); c.lineTo(-bw / 2 + u * 4, by + u * 3.5); c.lineTo(-bw / 2 + u * 10, by); c.closePath(); c.fillStyle = C.w; c.fill();
  const n = 26, x0 = -bw / 2 + u * 14, x1 = bw / 2 - u * 10, pk = el.play === undefined ? 0 : clamp01((lt - W_el(L, el, 'play')) / 3);
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / (n - 1), d = (i - n * 0.62) / 2.2, a = u * (0.5 + 0.35 * hash(i * 1.7 + Math.floor(tt * 8))) + bk * u * 6 * Math.exp(-d * d);
    c.fillStyle = i / n < pk ? '#7fd9a0' : (bk && Math.abs(d) < 2 ? C.red : '#cfcac0'); c.fillRect(x - u * 0.4, by - a, u * 0.8, a * 2); }
  txt(c, '0:03', -bw / 2 + u * 14, by + u * 6.5, u * 3.2, '800', '#8d8981', 'left', 'middle');
  c.save(); c.translate(w / 2 - u * 9, by); c.beginPath(); c.arc(0, 0, u * 3, 0, 7); c.fillStyle = '#26241f'; c.fill(); micIcon(c, 0, u * 0.6, u * 2, '#cfcac0', false, tt); c.restore();
}
function kitchenUI(c, el, L, lt, tt, size) {            // the kitchen in the half-dark: fridge hum, wall clock tick
  const u = size / 40;
  const g = c.createRadialGradient(0, -20 * u, 2 * u, 0, 0, 60 * u); g.addColorStop(0, 'rgba(120,150,190,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-60 * u, -60 * u, 120 * u, 110 * u);
  c.fillStyle = 'rgba(242,239,232,0.25)'; c.fillRect(-60 * u, 30 * u, 120 * u, 0.4 * u);
  c.save(); c.translate(-14 * u, 6 * u); c.scale(u * 50, u * 50); ICONS.fridge(c, {}); c.restore();
  c.fillStyle = '#3a2f24'; c.fillRect(6 * u, 8 * u, 30 * u, 22 * u); c.lineWidth = u * 0.5; c.strokeStyle = 'rgba(242,239,232,0.5)'; c.strokeRect(6 * u, 8 * u, 30 * u, 22 * u);
  const cx = 22 * u, cy = -22 * u, r = 8 * u; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = '#e6e1d6'; c.fill(); c.lineWidth = u * 0.6; c.strokeStyle = C.w; c.stroke();
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; c.fillStyle = '#1a1917'; c.fillRect(cx + Math.sin(a) * r * 0.82 - u * 0.2, cy - Math.cos(a) * r * 0.82 - u * 0.2, u * 0.4, u * 0.4); }
  const sec = Math.floor(tt) / 60 * Math.PI * 2; for (const [a, l, wd, col] of [[3.2 / 12 * Math.PI * 2, 0.45, 0.6, '#1a1917'], [12 / 60 * Math.PI * 2, 0.7, 0.45, '#1a1917'], [sec, 0.78, 0.2, C.red]]) {
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * r * l, cy - Math.cos(a) * r * l); c.lineWidth = u * wd; c.strokeStyle = col; c.stroke(); }
  if (el.waves !== false) for (const [x, y] of [[-14 * u, -12 * u], [cx, cy]]) for (let k = 0; k < 3; k++) { const a = (tt * 0.7 + k / 3) % 1; c.save(); c.globalAlpha *= (1 - a) * 0.35; c.beginPath(); c.arc(x, y, u * (6 + a * 18), -0.6, 0.6); c.lineWidth = u * 0.4; c.strokeStyle = '#a0d7ff'; c.stroke(); c.beginPath(); c.arc(x, y, u * (6 + a * 18), Math.PI - 0.6, Math.PI + 0.6); c.stroke(); c.restore(); }
}
function micplanUI(c, el, L, lt, tt, size) {            // the flat from above: you in the bedroom, a microphone on in the kitchen
  const u = size / 40;
  c.lineWidth = u * 0.9; c.strokeStyle = 'rgba(242,239,232,0.75)'; c.strokeRect(-34 * u, -44 * u, 68 * u, 74 * u);
  c.lineWidth = u * 0.5; c.beginPath(); c.moveTo(-34 * u, -6 * u); c.lineTo(-6 * u, -6 * u); c.moveTo(6 * u, -6 * u); c.lineTo(34 * u, -6 * u); c.moveTo(0, -44 * u); c.lineTo(0, -16 * u); c.stroke();
  for (const [x, y, t] of [[-32, -40, 'CAMERA'], [2, -40, 'CUCINA'], [-32, -2, 'SOGGIORNO']]) txt(c, t, x * u, y * u, u * 2.8, '900', '#6b675f', 'left', 'middle', 3);
  c.save(); c.translate(-17 * u, -26 * u); c.fillStyle = '#2a2a2e'; c.beginPath(); c.roundRect(-9 * u, -10 * u, 18 * u, 24 * u, u * 2); c.fill(); c.strokeStyle = 'rgba(242,239,232,0.5)'; c.lineWidth = u * 0.4; c.stroke();
  c.beginPath(); c.arc(0, -5 * u, 3 * u, 0, 7); c.fillStyle = C.gold; c.fill(); c.beginPath(); c.arc(0, -5 * u, 3.6 * u, Math.PI + 0.3, -0.3); c.lineWidth = u * 0.8; c.strokeStyle = '#a0d7ff'; c.stroke(); c.restore();
  const mk = el.micat === undefined ? 1 : clamp01((lt - W_el(L, el, 'micat')) / 0.25); c.save(); c.globalAlpha *= mk; micIcon(c, 17 * u, -22 * u, 4 * u, C.red, true, tt);
  txt(c, 'REC', 17 * u, -12 * u, u * 2.6, '900', C.red, 'center', 'middle', 2); c.restore();
  c.fillStyle = 'rgba(242,239,232,0.35)'; c.fillRect(26 * u, -40 * u, 6 * u, 10 * u); c.beginPath(); c.arc(8 * u, -38 * u, 2.5 * u, 0, 7); c.strokeStyle = 'rgba(242,239,232,0.5)'; c.lineWidth = u * 0.4; c.stroke();
}
function wavebumpUI(c, el, L, lt, tt, size) {            // the recording: flat noise, then a breath, a metre from the microphone
  const u = size / 40, bump = W_el(L, el, 'bump'), bk = bump === null ? 0 : easeOut(clamp01((lt - bump) / 0.5)), dot = W_el(L, el, 'dot');
  micIcon(c, -30 * u, -2 * u, 4 * u, '#cfcac0', false, tt);
  c.beginPath(); for (let i = 0; i <= 120; i++) { const x = -22 * u + i * 0.44 * u, d = (i - 70) / 9, a = (0.6 + 0.5 * hash(i * 3.1 + Math.floor(tt * 10))) * u * 0.7 + bk * 9 * u * Math.exp(-d * d) * (0.8 + 0.2 * Math.sin(tt * 9 + i));
    const y = (i % 2 ? -a : a); i ? c.lineTo(x, y - 2 * u) : c.moveTo(x, y - 2 * u); }
  c.lineWidth = u * 0.35; c.strokeStyle = bk ? '#f2efe8' : '#8d8981'; c.stroke();
  if (dot !== null && lt >= dot) { const k = clamp01((lt - dot) / 0.4); c.save(); c.setLineDash([u, u]); c.beginPath(); c.moveTo(-26 * u, 14 * u); c.lineTo(-26 * u + 30 * u * k, 14 * u); c.lineWidth = u * 0.35; c.strokeStyle = C.red; c.stroke(); c.restore();
    txt(c, '1 m', -11 * u, 18 * u, u * 3, '900', C.red, 'center', 'middle'); if (k >= 1) { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 30; c.beginPath(); c.arc(4 * u, 14 * u, u * (1.6 + 0.3 * Math.sin(tt * 8)), 0, 7); c.fillStyle = C.red; c.fill(); c.restore(); } }
}
function ruleCard(c, n, lt) {
  const text = SCRIPT.rules[n - 1].toUpperCase();
  const a = easeOut(lt / 0.45);
  c.save(); c.translate(CX, 330 + (1 - a) * 40); c.globalAlpha = clamp01(lt / 0.2); if (SCRIPT.alive && !VERT) { const g = 1 + 0.03 * Math.max(0, lt - 0.6); c.translate(0, 120); c.scale(g, g); c.rotate(Math.sin(lt * 1.3) * 0.012); c.translate(0, -120); }
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
function ruleBeat(c, n, b, lt) {                      // a second (third) angle on the rule card: the words that matter, close
  const text = b.text.toUpperCase(), g = 1 + (SCRIPT.alive ? 0.03 * lt : 0);
  c.save(); c.translate(CX, 460); c.scale(g, g); c.rotate(Math.sin(lt * 1.3) * 0.01); c.shadowColor = GLOW.gold; c.shadowBlur = 24;
  let fsz = 150; const nl = f => { c.font = `900 ${f}px Montserrat`; let k = 1, cur = ''; for (const w of text.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > 1560 && cur) { k++; cur = w; } else cur = t2; } return k; };
  while (fsz > 70 && nl(fsz) > 2) fsz -= 4; if (nl(fsz) > 1) fsz = Math.min(fsz, 124);
  const lines = nl(fsz); txt(c, 'REGOLA ' + n, 0, -lines * fsz * 0.55 - 70, 58, '900', C.gold, 'center', 'middle', 6);
  const pk = 1 + 0.25 * (1 - easeOut(lt / 0.2)); c.scale(pk, pk);
  c.shadowColor = b.col === 'red' ? GLOW.red : GLOW.white; c.shadowBlur = 34;
  wrap(c, text, 0, 10, 1560, fsz, '900', b.col === 'red' ? C.red : C.w, fsz * 1.1);
  c.restore();
  progress(c, CX, 760, 44, n, 1);
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
  c.font = '900 110px Montserrat'; const tf = Math.min(110, 110 * 1700 / c.measureText(CH.title).width); txt(c, CH.title, CX, 230, tf, '900', C.w, 'center', 'middle');
  const cbtn = (x, col, a, b, d) => { const k = backOut((lt - d) / 0.35); c.save(); c.translate(x, 520); c.scale(k, k);
    c.shadowColor = col === C.red ? GLOW.red : 'rgba(39,168,92,0.9)'; c.beginPath(); c.roundRect(-380, -140, 760, 280, 30); c.fillStyle = col; c.fill(); c.shadowBlur = 0;
    c.font = '900 84px Montserrat'; const fs = Math.min(1, 680 / c.measureText(a).width); c.save(); c.scale(fs, fs); txt(c, a, 0, -20 / fs, 84, '900', C.w, 'center', 'middle'); c.restore(); txt(c, b, 0, 70, 34, '600', 'rgba(255,255,255,0.85)', 'center', 'middle'); c.restore(); };
  cbtn(CX - 430, C.green, CH.a, CH.a_sub, 0.3);
  cbtn(CX + 430, C.red, CH.b, CH.b_sub, 0.6);
  c.globalAlpha = clamp01((lt - 1.2) / 0.4); txt(c, CH.cta, CX, 780, 54, '900', C.gold, 'center', 'middle', 4);
  c.restore();
}
function endCard(c, L, lt, mode = 'full', blt = lt) {
  if (mode === 'title') { c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 40; const g = 1.15 + 0.06 * blt; c.translate(CX, 450); c.scale(g, g); c.rotate(Math.sin(blt * 1.4) * 0.012); txt(c, 'ISCRIVITI', 0, 0, 220, '900', C.w, 'center', 'middle'); c.restore(); return; }
  if (mode === 'logo') { c.save(); c.shadowColor = GLOW.red; c.shadowBlur = 30; const g = 1 + 0.05 * blt; c.translate(CX, 420); c.scale(g, g); txt(c, 'LE SETTE REGOLE', 0, 0, 120, '900', C.w, 'center', 'middle', 6); c.shadowBlur = 0;
    txt(c, (SCRIPT.case || '').split('//').pop().trim(), 0, 110, 46, '800', C.red, 'center', 'middle', 10); c.restore(); progress(c, CX, 680, 44, 8, 1); return; }
  if (SCRIPT.end_beats) lt = blt;
  c.save(); c.shadowColor = GLOW.white; c.shadowBlur = 30; const k = easeOut(lt / 0.5);
  const EN = { title: 'ISCRIVITI', sub: 'LA NOTTE 2 È GIÀ COMINCIATA', ...(SCRIPT.end || {}) };
  if (SCRIPT.alive) c.translate(0, -28 * lt); c.globalAlpha = k; const br = 1 + 0.035 * Math.sin(lt * 2.4) + (SCRIPT.alive ? 0.035 * lt : 0); c.save(); c.translate(CX, 380); c.scale(br, br); txt(c, EN.title, 0, 0, 170, '900', C.w, 'center', 'middle'); c.restore();
  c.shadowColor = GLOW.red; txt(c, EN.sub, CX, 540, 62, '900', C.red, 'center', 'middle');
  c.shadowBlur = 0; txt(c, SCRIPT.case, CX, 660, 30, '600', C.dim, 'center', 'middle', 8);
  progress(c, CX, 760, 40, 8, 1); c.restore();
}

// ---------- chrome: HUD + captions + grain + vignette ----------
const GRAIN = Array.from({ length: 6 }, (_, g) => { const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270; const x = cv.getContext('2d'); const im = x.createImageData(480, 270);
  for (let i = 0; i < im.data.length; i += 4) { const v = hash(i * 0.37 + g * 1013) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return cv; });
function hud(c, t, L) {
  if (VERT) return;                                   // shorts: no HUD, no logo
  c.save();
  txt(c, SCRIPT.case, 70, 58, 24, '600', '#8d8981', 'left', 'middle', 6);
  const seen = rulesSeen(t); const cur = L.rule || (seen.length ? Math.max(...seen) : 0);
  if (seen.length) progress(c, CX, 58, 26, cur, 0.9);
  txt(c, `${SCRIPT.night}  ·  ${clockAt(t)}`, FW - 70, 58, 26, '800', '#d9d5cc', 'right', 'middle', 4);
  c.restore();
}
const capTime = (L, wi, n) => { const toks = L.tokens; if (!toks.length) return 0; return toks[Math.min(toks.length - 1, Math.round(wi * toks.length / n))].s - L.cut; };
function capRed(L) {                                  // seconds into the line when the red word is spoken (for the pop + hit)
  if (!L.red || !L.cap) return null; const words = L.cap.split(/\s+/), r = norm(L.red)[0], wi = words.findIndex(w => norm(w)[0] === r); return wi < 0 ? null : capTime(L, wi, words.length);
}
function captionV(c, L, t) {                        // shorts: big burned-in words, revealed as spoken, max 3 rows per page, one red word that pops
  const lt = t - L.cut, words = L.cap.toUpperCase().split(/\s+/), n = words.length, red = L.red ? norm(L.red)[0] : null;
  let FS = 82; const MAXW = 900, CXC = CX - 20; c.save();
  const nrows = f => { c.font = `900 ${f}px Montserrat`; let n2 = 1, cur2 = ''; for (const w of words) { const t2 = cur2 ? cur2 + ' ' + w : w; if (c.measureText(t2).width > MAXW && cur2) { n2++; cur2 = w; } else cur2 = t2; } return n2; };
  if (L.capfull && !L.cap_pages) while (FS > 68 && nrows(FS) > 4) FS -= 2;
  const LH = FS * 1.2; c.font = `900 ${FS}px Montserrat`;
  const pages = (L.cap_pages || [L.cap]).map(p => p.split(/\s+/).length); let w0 = 0, pi = 0;
  const shownUpTo = L.capfull ? n : words.findLastIndex((w, i) => capTime(L, i, n) <= lt + 0.05);
  for (let k = 0, acc = 0; k < pages.length; k++) { if (shownUpTo >= acc) { pi = k; w0 = acc; } acc += pages[k]; }
  const pw = words.slice(w0, w0 + pages[pi]); const rows = []; let cur = [];
  for (const w of pw) { const tst = [...cur, w].join(' '); if (c.measureText(tst).width > MAXW && cur.length) { rows.push(cur); cur = [w]; } else cur.push(w); } rows.push(cur);
  let wi = w0; const y0 = 1430 - (rows.length - 1) * LH / 2;
  rows.forEach((row, r) => { const full = c.measureText(row.join(' ')).width; let x = CXC - full / 2;
    for (const w of row) { const ts = L.capfull ? -1 : capTime(L, wi, n), k = clamp01((lt - ts + 0.05) / 0.08), isRed = red && norm(w)[0] === red, ww = c.measureText(w + ' ').width;
      if (k > 0) { const pop = isRed ? 1 + 0.2 * clamp01(1 - (lt - ts) / 0.15) * (lt >= ts ? 1 : 0) : 1, wd = c.measureText(w).width;
        c.save(); c.globalAlpha = k; c.translate(x + wd / 2, y0 + r * LH); c.scale(pop, pop);
        c.shadowColor = isRed ? GLOW.red : 'rgba(0,0,0,0.9)'; c.shadowBlur = isRed ? 30 : 16; c.lineWidth = 12; c.strokeStyle = '#000'; c.lineJoin = 'round'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.strokeText(w, 0, 0); c.fillStyle = isRed ? C.red : '#f4f1ea'; c.fillText(w, 0, 0); c.restore(); }
      x += ww; wi++; } });
  c.restore();
}
function caption(c, L, t) {
  const lt = t - L.cut; if (!L.cap || L.v?.t === 'choice' || L.v?.t === 'end') return;
  if (VERT) return captionV(c, L, t);
  c.save(); c.globalAlpha = clamp01(lt / 0.15); c.shadowColor = 'rgba(242,239,232,0.55)'; c.shadowBlur = 18;
  wrap(c, L.cap.toUpperCase(), CX, 968, 1640, 50, '800', '#f4f1ea', 62); c.restore();
}

// ---------- the one entry point ----------
window.seek = (t) => {
  let li = 0; for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].cut) li = i;
  const LOOP = VERT && SCRIPT.loop && t > Math.min(LINES[LINES.length - 1].end + 0.04, DUR - 2 / 30);   // last frames = first frame, for the loop
  if (LOOP) t = 0;
  if (LOOP) li = 0;
  const L = LINES[li], lt = t - L.cut, v = L.v || {};
  let shot = null, st0 = 0, st1 = L.next - L.cut;          // current shot inside the line
  const SHOTS = v.shots || (v.beats ? [{}, ...v.beats] : null);
  let shotK = 0; if (SHOTS) { SHOTS.forEach((sh, k) => { const a0 = sh.at ? at(L, sh.at) + (sh.dt || 0) : 0; if (lt >= a0) { shot = sh; st0 = a0; shotK = k; } });
    const nx = SHOTS.map(sh => sh.at ? at(L, sh.at) + (sh.dt || 0) : 0).filter(a => a > st0); if (nx.length) st1 = Math.min(...nx); }
  if (!v.shots) shot = null;
  const slt = lt - st0;
  // stage (everything that can glitch / shake / zoom)
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalAlpha = 1; sc.fillStyle = C.bg; sc.fillRect(0, 0, FW, FH);
  const push = 1 + 0.035 * (1 - easeOut((VERT ? slt : lt) / 0.5)) * (VERT && t < 0.5 ? 0 : 1);   // every cut lands with a small push
  const dLine = L.next - L.cut, toEnd = L.next - t;
  const creep = VERT ? 1 + 0.08 * clamp01(slt / Math.max(0.6, st1 - st0)) : SCRIPT.creep_shot ? 1 + SCRIPT.creep_shot * clamp01(slt / Math.max(0.8, st1 - st0)) : 1 + 0.035 * clamp01(lt / Math.max(1, dLine));   // slow push-in (shorts: 1.00 -> 1.08 per shot)
  const exitK = VERT ? 0 : clamp01(1 - toEnd / 0.16);   // quick scale-out into the next cut (not at the end of a short)
  const drift = creep * (1 - 0.04 * exitK) * (1 + 0.008 * Math.sin(t * 0.21));
  // dust: a few slow motes (deterministic)
  for (let i = 0; i < 40; i++) { const px = (hash(i) * FW + t * (6 + hash(i + 1) * 14)) % FW, py = (hash(i + 2) * FH - t * (3 + hash(i + 3) * 8) + FH * 10) % FH;
    sc.fillStyle = `rgba(242,239,232,${0.05 + 0.12 * hash(i + 4)})`; sc.beginPath(); sc.arc(px, py, 1 + hash(i + 5) * 1.6, 0, 7); sc.fill(); }
  let shx = 0, shy = 0;
  const shk = shot && shot.shake ? slt : (v.fx === 'shake' ? lt : 9);
  if (shk < 0.5) { shx = Math.sin(t * 90) * 14 * (1 - shk / 0.5); shy = Math.cos(t * 77) * 10 * (1 - shk / 0.5); }
  if (SCRIPT.pan && !VERT) { const pk = easeOut(clamp01(slt / Math.max(0.8, st1 - st0))) - 0.5, m = (li * 3 + shotK) % 4;     // every shot drifts a little, each one a different way
    shx += SCRIPT.pan * pk * [1, -1, 0.6, -0.6][m]; shy += SCRIPT.pan * 0.45 * pk * [0.4, 0.5, -1, -0.8][m]; }
  sc.translate(CX + shx, CY + shy); sc.scale(push * drift, push * drift); sc.translate(-CX, -CY);
  sc.globalAlpha = 1 - 0.85 * exitK;
  if (v.t === 'rule') { if (v.beats && shotK > 0) ruleBeat(sc, v.n, v.beats[shotK - 1], slt); else ruleCard(sc, v.n, lt); }
  else if (v.t === 'clash') clash(sc, v, L, lt, t);
  else if (v.t === 'choice') choice(sc, L, lt);
  else if (v.t === 'end') endCard(sc, L, lt, v.beats ? (shotK ? v.beats[shotK - 1].mode : 'title') : 'full', slt);
  else if (shot) { const sw = shot.at; (shot.els || []).forEach(el => drawEl(sc, el.at === undefined && sw ? { ...el, at: sw, _dt: shot.dt || 0 } : el, L, lt, t)); }
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
  const fade = VERT ? 1 : Math.min(clamp01(t / 0.6), clamp01((DUR - t) / 1.2)); if (fade < 1)   // shorts open on the object and cut dead at the end
   { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, FW, FH); }
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
  if (VERT) { const r = capRed(L); if (r !== null) ev.push({ t: L.cut + Math.max(0, r), k: 'redhit' }); for (const sh of v.shots || []) if (sh.at) ev.push({ t: L.cut + at(L, sh.at) + (sh.dt || 0), k: 'cut' }); }
}
window.EVENTS = { bed: SCRIPT.bed, bed_under: SCRIPT.bed_under, pulse: SCRIPT.pulse, hush_before: SCRIPT.hush_before, dips: SCRIPT.dips, width: FW, height: FH, duration: DUR, estimated: !!TIM.estimated, ev, lines: LINES.map(L => ({ id: L.id, cut: L.cut, start: L.start, end: L.end })) };
window.SHOTS = LINES.map(L => [L.id, L.cut]);
window.ready = true;
