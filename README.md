# 给孩子做的小应用

为孩子制作的三个应用：倒计时练习时间感、识字卡片练习认字、编程小镇体验方向、判断、重复与协作。均可离线使用，无需注册，无广告。

当前版本采用 **PolyForm Noncommercial 1.0.0 非商业许可证**，商业用途需单独授权。适用范围见 [NOTICE.md](NOTICE.md)。

| 目录 | 应用 | 主要用途 |
| --- | --- | --- |
| [倒计时APP](倒计时APP/README.md) | 练一刻 | 通过逐秒中文报数和倒计时，练习计时、感受时长，也可用于运动训练 |
| [儿童学字APP](儿童学字APP/README.md) | 字芽识字 | 练习认字、听读字词，记录每轮认识的汉字与累计次数 |
| [儿童编程](儿童编程/README.md) | 奇想编程小镇 | 30 个单人或双人关卡，用可视化指令学习重复、如果、资源接力和卫士护送 |

## 下载安装

已编译的 Android 安装包发布在 GitHub Releases：

- [练一刻 v1.1.0 · 倒计时 APP](https://github.com/miblooming/app-for-my-child/releases/tag/countdown-v1.1.0)
- [字芽识字 v1.3.1 · 儿童学字 APP](https://github.com/miblooming/app-for-my-child/releases/tag/ziya-v1.3.1)
- [奇想编程小镇 v1.6.0 · 儿童编程 APP 与网页版](https://github.com/miblooming/app-for-my-child/releases/tag/wonder-town-v1.6.0)

在对应发布页的 Assets 中下载 `.apk`，复制到 Android 手机上打开安装。每个版本附有 SHA-256 校验文件。倒计时与识字 APP 最低支持 Android 6.0，编程小镇最低支持 Android 8.0；更新前建议先导出应用记录或存档备份。

## 项目结构

```text
app-for-my-child/
├── 倒计时APP/          # 原生 Java Android 应用、303 段离线语音
├── 儿童学字APP/        # Android WebView 应用、2,500 字字库与离线音频
├── 儿童编程/           # Phaser + TypeScript 游戏、Capacitor Android、53 段离线童声
├── README.md
├── THIRD_PARTY_NOTICES.md
└── LICENSE
```

每个应用可以独立构建，编译与目标 Android SDK 为 35。编程小镇也可以构建成静态网页版。

## 获取和构建

```shell
git clone https://github.com/miblooming/app-for-my-child.git
cd app-for-my-child
```

倒计时和识字 APP：使用 Android Studio 打开应用目录，配置 Android SDK 35 后同步并运行。这两个工程使用 Android Gradle Plugin 8.7.3，建议搭配 Gradle 8.9 和 JDK 17，未附 Gradle Wrapper。也可以安装 Gradle 后在应用目录运行：

```shell
gradle assembleDebug
```

这两个应用在 Windows 还提供不依赖 Gradle 的 `build.ps1`。准备 Python 3.10+、JDK 17、Android SDK Platform 35 / Build Tools 35.0.0，并设置 `JAVA_HOME` 和 `ANDROID_SDK_ROOT`（或 `ANDROID_HOME`）。学字 APP 的构建检查还需要 Node.js 18+。

编程小镇：进入 `儿童编程`，运行 `npm ci`、`npm test`、`npm run build`。网页预览运行 `npm run dev`；Android 构建另需 PowerShell 7、JDK 17 和 SDK 35，运行 `构建Android.ps1`，使用工程自带 Gradle 8.2.1 Wrapper。完整说明见 [儿童编程 README](儿童编程/README.md)。

应用使用的字库和成品语音已经包含在源码中，构建无需下载或运行 AI 模型。Android Studio / Gradle 首次构建仍可能需要下载构建依赖。

## 发布内容

仓库保留应用源码、Gradle 配置、构建与校验脚本、测试、字库、实际运行需要的离线音频及来源清单。APK、源码压缩包、构建产物、签名密钥、个人学习记录、原始识字表扫描图、模型权重、SDK/JDK、第三方依赖目录和语音生成中间文件不纳入版本管理。

Windows 构建脚本会在本地生成开发签名密钥，并写入被 Git 忽略的 `signing/`。它只适合本地开发；正式发布请自行配置并妥善保管发布密钥。重新生成的签名不能覆盖使用另一把密钥签名的旧安装包。

## 许可与资源来源

当前仓库的原创软件及随附原创内容采用 [PolyForm Noncommercial 1.0.0](LICENSE)，允许许可证列明的非商业等用途；商业用途需单独授权。这是非商业许可的公开源码项目。第三方资源的来源、许可和例外范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、[学字 APP 数据来源与许可](儿童学字APP/数据来源与许可.md) 及 [编程小镇第三方说明](儿童编程/THIRD_PARTY_NOTICES.md)。

Unicode 笔画资料、pypinyin 拼音资料及 Phaser、Capacitor 等依赖保留原许可。字词朗读、倒计时报数和编程小镇童声为 Qwen3-TTS 生成的 AI 合成语音，模型权重未随仓库发布。学字 APP 的 47 段声母、韵母录音来自 cmguo/PinYinSound；截至本次整理，上游未声明许可证，不能依据本项目的许可证取得这些录音的授权。

## 验证范围

项目附有计时时间轴、识字记录、筛选分组、数据与音频完整性测试，以及学字界面的 Chromium 交互检查。测试方法见各应用 README。浏览器和构建检查不能替代 Android 真机上的安装、系统文件选择器、音频焦点与扬声器播放测试。
