/**
 * Apertura y cierre DEFINITIVO Romo: mismas secciones e importes Uki,
 * en una COPIA cifrada exclusiva de Romo; nunca altera Uki.
 * La venta nace del pedido confirmado, no de solicitudes ni delivery manual.
 */
import {consultarCajaRomoQA} from './uki-romo-caja-consulta-qa.mjs';
export const ROMO_CIERRE_DEFINITIVO_HABILITADO_QA=false;
const SUC='Romo’s Sushi La Serena';
const APPS=new Set(['Uber Eats','PedidosYa','Rappi','Otros']);
const CHECK=(b,m)=>{if(!b)throw Error(m)};
const CLONE=x=>JSON.parse(JSON.stringify(x));
const INT=(v,n,min=0)=>{
 const x=Number(v);
 CHECK(v!==undefined&&v!==null&&v!==''&&Number.isSafeInteger(x)&&
  x>=min&&x<=100000000,'Importe inválido: '+n);
 return x;
};
const DIA=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const TXT=(v,n,name)=>{
 const s=String(v??'').trim();
 CHECK(s.length>=2&&s.length<=n,name+' obligatorio');
 return s;
};
const fechaReg=x=>{
 const a=Number(x?.registradoEn);
 if(Number.isSafeInteger(a)&&a>0)return a;
 const b=Date.parse(x?.fechaISO||'');
 return Number.isFinite(b)&&b>0?b:0;
};
const valido=s=>{
 CHECK(s?.suc===SUC&&s.cajasDiarias&&typeof s.cajasDiarias==='object',
  'No es el estado independiente de Romo');
 for(const name of ['pedidos','gastos','retiros','propinas','cierres','deliveriesManuales']){
  CHECK(Array.isArray(s[name])&&s[name].every(x=>x?.suc===SUC),
   'Hay movimientos de otra sucursal en '+name);
 }
};
function cajita(s,d){return s.cajasDiarias[SUC+'|'+d]}
const dentro=(x,inicio,final)=>{const t=fechaReg(x);return t>=inicio&&t<=final};
export function prepararAperturaTurnoRomoQA(estado,{
 fechaOperativa,inicioMs,base=0,responsable
}={}){
 valido(estado);
 CHECK(DIA(fechaOperativa),'Fecha operativa de apertura inválida');
 CHECK(Number.isSafeInteger(inicioMs)&&inicioMs>0,'Momento de apertura inválido');
 const persona=TXT(responsable,80,'Responsable de apertura');
 const montoBase=INT(base,'base del turno');
 CHECK(!Object.entries(estado.cajasDiarias).some(([k,c])=>
  k.startsWith(SUC+'|')&&c?.turnoAbierto===true),'Ya hay un turno Romo abierto');
 const key=SUC+'|'+fechaOperativa,prev=estado.cajasDiarias[key];
 CHECK(!prev?.turnoAbierto,'El turno ya está abierto');
 const desdeMs=Number(prev?.desdeMs)||0;
 CHECK(inicioMs>desdeMs,'La apertura debe ser posterior al cierre anterior');
 const turnoId=fechaOperativa+'@'+inicioMs;
 CHECK(!estado.cierres.some(x=>x.turnoClave===turnoId),'Turno cerrado anteriormente');
 estado.cajasDiarias[key]={
  ...(prev||{}),turnoId,turnoAbierto:true,inicioMs,desdeMs,
  base:montoBase,responsableApertura:persona,apps:{},
  pagoDeliveryDia:0,pagoDeliveryAnterior:0,
  pagoDeliveryMedioDia:'Efectivo',pagoDeliveryMedioAnterior:'Efectivo',
  pagoDeliveryConceptoAnterior:'',pagoDelivery:0,
  cajaChica:{inicial:INT(prev?.cajaChica?.inicial??0,'caja chica'),gastos:[]}
 };
 estado.fechaOperativa=fechaOperativa;
 return Object.freeze({tipo:'apertura',turnoId,fechaOperativa,base:montoBase});
}
export function prepararCierreDefinitivoRomoQA(estado,{
 fechaOperativa,cierreMs,responsable,efectivoContado,observacion='',
 aceptarDiferencia=false,aceptarPendientesSinPago=false
}={}){
 valido(estado);
 CHECK(DIA(fechaOperativa),'Fecha operativa del cierre inválida');
 CHECK(Number.isSafeInteger(cierreMs)&&cierreMs>0,'Momento de cierre inválido');
 const resp=TXT(responsable,80,'Responsable de cierre');
 const obs=String(observacion??'').trim();
 CHECK(obs.length<=700,'Observación demasiado larga');
 const caja=cajita(estado,fechaOperativa);
 CHECK(caja?.turnoAbierto===true&&Number.isSafeInteger(caja.inicioMs),
  'Abre primero un turno Romo confirmado en Neon');
 const inicio=caja.inicioMs,turnoId=fechaOperativa+'@'+inicio;
 CHECK(inicio<cierreMs&&caja.turnoId===turnoId,
  'La identidad del turno no coincide');
 CHECK(!estado.cierres.some(c=>c.turnoClave===turnoId),
  'Este turno ya tiene cierre definitivo; consulta Historial');
 CHECK(!Array.isArray(estado.solicitudesWhatsApp)||
  !estado.solicitudesWhatsApp.some(x=>x.suc===SUC&&x.estado==='pendiente'),
  'Hay solicitudes WhatsApp locales por resolver');
 const corte={...estado};
 for(const k of ['pedidos','gastos','retiros','propinas','deliveriesManuales']){
  corte[k]=estado[k].filter(x=>dentro(x,inicio,cierreMs))
   .map(x=>({...x,fechaOperativa}));
 }
 const t=consultarCajaRomoQA(corte,{fechaOperativa});
 CHECK(t.pendientes===0||aceptarPendientesSinPago===true,
  'Hay pedidos sin pagar: confirma expresamente antes de cerrar');
 const medios={...t.medios};
 for(const [name,valor] of Object.entries(caja.apps||{})){
  CHECK(APPS.has(name),'Medio manual no permitido');
  medios[name]=(medios[name]||0)+INT(valor,'cobro de app '+name);
 }
 const totalMedios=Object.values(medios).reduce((a,b)=>a+b,0);
 const sum=(rows)=>rows.reduce((a,x)=>a+INT(x.monto,'movimiento'),0);
 const gastos=sum(corte.gastos),gastosEf=sum(corte.gastos.filter(x=>x.medio==='Efectivo'));
 const retiros=sum(corte.retiros);
 const propinas=sum(corte.propinas);
 const pagoDeliveryDia=INT(caja.pagoDeliveryDia??caja.pagoDelivery??0,'pago repartidor del día');
 const pagoDeliveryAnterior=INT(caja.pagoDeliveryAnterior??0,'pago reparto anterior');
 CHECK(pagoDeliveryDia<=t.deliveryParaRepartidor+t.entregasManualesAConciliar,
  'Pago al repartidor supera las entregas de este turno');
 const medioDia=String(caja.pagoDeliveryMedioDia||caja.pagoDeliveryMedio||'Efectivo');
 const medioAnterior=String(caja.pagoDeliveryMedioAnterior||'Efectivo');
 const permitidos=['Efectivo','Transferencia','Débito','Edenred','Otros'];
 CHECK(permitidos.includes(medioDia)&&permitidos.includes(medioAnterior),
  'Medio de pago del repartidor no permitido');
 const pagoDelivery=pagoDeliveryDia+pagoDeliveryAnterior;
 const pagoEfectivo=(medioDia==='Efectivo'?pagoDeliveryDia:0)+
  (medioAnterior==='Efectivo'?pagoDeliveryAnterior:0);
 const efectivoEsperado=medios.Efectivo-gastosEf-retiros-pagoEfectivo;
 const contado=INT(efectivoContado,'efectivo contado');
 const diferencia=contado-efectivoEsperado;
 CHECK(diferencia===0||aceptarDiferencia===true,
  'Existe diferencia de efectivo; confirma y deja su explicación');
 CHECK(diferencia===0||obs.length>=3,
  'Si hay diferencia, indica su motivo en Observaciones');
 const chica=caja.cajaChica||{inicial:0,gastos:[]};
 CHECK(Array.isArray(chica.gastos),'Caja chica debe tener desglose');
 const gastosChica=chica.gastos.map(g=>({
  id:g.id??null,concepto:String(g.concepto||'').slice(0,180),
  monto:INT(g.monto,'gasto caja chica')
 }));
 const totalCajaChica=gastosChica.reduce((sum,g)=>sum+g.monto,0);
 const abonos=(caja.pagosRepartidor||[]).map(x=>({
  id:x.id,medio:String(x.medio||''),monto:INT(x.monto,'pago al repartidor'),
  tipoSaldo:String(x.tipoSaldo||''),concepto:String(x.concepto||'').slice(0,180)
 }));
 const detalle={
  turnoId,fechaOperativa,desdeMs:inicio,hastaMs:cierreMs,
  pagosRepartidor:abonos,
  cajaChica:{inicial:INT(chica.inicial??0,'caja chica inicial'),
   gastos:gastosChica,totalGastos:totalCajaChica},
  pedidos:corte.pedidos.map(x=>({id:x.id,cliente:x.cliente||'',total:x.total,
   pagado:!!x.pagado,envio:x.envio||0,medio:x.medio||'',estado:x.estado||''})),
  gastos:corte.gastos.map(x=>({...x})),retiros:corte.retiros.map(x=>({...x})),
  propinas:corte.propinas.map(x=>({...x})),
  deliveriesManuales:corte.deliveriesManuales.map(x=>({...x})),
  pagoRepartidor:{dia:pagoDeliveryDia,anterior:pagoDeliveryAnterior,
   medioDia,medioAnterior}
 };
 const cierre={
  suc:SUC,turnoClave:turnoId,inicioTurnoMs:inicio,
  fechaOperativa,fecha:new Date(cierreMs).toLocaleString('es-CL',{timeZone:'America/Santiago',
   dateStyle:'short',timeStyle:'short'}),
  fechaISO:new Date(cierreMs).toISOString(),fechaMs:cierreMs,
  resp,obs,detalle,efectivoContado:contado,diferenciaEfectivo:diferencia,
  pendientesAlCerrar:t.pendientes,correccionesPendientesAlCerrar:0,
  saldoDiferenciasPendientesAlCerrar:0,
  ventaCorregida:totalMedios,venta:totalMedios,
  ventaSinDelivery:totalMedios-t.deliveryCobradoRomo,
  gastos,delivery:pagoDelivery,final:totalMedios-gastos-pagoDelivery,
  efectivo:efectivoEsperado,propinas,
  pedidos:t.pedidosRegistrados-t.pedidosCancelados,
  efectivoCobrado:medios.Efectivo,gastosEf,retiros,
  pagadoDelivery:pagoDelivery,pagoDeliveryDia,pagoDeliveryAnterior,
  pagoDeliveryMedioDia:medioDia,pagoDeliveryMedioAnterior:medioAnterior,
  pagoDeliveryMedio:medioDia,
  pagoDeliveryConceptoAnterior:String(caja.pagoDeliveryConceptoAnterior||'').slice(0,180),
  medios,base:INT(caja.base??0,'base'),
  cajaChicaInicial:INT(chica.inicial??0,'caja chica inicial'),
  cajaChicaGastos:totalCajaChica,
  envios:t.deliveryParaRepartidor+t.entregasManualesAConciliar,
  enviosPedidos:t.deliveryParaRepartidor,
  enviosManuales:t.entregasManualesAConciliar,
  enviosCobradosUki:t.deliveryCobradoRomo, // Campo heredado: corresponde a Romo.
  enviosCobradosOtroLocal:t.deliveryCobradoOtroLocal,
  productosCobradosOtroLocal:t.productosCobradosOtroLocal
 };
 estado.cierres.push(cierre);
 // Los datos históricos permanecen; el siguiente turno tendrá otra apertura.
 caja.turnoAbierto=false;caja.desdeMs=cierreMs;
 caja.ultimoCierreTurnoId=turnoId;delete caja.inicioMs;delete caja.turnoId;
 caja.apps={};caja.pagoDeliveryDia=0;caja.pagoDeliveryAnterior=0;
 caja.pagoDelivery=0;caja.pagoDeliveryMedioDia='Efectivo';
 caja.pagoDeliveryMedioAnterior='Efectivo';
 caja.pagoDeliveryConceptoAnterior='';
 caja.cajaChica={inicial:caja.cajaChica?.inicial??0,gastos:[]};
 caja.pagosRepartidor=[];
 delete caja.repartidorNombre;
 return Object.freeze({tipo:'cierre',turnoId,cierre,
  totalMedios,efectivoEsperado,efectivoContado:contado,diferencia,
  pendientes:t.pendientes});
}
