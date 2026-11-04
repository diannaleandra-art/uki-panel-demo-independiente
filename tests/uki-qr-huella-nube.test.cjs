'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-autoguardado.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
let mod;
async function moduleQA(){
  return mod ??= await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
}
async function prepare(){
  const {crearAutoGuardadoOperativo}=await moduleQA();
  let state={suc:'Uki Regimiento Arica',pedidos:[],gastos:[],cierres:[]};
  let writes=0;
  let shouldFail=false;
  const saved=[];
  const auto=crearAutoGuardadoOperativo({
    getEstado:()=>state,
    guardar:async({estado,revisionEsperada})=>{
      writes++;
      if(shouldFail)throw Error('Sin conexión');
      saved.push(JSON.parse(JSON.stringify(estado)));
      return {revision:revisionEsperada+1};
    },
    avisar:()=>{},
    delay:3500,
    scheduler:()=>123,
    cancel:()=>{}
  });
  auto.activar({suc:'Uki Regimiento Arica',rev:3,estadoBase:JSON.parse(JSON.stringify(state))});
  return {auto,estado:()=>state,actualizar:x=>{state=x;},escrituras:()=>writes,saved,fallar:()=>{shouldFail=true;}};
}
test('Estado recién modificado NO se considera respaldado aun si la pantalla sigue sincronizada',async()=>{
 const x=await prepare();
 assert.equal(x.auto.resumen().actualRespaldado,true);
 x.estado().pedidos.push({id:1,suc:'Uki Regimiento Arica',qrSolicitudes:['MESA-A1'],pagado:false});
 assert.equal(x.auto.resumen().estado,'sincronizado');
 assert.equal(x.auto.resumen().actualRespaldado,false);
});
test('Una ronda QR solo queda respaldada después de confirmarse la nueva revisión',async()=>{
 const x=await prepare();
 x.estado().pedidos.push({id:2,suc:'Uki Regimiento Arica',qrSolicitudes:['MESA-A2'],pagado:false});
 x.auto.cambioLocal();
 assert.equal(x.auto.resumen().actualRespaldado,false);
 await x.auto.enviar();
 assert.equal(x.auto.resumen().estado,'sincronizado');
 assert.equal(x.auto.resumen().actualRespaldado,true);
 assert.equal(x.auto.resumen().revision,4);
 assert.equal(x.saved[0].pedidos.length,1);
});
test('Fallo de nube no confirma QR y conserva la cuenta local',async()=>{
 const x=await prepare();
 x.fallar();
 x.estado().pedidos.push({id:3,suc:'Uki Regimiento Arica',qrSolicitudes:['MESA-A3'],pagado:false});
 x.auto.cambioLocal();
 await x.auto.enviar();
 assert.equal(x.auto.resumen().actualRespaldado,false);
 assert.equal(x.auto.resumen().bloqueado,true);
 assert.equal(x.saved.length,0);
 assert.equal(x.estado().pedidos.length,1);
});
test('Los cambios de pantalla no crean falsos pendientes',async()=>{
 const x=await prepare();
 x.estado().vista='pedidos';
 x.estado().busy=false;
 assert.equal(x.auto.resumen().actualRespaldado,true);
});
test('El panel exige la huella remota para la confirmación automática y los cierres',()=>{
 assert.match(html,/estado\.actualRespaldado===true/);
 assert.match(html,/ukiMesaConfirmarGuardadosSeguro\(/);
});
