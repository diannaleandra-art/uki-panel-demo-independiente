'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function ejecutarInterfaz(script,{romo=false,editarDuranteCompresion=false,pendienteNeon=false,revisionRemotaCambio=false,fechaPrueba='2026-12-06T12:00:00Z'}={}){
 const suc=romo?'Romo’s Sushi La Serena':'Uki Regimiento Arica';
 const estado={suc,pedidos:[{id:1,suc}],vista:'caja'};
 const confirmado={suc,pedidos:[{id:1,suc}],vista:'copiaNeon'};
 const controles={},actions=[],html={dataset:{},append(){},
  querySelector(sel){
   const id=sel.slice(1);
   if(!controles[id])controles[id]={id,value:'',style:{},disabled:false,
    listeners:{},addEventListener(name,cb){this.listeners[name]=cb;}};
   return controles[id];
  }};
 const doc={readyState:'complete',getElementById(id){
  return id==='app'?{}:id==='ukiArchivoMensualRoot'?html:null;
 },createElement(){return {innerHTML:'',className:''};}};
 let verificacionesRemotas=0;
 const revisionActual=async()=>{verificacionesRemotas++;return !revisionRemotaCambio||verificacionesRemotas===1;};
 const ventana={
  ukiArchivoComprobarNube:revisionActual,
  ukiQAGet:()=>({suc,estado:JSON.parse(JSON.stringify(estado))}),
  ukiCancelacionNubeLista:()=>true,
  ukiInventarioToken:async()=> 'token-google-de-prueba',
  ukiRomoGuardadoHabilitadoQA:()=>true,
  ukiRomoSesionRemotaQA:{
   disponible:()=>true,
   estado:()=>({conflicto:false}),
   comprobarRevisionParaArchivo:revisionActual,
   coincideEstadoOperativo:()=>!pendienteNeon,
   estadoOperativoConfirmado:()=>JSON.parse(JSON.stringify(confirmado))
  },
  UkiArchivoMensual:{
   periodo:()=>({desdeDia5:'2026-12-05'}),
   generar(datos,mes){
    generarDesde=datos;
    return {sucursal:romo?'romo:serena':'uki:arica',mes,sinFecha:{},version:1,registros:{pedidos:[]}};
   },
   async empaquetar(){
    if(editarDuranteCompresion)estado.pedidos.push({id:2,suc});
    return {sha256:'a'.repeat(64),encoding:'json',base64:'e30='};
   },
   async desempaquetar(){return documento;}
  }
 };
 let generarDesde=null,documento=null;
 const original=ventana.UkiArchivoMensual.generar;
 ventana.UkiArchivoMensual.generar=(...args)=>{documento=original(...args);return documento;};
 const fetchMock=async(_url,opts)=>{
  const b=JSON.parse(opts.body);actions.push(b.action);
  const data=b.action==='ingresar_pin'?{ok:true,sesion:'b'.repeat(64)}:
   b.action==='guardar'?{ok:true,confirmado:true,sha256:'a'.repeat(64),mes:'2026-11'}:
   {ok:true,archivo:{sha256:'a'.repeat(64),encoding:'json',base64:'e30='}};
  return {ok:true,async json(){return data;}};
 };
 class FechaPrueba extends Date{constructor(...args){super(...(args.length?args:[fechaPrueba]));}}
 vm.runInNewContext(script,{
  window:ventana,document:doc,fetch:fetchMock,Intl,Date:FechaPrueba,JSON,console,
  MutationObserver:class{observe(){}}
 },{timeout:3000});
 controles.ukiArchivoMes.value='2026-11';
 controles.ukiArchivoPin.value='123456';
 return {
  async click(){await controles.ukiArchivoGuardar.listeners.click();return {
   actions,desde:generarDesde,estado:controles.ukiArchivoEstado.textContent,
   botonDesactivado:controles.ukiArchivoGuardar.disabled,
   pinOculto:controles.ukiArchivoPinArea.hidden,
   modo:ventana.ukiRomoSesionRemotaQA.estado(),original:JSON.parse(JSON.stringify(estado))
  }}
 };
}
const uki=path.join(root,'firebase/uki-archivo-mensual-panel.js');
if(fs.existsSync(uki)){
 const source=fs.readFileSync(uki,'utf8');
 test('Uki detiene el envío si cambia un pedido durante la compresión',async()=>{
  const q=await ejecutarInterfaz(source,{editarDuranteCompresion:true}).click();
  assert.deepEqual(q.actions,['ingresar_pin']);
  assert.match(q.estado,/cambió|reintenta/);
 });
 test('Uki verifica que la nube esté sincronizada antes y después',()=>{
  assert.ok((source.match(/verificarNube\(contexto\.suc\)/g)||[]).length>=2);
 });
 test('Uki bloquea subida si Firebase avisa de nueva revisión antes de guardar',async()=>{
  const q=await ejecutarInterfaz(source,{revisionRemotaCambio:true}).click();
  assert.deepEqual(q.actions,['ingresar_pin']);
  assert.match(q.estado,/revisión más reciente/);
 });
}
const romo=path.join(root,'public/romo-panel-qa/uki-archivo-mensual-panel.js');
if(fs.existsSync(romo)){
 const source=fs.readFileSync(romo,'utf8');
 test('Romo rechaza un respaldo con modificaciones no confirmadas por Neon',async()=>{
  const q=await ejecutarInterfaz(source,{romo:true,pendienteNeon:true}).click();
  assert.deepEqual(q.actions,[]);
  assert.match(q.estado,/aún no confirmada/);
 });
 test('Romo crea el archivo desde Neon confirmado y verifica la copia',async()=>{
  const q=await ejecutarInterfaz(source,{romo:true}).click();
  assert.equal(q.desde.vista,'copiaNeon');
  assert.deepEqual(q.actions,['ingresar_pin','guardar','consultar']);
  assert.match(q.estado,/guardado y comprobado/);
 });
 test('Romo no sube datos si la pantalla cambia durante compresión',async()=>{
  const q=await ejecutarInterfaz(source,{romo:true,editarDuranteCompresion:true}).click();
  assert.deepEqual(q.actions,['ingresar_pin']);
  assert.match(q.estado,/cambió|reintenta/);
 });
 test('Romo bloquea archivo al detectar una revisión nueva de Neon',async()=>{
  const q=await ejecutarInterfaz(source,{romo:true,revisionRemotaCambio:true}).click();
  assert.deepEqual(q.actions,['ingresar_pin']);
  assert.match(q.estado,/revisión más reciente/);
 });
}

