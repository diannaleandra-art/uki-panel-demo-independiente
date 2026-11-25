import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const suc='Romo’s Sushi La Serena';
function fn(name){const i=html.indexOf('function '+name+'('),e=html.indexOf('\n}',i);assert.ok(i>=0&&e>i);return html.slice(i,e+2);}
test('Los controles de caja compartidos delegan a Romo y no escriben en Uki',()=>{
 for(const [name,action] of [['addGasto','gasto'],['addDM','delivery'],['savePD','pagosUki'],['addRetiro','retiro'],['addCC','chica'],['setApp','app'],['quitarGasto','anular'],['quitarDM','anular'],['quitarRetiro','anular']]){
  assert.ok(html.includes('function '+name+'('));
  const line=html.slice(html.indexOf('function '+name+'(')).split('\n')[0];
  assert.ok(line.includes("if(S.suc===ROMO_SUCURSAL_QA)return void ukiRomoGuardarMovimientoQA('"+action+"'"),name);
 }
 assert.match(html,/if\(S\.suc===ROMO_SUCURSAL_QA\)return void ukiRomoAgregarPropinaManualQA\(\)/);
 assert.match(html,/if\(S\.suc===ROMO_SUCURSAL_QA\)return void ukiRomoAnularGastoChicaQA\(id\)/);
});
test('Sin turno o base confirmados, el guardado de dinero se detiene antes de obtener la copia',async()=>{
 for(const caja of [{turnoAbierto:false,baseConfirmada:true},{turnoAbierto:true,baseConfirmada:false}]){
  let copied=0,notices=[];
  const ctx={S:{suc},ROMO_SUCURSAL_QA:suc,ukiRomoOperacionesEnCursoQA:()=>false,window:{ukiRomoSesionRemotaQA:{disponible:()=>true}},
   fechaOperativaActual:()=> '2026-11-25',totales:()=>({}),cajaDelDia:()=>caja,datosSoloSucursal:()=>{copied++;throw Error('No debe copiar');},aviso:m=>notices.push(m),console};
  const i=html.indexOf('async function ukiRomoGuardarMovimientoQA('),e=html.indexOf('\n}',i);
  vm.createContext(ctx);vm.runInContext(html.slice(i,e+2),ctx);
  await ctx.ukiRomoGuardarMovimientoQA('gasto');
  assert.equal(copied,0);assert.ok(notices.length>0);
 }
});
test('El índice actual contiene código interno, turno, carta original, folio visible y cliente',()=>{
 assert.match(html,/esc\(\[p\.id,p\.numeroTurno,p\.cliente,p\.telefono,p\.codigoCarta,ukiRomoFolioCartaVisibleQA\(p\),p\.codigoCliente,ukiCodigoClienteVisible\(p\)/);
});
test('La bandeja automática conserva una ficha abierta y omite repintados repetidos',()=>{
 assert.match(html,/if\(firmaAntes!==JSON\.stringify\(\[ukiRomoSolicitudesCartaQA,ukiRomoSolicitudesAvisoQA,ukiRomoSolicitudesLecturaOkQA\]\)\)ukiRomoSolicitudesRenderPendienteQA=true/);
 assert.match(html,/if\(fichaAbierta\|\|rechazoIniciado\)/);
 assert.match(html,/else if\(!automatico\|\|ukiRomoSolicitudesRenderPendienteQA\)/);
});
