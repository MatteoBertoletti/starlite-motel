"""Sound mix: voice on top, the drone bed ~13 LU under it, one sound effect per event,
a dip before the big moments, loudness -14 LUFS, then a scan for dropouts.
python tools/mix.py --voice out/audio/voice.wav --events out/events.json --sfx out/audio/sfx --out out/mix.wav
"""
import argparse, json, subprocess, re, sys
import numpy as np, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument('--voice', required=True); ap.add_argument('--events', required=True)
ap.add_argument('--sfx', required=True); ap.add_argument('--out', required=True)
A = ap.parse_args()
SR = 48000

def load(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()

def lufs(x):
    sf.write('/tmp/_l.wav', x, SR)
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', '/tmp/_l.wav', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', o); return float(m[-1]) if m else -70.0

def active_rms_db(x):
    w = SR // 50; n = len(x) // w
    if n == 0: return -90
    r = np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12); db = 20 * np.log10(r)
    act = db[db > db.max() - 30]
    return float(10 * np.log10(np.mean(10 ** (act / 10))))

E = json.load(open(A.events))
voice = load(A.voice)
D = E['duration']; N = int(D * SR) + SR
V = np.zeros(N, np.float32); V[: len(voice)] = voice[:N]
vref = active_rms_db(V)
FX = np.zeros(N, np.float32)
clips = {}
def clip(key):
    if key not in clips: clips[key] = load(f'{A.sfx}/{key}.mp3')
    return clips[key]

def place(key, t, gain_db, dur=None, fade=0.03, loop=False):
    """one sound per event; gain relative to the voice's active level"""
    x = clip(key)
    if loop and dur: x = np.tile(x, int(np.ceil(dur * SR / len(x))) + 1)
    if dur: x = x[: int(dur * SR)]
    x = x * (10 ** ((vref + gain_db - active_rms_db(x)) / 20))
    f = int(fade * SR); env = np.ones(len(x), np.float32)
    if f and len(x) > 2 * f: env[:f] = np.linspace(0, 1, f); env[-f:] = np.linspace(1, 0, f)
    a = int(max(0, t) * SR); b = min(N, a + len(x)); FX[a:b] += (x * env)[: b - a]

c = E['cuts']                       # cut time for line i is c[i-1]
L = lambda i: c[i - 1]
# room tone of the office until the power dies
place('room_tone', 0, -28, dur=E['blackout'], loop=True, fade=0.4)
# rain while the guest is around
place('rain', L(7) - 0.6, -24, dur=L(12) - L(7) + 0.6, loop=True, fade=0.6)
place('rain', E['doorIn'], -17, dur=E['doorClose'] - E['doorIn'], loop=True, fade=0.3)
place('swish', E['slide'] - 0.05, -16)
place('door_shut', E['doorShut'], -11)
for s in E['stickers']:
    place('whoosh', s - 0.22, -15); place('slap', s + 0.02, -7)
place('shop_bell', E['doorIn'], -10); place('creak_open', E['doorIn'] + 0.05, -14); place('creak_close', E['doorClose'], -15)
place('steps', E['steps10'][0], -17, dur=E['steps10'][1] - E['steps10'][0], loop=True, fade=0.2)
for k in range(E['rings']):
    place('ring', E['ringStart'] + k * E['ringPeriod'], -9, dur=min(1.0, E['ringPeriod'] * 0.9))
place('tape_click', E['pick'], -8)
place('hiss', E['tapeSpan'][0] + 0.15, -27, dur=E['tapeSpan'][1] - E['tapeSpan'][0] - 0.15, loop=True, fade=0.15)
place('buzz', E['flicker'][0] - 0.1, -17)
for d in E['darkOnsets']: place('zap', d, -13)
place('glass_hit', L(18) + 0.05, -12)
place('drive_by', E['truckIn'] + 0.8, -13)
place('horn', E['steer'] - 0.35, -6, dur=1.2)
place('crash', E['hit'] - 0.03, -2)
place('shockwave', E['blackout'], -5); place('sparks', E['hit'] + 1.0, -11)
place('power_down', E['lampOut'] - 0.05, -10)
place('fire', E['hit'] + 1.2, -26, dur=D - E['hit'] - 1.2, loop=True, fade=0.8)
for k in E['knocks']: place('knock', k - 0.02, -3, dur=0.5)
place('heartbeat', E['peep'], -17, dur=D - E['peep'], loop=True, fade=0.5)
place('sting', E['capGone'] - 0.03, -6)
place('boom', E['choice'] - 0.05, -6); place('end_hit', E['end'] - 0.03, -8)

