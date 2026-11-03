"""Estimate an episode's timeline before narration, calibrated on a narrated episode
(seconds of speech per character, per speaker). Prints word rate, scare/voice targets, chapters.
    python tools/estimate.py episodes/ep02_mamma [--ref episodes/ep01_citofono]"""
import json, sys, re
ep = sys.argv[1]; ref = sys.argv[sys.argv.index('--ref') + 1] if '--ref' in sys.argv else 'episodes/ep01_citofono'
S = json.load(open(f'{ep}/script.json')); RS = json.load(open(f'{ref}/script.json')); RT = json.load(open(f'{ref}/timing.json'))
rate = {}
for L, T in zip(RS['lines'], RT['lines']): rate.setdefault(L['who'], []).append(T['dur'] / max(1, len(L['say'])))
avg = lambda w: sum(rate.get(w, rate['N'])) / len(rate.get(w, rate['N']))
cps_n = avg('N')
speed = RS.get('speed_N', 0.95) / S.get('speed_N', 0.95)   # narrator speed relative to the reference episode
def timeline(S, speed):
    t = S['start_pad']; rows = []
    for L in S['lines']:
        who = L['who']; d = len(L['say']) * (avg(who) if who in rate else cps_n * (1.15 if who == 'MAMMA' else 1.0)) * (speed if who in ('N', 'YOU', 'NAV') else 1) + 0.25
        rows.append((L['id'], who, t, t + d)); t += d + L.get('gap', S['default_gap'])
    return rows, t - S['default_gap'] + S['end_pad']
_, ref_est = timeline(RS, 1.0); K = RT['duration'] / ref_est          # calibrate: the reference must reproduce its real length
rows, total = timeline(S, speed); rows = [(i, w, a * K, b * K) for i, w, a, b in rows]; total *= K
if False:
  for L in S['lines']:
    pass
words = sum(len(L['say'].split()) for L in S['lines'])
fmt = lambda s: f'{int(s // 60)}:{int(s % 60):02d}'
print(f'lines {len(rows)}  words {words}  chars {sum(len(L["say"]) for L in S["lines"])}  est. duration {fmt(total)} ({total:.0f}s)  wpm {words / (total / 60):.0f}')
first_m = next((r for r in rows if r[1] == 'MAMMA'), None); print('first MAMMA line at', fmt(first_m[2]) if first_m else '-')
scares = [r for r, L in zip(rows, S['lines']) if L.get('gap', 0) >= 1.2]; print('scares (lines with a 1.2s+ silence after):', [(r[0], fmt(r[3])) for r in scares])
cold = [r for r in rows if r[0] <= 4]; print('cold open ends', fmt(cold[-1][3]))
if S.get('chapters'):
    print('chapters:'); start = {r[0]: r[2] for r in rows}
    for lid, name in S['chapters']: print(f"  {fmt(0 if lid == 1 else start[lid] - 0.1)} {name}")
