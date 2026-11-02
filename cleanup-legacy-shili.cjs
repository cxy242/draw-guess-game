'use strict';
const fs=require('node:fs');
const path=require('node:path');
// Remove only the two superseded UI implementations in this project directory.
// Browser IndexedDB, localStorage and other applications are unaffected.
for(const relative of ['js/shili.js','shili-app.html']){
  try{fs.unlinkSync(path.join(__dirname,relative));console.log('[拾礼] 已清理旧界面代码：'+relative);}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
