import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {planRegimiento,prepararRetiroRegimiento,mismaHuellaRegimiento,diagnosticarRetiroRegimiento,SUCURSAL,PEDIDOS} from '../firebase/uki-limpieza-regimiento-v1.mjs';
import {dividirEstado,reunirEstado} from '../firebase/uki-particion-local.js';
import {huellaOperativa} from '../firebase/uki-sushi-autoguardado.js';

const clone=x=>JSON.parse(JSON.stringify(x));
const stamp='2026-11-25T11:30:00-03:00';
const codes=['413','977','980','156','515','516','517','518','519'];
function estado(){
 return {suc:SUCURSAL,nextId:665,pedidos:[
  ...PEDIDOS.map((id,i)=>({id,suc:SUCURSAL,codigoCarta:codes[i],cartaSolicitudRemotaId:'00000000-0000-4000-8000-00000000000'+(i+1),
   numeroTurno:i+1,turnoClave:'2026-11-25@0',fechaISO:stamp,canceladoEn:stamp,estado:'Cancelado',total:9000,pagado:false})),
  {id:664,suc:SUCURSAL,estado:'Pendiente',codigoCarta:'413',pagado:false}],
  cierres:[{id:55,suc:SUCURSAL,efectivo:8000}],gastos:[],retiros:[],propinas:[{pedidoId:664,monto:1200}],
  clientes:{a:{movimientos:[{tipo:'venta',pedidoId:664}]}},cajasDiarias:{arica:{ventas:8000}},};
}
function remoto(s=estado()){
 return s.pedidos.slice(0,9).map(p=>({orderId:p.cartaSolicitudRemotaId,storeId:'uki:arica',pedidoInterno:p.id,
  codigoCarta:p.codigoCarta,total:9000,estadoPedido:'cancelada',estadoPago:'sin_transferencia',montoTransferencia:0,pagoRegistrado:false}));
}
function retirar(s=estado(),r=remoto(),extras={}){
 return prepararRetiroRegimiento({estado:s,consultas:r,revision:1732,identidad:'dueño simulado',fecha:stamp,...extras});
}
test('Elimina únicamente 655–663 de la copia operativa y mantiene caja, folios, timbres y otro pedido',()=>{
 const s=estado(),original=clone(s),{estado:candidato,filas}=retirar(s);
 assert.deepEqual(s,original);
 assert.deepEqual(filas.map(p=>p.id),PEDIDOS);
 assert.deepEqual(candidato.pedidos,[s.pedidos.at(-1)]);
 assert.deepEqual(candidato.pedidosPruebaRetirados.map(m=>m.numeroTurno),[1,2,3,4,5,6,7,8,9]);
 assert.ok(candidato.pedidosPruebaRetirados.every(m=>!Object.hasOwn(m,'total')));
 for(const k of ['nextId','clientes','cierres','gastos','retiros','propinas','cajasDiarias'])assert.deepEqual(candidato[k],s[k]);
 assert.equal(planRegimiento(candidato).hecho,true);
 assert.equal(retirar(candidato,[]).hecho,true);
});
test('Bloquea todo el lote si hay una identidad errónea, falta un folio o hay otro estado',()=>{
 for(const alter of [
  s=>{s.pedidos.splice(0,1);},s=>{s.suc='Uki La Serena';},s=>{s.pedidos[3].codigoCarta='923';},
  s=>{s.pedidos[0].estado='Entregado';},s=>{s.pedidos[0].pagado=true;},
  s=>{s.pedidos[0].timbreEnviadoEn=stamp;},s=>{s.pedidos[0].pagoConfirmadoEn=stamp;},
  s=>{s.propinas.push({pedidoId:655});},s=>{s.clientes.a.movimientos.push({tipo:'venta',pedidoId:655});},
  s=>{s.cajasDiarias.arica.otro={pedidoInterno:659};},s=>{s.pedidos[1].cartaSolicitudRemotaId=s.pedidos[0].cartaSolicitudRemotaId;}
 ]){
  const s=estado();alter(s);const original=clone(s);
  assert.throws(()=>retirar(s),undefined);
  assert.deepEqual(s,original);
 }
 assert.throws(()=>retirar(estado(),remoto(),{revisarCierre:p=>p.id===655}),/cierre/);
});
test('La carta también debe confirmar cancelación sin pago ni abono',()=>{
 for(const patch of [{estadoPago:'confirmada'},{estadoPago:'pendiente'},{pagoRegistrado:true},{montoTransferencia:2000},
  {pedidoInterno:654},{estadoPedido:'aceptada'},{storeId:'uki:serena'},{total:8999},{codigoCarta:'123'}]){
  const r=remoto();r[2]={...r[2],...patch};
  assert.throws(()=>retirar(estado(),r),/La carta no confirma/);
 }
});
test('El diagnóstico diferencia un aviso de timbre de una marca de pago, sin retirar pedidos',()=>{
 const s=estado();
 s.pedidos[0].timbreEnviadoEn=stamp;
 s.pedidos[1].pagoConfirmadoEn=stamp;
 s.pedidos[2].ajusteCobroPendiente={estado:'pendiente'};
 const original=clone(s);
 assert.deepEqual(diagnosticarRetiroRegimiento(s,p=>p.id===658),[
  'Pedido 655: timbre marcado como enviado','Pedido 656: marca de pago confirmado',
  'Pedido 657: registro de ajuste de cobro','Pedido 658: asociado a un cierre']);
 assert.throws(()=>retirar(s),/655: timbre marcado como enviado/);
 assert.deepEqual(s,original);
});
test('La revisión 1740 no se confunde con un cambio si la nube solo reordenó claves',()=>{
 const local={...estado(),borradores:[],solicitudesWhatsApp:[],incidencias:[],deliveriesManuales:[],ajustesHistoricos:[],
  propinas:[{suc:SUCURSAL,pedidoId:664,monto:1200}],
  vista:'inicio',filtro:'turno actual',clientes:{a:{nombre:'A'},b:{nombre:'B'},c:{nombre:'C'}}};
 const datosNube=reunirEstado(dividirEstado(local,SUCURSAL),SUCURSAL);
 datosNube.vista='pedidos';datosNube.filtro='últimos';
 const base=huellaOperativa(local),remota=huellaOperativa(datosNube);
 assert.notEqual(base,remota);
 assert.equal(mismaHuellaRegimiento(base,remota),true);
 const variantes=[s=>{s.nextId++;},s=>{s.pedidos[0].pagado=true;},s=>{s.pedidos.reverse();},
  s=>{s.clientes.a.nombre='cambio';},s=>{delete s.cajasDiarias.arica;}];
 for(const cambiar of variantes){
  const copia=clone(datosNube);cambiar(copia);
  assert.equal(mismaHuellaRegimiento(base,huellaOperativa(copia)),false);
 }
});
test('La ruta pide el PIN de dueños y solo escribe después de validar la copia de Regimiento',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const route=html.slice(html.indexOf("if(UKI_OPERACION_HABILITADA&&new URLSearchParams(location.search).get('limpieza-pruebas')"),html.indexOf('window.ukiOperativoActualizar=actualizarBloqueo;'));
 for(const s of ["'regimiento'","action:'ingresar_pin'","window.ukiCancelacionNubeLista","carta-solicitudes-live","seguimiento-personal-live","revisionEsperada:actual.revision","mod.planRegimiento(final.estado).hecho"])assert.ok(route.includes(s));
 assert.ok(route.indexOf('prepararRetiroRegimiento')<route.indexOf('cloud.guardar'));
 assert.ok(route.indexOf('actual.revision!==base.revision||!vigente()')<route.indexOf('mismaHuellaRegimiento'));
 assert.ok(route.indexOf('mismaHuellaRegimiento')<route.indexOf('cloud.guardar'));
 assert.match(route,/revisionEsperada:actual.revision/);
 const diagnostico=route.slice(route.indexOf("ver.addEventListener('click'"),route.indexOf("form.addEventListener('submit'"));
 assert.match(diagnostico,/diagnosticarRetiroRegimiento/);
 assert.doesNotMatch(diagnostico,/cloud\.guardar|ukiQASet|fetch\(/);
 assert.match(html,/pedidosSuc\(\),\.\.\.retirados/);
 const carta=readFileSync(new URL('../firebase/uki-carta-remotas-panel.js',import.meta.url),'utf8');
 assert.match(carta,/ukiSolicitudPruebaRetirada\?\.\(r.id,r.codigo_pedido\)/);
});

