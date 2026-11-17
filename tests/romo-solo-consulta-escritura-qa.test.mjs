import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crearPuenteRomoOperativoQA} from '../public/romo-panel-qa/uki-romo-operativo-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const snapshot=()=>({
 formato:'uki-v813-browser',version:1,sucursal:SUC,
 salt:'YWFhYWFhYWFhYWFhYWFhYQ==',iv:'YmJiYmJiYmJiYmJi',
 cifrado:'Y2NjY2NjY2NjY2NjY2NjY2NjY2M='
});
const bridge=({flag=false,failGet=false}={})=>{
 const methods=[];
 const fetchFn=async(_url,init)=>{
  methods.push(init.method);
  if(init.method==='POST')return {
   ok:true,status:200,json:async()=>({ok:true,storeId:'romo:serena',revision:2})
  };
  if(failGet)return {ok:false,status:503};
  return {ok:true,status:200,json:async()=>({
   ok:true,storeId:'romo:serena',revision:1,snapshot:snapshot(),
   escrituraHabilitada:flag
  })};
 };
 const client=crearPuenteRomoOperativoQA({
  getGoogleToken:async()=>('token-de-prueba-'+ 'x'.repeat(40)),
  fetchFn,cifrar:async()=>snapshot(),descifrar:async()=>({suc:SUC}),
  validarEstado:()=>true
 });
 return {client,methods};
};

test('Romo permanece sin POST antes del GET autenticado',async()=>{
 const {client,methods}=bridge({flag:true});
 assert.equal(client.escrituraHabilitada(),false);
 await assert.rejects(client.guardarSobre({
  expectedRevision:1,snapshot:snapshot()
 }),/modo consulta/i);
 assert.deepEqual(methods,[]);
});
test('GET de Neon indica solo consulta: se conserva la lectura y se bloquea guardar',async()=>{
 const {client,methods}=bridge({flag:false});
 const data=await client.cargarSobre();
 assert.equal(data.storeId,'romo:serena');
 assert.equal(data.revision,1);
 assert.equal(data.escrituraHabilitada,false);
 assert.equal(client.escrituraHabilitada(),false);
 await assert.rejects(client.guardarSobre({
  expectedRevision:1,snapshot:snapshot()
 }),/modo consulta/i);
 assert.deepEqual(methods,['GET']);
});
test('Un GET fallido vuelve a bloquear escritura aun si estaba permitida',async()=>{
 let permite=true;
 const methods=[];
 const client=crearPuenteRomoOperativoQA({
  getGoogleToken:async()=>('token-de-prueba-'+ 'x'.repeat(40)),
  fetchFn:async(_url,init)=>{
   methods.push(init.method);
   return permite?
    {ok:true,status:200,json:async()=>({
     ok:true,storeId:'romo:serena',revision:1,snapshot:snapshot(),
     escrituraHabilitada:true
    })}:
    {ok:false,status:503};
  },
  cifrar:async()=>snapshot(),descifrar:async()=>({suc:SUC}),
  validarEstado:()=>true
 });
 await client.cargarSobre();
 assert.equal(client.escrituraHabilitada(),true);
 permite=false;
 await assert.rejects(client.cargarSobre(),/No se confirmó/);
 assert.equal(client.escrituraHabilitada(),false);
 await assert.rejects(client.guardarSobre({
  expectedRevision:1,snapshot:snapshot()
 }),/modo consulta/i);
 assert.deepEqual(methods,['GET','GET']);
});
test('El puente admite guardar solo tras GET con autorización afirmativa; sin datos reales',async()=>{
 const {client,methods}=bridge({flag:true});
 await client.cargarSobre();
 assert.equal(client.escrituraHabilitada(),true);
 const res=await client.guardarSobre({expectedRevision:1,snapshot:snapshot()});
 assert.equal(res.revision,2);
 assert.deepEqual(methods,['GET','POST']);
});
test('La interfaz deshabilita cancelación si Vercel no autorizó escritura',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/romo-estado-cifrado-panel-qa.js',import.meta.url),'utf8');
 const adapter=readFileSync(new URL('../public/romo-panel-qa/uki-romo-integracion-panel-qa.mjs',import.meta.url),'utf8');
 assert.match(html,/SOLO CONSULTA · guardado desactivado/);
 assert.match(html,/disabled title="Guardado de Romo desactivado"/);
 assert.match(html,/cancelaciones y entregas bloqueadas/);
 assert.match(adapter,/window\.ukiRomoGuardadoHabilitadoQA/);
 assert.match(api,/escrituraHabilitada:Boolean\(conf\.writer/);
 assert.match(api,/ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED!=='true'/);
 assert.match(api,/ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED!=='true'/);
});
