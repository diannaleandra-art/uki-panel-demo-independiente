import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {obtenerTurnoRomoFolioQA} from '../firebase/uki-romo-folio-turno-qa.mjs';
const SUC='Romo’s Sushi La Serena',DIA='2026-11-13',INICIO=1794574800000;
const CLAVE=DIA+'@'+INICIO;
const base=()=>({suc:SUC,pedidos:[],cierres:[],cajasDiarias:{
 [SUC+'|'+DIA]:{turnoId:CLAVE,turnoAbierto:true,inicioMs:INICIO,base:18000}
}});
test('folio Romo exige apertura confirmada y no crea caja local',()=>{
 const estado=base(),antes=JSON.stringify(estado);
 assert.deepEqual(obtenerTurnoRomoFolioQA(estado,{
  fechaOperativa:DIA,registradoEn:INICIO+60000}),{numero:1,clave:CLAVE});
 assert.equal(JSON.stringify(estado),antes);
 delete estado.cajasDiarias[SUC+'|'+DIA];
 assert.throws(()=>obtenerTurnoRomoFolioQA(estado,{
  fechaOperativa:DIA,registradoEn:INICIO+60000}),/Abre y confirma/);
 assert.equal(Object.keys(estado.cajasDiarias).length,0);
});
test('turno abierto con pedidos conserva folio Uki y no duplica numeración',()=>{
 const e=base();
 e.pedidos=[
  {suc:SUC,id:1,numeroTurno:1,turnoClave:CLAVE},
  {suc:SUC,id:2,numeroTurno:3,turnoClave:CLAVE}
 ];
 const antes=JSON.stringify(e);
 assert.deepEqual(obtenerTurnoRomoFolioQA(e,{
  fechaOperativa:DIA,registradoEn:INICIO+10000}),{numero:4,clave:CLAVE});
 assert.equal(JSON.stringify(e),antes);
});
test('un turno Romo posterior no hereda folios de cierres anteriores',()=>{
 const e=base(),segundo=INICIO+7200000,clave2=DIA+'@'+segundo;
 e.cierres.push({turnoClave:CLAVE,suc:SUC});
 e.pedidos.push({suc:SUC,numeroTurno:9,turnoClave:CLAVE});
 e.cajasDiarias[SUC+'|'+DIA]={turnoAbierto:true,inicioMs:segundo,turnoId:clave2};
 assert.deepEqual(obtenerTurnoRomoFolioQA(e,{
  fechaOperativa:DIA,registradoEn:segundo+1000}),{numero:1,clave:clave2});
});
test('sin apertura, cierre vigente o datos de otro local se rechaza el folio',()=>{
 const e=base();
 e.cajasDiarias[SUC+'|'+DIA].turnoAbierto=false;
 assert.throws(()=>obtenerTurnoRomoFolioQA(e,{
  fechaOperativa:DIA,registradoEn:INICIO+1000}),/Abre y confirma/);
 e.cajasDiarias[SUC+'|'+DIA].turnoAbierto=true;
 e.cierres.push({turnoClave:CLAVE,suc:SUC});
 assert.throws(()=>obtenerTurnoRomoFolioQA(e,{
  fechaOperativa:DIA,registradoEn:INICIO+1000}),/ya cerró/);
 e.cierres=[];e.pedidos.push({suc:'Uki La Serena',numeroTurno:1,turnoClave:CLAVE});
 assert.throws(()=>obtenerTurnoRomoFolioQA(e,{
  fechaOperativa:DIA,registradoEn:INICIO+1000}),/otra sucursal/);
});
test('el botón Guardar de Romo usa cálculo puro, no cajaDelDia de Uki',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const start=html.indexOf('async function ukiRomoGuardarPedidoQA()');
 const end=html.indexOf('function ukiRomoBandejaPanelHTML()',start);
 const guardar=html.slice(start,end);
 assert.match(guardar,/obtenerTurnoRomoFolioQA\(datosSoloSucursal\(\)/);
 assert.doesNotMatch(guardar,/ukiTurnoFolioActual\(\)/);
 assert.match(guardar,/fechaOperativa:romoDiaCajaQA\(\)/);
 assert.match(html,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
