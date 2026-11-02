'use strict';
// Pruebas aisladas sin datos reales ni Firebase.
// node --test tests/precierre-propinas-efectivo-uki.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const section=(a,b)=>{
 const i=src.indexOf(a),j=src.indexOf(b,i);
 assert.ok(i>=0&&j>i,'No se encontró '+a);
 return src.slice(i,j);
};
const med=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const apps=['Uber Eats','PedidosYa','Rappi'];
const fmt=n=>'$'+Number(n||0).toLocaleString('es-CL');
function setup(){
 const suc='Uki Regimiento Arica',S={suc,
  pedidos:[{id:1,suc,pagado:true,estado:'Entregado',modalidad:'Consumo en local',
    subtotal:20000,total:22000,envio:0,propina:2000,medio:'Efectivo',medioEnvio:'Efectivo'}],
  propinas:[{id:1,suc,pedidoId:1,monto:2000,medio:'Efectivo'},
    {id:2,suc,monto:1200,medio:'Débito'}],
  gastos:[],retiros:[],deliveriesManuales:[]};
 const caja={apps:{},pagoDelivery:0,pagoDeliveryMedio:'Efectivo',base:0,cajaChica:{inicial:0,gastos:[]}};
 const funcs=new Function('S','MEDIOS','APPS','cajaDelDia','delSucHoy','fmt','esc','render',
   section('function ukiMontoProductosOtroLocal(p,sub){','\nfunction vCaja(){')+'\nreturn {totales};')
 (S,med,apps,()=>caja,x=>x.filter(p=>p.suc===S.suc),fmt,String,()=>{});
 return {S,caja,...funcs};
}
test('Propinas de efectivo y débito quedan fuera de los ingresos por ventas',()=>{
 const x=setup(),t=x.totales();
 assert.equal(t.totalMedios,20000);
 assert.equal(t.propinas,3200);
 assert.equal(t.propinasEfectivo,2000);
 assert.equal(t.efectivoCaja,20000);
 assert.equal(t.medios.Efectivo,20000);
});
test('Precierre registra propinas en efectivo del turno sin duplicar las ventas',()=>{
 const x=setup();
 const prec=new Function('MEDIOS','totales',
  section('function ukiFotoPrecierre(){','function ukiNubeListaPrecierre(){')+
   '\nreturn {ukiFotoPrecierre,ukiDiferenciaPrecierre};')(med,x.totales);
 const antes=prec.ukiFotoPrecierre();
 x.S.pedidos.push({id:2,suc:x.S.suc,pagado:true,estado:'Entregado',
  subtotal:10000,total:11000,modalidad:'Retiro',envio:0,medio:'Transferencia'});
 x.S.propinas.push({id:3,suc:x.S.suc,pedidoId:2,monto:1000,medio:'Efectivo'});
 const cierre=prec.ukiDiferenciaPrecierre(antes,prec.ukiFotoPrecierre());
 assert.equal(cierre.venta,10000);
 assert.equal(cierre.propinas,1000);
 assert.equal(cierre.propinasEfectivo,1000);
 assert.equal(cierre.medios.Transferencia,10000);
});
test('Los turnos anteriores no reciben retroactivamente propinas',()=>{
 const x=setup(),prec=new Function('MEDIOS','totales',
  section('function ukiFotoPrecierre(){','function ukiNubeListaPrecierre(){')+
   '\nreturn {ukiFotoPrecierre,ukiDiferenciaPrecierre};')(med,x.totales);
 const actual=prec.ukiFotoPrecierre();
 const viejo={...actual};delete viejo.propinasEfectivo;
 const dif=prec.ukiDiferenciaPrecierre(viejo,actual);
 assert.equal(dif.propinasEfectivo,0);
});
test('El formulario y cierre aclaran que las propinas se cuentan por separado',()=>{
 assert.match(src,/Propinas en efectivo de este turno:/);
 assert.match(src,/Efectivo contado, sin incluir propinas/);
 assert.match(src,/Efectivo esperado sin propinas/);
 assert.match(src,/Dinero contado físicamente, sin propinas/);
 assert.match(src,/Propinas efectivo \(aparte\)/);
});