function probarCarga({leer,clave='clave-simulada',suc=SUCURSAL,limpieza=true,plazo=25000}={}){
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const accion=html.slice(html.indexOf('el("ukiLoadQA").addEventListener'),html.indexOf('el("ukiSaveQA").addEventListener'));
 const elements=new Map(), mensajes=[], llamadas=[];
 const el=id=>{
  if(!elements.has(id))elements.set(id,{hidden:true,addEventListener(_,fn){this.click=fn;}});
  return elements.get(id);
 };
 const estado={pedidos:[]},auth={currentUser:{uid:'simulado'}};
 el('ukiLimpiezaPruebasReg').hidden=!limpieza;el('ukiCloudPass').value=clave;
 const env={el,accion:fn=>fn(),contexto:()=>({suc,clave,estado}),huellaOperativa:JSON.stringify,auth,
  msg:s=>mensajes.push(s),window:{ukiQAGet:()=>({suc,estado}),ukiQASet:async data=>llamadas.push(['local',data])},
  setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,plazo)),clearTimeout,Error,
  cloud:{cargar:leer??(async()=>({revision:1732,estado}))},auto:{desactivar:()=>llamadas.push('off'),activar:()=>llamadas.push('on')},
  dejarDeVigilar:()=>{},vigilarRevisiones:()=>{},confirm:()=>{llamadas.push('aviso-nativo');return true;},
  revision:null,sucursalCargada:null};
 runInNewContext(accion,env);
 return {el,mensajes,llamadas,auth,click:()=>el('ukiLoadQA').click()};
}
test('Regimiento confirma dentro de la página y solo aplica la copia al tocar Usar respaldo',async()=>{
 const f=probarCarga();
 const done=f.click();
 assert.match(f.mensajes[0],/Conectando/);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.el('ukiConfirmarNubeLimpieza').hidden,false);
 assert.deepEqual(f.llamadas,[]);
 f.el('ukiAplicarNubeLimpieza').onclick();
 await done;
 assert.equal(f.el('ukiConfirmarNubeLimpieza').hidden,true);
 assert.deepEqual(f.llamadas,['off',['local',{pedidos:[]}],'on']);
});
test('Una lectura que no responde, una cancelación o un cambio de sesión no aplica datos',async()=>{
 const tarde=probarCarga({leer:()=>new Promise(()=>{}),plazo:2});
 await assert.rejects(tarde.click(),/no respondió a tiempo/);
 assert.deepEqual(tarde.llamadas,[]);
 for(const cancelar of [true,false]){
  const f=probarCarga(),done=f.click();
  await new Promise(resolve=>setImmediate(resolve));
  if(cancelar){f.el('ukiCancelarNubeLimpieza').onclick();await done;}
  else{f.auth.currentUser=null;f.el('ukiAplicarNubeLimpieza').onclick();await assert.rejects(done,/Cambió la sesión/);}
  assert.deepEqual(f.llamadas,[]);
 }
});
test('El panel habitual y La Serena conservan la confirmación normal',async()=>{
 for(const opts of [{limpieza:false},{suc:'Uki La Serena'}]){
  const f=probarCarga(opts);
  await f.click();
  assert.ok(f.llamadas.includes('aviso-nativo'));
  assert.equal(f.el('ukiConfirmarNubeLimpieza').hidden,true);
 }
});

