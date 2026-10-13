"""Independent acceptance checks against the app's actual ZIP, not generated fixtures."""
from pathlib import Path
import array,hashlib,io,json,math,sys,wave,zipfile
root=Path(sys.argv[1])
archive=max(root.glob('export-*/*.zip'),key=lambda p:p.stat().st_mtime)
captures=[]
for p in root.glob('capture-*/capture-evidence.json'):
 info=json.loads(p.read_text())
 if info['notes']==[48,60,72]:captures.append(p)
capture=max(captures,key=lambda p:p.stat().st_mtime).parent
checks=[]
with zipfile.ZipFile(archive) as z:
 assert set(z.namelist())=={'SerumC2.wav','SerumC3.wav','SerumC4.wav','patch.json'}
 patch=json.loads(z.read('patch.json'));assert patch['platform']=='OP-XY' and patch['type']=='multisampler'
 assert [r['pitch.keycenter'] for r in patch['regions']]==[48,60,72]
 for r in patch['regions']:
  data=z.read(r['sample'])
  with wave.open(io.BytesIO(data)) as w:
   assert (w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())==(44100,2,2,88200)
   pcm=array.array('h',w.readframes(w.getnframes()))
  source=capture/r['sample'].replace('Serum','Serum_')
  with wave.open(str(source)) as w:original=array.array('h',w.readframes(w.getnframes()))
  assert len(pcm)==len(original)
  max_delta=max(abs(a-b) for a,b in zip(pcm,original));assert max_delta<=1
  assert 0<max(map(abs,pcm))<32700
  mono=pcm[::2];part=mono[4410:35280]
  crossings=[i-part[i]/(part[i+1]-part[i]) for i in range(len(part)-1) if part[i]<=0<part[i+1]]
  hz=(len(crossings)-1)*44100/(crossings[-1]-crossings[0]);expected=440*2**((r['pitch.keycenter']-69)/12)
  assert abs(hz/expected-1)<0.01
  assert r['framecount']==88200 and not r['loop.enabled']
  checks.append({'file':r['sample'],'root':r['pitch.keycenter'],'frequencyHz':hz,'expectedHz':expected,'peakDBFS':20*math.log10(max(map(abs,pcm))/32768),'maxPCMDeltaFromCapture':max_delta,'sha256':hashlib.sha256(data).hexdigest()})
 assert len({r['sha256'] for r in checks})==3
report={'verdict':'PASS','archive':str(archive),'nativeCapture':str(capture),'checks':checks,'scope':'Actual app export; physical OP-XY playback not tested'}
(root/'acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
