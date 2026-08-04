import re, sys, zlib
raw=open(sys.argv[1],'rb').read()
mb=re.search(rb'/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', raw)
H=float(mb.group(4)); W=float(mb.group(3)); pt2mm=25.4/72
rects=[]
for m in re.finditer(rb'stream\r?\n(.*?)endstream', raw, re.S):
    try: d=zlib.decompress(m.group(1))
    except Exception: continue
    for r in re.finditer(rb'([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re\b', d):
        x,y,w,h=(float(g) for g in r.groups())
        rects.append((x,y,w,h))
# a horizontal rule / shaded bar: wide, short, and not the page background
cand=[r for r in rects if r[2] > W*0.5 and r[3] < 40 and not (r[3] > H*0.9)]
cand.sort(key=lambda r: -(r[1]+r[3]))
print(f'{len(rects)} rects, {len(cand)} wide-and-short')
print(' top(mm)  height(mm)  width(mm)   x(mm)')
for x,y,w,h in cand[:6]:
    print(f'{(H-(y+h))*pt2mm:8.2f} {h*pt2mm:10.2f} {w*pt2mm:10.2f} {x*pt2mm:8.2f}')
