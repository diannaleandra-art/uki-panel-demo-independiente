'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const html=readFileSync(join(__dirname,'..','firebase/uki-cierres-admin-qa.html'),'utf8');
test('cierres QA no se conectan al estado local ni al PIN compartido',()=>{
 assert.match(html,/Cierres privados/);
 assert.match(html,/getIdToken\(auth\.currentUser,true\)/);
 assert.match(html,/Authorization:'Bearer '\+token/);
 assert.match(html,/api\/uki-finanzas-qa/);
 assert.doesNotMatch(html,/uki-sushi-nube|uki-snapshot-cifrado|ukiQAGet|ukiQASet|ukiAccesoClave|UKIDEV1\./);
});
test('pantalla es de consulta: no edita ni transporta registros a producción',()=>{
 assert.match(html,/method:'GET'/);
 assert.doesNotMatch(html,/method:'(?:PUT|POST|PATCH|DELETE)'/);
 assert.doesNotMatch(html,/uki-sushi-pedidos\.vercel\.app\/api/);
 assert.match(html,/const hostOK=/);
 assert.match(html,/No contiene ventas ni cierres reales/);
});
test('no se inyecta contenido de los cierres como HTML',()=>{
 assert.match(html,/\$\('resultado'\)\.textContent=/);
 assert.doesNotMatch(html,/innerHTML\s*=/);
});
