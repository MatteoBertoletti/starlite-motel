"""Costruisce il kit base delle copertine: PNG trasparenti disegnati in vettoriale.
    python tools/thumb_kit.py            # crea solo i file mancanti in thumbs/kit/
    python tools/thumb_kit.py --force    # rifà tutto (sovrascrive anche l'arte approvata!)

Il kit e' il punto in cui si sostituisce l'arte: se metti in thumbs/kit/ un PNG con lo stesso nome
(per esempio uno scelto fra i candidati AI di tools/thumb_art.py), i template usano quello.
"""
import argparse, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
KIT = ROOT / 'thumbs' / 'kit'
RED = '#F2202F'

DEFS = """<defs>
<filter id="glowR" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="glowY" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="8"/></filter>
</defs>"""


def grin(cid, cx, cy, w, h, n=7):
    """Bocca a mezzaluna nera con denti bianchi."""
    x0, x1 = cx - w / 2, cx + w / 2
    d = f"M {x0} {cy} C {x0 + w * .12} {cy + h}, {x1 - w * .12} {cy + h}, {x1} {cy} Z"
    tw = w / n
    teeth = ''.join(f"<rect x='{x0 + i * tw + tw * .12:.1f}' y='{cy - 2}' width='{tw * .76:.1f}' height='{h * .36:.1f}' rx='4' fill='#fff'/>" for i in range(n))
    return (f"<clipPath id='{cid}'><path d='{d}'/></clipPath><path d='{d}' fill='#0a0a0a' stroke='#000' stroke-width='6' stroke-linejoin='round'/>"
            f"<g clip-path='url(#{cid})'>{teeth}</g>")


def double_grin():
    """Il doppio: testa bianca, occhi rossi, ghigno, sciarpa rossa. 468x640, tagliato in basso."""
    cx, hy, hr, bb = 234, 260, 118, 720
    s = hr / 112.0
    g = [f"<path d='M {cx - 190 * s} {bb} C {cx - 190 * s} {hy + hr * 1.55}, {cx - 95 * s} {hy + hr * 1.12}, {cx} {hy + hr * 1.12} C {cx + 95 * s} {hy + hr * 1.12}, {cx + 190 * s} {hy + hr * 1.55}, {cx + 190 * s} {bb} Z' fill='#fff' stroke='#000' stroke-width='6'/>"]
    sy = hy + hr * 1.05
    g.append(f"<path d='M {cx - 88 * s} {sy} Q {cx} {sy + 44 * s} {cx + 88 * s} {sy} L {cx + 98 * s} {sy + 42 * s} Q {cx} {sy + 96 * s} {cx - 98 * s} {sy + 42 * s} Z' fill='{RED}' stroke='#000' stroke-width='5' stroke-linejoin='round'/>")
    g.append(f"<rect x='{cx + 14 * s}' y='{sy + 46 * s}' width='{34 * s}' height='{126 * s}' rx='{16 * s}' fill='{RED}' stroke='#000' stroke-width='5'/>")
    g.append(f"<circle cx='{cx}' cy='{hy}' r='{hr}' fill='#fff' stroke='#000' stroke-width='6'/>")
    for dx in (-50 * s, 50 * s):
        g.append(f"<ellipse cx='{cx + dx}' cy='{hy - 14 * s}' rx='{34 * s}' ry='{26 * s}' fill='{RED}' opacity='.7' filter='url(#glowR)'/>")
        g.append(f"<ellipse cx='{cx + dx}' cy='{hy - 14 * s}' rx='{27 * s}' ry='{21 * s}' fill='{RED}' stroke='#000' stroke-width='4'/>")
        g.append(f"<circle cx='{cx + dx}' cy='{hy - 14 * s}' r='{8 * s}' fill='#000'/>")
    g.append(f"<path d='M {cx - 92 * s} {hy - 62 * s} L {cx - 22 * s} {hy - 36 * s}' stroke='#000' stroke-width='{13 * s}' stroke-linecap='round'/>")
    g.append(f"<path d='M {cx + 92 * s} {hy - 62 * s} L {cx + 22 * s} {hy - 36 * s}' stroke='#000' stroke-width='{13 * s}' stroke-linecap='round'/>")
    g.append(grin('cg', cx, hy + 30 * s, 150 * s, 92 * s))
    return 468, 640, ''.join(g)


def double_red():
    """Mostro rosso per lo schermo del citofono. 320x260."""
    g = [f"<circle cx='160' cy='122' r='92' fill='{RED}' stroke='#000' stroke-width='6'/>",
         "<circle cx='126' cy='106' r='22' fill='#fff' stroke='#000' stroke-width='4'/><circle cx='194' cy='106' r='22' fill='#fff' stroke='#000' stroke-width='4'/>",
         "<circle cx='120' cy='110' r='9' fill='#000'/><circle cx='188' cy='110' r='9' fill='#000'/>",
         "<path d='M 96 68 L 144 84' stroke='#000' stroke-width='11' stroke-linecap='round'/><path d='M 224 68 L 176 84' stroke='#000' stroke-width='11' stroke-linecap='round'/>",
         grin('cr', 160, 154, 120, 78, 6),
         f"<path d='M 70 278 C 70 218, 110 208, 160 208 C 210 208, 250 218, 250 278 Z' fill='{RED}' stroke='#000' stroke-width='6'/>"]
    return 320, 260, ''.join(g)


