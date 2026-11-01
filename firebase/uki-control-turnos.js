/* Uki Sushi · funciones de consulta para el control de turnos (sin llamadas a Firebase).
   La semana corresponde al día operativo de lunes a domingo, horario local. */
(function(){
"use strict";
const diaISO=(fecha)=>{
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha||""));
 if(!m)return null;
 const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
 return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(m[1])&&d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[3])?d:null;
};
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
function rangoSemana(fecha){
 const d=diaISO(fecha);
 if(!d)return null;
 const numero=(d.getDay()+6)%7;
 d.setDate(d.getDate()-numero);
 const lunes=iso(d);
 d.setDate(d.getDate()+6);
 return {desde:lunes,hasta:iso(d)};
}
function resumenSemana(cierres,sucursal,fecha){
 const rango=rangoSemana(fecha);
 if(!rango)return null;
 const semana=(cierres||[]).filter(c=>{
   if(c.suc!==sucursal)return false;
   const operativa=/^\d{4}-\d{2}-\d{2}$/.test(c.fechaOperativa||"")?
     c.fechaOperativa:String(c.fechaISO||"").slice(0,10);
   return operativa>=rango.desde&&operativa<=rango.hasta;
 });
 const sumar=(prop)=>semana.reduce((t,c)=>t+(Number(c[prop])||0),0);
 const medios={};
 for(const c of semana)for(const [m,v] of Object.entries(c.medios||{}))medios[m]=(medios[m]||0)+(Number(v)||0);
 return {...rango,cierres:semana.length,pedidos:sumar("pedidos"),ventas:sumar("venta"),
  ventasSinDelivery:sumar("ventaSinDelivery"),deliveryCobrado:sumar("envios"),
  gastos:sumar("gastos"),repartidor:sumar("pagadoDelivery"),
  resultado:sumar("final"),efectivo:sumar("efectivo"),
  propinas:sumar("propinas"),medios};
}
function fechaHoraLegible(ms){
 const n=Number(ms);
 if(!Number.isFinite(n)||n<=0)return "";
 return new Date(n).toLocaleString("es-CL",{weekday:"long",day:"2-digit",month:"long",
    year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
}
function pedidosSinPago(pedidos,sucursal,esPeriodo){
 return (pedidos||[]).filter(p=>p.suc===sucursal&&esPeriodo(p)&&
  !p.pagado&&p.estado!=="Cancelado"&&!p.esPremio);
}
function diferencia(esperado,contado){
 if(contado===null||contado===undefined||String(contado).trim()==="")return null;
 const n=Number(contado);if(!Number.isFinite(n)||n<0||!Number.isInteger(n))return null;
 return n-(Number(esperado)||0);
}
window.ukiControlTurnos={rangoSemana,resumenSemana,fechaHoraLegible,pedidosSinPago,diferencia};
})();