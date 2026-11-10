'use strict';
/* PostgreSQL REAL del runner, no Neon; sin credenciales ni datos de clientes. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),{Client}=require('pg');
const api=require('../api/uki-carta-precios-live.js')._testing;
const connectionString=process.env.UKI_QA_LOCAL_POSTGRES_URL;
if(!/^(postgres|postgresql):\/\/ukiqa:[^@]+@(?:127\.0\.0\.1|localhost):5432\/ukiqa$/.test(connectionString||''))
 throw Error('La prueba EXIGE PostgreSQL aislado del runner localhost:5432/ukiqa; Neon está prohibido');
const db=new Client({connectionString,connectionTimeoutMillis:6000});
const sql={query:async(q,params=[])=> (await db.query(q,params)).rows};
const sku='monthly:qa-mensual-12345678',sku2='monthly:qa-mensual-87654321';
const createSql='INSERT INTO public.uki_carta_promos_custom_v1 '+
 '(branch,sku,name,description,price,roll_count,pieces_per_roll,sauce_count,korokes,payments,visible,updated_by) '+
 'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],false,$11) RETURNING sku,visible,version,published_at';
const updateSql='UPDATE public.uki_carta_promos_custom_v1 SET visible=$3,'+
 'published_at=CASE WHEN $3 THEN COALESCE(published_at,NOW()) ELSE published_at END,'+
 'version=version+1,updated_by=$5,updated_at=NOW() '+
 'WHERE branch=$1 AND sku=$2 AND version=$4 AND visible IS DISTINCT FROM $3 '+
 'RETURNING sku,visible,published_at,version';
const get=async(branch,id=sku)=>(await sql.query('SELECT branch,sku,price,visible,published_at,version FROM public.uki_carta_promos_custom_v1 WHERE branch=$1 AND sku=$2',[branch,id]))[0];
const create=async(branch,id=sku,price=16000)=>{
 const item={name:'Promo 60 QA',description:'Ejemplo ficticio',price,rollCount:5,
  piecesPerRoll:12,sauceCount:5,korokes:3,payments:['efectivo','transferencia']};
 assert.ok(api.validPromo(item));
 return (await sql.query(createSql,[branch,id,item.name,item.description,item.price,
   item.rollCount,item.piecesPerRoll,item.sauceCount,item.korokes,item.payments,'qa-aislado']))[0];
};
const photo=async(branch,id=sku)=>(await sql.query('SELECT 1 FROM public.uki_carta_fotos_v1 WHERE branch=$1 AND sku=$2 LIMIT 1',[branch,id])).length>0;
const change=async(branch,id,visible,version)=>{
 if(visible&&!await photo(branch,id))return {error:'Primero sube la fotografía de la promoción'};
 const rows=await sql.query(updateSql,[branch,id,visible,version,'qa-aislado']);
 return {row:rows[0]||null};
};
const list=async(branch)=>(await api.listing(sql,branch,true)).filter(x=>x.kind==='monthly'&&x.custom);
test('Migraciones y ciclo de publicación/retirada/restauración por sucursal sobre PostgreSQL aislado',async()=>{
 const code=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.match(code,/UPDATE public\.uki_carta_promos_custom_v1 SET visible=\$3,published_at=CASE WHEN \$3 THEN COALESCE\(published_at,NOW\(\)\) ELSE published_at END,version=version\+1/);
 assert.match(code,/SELECT 1 FROM public\.uki_carta_fotos_v1 WHERE branch=\$1 AND sku=\$2 LIMIT 1/);
 assert.doesNotMatch(code,/\bDELETE FROM public\.uki_carta_promos_custom_v1\b/i);
 await db.connect();
 try{
  await db.query([
   'CREATE TABLE public.uki_carta_items_v1',
   '(branch TEXT NOT NULL,sku TEXT NOT NULL,kind TEXT NOT NULL,price INTEGER,',
   'available BOOLEAN NOT NULL DEFAULT TRUE,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(branch,sku))'
  ].join(' '));
  await db.query([
   'CREATE TABLE public.uki_carta_productos_custom_v1',
   '(branch TEXT NOT NULL,sku TEXT NOT NULL,kind TEXT NOT NULL,group_key TEXT NOT NULL,',
   "name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL,",
   'available BOOLEAN NOT NULL DEFAULT TRUE,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(branch,sku))'
  ].join(' '));
  const migration=fs.readFileSync('sql/uki-carta-promos-visibilidad-v1.sql','utf8');
  await db.query(migration);
  await db.query(migration); // re-ejecución idempotente sin alterar datos
  const tipos=fs.readFileSync('migrations/2026-11-10-uki-promos-por-tipo-qa.sql','utf8');
  await db.query(tipos);
  await db.query(tipos); // instalación QA idempotente
  await db.query(fs.readFileSync('sql/uki-carta-fotos-v1.sql','utf8'));
  const columns=await sql.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='uki_carta_promos_custom_v1'");
  assert.ok(columns.some(c=>c.column_name==='published_at'));

  // Esta base aislada ni siquiera contiene tablas de pedidos, timbres, caja o cierres.
  const untouched=await sql.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ~ '(pedidos|cierres|caja|timbres)'");
  assert.equal(untouched.length,0);

  const a=await create('arica'),s=await create('serena',sku,17000);
  assert.equal(a.visible,false);assert.equal(s.visible,false);
  assert.equal((await list('arica')).find(x=>x.sku===sku).estadoPublicacion,'Borrador');
  assert.equal((await list('serena')).find(x=>x.sku===sku).price,17000);
  assert.equal((await list('serena')).find(x=>x.sku===sku).estadoPublicacion,'Borrador');

  let result=await change('arica',sku,true,a.version);
  assert.match(result.error,/fotografía/);
  assert.equal((await get('arica')).version,a.version);
  assert.equal((await get('arica')).published_at,null);

  const jpeg=Buffer.from([255,216,255,...Array(128).fill(0),255,217]).toString('base64');
  await sql.query('INSERT INTO public.uki_carta_fotos_v1 (branch,sku,mime,data_base64,updated_by) VALUES($1,$2,$3,$4,$5)',
   ['arica',sku,'image/jpeg',jpeg,'qa-aislado']);
  assert.equal(await photo('arica'),true);assert.equal(await photo('serena'),false);
  result=await change('serena',sku,true,s.version);
  assert.match(result.error,/fotografía/);

  result=await change('arica',sku,true,a.version);
  assert.ok(result.row);assert.equal(result.row.visible,true);
  const firstDate=result.row.published_at.toISOString();
  assert.equal((await list('arica')).find(x=>x.sku===sku).estadoPublicacion,'Publicada');
  assert.equal((await list('serena')).find(x=>x.sku===sku).estadoPublicacion,'Borrador');

  const version=result.row.version;
  const [r1,r2]=await Promise.all([
   change('arica',sku,false,version),change('arica',sku,false,version)
  ]);
  assert.equal([r1.row,r2.row].filter(Boolean).length,1);
  let row=await get('arica');
  assert.equal(row.visible,false);
  assert.equal(row.published_at.toISOString(),firstDate);
  assert.equal((await list('arica')).find(x=>x.sku===sku).estadoPublicacion,'Retirada');
  assert.equal((await list('arica')).filter(x=>x.visible).length,0);
  assert.equal((await list('serena')).find(x=>x.sku===sku).estadoPublicacion,'Borrador');

  result=await change('arica',sku,true,row.version);
  assert.ok(result.row);
  assert.equal(result.row.published_at.toISOString(),firstDate);
  assert.equal((await list('arica')).find(x=>x.sku===sku).estadoPublicacion,'Publicada');

  const second=await create('arica',sku2,12000);
  assert.equal(second.visible,false);
  assert.equal((await list('arica')).filter(x=>x.visible).length,1);
  assert.equal((await list('arica')).find(x=>x.sku===sku2).estadoPublicacion,'Borrador');
  assert.equal((await list('serena')).length,1);
  const count=(await sql.query('SELECT count(*)::int AS c FROM public.uki_carta_promos_custom_v1'))[0].c;
  assert.equal(count,3);

  // Simular en PostgreSQL LOCAL la corrección de una promo originalmente
  // mal registrada como 1 roll de 12 piezas. Nunca toca Neon ni producción.
  const antes=(await sql.query(
   'SELECT sku,price,visible,published_at,version,roll_count,size FROM public.uki_carta_promos_custom_v1 WHERE branch=$1 AND sku=$2',
   ['arica',sku]))[0];
  assert.equal(antes.roll_count,5);
  assert.equal(antes.size,60);
  assert.equal(antes.price,16000);
  assert.equal(antes.visible,true);
  assert.ok(antes.published_at);
  assert.equal(await photo('arica',sku),true);
  const fixed=await sql.query(`
   UPDATE public.uki_carta_promos_custom_v1
   SET name='Gohan QA más dos korokes',description='Gohan clásico · Incluye 2 korokes',
     roll_count=0,pieces_per_roll=12,sauce_count=0,korokes=0,
     promo_type='combo',customizable=false,version=version+1,
     updated_by='qa-aislado',updated_at=NOW()
   WHERE branch=$1 AND sku=$2 AND version=$3 AND price=$4
   RETURNING branch,sku,name,price,visible,published_at,version,roll_count,size,promo_type,customizable`,
   ['arica',sku,antes.version,antes.price]);
  assert.equal(fixed.length,1,'Solo se cambia el registro esperado');
  assert.equal(fixed[0].sku,antes.sku,'No crear otra promo ni cambiar el QR');
  assert.equal(fixed[0].price,antes.price,'Conservar el precio');
  assert.equal(fixed[0].visible,true,'Conservar publicada');
  assert.deepEqual(fixed[0].published_at,antes.published_at,'Conservar primera publicación');
  assert.equal(fixed[0].roll_count,0);
  assert.equal(fixed[0].size,0,'La columna calculada no debe contar piezas falsas');
  assert.equal(fixed[0].promo_type,'combo');
  assert.equal(fixed[0].customizable,false);
  assert.equal(await photo('arica',sku),true,'Conservar su fotografía real');
  const otraSucursal=await get('serena',sku);
  assert.equal(otraSucursal.price,17000,'No modificar la otra sucursal');
  const previousVersion=await sql.query(`
   UPDATE public.uki_carta_promos_custom_v1 SET price=1
   WHERE branch=$1 AND sku=$2 AND version=$3 RETURNING sku`,
   ['arica',sku,antes.version]);
  assert.equal(previousVersion.length,0,'Evitar sobrescribir cambios posteriores');

  console.log('PostgreSQL aislado OK: conversión de gohan, foto, precio, SKU, fecha y sucursal preservados; CERO registros reales.');
 }finally{await db.end();}
});
