/**
 * Lectura de carta de Romo, dentro del mismo panel de Uki.
 * SOLO LECTURA, no cambia precios. Ruta deliberadamente vacía.
 * La base privada valida Firebase Google y permiso propio de Romo.
 */
export const ROMO_CATALOGO_ENDPOINT_QA='';
const STORE='romo:serena';
export function cartaRomoDisponibleQA(){return Boolean(ROMO_CATALOGO_ENDPOINT_QA)}
export async function obtenerCartaRomoPanelQA({
 endpoint=ROMO_CATALOGO_ENDPOINT_QA,
 getGoogleToken=()=>window.ukiInventarioToken?.(),
 fetchFn=fetch
}={}){
 if(!ROMO_CATALOGO_ENDPOINT_QA||endpoint!==ROMO_CATALOGO_ENDPOINT_QA)
  throw Error('La sincronización de carta Romo todavía no está habilitada');
 const token=await getGoogleToken();
 if(typeof token!=='string'||token.length<30)
  throw Error('Inicia sesión con Google para consultar Romo');
 const reply=await fetchFn(endpoint,{
  method:'GET',headers:{Authorization:'Bearer '+token},
  cache:'no-store',credentials:'omit'
 });
 if(!reply.ok)throw Error('El catálogo Romo no está disponible');
 const data=await reply.json();
 if(data?.ok!==true||data.storeId!==STORE||data.readOnly!==true||
    !Number.isSafeInteger(data.revision)||data.revision<1||
    data.catalogo?.storeId!==STORE||data.catalogo?.brand!=='romo'||
    !['categories','products','ingredients','promotions'].every(
      field=>Array.isArray(data.catalogo?.[field])))
  throw Error('El catálogo no corresponde a Romo La Serena');
 return Object.freeze({storeId:STORE,revision:data.revision,
  categories:data.catalogo.categories,
  products:data.catalogo.products,
  ingredients:data.catalogo.ingredients,
  promotions:data.catalogo.promotions,
  readOnly:true});
}
