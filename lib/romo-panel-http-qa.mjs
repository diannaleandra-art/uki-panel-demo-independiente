/**
 * Una sola API del panel Uki: catálogo e inventario del tercer local Romo.
 * El endpoint exterior valida firma Firebase Google + UID/rol en Neon.
 * Aquí jamás se admiten identidades o conexiones aportadas por el navegador.
 * No activa ni publica nada; las banderas de la API están cerradas por defecto.
 */
import {leerEditorRomoQA} from './romo-editor-carta-repositorio-qa.mjs';
import {ejecutarCartaDesdePanelUnicoRomoQA} from './romo-panel-carta-interfaz-qa.mjs';
import {crearAlmacenamientoInventarioRomoQA} from './romo-almacenamiento-inventario-panel-qa.mjs';

const STORE='romo:serena';
const INVENTORY_ACTIONS=new Set(['create','edit','retire','count']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;
const fields=value=>Object.keys(value).sort().join('|');
const exclusive=(body,fieldString)=>plain(body)&&fields(body)===fieldString;
const check=(db,identity)=>{
 if(!db||typeof db.query!=='function')throw Error('Conexión Romo obligatoria');
 if(!identity||identity.brand!=='romo'||!Array.isArray(identity.branches)||
    identity.branches.length!==1||identity.branches[0]!=='serena')
   throw Error('Identidad Romo no autorizada');
};
export async function procesarAreaPanelRomoQA({area,method,body,db,identity}={}){
 check(db,identity);
 if(!['GET','POST'].includes(method))throw Error('Método no permitido');
 if(area==='catalog'){
  if(method==='GET'){
   const catalog=await leerEditorRomoQA({db,identity});
   return Object.freeze({storeId:STORE,area,revision:catalog?.revision??0,
    catalog:catalog===null?null:structuredClone(catalog),ventasHabilitadas:false});
  }
  if(identity.role!=='duenos')throw Error('Solo dueños tienen permiso de edición');
  if(!exclusive(body,'action|data|section|storeId')||body.storeId!==STORE||
     !plain(body.data)||JSON.stringify(body).length>175000)
   throw Error('Formulario de catálogo inválido');
  const result=await ejecutarCartaDesdePanelUnicoRomoQA({
   storeId:STORE,area:body.section,action:body.action,data:body.data,db,identity
  });
  return Object.freeze({storeId:STORE,area,revision:result.revision,
   cambiosConfirmados:true,ventasHabilitadas:false});
 }
 if(area==='inventory'){
  const backend=crearAlmacenamientoInventarioRomoQA({db,identity});
  if(method==='GET'){
   const response=await backend.read({storeId:STORE,area,action:'read',
    payload:null,fechaOperativa:null});
   return Object.freeze({...response,ventasHabilitadas:false});
  }
  if(!exclusive(body,'action|payload|storeId')||body.storeId!==STORE||
     !INVENTORY_ACTIONS.has(body.action)||!plain(body.payload)||
     JSON.stringify(body).length>220000)
   throw Error('Formulario de inventario inválido');
  const response=await backend.write({storeId:STORE,area,
   action:body.action,payload:body.payload,fechaOperativa:null});
  return Object.freeze({...response,ventasHabilitadas:false});
 }
 throw Error('Área de Romo no reconocida');
}
export const ROMO_AREAS_PANEL_REQUIEREN_AUTORIZACION=true;
