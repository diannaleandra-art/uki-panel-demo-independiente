/**
 * Enrolamiento de una CLAVE EXISTENTE de Uki para uso Romo en otros equipos.
 * Una sola prueba AES-GCM por sucursal Uki; NUNCA la contraseña.
 * Roles siempre firmados por Firebase y leídos en Neon en el endpoint.
 * Sin GRANT, sin HTTP directo y sin operaciones de clientes en este módulo.
 */
import {validateRomoPassProof} from './romo-clave-compartida-qa.mjs';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
const STORE='romo:serena';
const FIELDS=['cifrado','formato','iteraciones','iv','salt','storeId','ukiSource'].join('|');
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function verificarAltaClaveRomoQA(proof){
 if(!plain(proof)||Object.keys(proof).sort().join('|')!==FIELDS)
  throw Error('El verificador Romo contiene campos no permitidos');
 const size=JSON.stringify(proof).length;
 if(size>1050)throw Error('El verificador Romo supera el tamaño permitido');
 const valid=validateRomoPassProof(proof);
 if(!['uki:arica','uki:serena'].includes(valid.slot))
  throw Error('No corresponde a clave de Uki');
 return Object.freeze({...proof});
}
export async function enrolarClaveExistenteRomoQA({db,identity,proof}={}){
 const actor=authorizeRomoOperation(identity,'romo','serena','owners.write');
 if(!db||typeof db.query!=='function')
  throw Error('Conexión privada Romo requerida');
 const safe=verificarAltaClaveRomoQA(proof);
 // La UNIQUE store_id+uki_source impide sobrescribir una clave existente.
 // Un cambio de clave necesitará revisión separada, nunca reemplazo silencioso.
 const rows=await db.query(
  'INSERT INTO public.romo_clave_compartida_v1 (store_id,uki_source,proof,updated_by) '+
  'VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (store_id,uki_source) DO NOTHING RETURNING uki_source',
  [STORE,safe.ukiSource,JSON.stringify(safe),actor.actorId]
 );
 if(!Array.isArray(rows)||rows.length>1)
  throw Error('No se pudo confirmar el verificador de Romo');
 if(rows.length!==1||rows[0].uki_source!==safe.ukiSource){
  const error=new Error('Ya existe la clave compartida de esta sucursal; revisar antes de reemplazar');
  error.code='ROMO_PROOF_EXISTS';
  throw error;
 }
 return Object.freeze({storeId:STORE,ukiSource:safe.ukiSource,
  saved:true,ventasHabilitadas:false});
}
export const ROMO_ENROLAMIENTO_CERRADO_HASTA_AUTORIZAR=true;
