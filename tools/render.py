"""Step window.seek(t) through every frame and pipe them into ffmpeg.
python tools/render.py --from 0 --to 300 --out out/seg_00.mp4 [--fps 30] [--scale 1]
Frames are numbered globally (frame n = time n/fps), so shards concatenate exactly.
"""
import argparse, asyncio, base64, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--from', dest='f0', type=int, default=0); ap.add_argument('--to', dest='f1', type=int, default=-1)
ap.add_argument('--fps', type=int, default=30); ap.add_argument('--out', required=True)
ap.add_argument('--scale', type=float, default=1.0); ap.add_argument('--events', default='')
ap.add_argument('--root', default=os.getcwd()); ap.add_argument('--port', type=int, default=8765)
ap.add_argument('--qs', default='', help='extra query, e.g. lang=it&aspect=169')
ap.add_argument('--page', default='film.html')
A = ap.parse_args()

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(A.port), '--bind', '127.0.0.1'], cwd=A.root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'])
            pg = await b.new_page(viewport={'width': 1920, 'height': 1920})
            pg.on('pageerror', lambda e: print('[pageerror]', e, flush=True))
            await pg.goto(f'http://127.0.0.1:{A.port}/{A.page}?scale={A.scale}' + ('&' + A.qs if A.qs else ''))
            await pg.wait_for_function('window.ready === true', timeout=300000)
            ev = await pg.evaluate('window.EVENTS')
            if A.events: json.dump(ev, open(A.events, 'w'), indent=1)
            n_total = int(ev['duration'] * A.fps)
            f1 = n_total if A.f1 < 0 else min(A.f1, n_total)
            print(f'frames {A.f0}..{f1} of {n_total}', flush=True)
            if A.f0 >= f1: return
            enc = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', str(A.fps), '-c:v', 'mjpeg', '-i', '-',
                                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', str(A.fps), A.out], stdin=subprocess.PIPE)
            t0 = time.time()
            for n in range(A.f0, f1):
                url = await pg.evaluate(f'(() => {{ window.seek({n / A.fps}); return document.getElementById("film").toDataURL("image/jpeg", 0.96); }})()')
                enc.stdin.write(base64.b64decode(url.split(',', 1)[1]))
                if (n - A.f0) % 30 == 0: print(f'  frame {n}  {(time.time() - t0) / max(1, n - A.f0 + 1):.2f}s/f', flush=True)
            enc.stdin.close(); enc.wait()
            await b.close()
    finally:
        srv.terminate()

asyncio.run(main())
