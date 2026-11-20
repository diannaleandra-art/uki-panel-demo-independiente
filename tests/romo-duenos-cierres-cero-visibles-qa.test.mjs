import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conciliarCierresRomoResumenQA} from '../public/uki-duenos-romo-cierres-conciliados-qa.mjs';

const html=readFileSync(new URL('../public/mi-administracion-duenos.html',import.meta.url),'utf8');
const fecha='2026-11-19',turno='2026-11-19@1795146049177';
const cierre={
 source_key:'romo:serena|'+turno,turno_ref:turno,
 fecha_operativa:fecha,revision_neon:10,estado_contable:'pendiente_incorporacion',
 venta_total:0,pedidos:0,gastos_cierre:0,delivery_por_pagar:0,propinas:0,
 medios:{Efectivo:0,Transferencia:0}
};
const negocios=[{id:10,nombre:"Romo’s Sushi"},{id:11,nombre:'Uki Sushi'}];
const sucursales=[{id:100,negocio_id:10,nombre:'La Serena'}];

test('El cierre real de Romo con venta cero es válido y se incorpora una sola vez a la vista QA',()=>{
 const r=conciliarCierresRomoResumenQA({cierres:[cierre],movimientos:[],negocios,sucursales,
   desde:fecha,hasta:fecha,lecturaAutorizada:true,movimientosCompletos:true});
 assert.equal(r.incluidos,1);
 assert.equal(r.items.length,1);
 assert.equal(r.items[0].importe,0);
 assert.equal(r.items[0].marca,'romo');
 assert.equal(r.items[0].ref,'romo:serena|'+turno);
 assert.equal(r.soloVistaPrevia,true);
});

test('El resumen por negocio no oculta cierres Romo de cero pesos ni los etiqueta Uki',()=>{
 assert.match(html,/const entries=\[\.\.\.result\.values\(\)\]\.filter\(x=>x\.venta\|\|x\.gastos\|\|x\.pendientes\|\|x\.cierres\)/);
 assert.match(html,/e\.label\.startsWith\('Romo'\)\?'Romo':'Uki'/);
 assert.match(html,/row\.cierres\+\+/);
 assert.match(html,/k=romo\?'romo-serena'/);
});

test('Las tarjetas de Romo siguen siendo una vista de solo lectura; no generan asiento contable',()=>{
 assert.match(html,/NO generan asiento contable/);
 assert.match(html,/lecturaAutorizada:romoCierresConsultaValidaQA/);
});
