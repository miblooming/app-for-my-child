# 奇想学园 · 编程小镇

面向儿童的离线可视化编程游戏，支持 Android 和网页。当前版本 **v1.6.0**，包含 20 个单人关卡、10 个双人关卡、4 位动物伙伴及 53 段统一快乐童声。无需账号，无广告、内购或游戏中的外部请求。

原创内容采用 **[PolyForm Noncommercial 1.0.0 非商业许可证](LICENSE)**；商业用途需另行授权。第三方组件保留原许可，详见 [NOTICE.md](NOTICE.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 下载与玩法

[GitHub Release：APK、网页版与 SHA-256 校验](https://github.com/miblooming/app-for-my-child/releases/tag/wonder-town-v1.6.0)

- Android 最低为 8.0（API 26），需支持现代 JavaScript 的 Android System WebView。
- 网页发布包解压后，通过任意静态 HTTP 服务打开；请勿直接双击 `index.html`。
- 方向指令排成程序，小兔采萝卜、小熊做汤、小鸭配送、小狐卫士进入怪物所在格自动清怪。
- 几字长廊和指令格预算体现重复的作用；随机移动路障需要每次判断，双人接力与护送存在实际依赖。
- 场景网格占满宽度，程序横向滑动，指令按钮换行；支持嵌套重复框、如果分支、组合动作、长按排序、删除模式与撤销。
- 连续运行和步模式都高亮当前动作；“开始”是独立复位步骤。修改程序会暂停并回到起点。
- 音频按动作依次播放，当前动物等待自己的配音播完；其他伙伴可继续执行。支持本机存档导入导出。

完整操作说明见 [使用说明.md](使用说明.md)，版本变化见 [更新记录.md](更新记录.md)。

## 运行网页版

需要 Node.js 18+ 和 npm。成品音频已经包含在 `public/voice/`，不需要下载或运行 AI 模型。

```shell
npm ci
npm run dev
```

打开 `http://localhost:5178/`。Windows 也可双击 `启动预览.cmd`。

```shell
npm test
npm run build
npm run preview
```

`dist/` 是可部署到静态服务器的完整网页。首次安装 npm 依赖需要网络；游戏资源和语音均随构建离线提供。构建前会自动生成并打包本项目及第三方许可证。

## 构建 Android

技术栈为 TypeScript 5.7、Phaser 3.90、Vite 5.4、Capacitor 6.2。Android 使用 JDK 17、SDK Platform 35、Build Tools 35.0.0、Gradle 8.2.1 和 Android Gradle Plugin 8.2.1。

Windows PowerShell 7：

```powershell
npm ci
$env:JAVA_HOME = '你的 JDK 17 目录'
$env:ANDROID_SDK_ROOT = '你的 Android SDK 目录'
.\构建Android.ps1
```

构建脚本先构建网页、执行 Capacitor 同步，再用自带 Gradle Wrapper 构建签名 APK。首次运行可能下载 Gradle 和 Maven 依赖。产物写入 `交付文件/`，只保留最新版。

官方签名私钥不会随源码公开。首次自行构建会在本机 `signing/` 生成独立密钥，不能直接覆盖官方签名版本。请备份自己的签名；切换签名之前先导出游戏存档。`signing/`、机器配置和工具缓存被 Git 忽略。

其他平台可先运行 `npm run android:sync`，配置 SDK 后打开 `android/`；自行配置构建环境与签名。

## 验证与开发资料

97 项逻辑测试覆盖全部关卡、条件、旧存档迁移、资源守恒、嵌套重复、最短路径、接力依赖和清怪。移动路障解法对每关 64 个随机种子进行检查。`tests/*-smoke.mjs` 提供浏览器交互及真实音频检查，默认使用 Chrome 和本地开发服务。

已通过生产构建、浏览器检查及 Android 签名验证；尚未完成 Android 真机验收。签名安装包和网页版随 Release 提供；源码、图标、逐条配音来源与脚本保存在仓库。截图、报告、配音生成中间文件、模型和构建缓存留在本地开发目录，不随 Git 发布。

主要实现：`src/model.ts`（执行、资源与存档）、`src/levels.ts`（关卡）、`src/map.ts`（地形）、`src/scene.ts`（画面）、`src/main.ts`（交互）以及 `src/narration.ts`（动作配音顺序）。
