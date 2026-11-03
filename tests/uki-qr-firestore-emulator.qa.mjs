import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {crearSnapshotsUki} from '../firebase/uki-sushi-nube.js';
import {dividirEstado,reunirEstado} from '../firebase/uki-particion-local.js';
import {derivarClave,nuevaSal,nuevaGeneracion,cifrarBloque,descifrarBloque} from '../firebase/uki-cifrado-bloques.js';

const PROJECT='demo-uki-mesas-qa-aislado';
assert.match(PROJECT,/^demo-/);
const A='Uki Regimiento Arica', B='Uki La Serena';
const clave='clave-qa-ficticia-no-reutilizable-2026';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clone=x=>JSON.parse(JSON.stringify(x));
const env=await initializeTestEnvironment({
 projectId:PROJECT,
 firestore:{
  host:'127.0.0.1',port:8080,
  rules:readFileSync(new URL('./uki-firestore-emulator.rules',import.meta.url),'utf8')
 }
});
const ctx1=env.authenticatedContext('qa-uki-administrador');
const ctx2=env.authenticatedContext('qa-uki-administrador');
const db=ctx1.firestore(),db2=ctx2.firestore();
const ui={uid:'qa-uki-administrador'};
const api={
 doc:(firestore,...paths)=>firestore.doc(paths.join('/')),
 getDocFromServer:ref=>ref.get({source:'server'}),
 writeBatch:firestore=>firestore.batch(),
 runTransaction:(firestore,fn)=>firestore.runTransaction(fn)
};
const makeCloud=firestore=>crearSnapshotsUki({
 db:firestore,auth:{currentUser:ui},api,
 blocks:{dividirEstado,reunirEstado},
 codec:{derivarClave,nuevaSal,nuevaGeneracion,cifrarBloque,descifrarBloque}
});
const client1=makeCloud(db),client2=makeCloud(db2);
const estado=(suc,pedidos=[],borradores=[],ajustesHistoricos=[])=>({
 suc,nextId:2,nextIncidenciaId:1,fechaOperativa:'2026-11-03',
 pedidos,gastos:[],retiros:[],propinas:[],cierres:[],
 deliveriesManuales:[],incidencias:[],ajustesHistoricos,borradores,
 clientes:{'usuario-qa':{nombre:'Cliente ficticio',pedidos:0,gastado:0,movimientos:[]}},
 cajasDiarias:{[suc+'|2026-11-03']:{base:18000,pagoDelivery:0,apps:{},cajaChica:{inicial:20000,gastos:[]}}}
});
const cuenta={suc:A,id:1,fechaISO:'2026-11-03T15:12',
 registradoEn:1793729520000,cliente:'Cliente ficticio',telefono:'',
 modalidad:'Consumo en local',mesaReferencia:'Mesa 2',envio:0,
 codigoCarta:'MESA-11111111-1111-4111-8111-111111111111',
 qrSolicitudes:['MESA-11111111-1111-4111-8111-111111111111'],
 productos:[{nombre:'4 korokes',cantidad:1,precioUnit:2500,detalle:'Vegetales: sin cebollín'}],
 subtotal:2500,total:2500,pagado:false,estado:'Pendiente',esPremio:false};
const borrador={id:'b-ficticio',suc:A,fechaISO:'2026-11-03T15:13',
 actualizadoEn:1793729522000,modo:'manual',
 datos:{cliente:'Cliente ficticio',modalidad:'Consumo en local',
  mesaReferencia:'Mesa 3',items:[{nombre:'Bebida',cant:1,precio:1500}]}};
