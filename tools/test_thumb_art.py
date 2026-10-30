"""Prova senza rete e senza chiave: avvia un finto server Kie.ai e controlla che thumb_art.py
crei i task, aspetti lo stato 'success', legga resultJson (stringa JSON), scarichi l'immagine e tolga lo sfondo magenta.
    python tools/test_thumb_art.py
"""
import io, json, os, pathlib, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE = {'created': [], 'polls': {}, 'bodies': []}


def fake_png():
    im = Image.new('RGB', (200, 160), (255, 0, 255))
    ImageDraw.Draw(im).ellipse((50, 30, 150, 130), fill=(240, 240, 240))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _json(self, obj):
        raw = json.dumps(obj).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)

    def do_POST(self):
        assert self.headers.get('Authorization') == 'Bearer TESTKEY', 'header Authorization sbagliato'
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        STATE['bodies'].append(body)
        tid = f'task_{len(STATE["created"]) + 1}'
        STATE['created'].append(tid)
        self._json({'code': 200, 'msg': 'success', 'data': {'taskId': tid}})

    def do_GET(self):
        if self.path.startswith('/img.png'):
            raw = fake_png()
            self.send_response(200); self.send_header('Content-Type', 'image/png'); self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw); return
        tid = self.path.split('taskId=')[1]
        n = STATE['polls'][tid] = STATE['polls'].get(tid, 0) + 1
        if tid == 'task_2':                                   # il secondo task fallisce: lo script deve andare avanti
            self._json({'code': 200, 'msg': 'success', 'data': {'taskId': tid, 'state': 'fail', 'failCode': '500', 'failMsg': 'boom'}}); return
        if n < 3:
            self._json({'code': 200, 'msg': 'success', 'data': {'taskId': tid, 'state': 'generating' if n > 1 else 'waiting'}}); return
        res = json.dumps({'resultUrls': [f'http://127.0.0.1:{self.server.server_port}/img.png']})   # stringa dentro il JSON, come l'API vera
        self._json({'code': 200, 'msg': 'success', 'data': {'taskId': tid, 'state': 'success', 'resultJson': res, 'creditsConsumed': 7}})


def main():
    srv = HTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = tempfile.mkdtemp()
    env = dict(os.environ, KIE_BASE=f'http://127.0.0.1:{srv.server_port}', KIE_API_KEY='TESTKEY')
    code = "import sys, runpy, time; time.sleep = lambda s: None; sys.argv = ['thumb_art.py', '--asset', 'double_grin', '--n', '3', '--out', %r]; runpy.run_path(%r, run_name='__main__')" % (out, str(ROOT / 'tools' / 'thumb_art.py'))
    r = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True, timeout=120)
    print(r.stdout.strip()); print(r.stderr.strip()[-400:])
    d = pathlib.Path(out) / 'double_grin'
    files = sorted(p.name for p in d.iterdir())
    assert r.returncode == 0, 'lo script doveva riuscire con 2 task su 3'
    assert files == ['01.png', '01_cut.png', '03.png', '03_cut.png', 'sheet.jpg'], files
    assert len(STATE['bodies']) == 3
    b = STATE['bodies'][0]
    assert b['model'] == 'nano-banana-2' and b['input']['aspect_ratio'] == '3:4' and b['input']['image_input'][0].endswith('/thumbs/kit/double_grin.png'), b
    cut = Image.open(d / '01_cut.png')
    assert cut.getpixel((2, 2))[3] == 0 and cut.getpixel((100, 80))[3] == 255, 'chroma key non corretto'
    print('TEST OK: creazione, polling (waiting -> generating -> success), resultJson, fallimento isolato, download, chroma key')


if __name__ == '__main__':
    main()