test('mes predeterminado respeta el día 5 y no abre un período futuro',()=>{
 for(const file of ['firebase/uki-archivo-mensual-panel.js',
  'public/romo-panel-qa/uki-archivo-mensual-panel.js']){
  const full=path.join(root,file);if(!fs.existsSync(full))continue;
  const c=fs.readFileSync(full,'utf8');
  const i=c.indexOf('function mesInicial(){'),j=c.indexOf('async function llamar(',i);
  assert.ok(i>=0&&j>i,'No se encontró el cálculo de mes permitido');
  const calcula=new Function('hoyChile',c.slice(i,j)+'return mesInicial;');
  for(const [hoy,esperado] of [
   ['2026-11-21','2026-11'],
   ['2026-12-04','2026-11'],
   ['2026-12-05','2026-11'],
   ['2027-01-04','2026-11'],
   ['2027-01-05','2026-12'],
   ['2027-02-05','2027-01']]){
   assert.equal(calcula(()=>hoy)(),esperado,file+' '+hoy);
  }
 }
});

test('respaldo simple: un botón principal, PIN habitual y descargas opcionales',()=>{
 for(const file of ['firebase/uki-archivo-mensual-panel.js',
  'public/romo-panel-qa/uki-archivo-mensual-panel.js']){
  const full=path.join(root,file);if(!fs.existsSync(full))continue;
  const src=fs.readFileSync(full,'utf8');
  assert.match(src,/Respaldo mensual/);
  assert.match(src,/id="ukiArchivoGuardar"/);
  assert.match(src,/id="ukiArchivoPinArea"/);
  assert.match(src,/Otros meses y descargas/);
  assert.match(src,/pinArea\.hidden=true/);
  assert.match(src,/b\.disabled=!permitido/);
 }
});
