/* E2E cifrado de Uki v8.15 usando módulos reales + Firestore en memoria.
   Sin red, credenciales o conexión con uki-panel-f4909.
   Ejecutar: node --test firebase/tests/cancelaciones-cifrado-e2e.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {crearSnapshotsUki} from "../uki-sushi-nube.js";
import {dividirEstado,reunirEstado} from "../uki-particion-local.js";
import {nuevaSal,nuevaGeneracion,derivarClave,cifrarBloque,descifrarBloque} from "../uki-cifrado-bloques.js";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const copia=x=>structuredClone(x);
function firestoreFalso(){
 const memoria=new Map();
 const snap=r=>({exists:()=>memoria.has(r),data:()=>copia(memoria.get(r))});
 const api={
  doc:(_db,...parts)=>parts.join("/"),
  getDocFromServer:async r=>snap(r),
  writeBatch:()=>{const tareas=[];return {
   set:(r,v)=>tareas.push([r,copia(v)]),
   commit:async()=>{for(const [r,v] of tareas)memoria.set(r,v)}
  }},
  runTransaction:async(_db,callback)=>{
   const tareas=[],tx={
    get:async r=>snap(r),
    set:(r,v)=>tareas.push([r,copia(v)])
   };
   const resultado=await callback(tx);
   for(const [r,v] of tareas)memoria.set(r,v);
   return resultado;
  }
 };
 return {memoria,api};
}
const vacio=suc=>({suc,fechaOperativa:"2026-11-01",pedidos:[],gastos:[],
 retiros:[],propinas:[],cierres:[],deliveriesManuales:[],incidencias:[],
 clientes:{},cajasDiarias:{},nextId:2,nextIncidenciaId:1});
const roll=suc=>({id:1,suc,fechaISO:"2026-11-01T19:00:00",
 registradoEn:Date.now(),cliente:"PERSONA FICTICIA PARA QA",
 estado:"Pendiente",pagado:false,esPremio:false,
 productos:[{nombre:"PRUEBA 24 piezas",cantidad:1,precioUnit:7000}],subtotal:7000,total:7000});
test("AES-GCM real: alta, lectura, cancelación, aislamiento y conflicto",async()=>{
 const {memoria,api}=firestoreFalso();
 const servicio=crearSnapshotsUki({db:"SOLO-MEMORIA",auth:{currentUser:{uid:"qa-falso"}},
  api,blocks:{dividirEstado,reunirEstado},
  codec:{nuevaSal,nuevaGeneracion,derivarClave,cifrarBloque,descifrarBloque}});
 const sucursal="Uki Regimiento Arica",password="CLAVE-SIMULADA-NO-REAL-1234";
 const primero=vacio(sucursal);
 primero.pedidos.push(roll(sucursal));
 const guardado=await servicio.guardar({sucursal,password,revisionEsperada:0,estado:primero});
 assert.equal(guardado.revision,1);
 assert.equal(JSON.stringify([...memoria]).includes("PERSONA FICTICIA PARA QA"),false,
  "Un bloque remoto no puede contener pedidos en texto plano");
 const cargado=await servicio.cargar(sucursal,password);
 assert.equal(cargado.revision,1);
 assert.deepEqual(cargado.estado.pedidos,primero.pedidos);
 const cambio=copia(cargado.estado);
 cambio.pedidos[0].estado="Cancelado";
 cambio.pedidos[0].motivoCancelacion="cliente";
 cambio.pedidos[0].canceladoEn="2026-11-01T20:00:00.000Z";
 const luego=await servicio.guardar({sucursal,password,revisionEsperada:1,estado:cambio});
 assert.equal(luego.revision,2);
 const recuperado=await servicio.cargar(sucursal,password);
 assert.equal(recuperado.revision,2);
 assert.equal(recuperado.estado.pedidos[0].estado,"Cancelado");
 assert.equal(recuperado.estado.pedidos[0].motivoCancelacion,"cliente");
 assert.equal(recuperado.estado.pedidos[0].canceladoEn,cambio.pedidos[0].canceladoEn);
 const otra="Uki La Serena",serena=vacio(otra);
 serena.pedidos.push(roll(otra));
 await servicio.guardar({sucursal:otra,password,revisionEsperada:0,estado:serena});
 const aislado=await servicio.cargar(otra,password);
 assert.equal(aislado.estado.pedidos[0].estado,"Pendiente");
 assert.equal(aislado.revision,1);
 const antiguo=copia(cargado.estado);
 await assert.rejects(()=>servicio.guardar({
  sucursal,password,revisionEsperada:1,estado:antiguo
 }),e=>e.code==="CONFLICTO");
 const final=await servicio.cargar(sucursal,password);
 assert.equal(final.revision,2);
 assert.equal(final.estado.pedidos[0].estado,"Cancelado");
 await assert.rejects(()=>servicio.cargar(sucursal,"CLAVE-INCORRECTA-12345678"));
});
