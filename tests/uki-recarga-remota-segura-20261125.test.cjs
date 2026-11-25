'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const start=html.indexOf('let recargaRemotaEnCurso=false;'),end=html.indexOf('window.ukiQAOnLocalSaved=s=>',start);
assert.ok(start>=0&&end>start);
const code=html.slice(start,end);
function scenario(suc,opts={}){
 let ctx={suc,estado:{suc,pedidos:[{id:1}]}},status={activo:true,bloqueado:false,estado:'sincronizado',revision:10,sucursal:suc,actualRespaldado:!opts.dirty},cb,load=0,applied=0,activated=0,rendered=0;
 const w={ukiQAGet:()=>ctx,ukiPuedeRecargarRemoto:()=>!opts.editing,
  ukiAplicarRemotoLimpio:async(data,check)=>{if(!check())return false;ctx={suc,estado:data};applied++;return true;},
  ukiRenderRemotoLimpio:()=>rendered++};
 const a={resumen:()=>({...status}),revisionRemota:n=>{if(n>status.revision){status.bloqueado=true;status.estado='conflicto'}},
  activar:({rev})=>{status={...status,bloqueado:false,estado:'sincronizado',revision:rev};activated++;}};
 const run=new Function('auto','window','auth','huellaOperativa','cloud','getDocFromServer','doc','db','claveNube','actualizarPresentacionNube','el','msg','actualizarBloqueo','onSnapshot',
  'let ocupado=false,revision=null,sucursalCargada=null,desuscribir=null;function dejarDeVigilar(){if(desuscribir)desuscribir();desuscribir=null;}\n'+code+'\nreturn {vigilarRevisiones};')(
  a,w,{currentUser:{uid:'fixture'}},JSON.stringify,{cargar:async()=>{load++;if(opts.mutate)ctx.estado.pedidos.push({id:2});if(opts.other)ctx={suc:'otra',estado:{suc:'otra'}};return {revision:11,estado:{suc,pedidos:[{id:1},{id:3}]}};}},
  async()=>({exists:()=>true,data:()=>({rev:opts.stale?12:11})}),()=>({}),{},()=> 'fixture',()=>{},()=>({textContent:''}),()=>{},()=>{},(_,__,handler)=>{cb=handler;return ()=>{}});
 run.vigilarRevisiones(suc);
 return {fire:async()=>{cb({metadata:{fromCache:false,hasPendingWrites:false},exists:()=>true,data:()=>({rev:11})});for(let i=0;i<20;i++)await Promise.resolve();},
  result:()=>({load,applied,activated,rendered,revision:status.revision,blocked:status.bloqueado})};
}
for(const suc of ['Uki Regimiento Arica','Uki La Serena']){
 test(suc+': actualiza solo una copia limpia sin bloquear permanentemente',async()=>{
  const t=scenario(suc);await t.fire();assert.deepEqual(t.result(),{load:1,applied:1,activated:1,rendered:1,revision:11,blocked:false});
 });
 for(const k of ['dirty','editing','mutate','stale','other']){
  test(suc+': conserva protección ante '+k,async()=>{const t=scenario(suc,{[k]:true});await t.fire();assert.equal(t.result().applied,0);assert.equal(t.result().activated,0);assert.equal(t.result().blocked,true);});
 }
}
test('No se sustituye la copia local después del cifrado si cambia la sesión o el estado',()=>{
 const section=html.slice(html.indexOf('window.ukiAplicarRemotoLimpio='),html.indexOf('window.ukiRenderRemotoLimpio='));
 assert.match(section,/await cifrarLocal\(/);assert.match(section,/if\(!vigente\(\)\|\|claveSesion!==key\|\|sucursalSesion!==suc\)return false;\s*revisionGuardado\+\+/);
 assert.doesNotMatch(section,/cloud\.guardar|ukiQAOnLocalSaved/);
});
