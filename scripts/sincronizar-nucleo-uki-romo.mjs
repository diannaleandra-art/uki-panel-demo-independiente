/**
 * Sincronizador controlado del núcleo compartido. Solo archivos puros.
 * Por defecto informa diferencias; no despliega ni accede a bases de datos.
 * Ejecutar en la rama de integración Romo, con la revisión oficial Uki aprobada.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const git=(...args)=>execFileSync('git',args,{maxBuffer:10*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(readFileSync(new URL('./nucleo-uki-romo.json',import.meta.url),'utf8'));
const [ref,mode]=process.argv.slice(2);
if(!/^[0-9a-f]{40}$/.test(ref||'')||(mode!==undefined&&mode!=='--aplicar'))throw Error('Uso: node scripts/sincronizar-nucleo-uki-romo.mjs SHA_UKI [--aplicar]');
if(!/^[0-9a-f]{40}$/.test(manifest.baseUki))throw Error('Base Uki no verificada');
const branch=git('branch','--show-current').toString().trim();
if(mode==='--aplicar'&&!/^integracion\/romo-/.test(branch))throw Error('Solo aplicar en la rama de integración Romo; nunca en main o producción');
git('merge-base','--is-ancestor',manifest.baseUki,ref);
// Toda modificación funcional en Uki debe quedar clasificada, incluso si
// no pertenece a los módulos idénticos. No copiar adaptadores automáticamente.
const sharedSources=new Set(manifest.modules.map(x=>x.source));
const changedPaths=git('diff','--name-only',manifest.baseUki,ref).toString().trim().split('\n').filter(Boolean);
const manual=changedPaths.filter(p=>!sharedSources.has(p)&&/^(firebase\/|public\/|api\/|lib\/|migrations\/|vercel\.json$|package\.json$)/.test(p));
if(manual.length){
 console.log('Cambios adicionales que requieren revisión funcional y adaptación Romo:');
 console.table(manual.map(path=>({path,estado:'revisión necesaria'})));
}
if(mode==='--aplicar'&&manual.length)throw Error('Hay modificaciones fuera del núcleo compartido; conciliar todos los adaptadores antes de avanzar la base Uki.');
const operations=[];
for(const {source,target,baseUki:moduleBase=manifest.baseUki} of manifest.modules){
 if(!/^[0-9a-f]{40}$/.test(moduleBase))throw Error('Base de módulo no verificada: '+source);
 git('merge-base','--is-ancestor',moduleBase,ref);
 const previous=git('show',moduleBase+':'+source);
 const next=git('show',ref+':'+source);
 const local=readFileSync(target);
 const conflict=hash(local)!==hash(previous)&&hash(local)!==hash(next);
 operations.push({source,target,changed:hash(local)!==hash(next),conflict,next});
}
console.table(operations.map(({next,...row})=>row));
if(operations.some(x=>x.conflict))throw Error('Una adaptación Romo difiere de Uki: revisar manualmente; no se sobrescribió nada');
if(mode==='--aplicar'){
 if(git('status','--porcelain').toString().trim())throw Error('Comienza desde un árbol Git limpio');
 for(const op of operations.filter(x=>x.changed))writeFileSync(op.target,op.next);
 manifest.baseUki=ref;
 for(const module of manifest.modules)delete module.baseUki;
 writeFileSync(new URL('./nucleo-uki-romo.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
 console.log('Núcleo actualizado localmente, pendiente de revisión, pruebas manuales y publicación.');
}else console.log('Solo comparación. Sin escrituras ni despliegues.');
