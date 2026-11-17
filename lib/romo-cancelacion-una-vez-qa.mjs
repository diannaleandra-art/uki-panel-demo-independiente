/**
 * ROMO La Serena: única escritura CAS de prueba, NO activa.
 * Un commit puede aceptar UN sobre cifrado por pedido/revisión y auditarlo
 * en la misma sentencia. El servidor no puede inspeccionar AES-GCM:
 * NO AFIRMAR que puede demostrar que sólo cambió una cancelación.
 *
 * La habilitación exige revisión por dueños, permiso explícito de Preview,
 * tabla de auditoría instalada y prueba manual. Nunca tocar Uki.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {validarSobreCifradoRomoQA} from './romo-estado-cifrado-persistencia-qa.mjs';

export const ROMO_CANCELACION_UNICA_QA_ACTIVA_POR_DEFECTO=false;
const STORE='romo:serena';
const PILOTO=Object.freeze({
 pedidoId:1,expectedRevision:2,
 turnoRef:'2026-11-14@1794676606187'
});

const SQL=`
WITH guardado AS (
 UPDATE public.romo_estado_operativo_v1 AS e
 SET revision=e.revision+1,snapshot=$4::jsonb,
     actualizado_por=$5,actualizado_en=NOW()
 WHERE e.store_id=$1 AND e.revision=$2
   AND NOT EXISTS (
    SELECT 1 FROM public.romo_cancelacion_pedido_qa_v1 AS a
    WHERE a.store_id=$1 AND a.pedido_id=$3
   )
 RETURNING e.revision
),
auditoria AS (
 INSERT INTO public.romo_cancelacion_pedido_qa_v1
  (store_id,pedido_id,turno_ref,revision_anterior,revision_neon,
   snapshot_sha256,creado_por_uid,motivo_sha256)
 SELECT $1,$3,$6,$2,g.revision,$7,$5,$8
 FROM guardado AS g
 RETURNING revision_neon
)
SELECT revision_neon FROM auditoria
`.trim();

const SHA=/^[a-f0-9]{64}$/;
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const requiredKeys=['expectedRevision','motivo','pedidoId','responsable','snapshot','turnoRef'];
const error=message=>{throw Error(message)};

export function validarIntentoCancelacionUnicaRomoQA(datos={}){
 if(!datos||typeof datos!=='object'||Array.isArray(datos)||
    Object.keys(datos).sort().join('|')!==requiredKeys.join('|'))
  error('Formulario exclusivo de cancelación inválido');
 if(datos.pedidoId!==PILOTO.pedidoId||
    datos.expectedRevision!==PILOTO.expectedRevision||
    datos.turnoRef!==PILOTO.turnoRef)
  error('No corresponde al único pedido/revisión autorizado para piloto');
 const motivo=String(datos.motivo||'').trim();
 const responsable=String(datos.responsable||'').trim();
 if(motivo.length<4||motivo.length>300||
    responsable.length<2||responsable.length>80)
  error('Indica responsable y motivo válidos');
 const encoded=validarSobreCifradoRomoQA(datos.snapshot);
 const sha=hash(encoded);
 if(!SHA.test(sha))error('Huella del estado cifrado inválida');
 return Object.freeze({pedidoId:1,expectedRevision:2,
  turnoRef:PILOTO.turnoRef,encoded,sha,
  motivoHash:hash(motivo)});
}

/**
 * Una escritura, una revisión y una constancia, sin escribir otro almacén.
 * No ejecutarlo sin tabla/auditoría en la base de destino y flag aprobada.
 */
export async function guardarCancelacionUnicaRomoQA({db,identity,datos}={}){
 const permiso=authorizeRomoOperation(identity,'romo','serena','owners.write');
 if(permiso.role!=='duenos')
  error('Sólo dueños pueden autorizar el piloto');
 if(!db||typeof db.query!=='function')
  error('Base Neon aislada obligatoria');
 const p=validarIntentoCancelacionUnicaRomoQA(datos);
 const rows=await db.query(SQL,[STORE,p.expectedRevision,p.pedidoId,
   p.encoded,permiso.actorId,p.turnoRef,p.sha,p.motivoHash]);
 if(!Array.isArray(rows)||rows.length!==1||
    Number(rows[0]?.revision_neon)!==p.expectedRevision+1)
  error('No se confirmó una única revisión; reabrir e inspeccionar antes de repetir');
 return Object.freeze({ok:true,storeId:STORE,revision:p.expectedRevision+1,
  pedidoId:p.pedidoId,registrado:true});
}

export const _sqlCancelacionUnicaQA=SQL;
