"""Narration: Kokoro TTS one line at a time -> trim in real silence -> faster-whisper word times
-> align to the script -> lay the lines on one timeline -> voice.wav + timing.json.

Every caption is snapped to the real start of the word it is anchored to.
Usage: python tools/voice.py story/script.json out/audio
"""
import json, re, sys, subprocess, difflib, os
import numpy as np, soundfile as sf

SR = 48000
SCRIPT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(f'{OUT}/lines', exist_ok=True)
S = json.load(open(SCRIPT))

# ---------- number / text normalisation (script and transcript go through the same function) ----------
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
def n2w(n):
    n = int(n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    return ' '.join(ONES[int(d)] for d in str(n))
IT_UN = 'zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove'.split()
IT_TE = 'zero dieci venti trenta quaranta cinquanta sessanta settanta ottanta novanta'.split()
def n2w_it(n):
    n = int(n)
    if n < 20: return IT_UN[n]
    if n < 100:
        t, u = IT_TE[n // 10], n % 10
        if u == 0: return t
        if u in (1, 8): t = t[:-1]
        return t + IT_UN[u]
    return ' '.join(IT_UN[int(d)] for d in str(n))
LANG = S.get('lang', 'en')
def strip_acc(t):
    import unicodedata
    return ''.join(ch for ch in unicodedata.normalize('NFD', t) if unicodedata.category(ch) != 'Mn')
def norm(text):
    if LANG == 'it': return norm_it(text)
    return norm_en(text)
def norm_it(text):
    t = strip_acc(text.lower().replace('’', "'"))
    t = re.sub(r'(\d{1,2})[:.](\d\d)', lambda m: ' ' + ('mezzanotte' if int(m.group(1)) == 0 else n2w_it(m.group(1))) + ' ' + n2w_it(m.group(2)) + ' ', t)
    t = re.sub(r'\d+', lambda m: ' ' + n2w_it(m.group(0)) + ' ', t)
    t = t.replace('-', ' ').replace("'", '')
    t = re.sub(r'[^a-z ]', ' ', t)
    return [w for w in t.split() if w != 'e' or True]
def norm_en(text):
    t = text.lower().replace('’', "'")
    t = re.sub(r'(\d+):(\d\d)', lambda m: f' {n2w(m.group(1))} ' + ('' if m.group(2) == '00' else (f'oh {n2w(m.group(2)[1])}' if m.group(2)[0] == '0' else n2w(m.group(2)))) + ' ', t)
    t = re.sub(r'\b([ap])\.?\s?m\b\.?', r' \1 m ', t)
    t = re.sub(r'\d+', lambda m: ' ' + n2w(m.group(0)) + ' ', t)
    t = t.replace('-', ' ').replace("'", '')
    t = re.sub(r'[^a-z ]', ' ', t)
    return t.split()

# ---------- TTS ----------
from kokoro import KPipeline
pipes = {}
def tts(text, v):
    if v['lang'] not in pipes: pipes[v['lang']] = KPipeline(lang_code=v['lang'])
    chunks = [a for _, _, a in pipes[v['lang']](text, voice=v['voice'], speed=v['speed'])]
    return np.concatenate([np.asarray(c, dtype=np.float32) for c in chunks]), 24000

def ff(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + args, check=True)

def trim(x, sr, thr_db=-46, pad=0.03):
    """cut only in real silence: first/last 10 ms window above threshold, plus a small pad"""
    w = int(sr * 0.01); n = len(x) // w
    rms = np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12)
    on = np.where(20 * np.log10(rms) > thr_db)[0]
    a = max(0, on[0] * w - int(pad * sr)); b = min(len(x), (on[-1] + 1) * w + int(pad * 2 * sr))
    return x[a:b]

from faster_whisper import WhisperModel
wm = WhisperModel('small.en' if LANG == 'en' else 'small', device='cpu', compute_type='int8')
def words(path, prompt):
    segs, _ = wm.transcribe(path, word_timestamps=True, language=LANG, initial_prompt=prompt, beam_size=5, vad_filter=False)
    out = []
    for s in segs:
        for w in s.words: out.append((w.word.strip(), w.start, w.end))
    return out

def align(script_tokens, heard):
    """heard: [(word, start, end)] -> per script token (start, end). Multi-token words split their span evenly."""
    ht = []
    for w, a, b in heard:
        toks = norm(w) or ['_']
        for i, t in enumerate(toks):
            ht.append((t, a + (b - a) * i / len(toks), a + (b - a) * (i + 1) / len(toks)))
    sm = difflib.SequenceMatcher(a=script_tokens, b=[t for t, _, _ in ht], autojunk=False)
    times = [None] * len(script_tokens)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size): times[blk.a + k] = ht[blk.b + k][1:]
    matched = sum(t is not None for t in times)
    # fill gaps by interpolation between neighbours
    known = [i for i, t in enumerate(times) if t]
    for i in range(len(times)):
        if times[i] is None:
            prv = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
            a = times[prv][1] if prv is not None else (times[nxt][0] - 0.25 if nxt is not None else 0)
            b = times[nxt][0] if nxt is not None else a + 0.3
            times[i] = (a, b)
    return times, matched / max(1, len(script_tokens))

