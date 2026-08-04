import re, sys, zlib
raw = open(sys.argv[1],'rb').read()
objs = {int(m.group(1)): m.group(2) for m in re.finditer(rb'(\d+)\s+0\s+obj(.*?)endobj', raw, re.S)}

def stream_of(n):
    m = re.search(rb'stream\r?\n(.*?)endstream', objs[n], re.S)
    if not m: return b''
    try: return zlib.decompress(m.group(1))
    except Exception: return m.group(1)

def parse_cmap(d):
    cm={}
    for blk in re.findall(rb'beginbfchar(.*?)endbfchar', d, re.S):
        for s,t in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
            cm[int(s,16)]=bytes.fromhex(t.decode()).decode('utf-16-be','replace')
    for blk in re.findall(rb'beginbfrange(.*?)endbfrange', d, re.S):
        for lo,hi,t in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
            b=int.from_bytes(bytes.fromhex(t.decode()),'big')
            for i in range(int(lo,16),int(hi,16)+1): cm[i]=chr(b+i-int(lo,16))
    return cm

fonts={}
for n,body in objs.items():
    tu=re.search(rb'/ToUnicode\s+(\d+)\s+0\s+R', body)
    if tu: fonts[n]=parse_cmap(stream_of(int(tu.group(1))))
names={}
for body in objs.values():
    m=re.search(rb'/Font\s*<<(.*?)>>', body, re.S)
    if m:
        for nm,num in re.findall(rb'/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R', m.group(1)):
            if int(num) in fonts: names[nm.decode()]=int(num)

TOK=re.compile(rb'/([A-Za-z0-9]+)\s+[\d.]+\s+Tf'
               rb'|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm'
               rb'|([-\d.]+)\s+([-\d.]+)\s+Td'
               rb'|<([0-9A-Fa-f]+)>')
lines={}
for n in objs:
    d=stream_of(n)
    if b'Tf' not in d: continue
    cur=None; x=y=0.0
    for m in TOK.finditer(d):
        if m.group(1): cur=fonts.get(names.get(m.group(1).decode(),-1))
        elif m.group(2) is not None:
            x=float(m.group(6)); y=float(m.group(7))
        elif m.group(8) is not None:
            x+=float(m.group(8)); y+=float(m.group(9))
        elif m.group(10) is not None and cur:
            h=m.group(10)
            s=''.join(cur.get(int(h[i:i+4],16),'\ufffd') for i in range(0,len(h)-3,4))
            lines.setdefault(round(y,1),[]).append((x,s))
rows=sorted(lines.items(), key=lambda kv:-kv[0])
print(f"{len(rows)} distinct baselines")
for y,runs in rows:
    txt=''.join(s for _,s in sorted(runs))
    print(f"{y:9.1f} | {txt[:110]}")
