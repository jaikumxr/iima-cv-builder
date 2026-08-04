import re, sys, zlib
raw=open(sys.argv[1],'rb').read()
mb=re.search(rb'/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', raw)
H=float(mb.group(4)); pt2mm=25.4/72
TOK=re.compile(rb'BT|ET'
               rb'|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm'
               rb'|([-\d.]+)\s+([-\d.]+)\s+Td'
               rb'|/([A-Za-z0-9]+)\s+([\d.]+)\s+Tf'
               rb'|\(((?:\.|[^\()])*)\)\s*Tj'
               rb'|\[(.*?)\]\s*TJ', re.S)
rows=[]
for m0 in re.finditer(rb'stream\r?\n(.*?)endstream', raw, re.S):
    try: d=zlib.decompress(m0.group(1))
    except Exception: continue
    if b'Tf' not in d: continue
    y=0.0; size=0.0
    for m in TOK.finditer(d):
        if m.group(1) is not None: y=float(m.group(6))
        elif m.group(7) is not None: y+=float(m.group(8))
        elif m.group(9) is not None: size=float(m.group(10))
        elif m.group(11) is not None:
            rows.append((y, size, m.group(11)[:40].decode('latin-1')))
        elif m.group(12) is not None:
            txt=b''.join(re.findall(rb'\(((?:\.|[^\()])*)\)', m.group(12)))
            rows.append((y, size, txt[:40].decode('latin-1')))
rows.sort(key=lambda r: -r[0])
print(f'{"baseline mm":>12} {"size pt":>8}  text')
for y,s,t in rows[:5]:
    print(f'{(H-y)*pt2mm:12.2f} {s:8.1f}  {t!r}')
