import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const api=require('../api/mi-administracion-live.js');
const {dbUrl,envOk}=api._testing;
const code=readFileSync(new URL('../api/mi-administracion-live.js',import.meta.url),'utf8');
const qa={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'qa/integracion-panel-unico-romo-serena-20261112',
 ROMO_FIN_SYNC_QA_BRANCH:'qa/integracion-panel-unico-romo-serena-20261112',
 ROMO_FIN_OWNER_QA_ENABLED:'true',
 ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech/neondb'
};
test('solo preview exacta con bandera explícita puede usar la base financiera QA',()=>{
 assert.equal(envOk(qa),true);
 assert.match(dbUrl(qa),/ep-lucky-band-b5j3itkw/);
 for(const overrides of [
  {VERCEL_ENV:'production'}, {VERCEL_ENV:'development'},
  {VERCEL_GIT_COMMIT_REF:'main'},
  {ROMO_FIN_SYNC_QA_BRANCH:'main'},
  {ROMO_FIN_OWNER_QA_ENABLED:'false'},
  {ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech/neondb'},
  {ROMO_FIN_QA_DATABASE_URL:'postgres://qa:fake@ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech/otra'}
 ]){
  const changed={...qa,...overrides};
  assert.equal(dbUrl(changed),null);
 }
});
test('previsualización no cambia la autorización de producción de Mi Administración',()=>{
 const original={VERCEL_ENV:'production',UKI_FIN_PRIVATE_ENABLED:'true',
 UKI_FIN_PRIVATE_DATABASE_URL:'postgres://owner:fake@ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech/neondb'};
 assert.equal(envOk(original),true);
 assert.match(dbUrl(original),/ep-silent-cloud-b57g2l4g/);
 assert.equal(envOk({...original,UKI_FIN_PRIVATE_ENABLED:'false'}),false);
});
test('preview restringe todas las acciones a acceso, salida y cierres Romo',()=>{
 assert.match(code,/if\\(romoFinancePreview\\(\\)\\)/);
 const from=code.indexOf("const permitidos=new Set(");
 const to=code.indexOf("try{",from);
 const block=code.slice(from,to);
 assert.ok(from>=0&&to>from);
 for(const action of ['estado','ingresar_pin','salir','listar_cierres_romo_qa','sincronizar_cierres_romo_qa'])
  assert.ok(block.includes("'"+action+"'"));
 for(const forbidden of ['guardar_movimiento','guardar_compra_factura','configurar_pin',
  'anular_movimiento','abrir_documento','guardar_costo'])
  assert.ok(!block.includes("'"+forbidden+"'"));
 assert.match(block,/if\\(!permitidos\\.has\\(action\\)\\)/);
});