# drone bed, 13 LU under the voice, with dips before the big moments
bed = clip('bed'); bed = np.tile(bed, int(np.ceil(N / len(bed))) + 1)[:N]
bed *= 10 ** ((lufs(V) - 13 - lufs(bed[: int(60 * SR)])) / 20)
g = np.ones(N, np.float32)
def ramp(t0, t1, a, b):
    i0, i1 = int(t0 * SR), int(t1 * SR); g[i0:i1] = np.linspace(a, b, max(1, i1 - i0)); return i1
def hold(t0, t1, v): g[int(t0 * SR):int(t1 * SR)] = v
ramp(0, 1.2, 0, 1)
hold(E['hit'] - 0.05, E['hit'] + 0.4, 0.05); ramp(E['hit'] - 0.7, E['hit'] - 0.05, 1, 0.05); ramp(E['hit'] + 0.4, E['hit'] + 1.6, 0.05, 1.4)
hold(E['hit'] + 1.6, E['choice'] - 0.6, 1.4)
ramp(E['knocks'][0] - 0.8, E['knocks'][0] - 0.05, 1.4, 0.2); ramp(E['knocks'][1] + 0.3, E['knocks'][1] + 1.2, 0.2, 1.4)
ramp(E['choice'] - 0.6, E['choice'] - 0.05, 1.4, 0.05); ramp(E['choice'] + 0.2, E['choice'] + 1.0, 0.05, 1.5); hold(E['choice'] + 1.0, D - 1.5, 1.5)
ramp(D - 1.5, D, 1.5, 0)
bed *= g

mix = V + FX + bed
mix = mix[: int(D * SR)]
sf.write('/tmp/_pre.wav', np.stack([mix, mix], 1), SR)
# loudness to -14 LUFS (two-pass loudnorm), true peak -1.5
o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', '/tmp/_pre.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(o[o.rfind('{'): o.rfind('}') + 1])
af = f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', '/tmp/_pre.wav', '-af', af, '-ar', str(SR), A.out], check=True)
# linear loudnorm backs off when peaks would clip: if we are short of -14, limit the peaks and make up the gain
for _ in range(3):
    yy, _ = sf.read(A.out, dtype='float32'); cur = lufs(yy.mean(1))
    if abs(cur + 14) <= 0.5: break
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', A.out, '-af', f'volume={-14 - cur:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=false', '-ar', str(SR), '/tmp/_lim.wav'], check=True)
    subprocess.run(['cp', '/tmp/_lim.wav', A.out], check=True)

# checks: final loudness, voice-vs-bed gap, dropouts (>250 ms of near-silence inside the film)
y, _ = sf.read(A.out, dtype='float32'); y = y.mean(1)
w = SR // 100; n = len(y) // w; db = 20 * np.log10(np.sqrt(np.mean(y[: n * w].reshape(n, w) ** 2, 1)) + 1e-9)
quiet = db < -55; drops, run = [], 0
for i, q in enumerate(quiet):
    run = run + 1 if q else 0
    if run == 25 and 0.5 < i / 100 < D - 1.0: drops.append(round((i - 24) / 100, 2))
rep = {'final_lufs': lufs(y), 'voice_lufs': lufs(V), 'bed_lufs': lufs(bed[int(2 * SR): int(40 * SR)]), 'dropouts': drops}
rep['bed_under_voice_db'] = round(rep['voice_lufs'] - rep['bed_lufs'], 1)
print(json.dumps(rep, indent=1)); json.dump(rep, open(A.out.replace('.wav', '_report.json'), 'w'), indent=1)
