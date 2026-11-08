'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const remote=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
const a=html.indexOf('let ukiBorradorActivo=null;');
const b=html.indexOf('/* WHATSAPP SOLICITUDES QA',a);
assert.ok(a>0&&b>a);
const draftLogic=html.slice(a,b);
function ctxOf({local=false,remoteId=false}={}){
 const suc='Uki Regimiento Arica',item='local-uno',rid='uuid-remoto-uno';
 const ctx={
  S:{suc,borradores:[],solicitudesWhatsApp:local?[{id:item,suc,estado:'pendiente'}]:[],busy:false,vista:'nuevo',msg:null},
  D:{cliente:'Cliente Prueba',telefono:'56912345678',codigoCarta:'751',texto:'Texto recibido',modalidad:'Retiro',pagado:false,editando:null,items:[{nombre:'Promo',cant:1,precio:11800}],...(remoteId?{cartaSolicitudRemotaId:rid}:{})},
  ukiSolicitudWhatsAppActiva:local?item:null,ukiCartaRemotaActiva:remoteId?rid:null,
  modoNuevo:'whatsapp',render:()=>{},aviso:s=>{ctx.S.msg=s;},$:(id)=>null,
  nuevoDraft:()=>{ctx.D={cliente:'',telefono:'',texto:'',modalidad:'Retiro',items:[{nombre:'',cant:1,precio:0}],pagado:false,editando:null}},
  esc:s=>String(s),fmt:n=>String(n),ukiMesaNumeroReferencia:()=>1
 };
 vm.createContext(ctx);vm.runInContext(draftLogic,ctx);return ctx;
}
test('Una solicitud de WhatsApp en espera no se acepta por error al guardar otro pedido',()=>{
 const x=ctxOf({local:true});x.ukiPausarPedido();
 assert.equal(x.S.borradores.length,1);
 assert.equal(x.ukiSolicitudWhatsAppActiva,null);
 assert.equal(x.S.borradores[0].solicitudWhatsAppId,'local-uno');
 assert.equal(x.S.solicitudesWhatsApp[0].estado,'pendiente');
 x.ukiRetomarBorrador(x.S.borradores[0].id);
 assert.equal(x.ukiSolicitudWhatsAppActiva,'local-uno');
 assert.equal(x.D.cliente,'Cliente Prueba');
});
test('Una solicitud remota en espera retoma su identificador exacto',()=>{
 const x=ctxOf({remoteId:true});x.ukiPausarPedido();
 assert.equal(x.ukiCartaRemotaActiva,null);
 assert.equal(x.S.borradores[0].datos.cartaSolicitudRemotaId,'uuid-remoto-uno');
 x.ukiRetomarBorrador(x.S.borradores[0].id);
 assert.equal(x.ukiCartaRemotaActiva,'uuid-remoto-uno');
 assert.equal(x.D.cartaSolicitudRemotaId,'uuid-remoto-uno');
});
test('No se puede retomar un borrador cuyo pedido original ya fue rechazado',()=>{
 const x=ctxOf({local:true});x.ukiPausarPedido();const id=x.S.borradores[0].id;
 x.S.solicitudesWhatsApp[0].estado='rechazada';x.ukiRetomarBorrador(id);
 assert.match(x.S.msg,/ya fue aceptada o rechazada/);
 assert.equal(x.ukiSolicitudWhatsAppActiva,null);
});
test('Rechazar limpia espera asociada solo al confirmar el servidor o respaldo local',()=>{
 const local=html.slice(html.indexOf('async function ukiWhatsAppRechazar('),html.indexOf('function ukiWhatsAppMarcarAceptada('));
 assert.ok(local.indexOf("item.estado='rechazada'")<local.indexOf('S.borradores=(S.borradores||[]).filter'));
 assert.ok(local.indexOf('S.borradores=(S.borradores||[]).filter')<local.indexOf('const ok=await guardarEnLocalStorage()'));
 assert.match(local,/S\.borradores=borradoresAntes/);
 const start=remote.indexOf('async function ukiCartaRemotaRechazar(');
 const fragment=remote.slice(start);
 assert.ok(fragment.indexOf("await ukiCartaApiCambio(id,'rechazada'")<fragment.indexOf('S.borradores=borradoresAntes.filter'));
 assert.match(remote,/ukiBorradoresSucursal\(\)\.find\(b=>String\(b\.datos\?\.cartaSolicitudRemotaId/);
});
