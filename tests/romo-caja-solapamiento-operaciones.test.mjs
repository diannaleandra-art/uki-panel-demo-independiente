import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const file=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
function functionText(name){
 const start=file.indexOf('async function '+name+'(');
 assert.ok(start>=0);
 const end=file.indexOf('\n}',start);
 assert.ok(end>start);
 return file.slice(start,end+2);
}
test('Caja Romo no permite iniciar gastos durante otro guardado en curso',async()=>{
 let accesos=0,avisos=0;
 const sesion={disponible:()=>{accesos++;return true;}};
 const ctx={
  ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena',
  S:{suc:'Romo’s Sushi La Serena'},
  ukiRomoOperacionesEnCursoQA:()=>true,
  window:{ukiRomoSesionRemotaQA:sesion},
  aviso:()=>{avisos++;}
 };
 vm.createContext(ctx);
 vm.runInContext(functionText('ukiRomoGuardarMovimientoQA'),ctx);
 for(const tipo of ['base','gasto','retiro','delivery','pagoRepartidor'])
  await ctx.ukiRomoGuardarMovimientoQA(tipo);
 assert.equal(accesos,0);
 assert.equal(avisos,0);
});
test('Caja Romo no opera desde una sucursal Uki',async()=>{
 let accesos=0;
 const ctx={
  ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena',
  S:{suc:'Uki La Serena'},
  ukiRomoOperacionesEnCursoQA:()=>false,
  window:{get ukiRomoSesionRemotaQA(){accesos++;return null;}},
 };
 vm.createContext(ctx);
 vm.runInContext(functionText('ukiRomoGuardarMovimientoQA'),ctx);
 await ctx.ukiRomoGuardarMovimientoQA('gasto');
 assert.equal(accesos,0);
});
test('La guarda financiera utiliza la coordinación de todas las operaciones existentes',()=>{
 const s=functionText('ukiRomoGuardarMovimientoQA');
 assert.match(s,/ukiRomoOperacionesEnCursoQA\(\)/);
 assert.match(s,/if\(tipo!=='base'&&actual\.turnoAbierto!==true\)/);
 assert.match(s,/if\(tipo!=='base'&&actual\.baseConfirmada!==true\)/);
 assert.match(s,/await ukiRomoGuardarOperacionQA\(copia,descripcion,null,'caja'\)/);
 assert.match(file,/if\(window\.ukiRomoGuardadoHabilitadoQA\?\.\(\)!==true\)/);
});
