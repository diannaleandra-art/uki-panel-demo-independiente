/* Integración contra EMULADOR de Firestore + SDK real + AES-GCM real.
   Proyecto id "demo-" (no recursos reales), ningún token ni acceso producción.
   Solo ejecutar con FIRESTORE_EMULATOR_HOST=127.0.0.1:8080. */
import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {initializeApp,deleteApp} from "firebase/app";
import {getFirestore,connectFirestoreEmulator,doc,getDocFromServer,writeBatch,runTransaction} from "firebase/firestore";
import {crearSnapshotsUki} from "../uki-sushi-nube.js";
import {dividirEstado,reunirEstado} from "../uki-particion-local.js";
import {nuevaSal,nuevaGeneracion,derivarClave,cifrarBloque,descifrarBloque} from "../uki-cifrado-bloques.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const ID="demo-uki-cancelaciones-qa-2026";
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("FIRESTORE_EMULATOR_HOST debe ser 127.0.0.1:8080");
const state=suc=>({suc,fechaOperativa:"2026-11-01",pedidos:[],gastos:[],
 retiros:[],propinas:[],cierres:[],deliveriesManuales:[],incidencias:[],
 clientes:{},cajasDiarias:{},nextId:2,nextIncidenciaId:1});
test("Firestore SDK + emulador: guardar, recargar, cancelar y bloquear conflicto",async()=>{
 const app=initializeApp({projectId:ID,apiKey:"demo-ficticio-no-real",appId:"1:123456789:web:demo"},"qa-only-"+Date.now());
 const db=getFirestore(app);
 connectFirestoreEmulator(db,"127.0.0.1",8080);
 const cloud=crearSnapshotsUki({db,auth:{currentUser:{uid:"prueba-sin-cuenta-real"}},
  api:{doc,getDocFromServer,writeBatch,runTransaction},
  blocks:{dividirEstado,reunirEstado},
  codec:{nuevaSal,nuevaGeneracion,derivarClave,cifrarBloque,descifrarBloque}});
 const password="CLAVE-FICTICIA-PARA-EMULADOR-2026";
 const suc="Uki Regimiento Arica",old=state(suc);
 old.pedidos.push({id:1,suc,fechaISO:"2026-11-01T18:00:00",registradoEn:Date.now(),
   estado:"Pendiente",pagado:false,esPremio:false,cliente:"CLIENTE FICTICIO",
   subtotal:7000,total:7000,productos:[{nombre:"PRUEBA",cantidad:1,precioUnit:7000}]});
 try{
  const init=await cloud.guardar({sucursal:suc,password,revisionEsperada:0,estado:old});
  assert.equal(init.revision,1);
  const original=await cloud.cargar(suc,password);
  assert.equal(original.estado.pedidos[0].estado,"Pendiente");
  const updated=structuredClone(original.estado);
  updated.pedidos[0].estado="Cancelado";
  updated.pedidos[0].motivoCancelacion="local";
  updated.pedidos[0].canceladoEn="2026-11-01T22:00:00.000Z";
  const saved=await cloud.guardar({sucursal:suc,password,revisionEsperada:1,estado:updated});
  assert.equal(saved.revision,2);
  const recovered=await cloud.cargar(suc,password);
  assert.equal(recovered.estado.pedidos[0].estado,"Cancelado");
  assert.equal(recovered.estado.pedidos[0].motivoCancelacion,"local");
  const other="Uki La Serena",otherState=state(other);
  otherState.pedidos.push({...old.pedidos[0],suc:other});
  await cloud.guardar({sucursal:other,password,revisionEsperada:0,estado:otherState});
  const branchTwo=await cloud.cargar(other,password);
  assert.equal(branchTwo.estado.pedidos[0].estado,"Pendiente");
  await assert.rejects(cloud.guardar({sucursal:suc,password,revisionEsperada:1,estado:original.estado}),
    err=>err.code==="CONFLICTO");
  const latest=await cloud.cargar(suc,password);
  assert.equal(latest.revision,2);
  assert.equal(latest.estado.pedidos[0].estado,"Cancelado");
 }finally{await deleteApp(app);}
});
