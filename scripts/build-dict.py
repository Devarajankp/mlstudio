"""Build compact, sharded dictionary indexes from the Olam English-Malayalam CSV (ODbL data).
EN->ML shards by first 2 chars of headword; ML->EN is an inverted index sharded by first 2 code points."""
import csv, json, os, re, shutil, sys, unicodedata
from collections import defaultdict
SRC='/home/claude/work/refs/kiranps_English-Malayalam-Dictionary/repo/olam-enml.csv'
OUT='public/dict'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(f'{OUT}/en'); os.makedirs(f'{OUT}/ml')

CHILLU=[('ണ്‍','ൺ'),('ന്‍','ൻ'),('ര്‍','ർ'),('ല്‍','ൽ'),('ള്‍','ൾ'),('ക്‍','ൿ')]
def norm_ml(s):
    for a,b in CHILLU: s=s.replace(a,b)
    s=s.replace('‌','') if False else s
    return re.sub(r'\s+',' ',s).strip()

en=defaultdict(list); disp={}
ml_idx=defaultdict(dict)   # ml key -> {(english,pos): rank}
n=0
with open(SRC,encoding='utf-8') as f:
    for line in f:
        if line.startswith('#') or not line.strip(): continue
        p=line.rstrip('\n').split('\t')
        if len(p)<4: continue
        _id,word,pos,ml=p[0],re.sub(r'\s+',' ',p[1]).strip(),p[2].strip(),norm_ml(p[3])
        if not word or not ml: continue
        n+=1
        k=word.lower()
        disp.setdefault(k,word)
        en[k].append([pos if pos!='-' else '',ml])
        # inverted index
        toks=[t for t in re.split(r'[\s,;:/()\[\]"“”.!?]+',ml) if len(t)>=2]
        ntok=len(toks)
        if ntok==0 or ntok>6: continue
        rank=0 if ntok==1 else (1 if ntok<=3 else 2)
        whole=ml
        keys={whole:0} if ntok<=3 else {}
        for t in toks: keys.setdefault(t, rank if ntok==1 else min(rank+1,2))
        for key,r in keys.items():
            d=ml_idx[key]; kk=(disp[k],pos if pos!='-' else '')
            if kk not in d or d[kk]>r: d[kk]=r
print('entries read:',n,'| english headwords:',len(en),'| malayalam keys:',len(ml_idx))

def ekey(k):
    c=[ch for ch in k[:2]]
    s=''.join(ch if re.match(r'[a-z0-9]',ch) else '_' for ch in c)
    return s
shards=defaultdict(list)
for k in sorted(en): shards[ekey(k)].append([disp[k],en[k]])
man={'en':{},'ml':{},'entries':n}
for s,items in shards.items():
    json.dump(items,open(f'{OUT}/en/{s}.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    man['en'][s]=len(items)

def mkey(k): return ''.join(f'{ord(c):04x}' for c in k[:2])
mshards=defaultdict(list)
for key in sorted(ml_idx):
    res=sorted(ml_idx[key].items(), key=lambda kv:(kv[1],kv[0][0].lower()))[:40]
    mshards[mkey(key)].append([key,[[e,p,r] for (e,p),r in res]])
for s,items in mshards.items():
    json.dump(items,open(f'{OUT}/ml/{s}.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    man['ml'][s]=len(items)
json.dump(man,open(f'{OUT}/manifest.json','w'),separators=(',',':'))
open(f'{OUT}/ATTRIBUTION.txt','w',encoding='utf-8').write(
"Dictionary data: Olam English-Malayalam Dictionary dataset (https://olam.in/open/enml/), licensed under the\n"
"Open Database License (ODbL) 1.0. Data obtained via https://github.com/kiranps/English-Malayalam-Dictionary (MIT).\n"
"The files in this folder are a re-indexed derivative (sharded EN->ML and an inverted ML->EN index) and remain under ODbL:\n"
"if you publicly redistribute them you must keep this attribution and share them under the same license.\n")
tot=sum(os.path.getsize(os.path.join(dp,f)) for dp,_,fs in os.walk(OUT) for f in fs)
print('en shards:',len(man['en']),'| ml shards:',len(man['ml']),'| total MB: %.1f'%(tot/1e6))
big=sorted(((os.path.getsize(f'{OUT}/en/{s}.json'),s) for s in man['en']),reverse=True)[:3]
print('largest en shards:',big)
