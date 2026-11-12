/**
 * Tercer local en el mismo panel: puente del catálogo Romo ya preparado.
 * TODO permanece en QA; no abre HTTP ni Neon y NO modifica las dos Uki.
 * db/identity deben obtenerse en un BACKEND después de verificar Google y
 * el rol activo de Romo en su base exclusiva. Nunca llegan desde req.body.
 */
import {leerEditorRomoQA} from './romo-editor-carta-repositorio-qa.mjs';
import {ejecutarCartaDesdePanelUnicoRomoQA} from './romo-panel-carta-interfaz-qa.mjs';

export const ROMO_CATALOGO_ALMACENAMIENTO_SOLO_QA=true;
const STORE='romo:serena';
const ACTIONS=Object.freeze({
 create:['crear-producto','crear-ingrediente','crear-promocion','crear-categoria'],
 edit:['editar-producto','editar-ingrediente','editar-promocion','editar-precio','renombrar-categoria'],
 retire:['retirar-producto','retirar-ingrediente','retirar-promocion','retirar-categoria'],
 restore:['restaurar-producto','restaurar-ingrediente','restaurar-promocion','restaurar-categoria'],
 availability:['marcar-agotado','marcar-disponible'],
 discount:['editar-descuento'],
 category:['crear-categoria','renombrar-categoria','retirar-categoria','restaurar-categoria']
});
function check(request,mode){
 if(!request||request.storeId!==STORE||request.area!=='catalog'||
    request.fechaOperativa!==null)
  throw Error('Carta sólo pertenece a Romo La Serena');
 if(mode==='read'&&(request.action!=='read'||request.payload!==null))
  throw Error('Solo consulta de catálogo sin otros parámetros');
 if(mode==='write'&&!Object.hasOwn(ACTIONS,request.action))
  throw Error('Cambio comercial de Romo no reconocido');
}
export function crearAlmacenamientoCatalogoRomoQA({db,identity}={}){
 if(!db||typeof db.query!=='function')
  throw Error('El catálogo requiere la base exclusiva de Romo');
 if(!identity||identity.brand!=='romo'||!Array.isArray(identity.branches)||
    !identity.branches.includes('serena'))
  throw Error('Identidad de Romo no comprobada');
 return Object.freeze({
  storeId:STORE,
  async read(request){
   check(request,'read');
   const snapshot=await leerEditorRomoQA({db,identity});
   return Object.freeze({storeId:STORE,area:'catalog',revision:snapshot?.revision??0,
     snapshot:snapshot===null?null:structuredClone(snapshot)});
  },
  async write(request){
   check(request,'write');
   const p=request.payload;
   if(!p||typeof p!=='object'||Array.isArray(p)||
      Object.keys(p).sort().join('|')!=='action|area|data'||
      !ACTIONS[request.action].includes(p.action)||!p.data||
      typeof p.data!=='object'||Array.isArray(p.data)||
      Object.hasOwn(p.data,'identity')||Object.hasOwn(p.data,'role')||
      Object.hasOwn(p.data,'brand')||Object.hasOwn(p.data,'storeId'))
    throw Error('Formulario no autorizado para esta operación de Romo');
   const result=await ejecutarCartaDesdePanelUnicoRomoQA({
    storeId:STORE,area:p.area,action:p.action,data:p.data,
    identity,db
   });
   return Object.freeze({storeId:STORE,area:'catalog',revision:result.revision,
     editedSection:result.area});
  }
 });
}
