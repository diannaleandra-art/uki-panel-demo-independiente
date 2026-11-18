/**
 * No se acepta una solicitud de carta como pendiente sin cotización
 * en la fuente efectiva aprobada. Únicamente backend Romo QA.
 * Este módulo queda sin usar mientras la recepción pública esté cerrada.
 */
import entornoPanel from './romo-entorno-panel.cjs';
const {entornoPanelRomoAutorizado}=entornoPanel;
const STORE='romo:serena';
const ORIGIN=/^https:\/\/[a-z0-9.-]+$/i;
const SHA=/^[a-f0-9]{64}$/;
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function assert(x,message){if(!x)throw Object.assign(new Error(message),{status:503});}
async function getJSON(url,options={},max=200000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9500);
 try{
  const response=await fetch(url,{
   cache:'no-store',redirect:'error',signal:ctrl.signal,...options
  });
  if(!response.ok)throw Error('La fuente de cotización respondió '+response.status);
  const text=await response.text();
  if(text.length>max)throw Error('Respuesta de cotización demasiado grande');
  return JSON.parse(text);
 }finally{clearTimeout(timer);}
}
export function configurarCotizadorRomoQA(env){
 if(!entornoPanelRomoAutorizado(env)||
    env.ROMO_COTIZADOR_PROXY_QA_ENABLED!=='true')return null;
 const carta=String(env.ROMO_CARTA_CATALOGO_QA_ORIGIN||'');
 const panel=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const secret=String(env.ROMO_COTIZADOR_SERVER_SECRET||'');
 if(!ORIGIN.test(carta)||!ORIGIN.test(panel)||panel===carta||
    carta.includes('..')||panel.includes('..')||
    secret.length<32||secret.length>256)return null;
 return Object.freeze({carta,panel,secret});
}
export async function cotizarSolicitudRomoServidorQA({db,body,env=process.env}={}){
 const cfg=configurarCotizadorRomoQA(env);
 assert(cfg,'Cotizador privado Romo no preparado');
 assert(db&&typeof db.query==='function','Conexión Neon Romo no autorizada');
 assert(OBJ(body)&&OBJ(body.cotizacion)&&
    Array.isArray(body.cotizacion.items),'El pedido no trae sus productos');
 const carta=await getJSON(cfg.carta+'/api/romo-catalogo-aprobado-qa',{
    headers:{Origin:cfg.panel,Accept:'application/json',
      ...await require('../lib/romo-oidc-s2s-qa.cjs').headersOIDCRomoQA(env)}
 });
 if(!OBJ(carta)||carta.storeId!==STORE||carta.readOnly!==true)
  throw Object.assign(new Error('Carta Romo no confirmada'),{status:503});
 const rows=await db.query(
  'SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',
  [STORE]);
 assert(Array.isArray(rows)&&rows.length<=1,'Revisión del catálogo Romo no encontrada');
 const edit=await import('./romo-carta-ediciones-seguras-qa.mjs');
 const vista=edit.vistaEdicionesRomoQA(carta,rows[0]||null);
 const projection=await import('./romo-carta-feed-cotizacion-qa.mjs');
 const feed=projection.construirFeedRomoQA(carta,vista);
 assert(body.cotizacion.revision===feed.revision&&
   body.cotizacion.baseSha256===feed.baseSha256,
   'La carta cambió desde que el cliente creó el pedido');
 const response=await getJSON(cfg.carta+'/api/romo-cotizacion-servidor-qa',{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json',
      'X-Romo-Cotizador-Secret':cfg.secret,
      ...await require('../lib/romo-oidc-s2s-qa.cjs').headersOIDCRomoQA(env)},
   body:JSON.stringify({storeId:STORE,cotizacion:body.cotizacion,
     feed,totalIndicado:body.totalIndicado})
 },200000);
 assert(response?.ok===true&&response.verified===true&&
   response.storeId===STORE&&response.countsAsSale===false&&
   response.revision===feed.revision&&response.baseSha256===feed.baseSha256&&
   Number.isSafeInteger(response.subtotalProductos)&&
   Number.isSafeInteger(response.deliveryFee)&&
   Array.isArray(response.cocinaLineas)&&
   response.cocinaLineas.length===body.cotizacion.items.length&&
   response.cocinaLineas.every(x=>typeof x==='string'&&x.length>20&&x.length<=6000)&&
   response.total===body.totalIndicado,
   'El cotizador no confirmó los valores del pedido');
 return Object.freeze({
   ...response,revision:feed.revision,baseSha256:feed.baseSha256,
   // Solo datos imprescindibles; no incluye credenciales privadas.
   confirmed:true
 });
}
