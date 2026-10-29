import asyncio, base64, sys, json, subprocess, time, os
from playwright.async_api import async_playwright
ROOT = '/home/claude/starlite-motel'
times = [float(x) for x in sys.argv[1].split(',')]
outdir = sys.argv[2] if len(sys.argv) > 2 else f'{ROOT}/stills'
os.makedirs(outdir, exist_ok=True)
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await b.new_page(viewport={'width': 1080, 'height': 1920})
            pg.on('console', lambda m: print('[console]', m.type, m.text) if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: print('[pageerror]', e))
            await pg.goto('http://127.0.0.1:8765/film.html' + os.environ.get('QS',''))
            await pg.wait_for_function('window.ready === true', timeout=180000)
            print('shots', await pg.evaluate('JSON.stringify(window.SHOTS)'))
            for t in times:
                t0 = time.time()
                url = await pg.evaluate(f'(()=>{{window.seek({t}); return document.getElementById("film").toDataURL("image/png");}})()')
                fn = f'{outdir}/t{t:06.2f}.png'
                open(fn, 'wb').write(base64.b64decode(url.split(',')[1]))
                print(fn, f'{time.time()-t0:.1f}s')
            if os.environ.get('DUMP'):
                for name in ('you','guest','owner'):
                    u = await pg.evaluate(f'window.CAST.{name}.cv.toDataURL()')
                    open(f'{outdir}/tex_{name}.png','wb').write(base64.b64decode(u.split(',')[1]))
            await b.close()
    finally:
        srv.terminate()
asyncio.run(main())
