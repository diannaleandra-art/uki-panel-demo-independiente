'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const raiz=path.join(__dirname,'../public/romo-panel-qa');
const html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');
const core=fs.readFileSync(path.join(raiz,'uki-archivo-mensual-core.js'),'utf8');
test('el panel Romo incluye los dos módulos en la página real, una vez',()=>{
 for(const nombre of ['uki-archivo-mensual-core.js','uki-archivo-mensual-panel.js']){
  assert.equal(html.split('/romo-panel-qa/'+nombre).length-1,1);
  assert.ok(html.indexOf('/romo-panel-qa/'+nombre)>html.indexOf('</script>'));
  assert.ok(fs.existsSync(path.join(raiz,nombre)));
 }
 assert.ok(html.includes('id="ukiArchivoMensualRoot"'));
 assert.match(core,/cajasDiarias/);
 assert.match(core,/Romo’s Sushi La Serena/);
});
test('script principal del panel Romo es JavaScript sintácticamente válido',()=>{
 const ini=html.indexOf('<script>'),fin=html.indexOf('</script>',ini);
 assert.ok(ini>0&&fin>ini);
 assert.doesNotThrow(()=>new vm.Script(html.slice(ini+8,fin),{filename:'romo-panel-inline.js'}));
});
test('las consultas de archivo requieren cuenta dueños y no borran registros',()=>{
 const b=fs.readFileSync(path.join(raiz,'uki-archivo-mensual-panel.js'),'utf8');
 assert.match(b,/action:'consultar'/);
 assert.match(b,/desempaquetar/);
 assert.match(b,/verificarNube\(contexto\.suc\)/);
 assert.doesNotMatch(b,/\bDELETE\s+FROM\b/i);
});

test('Romo consulta revisión Neon y bloquea archivo si otro teléfono actualizó',async()=>{
 const {crearSesionPanelUnicoRomoQA,ROMO_UI_SUCURSAL_QA}=await import(
  '../public/romo-panel-qa/romo-panel-unico-sesion-qa.mjs');
 let remoteRev=4;
 const datos={suc:ROMO_UI_SUCURSAL_QA,
  pedidos:[],cierres:[],gastos:[],retiros:[],propinas:[],deliveriesManuales:[],incidencias:[]};
 const vault={disponible:()=>true,cargarSobre:async()=>({revision:remoteRev,snapshot:{formato:'cifrado-sintetico'}}),
  guardarSobre:async()=>{throw Error('No se pueden escribir datos en este test')}};
 const session=crearSesionPanelUnicoRomoQA({vault,
  validarEstado:(v,s)=>v?.suc===s,
  desbloquearSobre:async()=>({estado:datos,cifrar:async()=>null}),
  prepararEstadoInicial:async()=>({estado:datos,cifrar:async()=>null})});
 await session.abrir({googleVerificado:true,claveUkiVerificada:true});
 assert.equal(await session.comprobarRevisionParaArchivo(),true);
 remoteRev=5;
 assert.equal(await session.comprobarRevisionParaArchivo(),false);
 assert.equal(session.estado().conflicto,true);
 assert.equal(await session.comprobarRevisionParaArchivo(),false);
});
