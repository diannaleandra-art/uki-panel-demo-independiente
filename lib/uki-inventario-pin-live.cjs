'use strict';
// QA: un código diferente al del agendador; no autoriza caja ni pedidos.
const {randomBytes,pbkdf2Sync,timingSafeEqual}=require('node:crypto');
const re=/^[0-9]{6}$/;
const valido=x=>typeof x==='string'&&re.test(x);
function crear(pin){
 if(!valido(pin))throw Object.assign(Error('El código de inventario debe tener 6 números'),{status:400});
 const salt=randomBytes(16);
 return {salt:salt.toString('hex'),hash:pbkdf2Sync(pin,salt,210000,32,'sha256').toString('hex')};
}
function comprobar(pin,item){
 if(!valido(pin)||!item||!/^[a-f0-9]{32}$/i.test(item.salt||'')||
    !/^[a-f0-9]{64}$/i.test(item.hash||''))return false;
 return timingSafeEqual(pbkdf2Sync(pin,Buffer.from(item.salt,'hex'),210000,32,'sha256'),
  Buffer.from(item.hash,'hex'));
}
const habilitado=(env=process.env)=>env.VERCEL_ENV==='production'&&
 env.UKI_INVENTARIO_LIVE_ENABLED==='true';
async function consultar(sql){
 const rows=await sql.query('SELECT salt,hash FROM public.uki_inventario_pin_live WHERE id=1 LIMIT 1');
 return rows[0]||null;
}
async function autorizar(sql,pin,branch,identity){
 if(!['arica','serena'].includes(branch)||typeof identity!=='string'||identity.length>200||!identity)
  return false;
 if(!valido(pin))return false;
 // Un único registro de intentos por dispositivo y sucursal, con bloqueo temporal.
 const allowed=await sql.query(`INSERT INTO public.uki_inventario_pin_intentos_live
  (branch,identity,fallos,bloqueado_hasta,updated_at)
  VALUES($1,$2,1,NULL,NOW())
  ON CONFLICT(branch,identity) DO UPDATE SET
   fallos=CASE WHEN uki_inventario_pin_intentos_live.updated_at<NOW()-INTERVAL '15 minutes'
    THEN 1 ELSE LEAST(uki_inventario_pin_intentos_live.fallos+1,5) END,
   bloqueado_hasta=CASE
    WHEN uki_inventario_pin_intentos_live.updated_at<NOW()-INTERVAL '15 minutes' THEN NULL
    WHEN uki_inventario_pin_intentos_live.fallos+1>=5 THEN NOW()+INTERVAL '15 minutes'
    ELSE NULL END,updated_at=NOW()
  WHERE uki_inventario_pin_intentos_live.bloqueado_hasta IS NULL
     OR uki_inventario_pin_intentos_live.bloqueado_hasta<=NOW()
  RETURNING fallos,bloqueado_hasta`,[branch,identity]);
 if(!allowed.length)return false;
 if(!comprobar(pin,await consultar(sql)))return false;
 await sql.query('DELETE FROM public.uki_inventario_pin_intentos_live WHERE branch=$1 AND identity=$2',[branch,identity]);
 return true;
}
module.exports={valido,crear,comprobar,consultar,autorizar,habilitado};
