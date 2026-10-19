import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({deviceScaleFactor:1});
const svg=fs.readFileSync('public/icon.svg','utf8');
for(const [density,scale] of [['mdpi',1],['hdpi',1.5],['xhdpi',2],['xxhdpi',3],['xxxhdpi',4]]){
  const dir=`android/app/src/main/res/mipmap-${density}`;fs.mkdirSync(dir,{recursive:true});
  for(const [name,size] of [['ic_launcher',48],['ic_launcher_round',48],['ic_launcher_foreground',108]]){
    const px=Math.round(size*scale);await page.setViewportSize({width:px,height:px});
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%}</style>${svg}`);
    await page.screenshot({path:`${dir}/${name}.png`,omitBackground:true});
  }
}
await browser.close();console.log('Original app icons rendered at all Android densities.');
