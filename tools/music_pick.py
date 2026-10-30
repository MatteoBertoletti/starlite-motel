"""Download candidate background tracks (Mixkit, no vocals) and measure what makes a bed annoying:
loudness swings, sharp transients, harsh 2-6 kHz energy, busy high end. Writes out/music/report.json + spectrograms."""
import json, os, subprocess, urllib.request, re
import numpy as np
OUT = 'out/music'; os.makedirs(OUT, exist_ok=True)
C = {  # id: title (all instrumental genres on Mixkit: drone / atmospheres / film score)
    612: 'Selpan (old bed)', 188: 'Echoes', 565: 'Fallen (Asper)', 564: 'Goats', 633: 'Xanthos', 890: 'Unforgiven',
    605: 'Delirium', 671: 'Piano Horror', 614: 'Silent Descent', 597: 'Vertigo', 871: 'Fright Night', 571: 'Voxscape',
    593: 'Opalescent', 570: 'Sonor #2', 584: 'Rest Now', 563: 'Red Lights Adhafera', 548: 'A Voice from The Past'}
SR = 22050
def load(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True)
    return np.frombuffer(r.stdout, np.float32)
def ebur(p):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', o); L = re.findall(r'LRA:\s+([\d.]+) LU', o)
    return float(I[-1]), float(L[-1])
rep = []
for i, title in C.items():
    fn = f'{OUT}/{i}.mp3'
    if not os.path.exists(fn):
        try: urllib.request.urlretrieve(f'https://assets.mixkit.co/music/{i}/{i}.mp3', fn)
        except Exception as e: print('fail', i, e); continue
    x = load(fn); x = x[: SR * 120]
    I, LRA = ebur(fn)
    n = 2048; fr = len(x) // n
    X = np.abs(np.fft.rfft(x[: fr * n].reshape(fr, n) * np.hanning(n), axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR); tot = X.sum(1) + 1e-12
    cent = float(np.median((X * f).sum(1) / tot))
    harsh = float(np.median(X[:, (f > 2000) & (f < 6000)].sum(1) / tot))
    low = float(np.median(X[:, f < 250].sum(1) / tot))
    e = 10 * np.log10(np.convolve(x ** 2, np.ones(int(SR * 0.02)) / int(SR * 0.02), 'valid')[:: int(SR * 0.01)] + 1e-10)
    onsets = int(np.sum(np.diff(e) > 9))                       # sudden +9 dB jumps in 10 ms = hits / percussion
    peak = float(20 * np.log10(np.max(np.abs(x)) + 1e-9)); rms = float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9))
    rep.append({'id': i, 'title': title, 'lufs': I, 'lra': LRA, 'centroid_hz': round(cent), 'harsh_2_6k': round(harsh, 4), 'low_250': round(low, 3),
                'onsets_per_min': round(onsets / (len(x) / SR / 60), 1), 'crest_db': round(peak - rms, 1)})
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-t', '90', '-i', fn, '-lavfi', 'showspectrumpic=s=800x300:legend=0:scale=log', f'{OUT}/spec_{i}.png'])
# calm bed = steady (low LRA), few hits, not harsh, a warm low end
for r in rep: r['score'] = round(-r['lra'] / 4 - r['onsets_per_min'] / 6 - r['harsh_2_6k'] * 40 + r['low_250'] * 2 - abs(r['centroid_hz'] - 700) / 800, 2)
rep.sort(key=lambda r: -r['score'])
json.dump(rep, open(f'{OUT}/report.json', 'w'), indent=1)
for r in rep: print(r)
