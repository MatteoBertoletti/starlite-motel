// 2D overlay: monospace HUD, chunky captions, tilted rule stickers, 2D phone screens, choice + end cards.
// Works for 9:16 (1080x1920) and 16:9 (1920x1080); all text comes from the language table.
export const ACC = '#ff3b30', AMB = '#ffb347', INK = '#0d0f12', PAPER = '#efe8d8';
let W = 1080, H = 1920, LAND = false;
export function setSize(w, h) { W = w; H = h; LAND = w > h; }
const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const back = x => { x = Math.max(0, Math.min(1, x)); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export function hud(c, dayLabel, clock, t) {
  c.save();
  c.font = '700 40px JBM'; c.textBaseline = 'top';
  const bw = Math.max(330, c.measureText(dayLabel).width + 120);
  c.fillStyle = 'rgba(8,10,14,0.55)'; c.fillRect(48, LAND ? 44 : 70, bw, 128);
  c.fillStyle = ACC; c.fillRect(48, LAND ? 44 : 70, 8, 128);
  const y0 = LAND ? 58 : 84;
  c.fillStyle = '#e9e4d8'; c.fillText(dayLabel, 76, y0);
  if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = ACC; c.beginPath(); c.arc(48 + bw - 30, y0 + 20, 10, 0, 7); c.fill(); }
  c.font = '700 62px JBM'; c.fillStyle = '#ffffff'; c.fillText(clock, 74, y0 + 44);
  c.restore();
}

