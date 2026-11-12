'use strict';
/**
 * Control de PIN exclusivo para inventario de Romo La Serena.
 * No se importa en NINGÚN endpoint. Código preparado y probado solamente.
 * Mismo formato que Uki (6 cifras), pero código, tablas y permisos separados.
 */
const {createHmac}=require('node:crypto');
const pin=require('./romo-pin-inventario-qa.cjs');
const STORE_ID='romo:serena';
const QA_BRANCH='qa/romo-catalogo-inventario-sin-publicar-20261111';
const habilitado=(env=process.env)=>
 env.VERCEL_ENV==='preview' &&
 env.VERCEL_GIT_COMMIT_REF===QA_BRANCH &&
 env.ROMO_CATALOGO_QA_ENABLED==='true' &&
 env.ROMO_PIN_TRABAJADOR_QA_ENABLED==='true';
function claveGlobal(env){
 const secret=String(env.ROMO_PIN_CONTROL_HMAC_KEY||'');
 if(secret.length<32||secret.length>1024)throw Error('Secreto privado de Romo no configurado');
 return createHmac('sha256',secret).update(STORE_ID+':inventario:control-global:v1').digest('hex');
}
/**
 * Un único contador GLOBAL por local evita que una persona pueda saltarse
 * el límite creando un identificador nuevo en el navegador. Se aceptan
 * como máximo 4 intentos por ventana; el quinto bloquea 15 minutos.
 * Esta política puede provocar bloqueos legítimos y debe revisarse antes
 * de habilitar accesos reales.
 */
async function verificarCodigoInventarioRomoQA({db,code,workerName,env={}}={}){
 if(!habilitado(env))throw Error('Ingreso de trabajador de Romo desactivado');
 if(!db||typeof db.query!=='function')throw Error('Base privada de Romo requerida');
 if(!pin.valido(code)||!pin.nombreValido(workerName))return null;
 const hash=claveGlobal(env);
 const statement=[
  'INSERT INTO public.romo_pin_intentos_v1 AS intentos',
  '(store_id,identidad_hash,fallos,bloqueado_hasta,actualizado_en)',
  'VALUES($1,$2,1,NULL,NOW())',
  'ON CONFLICT (store_id,identidad_hash) DO UPDATE SET',
  "fallos=CASE WHEN intentos.actualizado_en<NOW()-INTERVAL '15 minutes'",
  'THEN 1 ELSE LEAST(intentos.fallos+1,5) END,',
  "bloqueado_hasta=CASE WHEN intentos.actualizado_en<NOW()-INTERVAL '15 minutes'",
  "THEN NULL WHEN intentos.fallos+1>=5 THEN NOW()+INTERVAL '15 minutes'",
  'ELSE NULL END,',
  'actualizado_en=NOW()',
  'WHERE intentos.bloqueado_hasta IS NULL OR intentos.bloqueado_hasta<=NOW()',
  'RETURNING fallos,bloqueado_hasta'
 ].join(' ');
 const attempts=await db.query(statement,[STORE_ID,hash]);
 if(!Array.isArray(attempts)||attempts.length!==1||Number(attempts[0].fallos)>=5||
    attempts[0].bloqueado_hasta!==null)return null;
 const rows=await db.query(
  'SELECT store_id,salt,hash FROM public.romo_pin_inventario_v1 WHERE store_id=$1 LIMIT 1',
  [STORE_ID]
 );
 if(!Array.isArray(rows)||rows.length!==1||!pin.comprobarCodigo(code,rows[0]))return null;
 const cleared=await db.query(
  'DELETE FROM public.romo_pin_intentos_v1 WHERE store_id=$1 AND identidad_hash=$2 RETURNING store_id',
  [STORE_ID,hash]
 );
 if(!Array.isArray(cleared)||cleared.length!==1)throw Error('Control de reintentos de Romo no confirmado');
 // Este resultado de memoria NO es una sesión ni un token de trabajador.
 // Ningún endpoint ofrece acceso por esta función antes de nueva autorización.
 return Object.freeze({
  storeId:STORE_ID,workerName:workerName.trim().replace(/\s+/g,' '),
  role:'inventario',scope:'solo-inventario-romo',
  canReadInventory:true,canWriteInventory:true
 });
}
module.exports={habilitado,verificarCodigoInventarioRomoQA};
