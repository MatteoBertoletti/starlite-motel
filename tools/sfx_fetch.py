"""Free sound effects + a tension bed from Mixkit (Mixkit License). Never synthesized.
  --probe : scrape category pages, list every (title, mp3 url) found -> out/audio/mixkit_catalog.json
  --get   : download the picks listed in story/sfx.json -> out/audio/sfx/<key>.mp3
"""
import json, re, sys, os, html, urllib.request, time

OUT = 'out/audio'; os.makedirs(f'{OUT}/sfx', exist_ok=True); os.makedirs(f'{OUT}/pages', exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36'}
def get(url):
    for k in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        except Exception as e: err = e; time.sleep(2)
    raise err

PAGES = {s: f'https://mixkit.co/free-sound-effects/{s}/' for s in
         ['doors', 'wood', 'bell', 'doorbell', 'phone', 'telephone', 'rain', 'thunder', 'storm', 'electricity', 'electric', 'spark',
          'crash', 'car', 'truck', 'horn', 'brakes', 'tires', 'skid', 'explosion', 'impact', 'hit', 'whoosh', 'transition',
          'footsteps', 'walk', 'hum', 'buzz', 'scary', 'horror', 'suspense', 'cinematic', 'glitch', 'tape', 'cassette', 'beep',
          'button', 'click', 'switch', 'fire', 'metal', 'heartbeat', 'drone', 'wind', 'night', 'ambience', 'cars', 'traffic']}
MUSIC = {s: f'https://mixkit.co/free-stock-music/tag/{s}/' for s in ['suspense', 'horror', 'dark', 'thriller', 'ambient', 'scary', 'cinematic', 'mystery', 'tension', 'drone']}

def scrape(url, name):
    try: h = get(url).decode('utf-8', 'replace')
    except Exception as e: print('fail', url, e); return []
    open(f'{OUT}/pages/{name}.html', 'w').write(h)
    found = []
    for m in re.finditer(r'https://assets\.mixkit\.co/[^"\'\s<>]+?\.(?:mp3|wav)', h):
        u = m.group(0); win = h[max(0, m.start() - 4000): m.end() + 1500]
        titles = re.findall(r'<h2[^>]*>\s*([^<]{3,80}?)\s*</h2>', win) or re.findall(r'title="([^"]{3,80})"', win)
        # nearest title before the url
        found.append({'url': u, 'title': html.unescape(titles[-1]) if titles else '', 'page': name})
    print(name, len(found))
    return found

if '--probe' in sys.argv:
    cat = []
    for k, u in PAGES.items(): cat += scrape(u, 'sfx_' + k)
    for k, u in MUSIC.items(): cat += scrape(u, 'music_' + k)
    seen, uniq = set(), []
    for c in cat:
        if c['url'] not in seen: seen.add(c['url']); uniq.append(c)
    json.dump(uniq, open(f'{OUT}/mixkit_catalog.json', 'w'), indent=1)
    print('unique', len(uniq))

if '--get' in sys.argv:
    picks = json.load(open('story/sfx.json'))
    for key, p in picks.items():
        dst = f'{OUT}/sfx/{key}.mp3'
        if not os.path.exists(dst): open(dst, 'wb').write(get(p['url'])); print('got', key, p.get('title', ''))