// words: [{w:'WE\'RE'},{w:'FULL',k:1}] ; lt = seconds since caption start
export function caption(c, words, lt, y, size = 132) {
  c.save();
  c.font = `${size}px Anton`; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  const gap = size * 0.24;
  const widths = words.map(o => c.measureText(o.w.toUpperCase()).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  const scale = Math.min(1, (W - 120) / total);
  const pop = 1 + 0.22 * (1 - ease(lt / 0.14));
  c.translate(W / 2, y); c.scale(scale * pop, scale * pop);
  let x = -total / 2;
  words.forEach((o, i) => {
    const txt = o.w.toUpperCase();
    c.lineWidth = size * 0.17; c.strokeStyle = INK; c.strokeText(txt, x, 0);
    c.fillStyle = o.k ? ACC : '#ffffff'; c.fillText(txt, x, 0);
    x += widths[i] + gap;
  });
  c.restore();
}

// tilted rule sticker with a big condensed title (slaps on)
export function sticker(c, label, lines, lt, y, tilt = -0.07, scl = 1) {
  const a = back(lt / 0.22);
  c.save();
  c.translate(W / 2, y); c.rotate(tilt + (1 - a) * 0.25);
  const s = (0.6 + 0.4 * a + 0.3 * (1 - Math.min(1, lt / 0.22))) * scl; c.scale(s, s);
  c.globalAlpha = Math.min(1, lt / 0.06);
  c.font = '150px Anton';
  const textW = Math.max(...lines.map(ln => ln.reduce((acc, seg) => acc + c.measureText(seg.w).width + 30, 0)));
  const SW = Math.max(860, textW + 80), SH = 140 + lines.length * 150;
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
  c.fillStyle = PAPER; c.beginPath(); c.roundRect(-SW / 2, -SH / 2, SW, SH, 10); c.fill();
  c.shadowColor = 'transparent';
  let r = 9; for (let i = 0; i < 500; i++) { r = (r * 16807) % 2147483647; const x = (r % SW) - SW / 2; r = (r * 16807) % 2147483647; const yy = (r % SH) - SH / 2; c.fillStyle = 'rgba(80,60,30,0.07)'; c.fillRect(x, yy, 3, 3); }
  c.fillStyle = 'rgba(214,200,160,0.85)';
  [[-SW / 2 + 40, -SH / 2 - 10, -0.5], [SW / 2 - 40, -SH / 2 - 10, 0.5]].forEach(([x, yy, rot]) => { c.save(); c.translate(x, yy); c.rotate(rot); c.fillRect(-70, -22, 140, 44); c.restore(); });
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = ACC; c.font = '64px Anton'; c.fillText(label, -SW / 2 + 50, -SH / 2 + 105);
  c.fillRect(-SW / 2 + 50, -SH / 2 + 122, 200, 8);
  c.font = '150px Anton';
  lines.forEach((ln, i) => {
    let x = -SW / 2 + 46; const yy = -SH / 2 + 270 + i * 150;
    ln.forEach(seg => { c.fillStyle = seg.k ? ACC : INK; c.fillText(seg.w, x, yy); x += c.measureText(seg.w).width + 30; });
  });
  c.restore();
}

// POV: a desk phone console drawn flat, two stick thumbs (all in phone-relative coords)
export function phonePOV(c, lt, opts = {}) {
  const blink = Math.floor(lt * 3) % 2 === 0, ring = opts.ring ?? true;
  const shake = ring ? Math.sin(lt * 70) * 4 * (Math.floor(lt * 1.5) % 2 === 0 ? 1 : 0) : 0;
  const S = LAND ? 0.68 : 1;
  c.save(); c.translate(W / 2 + shake, LAND ? H * 0.53 : 1120); c.scale(S, S);
  c.lineJoin = 'round';
  c.fillStyle = '#d6c9a8'; c.strokeStyle = INK; c.lineWidth = 14;
  c.beginPath(); c.roundRect(-430, -470, 860, 960, 60); c.fill(); c.stroke();
  c.fillStyle = '#c6b896'; c.beginPath(); c.roundRect(-430, -470, 860, 200, [60, 60, 0, 0]); c.fill(); c.stroke();
  c.fillStyle = '#bfb08e'; c.beginPath(); c.roundRect(-380, -440, 760, 140, 50); c.fill(); c.stroke();
  c.fillStyle = blink && ring ? '#b9d39a' : '#9fb486'; c.beginPath(); c.roundRect(-360, -230, 720, 170, 18); c.fill(); c.stroke();
  c.fillStyle = '#1f2a14'; c.font = '700 54px JBM'; c.textBaseline = 'middle';
  c.fillText(ring ? opts.lcdRing : opts.lcdIdle, -330, -180);
  c.font = '700 64px JBM'; c.fillText(opts.label, -330, -110);
  if (opts.rings !== undefined) { c.textAlign = 'right'; c.fillText(`x${opts.rings}`, 330, -110); c.textAlign = 'left'; }
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((n, i) => {
    const col = i % 5, rowi = Math.floor(i / 5), x = -340 + col * 140, y = rowi * 150;
    const lit = n === 9 && ring && blink;
    c.fillStyle = n === 9 ? (lit ? '#ff4636' : '#8a2b24') : '#efe6cf';
    c.beginPath(); c.roundRect(x, y, 116, 116, 18); c.fill(); c.lineWidth = 10; c.stroke();
    if (lit) { c.save(); c.shadowColor = '#ff2a1a'; c.shadowBlur = 60; c.fill(); c.restore(); c.stroke(); }
    c.fillStyle = INK; c.font = '64px Anton'; c.textAlign = 'center'; c.fillText(String(n), x + 58, y + 62); c.textAlign = 'left';
    if (n === 9) { c.save(); c.translate(x + 58, y + 58); c.rotate(-0.35); c.fillStyle = 'rgba(232,220,180,0.88)'; c.fillRect(-80, -24, 160, 48); c.fillStyle = '#5a4a2a'; c.font = '30px JBM'; c.textAlign = 'center'; c.fillText('NO', 0, 2); c.restore(); }
  });
  const pull = opts.pull ?? 0, hover = Math.sin(lt * 5) * 10;
  const thumb = (x0, y0, x1, y1) => {
    c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 120; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = '#ece7dc'; c.lineWidth = 78; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };
  thumb(-390, 930, -240 - pull * 60, 520 + hover + pull * 260);
  thumb(460, 930, 290 + pull * 60, 480 - hover + pull * 260);
  c.restore();
}

export function choice(c, lt, T) {
  c.save();
  c.fillStyle = 'rgba(4,6,10,0.72)'; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.lineJoin = 'round';
  const title = (txt, y, size) => { c.font = `${size}px Anton`; c.lineWidth = 18; c.strokeStyle = INK; c.strokeText(txt, W / 2, y); c.fillStyle = '#fff'; c.fillText(txt, W / 2, y); };
  const btn = (cx, cy, col, a, b, d, s) => { const k = back((lt - d) / 0.25) * s; c.save(); c.translate(cx, cy); c.scale(k, k);
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 14; c.beginPath(); c.roundRect(-420, -150, 840, 300, 34); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = '110px Anton'; const fs = Math.min(1, 760 / c.measureText(a).width); c.save(); c.scale(fs, fs); c.fillText(a, 0, -5 / fs); c.restore();
    c.font = '50px JBM'; c.fillText(b, 0, 85); c.restore(); };
  if (LAND) {
    title(T.choiceTitle, 260, 120);
    btn(W * 0.27, 600, '#1f9d4c', T.openA, T.openB, 0.1, 0.92);
    btn(W * 0.73, 600, '#d42a22', T.stayA, T.stayB, 0.3, 0.92);
    c.font = '72px Anton'; c.fillStyle = AMB; c.fillText(T.comment, W / 2, 930);
  } else {
    title(T.choiceTitle, 560, 120);
    btn(W / 2, 860, '#1f9d4c', T.openA, T.openB, 0.1, 1);
    btn(W / 2, 1240, '#d42a22', T.stayA, T.stayB, 0.3, 1);
    c.font = '72px Anton'; c.fillStyle = AMB; c.fillText(T.comment, W / 2, 1560);
  }
  c.restore();
}

export function endCard(c, lt, T) {
  c.save(); c.fillStyle = 'rgba(4,6,10,0.85)'; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '170px Anton';
  const cy = H / 2 - 60;
  c.fillText(T.follow, W / 2, cy); c.fillStyle = ACC; c.fillText(T.forDay, W / 2, cy + 180);
  c.font = '44px JBM'; c.fillStyle = '#bdb6a6'; c.fillText(T.title, W / 2, cy + 300); c.restore();
}

// Rule 1 breaks: the sticker slaps on, then cracks and a red slash goes through it
export function brokenSticker(c, lt, T, y, scl) {
  if (lt < 0) return;
  sticker(c, T.rule(1), T.stick[1], lt + 0.3, y, -0.07, scl);
  const k = Math.min(1, lt / 0.25);
  c.save(); c.translate(W / 2, y); c.rotate(-0.07); c.scale(scl, scl);
  c.strokeStyle = INK; c.lineWidth = 6; c.beginPath();
  [[-60, -250], [-20, -120], [-70, -10], [-10, 90], [-50, 220]].slice(0, 1 + Math.floor(k * 4)).forEach(([x, yy], i) => i ? c.lineTo(x, yy) : c.moveTo(x, yy)); c.stroke();
  c.strokeStyle = ACC; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(-430, 200); c.lineTo(-430 + 860 * k, 200 - 420 * k); c.stroke();
  c.restore();
  if (lt > 0.3) { c.save(); c.textAlign = 'center'; c.font = '96px Anton'; c.lineWidth = 16; c.strokeStyle = INK; c.lineJoin = 'round';
    const yy = LAND ? y + 330 * scl : 820; c.strokeText(T.impossible, W / 2, yy); c.fillStyle = ACC; c.fillText(T.impossible, W / 2, yy); c.restore(); }
}
