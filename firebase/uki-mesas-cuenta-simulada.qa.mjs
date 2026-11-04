/**
 * UIKit QR — estado transitorio de cuentas por mesa, SOLO simulación QA.
 * No usa Firestore, IndexedDB, localStorage, APIs de escritura ni pago.
 * El objetivo es probar suma de rondas e idempotencia antes de enlazar caja.
 */
const sucursales=new Set(['arica','serena']);
const clonar=x=>JSON.parse(JSON.stringify(x));
const esEntero=x=>Number.isSafeInteger(x);
export const crearEstadoMesaQA=()=>({cuentas:[],qrIds:[]});
function normalizarSolicitud(x){
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Solicitud no válida.');
 const branch=String(x.branch||'');
 const mesa=Number(x.mesa);
 const id=String(x.id||'').trim();
 if(!sucursales.has(branch)||!esEntero(mesa)||mesa<1||mesa>100||
  !/^[a-zA-Z0-9_-]{6,100}$/.test(id))throw Error('Solicitud sin sucursal, mesa o identificación válida.');
 const items=x.items;
 if(!Array.isArray(items)||!items.length||items.length>100)
  throw Error('La solicitud no contiene productos válidos.');
 let total=0;
 const lineas=items.map(p=>{
  const nombre=String(p?.mesaLabel||'').trim();
  const qty=Number(p?.qty);
  const precio=Number(p?.mesaPrecio);
  if(!nombre||nombre.length>140||!esEntero(qty)||qty<1||qty>100||
   !esEntero(precio)||precio<1||precio>1000000)
   throw Error('Producto o precio inválido.');
  const importe=qty*precio;
  if(!esEntero(importe))throw Error('Importe fuera de rango.');
  total+=importe;
  return {nombre,qty,precio,importe};
 });
 if(!esEntero(total)||total!==Number(x.total))
  throw Error('El total QR no coincide con las líneas.');
 return {branch,mesa,id,nombre:String(x.nombre||'Cliente').slice(0,80),items:lineas,total};
}
export function incorporarRondaMesaQA(estado,solicitud){
 const dato=normalizarSolicitud(solicitud);
 if(!estado||!Array.isArray(estado.cuentas)||!Array.isArray(estado.qrIds))
  throw Error('Estado de prueba inválido.');
 const siguiente=clonar(estado);
 const llave=dato.branch+':'+dato.id;
 if(siguiente.qrIds.includes(llave))
  return {estado:siguiente,duplicada:true,cuenta:null};
 const key=dato.branch+':'+dato.mesa;
 let cuenta=siguiente.cuentas.find(c=>c.key===key&&c.pagado===false);
 if(!cuenta){
  cuenta={key,branch:dato.branch,mesa:dato.mesa,
   cliente:dato.nombre,modalidad:'Consumo en local',pagado:false,
   total:0,items:[],rondas:[],propina:0,estado:'Pendiente de pago · simulación'};
  siguiente.cuentas.push(cuenta);
 }
 if(cuenta.pagado||cuenta.modalidad!=='Consumo en local')
  throw Error('No se puede agregar una ronda a una cuenta cerrada.');
 cuenta.items.push(...dato.items);
 cuenta.total+=dato.total;
 if(!esEntero(cuenta.total))throw Error('Total de cuenta inválido.');
 cuenta.rondas.push({id:dato.id,total:dato.total});
 siguiente.qrIds.push(llave);
 return {estado:siguiente,duplicada:false,cuenta:clonar(cuenta)};
}
export function cuentasSucursalMesaQA(estado,branch){
 if(!sucursales.has(branch))throw Error('Sucursal inválida.');
 return clonar((estado?.cuentas||[]).filter(c=>c.branch===branch));
}
