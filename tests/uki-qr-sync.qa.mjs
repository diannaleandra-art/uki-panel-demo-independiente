import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {crearSnapshotsUki} from '../firebase/uki-sushi-nube.js';
import {dividirEstado,reunirEstado} from '../firebase/uki-particion-local.js';
import {derivarClave,nuevaSal,nuevaGeneracion,cifrarBloque,descifrarBloque} from '../firebase/uki-cifrado-bloques.js';
import {crearAutoGuardadoOperativo} from '../firebase/uki-sushi-autoguardado.js';

globalThis.crypto=webcrypto;
const SUC_A='Uki Regimiento Arica', SUC_B='Uki La Serena';
const pass='clave-ficticia-QA-sin-datos-reales-2026';
const memory=new Map();
const json=val=>JSON.parse(JSON.stringify(val));
const snap=ref=>({exists:()=>memory.has(ref),data:()=>json(memory.get(ref))});
const api={
 doc(_db,...segments){return segments.join('/');},
 async getDocFromServer(ref){return snap(ref);},
 writeBatch(){const changes=[];return {set(ref,data){changes.push([ref,json(data)])},
  async commit(){for(const [ref,v] of changes)memory.set(ref,v)}};},
 async runTransaction(_db,run){
  const changes=[],tx={get:async ref=>snap(ref),set(ref,data){changes.push([ref,json(data)])}};
  const result=await run(tx);
  for(const [ref,v] of changes)memory.set(ref,v);
  return result;
 }
};
const backend=crearSnapshotsUki({
 db:{inMemory:true}, auth:{currentUser:{uid:'id-de-prueba-no-real'}},api,
 blocks:{dividirEstado,reunirEstado},
 codec:{derivarClave,nuevaSal,nuevaGeneracion,cifrarBloque,descifrarBloque}
});
const state=(suc,pedidos=[],borradores=[],ajustesHistoricos=[])=>({
 suc,nextId:2,nextIncidenciaId:1,fechaOperativa:'2026-11-03',
 pedidos,gastos:[],retiros:[],propinas:[],cierres:[],deliveriesManuales:[],incidencias:[],
 ajustesHistoricos,borradores,
 clientes:{"cliente-prueba":{nombre:'Cliente ficticio',pedidos:0,gastado:0,movimientos:[]}},
 cajasDiarias:{[suc+'|2026-11-03']:{base:18000,pagoDelivery:0,cajaChica:{inicial:20000,gastos:[]},apps:{}}},
 vista:'pedidos',cajaChica:{inicial:20000,gastos:[]}
});
const first={suc:SUC_A,id:1,modalidad:'Consumo en local',mesaReferencia:'Mesa 2',
 fechaISO:'2026-11-03T14:30',registradoEn:Date.now(),cliente:'Cliente ficticio',
 qrSolicitudes:['MESA-SOLICITUD-UNO'],codigoCarta:'MESA-SOLICITUD-UNO',
 productos:[{nombre:'4 korokes',cantidad:1,precioUnit:2500,detalle:'Vegetales: sin cebollín'}],
 subtotal:2500,total:2500,pagado:false,estado:'Pendiente',envio:0};
const pending={suc:SUC_A,id:'b-qa-2',fechaISO:'2026-11-03T14:30',
 datos:{cliente:'Cliente ficticio',modalidad:'Consumo en local',mesaReferencia:'Mesa 3',
 items:[{nombre:'Pizza',cant:1,precio:9000}]},
 modo:'manual',actualizadoEn:Date.now()};
const adjust={suc:SUC_A,id:7,fechaISO:'2026-11-03T13:00',
 motivo:'Corrección de turno ficticia',monto:0};
