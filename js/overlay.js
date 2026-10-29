// 2D overlay: monospace HUD, chunky captions, tilted rule stickers, 2D phone screens, choice + end cards.
export const ACC = '#ff3b30', AMB = '#ffb347', INK = '#0d0f12', PAPER = '#efe8d8';
const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const back = x => { x = Math.max(0, Math.min(1, x)); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export function hud(c, day, clock, t) {
  c.save();
  c.font = '700 40px JBM'; c.textBaseline = 'top';
  c.fillStyle = 'rgba(8,10,14,0.55)'; c.fillRect(48, 70, 330, 128);
  c.fillStyle = ACC; c.fillRect(48, 70, 8, 128);
  const blink = Math.floor(t * 2) % 2 === 0;
  c.fillStyle = '#e9e4d8'; c.fillText(`DAY ${day}`, 76, 84);
  if (blink) { c.fillStyle = ACC; c.beginPath(); c.arc(330, 104, 10, 0, 7); c.fill(); }
  c.font = '700 62px JBM'; c.fillStyle = '#ffffff'; c.fillText(clock, 74, 128);
  c.restore();
}

// words: [{w:'WE\'RE'},{w:'FULL',k:1}] ; lt = seconds since caption start
export function caption(c, words, lt, y = 1440, size = 132) {
  c.save();
  c.font = `${size}px Anton`; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  const gap = size * 0.24;
  const widths = words.map(o => c.measureText(o.w.toUpperCase()).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let scale = Math.min(1, 960 / total);
  const pop = 1 + 0.22 * (1 - ease(lt / 0.14));
  c.translate(540, y); c.scale(scale * pop, scale * pop);
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
export function sticker(c, n, lines, lt, y = 470, tilt = -0.07) {
  const a = back(lt / 0.22);
  c.save();
  c.translate(540, y); c.rotate(tilt + (1 - a) * 0.25); const s = 0.6 + 0.4 * a + 0.3 * (1 - Math.min(1, lt / 0.22)); c.scale(s, s);
  c.globalAlpha = Math.min(1, lt / 0.06);
  const W = 860, H = 140 + lines.length * 150;
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
  c.fillStyle = PAPER; c.beginPath(); c.roundRect(-W / 2, -H / 2, W, H, 10); c.fill();
  c.shadowColor = 'transparent';
  // paper grain (deterministic)
  let r = 9; for (let i = 0; i < 500; i++) { r = (r * 16807) % 2147483647; const x = (r % W) - W / 2; r = (r * 16807) % 2147483647; const yy = (r % H) - H / 2; c.fillStyle = 'rgba(80,60,30,0.07)'; c.fillRect(x, yy, 3, 3); }
  // tape
  c.fillStyle = 'rgba(214,200,160,0.85)';
  [[-W / 2 + 40, -H / 2 - 10, -0.5], [W / 2 - 40, -H / 2 - 10, 0.5]].forEach(([x, yy, rot]) => { c.save(); c.translate(x, yy); c.rotate(rot); c.fillRect(-70, -22, 140, 44); c.restore(); });
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = ACC; c.font = '64px Anton'; c.fillText(`RULE ${n}`, -W / 2 + 50, -H / 2 + 105);
  c.fillStyle = ACC; c.fillRect(-W / 2 + 50, -H / 2 + 122, 200, 8);
  c.fillStyle = INK; c.font = '150px Anton';
  lines.forEach((ln, i) => {
    let x = -W / 2 + 46; const yy = -H / 2 + 270 + i * 150;
    ln.forEach(seg => { c.fillStyle = seg.k ? ACC : INK; const fit = Math.min(1, 1); c.fillText(seg.w, x, yy); x += c.measureText(seg.w).width + 30; });
  });
  c.restore();
}

// POV: a desk phone console drawn flat, two stick thumbs
export function phonePOV(c, lt, opts = {}) {
  const blink = Math.floor(lt * 3) % 2 === 0, ring = opts.ring ?? true;
  const shake = ring ? Math.sin(lt * 70) * 4 * (Math.floor(lt * 1.5) % 2 === 0 ? 1 : 0) : 0;
  c.save(); c.translate(540 + shake, 1120);
  // body
  c.lineJoin = 'round';
  c.fillStyle = '#d6c9a8'; c.strokeStyle = INK; c.lineWidth = 14;
  c.beginPath(); c.roundRect(-430, -470, 860, 960, 60); c.fill(); c.stroke();
  c.fillStyle = '#c6b896'; c.beginPath(); c.roundRect(-430, -470, 860, 200, [60, 60, 0, 0]); c.fill(); c.stroke();
  // handset cradle
  c.fillStyle = '#bfb08e'; c.beginPath(); c.roundRect(-380, -440, 760, 140, 50); c.fill(); c.stroke();
  // LCD
  c.fillStyle = blink && ring ? '#b9d39a' : '#9fb486'; c.beginPath(); c.roundRect(-360, -230, 720, 170, 18); c.fill(); c.stroke();
  c.fillStyle = '#1f2a14'; c.font = '700 54px JBM'; c.textBaseline = 'middle';
  c.fillText(ring ? 'INCOMING · LINE 1' : 'LINE 1', -330, -180);
  c.font = '700 64px JBM'; c.fillText(opts.label || 'RM 9', -330, -110);
  if (opts.rings !== undefined) { c.textAlign = 'right'; c.fillText(`x${opts.rings}`, 330, -110); c.textAlign = 'left'; }
  // room buttons 1..10 (9 is taped over and glows)
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  nums.forEach((n, i) => {
    const col = i % 5, rowi = Math.floor(i / 5), x = -340 + col * 140, y = 0 + rowi * 150;
    const lit = n === 9 && ring && blink;
    c.fillStyle = n === 9 ? (lit ? '#ff4636' : '#8a2b24') : '#efe6cf';
    c.beginPath(); c.roundRect(x, y, 116, 116, 18); c.fill(); c.lineWidth = 10; c.stroke();
    if (lit) { c.save(); c.shadowColor = '#ff2a1a'; c.shadowBlur = 60; c.fill(); c.restore(); c.stroke(); }
    c.fillStyle = INK; c.font = '64px Anton'; c.textAlign = 'center'; c.fillText(String(n), x + 58, y + 62); c.textAlign = 'left';
    if (n === 9) { c.save(); c.translate(x + 58, y + 58); c.rotate(-0.35); c.fillStyle = 'rgba(232,220,180,0.88)'; c.fillRect(-80, -24, 160, 48); c.fillStyle = '#5a4a2a'; c.font = '30px JBM'; c.textAlign = 'center'; c.fillText('NO', 0, 2); c.restore(); }
  });
  c.restore();
  // thumbs (flat stick style: light fill, thick dark outline, round)
  const pull = opts.pull ?? 0;
  const thumb = (x0, y0, x1, y1) => {
    c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 120; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = '#ece7dc'; c.lineWidth = 78; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };
  const hover = Math.sin(lt * 5) * 10;
  thumb(150, 2050, 300 - pull * 60, 1640 + hover + pull * 260);
  thumb(1000, 2050, 830 + pull * 60, 1600 - hover + pull * 260);
}

export function choice(c, lt) {
  c.save();
  c.fillStyle = 'rgba(4,6,10,0.72)'; c.fillRect(0, 0, 1080, 1920);
  c.textAlign = 'center'; c.font = '120px Anton'; c.lineJoin = 'round';
  c.lineWidth = 18; c.strokeStyle = INK; c.strokeText('WHAT DO YOU DO?', 540, 560); c.fillStyle = '#fff'; c.fillText('WHAT DO YOU DO?', 540, 560);
  const btn = (y, col, a, b, d) => { const k = back((lt - d) / 0.25); c.save(); c.translate(540, y); c.scale(k, k);
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 14; c.beginPath(); c.roundRect(-420, -150, 840, 300, 34); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = '110px Anton'; c.fillText(a, 0, -5); c.font = '50px JBM'; c.fillText(b, 0, 85); c.restore(); };
  btn(860, '#1f9d4c', 'OPEN IT', 'get the light back', 0.1);
  btn(1240, '#d42a22', 'STAY IN THE DARK', 'with them', 0.3);
  c.font = '72px Anton'; c.fillStyle = AMB; c.fillText('COMMENT BELOW', 540, 1560);
  c.restore();
}

export function endCard(c, lt) {
  c.save(); c.fillStyle = 'rgba(4,6,10,0.85)'; c.fillRect(0, 0, 1080, 1920);
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '170px Anton'; c.fillText('FOLLOW', 540, 900);
  c.fillStyle = ACC; c.fillText('FOR DAY 2', 540, 1080);
  c.font = '44px JBM'; c.fillStyle = '#bdb6a6'; c.fillText('THE STARLITE MOTEL', 540, 1200); c.restore();
}

export function vignetteText(c, txt, y, col = '#fff') { c.save(); c.textAlign = 'center'; c.font = '90px Anton'; c.lineWidth = 14; c.strokeStyle = INK; c.strokeText(txt, 540, y); c.fillStyle = col; c.fillText(txt, 540, y); c.restore(); }
