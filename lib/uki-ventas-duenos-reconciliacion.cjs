'use strict';
// Capa pura para conciliar las ventas que llegarán del panel Uki al panel privado.
// No escribe Neon, Firestore ni el historial. Nunca incluye datos personales.
const BRANCHES=new Set(['arica','serena']);
const MODES=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const date=/^\d{4}-\d{2}-\d{2}$/;
const safe=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
function normalizeTurno(row){
 if(!row||typeof row!=='object'||!BRANCHES.has(row.sucursal)||
   typeof row.turno_id!=='string'||row.turno_id.length<3||row.turno_id.length>120||
   !date.test(row.fecha_operativa)||Number.isNaN(Date.parse(row.fecha_operativa+'T12:00:00Z'))||
   !['abierto','cerrado'].includes(row.estado)||!safe(row.venta_total)||!safe(row.pedidos)||
   !Number.isSafeInteger(row.revision)||row.revision<1)return null;
 const raw=row.medios;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const medios={};
 for(const [name,amount]of Object.entries(raw)){
  if(!MODES.has(name)||!safe(amount))return null;
  if(amount)medios[name]=amount;
 }
 if(Object.values(medios).reduce((a,b)=>a+b,0)!==row.venta_total)return null;
 return {sucursal:row.sucursal,turno_id:row.turno_id,fecha_operativa:row.fecha_operativa,
  estado:row.estado,revision:row.revision,venta_total:row.venta_total,
  pedidos:row.pedidos,medios};
}
function deduplicateTurnos(rows){
 const map=new Map();
 for(const raw of rows||[]){
  const row=normalizeTurno(raw);if(!row)continue;
  const key=row.sucursal+'|'+row.turno_id;
  const prev=map.get(key);
  // Un cierre confirmado nunca retrocede al estado abierto por una copia obsoleta.
  if(!prev||((row.estado==='cerrado'&&!['cerrado'].includes(prev.estado))||
    (row.estado===prev.estado&&row.revision>prev.revision)))
    map.set(key,row);
 }
 return [...map.values()].sort((a,b)=>a.fecha_operativa.localeCompare(b.fecha_operativa)||
  a.sucursal.localeCompare(b.sucursal));
}
function manualMayDuplicate(manual,turno){
 if(!manual||manual.tipo!=='venta'||manual.estado==='anulado')return false;
 const b=String(manual.sucursal_codigo||manual.sucursal||'').toLowerCase();
 const dateKey=String(manual.fecha||'');
 if(b!==turno.sucursal||dateKey!==turno.fecha_operativa)return false;
 const ref=String(manual.referencia||'').toLowerCase();
 const folio=turno.turno_id.toLowerCase();
 // Un cierre con referencia al mismo turno: misma venta, no volver a sumarla.
 return !!ref&&(ref===folio||ref.includes(folio));
}
function reconcile({automaticas=[],manuales=[]}={}){
 const autos=deduplicateTurnos(automaticas);
 const conflicts=[];
 const freeManual=[];
 for(const manual of manuales){
  const matches=autos.filter(a=>manualMayDuplicate(manual,a));
  if(matches.length){conflicts.push({manual,automaticas:matches.map(a=>({sucursal:a.sucursal,turno_id:a.turno_id}))});continue}
  freeManual.push(manual);
 }
 // Manifiesta los posibles conflictos: jamás borrarlos, sumarlos dos veces o resolverlos de manera silenciosa.
 const totalAuto=autos.reduce((a,r)=>a+r.venta_total,0);
 return {automaticas:autos,manuales:freeManual,posiblesDuplicados:conflicts,
  totalAuto,totalManual:freeManual.filter(m=>m?.tipo==='venta'&&m?.estado!=='anulado')
   .reduce((a,m)=>a+(safe(m.monto)?m.monto:0),0)};
}
module.exports={normalizeTurno,deduplicateTurnos,manualMayDuplicate,reconcile};
