# 字芽识字 · 儿童学字 APP

用于练习认字：把 2,500 个常用汉字做成可标记、可听读、可反复复习的字卡，帮助孩子逐步积累认识的汉字。

当前版本：1.3.1。Android WebView 宿主加本地 HTML / CSS / JavaScript，最低支持 Android 6.0（API 23），建议使用较新的 Android System WebView。完全离线，无需注册和网络权限。

安装包下载：[GitHub Release · 字芽识字 v1.3.1](https://github.com/miblooming/app-for-my-child/releases/tag/ziya-v1.3.1)。在 Assets 中下载 `ZiyaKids-v1.3.1.apk`，手机打开安装；同页提供 SHA-256 校验文件。更新前建议先导出识字记录备份。

## 主要功能

- **识字测试**：轻点汉字标记本轮认识，再点撤销；同字同轮只累计一次。支持新一轮、重置本轮、认识 / 待认识筛选和汉字 / 拼音搜索。
- **识字记录**：跨轮累计认识次数，热力图显示熟悉程度，可按次数隐藏已熟悉的字。
- **五字学习**：按笔画由少到多排列，每组 5 字；显示拼音、笔画和常用组词，点击播放“字 → 词语”。支持笔画筛选、按累计次数跳过和跳转分组。
- **长按学字**：测试页长按汉字查看详情并听读，听读不会增加认识次数。
- **声母、韵母**：23 个声母和 24 个韵母卡片，点击播放发音。
- **备份恢复**：通过系统文件选择器导出、导入 JSON；导入确认后替换当前记录。

学习记录保存在手机私有存储中，不上传。卸载会清除记录，换机或卸载前请先导出备份。浏览器预览使用 localStorage，与手机数据互相独立。字词朗读为内置 AI 合成普通话语音，使用手机媒体音量。

## 源码结构

| 路径 | 内容 |
| --- | --- |
| `app/src/main/java/cn/ziya/kids/MainActivity.java` | WebView 宿主、本机存储、文件导入导出 |
| `app/src/main/java/cn/ziya/kids/VoicePlayer.java` | Android 离线音频播放 |
| `app/src/main/assets/www/` | 页面、样式、识字记录逻辑、字库与音频 |
| `app/src/main/assets/www/audio/` | 2,500 条字词朗读和 47 条拼音发音 MP3 |
| `data/characters.json` | 完整的 2,500 字学习资料，用于校验 |
| `audio/asset-manifest.json` | 成品音频文本、时长、大小、SHA-256 |
| `audio/sources/` | TTS 生成记录与拼音录音来源清单 |
| `tests/` | Node.js 逻辑测试与 Chromium 界面测试 |
| `tools/` | Windows 构建与音频校验 |

本仓库发布已整理的运行字库和成品语音，不包含识字表扫描图、OCR 中间结果、原始 WAV、完整 Unihan 数据集、模型权重或第三方 Python 包。

## 构建

使用 Android Studio 打开当前目录，配置 SDK 35 后运行。命令行可使用 Gradle 8.9、JDK 17 运行 `gradle assembleDebug`；项目使用 AGP 8.7.3，未附 Gradle Wrapper。Gradle 调试 APK 位于 `app/build/outputs/apk/debug/`。

Windows 不使用 Gradle 的构建方式需要 Python 3.10+、Node.js 18+、JDK 17、Android SDK Platform 35 与 Build Tools 35.0.0。请将 Node.js 加入 PATH，并在本目录 PowerShell 中运行：

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-17'
$env:ANDROID_SDK_ROOT = 'C:\path\to\Android\Sdk'
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

将示例路径替换为本机实际位置。脚本也支持 `ANDROID_HOME`，SDK 未配置时尝试 Windows 默认 SDK 目录；JDK 未配置时尝试 PATH 和 Android Studio 的 JBR。

脚本会运行逻辑和数据测试、验证 2,547 条音频的内容哈希，再编译、打包、对齐、生成开发签名并验签。输出为 `build/ZiyaKids-v1.3.1.apk` 和 `交付文件/字芽识字-v1.3.1.apk`，均不提交到 Git。开发密钥保存在被忽略的 `signing/`，正式发布请使用自己的发布签名。构建不需要运行语音模型，也不需要安装 Python 第三方依赖。

## 预览和测试

在当前目录执行：

```powershell
# 逻辑、数据与播放控制测试
node --test tests/model.test.cjs tests/data.test.cjs tests/learning.test.cjs tests/audio.test.cjs tests/test-screen.test.cjs
python -X utf8 tools/validate-audio.py

# 浏览器预览，只监听本机
python -m http.server 8765 --bind 127.0.0.1 --directory app/src/main/assets/www
```

打开 <http://127.0.0.1:8765> 预览。需要执行界面交互检查时，可在项目自己的 Python 虚拟环境中安装 Playwright 和 Chromium：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install playwright
.\.venv\Scripts\python.exe -m playwright install chromium
# 保持预览服务运行，在另一个终端执行
.\.venv\Scripts\python.exe -X utf8 tests/ui_test.py
```

界面测试覆盖点读中断、不误计数、记录持久化、次数筛选、分组与小屏布局。报告写入 `build/ui-test-report.json`，截图写入 `交付文件/界面预览/`。Android 的安装、文件选择器、系统栏和实际扬声器播放仍需真机验证。

## 数据和许可

当前原创代码和文档采用根目录 [PolyForm Noncommercial 1.0.0 非商业许可证](../LICENSE)，商业用途需单独授权。笔画数据来自 Unicode Unihan，拼音由 pypinyin 生成并校订；完整第三方许可随本地页面保存，并可在 APP 的设置中查看。

字词朗读为 Qwen3-TTS Serena 合成语音。声母、韵母录音来自 cmguo/PinYinSound；上游未声明许可证，这 47 段录音不属于本项目的授权范围。详细来源与范围见 [数据来源与许可](数据来源与许可.md) 和 [第三方资源说明](../THIRD_PARTY_NOTICES.md)。
