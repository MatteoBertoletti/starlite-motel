"""Write the YouTube title / description (with chapters) / tags of an episode to episodes/<ep>/youtube.md.
Chapters come from timing.json once the episode is narrated; before that they are estimated (and marked so).
    python tools/describe.py episodes/ep02_mamma"""
import json, os, subprocess, sys
ep = sys.argv[1]; S = json.load(open(f'{ep}/script.json')); Y = S['youtube']
fmt = lambda s: f'{int(s // 60)}:{int(s % 60):02d}'
if Y.get('short'):                      # Shorts: title, two lines, five tags, real length from timing.json
    dur = json.load(open(f'{ep}/timing.json'))['duration'] if os.path.exists(f'{ep}/timing.json') else None
    tags = ', '.join(Y['tags'])
    md = [f"# {Y['title']}", '', f"**Titolo:** {len(Y['title'])} caratteri" + (f" · **Durata reale:** {dur:.1f} s (da timing.json)" if dur else ''), '']
    if Y.get('publish'): md += [f"**Pubblicazione:** {Y['publish']}", '']
    md += ['## Descrizione', '', '```', *Y['intro'], Y['question'], '```', '', f"## Tag ({len(Y['tags'])} tag, {len(tags)} caratteri)", '', '```', tags, '```', '']
    if Y.get('pinned'): md += ['## Commento fissato', '', '```', Y['pinned'], '```', '']
    open(f'{ep}/youtube.md', 'w').write('\n'.join(md)); print('\n'.join(md)); sys.exit()
if os.path.exists(f'{ep}/timing.json'):
    T = {l['id']: l for l in json.load(open(f'{ep}/timing.json'))['lines']}; start = {i: (0 if i == 1 else T[i]['start']) for i in T}; est = False
else:
    out = subprocess.run([sys.executable, 'tools/estimate.py', ep], capture_output=True, text=True).stdout
    start = {}; est = True
    rows = [l.strip() for l in out.split('chapters:')[1].splitlines() if l.strip()]
    for (lid, _), r in zip(S['chapters'], rows): m, s = r.split()[0].split(':'); start[lid] = int(m) * 60 + int(s)
chap = [f"{fmt(start[lid])} {name}" for lid, name in S['chapters']]
tags = ', '.join(Y['tags'])
head = [f"# {Y['title']}", '']
if Y.get('title_alt'): head += [f"**Titolo alternativo:** {Y['title_alt']}", '']
if Y.get('publish'): head += [f"**Pubblicazione:** {Y['publish']}", '']
chap_block = ['CAPITOLI' + ('  (stimati: si aggiornano da soli dopo la narrazione)' if est else ''), *chap, '']
fact = [Y['fact_title'], Y['fact'], Y['fact_source'], '']
if Y.get('question_last'):            # the description ends with the question for the comments
    body = [*Y['intro'], '', *chap_block, *fact, *Y['outro'], '', Y['question']]
    if Y.get('hashtags'): body += ['', Y['hashtags']]
else:
    body = [*Y['intro'], '', Y['question'], '', *chap_block, *fact, *Y['outro']]
lim = Y.get('tag_limit', 500)
if Y.get('title_chars'): head.insert(2, f"**Titolo:** {len(Y['title'])} caratteri"); head.insert(3, '')
md = [*head, '## Descrizione', '', '```', *body, '```', '', f"## Tag ({len(Y['tags'])} tag, {len(tags)} caratteri su {lim})", '', '```', tags, '```', '']
if Y.get('pinned'): md += ['## Commento fissato', '', '```', Y['pinned'], '```', '']
assert len(tags) <= lim, f'tags too long: {len(tags)}'
open(f'{ep}/youtube.md', 'w').write('\n'.join(md)); print('\n'.join(md))
