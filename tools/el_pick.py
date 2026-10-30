"""Pick a deep, middle-aged Italian male narrator from the ElevenLabs voice library.
Uses the free preview clips to measure pitch (no credits), adds the winner to the library,
then renders one test line with two models. Output -> out/el/
"""
import os, json, sys, subprocess, urllib.request, urllib.parse
import numpy as np

KEY = os.environ['ELEVENLABS_API_KEY']; API = 'https://api.elevenlabs.io'
OUT = 'out/el'; os.makedirs(OUT, exist_ok=True)
def req(method, path, body=None, raw=False):
    r = urllib.request.Request(API + path, method=method, headers={'xi-api-key': KEY, 'Content-Type': 'application/json'},
                               data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(r, timeout=120) as f: d = f.read()
    return d if raw else json.loads(d)

def decode(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True)
    return np.frombuffer(p.stdout, np.float32)

def f0_median(x, sr=16000):
    """median pitch of voiced 40 ms frames by autocorrelation (60-300 Hz)"""
    w = int(0.04 * sr); hop = w // 2; f0s = []
    for i in range(0, len(x) - w, hop):
        fr = x[i:i + w] * np.hanning(w)
        if np.sqrt(np.mean(fr ** 2)) < 0.02: continue
        ac = np.correlate(fr, fr, 'full')[w - 1:]
        lo, hi = int(sr / 300), int(sr / 60)
        k = lo + np.argmax(ac[lo:hi])
        if ac[k] / (ac[0] + 1e-9) > 0.45: f0s.append(sr / k)
    return float(np.median(f0s)) if len(f0s) > 20 else None

log = {}
cands = {}
for q in [dict(language='it', gender='male', age='middle_aged'), dict(language='it', gender='male', age='old'),
          dict(language='it', gender='male', use_cases='narrative_story'), dict(language='it', gender='male', search='profonda')]:
    try:
        d = req('GET', '/v1/shared-voices?' + urllib.parse.urlencode({**q, 'page_size': 60}))
    except Exception as e:
        print('query failed', q, e); continue
    vs = d.get('voices', [])
    if vs and 'first_voice_raw' not in log: log['first_voice_raw'] = vs[0]
    for v in vs: cands.setdefault(v['voice_id'], {**v, '_q': q})
print('candidates', len(cands))

rows = []
for vid, v in list(cands.items())[:80]:
    url = v.get('preview_url')
    if not url: continue
    try:
        fn = f'{OUT}/prev_{vid}.mp3'; urllib.request.urlretrieve(url, fn)
        f0 = f0_median(decode(fn))
    except Exception as e:
        f0 = None
    rows.append({'voice_id': vid, 'owner': v.get('public_owner_id'), 'name': v.get('name'), 'age': v.get('age'), 'gender': v.get('gender'),
                 'accent': v.get('accent'), 'language': v.get('language'), 'descr': v.get('descriptive'), 'use_case': v.get('use_case'),
                 'usage_1y': v.get('usage_character_count_1y') or 0, 'cloned_by': v.get('cloned_by_count') or 0, 'f0': f0,
                 'description': (v.get('description') or '')[:160]})
rows = [r for r in rows if r['f0']]
json.dump(rows, open(f'{OUT}/candidates.json', 'w'), indent=1, ensure_ascii=False)

# score: deep (low f0), middle-aged/old, popular (proxy for quality), narrative/deep descriptors
def score(r):
    s = -abs(r['f0'] - 95) / 10                             # ~95 Hz = deep adult male
    s += 1.5 if r['age'] in ('middle_aged', 'old') else 0
    s += 1.0 if any(k in (str(r['descr']) + str(r['use_case']) + r['description']).lower() for k in ('deep', 'narrat', 'profond', 'calm', 'grave', 'story')) else 0
    s += 0.6 * np.log10(1 + r['usage_1y']) / 3 + 0.4 * np.log10(1 + r['cloned_by']) / 2
    return s
rows.sort(key=score, reverse=True)
for r in rows[:15]: print(f"{score(r):5.2f}  f0={r['f0']:6.1f}  {r['name'][:28]:28s} {r['age']} {r['accent']} {r['descr']} {r['use_case']} usage={r['usage_1y']}")
win = rows[0]; log['winner'] = win; log['top'] = rows[:6]

# add the winner to my library so the TTS endpoint can use it
try:
    mine = req('GET', '/v2/voices?page_size=100')
    have = {v['voice_id'] for v in mine.get('voices', [])}
    if win['voice_id'] not in have:
        r = req('POST', f"/v1/voices/add/{win['owner']}/{win['voice_id']}", {'new_name': 'Narratore IT (profondo)'})
        log['added'] = r
    use_id = log.get('added', {}).get('voice_id', win['voice_id'])
except Exception as e:
    print('add failed', e); use_id = win['voice_id']; log['add_error'] = str(e)
log['use_voice_id'] = use_id

line = "Immagina di aver appena firmato il contratto. Sono le ventitré e quaranta, ed è la tua prima notte in via dei Glicini nove."
for model in ['eleven_v4', 'eleven_multilingual_v2']:
    body = {'text': line, 'model_id': model, 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.25, 'use_speaker_boost': True}}
    if model != 'eleven_multilingual_v2': body['language_code'] = 'it'
    try:
        audio = req('POST', f'/v1/text-to-speech/{use_id}?output_format=mp3_44100_192', body, raw=True)
        open(f'{OUT}/test_{model}.mp3', 'wb').write(audio); log[f'ok_{model}'] = True
    except Exception as e:
        log[f'err_{model}'] = str(e); print('tts failed', model, e)
json.dump(log, open(f'{OUT}/pick.json', 'w'), indent=1, ensure_ascii=False, default=str)
print(json.dumps({k: log[k] for k in log if k != 'first_voice_raw' and k != 'top'}, indent=1, ensure_ascii=False, default=str)[:3000])
