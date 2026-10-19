"""Keep current runnable releases in delivery; development materials live separately."""
from pathlib import Path
import zipfile, hashlib, json, wave, array, math, subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'交付文件'
OUT.mkdir(exist_ok=True)
DEV=ROOT/'开发资料'
REPORTS=DEV/'测试报告'
SOURCES=DEV/'源码包'
CHECKSUMS=DEV/'校验'
VOICE_COUNT=len(json.loads((ROOT/'voice-jobs.json').read_text(encoding='utf-8'))['jobs'])
VERSION=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
EXCLUDE={'node_modules','dist','build','.gradle','.git','.svn','signing','交付文件','开发资料','java17','gradle-cache','__pycache__','test-results','playwright-report'}
def allowed(path):
    rel=path.relative_to(ROOT)
    return not any(part in EXCLUDE for part in rel.parts) and rel.name not in {'jdk17.zip','local.properties','voice-diagnostic.py'} and 'android/app/src/main/assets/public' not in rel.as_posix()
def main():
    for folder in [REPORTS,SOURCES,CHECKSUMS]:folder.mkdir(parents=True,exist_ok=True)
    subprocess.run(['node',str(ROOT/'tools/prepare-notices.mjs')],cwd=ROOT,check=True)
    audio_report={}
    for f in (ROOT/'audio').glob('*.wav'):
        with wave.open(str(f),'rb') as w:
            samples=array.array('h',w.readframes(w.getnframes()))
            rms=math.sqrt(sum(x*x for x in samples)/len(samples))/32768
            assert rms>0.005 and rms<0.5, (f.name,'unexpected volume',rms)
            audio_report[f.stem]={'seconds':round(len(samples)/w.getframerate(),3),'rms':round(rms,5)}
    assert len(audio_report)==VOICE_COUNT
    jobs=json.loads((ROOT/'voice-jobs.json').read_text(encoding='utf-8'))['jobs']
    assert len({j['speaker'] for j in jobs})==1 and len({j['instruct'] for j in jobs})==1
    assert all(audio_report[j['id']]['seconds']<=(5 if j['id'] in {'action-failure','action-complete'} else 2.6) for j in jobs if j['id'].startswith('action-'))
    (REPORTS/'配音资源检查.json').write_text(json.dumps(audio_report,ensure_ascii=False,indent=2),encoding='utf-8')
    apk=OUT/f'奇想编程小镇-v{VERSION}.apk'
    with zipfile.ZipFile(apk) as z:
        names=z.namelist()
        assert 'assets/public/index.html' in names
        assert len([n for n in names if n.startswith('assets/public/voice/') and n.endswith('.mp3')])==VOICE_COUNT
        assert any(n.startswith('classes') and n.endswith('.dex') for n in names)
        assert not any(n.endswith(('.jks','.keystore','signing.properties')) for n in names)
    with zipfile.ZipFile(SOURCES/f'奇想编程小镇-v{VERSION}-源码.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in ROOT.rglob('*'):
            if f.is_file() and allowed(f): z.write(f,Path('wonder-town')/f.relative_to(ROOT))
    with zipfile.ZipFile(OUT/f'奇想编程小镇-v{VERSION}-网页版.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in (ROOT/'dist').rglob('*'):
            if f.is_file(): z.write(f,f.relative_to(ROOT/'dist'))
        if not (ROOT/'dist/THIRD_PARTY_NOTICES.md').exists():
            z.write(ROOT/'THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md')
    # Remove only known previous program builds after current artifacts validate.
    current={apk.name,f'奇想编程小镇-v{VERSION}-网页版.zip'}
    output_root=OUT.resolve()
    for f in OUT.iterdir():
        if f.is_file() and f.name not in current and (f.name.startswith('奇想编程小镇-v') and (f.name.endswith('.apk') or f.name.endswith('-网页版.zip'))):
            if f.resolve().parent!=output_root:raise RuntimeError('Release path escapes delivery folder')
            f.unlink()
    outputs=sorted(OUT/name for name in current)
    hashes=''.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.name+'\n' for f in outputs)
    (CHECKSUMS/'SHA256.txt').write_text(hashes,encoding='utf-8')
    for f in outputs: print(f'{f.name}: {f.stat().st_size/1048576:.2f} MiB')
if __name__=='__main__':main()
