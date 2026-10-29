import sys, glob
from PIL import Image, ImageDraw
files = sys.argv[2:]; out = sys.argv[1]
w, h = 360, 640
cols = 3; rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), 'black')
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    S.paste(im, ((i % cols) * w, (i // cols) * h))
    ImageDraw.Draw(S).text(((i % cols) * w + 8, (i // cols) * h + 620), f.split('/')[-1], fill='yellow')
S.save(out)
