"""ElevenLabs narration for a motion-graphics episode.
One request per line (with the neighbouring lines as context), cached by text+voice+model so a re-run
never pays twice. Then: trim in real silence -> door/intercom fx -> faster-whisper word times ->
lay the lines on one timeline -> episodes/<ep>/timing.json + out/voice/voice.wav
usage: python tools/voice_el.py episodes/ep01_citofono voices.json cache_dir
"""
import json, os, re, sys, hashlib, subprocess, unicodedata, urllib.request, urllib.error, difflib
import numpy as np, soundfile as sf

EP, VOICES, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]
OUT = 'out/voice'; os.makedirs(f'{OUT}/lines', exist_ok=True); os.makedirs(CACHE, exist_ok=True)
S = json.load(open(f'{EP}/script.json')); V = json.load(open(VOICES))
KEY = os.environ['ELEVENLABS_API_KEY'].strip(); SR = 48000
MODELS = [V.get('model', 'eleven_v4'), 'eleven_multilingual_v2']
missing = sorted({L['who'] for L in S['lines'] if L['who'] != 'YOU'} - set(V['ids']))
if missing: sys.exit(f'voices/it.json has no voice for {missing}: run the prep workflow with cast=true first')
SETTINGS = {'N': dict(stability=0.55, similarity_boost=0.85, style=0.3, use_speaker_boost=True, speed=0.95),
            'ADMIN': dict(stability=0.5, similarity_boost=0.8, style=0.2, use_speaker_boost=True, speed=0.95),
            'BRUNI': dict(stability=0.45, similarity_boost=0.8, style=0.35, use_speaker_boost=True, speed=0.9),
            'YOU': dict(stability=0.4, similarity_boost=0.85, style=0.45, use_speaker_boost=True, speed=1.0),
            'MAMMA': dict(stability=0.5, similarity_boost=0.85, style=0.35, use_speaker_boost=True, speed=0.95)}
if 'speed_N' in S: SETTINGS['N']['speed'] = S['speed_N']

def tts(text, vid, who, prev, nxt):
    for model in MODELS:
        body = {'text': text, 'model_id': model, 'voice_settings': SETTINGS[who]}
        if model != 'eleven_multilingual_v2': body['language_code'] = 'it'
        for ctx in (True, False):
            b = dict(body, **({'previous_text': prev, 'next_text': nxt} if ctx else {}))
            key = hashlib.sha1(json.dumps([text, vid, model, SETTINGS[who], ctx and prev, ctx and nxt]).encode()).hexdigest()[:16]
            fn = f'{CACHE}/{key}.mp3'
            if os.path.exists(fn): return fn, model, True
            r = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192', method='POST',
                                       headers={'xi-api-key': KEY, 'Content-Type': 'application/json'}, data=json.dumps(b).encode())
            try:
                with urllib.request.urlopen(r, timeout=180) as f: open(fn, 'wb').write(f.read())
                return fn, model, False
            except urllib.error.HTTPError as e:
                msg = e.read().decode()[:300]; print('  tts error', model, 'ctx' if ctx else 'noctx', e.code, msg)
                if e.code in (401, 402, 429) and 'quota' in msg: sys.exit('out of credits')
    raise SystemExit(f'TTS failed for: {text}')

def ff(args): subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + args, check=True)
def trim(x, thr_db=-48, pad=0.03):
    w = int(SR * 0.01); n = len(x) // w
    db = 20 * np.log10(np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, 1)) + 1e-12)
    on = np.where(db > max(thr_db, db.max() - 45))[0]
    return x[max(0, on[0] * w - int(pad * SR)): min(len(x), (on[-1] + 1) * w + int(2 * pad * SR))]