const ajuste={id:'a-ficticio',suc:A,fechaISO:'2026-11-03T14:20',monto:0};
const first=estado(A,[cuenta],[borrador],[ajuste]);
try {
 // La primera sesión guarda cifrados reales en Firestore Emulator con reglas QA.
 const save1=await client1.guardar({sucursal:A,password:clave,revisionEsperada:0,estado:first});
 assert.equal(save1.revision,1,'Primera revisión');
 const read1=await client2.cargar(A,clave);
 assert.deepEqual(read1.estado,first,'Otro dispositivo recupera pedido + borrador + ajuste');
 assert.equal(read1.estado.pedidos[0].pagado,false);

 // Confidencialidad: los documentos Firestore guardan AES-GCM, no detalles de cocina.
 const manifest=await db2.doc('uki_operacion_v1/regimiento').get();
 const raw=await db2.doc('uki_operacion_v1/regimiento/bloques/'+
  manifest.data().generacion+'_0000').get();
 assert.ok(raw.exists);
 assert.equal(raw.data().formato,'uki-cloud-chunk-v1');
 assert.doesNotMatch(JSON.stringify(raw.data()),/korokes|Cliente ficticio|Vegetales/);

 // Segunda ronda desde la otra sesión, siempre misma cuenta.
 const second=clone(first);
 second.pedidos[0].productos.push({nombre:'Pizza ficticia',cantidad:1,precioUnit:9000,detalle:'Sin cebolla'});
 second.pedidos[0].qrSolicitudes.push('MESA-22222222-2222-4222-8222-222222222222');
 second.pedidos[0].subtotal=11500;second.pedidos[0].total=11500;
 const save2=await client2.guardar({sucursal:A,password:clave,revisionEsperada:1,estado:second});
 assert.equal(save2.revision,2);
 const read2=await client1.cargar(A,clave);
 assert.deepEqual(read2.estado,second);
 assert.equal(read2.estado.pedidos.length,1);
 assert.equal(read2.estado.pedidos[0].qrSolicitudes.length,2);
 assert.equal(read2.estado.pedidos[0].pagado,false);

 // Otra sesión con revisión anterior no puede sobrescribir pedidos más recientes.
 await assert.rejects(
  client1.guardar({sucursal:A,password:clave,revisionEsperada:1,estado:first}),
  error=>error?.code==='CONFLICTO');
 assert.equal((await client2.cargar(A,clave)).revision,2);

 // Contraseña equivocada no puede generar una copia ilegible.
 await assert.rejects(
  client1.guardar({sucursal:A,password:'clave-ficticia-equivocada-2026',revisionEsperada:2,estado:second}),
  error=>error?.code==='CLAVE');

 // Los registros de La Serena no sustituyen los de Regimiento.
 const serena=estado(B);
 const saveB=await client1.guardar({sucursal:B,password:clave,revisionEsperada:0,estado:serena});
 assert.equal(saveB.revision,1);
 assert.deepEqual((await client2.cargar(B,clave)).estado,serena);
 assert.deepEqual((await client1.cargar(A,clave)).estado,second);

 // Las reglas del emulador deniegan lectura/escritura a personas no autorizadas.
 const intruso=env.authenticatedContext('qa-persona-no-autorizada').firestore();
 await assert.rejects(intruso.doc('uki_operacion_v1/regimiento').get(),e=>e.code==='permission-denied');
 await assert.rejects(intruso.doc('uki_operacion_v1/regimiento').set({pago:true}),e=>e.code==='permission-denied');
 const anon=env.unauthenticatedContext().firestore();
 await assert.rejects(anon.doc('uki_operacion_v1/la-serena').get(),e=>e.code==='permission-denied');

 // Los cierres/cobros no se inventan durante la sincronización.
 const last=(await client2.cargar(A,clave)).estado;
 assert.equal(last.cierres.length,0);
 assert.equal(last.propinas.length,0);
 assert.equal(last.pedidos.filter(p=>p.pagado).length,0);
 console.log(JSON.stringify({
  ok:true,almacenamiento:'Firestore Emulator, proyecto demo aislado',
  controles:[
   'Guardar primera cuenta cifrada con reglas reales de emulador',
   'Recuperar desde segundo cliente autenticado',
   'Borradores y ajustes históricos intactos',
   'Bloques guardados cifrados: sin información personal legible',
   'Agregar segunda ronda a única cuenta pendiente',
   'Conflicto de revisión no sobrescribe pedido',
   'Contraseña incorrecta bloqueada',
   'Regimiento y La Serena separados',
   'Usuario desconocido no lee ni escribe bajo reglas QA',
   'Anónimo sin acceso bajo reglas QA',
   'Sin pagos, propinas ni cierres'
  ],
  revisionesRegimiento:2,revisionesLaSerena:1,cuentas:1,
  saldoPendiente:11500,ventasPagadas:0,produccionModificada:false
 },null,2));
}finally {
 await env.cleanup();
}