def you_scared():
    """La figura con la sciarpa, spaventata e sudata. 420x402, tagliata in basso."""
    g = ["<path d='M 10 422 C 10 282 105 230 210 230 C 315 230 410 282 410 422 Z' fill='#fff'/>",
         "<circle cx='210' cy='112' r='104' fill='#fff'/>",
         "<circle cx='242' cy='110' r='10' fill='#000'/><circle cx='296' cy='110' r='10' fill='#000'/>",
         "<path d='M 224 82 L 256 74' stroke='#000' stroke-width='8' stroke-linecap='round'/><path d='M 282 74 L 314 82' stroke='#000' stroke-width='8' stroke-linecap='round'/>",
         "<ellipse cx='270' cy='160' rx='14' ry='9' fill='#000'/>",
         "<path d='M 122 4 C 106 34 98 48 122 66 C 146 48 138 34 122 4 Z' fill='#fff' stroke='#000' stroke-width='5'/>",
         f"<path d='M 122 210 Q 210 254 298 210 L 308 250 Q 210 300 112 250 Z' fill='{RED}' stroke='#000' stroke-width='5' stroke-linejoin='round'/>",
         f"<rect x='250' y='252' width='36' height='120' rx='17' fill='{RED}' stroke='#000' stroke-width='5'/>"]
    return 420, 402, ''.join(g)


def _hole(x, y, w, h, r):
    return (f"M {x + r} {y} H {x + w - r} A {r} {r} 0 0 1 {x + w} {y + r} V {y + h - r} A {r} {r} 0 0 1 {x + w - r} {y + h} "
            f"H {x + r} A {r} {r} 0 0 1 {x} {y + h - r} V {y + r} A {r} {r} 0 0 1 {x + r} {y} Z")


def _panel(x, y, w, h, r, hole):
    outer = _hole(x, y, w, h, r)
    return f"<path fill-rule='evenodd' d='{outer} {hole}' fill='#fff'/>"


def intercom():
    """Videocitofono da parete con lo schermo vuoto (trasparente). 400x464."""
    g = [_panel(0, 0, 400, 464, 52, _hole(40, 46, 320, 260, 28)),
         "<circle cx='368' cy='30' r='12' fill='#FFC21F' opacity='.9' filter='url(#glowY)'/><circle cx='368' cy='30' r='8' fill='#FFC21F'/>"]
    for row, y in enumerate((354, 386)):
        g.append(''.join(f"<circle cx='{110 + 35 * i}' cy='{y}' r='8' fill='#000'/>" for i in range(5)))
    g.append(f"<circle cx='330' cy='404' r='30' fill='{RED}' opacity='.6' filter='url(#glowR)'/><circle cx='330' cy='404' r='30' fill='#000'/><circle cx='330' cy='404' r='22' fill='{RED}'/>")
    return 400, 464, ''.join(g)


def videophone():
    """Videocitofono con cornetta, schermo vuoto (trasparente). 1010x520."""
    g = [_panel(220, 10, 790, 500, 72, _hole(266, 56, 540, 330, 40)),
         "<path d='M 164 348 q 14 -30 28 0 t 28 0' fill='none' stroke='#fff' stroke-width='9' stroke-linecap='round'/>",
         "<rect x='82' y='72' width='82' height='300' rx='38' fill='#fff'/><rect x='62' y='56' width='122' height='104' rx='44' fill='#fff'/><rect x='62' y='286' width='122' height='104' rx='44' fill='#fff'/>",
         "<g fill='#000'><circle cx='123' cy='108' r='9'/><circle cx='98' cy='108' r='6'/><circle cx='148' cy='108' r='6'/><circle cx='123' cy='340' r='9'/></g>",
         "<circle cx='905' cy='108' r='34' fill='#000'/><circle cx='905' cy='108' r='22' fill='#1b2433'/><circle cx='896' cy='99' r='7' fill='#fff'/>",
         "<g fill='#000'>" + ''.join(f"<circle cx='{x}' cy='{y}' r='8'/>" for y in (192, 226) for x in (868, 905, 942)) + "</g>",
         f"<circle cx='905' cy='360' r='46' fill='{RED}' opacity='.6' filter='url(#glowR)'/><circle cx='905' cy='360' r='48' fill='#000'/><circle cx='905' cy='360' r='35' fill='{RED}'/>"]
    return 1010, 520, ''.join(g)


ASSETS = {'double_grin': double_grin, 'double_red': double_red, 'you_scared': you_scared,
          'intercom': intercom, 'videophone': videophone}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true', help='sovrascrive anche i file esistenti')
    ap.add_argument('--only', default='', help='un solo asset')
    A = ap.parse_args()
    KIT.mkdir(parents=True, exist_ok=True)
    todo = [n for n in ASSETS if (not A.only or n == A.only) and (A.force or not (KIT / f'{n}.png').exists())]
    if not todo:
        print('kit gia completo (usa --force per rifarlo)'); return
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name in todo:
            w, h, inner = ASSETS[name]()
            html = (f"<html><body style='margin:0;background:transparent'><svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' "
                    f"viewBox='0 0 {w} {h}'>{DEFS}{inner}</svg></body></html>")
            pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
            pg.set_content(html)
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(KIT / f'{name}.png'), omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
            print('ok', name, f'{w * 2}x{h * 2}')
        b.close()


if __name__ == '__main__':
    main()