# ---------- Italian normalisation (script and transcript go through the same function) ----------
UN = 'zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove'.split()
TE = 'zero dieci venti trenta quaranta cinquanta sessanta settanta ottanta novanta'.split()
def n2w(n):
    n = int(n)
    if n < 20: return UN[n]
    if n < 100: t, u = TE[n // 10], n % 10; return t if u == 0 else (t[:-1] if u in (1, 8) else t) + UN[u]
    if n < 1000: h = '' if n // 100 == 1 else UN[n // 100]; return h + 'cento' + ('' if n % 100 == 0 else n2w(n % 100))
    if n < 2000: return 'mille' + ('' if n % 1000 == 0 else n2w(n % 1000))
    return ' '.join(UN[int(d)] for d in str(n))
def norm(text):
    t = ''.join(ch for ch in unicodedata.normalize('NFD', text.lower().replace('’', "'")) if unicodedata.category(ch) != 'Mn')
    t = re.sub(r'(\d{1,2})[:.](\d\d)', lambda m: ' ' + ('mezzanotte' if int(m.group(1)) == 0 else n2w(m.group(1))) + ' ' + n2w(m.group(2)) + ' ', t)
    t = re.sub(r'\d+', lambda m: ' ' + n2w(m.group(0)) + ' ', t)
    t = re.sub(r"['\-]", ' ', t); t = re.sub(r'[^a-z ]', ' ', t)
    return t.split()

from faster_whisper import WhisperModel
wm = WhisperModel('small', device='cpu', compute_type='int8')
def heard_words(path, prompt):
    segs, _ = wm.transcribe(path, word_timestamps=True, language='it', initial_prompt=prompt, beam_size=5)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
def align(toks, heard):
    ht = []
    for w, a, b in heard:
        tt = norm(w) or ['_']
        for i, x in enumerate(tt): ht.append((x, a + (b - a) * i / len(tt), a + (b - a) * (i + 1) / len(tt)))
    sm = difflib.SequenceMatcher(a=toks, b=[x for x, _, _ in ht], autojunk=False); times = [None] * len(toks)
    for bl in sm.get_matching_blocks():
        for k in range(bl.size): times[bl.a + k] = ht[bl.b + k][1:]
    known = [i for i, x in enumerate(times) if x]
    for i in range(len(times)):
        if times[i] is None:
            p = max([k for k in known if k < i], default=None); n = min([k for k in known if k > i], default=None)
            a = times[p][1] if p is not None else (times[n][0] - 0.25 if n is not None else 0); b = times[n][0] if n is not None else a + 0.3
            times[i] = (a, b)
    return times, sum(x is not None for x in [times[i] for i in known]) / max(1, len(toks))

FX = {'phone': 'highpass=f=320,lowpass=f=3400,acompressor=threshold=0.12:ratio=5,aecho=0.5:0.3:12:0.15,volume=1.5',
      'door': 'highpass=f=110,lowpass=f=1000,aecho=0.8:0.55:38|61:0.3|0.2,volume=1.9',
      'intercom': 'highpass=f=380,lowpass=f=3100,acrusher=bits=10:mix=0.25,aecho=0.6:0.4:18:0.2,volume=1.6'}

lines = S['lines']; tl, t, rep, used, cached = [], S['start_pad'], [], 0, 0
for i, L in enumerate(lines):
    who = L['who']; role = S['voices'].get(who, {}); vid = V['ids'][role.get('same_as', who) if who == 'YOU' else who]
    prev = ' '.join(x['say'] for x in lines[max(0, i - 2):i] if x['who'] == who)[-400:] or None
    nxt = ' '.join(x['say'] for x in lines[i + 1:i + 2] if x['who'] == who)[:300] or None
    fn, model, hit = tts(L['say'], vid, who, prev, nxt); cached += hit; used += 0 if hit else len(L['say'])
    clean = f"{OUT}/lines/{L['id']:02d}_clean.wav"; ff(['-i', fn, '-ar', str(SR), '-ac', '1', clean])
    y, _ = sf.read(clean, dtype='float32'); y = trim(y); sf.write(clean, y, SR)
    final = f"{OUT}/lines/{L['id']:02d}.wav"
    if role.get('fx'): ff(['-i', clean, '-af', FX[role['fx']] + ',apad=pad_dur=0.25', final])
    else: ff(['-i', clean, '-c', 'copy', final])
    toks = norm(L['say']); hw = heard_words(clean, L['say']); tt, score = align(toks, hw)
    if score < 0.5:        # transcript unusable (whisper can hallucinate on short lines): spread the words over the voiced part
        yy, _ = sf.read(clean, dtype='float32'); a0, a1 = 0.03, len(yy) / SR - 0.05
        wts = [max(1, len(re.findall(r'[aeiou]', w))) for w in toks]; tot = sum(wts); acc = a0
        tt = []
        for w in wts: d = (a1 - a0) * w / tot; tt.append((acc, acc + d)); acc += d
    dur = sf.info(final).duration
    tl.append({'id': L['id'], 'who': who, 'model': model, 'start': round(t, 3), 'end': round(t + dur, 3), 'dur': round(dur, 3), 'file': final,
               'tokens': [{'w': w, 's': round(t + a, 3), 'e': round(t + b, 3)} for w, (a, b) in zip(toks, tt)], 'match': round(score, 2),
               'heard': ' '.join(w for w, _, _ in hw)})
    rep.append(f"{L['id']:3d} {who:6s} {t:7.2f}-{t + dur:7.2f} match={score:.2f} {model}{' (cache)' if hit else ''} | {' '.join(w for w, _, _ in hw)}")
    print(rep[-1], flush=True)
    t += dur + L.get('gap', S['default_gap'])
total = t - S['default_gap'] + S['end_pad']
mix = np.zeros(int(total * SR) + SR, np.float32)
for l in tl: y, _ = sf.read(l['file'], dtype='float32'); a = int(l['start'] * SR); mix[a:a + len(y)] += y
sf.write(f'{OUT}/voice.wav', mix, SR)
json.dump({'duration': round(total, 3), 'lines': tl}, open(f'{EP}/timing.json', 'w'), indent=1, ensure_ascii=False)
low = [l['id'] for l in tl if l['match'] < 0.8]
open(f'{OUT}/report.txt', 'w').write('\n'.join(rep) + f"\n\nTOTAL {total:.1f}s  new characters billed ~{used}  cached lines {cached}\nlow match lines: {low}\n")
print(f'TOTAL {total:.1f}s, new chars {used}, cached {cached}, low-match {low}')
