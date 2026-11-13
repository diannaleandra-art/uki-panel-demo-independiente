import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {crearSesionNubeRomoEnPanelQA,ROMO_RUNTIME_HABILITADO_QA}
 from '../firebase/uki-romo-sesion-nube-qa.mjs';

const BRANCH='Romo’s Sushi La Serena';
const BASE='https://uki-sushi-inventario.vercel.app';
const STORE='romo:serena';
const TOKEN='a'.repeat(80);
const password='ClaveHabitualDeUkiEnPrueba123';
const requestId='00000000-0000-4000-8000-000000000001';
const claimToken='00000000-0000-4000-8000-000000000002';
const toB64=v=>Buffer.from(v).toString('base64');
const fromB64=v=>new Uint8Array(Buffer.from(v,'base64'));
const cryptoProvider=webcrypto;
const valid=x=>x?.suc===BRANCH&&Array.isArray(x?.pedidos);
const make=(cliente='Cliente QA')=>({
 suc:BRANCH,pedidos:[{id:1234,suc:BRANCH,
 cartaSolicitudRemotaId:requestId,cartaReservaToken:claimToken,
 productos:[{nombre:'Sushi 24',cantidad:1}],cliente}]
});
async function derive(pass,salt){
 const k=await cryptoProvider.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 return cryptoProvider.subtle.deriveKey({name:'PBKDF2',salt,iterations:300000,hash:'SHA-256'},
  k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(data,suc,key,salt){
 assert.equal(suc,BRANCH);
 const iv=cryptoProvider.getRandomValues(new Uint8Array(12));
 const value=await cryptoProvider.subtle.encrypt({name:'AES-GCM',iv,
  additionalData:new TextEncoder().encode('uki-v813-browser|1|'+suc)},
  key,new TextEncoder().encode(JSON.stringify(data)));
 return {formato:'uki-v813-browser',version:1,sucursal:suc,salt:toB64(salt),
  iv:toB64(iv),cifrado:toB64(value)};
}
async function openLocal(raw,suc,pass){
 const obj=JSON.parse(raw),salt=fromB64(obj.salt);
 const key=await derive(pass,salt);
 const bytes=await cryptoProvider.subtle.decrypt({name:'AES-GCM',iv:fromB64(obj.iv),
  additionalData:new TextEncoder().encode('uki-v813-browser|1|'+suc)},
  key,fromB64(obj.cifrado));
 return {estado:JSON.parse(new TextDecoder().decode(bytes)),key,salt};
}
function fakeCloud(){
 const state={rev:0,snapshot:null,accepted:0,events:[],lastBody:null,failAfterWrite:false};
 const fetchFn=async(uri,opt)=>{
  assert.ok(uri===BASE+'/api/romo-estado-operativo-qa'||
    uri===BASE+'/api/romo-solicitudes-carta-qa');
  assert.equal(opt.credentials,'omit');
  assert.equal(opt.headers.Authorization,'Bearer '+TOKEN);
  state.events.push({uri,method:opt.method});
  const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
  if(opt.method==='GET')return response(200,{
   ok:true,storeId:STORE,revision:state.rev,snapshot:state.snapshot
  });
  const body=JSON.parse(opt.body);
  state.lastBody=body;
  if(opt.method==='POST'){
   if(body.expectedRevision!==state.rev)return response(409,{ok:false});
   assert.equal(body.snapshot.sucursal,BRANCH);
   assert.ok(body.snapshot.cifrado.length>20);
   state.snapshot=body.snapshot;state.rev++;
   if(state.failAfterWrite){state.failAfterWrite=false;throw Error('Respuesta perdida');}
   return response(200,{ok:true,storeId:STORE,revision:state.rev,
    ...(body.solicitudCarta?{comprobante:'prueba_de_servidor_'.repeat(5),
      expiresAt:Date.now()+240000}:{})});
  }
  assert.equal(opt.method,'PATCH');
  assert.equal(uri,BASE+'/api/romo-solicitudes-carta-qa');
  assert.equal(body.storeId,STORE);
  assert.equal(body.estado,'aceptada');
  assert.equal(body.pedidoId,'1234');
  assert.equal(body.id,requestId);
  state.accepted++;
  return response(200,{ok:true,storeId:STORE,estado:'aceptada',
   pedidoInterno:body.pedidoId,countsAsSale:false,whatsappConfirmado:false});
 };
 return {state,fetchFn};
}
function session(cloud,enabled=true){
 return crearSesionNubeRomoEnPanelQA({enabled,fetchFn:cloud.fetchFn,
  getToken:async()=>TOKEN});
}
const login=s=>s.abrir({password,abrirLocal:openLocal,derivarClave:derive,
 validarEstado:valid,cryptoProvider});
const persist=(s,estado,solicitudCarta=null)=>s.guardar({
 estado,solicitudCarta,cifrarLocal:encrypt,validarEstado:valid
});
test('Romo está cerrado en la página real, aun antes de contactar Google',async()=>{
 assert.equal(ROMO_RUNTIME_HABILITADO_QA,false);
 const cloud=fakeCloud(),s=session(cloud,false);
 assert.equal(s.disponible(),false);
 await assert.rejects(login(s),/cerrada/);
 assert.equal(cloud.state.events.length,0);
});
test('dos teléfonos abren y guardan el MISMO estado cifrado, con revisión optimista',async()=>{
 const cloud=fakeCloud(),a=session(cloud),b=session(cloud);
 const first=await login(a);
 assert.equal(first.revision,0);
 assert.equal(first.estado,null);
 const value=make();
 const saved=await persist(a,value);
 assert.equal(saved.revision,1);
 assert.equal(cloud.state.rev,1);
 assert.equal(cloud.state.lastBody.expectedRevision,0);
 assert.ok(!JSON.stringify(cloud.state.lastBody).includes('Cliente QA'));
 assert.ok(!JSON.stringify(cloud.state.lastBody).includes(password));
 const other=await login(b);
 assert.equal(other.revision,1);
 assert.equal(other.estado.pedidos[0].cliente,'Cliente QA');
 const newer=make('Segundo teléfono');
 const changed=await persist(b,newer);
 assert.equal(changed.revision,2);
 await assert.rejects(persist(a,make('Equipo antiguo')),e=>e.code==='ROMO_CONFLICTO');
 assert.equal(a.resumen().bloqueada,true);
 assert.equal(cloud.state.rev,2);
 assert.equal(cloud.state.accepted,0);
 const recovered=await login(a);
 assert.equal(recovered.revision,2);
 assert.equal(recovered.estado.pedidos[0].cliente,'Segundo teléfono');
});
test('respuesta perdida obliga recargar, nunca repite automáticamente el pedido',async()=>{
 const cloud=fakeCloud(),s=session(cloud);
 await login(s);
 cloud.state.failAfterWrite=true;
 await assert.rejects(persist(s,make('Mensaje incierto')),e=>e.code==='ROMO_GUARDADO_INCIERTO');
 assert.equal(cloud.state.rev,1);
 assert.equal(s.resumen().bloqueada,true);
 assert.equal(cloud.state.events.filter(x=>x.method==='POST').length,1);
 await assert.rejects(persist(s,make()),/conciliar/);
 const reloaded=await login(s);
 assert.equal(reloaded.estado.pedidos[0].cliente,'Mensaje incierto');
});
test('primero guarda cifrado, después acepta solicitud; no duplica caja',async()=>{
 const cloud=fakeCloud(),s=session(cloud);
 await login(s);
 const done=await s.guardarYAceptar({
  estado:make(),solicitudCarta:{requestId,claimToken,pedidoId:'1234'},
  cifrarLocal:encrypt,validarEstado:valid
 });
 assert.equal(done.estado,'aceptada');
 assert.equal(done.cuentaVentaAdicional,false);
 assert.equal(done.requiereConciliacion,false);
 assert.deepEqual(cloud.state.events.map(x=>x.method),['GET','POST','PATCH']);
 assert.equal(cloud.state.accepted,1);
});
test('sin pedido vinculado no registra respaldo ni aceptación',async()=>{
 const cloud=fakeCloud(),s=session(cloud);
 await login(s);
 await assert.rejects(s.guardarYAceptar({
  estado:{suc:BRANCH,pedidos:[]},solicitudCarta:{requestId,claimToken,pedidoId:'1234'},
  cifrarLocal:encrypt,validarEstado:valid
 }),/Primero debes guardar/);
 assert.deepEqual(cloud.state.events.map(x=>x.method),['GET']);
});
test('No hay rutas de Uki ni claves en claro en la interfaz remota',()=>{
 const source=String(crearSesionNubeRomoEnPanelQA);
 assert.doesNotMatch(source,/uki-sushi-pedidos|uki_carta|window\\.localStorage\\.setItem/);
 assert.match(source,/Authorization:'Bearer '/);
 assert.match(source,/credentials:'omit'/);
});
