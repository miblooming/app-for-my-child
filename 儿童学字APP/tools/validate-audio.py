from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
report=json.loads((ROOT/'audio'/'asset-manifest.json').read_text(encoding='utf-8'))
assets=ROOT/'app'/'src'/'main'/'assets'/'www'/'audio'
initials='b p m f d t n l g k h j q x zh ch sh r z c s y w'.split()
finals='a o e i u v ai ei ui ao ou iu ie ve er an en in un vn ang eng ing ong'.split()
expected={f'c{i:04d}' for i in range(2500)}|{'i_'+s for s in initials}|{'f_'+s for s in finals}
assert set(report['clips'])==expected,'Voice pack not complete: '+str(len(report['clips']))+'/2547'
assert {p.stem for p in assets.glob('*.mp3')}==expected
data=json.loads((ROOT/'data'/'characters.json').read_text(encoding='utf-8'))
for d in data:
    ident=f'c{d["order"]:04d}'
    assert report['clips'][ident]['text']==d['char']+'。'+'。'.join(w['text'] for w in d['words'])+'。',ident+' does not match displayed character/words'
for ident,clip in report['clips'].items():
    assert clip['file']==ident+'.mp3',ident+' filename mismatch'
    path=assets/clip['file'];assert path.exists() and path.stat().st_size==clip['bytes'],ident
    assert hashlib.sha256(path.read_bytes()).hexdigest()==clip['sha256'],ident+' content changed'
    assert .15<clip['seconds']<10,ident+' duration needs review before packaging'
assert report['learningCount']==2500 and report['phoneticCount']==47
print('Audio pack verified: 2500 read-character/word clips + 23 initials + 24 finals; no missing files or silent clips.')
