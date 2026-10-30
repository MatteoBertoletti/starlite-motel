"""Fix the cast explicitly: narrator + administration by id, Mrs Bruni found in the library (older Italian woman).
Adds them to my voices, writes voices/it.json and one short test line per role to out/el/."""
import os, json, urllib.request, urllib.parse, urllib.error
KEY = os.environ['ELEVENLABS_API_KEY'].strip(); API = 'https://api.elevenlabs.io'; OUT = 'out/el'; os.makedirs(OUT, exist_ok=True)
def req(m, p, body=None, raw=False):
    r = urllib.request.Request(API + p, method=m, headers={'xi-api-key': KEY, 'Content-Type': 'application/json'}, data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(r, timeout=120) as f: d = f.read()
    return d if raw else json.loads(d)
CAST = {'N': ('crp9JXf4ooIgqN7mGOp9', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6', 'Narratore IT - Dade M Suspense'),
        'ADMIN': ('wNIMZNAVa95a3UpgwWJr', 'e4f6ac0358f5a9ca829d701e94543521955a46a76c7b99d7b8ad3b45b546de1f', 'Amministrazione IT - Giulio')}
fem = []
for q in [dict(language='it', gender='female', age='old'), dict(language='it', gender='female', age='middle_aged', use_cases='narrative_story')]:
    try: fem += req('GET', '/v1/shared-voices?' + urllib.parse.urlencode({**q, 'page_size': 50})).get('voices', [])
    except urllib.error.HTTPError as e: print('search', e.code, e.read().decode()[:200])
fem = [v for v in fem if v.get('accent') in ('standard', 'italian', None) or 'ital' in str(v.get('accent'))]
fem.sort(key=lambda v: ((v.get('age') == 'old') * 2, v.get('usage_character_count_1y') or 0), reverse=True)
for v in fem[:8]: print('F', v['name'], v.get('age'), v.get('accent'), v.get('descriptive'), v.get('usage_character_count_1y'))
if fem: CAST['BRUNI'] = (fem[0]['voice_id'], fem[0]['public_owner_id'], 'Signora Bruni IT - ' + fem[0]['name'][:20])
mine = {v['voice_id'] for v in req('GET', '/v2/voices?page_size=100').get('voices', [])}
ids = {}
for role, (vid, owner, name) in CAST.items():
    if vid not in mine:
        try: vid = req('POST', f'/v1/voices/add/{owner}/{vid}', {'new_name': name}).get('voice_id', vid)
        except urllib.error.HTTPError as e: print('add', role, e.code, e.read().decode()[:200])
    ids[role] = vid
ids['YOU'] = ids['N']
TEST = {'N': 'Immagina: sono le ventitré e quaranta, e hai appena preso le chiavi di casa nuova.',
        'ADMIN': 'Buonasera. Amministrazione del condominio. C\'è una perdita d\'acqua, dobbiamo controllare.', 'BRUNI': 'Bravo. Hai letto il biglietto.'}
for role, text in TEST.items():
    if role not in ids: continue
    a = req('POST', f'/v1/text-to-speech/{ids[role]}?output_format=mp3_44100_192', {'text': text, 'model_id': 'eleven_v4', 'language_code': 'it',
            'voice_settings': {'stability': 0.55, 'similarity_boost': 0.85, 'style': 0.3, 'use_speaker_boost': True}}, raw=True)
    open(f'{OUT}/test_{role}.mp3', 'wb').write(a)
names = {r: CAST[r][2] for r in CAST}
json.dump({'ids': ids, 'roles': names, 'model': 'eleven_v4'}, open(f'{OUT}/voices.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'ids': ids, 'roles': names}, indent=1, ensure_ascii=False))
