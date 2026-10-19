import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sections=[`# Third-party notices

Wonder Town original software and accompanying original artwork, levels and documentation are licensed under PolyForm Noncommercial 1.0.0. See LICENSE and NOTICE.md. Third-party components retain their own licenses below.

The illustrations and icons are original SVG code. No Minecraft or Code.org artwork is included.

## AI-generated voice clips

The 53 bundled Chinese voice clips were generated with Qwen3-TTS-12Hz-1.7B-CustomVoice, using the Vivian preset and a consistent happy child-voice instruction. Per-clip provenance is in public/voice/voice-manifest.json and voice-jobs.json. The model and generation environment are not distributed.

- Project: https://github.com/QwenLM/Qwen3-TTS
- Model: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice
`];
for(const name of ['phaser','eventemitter3','@capacitor/core','@capacitor/android']){
  const folder=path.join(root,'node_modules',name),meta=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));
  const file=['LICENSE','LICENSE.md','LICENSE.txt'].map(n=>path.join(folder,n)).find(p=>fs.existsSync(p));
  if(!file)throw new Error(`Missing third-party license: ${name}`);
  sections.push(`## ${name} ${meta.version}\n\n${fs.readFileSync(file,'utf8')}`);
}
function write(file,text){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text)fs.writeFileSync(file,text);}
fs.mkdirSync(path.join(root,'public'),{recursive:true});
const notices=sections.join('\n');
write(path.join(root,'THIRD_PARTY_NOTICES.md'),notices);
write(path.join(root,'public','THIRD_PARTY_NOTICES.md'),notices);
for(const name of ['LICENSE','NOTICE.md'])write(path.join(root,'public',name),fs.readFileSync(path.join(root,name),'utf8'));
console.log('Application and dependency license notices prepared.');
