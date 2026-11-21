'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const raiz=path.join(__dirname,'../public/romo-panel-qa');
const html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');
const core=fs.readFileSync(path.join(raiz,'uki-archivo-mensual-core.js'),'utf8');
const comun=fs.readFileSync(path.join(__dirname,'../public/uki-archivo-mensual-core.js'),'utf8');
test('el panel Romo incluye los dos módulos en la página real, una vez',()=>{
 for(const nombre of ['uki-archivo-mensual-core.js','uki-archivo-mensual-panel.js']){
  assert.equal(html.split('/romo-panel-qa/'+nombre).length-1,1);
  assert.ok(html.indexOf('/romo-panel-qa/'+nombre)>html.indexOf('</script>'));
  assert.ok(fs.existsSync(path.join(raiz,nombre)));
 }
 assert.ok(html.includes('id="ukiArchivoMensualRoot"'));
 assert.equal(core,comun);
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
