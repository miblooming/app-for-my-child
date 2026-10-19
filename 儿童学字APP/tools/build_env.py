"""Find a local Windows Android toolchain without machine-specific paths."""
from pathlib import Path
import os
import shutil
import xml.etree.ElementTree as ET


def android_sdk():
    configured = os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME')
    local_app_data = Path(os.environ.get('LOCALAPPDATA') or Path.home() / 'AppData' / 'Local')
    sdk = Path(configured) if configured else local_app_data / 'Android' / 'Sdk'
    if not (sdk / 'platforms' / 'android-35' / 'android.jar').is_file():
        raise SystemExit('Android SDK Platform 35 missing. Set ANDROID_SDK_ROOT or ANDROID_HOME.')
    return sdk


def java_home():
    candidates = []
    if os.environ.get('JAVA_HOME'):
        candidates.append(Path(os.environ['JAVA_HOME']))
    javac = shutil.which('javac')
    if javac:
        candidates.append(Path(javac).resolve().parent.parent)
    program_files = os.environ.get('ProgramFiles')
    if program_files:
        candidates.append(Path(program_files) / 'Android' / 'Android Studio' / 'jbr')
    for candidate in candidates:
        if all((candidate / 'bin' / tool).is_file() for tool in ('javac.exe', 'java.exe', 'keytool.exe')):
            return candidate
    raise SystemExit('JDK not found. Set JAVA_HOME to JDK 17 or the Android Studio JBR.')


def build_tools(sdk):
    tools = sdk / 'build-tools' / '35.0.0'
    if not all((tools / item).is_file() for item in ('aapt2.exe', 'zipalign.exe', 'lib/d8.jar', 'lib/apksigner.jar')):
        raise SystemExit('Android SDK Build Tools 35.0.0 missing. Install them with Android SDK Manager.')
    return tools


def prepare_manifest(root, application_id):
    # AGP uses the Gradle namespace; standalone AAPT2 needs a manifest package.
    ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
    tree = ET.parse(root / 'app/src/main/AndroidManifest.xml')
    tree.getroot().set('package', application_id)
    destination = root / 'build/AndroidManifest.xml'
    destination.parent.mkdir(parents=True, exist_ok=True)
    tree.write(destination, encoding='utf-8', xml_declaration=True)
