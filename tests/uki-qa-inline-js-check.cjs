'use strict';
const {readFileSync,mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
 .filter(x=>/\btype\s*=\s*["']module["']/i.test(x[1]));
assert.ok(scripts.length>0,'el panel QA debe contener el módulo Firebase y QR');
const folder=mkdtempSync(join(tmpdir(),'uki-inline-qa-'));
try{
 scripts.forEach((s,i)=>{
  const p=join(folder,'script-'+i+'.mjs');
  writeFileSync(p,s[2]);
  const result=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(result.status,0,
   'Error de sintaxis del módulo inline '+i+'\n'+result.stderr);
 });
 console.log('Uki QA: '+scripts.length+' módulo(s) HTML con sintaxis válida');
}finally{rmSync(folder,{recursive:true,force:true})}