const initial=state(SUC_A,[first],[pending],[adjust]);
const saved1=await backend.guardar({sucursal:SUC_A,password:pass,revisionEsperada:0,estado:initial});
assert.equal(saved1.revision,1);
const read1=await backend.cargar(SUC_A,pass);
assert.equal(read1.revision,1);
assert.deepEqual(read1.estado,initial,'La primera carga recupera cuenta, borrador y ajuste completos');
assert.equal(read1.estado.pedidos[0].pagado,false);
assert.equal(read1.estado.cierres.length,0);

const secondState=json(initial);
secondState.pedidos[0].productos.push({nombre:'Pizza Margarita',cantidad:1,precioUnit:9000,detalle:'Sin cebolla'});
secondState.pedidos[0].qrSolicitudes.push('MESA-SOLICITUD-DOS');
secondState.pedidos[0].subtotal=11500;secondState.pedidos[0].total=11500;
const saved2=await backend.guardar({sucursal:SUC_A,password:pass,revisionEsperada:1,estado:secondState});
assert.equal(saved2.revision,2);
const read2=await backend.cargar(SUC_A,pass);
assert.deepEqual(read2.estado,secondState,'La segunda ronda se sincroniza y conserva borradores y cierres');
assert.equal(read2.estado.pedidos.length,1,'No se genera una cuenta nueva');
assert.equal(read2.estado.pedidos[0].qrSolicitudes.length,2);
assert.equal(read2.estado.pedidos[0].pagado,false);

await assert.rejects(
 backend.guardar({sucursal:SUC_A,password:pass,revisionEsperada:1,estado:initial}),
 e=>e.code==='CONFLICTO','No se sobrescriben otras revisiones');
await assert.rejects(
 backend.guardar({sucursal:SUC_A,password:'otra-clave-de-prueba-no-real',revisionEsperada:2,estado:initial}),
 e=>e.code==='CLAVE','No se acepta una contraseña distinta');

const other=state(SUC_B);
await backend.guardar({sucursal:SUC_B,password:pass,revisionEsperada:0,estado:other});
assert.deepEqual((await backend.cargar(SUC_B,pass)).estado,other,'Sucursales completamente independientes');
assert.deepEqual((await backend.cargar(SUC_A,pass)).estado,secondState,'La Serena no cambia Regimiento');

let current=json(secondState);
const estados=[];
const auto=crearAutoGuardadoOperativo({
 guardar:({sucursal,revisionEsperada,estado})=>backend.guardar({
  sucursal,revisionEsperada,estado,password:pass
 }),
 getEstado:()=>json(current),avisar:x=>estados.push(x.estado),
 scheduler:()=>42,cancel:()=>{},delay:10
});
auto.activar({suc:SUC_A,rev:2,estadoBase:json(secondState)});
current.pedidos[0].productos.push({nombre:'Bebida ficticia',cantidad:1,precioUnit:1000,detalle:''});
current.pedidos[0].subtotal=12500;current.pedidos[0].total=12500;
auto.cambioLocal();
assert.equal(auto.resumen().estado,'pendiente');
await auto.enviar();
assert.equal(auto.resumen().estado,'sincronizado');
assert.equal(auto.resumen().revision,3);
assert.deepEqual((await backend.cargar(SUC_A,pass)).estado,current);
assert.equal((await backend.cargar(SUC_A,pass)).estado.pedidos[0].pagado,false);
assert.equal(current.propinas.length,0);
assert.equal(current.cierres.length,0);

console.log(JSON.stringify({ok:true,pruebas:[
 'Guardado cifrado inicial con borrador y ajuste histórico',
 'Carga completa del pedido de mesa no pagado',
 'Segunda ronda acumulada sin duplicar la cuenta',
 'Conflicto de revisión rechazado sin sobrescritura',
 'Clave equivocada rechazada',
 'Datos de sucursales completamente separados',
 'Autoguardado de tercera ronda y lectura correcta',
 'Sin venta pagada, propina ni cierre'
],revisiones:3,cuentas:1,totalPendiente:12500,ventasPagadas:0,cajaRealModificada:false,almacenamiento:'memoria aislada, sin Firebase real'},null,2));
