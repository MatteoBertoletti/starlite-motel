"""Compone le copertine di un episodio a partire da episodes/<ep>/thumbs.json.
    python tools/thumb.py --ep ep01_citofono                # tutte le varianti
    python tools/thumb.py --ep ep01_citofono --only 2_rosso_freccia

Ogni variante sceglie un template (thumbs/templates/<nome>.html), i testi e usa l'arte di thumbs/kit/.
Uscita: out/thumbs/<ep>/<id>.jpg (sotto i 2 MB, pronta per YouTube) e <id>.png.
I font sono quelli del video (@fontsource, installati da npm ci). Per provare senza npm: --fonts <cartella>.
"""
import argparse, html, json, os, pathlib, re, sys
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIT_JS = """() => { document.querySelectorAll('text[data-fit]').forEach(t => {
  const target = parseFloat(t.dataset.fit); const w = t.getBBox().width;
  if (w > 0) t.setAttribute('font-size', parseFloat(t.getAttribute('font-size')) * target / w); }); }"""


def build_html(template: pathlib.Path, text: dict, kit: pathlib.Path, fonts: pathlib.Path) -> str:
    src = template.read_text()
    vals = {k: html.escape(str(v)) for k, v in text.items()}
    vals['KIT'] = kit.resolve().as_uri()
    vals['FONTS'] = fonts.resolve().as_uri()
    missing = sorted(set(re.findall(r'{{(\w+)}}', src)) - set(vals))
    if missing:
        raise SystemExit(f'{template.name}: mancano i testi {missing}')
    return re.sub(r'{{(\w+)}}', lambda m: vals[m.group(1)], src)


def check_kit(html_src: str, kit: pathlib.Path):
    for name in sorted(set(re.findall(r'/(\w+)\.png', html_src))):
        if not (kit / f'{name}.png').exists():
            raise SystemExit(f'manca thumbs/kit/{name}.png: lancia  python tools/thumb_kit.py')


def save_jpg(png: pathlib.Path, jpg: pathlib.Path, q: int, max_kb: int):
    im = Image.open(png).convert('RGB')
    while True:
        im.save(jpg, quality=q, subsampling=0)
        if jpg.stat().st_size <= max_kb * 1024 or q <= 60: break
        q -= 5
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ep', required=True, help='cartella in episodes/')
    ap.add_argument('--spec', default='', help='file thumbs.json alternativo')
    ap.add_argument('--only', default='', help='id di una sola variante')
    ap.add_argument('--out', default=str(ROOT / 'out' / 'thumbs'))
    ap.add_argument('--kit', default=str(ROOT / 'thumbs' / 'kit'))
    ap.add_argument('--fonts', default=os.environ.get('THUMB_FONTS', str(ROOT / 'node_modules' / '@fontsource')))
    A = ap.parse_args()

    styles = json.load(open(ROOT / 'thumbs' / 'styles.json'))
    cv = styles['canvas']
    spec_path = pathlib.Path(A.spec) if A.spec else ROOT / 'episodes' / A.ep / 'thumbs.json'
    spec = json.load(open(spec_path))
    out = pathlib.Path(A.out) / A.ep
    out.mkdir(parents=True, exist_ok=True)
    kit, fonts = pathlib.Path(A.kit), pathlib.Path(A.fonts)
    if not (fonts / 'montserrat').exists():
        raise SystemExit(f'font non trovati in {fonts}: lancia npm ci oppure passa --fonts')

    variants = [v for v in spec['variants'] if not A.only or v['id'] == A.only]
    if not variants: raise SystemExit('nessuna variante trovata')
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--allow-file-access-from-files'])
        for v in variants:
            tpl = ROOT / 'thumbs' / 'templates' / f"{v['template']}.html"
            src = build_html(tpl, v['text'], kit, fonts)
            check_kit(src, kit)
            page_file = out / f"_{v['id']}.html"
            page_file.write_text(src)
            pg = b.new_page(viewport={'width': cv['w'], 'height': cv['h']})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('requestfailed', lambda r: errs.append('richiesta fallita: ' + r.url))
            pg.goto(page_file.as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(500)
            pg.evaluate(FIT_JS); pg.wait_for_timeout(250)
            png = out / f"{v['id']}.png"
            pg.screenshot(path=str(png), clip={'x': 0, 'y': 0, 'width': cv['w'], 'height': cv['h']})
            jpg = out / f"{v['id']}.jpg"
            q = save_jpg(png, jpg, cv['jpg_quality'], cv['max_kb'])
            page_file.unlink()
            print(f"ok {v['id']:<18} {jpg.stat().st_size // 1024:>4} KB (q{q})" + (f"  ATTENZIONE: {errs}" if errs else ''))
        b.close()


if __name__ == '__main__':
    main()
