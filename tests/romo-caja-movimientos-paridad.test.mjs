import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const movimientos=['gastos','apps','delivery','repartidor','propinas','retiros','chica'];
function body(name){
 const begin=html.indexOf('function '+name+'(');
 assert.ok(begin>=0);
 const end=html.indexOf('\n}',begin);
 assert.ok(end>begin);
 return html.slice(begin,end+2);
}
function probar(tab,{confirmada=true}={}){
 const caja={base:20000,baseConfirmada:confirmada,
  cajaChica:{inicial:12000,gastos:[{concepto:'Detergente',monto:2000}]},
  apps:{'Uber Eats':5000},pagosDeliveryDetalle:[],pagoDeliveryDia:0};
 const totales={medios:{Efectivo:10000,'Uber Eats':5000},
  totalMedios:15000,ventaCorregida:15000,ventaSinDelivery:14000,
  pagadosN:2,pendientesN:1,envios:1000,enviosPedidos:1000,enviosManuales:0,
  gastosTotal:0,pagoDelivery:0,final:15000};
 const ctx={MOV_TABS:movimientos.map(x=>[x,x]),movimientoTab:tab,
  cajaDelDia:()=>caja,totales:()=>totales,ROMO_MEDIOS_COBRO_QA:['Efectivo','Uber Eats'],
  ROMO_MEDIOS_SALIDAS_QA:['Efectivo','Transferencia'],APPS:['Uber Eats','Rappi','PedidosYa'],
  S:{suc:'Romo’s Sushi La Serena',gastos:[],retiros:[],deliveriesManuales:[]},
  row:(k,v)=>'<p>'+k+': '+v+'</p>',fmt:x=>'$'+String(x||0),
  esc:x=>String(x??''),fechaOperativaActual:()=> '2026-11-17',
  delSucHoy:()=>[],ukiRomoCajaDisponibleQA:()=>30000,
  ukiDesgloseDeliverysTurno:()=>'<p>Desglose delivery</p>',
  ukiRomoTarjetaPropinaUkiQA:()=>'<p>Propina protegida</p>',
  ukiRomoCierreTurnoHTMLQA:()=>'<p>Precierre y cierre</p>'};
 vm.createContext(ctx);vm.runInContext(body('ukiRomoCajaConsultaHTMLQA'),ctx);
 return ctx.ukiRomoCajaConsultaHTMLQA('movimientos');
}
test('Romo y Uki comparten exactamente siete tipos de movimientos',()=>{
 for(const m of movimientos){
  const s=probar(m);
  for(const k of movimientos)assert.match(s,new RegExp('<option value="'+k+'"'));
  assert.match(s,new RegExp('data-romo-movimiento="'+m+'"'));
  assert.equal((s.match(/data-romo-movimiento=/g)||[]).length,1);
 }
});
test('Apps y caja chica no invocan escritura nativa de Uki',()=>{
 const apps=probar('apps'),chica=probar('chica');
 assert.match(apps,/Uber Eats/);assert.match(apps,/5000/);
 assert.match(chica,/Detergente/);assert.match(chica,/Saldo caja chica/);
 assert.match(chica,/10000/);
 for(const s of [apps,chica])assert.doesNotMatch(s,/setApp\(|addCC\(|quitarCC\(/);
});
test('Base no confirmada impide presumir saldo de caja chica',()=>{
 const s=probar('chica',{confirmada:false});
 assert.match(s,/Saldo no disponible/);
 assert.doesNotMatch(s,/Detergente/);
});
test('Cinco movimientos existentes siguen visibles por su sección',()=>{
 for(const [k,m] of [['gastos','romoGastoMontoQA'],['delivery','romoDeliveryMontoQA'],
 ['repartidor','romoPagoDeliveryMontoQA'],['propinas','Propina protegida'],
 ['retiros','romoRetiroMontoQA']])assert.match(probar(k),new RegExp(m));
});
test('Se preserva bloqueo de escritura Romo y ruta propia separada de Uki',()=>{
 assert.match(html,/if\(window\.ukiRomoGuardadoHabilitadoQA\?\.\(\)!==true\)/);
 assert.match(html,/if\(S\.suc===ROMO_SUCURSAL_QA\)return ukiRomoCajaPestanasQA\(\)/);
 assert.doesNotMatch(body('ukiRomoCajaConsultaHTMLQA'),/onchange="setApp\(/);
});
