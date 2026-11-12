/**
 * Inventario real de Romo en el MISMO selector del panel Uki — adaptador QA.
 * Reutiliza lib/romo-inventario-integracion-qa.mjs (ya creado y probado).
 * Sin HTML duplicado, red, usuarios, claves ni escritura por sí solo.
 *
 * El backend debe inyectar db + identity verificada con Google o PIN
 * autorizado de inventario; NUNCA aceptar identity de un formulario cliente.
 * No activa la tabla Neon ni publica el inventario de Romo.
 */
import {
 readRomoInventory,saveRomoInventory,RomoInventoryConflict
} from './romo-inventario-integracion-qa.mjs';
import {reportRomoInventory} from './romo-inventario-modelo-qa.mjs';

const STORE='romo:serena';
const ACTIONS=new Set(['create','edit','retire','count']);
const EDITABLE=new Set(['name','unit','recibido','hay','minimo','disponible']);
const COUNTABLE=new Set(['recibido','hay','minimo','disponible']);
const hasOwn=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const safeId=id=>typeof id==='string'&&/^[a-z0-9:_-]{1,100}$/.test(id);

function guard(request,kind){
 if(!plain(request)||request.storeId!==STORE||request.area!=='inventory'||
    request.fechaOperativa!==null)
  throw Error('Inventario Romo no permite leer o escribir en Uki');
 if(kind==='read'&&(request.action!=='read'||request.payload!==null))
  throw Error('Consulta de inventario no válida');
 if(kind==='write'&&!ACTIONS.has(request.action))
  throw Error('Cambio de inventario no reconocido');
}
function payloadGuard(payload){
 if(!plain(payload)||!Number.isSafeInteger(payload.expectedRevision)||
    payload.expectedRevision<0||['identity','role','brand','storeId','branch',
    'sucursal','local','token','password','pin'].some(k=>hasOwn(payload,k)))
  throw Error('Datos de inventario Romo no autorizados');
}
function mutation(snapshot,action,payload){
 const items=snapshot.items.map(x=>({...x}));
 if(action==='create'){
  if(!plain(payload.item)||!safeId(payload.item.id)||
     Object.keys(payload).sort().join('|')!=='expectedRevision|item')
   throw Error('Artículo de Romo inválido');
  if(items.some(x=>x.id===payload.item.id))throw Error('Artículo ya agregado');
  items.push({...payload.item});
 }else{
  const key=payload.id;
  if(!safeId(key)||items.findIndex(x=>x.id===key)<0)
   throw Error('Artículo de Romo no encontrado');
  const i=items.findIndex(x=>x.id===key);
  if(action==='retire'){
   if(Object.keys(payload).sort().join('|')!=='expectedRevision|id')
    throw Error('Retiro de artículo inválido');
   items.splice(i,1);
  }else{
   const allowed=action==='count'?COUNTABLE:EDITABLE;
   if(Object.keys(payload).sort().join('|')!=='expectedRevision|id|patch'||
      !plain(payload.patch)||Object.keys(payload.patch).length<1||
      Object.keys(payload.patch).some(k=>!allowed.has(k)))
    throw Error('Los cambios de inventario requieren campos permitidos');
   items[i]={...items[i],...payload.patch};
  }
 }
 return {...snapshot,items};
}
export function crearAlmacenamientoInventarioRomoQA({db,identity}={}){
 if(!db||typeof db.query!=='function')
  throw Error('Se requiere la base exclusiva de Romo');
 if(!identity||identity.brand!=='romo'||!Array.isArray(identity.branches)||
    identity.branches.length!==1||identity.branches[0]!=='serena')
  throw Error('Identidad de Romo La Serena no verificada');
 return Object.freeze({
  storeId:STORE,
  async read(request){
   guard(request,'read');
   const {inventory,revision}=await readRomoInventory({db,identity});
   const report=reportRomoInventory(STORE,inventory.items);
   return Object.freeze({
    storeId:STORE,area:'inventory',revision,
    inventory:structuredClone(inventory),report:structuredClone(report)
   });
  },
  async write(request){
   guard(request,'write');
   payloadGuard(request.payload);
   const {expectedRevision}=request.payload;
   const before=await readRomoInventory({db,identity});
   if(before.revision!==expectedRevision)throw new RomoInventoryConflict();
   const inventory=mutation(before.inventory,request.action,request.payload);
   const result=await saveRomoInventory({
    db,identity,expectedRevision,inventory
   });
   return Object.freeze({
    storeId:STORE,area:'inventory',revision:result.revision,
    action:request.action,changed:true
   });
  }
 });
}
export const ROMO_INVENTARIO_PANEL_NO_PUBLICADO=true;
