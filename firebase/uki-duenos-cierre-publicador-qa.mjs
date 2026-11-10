/* Uki Sushi · cliente QA para sincronizar cierres definitivos automáticamente.
 * No modifica caja, pedidos, inventario ni ventas manuales. No guarda tokens.
 * Se activa solo al conectarlo explícitamente a la rama de pruebas operativa.
 */
const RAMAS={'Uki Regimiento Arica':'arica','Uki La Serena':'serena'};
const MEDIOS=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const money=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e9;
const goodDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&
 !Number.isNaN(Date.parse(v+'T12:00:00Z'));
export function prepararCierreParaDuenos(cierre){
 const branch=RAMAS[cierre?.suc],fecha=cierre?.fechaOperativa,ms=cierre?.fechaMs;
 const venta=cierre?.venta,pedidos=cierre?.pedidos;
 if(!branch||!goodDay(fecha)||!Number.isSafeInteger(ms)||ms<1700000000000||
  !money(venta)||!Number.isSafeInteger(pedidos)||pedidos<0||pedidos>10000)
  throw Error('Cierre no apto para sincronización financiera');
 const medios={};
 for(const [nombre,monto] of Object.entries(cierre.medios||{})){
  if(!MEDIOS.has(nombre)||!money(monto))throw Error('Medios del cierre inválidos');
  medios[nombre]=monto;
 }
 if(Object.values(medios).reduce((a,b)=>a+b,0)!==venta)
  throw Error('Los pagos no cuadran con el cierre; no se envía');
 return Object.freeze({action:'registrar_cierre',confirmado:true,
  branch,fecha_operativa:fecha,fecha_cierre_ms:ms,
  venta_total:venta,pedidos,medios:Object.freeze(medios)});
}
export async function sincronizarCierreQA(cierre,{endpoint,obtenerToken,fetchImpl=fetch}){
 if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9-]+\.vercel\.app\/api\/uki-duenos-cierres-auto-qa$/i.test(endpoint))
  throw Error('Vista previa QA del puente no configurada');
 if(typeof obtenerToken!=='function')throw Error('Acceso Google no disponible');
 const payload=prepararCierreParaDuenos(cierre);
 const token=await obtenerToken();
 if(typeof token!=='string'||!token)throw Error('Inicia sesión con Google en Uki');
 const response=await fetchImpl(endpoint,{
  method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify(payload)
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.error||'No se sincronizó el cierre');
 return {registrado:result.registrado===true,duplicado:result.duplicado===true,
  referencia:result.referencia};
}
export async function conciliarCierresQA(cierres,config){
 if(!Array.isArray(cierres))throw Error('Historial de cierres inválido');
 const resultado={revisados:0,registrados:0,existentes:0,errores:[]},vistos=new Set();
 for(const c of cierres){
  // No se exportan pedidos individuales ni clientes a través de este puente.
  let key;
  try{
   const p=prepararCierreParaDuenos(c);key=p.branch+'|'+p.fecha_cierre_ms;
  }catch{continue}
  if(vistos.has(key))continue;vistos.add(key);resultado.revisados++;
  try{
   const response=await sincronizarCierreQA(c,config);
   if(response.registrado)resultado.registrados++;
   if(response.duplicado)resultado.existentes++;
  }catch(e){resultado.errores.push({cierre:key,error:String(e?.message||e).slice(0,120)})}
 }
 return resultado;
}
