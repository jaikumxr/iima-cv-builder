import re, sys, zlib
raw=open(sys.argv[1],'rb').read()
mb=re.search(rb'/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', raw)
H=float(mb.group(4)); pt2mm=25.4/72
for m in re.finditer(rb'stream\r?\n(.*?)endstream', raw, re.S):
    try: d=zlib.decompress(m.group(1))
    except Exception: continue
    # image draws: cm sets the placement box, Do paints it
    for c in re.finditer(rb'([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm\s*(?:/\w+\s+Do|[^D]{0,80}?/\w+\s+Do)', d, re.S):
        a,b,cc,dd,e,f=(float(g) for g in c.groups())
        if a < 5 or dd < 5: continue     # ignore tiny/identity transforms
        print(f'image {a*pt2mm:6.2f} x {dd*pt2mm:6.2f} mm   at x={e*pt2mm:6.2f}mm  top={(H-(f+dd))*pt2mm:6.2f}mm')
