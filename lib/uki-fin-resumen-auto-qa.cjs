'use strict';
// Cifras agregadas por TURNO de Uki. No contienen datos personales ni crean ventas contables.
const {createHash}=require('node:crypto');
const branches=new Set(['arica','serena']);
const statuses=new Set(['abierto','cerrado']);
const methods=new Set(['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi']);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function normalize(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const branch=String(input.branch||''),turno=String(input.turno_ref||''),estado=String(input.estado||'');
 if(!branches.has(branch)||!statuses.has(estado)||!validDate(input.fecha_operativa)||
  !/^[a-zA-Z0-9._|@:-]{3,120}$/.test(turno)||
  !turno.toLowerCase().includes(branch)||!integer(input.revision,1,9007199254740991)||
  !integer(input.venta_total,0,1000000000)||!integer(input.pedidos,0,10000))return null;
 const raw=input.medios;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const medios={};
 for(const [key,value]of Object.entries(raw)){
  if(!methods.has(key)||!integer(value,0,1000000000))return null;
  if(value>0)medios[key]=value;
 }
 if(Object.values(medios).reduce((total,x)=>total+x,0)!==input.venta_total)return null;
 const source_key=createHash('sha256').update('uki-turno-v1|'+branch+'|'+turno).digest('hex');
 return {branch,source_key,turno_ref:turno,fecha_operativa:input.fecha_operativa,
  estado,revision:input.revision,venta_total:input.venta_total,pedidos:input.pedidos,medios};
}
function sameSnapshot(a,b){
 return !!a&&!!b&&a.branch===b.branch&&a.source_key===b.source_key&&
  a.fecha_operativa===b.fecha_operativa&&a.estado===b.estado&&
  Number(a.revision)===Number(b.revision)&&Number(a.venta_total)===Number(b.venta_total)&&
  Number(a.pedidos)===Number(b.pedidos)&&
  JSON.stringify(Object.entries(a.medios||{}).sort())===JSON.stringify(Object.entries(b.medios||{}).sort());
}
function chooseUpdate(current,next){
 if(!current)return 'nuevo';
 if(current.source_key!==next.source_key||current.branch!==next.branch||
   current.turno_ref!==next.turno_ref||current.fecha_operativa!==next.fecha_operativa)
  return 'conflicto';
 if(sameSnapshot(current,next))return 'ya_registrado';
 if(current.estado==='cerrado')return 'cierre_bloqueado'; // no sobreescribir cierre confirmado
 if(next.revision<=Number(current.revision))return 'obsoleto'; // no retroceder ni recontar
 return 'actualizar';
}
function aggregate(rows){
 const summary={arica:{abierto:0,cerrado:0,pedidos:0,turnos:0},
  serena:{abierto:0,cerrado:0,pedidos:0,turnos:0}};
 for(const r of rows||[]){
  if(!summary[r.branch]||!statuses.has(r.estado))continue;
  const total=Number(r.venta_total),qty=Number(r.pedidos);
  if(!integer(total,0,1000000000)||!integer(qty,0,10000))continue;
  summary[r.branch][r.estado]+=total;
  summary[r.branch].pedidos+=qty;
  summary[r.branch].turnos++;
 }
 return summary;
}
module.exports={validDate,normalize,sameSnapshot,chooseUpdate,aggregate};
