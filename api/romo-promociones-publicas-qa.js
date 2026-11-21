'use strict';
/**
 * Consulta independiente, de SOLO LECTURA, de promociones ya publicadas
 * en la revisión comercial de Romo La Serena. No devuelve borradores,
 * documentos privados, clientes, ni modifica el catálogo o las ventas.
 *
 * No necesita la carta base de otro servidor: esa dependencia bloqueaba
 * que Romo mostrara promociones ya confirmadas en Neon.
 */
const STORE='romo:serena';
const {config}=require('./romo-carta-cambios-publicos-qa.js')._internalQA;
const ORIGENES_ADICIONALES=Object.freeze([
 'https://romos-sushi-carta-qa.vercel.app'
]);
const SKU=/^monthly:romoq-[a-f0-9-]{36}$/;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const int=x=>Number.isSafeInteger(x);
const result=(res,status,error)=>res.status(status).json({ok:false,storeId:STORE,error});
function proyectarRetirados(contenido){
 const a=contenido.gestion?.archivedProducts??[];
 if(!Array.isArray(a)||a.length>40||new Set(a).size!==a.length||
    a.some(x=>typeof x!=='string'||!/^(classic|premium|monthly|dish|topping|extra):[^\r\n\u0000-\u001f]{1,92}$/.test(x)))
  throw Error('Referencias retiradas no verificadas');
 return [...a];
}
function proyectarPromociones(contenido,revision){
 if(!int(revision)||revision<1||!isObject(contenido)||
    contenido.storeId!==STORE||contenido.revision!==revision||
    !isObject(contenido.gestion)||
    !Array.isArray(contenido.gestion.promotions)||
    contenido.gestion.promotions.length>70)
  throw Error('Revisión comercial no verificada');
 const vistos=new Set(),out=[];
 for(const p of contenido.gestion.promotions){
  const c=p?.config,sku=p?.sku;
  if(!isObject(p)||!isObject(c)||typeof sku!=='string'||!SKU.test(sku)||
     vistos.has(sku)||typeof p.name!=='string'||p.name.trim().length<2||
     p.name.length>100||typeof p.description!=='string'||p.description.length>500||
     !int(p.price)||p.price<1||p.price>1000000||
     typeof p.available!=='boolean'||!int(p.photoVersion)||p.photoVersion<1||
     !['sushi','gohan','combo'].includes(c.promoType)||
     !int(c.rollCount)||c.rollCount<0||c.rollCount>20||
     ![10,12].includes(c.piecesPerRoll)||
     !int(c.sauceCount)||c.sauceCount<0||c.sauceCount>20||
     !int(c.korokes)||c.korokes<0||c.korokes>30||
     !Array.isArray(c.payments)||c.payments.length<1||c.payments.length>6)
    throw Error('Promoción comercial inválida');
  vistos.add(sku);
  if(p.available!==true)continue;
  out.push({
   sku,name:p.name,description:p.description,price:p.price,
   available:true,photoVersion:p.photoVersion,
   ...(int(p.originalPrice)&&p.originalPrice>p.price?{originalPrice:p.originalPrice}:{}),
   config:{
    promoType:c.promoType,rollCount:c.rollCount,
    piecesPerRoll:c.piecesPerRoll,sauceCount:c.sauceCount,
    korokes:c.korokes,payments:c.payments.filter(x=>
     ['efectivo','transferencia','debito','credito','edenred','junaeb'].includes(x))
   }
  });
 }
 return out;
}
module.exports=async function promocionesPublicasRomo(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=config(process.env);
 if(!cfg)return result(res,503,'Consulta pública de Romo deshabilitada');
 const origin=String(req.headers?.origin||'');
 const allowed=origin===cfg.carta||ORIGENES_ADICIONALES.includes(origin);
 if(!allowed)return result(res,403,'La carta de origen no está autorizada');
 res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Accept');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return result(res,405,'Sólo consulta pública');
 try{
  const sql=require('@neondatabase/serverless').neon(cfg.database);
  const rows=await sql.query(
   'SELECT revision,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1 AND revision>=1',
   [STORE]);
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Edición comercial no encontrada');
  const revision=Number(rows[0].revision);
  const promociones=proyectarPromociones(rows[0].contenido,revision);
  const ingredientConfig=require('../lib/romo-ingredientes-publicacion.cjs').validate(rows[0].contenido.gestion.ingredientConfig);
  return res.status(200).json({
   ok:true,storeId:STORE,readOnly:true,revision,
   customPromotions:promociones,archivedProducts:proyectarRetirados(rows[0].contenido),ingredientConfig
  });
 }catch(e){
  console.error('Lectura promociones publicadas Romo no confirmada',String(e?.message||e));
  return result(res,503,'No se pudo comprobar la carta publicada de Romo');
 }
};
module.exports._test={proyectarPromociones,proyectarRetirados};
