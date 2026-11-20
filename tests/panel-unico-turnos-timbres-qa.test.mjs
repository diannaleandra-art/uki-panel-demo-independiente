import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 prepararAperturaTurnoRomoQA,prepararCierreDefinitivoRomoQA
} from '../firebase/uki-romo-cierre-definitivo-qa.mjs';
import {prepararTimbreRomoQA} from '../firebase/uki-romo-timbres-atomicos-qa.mjs';
import {prepararEntregaRomoQA} from '../firebase/uki-romo-entrega-atomica-qa.mjs';
import {crearTransaccionesPanelUnicoRomoQA} from '../firebase/uki-romo-transacciones-panel-unico-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const fechaChile=(ms)=>{
 const p=new Intl.DateTimeFormat('en-GB',{
  timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date(ms));
 const x=k=>p.find(z=>z.type===k)?.value;
 return [x('year'),x('month'),x('day')].join('-');
};
const vacio=()=>({
 suc:SUC,fechaOperativa:'',pedidos:[],gastos:[],retiros:[],propinas:[],
 cierres:[],deliveriesManuales:[],incidencias:[],cajasDiarias:{},
 clientes:{},nextId:1,nextIncidenciaId:1
});
const acceso=()=>({method:'manual',responsable:'Encargada',registradoEn:Date.now()});

test('Se reutiliza exactamente la apertura de Romo aprobada, no la antigua',()=>{
 const aprobar=readFileSync(new URL('../public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs',import.meta.url),'utf8');
 const integrado=readFileSync(new URL('../firebase/uki-romo-cierre-definitivo-qa.mjs',import.meta.url),'utf8');
 assert.equal(integrado,aprobar);
 for(const archivo of ['uki-romo-caja-consulta-qa.mjs','uki-romo-resumen-duenos-qa.mjs',
  'uki-romo-cobro-pendiente-qa.mjs']){
  assert.equal(
   readFileSync(new URL('../firebase/'+archivo,import.meta.url),'utf8'),
   readFileSync(new URL('../public/romo-panel-qa/'+archivo,import.meta.url),'utf8')
  );
 }
});
test('La apertura confirma la base física y no inventa montos',()=>{
 const s=vacio(),inicio=Date.now(),dia=fechaChile(inicio);
 assert.throws(()=>prepararAperturaTurnoRomoQA(s,{
  fechaOperativa:dia,inicioMs:inicio,responsable:'Encargada'
 }),/Confirma expresamente base y caja chica/);
 const r=prepararAperturaTurnoRomoQA(s,{
  fechaOperativa:dia,inicioMs:inicio,responsable:'Encargada',
  base:18000,cajaChicaInicial:20000
 });
 const caja=s.cajasDiarias[SUC+'|'+dia];
 assert.equal(r.tipo,'apertura');
 assert.equal(caja.baseConfirmada,true);
 assert.equal(caja.base,18000);
 assert.equal(caja.cajaChica.inicial,20000);
 assert.equal(caja.baseConfirmadaPor,'Encargada');
 assert.throws(()=>prepararAperturaTurnoRomoQA(s,{
  fechaOperativa:dia,inicioMs:inicio+1,responsable:'Encargada',
  base:18000,cajaChicaInicial:20000
 }),/Ya hay un turno Romo abierto/);
});
test('Un timbre se registra solamente después del envío REAL de WhatsApp',()=>{
 const s=vacio();
 s.pedidos.push({suc:SUC,id:11,estado:'Pendiente',pagado:true,
  esPremio:false,telefono:'+56912345678',productosPagadosOtroLocal:false,
  timbreReglaObligatoria:true});
 const abierto='2026-11-17T11:00:00.000Z';
 const enviado='2026-11-17T11:01:00.000Z';
 assert.throws(()=>prepararTimbreRomoQA(s,{
  pedidoId:11,responsable:'Encargada',
  whatsappAbiertoEn:abierto,whatsappConfirmadoEn:enviado
 }),/Confirma el envío real/);
 const detalle=prepararTimbreRomoQA(s,{
  pedidoId:11,responsable:'Encargada',whatsappAbiertoEn:abierto,
  whatsappConfirmadoEn:enviado,envioConfirmado:true
 });
 assert.equal(detalle.pedidoId,11);
 assert.equal(s.pedidos[0].timbreEnviadoEn,enviado);
 assert.equal(s.pedidos[0].pagado,true);
 assert.equal(s.propinas.length,0);
 assert.throws(()=>prepararTimbreRomoQA(s,{
  pedidoId:11,responsable:'Encargada',whatsappAbiertoEn:abierto,
  whatsappConfirmadoEn:enviado,envioConfirmado:true
 }),/ya tiene timbre/);
});
test('Cierre definitivo no pasa con timbres obligatorios sin enviar',()=>{
 const s=vacio(),inicio=Date.now()-90000,dia=fechaChile(inicio);
 prepararAperturaTurnoRomoQA(s,{fechaOperativa:dia,inicioMs:inicio,
  responsable:'Encargada',base:0,cajaChicaInicial:0});
 s.pedidos.push({
  suc:SUC,id:11,turnoClave:s.cajasDiarias[SUC+'|'+dia].turnoId,
  registradoEn:inicio+1000,fechaOperativa:dia,
  estado:'Pendiente',pagado:true,esPremio:false,productosPagadosOtroLocal:false,
  timbreReglaObligatoria:true,telefono:'56912345678'
 });
 assert.throws(()=>prepararCierreDefinitivoRomoQA(s,{
  fechaOperativa:dia,cierreMs:Date.now(),responsable:'Encargada',
  efectivoContado:0
 }),/Quedan timbres WhatsApp/);
 assert.equal(s.cierres.length,0);
 assert.equal(s.cajasDiarias[SUC+'|'+dia].turnoAbierto,true);
});
test('El controlador del panel único tiene timbre, entrega y apertura apagados',async()=>{
 const session={disponible:()=>true,guardar:async()=>{throw Error('no debe escribir')},
  estado:()=>({storeId:'romo:serena',revision:3,conflicto:false}),
  coincideEstadoOperativo:()=>true};
 const controller=crearTransaccionesPanelUnicoRomoQA({
  sesion:session,obtenerVisible:()=>({revision:3,estado:vacio()}),
  validarEstado:(v,s)=>v?.suc===s,aplicarConfirmado:async()=>{}
 });
 assert.equal(controller.disponible(),false);
 for(const fn of [
  ()=>controller.abrirTurno({datos:{},confirmoBaseFisica:true}),
  ()=>controller.confirmarTimbre({datos:{},confirmoEnvioWhatsApp:true}),
  ()=>controller.confirmarEntrega({datos:{},confirmoEntregaReal:true})
 ])await assert.rejects(fn,/no están habilitadas/);
});
test('No se habilitó cierre por escritura simple ni publicación comercial',()=>{
 const src=readFileSync(new URL('../firebase/uki-romo-transacciones-panel-unico-qa.mjs',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/romo-cierre-definitivo-qa.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/cerrarTurno:/);
 assert.match(src,/ROMO_TRANSACCIONES_PANEL_UNICO_QA_HABILITADAS=false/);
 assert.match(api,/req\.method!=='POST'/);
 assert.match(api,/identity\.role!=='duenos'/);
 assert.match(api,/String\(req\.headers\?\.origin\|\|''\)!==cfg\.origin/);
 const page=readFileSync(new URL('../public/romo-panel-qa/panel-unico-consulta-qa.html',import.meta.url),'utf8');
 assert.doesNotMatch(page,/crearTransaccionesPanelUnicoRomoQA/);
});
