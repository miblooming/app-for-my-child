import fs from 'node:fs';
import {LEVELS} from '../src/levels';
const root=new URL('../',import.meta.url);
const read=(path:string)=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const data=read('voice-jobs.json'),preset=data.jobs[0];
const extraIds=['action-failure','action-complete','action-attack','action-deliver-carrot','action-try-repeat','action-try-if','action-try-limit'];
data.jobs=data.jobs.filter((j:{id:string})=>!/^level\d+$/.test(j.id)&&!j.id.startsWith('guide-')&&!extraIds.includes(j.id));
const voice=(id:string,text:string)=>({id,text,speaker:preset.speaker,instruct:preset.instruct});
data.jobs.push(...LEVELS.map(l=>voice('guide-'+l.id,l.intro.replace(/\s/g,''))),voice('action-failure','未到达目的地，任务失败了。'),voice('action-complete','到达目的地，任务完成啦！'),voice('action-attack','怪物消灭啦！'),voice('action-deliver-carrot','萝卜送到啦！'),voice('action-try-repeat','试试重复指令吧！'),voice('action-try-if','先用如果判断吧！'),voice('action-try-limit','把程序变短一点吧！'));
fs.writeFileSync(new URL('voice-jobs.json',root),JSON.stringify(data,null,2)+'\n');
const manifest=read('audio/voice-manifest.json');
for(let i=0;i<7;i++){
  delete manifest.clips['level'+i];
  for(const path of [`audio/level${i}.wav`,`public/voice/level${i}.mp3`]){
    const file=new URL(path,root);if(fs.existsSync(file))fs.unlinkSync(file);
  }
}
fs.writeFileSync(new URL('audio/voice-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${data.jobs.length} unified voice jobs.`);
