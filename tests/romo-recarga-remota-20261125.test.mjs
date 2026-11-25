import test from 'node:test';
import assert from 'node:assert/strict';
import {crearSesionPanelUnicoRomoQA} from '../public/romo-panel-qa/romo-panel-unico-sesion-qa.mjs';
const suc='Romo’s Sushi La Serena',make=()=>({suc,pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],deliveriesManuales:[],incidencias:[],clientes:{},cajasDiarias:{}});
for(const opt of ['limpio','sin-cambio','edicion','mutacion','otra-revision','otra-sucursal','salir']){
 test('Romo actualiza sin escribir: '+opt,async()=>{
  let local=make(),reads=0,writes=0,applied=0,api;
  const next={...make(),pedidos:[{suc,id:1}]};
  const remote=async()=>{reads++;if(reads===1)return {revision:1,snapshot:{}};
   if(opt==='mutacion')local.pedidos.push({suc,id:5});
   if(opt==='salir')api.cerrar();
   return {revision:opt==='sin-cambio'?1:opt==='otra-revision'&&reads>2?3:2,snapshot:{}};
  };
  api=crearSesionPanelUnicoRomoQA({vault:{disponible:()=>true,cargarSobre:remote,guardarSobre:async()=>{writes++;throw Error('No escribir');}},validarEstado:(d,s)=>d.suc===s,desbloquearSobre:async()=>({estado:make(),cifrar:()=>{},abrirSiguiente:async()=>opt==='otra-sucursal'?{...next,suc:'Uki La Serena'}:next}),prepararEstadoInicial:async()=>{}});
  await api.abrir({googleVerificado:true,claveUkiVerificada:true});
  const run=()=>api.refrescarSiLimpio({getEstado:()=>local,puedeAplicar:()=>opt!=='edicion',aplicar:d=>{local=d;applied++;return true;}});
  if(opt==='otra-sucursal')await assert.rejects(run);else assert.equal(await run(),opt==='limpio');
  assert.equal(applied,opt==='limpio'?1:0);assert.equal(writes,0);
  if(opt==='limpio'){assert.equal(api.estado().revision,2);assert.deepEqual(api.estadoOperativoConfirmado(),next);}
 });
}
