"""Genera candidati di arte per il kit delle copertine con Kie.ai (immagine -> immagine, con riferimento).
    KIE_API_KEY=...  python tools/thumb_art.py --asset double_grin --n 4
    python tools/thumb_art.py --asset double_grin --dry-run        # stampa prompt e richiesta, non chiama l'API

Risultati in out/art/<asset>/:  01.png ...  (originali)   01_cut.png ... (sfondo magenta tolto)   sheet.jpg (riepilogo)
Si sceglie a mano il migliore e lo si copia in thumbs/kit/<asset>.png: i template lo usano subito.

La chiave NON va mai nel codice ne' nel repo (e' pubblico): nei workflow e' il secret KIE_AI_API.
API: https://docs.kie.ai/  (createTask -> recordInfo; ogni risposta e' HTTP 200, il vero esito e' nel campo "code").
"""
import argparse, io, json, os, pathlib, sys, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = os.environ.get('KIE_BASE', 'https://api.kie.ai')


class KieError(RuntimeError):
    pass


def call(method, path, key, body=None, timeout=60):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            j = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise KieError(f'HTTP {e.code} su {path}: {e.read().decode(errors="replace")[:300]}')
    if j.get('code') != 200:
        raise KieError(f"{path}: code={j.get('code')} msg={j.get('msg')}")
    return j['data']


def build_request(styles, asset, model, ref_base):
    ai = styles['ai']
    a = ai['assets'][asset]
    m = ai['models'][model]
    refs = [f'{ref_base}/{r}.png' for r in a.get('refs', [])]
    guide = 'Use the reference image as the design guide for the character: same proportions, same flat vector look. ' if refs else ''
    prompt = f"{guide}{ai['style_prompt']} {a['prompt']} {ai['background']} Avoid: {ai['negative']}."
    inp = {'prompt': prompt, 'aspect_ratio': a['aspect_ratio'], **m.get('input', {})}
    if refs: inp[m['ref_field']] = refs
    return {'model': model, 'input': inp}


def create_task(key, body):
    return call('POST', '/api/v1/jobs/createTask', key, body)['taskId']


def wait_task(key, task_id, every=4.0, limit=420.0):
    t0 = time.time()
    while True:
        d = call('GET', f'/api/v1/jobs/recordInfo?taskId={task_id}', key)
        st = d.get('state')
        if st == 'success':
            urls = json.loads(d.get('resultJson') or '{}').get('resultUrls') or []
            if not urls: raise KieError(f'{task_id}: riuscito ma senza immagini')
            return urls[0], d.get('creditsConsumed')
        if st == 'fail':
            raise KieError(f"{task_id}: fallito ({d.get('failCode')}) {d.get('failMsg')}")
        if time.time() - t0 > limit:
            raise KieError(f'{task_id}: nessun risultato dopo {int(limit)} secondi (stato {st})')
        time.sleep(every)


def download(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'thumb-art'}), timeout=120) as r:
        return r.read()


def cutout(im, key=(255, 0, 255), lo=70, hi=170):
    """Toglie lo sfondo magenta piatto (chroma key) e smorza il bordo magenta."""
    from PIL import Image
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            d = ((r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2) ** .5
            if d < lo: px[x, y] = (r, g, b, 0)
            elif d < hi:
                k = (d - lo) / (hi - lo)
                spill = min(r, b) - g          # quanto magenta rimane nel bordo
                if spill > 0: r, b = r - int(spill * (1 - k)), b - int(spill * (1 - k))
                px[x, y] = (max(r, 0), g, max(b, 0), int(255 * k))
    return im


def sheet(paths, out):
    from PIL import Image
    ims = [Image.open(p).convert('RGBA') for p in paths]
    h = 360
    ims = [i.resize((max(1, int(i.width * h / i.height)), h)) for i in ims]
    W = Image.new('RGB', (sum(i.width for i in ims) + 10 * (len(ims) + 1), h + 20), (70, 70, 70))
    x = 10
    for i in ims:
        W.paste(i, (x, 10), i); x += i.width + 10
    W.save(out, quality=90)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--asset', required=True)
    ap.add_argument('--n', type=int, default=2, help='quanti candidati')
    ap.add_argument('--model', default='')
    ap.add_argument('--out', default=str(ROOT / 'out' / 'art'))
    ap.add_argument('--ref-base', default='', help='URL pubblico della cartella del kit (di default raw.githubusercontent.com del repo)')
    ap.add_argument('--no-cut', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    A = ap.parse_args()

    styles = json.load(open(ROOT / 'thumbs' / 'styles.json'))
    model = A.model or styles['ai']['default_model']
    if A.asset not in styles['ai']['assets']: sys.exit(f"asset sconosciuto: {A.asset} (disponibili: {', '.join(styles['ai']['assets'])})")
    if model not in styles['ai']['models']: sys.exit(f"modello non configurato in thumbs/styles.json: {model}")
    repo, ref = os.environ.get('GITHUB_REPOSITORY', 'MatteoBertoletti/starlite-motel'), os.environ.get('GITHUB_REF_NAME', 'main')
    ref_base = A.ref_base or f'https://raw.githubusercontent.com/{repo}/{ref}/thumbs/kit'
    body = build_request(styles, A.asset, model, ref_base)
    if A.dry_run:
        print(json.dumps(body, indent=1, ensure_ascii=False)); return

    key = os.environ.get('KIE_API_KEY', '').strip()
    if not key: sys.exit('manca KIE_API_KEY (nel workflow arriva dal secret KIE_AI_API)')
    out = pathlib.Path(A.out) / A.asset
    out.mkdir(parents=True, exist_ok=True)
    ids = []
    for i in range(A.n):
        ids.append(create_task(key, body)); print(f'creato {i + 1}/{A.n}: {ids[-1]}', flush=True)
        time.sleep(0.6)                                  # il limite e' 20 richieste ogni 10 secondi
    saved, spent = [], 0
    for i, tid in enumerate(ids, 1):
        try:
            url, credits = wait_task(key, tid)
        except KieError as e:
            print('ERRORE', e); continue
        spent += credits or 0
        raw = out / f'{i:02d}.png'
        data = download(url)
        from PIL import Image
        Image.open(io.BytesIO(data)).convert('RGBA').save(raw)
        print(f'ok {raw.name}  ({credits} crediti)', flush=True)
        saved.append(raw)
        if not A.no_cut:
            cut = out / f'{i:02d}_cut.png'
            cutout(Image.open(raw)).save(cut); saved.append(cut)
    if saved: sheet([p for p in saved if p.name.endswith('_cut.png')] or saved, out / 'sheet.jpg')
    print(f'candidati: {len([s for s in saved if not s.name.endswith("_cut.png")])}/{A.n}  crediti usati: {spent}  cartella: {out}')
    if not saved: sys.exit(1)


if __name__ == '__main__':
    main()
