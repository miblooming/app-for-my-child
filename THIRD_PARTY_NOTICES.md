# 第三方资源说明

根目录 PolyForm Noncommercial 1.0.0 适用于本仓库原创代码和文档，不替代下列第三方资源的许可，也不授予第三方未明确提供的权利。

## Unicode Unihan

- 用途：字芽识字中汉字的笔画数，取自 Unicode Unihan 17.0.0 的 `kTotalStrokes`。
- 官方数据：<https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip>。
- 字段说明：<https://www.unicode.org/reports/tr38/#kTotalStrokes>。
- 许可：Unicode License V3，完整文本保存在 `儿童学字APP/app/src/main/assets/www/licenses/UNICODE-LICENSE.txt`。
- 仅发布应用使用的整理结果，不附完整上游数据集。

## pypinyin

- 用途：生成学字 APP 字库中的拼音和词语读音；APP 运行时不加载 pypinyin。
- 来源：<https://github.com/mozillazg/python-pinyin>，生成时版本 0.55.0。
- 许可：MIT，保留原作者版权与完整许可，位于 `儿童学字APP/app/src/main/assets/www/licenses/PYPINYIN-LICENSE.txt`。
- Python 包及依赖未随仓库发布。

## AI 合成语音

- 来源：<https://github.com/QwenLM/Qwen3-TTS>。
- 模型：<https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice>。
- 该上游项目采用 Apache-2.0；模型代码与权重均未包含在本仓库中。
- 倒计时使用 Dylan 预设声线；字词朗读使用 Serena 预设声线。这里只保存成品音频及其来源清单，手机端不执行语音模型。
- 倒计时来源与时长配置：`倒计时APP/app/src/main/assets/voice-pack.json`。
- 学字字词朗读生成记录：`儿童学字APP/audio/sources/tts-voice-manifest.json`；其中模型节的 `defaultSpeaker` 为生成工具的默认值，每段实际使用的声线以对应 `clips` 条目中的 `speaker` 为准。

## 声母、韵母录音

- 来源：<https://github.com/cmguo/PinYinSound>。
- 使用范围：23 个声母和 24 个韵母，共 47 段，位于 `儿童学字APP/app/src/main/assets/www/audio/i_*.mp3` 和 `f_*.mp3`。
- 每段原始文件地址：`儿童学字APP/audio/sources/pinyin-source-manifest.json`。应用内成品经过采样率、音量与首尾静音处理。
- 截至 2026-10-19，上游仓库未提供 LICENSE，也未声明明确的再分发许可。本仓库保留来源说明，不将这些录音重新许可为本项目许可证。复用或再分发这些录音时，应另行向原权利人核实授权。

## 识字表整理结果

字库的汉字顺序由项目提供的 15 页、2,500 字识字表提取并人工核对，字词内容经过整理。原始图片、手工星标和孩子的测试成绩均未发布。字库内容与整理范围详见 `儿童学字APP/数据来源与许可.md`。
