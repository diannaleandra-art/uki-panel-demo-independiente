// Prueba QA local: node --test firebase/tests/cancelaciones-locales-v815.test.mjs
// Sin acceso a Firebase, sin credenciales y sin modificar datos de los locales.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const html=readFileSync(new URL("../uki-sushi-local.html",import.meta.url),"utf8");
function sourceBetween(first,last){
 const a=html.indexOf(first),b=html.indexOf(last,a+first.length);
 assert.ok(a>=0&&b>a,"Secciones esperadas de la versión v8.15");
 return html.slice(a,b);
}
const cancelSource=sourceBetween("let cancelacionGuardando=false;",'function claveCliente(nombre');
const readinessSource=sourceBetween("window.ukiCancelacionNubeLista=()=>","window.ukiOperativoActualizar=actualizarBloqueo;");
const totalsSource=sourceBetween("function totales(){","function vCaja(){");

function setup({reason="cliente",paid=false,state="Pendiente",open=true,
                 synced=true,save=true,approved=true,branch="Uki Regimiento Arica"}={}){
 const currentBranch="Uki Regimiento Arica";
 const p={id:123,suc:branch,estado:state,pagado:paid,esPremio:false,registradoEn:Date.now()};
 const S={suc:currentBranch,busy:false,pedidos:[p]};
 const messages=[];let confirmations=0;
 const ctx={S,esDelPeriodo:()=>open,
   document:{body:{classList:{contains:()=>false}}},
   window:{ukiCancelacionNubeLista:()=>synced},
   $:()=>({value:reason}),aviso:m=>messages.push(m),
   confirm:()=>{confirmations++;return approved;},
   guardarEnLocalStorage:async()=>save};
 const handlers=runInNewContext("let pedidoExpandido=null;"+cancelSource+";({cancelarPedido,puedeCancelarPedido})",ctx);
 return {p,S,messages,get confirmations(){return confirmations;},cancel:()=>handlers.cancelarPedido(123)};
}
for(const [label,opts,expected] of [
 ["cliente",{reason:"cliente"},true],
 ["local",{reason:"local"},true],
 ["sin motivo",{reason:""},false],
 ["motivo inválido",{reason:"otro"},false],
 ["pagado",{paid:true},false],
 ["turno cerrado",{open:false},false],
 ["ya cancelado",{state:"Cancelado"},false],
 ["otra sucursal",{branch:"Uki La Serena"},false],
 ["nube pendiente",{synced:false},false],
 ["fallo de guardado local",{save:false},false],
 ["usuario no confirma",{approved:false},false]
]){
 test("Cancelar: "+label,async()=>{
  const fixture=setup(opts);const before=fixture.p.estado;
  await fixture.cancel();
  assert.equal(!!fixture.p.canceladoEn,expected);
  if(expected){
   assert.equal(fixture.p.estado,"Cancelado");
   assert.equal(fixture.p.motivoCancelacion,opts.reason||"cliente");
  }else{
   assert.equal(fixture.p.estado,before);
   assert.equal(fixture.p.motivoCancelacion,undefined);
  }
 });
}
for(const [status,allowed] of [["sincronizado",true],["pendiente",false],
 ["guardando",false],["conflicto",false],["error",false]]){
 test("Estado nube: "+status,()=>{
  const state={sucursal:"Uki Regimiento Arica",activo:true,estado:status,
    bloqueado:["conflicto","error"].includes(status),ocupado:status==="guardando"};
  const ctx={window:{ukiQAGet:()=>({suc:"Uki Regimiento Arica"})},
    auto:{resumen:()=>state},UKI_OPERACION_HABILITADA:true};
  runInNewContext(readinessSource,ctx);
  assert.equal(ctx.window.ukiCancelacionNubeLista(),allowed);
 });
}
test("Caja excluye cancelados y conserva pagos",()=>{
 const branch="Uki Regimiento Arica";
 const pending={suc:branch,pagado:false,estado:"Pendiente",esPremio:false,
   medio:"Efectivo",medioEnvio:"Efectivo",subtotal:7000,total:7000,modalidad:"Retiro",envio:0};
 const paid={...pending,pagado:true,estado:"Entregado",subtotal:12000,total:12000};
 const S={suc:branch,pedidos:[pending,paid],gastos:[],retiros:[],propinas:[],deliveriesManuales:[]};
 const caixa={apps:{},pagoDelivery:0,pagoDeliveryMedio:"Efectivo",base:18000};
 const ctx={S,cajaDelDia:()=>caixa,delSucHoy:arr=>arr.filter(x=>x.suc===branch),
   MEDIOS:["Efectivo","Transferencia","Débito","Edenred","Otros","Uber Eats","PedidosYa","Rappi"],
   APPS:["Uber Eats","PedidosYa","Rappi"]};
 const totales=runInNewContext(totalsSource+";totales",ctx);
 const antes=totales();pending.estado="Cancelado";
 const despues=totales();
 assert.equal(antes.totalMedios,12000);assert.equal(despues.totalMedios,12000);
 assert.equal(antes.pendientesN,1);assert.equal(despues.pendientesN,0);
 assert.equal(despues.cancelados,1);
 assert.equal(despues.efectivoCaja,12000);
});

// Dos pulsaciones seguidas mientras la escritura cifrada todavía está pendiente.
test("Cancelar: no duplica un guardado mientras el primero está en curso",async()=>{
 const p={id:123,suc:"Uki Regimiento Arica",estado:"Pendiente",
   pagado:false,esPremio:false,registradoEn:Date.now()};
 const S={suc:p.suc,busy:false,pedidos:[p]};
 let liberar;const pendiente=new Promise(resolve=>liberar=resolve);
 let guardados=0,confirmaciones=0;
 const ctx={
  S,esDelPeriodo:()=>true,
  document:{body:{classList:{contains:()=>false}}},
  window:{ukiCancelacionNubeLista:()=>true},
  $:()=>({value:"cliente"}),aviso:()=>{},
  confirm:()=>{confirmaciones++;return true},
  guardarEnLocalStorage:()=>{guardados++;return pendiente}
 };
 const {cancelarPedido}=runInNewContext("let pedidoExpandido=null;"+cancelSource+";({cancelarPedido})",ctx);
 const primera=cancelarPedido(123);
 await Promise.resolve();
 await cancelarPedido(123);
 assert.equal(guardados,1);
 assert.equal(confirmaciones,1);
 liberar(true);
 await primera;
 assert.equal(p.estado,"Cancelado");
 assert.equal(p.motivoCancelacion,"cliente");
});
