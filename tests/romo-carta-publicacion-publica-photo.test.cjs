'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const feed=fs.readFileSync(path.join(root,'api/romo-carta-cambios-publicos-qa.js'),'utf8');
const foto=fs.readFileSync(path.join(root,'api/romo-carta-foto-publica-qa.js'),'utf8');
test('solo orígenes Romo exactos consultan su feed comercial',()=>{
 for(const origin of [
  'https://romos-sushi-serena.vercel.app',
  'https://romos-sushi-carta-qa.vercel.app',
  'https://romos-sushi-carta-qa-diannaleandra-7046.vercel.app'
 ])assert.ok(feed.includes(origin)||origin==='https://romos-sushi-serena.vercel.app');
 assert.match(feed,/const cartaOrigenes=new Set/);
 assert.match(feed,/cartaOrigenes\.has\(origin\)/);
 assert.match(feed,/Access-Control-Allow-Origin',origin/);
 assert.doesNotMatch(feed,/Access-Control-Allow-Origin','\*'/);
});
test('fotografía pública solo GET, si publicada y versión exacta',()=>{
 assert.match(foto,/req\.method!=='GET'/);
 assert.match(foto,/\/\^monthly:romoq-/);
 assert.match(foto,/p->>'photoVersion'/);
 assert.match(foto,/p->>'available'/);
 assert.match(foto,/AND version=\$3/);
 assert.match(foto,/Content-Type','image\/jpeg/);
 assert.match(foto,/bytes\.length>300000/);
 for(const fragment of ['DELETE FROM','UPDATE public','INSERT INTO'])
  assert.ok(!foto.includes(fragment),'El endpoint de fotos no debe escribir');
 assert.doesNotMatch(foto,/Authorization/);
});
test('servidor de fotos y feed compilan con sintaxis válida',()=>{
 assert.doesNotThrow(()=>new vm.Script(foto,{filename:'romo-carta-foto-publica-qa.js'}));
 assert.doesNotThrow(()=>new vm.Script(feed,{filename:'romo-carta-cambios-publicos-qa.js'}));
});

test('prueba real GET: la carta y el panel muestran la Familiar 108 con imagen válida',async()=>{
 const origen='https://romos-sushi-serena.vercel.app';
 const api='https://romos-sushi-panel.vercel.app/api/romo-promociones-publicas-qa';
 const res=await fetch(api,{headers:{Origin:origen,Accept:'application/json'},signal:AbortSignal.timeout(18000)});
 assert.equal(res.status,200,'API pública de promociones no responde');
 assert.equal(res.headers.get('access-control-allow-origin'),origen);
 const data=await res.json();
 assert.equal(data.ok,true);
 assert.equal(data.storeId,'romo:serena');
 const sku='monthly:romoq-036c69f1-1769-45c4-8aaa-2d814c206b2a';
 const promo=(data.customPromotions||[]).find(p=>p.sku===sku);
 assert.ok(promo,'La promoción 108 no llegó a la API');
 assert.equal(promo.price,27000);
 assert.equal(promo.config.rollCount*promo.config.piecesPerRoll,108);
 assert.equal(promo.config.sauceCount,8);
 const page=await fetch(origen,{signal:AbortSignal.timeout(18000)});
 assert.equal(page.status,200,'Dominio oficial de carta inaccesible');
 const html=await page.text();
 console.log('Carta oficial:',page.url,'longitud:',html.length,'cache:',page.headers.get('x-vercel-cache'),
  'marcador nuevo:',html.indexOf('romo-promociones-publicas-qa'),
  'marcador anterior:',html.indexOf('romos_products?select='));
 const immutable=await fetch('https://romos-sushi-carta-5kicy6sql-diannaleandra-7046.vercel.app',{
  signal:AbortSignal.timeout(18000)});
 const immutableBody=await immutable.text();
 console.log('Deployment inmóvil:',immutable.status,immutable.url,'longitud:',immutableBody.length,
  'marcador nuevo:',immutableBody.indexOf('romo-promociones-publicas-qa'));
 assert.ok(html.includes(api),'El dominio de clientes aún tiene una versión sin la promoción');
 const imagen=await fetch('https://romos-sushi-panel.vercel.app/api/romo-carta-foto-publica-qa?sku='+encodeURIComponent(sku),{
  signal:AbortSignal.timeout(18000)});
 assert.equal(imagen.status,200,'Foto de promoción publicada no cargó');
 assert.equal(imagen.headers.get('content-type'),'image/jpeg');
 const bytes=new Uint8Array(await imagen.arrayBuffer());
 assert.ok(bytes.length>1024&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217);
});
