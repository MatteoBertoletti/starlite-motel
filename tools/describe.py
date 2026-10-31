"""Write the YouTube title / description (with chapters) / tags of an episode to episodes/<ep>/youtube.md.
Chapters come from timing.json once the episode is narrated; before that they are estimated (and marked so).
    python tools/describe.py episodes/ep02_mamma"""
import json, os, subprocess, sys
ep = sys.argv[1]; S = json.load(open(f'{ep}/script.json')); Y = S['youtube']
fmt = lambda s: f'{int(s // 60)}:{int(s % 60):02d}'
if os.path.exists(f'{ep}/timing.json'):
    T = {l['id']: l for l in json.load(open(f'{ep}/timing.json'))['lines']}; start = {i: (0 if i == 1 else T[i]['start'] - 0.1) for i in T}; est = False
else:
    out = subprocess.run([sys.executable, 'tools/estimate.py', ep], capture_output=True, text=True).stdout
    start = {}; est = True
    rows = [l.strip() for l in out.split('chapters:')[1].splitlines() if l.strip()]
    for (lid, _), r in zip(S['chapters'], rows): m, s = r.split()[0].split(':'); start[lid] = int(m) * 60 + int(s)
chap = [f"{fmt(start[lid])} {name}" for lid, name in S['chapters']]
tags = ', '.join(Y['tags'])
md = [f"# {Y['title']}", '', f"**Titolo alternativo:** {Y['title_alt']}", '', '## Descrizione', '', '```', *Y['intro'], '', Y['question'], '',
      'CAPITOLI' + ('  (stimati: si aggiornano da soli dopo la narrazione)' if est else ''), *chap, '', Y['fact_title'], Y['fact'], Y['fact_source'], '', *Y['outro'], '```', '',
      f"## Tag ({len(tags)} caratteri su 500)", '', '```', tags, '```', '']
open(f'{ep}/youtube.md', 'w').write('\n'.join(md)); print('\n'.join(md))
