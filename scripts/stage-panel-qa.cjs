'use strict';
// Solo en la rama QA: expone una copia temporal del panel para pruebas Vercel.
// El panel real, inventario, pedidos, QR y los entornos productivos no cambian.
const fs=require('node:fs'),path=require('node:path');
if(process.env.VERCEL_ENV!=='preview'||
   process.env.VERCEL_GIT_COMMIT_REF!=='ui/uki-carta-promociones-categorias-descuentos-qa-20261111'){
 console.log('Panel QA: preparación omitida fuera de la vista de pruebas.');
 process.exit(0);
}
const from=path.resolve(__dirname,'../firebase');
const to=path.resolve(__dirname,'../public/qa-panel');
const allowed=new Set(['.html','.js','.mjs','.css','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico']);
let copied=0;
function copyStatic(dir,out){
 fs.mkdirSync(out,{recursive:true});
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  if(ent.name.startsWith('.')||ent.name==='node_modules'||ent.name==='__tests__')continue;
  const s=path.join(dir,ent.name),t=path.join(out,ent.name);
  if(ent.isDirectory())copyStatic(s,t);
  else if(ent.isFile()&&allowed.has(path.extname(ent.name).toLowerCase())){
   fs.copyFileSync(s,t);copied++;
  }
 }
}
if(!fs.existsSync(path.join(from,'uki-sushi-local.html')))throw Error('Falta la fuente original del panel QA');
copyStatic(from,to);
if(!fs.existsSync(path.join(to,'uki-carta-precios-admin.js')))throw Error('Falta Carta y precios en QA');
console.log('Panel QA: '+copied+' archivos estáticos preparados en /qa-panel/');
