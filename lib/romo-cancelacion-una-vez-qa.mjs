/**
 * Romo La Serena — intención auditada de cancelación, exclusivamente QA.
 * No modifica snapshot AES-GCM, pedidos, caja ni cierres.
 * La revisión 2 no prueba si el pedido #1 estaba pagado: el servidor
 * no puede leer el contenido del estado cifrado.
 *
 * La intención NO equivale a una cancelación efectiva.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

export const ROMO_CANCELACION_UNICA_QA_ACTIVA_POR_DEFECTO=false;
const STORE='romo:serena';
const PEDIDO=1;
const REVISION=2;

export const _sqlCancelacionUnicaQA=[
 'INSERT INTO public.romo_cancelacion_intencion_qa_v1',
 ' (store_id,pedido_id,revision_observada,categoria,',
 '  motivo_sha256,responsable_sha256,creado_por_uid)',
 'SELECT $1,$2,$3,$4,$5,$6,$7',
 'FROM public.romo_estado_operativo_v1 AS e',
 'WHERE e.store_id=$1 AND e.revision=$3',
 'ON CONFLICT (store_id,pedido_id) DO NOTHING',
 'RETURNING pedido_id,revision_observada'
].join('\n');

const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const fail=msg=>{throw new Error(msg)};
const keys=['categoria','expectedRevision','motivo','pedidoId','responsable'];

export function validarIntentoCancelacionUnicaRomoQA(datos={}){
 if(!datos||typeof datos!=='object'||Array.isArray(datos)||
    Object.keys(datos).sort().join('|')!==keys.join('|'))
  fail('Formulario de intención de cancelación inválido');
 if(datos.pedidoId!==PEDIDO||datos.expectedRevision!==REVISION)
  fail('Pedido y revisión no autorizados para el piloto');
 const categoria=String(datos.categoria||'').trim().toLowerCase();
 const motivo=String(datos.motivo||'').trim();
 const responsable=String(datos.responsable||'').trim();
 if(!['local','cliente'].includes(categoria)||motivo.length<4||motivo.length>300||
    responsable.length<2||responsable.length>80)
  fail('Indica quién canceló, responsable y motivo');
 return Object.freeze({pedidoId:PEDIDO,revision:REVISION,categoria,
   motivoHash:sha(motivo),responsableHash:sha(responsable)});
}

/** INSERT único sin UPDATE de estado cifrado; requiere dueños verificados. */
export async function guardarCancelacionUnicaRomoQA({db,identity,datos}={}){
 const permiso=authorizeRomoOperation(identity,'romo','serena','owners.write');
 if(permiso.role!=='duenos')fail('Solo dueños pueden solicitar el piloto');
 if(!db||typeof db.query!=='function')fail('Base Neon Romo obligatoria');
 const solicitud=validarIntentoCancelacionUnicaRomoQA(datos);
 const rows=await db.query(_sqlCancelacionUnicaQA,[
  STORE,solicitud.pedidoId,solicitud.revision,solicitud.categoria,
  solicitud.motivoHash,solicitud.responsableHash,permiso.actorId
 ]);
 if(!Array.isArray(rows)||rows.length!==1||
    Number(rows[0]?.pedido_id)!==PEDIDO||
    Number(rows[0]?.revision_observada)!==REVISION)
  fail('Solicitud duplicada, revisión modificada o sin confirmación');
 return Object.freeze({
  ok:true,storeId:STORE,pedidoId:PEDIDO,
  registro:'intencion_cancelacion_qa',revisionEstado:REVISION,
  cancelado:false,reconciliacionPendiente:true
 });
}
