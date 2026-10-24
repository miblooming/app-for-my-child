"""Verify a release before keeping only its final APK in the delivery directory."""
from pathlib import Path
import hashlib,json,re,shutil,subprocess,zipfile

def finalize(root,apk,java,signer):
    root=root.resolve();delivery=(root/'交付文件').resolve();development=(root/'build'/'Codex开发资料').resolve()
    assert apk.resolve().parent==delivery and development.is_relative_to(root)
    development.mkdir(parents=True,exist_ok=True)
    def certificate(path):
        output=subprocess.check_output([str(java),'-jar',str(signer),'verify','--print-certs',str(path)],text=True,encoding='utf-8',errors='replace',stderr=subprocess.DEVNULL)
        return re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]+)',output).group(1)
    cert=certificate(apk)
    previous=sorted((p for p in delivery.glob('字芽识字-v*.apk') if p!=apk),key=lambda p:tuple(int(n) for n in re.findall(r'\d+',p.stem)))
    if previous:assert certificate(previous[-1])==cert,'Upgrade certificate differs; previous release preserved'
    manifest=json.loads((root/'audio'/'asset-manifest.json').read_text(encoding='utf-8'))['clips']
    with zipfile.ZipFile(apk) as archive:
        assert len([n for n in archive.namelist() if n.startswith('assets/www/audio/') and n.endswith('.mp3')])==len(manifest)==2547
        for ident,entry in manifest.items():
            name='assets/www/audio/'+ident+'.mp3'
            assert archive.getinfo(name).compress_type==zipfile.ZIP_STORED
            assert hashlib.sha256(archive.read(name)).hexdigest()==entry['sha256'],ident
        for name in ['index.html','app.js','model.js','styles.css','audio-player.js']:
            assert archive.read('assets/www/'+name)==(root/'app/src/main/assets/www'/name).read_bytes(),name
    # All resolved source and destination paths are checked before deleting or moving.
    stale=list(delivery.iterdir());legacy=development/'旧交付开发资料';moves=[];deletes=[]
    for path in stale:
        if path==apk:continue
        assert path.resolve().is_relative_to(delivery),str(path)
        if path in previous:deletes.append(path);continue
        target=legacy/path.name;index=1
        while target.exists():target=legacy/(path.stem+'-'+str(index)+path.suffix);index+=1
        assert target.resolve().is_relative_to(development),str(target)
        moves.append((path,target))
    for source,target in moves:
        target.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(source),str(target))
    for path in deletes:path.unlink()
    digest=hashlib.sha256(apk.read_bytes()).hexdigest()
    ui=root/'build'/'ui-test-report.json';logic=root/'build'/'logic-test-report.json'
    report={'apk':apk.name,'sha256':digest,'certificateSHA256':cert,'upgradeCertificateMatches':True if previous else None,'previousRelease':previous[-1].name if previous else None,'audioFiles':2547,'audioHashesMatchManifest':True,'appResourcesMatchSource':True,'androidDeviceTested':False}
    if ui.exists():report['browserChecksPassed']=json.loads(ui.read_text(encoding='utf-8'))['passed']
    if logic.exists():report['logicalChecksPassed']=json.loads(logic.read_text(encoding='utf-8'))['passed']
    (development/'安装包核验结果.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (development/'SHA256.txt').write_text(digest+'  '+apk.name+'\n',encoding='utf-8')
    print('Release verified; delivery contains only '+apk.name,flush=True)
