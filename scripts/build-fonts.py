"""Builds the bundled font set. ONLY open-licensed (SIL OFL 1.1) fonts are allowed here.
Sources (download once, then run this script):
  SMC fonts   https://github.com/smc/font-installer/tree/main/src-tauri/resources/fonts
  Anek        https://github.com/EkType/Anek/tree/main/fonts/AnekMalayalam/variable
  Baloo Chettan 2  https://github.com/google/fonts/tree/main/ofl/baloochettan2
Usage: python3 scripts/build-fonts.py <folder containing the .ttf/.otf files>
"""
import os, sys, json, glob
from fontTools.ttLib import TTFont

SRC = sys.argv[1]
OUT = 'public/fonts/open'
os.makedirs(OUT, exist_ok=True)

# file -> (family, label, weight, listed in the font menu?)
FONTS = {
  'Meera-Regular.ttf': ('Meera', 'Meera', 400, True),
  'Rachana-Regular.ttf': ('Rachana', 'Rachana', 400, True),
  'Karumbi-Regular.ttf': ('Karumbi', 'Karumbi', 400, True),
  'Keraleeyam-Regular.ttf': ('Keraleeyam', 'Keraleeyam', 400, True),
  'Dyuthi-Regular.ttf': ('Dyuthi', 'Dyuthi', 400, True),
  'AnjaliOldLipi-Regular.ttf': ('Anjali Old Lipi', 'Anjali Old Lipi', 400, True),
  'Uroob-Regular.ttf': ('Uroob', 'Uroob', 400, True),
  'AnekMalayalam[wdth,wght].ttf': ('Anek Malayalam', 'Anek Malayalam', '100 800', True),
  'BalooChettan2[wght].ttf': ('Baloo Chettan 2', 'Baloo Chettan 2', '400 800', True),
  # full versions, used only by the Windows font installer (the menu uses the web subsets with a bold face)
  'Chilanka-Regular.ttf': ('Chilanka', 'Chilanka', 400, False),
  'Manjari-Regular.otf': ('Manjari', 'Manjari', 400, False),
  'Gayathri-Regular.otf': ('Gayathri', 'Gayathri', 400, False),
}
manifest = json.load(open('src/data/fonts.json'))
manifest = [m for m in manifest if m['series'] == 'unicode']   # legacy (ML-TT/MLW-TT) families are never bundled
manifest = [m for m in manifest if not m.get('open')]
credits = []
for fn, (fam, label, wt, listed) in FONTS.items():
    p = [os.path.join(d, fn) for d, _, fs in os.walk(SRC) if fn in fs]
    if not p: print('MISSING', fn); continue
    t = TTFont(p[0]); name = t['name']
    out = fn.split('[')[0].replace('.ttf','').replace('.otf','') + '.woff2'
    t.flavor = 'woff2'; t.save(os.path.join(OUT, out))
    credits.append((label, (name.getDebugName(0) or '').replace('\n', ' ')))
    if listed:
        manifest.append({'family': fam, 'label': label, 'series': 'unicode', 'open': True, 'faces': [{'file': 'open/' + out, 'weight': wt, 'style': 'normal'}]})
json.dump(manifest, open('src/data/fonts.json', 'w'), ensure_ascii=False, indent=1)
json.dump(credits, open('/tmp/font-credits.json', 'w'), ensure_ascii=False, indent=1)  # copy the notices into public/fonts/FONTS_LICENSE.txt by hand
print('families in menu:', len(manifest), '| files:', len(os.listdir(OUT)))
