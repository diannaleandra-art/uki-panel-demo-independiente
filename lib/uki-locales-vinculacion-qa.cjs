'use strict';
// Vinculación EXPLÍCITA, nunca por similitud de nombre solamente.
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[’'.,]/g,' ').replace(/\s+/g,' ').trim();
const validId=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function identificarLocalOperativoQA({solicitud='',negocio='',sucursal='',direccion='',nuevoId}={}){
 if(!validId(String(nuevoId||'')))throw Error('ID nuevo inválido');
 const intent=String(solicitud||'');
 if(!['','romo:serena'].includes(intent))throw Error('Local existente no autorizado');
 const esRomo=/\bromo\b/.test(norm(negocio))&&/serena|balmaceda/.test(norm(sucursal))&&
  /balmaceda\s*1612/.test(norm(direccion));
 if(intent==='romo:serena'){
  if(!esRomo)throw Error('Selecciona el negocio y sucursal Romo La Serena de Balmaceda 1612');
  return 'romo:serena';
 }
 if(esRomo)throw Error('Romo La Serena ya existe; selecciona Vincular local existente');
 return 'local:'+nuevoId;
}
module.exports={identificarLocalOperativoQA};
