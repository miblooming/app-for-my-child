"""Build a standalone signed native Android APK with the official SDK (no Gradle download)."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import zipfile
import sys
from build_env import android_sdk, java_home, build_tools, prepare_manifest

ROOT = Path(__file__).resolve().parents[1]
SDK = android_sdk()
JDK = java_home()
BUILD_TOOLS = build_tools(SDK)
PLATFORM = SDK/'platforms'/'android-35'/'android.jar'
if BUILD_TOOLS is None or not PLATFORM.exists(): raise SystemExit('Android SDK 35 platform/build-tools missing.')
BUILD = ROOT/'build'
BUILD.mkdir(exist_ok=True)

def run(*args):
    subprocess.run([str(x) for x in args], cwd=ROOT, check=True)

def main():
    run(sys.executable, ROOT/'tools'/'validate_voice_pack.py')
    for d in ('generated', 'classes', 'dex', 'test-classes'): (BUILD/d).mkdir(exist_ok=True)
    java = JDK/'bin'/'java.exe'
    javac = JDK/'bin'/'javac.exe'
    app = ROOT/'app'/'src'/'main'
    # Timeline assertions run on a real JVM, independently of Android rendering.
    run(javac, '--release', '8', '-encoding', 'UTF-8', '-d', BUILD/'test-classes',
        app/'java'/'cn'/'fitcount'/'app'/'WorkoutClock.java', ROOT/'tests'/'WorkoutClockTest.java')
    run(java, '-cp', BUILD/'test-classes', 'WorkoutClockTest')
    audio_files = list((app/'assets'/'audio').glob('*.wav'))
    if len(audio_files) != 303: raise SystemExit('Expected 303 bundled voice clips.')
    prepare_manifest(ROOT, 'cn.fitcount.app')
    # Native Windows SDK tools require ASCII arguments; use paths relative to the Unicode project directory.
    run(BUILD_TOOLS/'aapt2.exe', 'compile', '--dir', 'app/src/main/res', '-o', 'build/resources.zip')
    run(BUILD_TOOLS/'aapt2.exe', 'link', '-o', 'build/base.apk', '--manifest', 'build/AndroidManifest.xml',
        '-I', PLATFORM.relative_to(ROOT) if PLATFORM.is_relative_to(ROOT) else PLATFORM,
        '--java', 'build/generated', '-A', 'app/src/main/assets', '-0', 'wav', 'build/resources.zip')
    sources = sorted((app/'java').rglob('*.java')) + sorted((BUILD/'generated').rglob('*.java'))
    run(javac, '--release', '8', '-classpath', PLATFORM, '-encoding', 'UTF-8',
        '-d', BUILD/'classes', *sources)
    classes_jar = BUILD/'classes.jar'
    with zipfile.ZipFile(classes_jar, 'w') as jar:
        for file in sorted((BUILD/'classes').rglob('*.class')): jar.write(file, file.relative_to(BUILD/'classes').as_posix())
    run(java, '-cp', BUILD_TOOLS/'lib'/'d8.jar', 'com.android.tools.r8.D8',
        '--lib', PLATFORM, '--min-api', '23', '--output', BUILD/'dex', classes_jar)
    with zipfile.ZipFile(BUILD/'base.apk') as source, zipfile.ZipFile(BUILD/'unsigned.apk', 'w') as dest:
        for info in source.infolist(): dest.writestr(info, source.read(info.filename))
        dest.write(BUILD/'dex'/'classes.dex', 'classes.dex', compress_type=zipfile.ZIP_STORED)
    run(BUILD_TOOLS/'zipalign.exe', '-f', '-p', '4', 'build/unsigned.apk', 'build/aligned.apk')
    signing = ROOT/'signing'; signing.mkdir(exist_ok=True)
    keystore = signing/'local-app.jks'
    # Development signing key only. Keep private for compatible local updates.
    if not keystore.exists():
        run(JDK/'bin'/'keytool.exe', '-genkeypair', '-noprompt', '-keystore', keystore,
            '-storepass', 'android', '-keypass', 'android', '-alias', 'local-app', '-keyalg', 'RSA',
            '-keysize', '2048', '-validity', '10000', '-dname', 'CN=LianYiKe Local App, O=Personal, C=CN')
    output = BUILD/'LianYiKe-v1.1.0.apk'
    run(java, '-jar', BUILD_TOOLS/'lib'/'apksigner.jar', 'sign', '--ks', keystore,
        '--ks-key-alias', 'local-app', '--ks-pass', 'pass:android', '--key-pass', 'pass:android',
        '--out', output, BUILD/'aligned.apk')
    run(java, '-jar', BUILD_TOOLS/'lib'/'apksigner.jar', 'verify', '--verbose', output)
    run(BUILD_TOOLS/'zipalign.exe', '-c', '-p', '4', 'build/LianYiKe-v1.1.0.apk')
    run(BUILD_TOOLS/'aapt2.exe', 'dump', 'badging', 'build/LianYiKe-v1.1.0.apk')
    delivered = ROOT/'交付文件'/'练一刻-v1.1.0.apk'
    delivered.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output, delivered)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (delivered.parent/'SHA256.txt').write_text(f'{digest}  {delivered.name}\n', encoding='utf-8')
    print(f'APK ready: {delivered} ({delivered.stat().st_size / 1048576:.2f} MiB)')

if __name__ == '__main__': main()
