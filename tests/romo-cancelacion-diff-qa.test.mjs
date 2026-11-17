import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararCancelacionRomoQA} from '../public/romo-panel-qa/uki-romo-cancelacion-atomica-qa.mjs';
import {comprobarSoloCancelacionRomoQA} from '../public/romo-panel-qa/uki-romo-cancelacion-diff-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const datos={pedidoId:1,responsable:'Local QA',
 motivo:'Pedido de prueba sin cobro',registradoEn:1794939000000};
const estado=()=>({
 suc:SUC,base:18000,cajaChica:{inicial:20000},
 pedidos:[{id:1,suc:SUC,estado:'Pendiente',turnoClave:'2026-11-14@1794676606187',
   pagado:false,importe:1000}],
 cierres:[],propinas:[],gastos:[],retiros:[],deliveriesManuales:[]
});
const clone=v=>JSON.parse(JSON.stringify(v));
const candidate=old=>{const next=clone(old);prepararCancelacionRomoQA(next,datos);return next};

test('Cancelación local exacta: único pedido sin cobro, con historial',()=>{
 const before=estado(),next=candidate(before);
 const r=comprobarSoloCancelacionRomoQA(before,next,datos);
 assert.equal(r.operacion,'cancelar_sin_cobro');
 assert.equal(r.requiereRevisionNeon,true);
 assert.equal(before.pedidos[0].estado,'Pendiente');
 assert.equal(next.pedidos[0].estado,'Cancelado');
 assert.equal(next.pedidos[0].historialCambios.length,1);
});
test('Rechaza modificaciones simultáneas de caja, pagos u otros pedidos',()=>{
 const before=estado(),a=candidate(before),b=candidate(before),c=candidate(before);
 a.base=18001;
 b.pedidos[0].pagado=true;
 c.pedidos.push({id:2,suc:SUC,estado:'Pendiente'});
 for(const after of [a,b,c])
  assert.throws(()=>comprobarSoloCancelacionRomoQA(before,after,datos),/modifica otros datos/);
});
test('No permite falsificar la bitácora, el responsable ni el motivo',()=>{
 const before=estado(),a=candidate(before),b=candidate(before);
 a.pedidos[0].historialCambios[0].motivo='Distinto';
 b.pedidos[0].canceladoPor='Otra persona';
 assert.throws(()=>comprobarSoloCancelacionRomoQA(before,a,datos),/modifica otros datos/);
 assert.throws(()=>comprobarSoloCancelacionRomoQA(before,b,datos),/modifica otros datos/);
});
test('Rechaza estado de Uki y pedido ya pagado, sin tocar ninguno',()=>{
 const wrong=estado();wrong.suc='Uki La Serena';
 assert.throws(()=>comprobarSoloCancelacionRomoQA(wrong,candidate(estado()),datos),/sucursal/);
 const paid=estado();paid.pedidos[0].pagado=true;
 assert.throws(()=>comprobarSoloCancelacionRomoQA(paid,candidate(estado()),datos),/con pagos/);
});
test('La UI aplica control antes de guardar; el servidor sigue sin permiso general',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/romo-estado-cifrado-panel-qa.js',import.meta.url),'utf8');
 const segment=html.slice(html.indexOf('async function ukiRomoCambiarEstadoQA('),
  html.indexOf('const ROMO_MEDIOS_SALIDAS_QA='));
 assert.ok(segment.indexOf('comprobarSoloCancelacionRomoQA(')>=0);
 assert.ok(segment.indexOf('comprobarSoloCancelacionRomoQA(')<segment.indexOf('ukiRomoGuardarOperacionQA('));
 assert.match(api,/ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED!=='true'/);
 assert.match(api,/ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED!=='true'/);
});
