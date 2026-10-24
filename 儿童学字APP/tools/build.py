"""Compile, align, sign and verify the offline Android APK using the installed SDK."""
from pathlib import Path
import os,sys,subprocess,zipfile,shutil,hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
from build_env import android_sdk, java_home, build_tools, prepare_manifest
from finalize_delivery import finalize
SDK=android_sdk()
JDK=java_home()
BT=build_tools(SDK)
PLATFORM=SDK/'platforms'/'android-35'/'android.jar'
BUILD=ROOT/'build'
def run(*args):subprocess.run([str(a) for a in args],cwd=ROOT,check=True)
def main():
    data=json.loads((ROOT/'data'/'characters.json').read_text(encoding='utf-8'))
    assert len(data)==len(set(d['char'] for d in data))==2500
    assert all(1<=d['strokes']<=64 and len(d['words'])>=1 and len(d['pinyin'])>=1 for d in data)
    BUILD.mkdir(exist_ok=True);results=[]
    for test in ['model','data','learning','audio','test-screen']:
        result=subprocess.run(['node',f'tests/{test}.test.cjs'],cwd=ROOT,text=True,encoding='utf-8',capture_output=True)
        print(result.stdout,end='');print(result.stderr,end='',file=sys.stderr);result.check_returncode()
        results.append({'suite':test,'passed':int(re.search(r'# pass (\d+)',result.stdout).group(1))})
    (BUILD/'logic-test-report.json').write_text(json.dumps({'passed':sum(r['passed'] for r in results),'suites':results},indent=2),encoding='utf-8')
    run(sys.executable,'-X','utf8','tools/validate-audio.py')
    run('node','--check','app/src/main/assets/www/app.js')
    for folder in ['generated','classes','dex']:(BUILD/folder).mkdir(parents=True,exist_ok=True)
    prepare_manifest(ROOT,'cn.ziya.kids')
    run(BT/'aapt2.exe','compile','--dir','app/src/main/res','-o','build/resources.zip')
    run(BT/'aapt2.exe','link','-o','build/base.apk','--manifest','build/AndroidManifest.xml','-I',PLATFORM,'--java','build/generated','-A','app/src/main/assets','-0','mp3','build/resources.zip')
    sources=list((ROOT/'app'/'src'/'main'/'java').rglob('*.java'))+list((BUILD/'generated').rglob('*.java'))
    run(JDK/'bin'/'javac.exe','--release','8','-encoding','UTF-8','-classpath',PLATFORM,'-d',BUILD/'classes',*sources)
    with zipfile.ZipFile(BUILD/'classes.jar','w') as z:
        for f in (BUILD/'classes').rglob('*.class'):z.write(f,f.relative_to(BUILD/'classes').as_posix())
    run(JDK/'bin'/'java.exe','-cp',BT/'lib'/'d8.jar','com.android.tools.r8.D8','--lib',PLATFORM,'--min-api','23','--output',BUILD/'dex',BUILD/'classes.jar')
    with zipfile.ZipFile(BUILD/'base.apk') as src,zipfile.ZipFile(BUILD/'unsigned.apk','w') as dst:
        for info in src.infolist():dst.writestr(info,src.read(info.filename))
        dst.write(BUILD/'dex'/'classes.dex','classes.dex',compress_type=zipfile.ZIP_STORED)
    run(BT/'zipalign.exe','-f','-p','4','build/unsigned.apk','build/aligned.apk')
    signing=ROOT/'signing';signing.mkdir(exist_ok=True);key=signing/'ziya-local.jks'
    if not key.exists():run(JDK/'bin'/'keytool.exe','-genkeypair','-noprompt','-keystore',key,'-storepass','android','-keypass','android','-alias','ziya','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Ziya Kids Personal App, O=Personal, C=CN')
    out=BUILD/'ZiyaKids-v1.4.0.apk'
    run(JDK/'bin'/'java.exe','-jar',BT/'lib'/'apksigner.jar','sign','--ks',key,'--ks-key-alias','ziya','--ks-pass','pass:android','--key-pass','pass:android','--out',out,BUILD/'aligned.apk')
    run(JDK/'bin'/'java.exe','-jar',BT/'lib'/'apksigner.jar','verify','--verbose',out)
    run(BT/'zipalign.exe','-c','-p','4','build/ZiyaKids-v1.4.0.apk')
    run(BT/'aapt2.exe','dump','badging','build/ZiyaKids-v1.4.0.apk')
    delivered=ROOT/'交付文件';delivered.mkdir(exist_ok=True)
    apk=delivered/'字芽识字-v1.4.0.apk';shutil.copy2(out,apk)
    development=BUILD/'Codex开发资料';development.mkdir(parents=True,exist_ok=True)
    (development/'SHA256.txt').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n',encoding='utf-8')
    finalize(ROOT,apk,JDK/'bin'/'java.exe',BT/'lib'/'apksigner.jar')
    print(f'APK ready: {apk} ({apk.stat().st_size/1048576:.2f} MiB)')
if __name__=='__main__':main()
