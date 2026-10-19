"""Verify current release contents, identity and signatures without changing programs."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
SDK = Path('K:/ai-model/toolchains/android/sdk/build-tools/35.0.0')
CERT = '6b9e41b4e92fd7848ee73e1ab2b7b913782a6aa804b499d9bfc99338be60cb6e'

def main():
    delivery = ROOT / '交付文件'
    apk = delivery / f'奇想编程小镇-v{VERSION}.apk'
    web = delivery / f'奇想编程小镇-v{VERSION}-网页版.zip'
    assert set(p.name for p in delivery.iterdir()) == {apk.name, web.name}
    voices = json.loads((ROOT / 'voice-jobs.json').read_text(encoding='utf-8'))['jobs']
    files = [p for p in (ROOT / 'dist').rglob('*') if p.is_file()]
    with zipfile.ZipFile(apk) as android, zipfile.ZipFile(web) as browser:
        assert android.testzip() is None and browser.testzip() is None
        for file in files:
            relative = file.relative_to(ROOT / 'dist').as_posix()
            assert android.read('assets/public/' + relative) == file.read_bytes(), relative
            assert browser.read(relative) == file.read_bytes(), relative
        assert len([n for n in android.namelist() if n.startswith('assets/public/voice/') and n.endswith('.mp3')]) == len(voices) == 53
        assert browser.read('THIRD_PARTY_NOTICES.md')
        for name in ['LICENSE', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md']:
            assert android.read('assets/public/' + name) == (ROOT / name).read_bytes()
            assert browser.read(name) == (ROOT / name).read_bytes()
        assert b'PolyForm Noncommercial License 1.0.0' in browser.read('LICENSE')
        for names in [android.namelist(), browser.namelist()]:
            assert not any(n.endswith(('.jks', '.keystore', 'signing.properties', '.ts', '.map')) or 'node_modules/' in n for n in names)
    source = ROOT / '开发资料' / '源码包' / f'奇想编程小镇-v{VERSION}-源码.zip'
    with zipfile.ZipFile(source) as z:
        assert z.testzip() is None
        assert z.read('wonder-town/src/levels.ts') == (ROOT / 'src/levels.ts').read_bytes()
        assert not any('/signing/' in n or '/node_modules/' in n or n.endswith(('local.properties', '.jks', '.keystore')) for n in z.namelist())
    jdk = next((ROOT / 'tools/java17').glob('*/bin/java.exe'))
    certs = subprocess.check_output([str(jdk), '-jar', str(SDK / 'lib/apksigner.jar'), 'verify', '--print-certs', str(apk)], text=True)
    assert CERT in certs
    release = ROOT / 'android/app/build/outputs/apk/release'
    manifest = subprocess.check_output([str(SDK / 'aapt.exe'), 'dump', 'badging', 'app-release.apk'], cwd=release, text=True, encoding='utf-8')
    assert f"versionName='{VERSION}'" in manifest and "versionCode='7'" in manifest
    assert apk.read_bytes() == (release / 'app-release.apk').read_bytes()
    report = {
        'version': VERSION, 'result': 'PASS', 'androidVersionCode': 7,
        'originalSigningCertificateSHA256': CERT, 'productionFilesMatchedInAPKAndWeb': len(files),
        'offlineVoiceClips': len(voices), 'zipIntegrity': 'PASS', 'sourcePackageExcludesSecretsAndDependencies': True,
        'onlyLatestProgramsInDelivery': True, 'physicalAndroidDevice': 'not available',
        'files': [{'name': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [apk, web]],
    }
    (ROOT / '开发资料/测试报告/最新版交付核验.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
