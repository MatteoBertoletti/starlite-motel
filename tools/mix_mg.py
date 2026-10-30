"""Sound mix for the motion-graphics episodes: voice on top, a calm dark bed ~15 dB under it,
one sound per beat (from window.EVENTS), loudness -14 LUFS, dropout scan."""
import argparse, json, subprocess, re
import numpy as np, soundfile as sf
ap = argparse.ArgumentParser()
for a in ['voice', 'events', 'sfx', 'out']: ap.add_argument('--' + a, required=True)
ap.add_argument('--bed', default='bed_calm'); ap.add_argument('--bed-under', type=float, default=15); ap.add_argument('--bed-lp', type=float, default=4000)
A = ap.parse_args(); SR = 48000
def load(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).copy()
def lufs(x):
    sf.write('/tmp/_l.wav', x, SR); o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', '/tmp/_l.wav', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', o); return float(m[-1]) if m else -70.0
def act_db(x):
    w = SR // 50; n = len(x) // w
    if n == 0: return -90
    d = 20 * np.log10(np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, 1)) + 1e-12); a = d[d > d.max() - 30]; return float(10 * np.log10(np.mean(10 ** (a / 10))))
E = json.load(open(A.events)); D = E['duration']; N = int(D * SR) + SR
V = np.zeros(N, np.float32); v = load(A.voice)[:N]; V[:len(v)] = v; vref = act_db(V)
FX = np.zeros(N, np.float32); cache = {}
def place(key, t, g, dur=None, fade=0.02):
    if key not in cache: cache[key] = load(f'{A.sfx}/{key}.mp3')
    x = cache[key]; x = x[: int(dur * SR)] if dur else x
    x = x * 10 ** ((vref + g - act_db(x)) / 20); f = int(fade * SR); e = np.ones(len(x), np.float32)
    if len(x) > 2 * f: e[:f] = np.linspace(0, 1, f); e[-f:] = np.linspace(1, 0, f)
    a = int(max(0, t) * SR); b = min(N, a + len(x)); FX[a:b] += (x * e)[: b - a]
MAP = {'rule': [('whoosh', -0.2, -17, None), ('slap', 0.0, -9, None)], 'buzz': [('buzzer', 0, -10, 0.9)], 'static': [('static', 0, -20, 1.2)],
       'glitch': [('glitch2', 0, -15, None)], 'hit': [('sting', 0, -8, None)], 'ding': [('ding', 0, -13, 1.6)], 'tick': [('tick', 0, -12, None)],
       'creak': [('creak_open', 0, -14, None)], 'steps': [('steps', 0, -17, 1.6)], 'click': [('switch', 0, -9, None)], 'keys': [('keys', 0, -12, 1.2)],
       'lock': [('lock', 0, -10, 1.0)], 'scrape': [('keys', 0, -11, 0.8)], 'door_shut': [('door_shut', 0, -11, None)], 'off': [('off', 0, -11, None), ('power_down', 0.05, -16, None)],
       'knock': [('knock', 0, -6, 0.6)], 'paper': [('paper', 0, -16, None)], 'boom': [('boom', -0.05, -7, None)], 'end_hit': [('end_hit', 0, -9, None)]}
last_cut = -9
for e in sorted(E['ev'], key=lambda e: e['t']):
    if e['k'] == 'cut':
        if e['t'] - last_cut > 2.2: place('soft_whoosh', e['t'] - 0.12, -27); last_cut = e['t']
        continue
    for key, dt, g, dur in MAP.get(e['k'], []): place(key, e['t'] + dt, g, dur)
bed = load(f'{A.sfx}/{A.bed}.mp3')
if A.bed_lp:
    sf.write('/tmp/_b.wav', bed, SR); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_b.wav', '-af', f'lowpass=f={A.bed_lp},highpass=f=45', '/tmp/_b2.wav'], check=True); bed, _ = sf.read('/tmp/_b2.wav', dtype='float32')
bed = np.tile(bed, int(np.ceil(N / len(bed))) + 1)[:N]; bed *= 10 ** ((lufs(V) - A.bed_under - lufs(bed[: 60 * SR])) / 20)
g = np.ones(N, np.float32); g[: int(1.5 * SR)] = np.linspace(0, 1, int(1.5 * SR))
lines = {l['id']: l for l in E['lines']}
for lid in (79, 85):                                  # dip before the big moments
    if lid in lines: c = lines[lid]['cut']; a, b = int((c - 0.8) * SR), int(c * SR); g[a:b] = np.linspace(1, 0.15, b - a); g[b:b + int(0.6 * SR)] = np.linspace(0.15, 1.25, int(0.6 * SR)); g[b + int(0.6 * SR):] *= 1.25
g[int((D - 2.5) * SR):] *= np.linspace(1, 0, N - int((D - 2.5) * SR))
mix = (V + FX + bed * g)[: int(D * SR)]
sf.write('/tmp/_pre.wav', np.stack([mix, mix], 1), SR)
o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', '/tmp/_pre.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(o[o.rfind('{'): o.rfind('}') + 1])
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', '/tmp/_pre.wav', '-af', f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", '-ar', str(SR), A.out], check=True)
for _ in range(3):
    y, _ = sf.read(A.out, dtype='float32'); cur = lufs(y.mean(1))
    if abs(cur + 14) <= 0.5: break
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', A.out, '-af', f'volume={-14 - cur:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=false', '-ar', str(SR), '/tmp/_lim.wav'], check=True); subprocess.run(['cp', '/tmp/_lim.wav', A.out])
y, _ = sf.read(A.out, dtype='float32'); y = y.mean(1); w = SR // 100; n = len(y) // w
db = 20 * np.log10(np.sqrt(np.mean(y[: n * w].reshape(n, w) ** 2, 1)) + 1e-9); drops, run = [], 0
for i, q in enumerate(db < -55):
    run = run + 1 if q else 0
    if run == 25 and 0.5 < i / 100 < D - 1.5: drops.append(round((i - 24) / 100, 2))
rep = {'final_lufs': lufs(y), 'voice_lufs': lufs(V), 'bed_lufs': lufs((bed * g)[int(5 * SR): int(120 * SR)]), 'dropouts': drops}
rep['bed_under_voice_db'] = round(rep['voice_lufs'] - rep['bed_lufs'], 1); print(json.dumps(rep, indent=1)); json.dump(rep, open(A.out.replace('.wav', '_report.json'), 'w'), indent=1)
