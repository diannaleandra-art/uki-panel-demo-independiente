/* Agenda mensual compartida: no guarda claves ni modifica la operación. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.UkiAgendaArchivo=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 function pendientes({hoy,sucursal,archivos,periodo}){
  if(!['uki:arica','uki:serena','romo:serena'].includes(sucursal)||!Array.isArray(archivos)||
    typeof periodo!=='function'||!/^\d{4}-\d{2}-\d{2}$/.test(hoy))throw Error('Agenda de respaldo no verificada');
  const fecha=new Date(hoy+'T12:00:00Z');
  if(!Number.isFinite(fecha.getTime())||fecha.toISOString().slice(0,10)!==hoy)throw Error('Fecha de agenda inválida');
  const confirmados=new Set(archivos.filter(a=>a?.sucursal===sucursal&&/^[a-f0-9]{64}$/.test(a.sha256||'')).map(a=>a.mes));
  const meses=[];
  for(let f=new Date(Date.UTC(2026,10,1));f<fecha;f.setUTCMonth(f.getUTCMonth()+1)){
   const m=f.toISOString().slice(0,7);
   if(periodo(m).desdeDia5>hoy)break;
   if(!confirmados.has(m))meses.push(m);
  }
  return meses;
 }
 return Object.freeze({pendientes});
});