FX = {
    # the clerk's own voice on an answering-machine tape
    'tape': 'highpass=f=320,lowpass=f=3200,acompressor=threshold=0.1:ratio=6,aecho=0.6:0.5:25:0.25,volume=1.4',
    # behind a closed door: muffled, a little room
    'door': 'highpass=f=110,lowpass=f=950,aecho=0.8:0.55:38|61:0.32|0.2,volume=1.9',
}

timeline, t, report = [], S['start_pad'], []
for L in S['lines']:
    v = S['voices'][L['who']]
    x, sr = tts(L['say'], v)
    raw = f"{OUT}/lines/{L['id']:02d}_raw.wav"; sf.write(raw, x, sr)
    # resample to 48k, then trim in silence
    clean = f"{OUT}/lines/{L['id']:02d}_clean.wav"; ff(['-i', raw, '-ar', str(SR), '-ac', '1', clean])
    y, _ = sf.read(clean, dtype='float32'); y = trim(y, SR); sf.write(clean, y, SR)
    final = f"{OUT}/lines/{L['id']:02d}.wav"
    if v.get('pitch'):
        pr = v['pitch']; ff(['-i', clean, '-af', f'asetrate={int(SR * pr)},aresample={SR},atempo={1 / pr:.4f}', clean + '.p.wav']); os.replace(clean + '.p.wav', clean)
    if v.get('fx'): ff(['-i', clean, '-af', FX[v['fx']] + ',apad=pad_dur=0.25', final])
    else: ff(['-i', clean, '-c', 'copy', final])
    # re-transcribe the final line (fx lines: transcribe the clean take, fx keeps timing)
    heard = words(clean if v.get('fx') else final, L['say'])
    toks = norm(L['say'])
    tt, score = align(toks, heard)
    dur = sf.info(final).duration
    # captions: anchor word -> its real start
    # snap each caption to the real onset of its word in the final audio (whisper starts are often early)
    yf, _ = sf.read(final, dtype='float32'); w10 = SR // 100
    env = 20 * np.log10(np.sqrt(np.convolve(yf ** 2, np.ones(w10) / w10, mode='same')) + 1e-9); thr = env.max() - 32
    def onset(a):
        i0 = max(0, int((a - 0.06) * SR)); i1 = min(len(env), int((a + 0.45) * SR))
        hit = np.where(env[i0:i1] > thr)[0]
        return (i0 + hit[0]) / SR if len(hit) else a
    caps, k = [], 0
    for anchor, text in L['caps']:
        j = toks.index(anchor, k) if anchor in toks[k:] else k
        caps.append({'text': text, 't': round(t + onset(tt[j][0]), 3), 'tok': j}); k = j + 1
    timeline.append({'id': L['id'], 'who': L['who'], 'say': L['say'], 'file': final, 'start': round(t, 3), 'dur': round(dur, 3),
                     'end': round(t + dur, 3), 'tokens': [{'w': w, 's': round(t + a, 3), 'e': round(t + b, 3)} for w, (a, b) in zip(toks, tt)],
                     'caps': caps, 'heard': ' '.join(w for w, _, _ in heard), 'match': round(score, 2)})
    report.append(f"{L['id']:2d} {L['who']:5s} {t:6.2f}-{t+dur:6.2f}  match={score:.2f}  heard: {' '.join(w for w,_,_ in heard)}")
    t += dur + L.get('gap', S['default_gap'])

total = t - S['default_gap'] + S['end_pad']
# caption end = next caption start (or line end + small hold)
allcaps = [c for l in timeline for c in l['caps']]
for i, c in enumerate(allcaps):
    nxt = allcaps[i + 1]['t'] if i + 1 < len(allcaps) else total
    c['end'] = round(min(nxt, c['t'] + 2.6), 3)

# ---------- lay the voice on one track ----------
mix = np.zeros(int(total * SR) + SR, dtype=np.float32)
for l in timeline:
    y, _ = sf.read(l['file'], dtype='float32'); a = int(l['start'] * SR); mix[a:a + len(y)] += y
sf.write(f'{OUT}/voice.wav', mix, SR)

# ---------- check: every caption has voice under it within ~120 ms ----------
def active(tm):
    a = int(tm * SR); seg = mix[a:a + int(0.12 * SR)]
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
bad = [(c['text'], float(c['t']), float(round(active(c['t']), 1))) for c in allcaps if active(c['t']) < -40]
json.dump({'duration': round(total, 3), 'lines': timeline, 'captions': allcaps, 'caption_check_failures': bad}, open(f'{OUT}/timing.json', 'w'), indent=1)
open(f'{OUT}/report.txt', 'w').write('\n'.join(report) + f'\n\nTOTAL {total:.2f}s\ncaption failures: {bad}\n')
print('\n'.join(report)); print('TOTAL', round(total, 2), 'caption failures', bad)
