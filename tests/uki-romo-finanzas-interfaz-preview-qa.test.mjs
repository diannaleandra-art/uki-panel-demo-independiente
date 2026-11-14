import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/mi-administracion-duenos.html',import.meta.url),'utf8');
test('mismo panel Mi Administración ofrece diagnóstico sólo en alias QA verificado',()=>{
 assert.match(html,/ROMO_FIN_OWNER_QA_PREVIEW=location\.hostname===/);
 assert.match(html,/uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046\.vercel\.app/);
 assert.match(html,/const ROMO_FIN_OWNER_SYNC_QA_ENABLED=false/);
 assert.match(html,/function mostrarRomoQaPreview\(\)/);
 assert.match(html,/id="romoQaTester"/);
 assert.match(html,/if\(ROMO_FIN_OWNER_QA_PREVIEW\)\{mostrarRomoQaPreview\(\);return\}/);
});
test('la cuenta Uki normal continúa usando su API original',()=>{
 assert.match(html,/location\.origin\+'\/api\/mi-administracion-live'/);
 assert.match(html,/https:\/\/uki-sushi-inventario\.vercel\.app\/api\/mi-administracion-live/);
 assert.match(html,/if\(!ROMO_FIN_OWNER_QA_PREVIEW\)return/);
});
test('diagnóstico no envía contraseñas ni importes al servidor',()=>{
 const q=html.slice(html.indexOf("$('romoQaCheck').onclick"),html.indexOf("$('exit').onclick"));
 assert.match(q,/await api\('listar_cierres_romo_qa',\{desde:day,hasta:day\}\)/);
 assert.match(q,/await api\('sincronizar_cierres_romo_qa',\{desde:fecha,hasta:fecha\}\)/);
 assert.doesNotMatch(q,/guardar_movimiento|configurar_pin|password|cliente|telefono/);
});
