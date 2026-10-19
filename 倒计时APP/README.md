# 练一刻 · 倒计时 APP

用于锻炼计时、培养孩子的时间感。通过清晰的倒计时数字与逐秒中文报数，让孩子感受一秒的节奏和不同时长；也可以在运动练习时使用。

当前版本：1.1.0。原生 Java Android 应用，最低支持 Android 6.0（API 23），竖屏、完全离线。

安装包下载：[GitHub Release · 练一刻 v1.1.0](https://github.com/miblooming/app-for-my-child/releases/tag/countdown-v1.1.0)。在 Assets 中下载 `LianYiKe-v1.1.0.apk`，手机打开安装；同页提供 SHA-256 校验文件。

## 使用方法

1. 选择 30、60、100、200 或 300 秒。
2. 跟随开场、3 / 2 / 1 和开始口令进入倒计时，预备时间不计入所选时长。
3. 屏幕显示剩余秒数，中文语音同步逐秒报数，结束后播放完成提示。
4. 点击中央区域或暂停按钮可暂停、继续；返回首页可重新选择时长。

右上角可开关语音。声音使用手机媒体音量；音频已内置，无需网络或系统 TTS。语音为 AI 合成。

计时使用 Android 单调时钟，画面和语音共享时间轴。切换应用、锁屏或音频焦点被打断时自动暂停；恢复后手动继续。训练时保持屏幕常亮，返回、暂停或完成后恢复正常息屏设置。

## 源码结构

| 路径 | 内容 |
| --- | --- |
| `app/src/main/java/cn/fitcount/app/MainActivity.java` | 原生界面、触控、生命周期与音频焦点 |
| `app/src/main/java/cn/fitcount/app/WorkoutClock.java` | 独立计时状态机与报数时间轴 |
| `app/src/main/java/cn/fitcount/app/VoicePlayer.java` | 内置音频播放、暂停与恢复 |
| `app/src/main/assets/audio/` | 1–300 报数与 3 段提示，共 303 段 WAV |
| `app/src/main/assets/voice-pack.json` | 音频来源、时长及时间轴配置 |
| `tests/WorkoutClockTest.java` | 计时边界、暂停恢复、返回与重新开始测试 |
| `tools/` | Windows 构建与语音完整性校验 |

## 构建

使用 Android Studio 打开当前目录，配置 SDK 35 后运行。命令行可使用 Gradle 8.9、JDK 17 运行 `gradle assembleDebug`；项目使用 AGP 8.7.3，未附 Gradle Wrapper。Gradle 调试 APK 位于 `app/build/outputs/apk/debug/`。

Windows 不使用 Gradle 的构建方式：安装 Python 3.10+、JDK 17、Android SDK Platform 35 和 Build Tools 35.0.0，然后在本目录的 PowerShell 中运行：

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-17'
$env:ANDROID_SDK_ROOT = 'C:\path\to\Android\Sdk'
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

将示例路径替换为本机实际位置。脚本也支持 `ANDROID_HOME`，SDK 未配置时尝试 Windows 默认 SDK 目录；JDK 未配置时尝试 PATH 和 Android Studio 的 JBR。

脚本会检查音频、执行计时测试，再编译、打包、对齐、生成本地开发签名并验签。输出为 `build/LianYiKe-v1.1.0.apk` 和 `交付文件/练一刻-v1.1.0.apk`，均不提交到 Git。开发密钥保存在被忽略的 `signing/`，正式发布请使用自己的发布签名。

303 段成品语音已包含在仓库中，构建不需要 AI 模型或 Python 第三方依赖。

## 测试

在本目录执行：

```powershell
python tools/validate_voice_pack.py
New-Item -ItemType Directory -Force build/test-classes | Out-Null
& "$env:JAVA_HOME/bin/javac.exe" --release 8 -encoding UTF-8 -d build/test-classes app/src/main/java/cn/fitcount/app/WorkoutClock.java tests/WorkoutClockTest.java
& "$env:JAVA_HOME/bin/java.exe" -cp build/test-classes WorkoutClockTest
```

覆盖五档时长、每个报数边界、预备、不同口令时长、长暂停、重复暂停恢复、返回和重选，共 2,978 项时间轴断言。完整构建也会自动执行这些检查。Android 设备的安装、界面与实际扬声器同步效果需要另外验证。

## 资源与许可

当前原创代码和文档采用根目录 [PolyForm Noncommercial 1.0.0 非商业许可证](../LICENSE)，商业用途需单独授权。声音由 Qwen3-TTS 1.7B CustomVoice 的 Dylan 声线合成，模型、修订、文案和音频时长保存在 `voice-pack.json`。模型权重和生成中间文件未发布；来源见 [第三方资源说明](../THIRD_PARTY_NOTICES.md)。
