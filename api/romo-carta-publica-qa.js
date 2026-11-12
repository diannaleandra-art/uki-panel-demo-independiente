'use strict';
/**
 * Romo La Serena: sólo la vista pública FILTRADA del catálogo Romo.
 * NO devuelve borradores, dueños, inventario, pedidos ni datos de Uki.
 * Se activa solamente al aprobar la publicación comercial de la carta.
 */
const deny=(res,code,error)=>res.status(code).json({ok:false,error});
module.exports=async function romoCartaPublicaQA(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('Vary','Origin');
 const env=process.env;
 const expected=String(env.ROMO_CARTA_ALLOWED_ORIGIN||'');
 const origin=String(req.headers?.origin||'');
 if(env.VERCEL_ENV!=='production'||env.ROMO_CARTA_PUBLICA_LIVE_ENABLED!=='true'||
    !/^https:\/\/[^\/\s?#@]+$/.test(expected)||origin!==expected)
  return deny(res,503,'La carta pública de Romo todavía no está habilitada');
 res.setHeader('Access-Control-Allow-Origin',expected);
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return deny(res,405,'Solo consulta de la carta Romo');
 if(req.query&&Object.keys(req.query).length!==0)
  return deny(res,400,'No se permite elegir otra sucursal');
 let reading,repository,config,db;
 try{
  reading=await import('../lib/romo-claves-lectura-servidor-qa.mjs');
  repository=await import('../lib/romo-editor-carta-repositorio-qa.mjs');
  config=reading.romoPrivateReadConfig(env);
  if(!config||config.storeId!=='romo:serena')
   return deny(res,503,'Base Romo no configurada');
  const sql=require('@neondatabase/serverless').neon(config.url);
  if(typeof sql.query!=='function')throw Error('Servicio de lectura no disponible');
  db=Object.freeze({query:(statement,values)=>sql.query(statement,values)});
 }catch{
  return deny(res,503,'La carta Romo no está conectada');
 }
 try{
  const catalog=await repository.leerCartaPublicaRomoQA({db});
  if(!catalog||catalog.storeId!=='romo:serena'||
     !['products','promotions','ingredients'].every(k=>Array.isArray(catalog[k]))||
     !Number.isSafeInteger(catalog.revision))
   return deny(res,503,'Catálogo Romo incompleto');
  // El repositorio elimina previamente toda ficha visible=false.
  // Esta ruta nunca publica datos de Uki o contenido editable sin filtro.
  const result={ok:true,storeId:'romo:serena',revision:catalog.revision,
   products:catalog.products,promotions:catalog.promotions,
   ingredients:catalog.ingredients,categorias:catalog.categorias||[]};
  if([...result.products,...result.promotions,...result.ingredients]
    .some(x=>typeof x.sku!=='string'||!x.sku.startsWith('romo:')||
      /pizza/i.test(x.name||'')))
   return deny(res,503,'Datos de otra carta no admitidos');
  return res.status(200).json(result);
 }catch{
  return deny(res,503,'No se pudo consultar la carta Romo');
 }
};
