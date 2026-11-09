'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const a=html.indexOf('let ukiBorradorActivo=null;'),b=html.indexOf('/* WHATSAPP SOLICITUDES QA',a);
assert.ok(a>0&&b>a);
const logic=html.slice(a,b);
function setup({whatsapp=false,carta=false}={}){
 const suc='Uki Regimiento Arica',id='solicitud-original',cid='carta-original';
 const ctx={
  S:{suc,borradores:[],solicitudesWhatsApp:whatsapp?[{suc,id,estado:'pendiente'}]:[],busy:false,vista:'nuevo',msg:null},
  D:{cliente:'Cliente original',telefono:'56999991234',modalidad:'Retiro',pagado:false,editando:null,
   texto:'Pedido inicial',items:[{nombre:'Promo',cant:1,precio:16800}],...(carta?{cartaSolicitudRemotaId:cid}:{})},
  ukiSolicitudWhatsAppActiva:whatsapp?id:null,ukiCartaRemotaActiva:carta?cid:null,
  modoNuevo:'manual',render:()=>{},aviso:s=>{ctx.S.msg=s},$ :()=>null,
  nuevoDraft:()=>{ctx.D={cliente:'',texto:'',modalidad:'Retiro',pagado:false,editando:null,items:[{nombre:'',cant:1,precio:0}]}},
  esc:String,fmt:String,ukiMesaNumeroReferencia:()=>1
 };
 vm.createContext(ctx);vm.runInContext(logic,ctx);
 return ctx;
}
test('WhatsApp: dejar un pedido en espera no pasa su identidad a otro pedido',()=>{
 const x=setup({whatsapp:true});
 x.ukiPausarPedido();
 assert.equal(x.S.borradores.length,1);
 assert.equal(x.ukiSolicitudWhatsAppActiva,null);
 assert.equal(x.S.borradores[0].solicitudWhatsAppId,'solicitud-original');
 assert.equal(x.S.solicitudesWhatsApp[0].estado,'pendiente');
 const id=x.S.borradores[0].id;
 x.ukiRetomarBorrador(id);
 assert.equal(x.ukiSolicitudWhatsAppActiva,'solicitud-original');
 assert.equal(x.D.cliente,'Cliente original');
});
test('Carta: suspender conserva la referencia remota, sin registrarla como venta',()=>{
 const x=setup({carta:true});x.ukiPausarPedido();
 assert.equal(x.ukiCartaRemotaActiva,null);
 assert.equal(x.S.borradores[0].datos.cartaSolicitudRemotaId,'carta-original');
 x.ukiRetomarBorrador(x.S.borradores[0].id);
 assert.equal(x.ukiCartaRemotaActiva,'carta-original');
});
test('No se retoma una solicitud WhatsApp ya rechazada',()=>{
 const x=setup({whatsapp:true});x.ukiPausarPedido();
 x.S.solicitudesWhatsApp[0].estado='rechazada';
 x.ukiRetomarBorrador(x.S.borradores[0].id);
 assert.match(x.S.msg,/ya fue aceptada o rechazada/);
 assert.equal(x.ukiSolicitudWhatsAppActiva,null);
});
test('El rechazo retira la solicitud del borrador y restaura si falla el guardado',()=>{
 const frag=html.slice(html.indexOf('async function ukiWhatsAppRechazar('),html.indexOf('function ukiWhatsAppMarcarAceptada('));
 assert.match(frag,/S\.borradores=\(S\.borradores\|\|\[\]\)\.filter/);
 assert.match(frag,/S\.borradores=borradoresAntes/);
 assert.ok(frag.indexOf("item.estado='rechazada'")<frag.indexOf('S.borradores=(S.borradores||[]).filter'));
});
test('Pedidos en atención no se muestran nuevamente como solicitudes por confirmar',()=>{
 const frag=html.slice(html.indexOf('function vPedidos(){'),html.indexOf('function ukiArchivoRechazadosHistorialUI(){'));
 assert.match(frag,/whatsappEnAtencion=new Set/);
 assert.match(frag,/cartaEnAtencion=new Set/);
 assert.match(frag,/solicitudesActivas=solicitudes.filter/);
 assert.match(frag,/remotasActivas=remotas.filter/);
 assert.match(frag,/const urgentesCarta=remotasActivas.filter/);
 assert.match(frag,/const urgentesManuales=solicitudesActivas.filter/);
 assert.match(frag,/en atención/);
});
