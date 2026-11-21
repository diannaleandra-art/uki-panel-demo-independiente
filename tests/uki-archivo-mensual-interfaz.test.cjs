'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function ejecutarInterfaz(script,{romo=false,editarDuranteCompresion=false,pendienteNeon=false}={}){
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
 const ventana={
  ukiQAGet:()=>({suc,estado:JSON.parse(JSON.stringify(estado))}),
  ukiCancelacionNubeLista:()=>true,
  ukiInventarioToken:async()=> 'token-google-de-prueba',
  ukiRomoGuardadoHabilitadoQA:()=>true,
  ukiRomoSesionRemotaQA:{
   disponible:()=>true,
   estado:()=>({conflicto:false}),
   coincideEstadoOperativo:()=>!pendienteNeon,
   estadoOperativoConfirmado:()=>JSON.parse(JSON.stringify(confirmado))
  },
  UkiArchivoMensual:{
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
 vm.runInNewContext(script,{
  window:ventana,document:doc,fetch:fetchMock,Intl,Date,JSON,console,
  MutationObserver:class{observe(){}}
 },{timeout:3000});
 controles.ukiArchivoMes.value='2026-11';
 controles.ukiArchivoPin.value='123456';
 return {
  async click(){await controles.ukiArchivoGuardar.listeners.click();return {
   actions,desde:generarDesde,estado:controles.ukiArchivoEstado.textContent,
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
  assert.match(q.estado,/recuperado correctamente/);
 });
 test('Romo no sube datos si la pantalla cambia durante compresión',async()=>{
  const q=await ejecutarInterfaz(source,{romo:true,editarDuranteCompresion:true}).click();
  assert.deepEqual(q.actions,['ingresar_pin']);
  assert.match(q.estado,/cambió|reintenta/);
 });
}
