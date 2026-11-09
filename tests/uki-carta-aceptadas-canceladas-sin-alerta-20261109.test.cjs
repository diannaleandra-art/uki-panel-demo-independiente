'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const carta=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
const panel=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const extraer=(a,b)=>{
 const start=carta.indexOf(a),end=carta.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'No se encontró función '+a);
 return carta.slice(start,end);
};
function escenario({pedidos=[],remotas=[]}={}){
 const S={suc:'Uki Regimiento Arica',pedidos};
 const ctx={S,ukiCartaRemotasSucursal:()=>remotas,
  ukiTelefonoNormalizado:v=>{
   const n=String(v||'').replace(/\D/g,'');
   return /^9\d{8}$/.test(n)?'56'+n:n;
  }};
 vm.createContext(ctx);
 vm.runInContext(extraer('function ukiCartaSolicitudYaRegistrada(','let ukiCartaConfirmando=false;'),ctx);
 return ctx;
}
function remota(id='sol-692',codigo_pedido='692',mensaje='Carta #692: roll pollo, tempura, palta, delivery'){
 return {id,branch:'arica',estado:'aceptada',codigo_pedido,telefono:'56991227362',mensaje};
}
function pedido(cambios={}){
 return {id:257,suc:'Uki Regimiento Arica',cartaSolicitudRemotaId:'sol-692',
   codigoCarta:'692',cliente:'D',telefono:'+56 9 9122 7362',textoOriginal:remota().mensaje,
   estado:'Cancelado',pagado:false,subtotal:12600, ...cambios};
}
test('Solicitud ACEPTADA cuyo pedido fue CANCELADO no crea falsa alerta pendiente',()=>{
 const ctx=escenario({pedidos:[pedido()],remotas:[remota()]});
 assert.equal(ctx.ukiCartaSolicitudYaRegistrada(remota()),true);
 assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,0);
 assert.equal(ctx.ukiCartaPedidoAceptadoEnCaja(remota()),false);
 assert.equal(ctx.S.pedidos[0].estado,'Cancelado');
 assert.equal(ctx.S.pedidos[0].pagado,false);
});
test('Aceptadas #692 y #337 vinculadas a canceladas distintas dejan de mostrarse como huérfanas',()=>{
 const r2=remota('sol-337','337','Carta #337: roll vegetariano, queso y arroz, retiro');
 const p2=pedido({id:258,cartaSolicitudRemotaId:'sol-337',codigoCarta:'337',cliente:'Dianna',textoOriginal:r2.mensaje});
 const ctx=escenario({pedidos:[pedido(),p2],remotas:[remota(),r2]});
 assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,0);
 assert.equal(ctx.S.pedidos.length,2);
});
test('Aceptada que NO existe en caja sigue avisando incluso si tiene el mismo WhatsApp',()=>{
 const faltante=remota('sol-777','777','Carta #777: comida diferente otro horario y contenido');
 const ctx=escenario({pedidos:[pedido()],remotas:[remota(),faltante]});
 assert.deepEqual(Array.from(ctx.ukiCartaAceptadasSinVinculo(),r=>r.id),['sol-777']);
});
test('Cancelación anterior sin ID remoto se reconoce solo con folio + WhatsApp completo + texto exacto',()=>{
 const solicitud=remota();
 const legacy=pedido({cartaSolicitudRemotaId:''});
 const ctx=escenario({pedidos:[legacy],remotas:[solicitud]});
 assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,0);
 ctx.S.pedidos[0].textoOriginal='Roll diferente y otro pedido, sin coincidir con este mensaje';
 assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,1);
 ctx.S.pedidos[0].textoOriginal=solicitud.mensaje;
 ctx.S.pedidos[0].telefono='56900007362'; // mismos 4 dígitos, otro cliente
 assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,1);
});
test('Nombres, últimos cuatro dígitos o folio solo nunca ocultan aviso legítimo',()=>{
 const solicitud=remota();
 for(const cambios of [
  {codigoCarta:'698',cartaSolicitudRemotaId:''},
  {telefono:'56911117362',cartaSolicitudRemotaId:''},
  {textoOriginal:'',cartaSolicitudRemotaId:''},
  {suc:'Uki La Serena',cartaSolicitudRemotaId:''}
 ]){
  const ctx=escenario({pedidos:[pedido(cambios)],remotas:[solicitud]});
  assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,1);
 }
});
test('Si existen dos candidatos históricos ambiguos, se conserva el aviso para revisión',()=>{
 const legado=pedido({cartaSolicitudRemotaId:''});
 const ctx=escenario({pedidos:[legado,{...legado,id:258}],remotas:[remota()]});
 assert.equal(ctx.ukiCartaAceptadasSinVinculo().length,1);
});
test('Solicitud pendiente vinculada a pedido CANCELADO no se confirma de nuevo ni se duplica',()=>{
 const solicitudes=extraer('async function ukiCartaConfirmarRespaldados(){','async function ukiCartaRemotasActualizar(){');
 assert.match(solicitudes,/r\.estado==='pendiente'&&ukiCartaPedidoAceptadoEnCaja\(r\)/);
 assert.match(carta,/p\.estado!=='Cancelado'/);
 assert.match(panel,/S\.pedidos\.push\(nuevoPedido\)/);
 assert.match(panel,/if\(D\.codigoCarta && S\.pedidos\.some\(p=>p\.id!==D\.editando&&ukiRegistroMismoOrigen\(p,D\)\)\)/);
});
test('Solo se modifica aviso de reconciliación; no hay alta de ventas ni cambio en caja',()=>{
 const code=extraer('function ukiCartaSolicitudYaRegistrada(','let ukiCartaConfirmando=false;');
 assert.doesNotMatch(code,/S\.pedidos\.push|S\.pedidos\.splice|p\.estado\s*=|p\.pagado\s*=|S\.cierres\s*=/);
 assert.match(code,/r\.estado==='aceptada'&&!ukiCartaSolicitudYaRegistrada\(r\)/);
 assert.doesNotThrow(()=>new vm.Script(carta));
});
