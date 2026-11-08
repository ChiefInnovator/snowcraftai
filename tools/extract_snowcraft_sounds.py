#!/usr/bin/env python3
"""Static extractor: reads Director MV93 movie embedded in SnowCraft.exe (no execution).
Writes each sound cast member's sndS PCM as an 8-bit unsigned mono WAV (lossless re-wrap)."""
import struct,re,sys,wave,hashlib,json,os
exe=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True)
d=open(exe,'rb').read()
base=d.find(b'XFIR',d.find(b'39VM')-12) ; base=[m.start() for m in re.finditer(rb'XFIR....39VM',d,re.S)][0]
mo=d.find(b'pamm',base); hs,es,_,n=struct.unpack('<HHii',d[mo+8:mo+20])
ents=[struct.unpack('<4sII',d[mo+8+hs+i*es:mo+8+hs+i*es+12]) for i in range(n)]
ents=[(t[::-1],s,o) for t,s,o in ents]
k=[e for e in ents if e[0]==b'KEY*'][0][2]+8
h2,e2,_,n2=struct.unpack('<HHii',d[k:k+12]); own={}
for i in range(n2):
    sec,cid,t=struct.unpack('<ii4s',d[k+h2+i*e2:k+h2+i*e2+12]); own[sec]=cid
inv=[];seen={}
for i,(t,sz,off) in enumerate(ents):
    if t!=b'sndS': continue
    cid=own[i]; c=ents[cid]; raw=d[c[2]+8:c[2]+8+c[1]]
    strs=re.findall(rb'[ -~]{2,}',raw)
    name=strs[0].decode() if strs and not strs[0].startswith(b'kMoa') else f'unnamed_cast_{cid}'
    fmt=[s.decode() for s in strs if s.startswith(b'kMoaCfFormat')]
    H=d[ents[i-1][2]+8:ents[i-1][2]+8+100]
    nsamp=struct.unpack('>I',H[4:8])[0]; rate=struct.unpack('>I',H[44:48])[0]
    bits=struct.unpack('>I',H[68:72])[0]; ch=struct.unpack(">I",H[72:76])[0]
    data=d[off+8:off+8+sz]
    note=''
    if data[:4]==b'\x00\x01\x00\x01': data=data[42:42+nsamp]; note='stripped 42-byte Mac snd resource header'
    data=data[:nsamp*ch*bits//8]
    h=hashlib.sha256(data).hexdigest()
    safe=re.sub(r'[^A-Za-z0-9]+','_',name).strip('_')
    fn=f'{len(inv)+1:02d}_{safe}.wav'
    if h in seen: seen[h]['aliases'].append(name); continue
    w=wave.open(os.path.join(out,fn),'wb'); w.setnchannels(ch); w.setsampwidth(bits//8); w.setframerate(rate); w.writeframes(data); w.close()
    rec=dict(file=fn,cast_member_name=name,cast_section=cid,sndS_section=i,import_format=fmt[0] if fmt else None,
      sample_rate=rate,bits=bits,channels=ch,samples=nsamp,duration_s=round(nsamp/rate,3),sha256_pcm=h,aliases=[],note=note,provenance='extracted (original PCM, re-wrapped as WAV)')
    seen[h]=rec; inv.append(rec)
json.dump(dict(application='SnowCraft (Nicholson NY, 1999) - Macromedia Director 7/8 projector',source=os.path.basename(exe),sounds=inv),open(os.path.join(out,'inventory.json'),'w'),indent=1)
print(len(inv))
