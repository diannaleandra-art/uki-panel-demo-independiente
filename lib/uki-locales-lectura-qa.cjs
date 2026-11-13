'use strict';
/* Solo lectura de borradores después de Google+PIN de dueños. Sin ventas. */
const LIST_SQL="SELECT id,negocio_id,sucursal_id,store_id,configuracion,estado,revision FROM public.fin_locales_operativos_qa WHERE estado='borrador' ORDER BY actualizado_en DESC LIMIT 100";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mod=['carta','pedidos','caja','inventario','timbres','cierres','publicado'];
function sanitize(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||row.estado!=='borrador'||
  ![row.id,row.negocio_id,row.sucursal_id].every(v=>typeof v==='string'&&ID.test(v))||
  !(row.store_id==='romo:serena'||row.store_id==='uki:serena'||row.store_id==='uki:arica'||
    (typeof row.store_id==='string'&&row.store_id.startsWith('local:')&&ID.test(row.store_id.slice(6))))||
  !Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1)
  throw Error('Registro inválido');
 const c=row.configuracion;
 if(!c||typeof c!=='object'||Array.isArray(c)||c.version!==1||
  c.motor!=='uki-panel-unico'||c.copiarDatos!==false||!c.modulos||
  Object.keys(c.modulos).length!==mod.length||mod.some(k=>c.modulos[k]!==false))
  throw Error('Borrador no seguro');
 const str=(v,n)=>typeof v==='string'&&v.length<=n?v:'';
 const color=str(c.color,7);
 if(!/^#[a-f0-9]{6}$/i.test(color))throw Error('Color inválido');
 const config={version:1,motor:'uki-panel-unico',copiarDatos:false,
  nombre:str(c.nombre,90),direccion:str(c.direccion,200),
  whatsapp:str(c.whatsapp,30),instagram:str(c.instagram,50),
  horarios:str(c.horarios,180),plantilla:c.plantilla==='carta-vacia'?'carta-vacia':'uki-motor',
  color,logoUrl:str(c.logoUrl,500),portadaUrl:str(c.portadaUrl,500),
  modulos:Object.fromEntries(mod.map(k=>[k,false]))};
 if(config.nombre.length<3||config.direccion.length<5)throw Error('Ficha incompleta');
 return {id:row.id,negocio_id:row.negocio_id,sucursal_id:row.sucursal_id,
  store_id:row.store_id,estado:'borrador',revision:Number(row.revision),configuracion:config};
}
async function listQA(db){
 if(typeof db?.query!=='function')throw Error('Sin base financiera');
 const result=await db.query(LIST_SQL);
 if(!Array.isArray(result)||result.length>100)throw Error('Lista inválida');
 return result.map(sanitize);
}
module.exports={LIST_SQL,sanitize,listQA};
