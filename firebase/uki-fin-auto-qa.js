/* Uki Sushi · futura transferencia automática QA.
   Se instala inerte: habilitar solo cuando el endpoint QA privado,
   la autorización Google y la conciliación estén verificados.
   No altera pedidos, caja, cierres, inventario, ni el panel de producción. */
(function(){
'use strict';
// Cambio de una sola variable de configuración en el release QA verificado.
// NUNCA colocar una URL de producción o una base sin aislamiento.
const QA_ENDPOINT=''; // Vacío = no enviar datos. Pendiente del deploy QA.
const BRANCHES=new Set(['arica','serena']);
const SAFE_METHODS=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
let last={key:'',amount:-1,pedidos:-1,close:false,at:0},inFlight=false;
function valido(r){
 if(!r||!BRANCHES.has(r.branch)||
  !/^(arica|serena)\|\d{4}-\d{2}-\d{2}\|\d{13}$/.test(r.turno_ref)||
  !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_operativa)||
  !['abierto','cerrado'].includes(r.estado)||
  !Number.isSafeInteger(r.venta_total)||r.venta_total<0||
  !Number.isSafeInteger(r.pedidos)||r.pedidos<0||
  !r.medios||typeof r.medios!=='object'||Array.isArray(r.medios))return false;
 const values=Object.entries(r.medios);
 return values.every(([k,n])=>SAFE_METHODS.has(k)&&Number.isSafeInteger(n)&&n>=0)&&
  values.reduce((sum,[,n])=>sum+n,0)===r.venta_total;
}
async function enviar(snapshot){
 if(!QA_ENDPOINT||!QA_ENDPOINT.startsWith('https://')||
   !QA_ENDPOINT.endsWith('/api/mi-administracion-qa')||
   location.hostname!=='diannaleandra-art.github.io'||inFlight||!valido(snapshot))return false;
 // PIN de dueños no se transmite ni almacena. El servidor QA verifica Google.
 const token=await window.ukiInventarioToken?.();
 if(!token)return false;
 const key=snapshot.branch+'|'+snapshot.turno_ref;
 const newClose=snapshot.estado==='cerrado';
 if(last.key===key&&last.amount===snapshot.venta_total&&last.pedidos===snapshot.pedidos&&
   last.close===newClose&&Date.now()-last.at<30000)return false;
 inFlight=true;
 try{
  const response=await fetch(QA_ENDPOINT,{method:'POST',mode:'cors',cache:'no-store',
   credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({action:'recibir_uki_auto',resumen:snapshot})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw Error('No se pudo confirmar el resumen en QA.');
  last={key,amount:snapshot.venta_total,pedidos:snapshot.pedidos,close:newClose,at:Date.now()};
  return true;
 }catch(e){console.warn('Uki Finanzas QA: transferencia pendiente, nunca altera la caja.');return false;}
 finally{inFlight=false}
}
window.ukiFinAutoQAActualizar=async()=>{
 const snapshot=window.ukiVentasAutoResumenActual?.();
 return snapshot?enviar(snapshot):false;
};
window.ukiFinAutoQAEnviarCierre=async(cierre)=>{
 const snapshot=window.ukiVentasAutoResumenCierre?.(cierre);
 return snapshot?enviar(snapshot):false;
};
window.ukiFinAutoQAEstado=()=>({configurado:!!QA_ENDPOINT,modo:'QA_NO_CONTABILIZADO'});
})();
