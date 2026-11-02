/* TEST DE SEGURIDAD: reglas ficticias en Firestore Emulator.
   Jamás conecta el proyecto real ni reutiliza UID de trabajadores.
   Uso: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test ...
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initializeTestEnvironment,assertFails,assertSucceeds} from "@firebase/rules-unit-testing";
const HOST="127.0.0.1:8080";
if(process.env.FIRESTORE_EMULATOR_HOST!==HOST)
 throw Error("Solo ejecutar contra Firestore Emulator local");
const rules=readFileSync(new URL("./qa-firestore.rules",import.meta.url),"utf8");
test("Reglas QA: anónimo y otro local no pueden leer ni escribir",async()=>{
 const testEnv=await initializeTestEnvironment({
  projectId:"demo-uki-reglas-cancelacion-qa-2026",
  firestore:{host:"127.0.0.1",port:8080,rules}
 });
 try{
  const uid=nombre=>testEnv.authenticatedContext(nombre).firestore();
  const arica=uid("qa-arica");
  const serena=uid("qa-serena");
  const duena=uid("qa-duena");
  const ajeno=uid("qa-desconocido");
  const anon=testEnv.unauthenticatedContext().firestore();
  const reg="uki_operacion_v1/regimiento";
  const sere="uki_operacion_v1/la-serena";
  const regBlock=reg+"/bloques/prueba_0000";
  const serBlock=sere+"/bloques/prueba_0000";
  const meta={schemaVersion:2,rev:1,generacion:"a".repeat(32),salt:"AAAAAAAAAAAAAAAAAAAAAA==",totalBloques:1,branch:"regimiento"};
  await assertFails(anon.doc(reg).get());
  await assertFails(anon.doc(reg).set(meta));
  await assertFails(ajeno.doc(reg).get());
  await assertFails(ajeno.doc(sere).set(meta));
  await assertSucceeds(arica.doc(reg).set(meta));
  await assertSucceeds(arica.doc(regBlock).set({formato:"uki-cloud-chunk-v1",paquete:"DATO CIFRADO FICTICIO"}));
  await assertFails(arica.doc(sere).get());
  await assertFails(arica.doc(serBlock).set({paquete:"indebido"}));
  await assertFails(serena.doc(reg).get());
  await assertFails(serena.doc(regBlock).set({paquete:"indebido"}));
  await assertSucceeds(serena.doc(sere).set({...meta,branch:"la-serena"}));
  await assertSucceeds(duena.doc(reg).get());
  await assertSucceeds(duena.doc(sere).get());
  await assertFails(duena.doc("pedidos_reales/prohibido").set({pedido:"no permitido"}));
  const lectura=await arica.doc(reg).get();
  assert.equal(lectura.data().rev,1);
 }finally{await testEnv.cleanup();}
});
