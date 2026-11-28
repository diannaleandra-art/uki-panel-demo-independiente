'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{existsSync,readFileSync}=require('node:fs'),vm=require('node:vm');
const romo=existsSync('public/romo-panel-qa/index.html'),dir=romo?'public/romo-panel-qa':'firebase';
const src=readFileSync(dir+'/uki-estado-guardado-pedido.js','utf8');
const html=readFileSync(dir+(romo?'/index.html':'/uki-sushi-local.html'),'utf8');
function entorno(){
 const map=new Map();
 class Node{
  constructor(){this.style={};this.attr={};this.childNodes=[];this.hidden=false;this.disabled=false;}
  set textContent(v){this.childNodes=[v];}
  get textContent(){return this.childNodes.map(k=>typeof k==='string'?k:k.textContent).join('');}
  setAttribute(a,v){this.attr[a]=v;}
  removeAttribute(a){delete this.attr[a];}
  append(...n){this.childNodes.push(...n);for(const x of n)if(x.id)map.set(x.id,x);}
  replaceChildren(...n){this.childNodes=n;}
  remove(){map.delete(this.id);}
 }
 const panel={document:{createElement:()=>new Node(),getElementById:k=>map.get(k),body:new Node()},window:{},setTimeout:()=>1,clearTimeout:()=>{}};
 const crear=(k,texto)=>{const b=new Node();b.id=k;b.textContent=texto;map.set(k,b);return b;};
 const b=crear('ukiGuardarPedido','Guardar cambios'),salir=crear('ukiCancelarEdicionPedido','Cancelar edición');
 vm.runInNewContext(src,panel);
 return {panel,api:panel.window.ukiEstadoGuardadoPedido,map,crear,b,salir};
}
test('El primer toque bloquea el segundo y conserva el indicador ante render y cambio de vista',()=>{
 const {api,b,salir,crear,map}=entorno();
 const a=api.iniciar(true);
 assert.equal(b.disabled,true);assert.equal(salir.disabled,true);assert.equal(b.attr['aria-busy'],'true');
 assert.match(b.textContent,/Guardando pago/);
 assert.equal(api.iniciar(true),null);
 assert.match(map.get('ukiEstadoGuardadoPedido').textContent,/Espera la confirmación/);
 const nuevo=crear('ukiGuardarPedido','Guardar cambios de nuevo');api.controlesActuales();
 assert.equal(nuevo.disabled,true);
 api.resultado('Pago confirmado · Pedido #714 guardado','ok');
 assert.match(map.get('ukiEstadoGuardadoPedido').textContent,/Guardando pago/);
 api.terminar(a);
 assert.equal(nuevo.disabled,false);
 assert.match(nuevo.textContent,/Guardar cambios de nuevo/);
 assert.match(map.get('ukiEstadoGuardadoPedido').textContent,/Pago confirmado/);
});
test('Se desbloquea ante rechazo sin saltar los requisitos y el estado incierto nunca se anuncia como pago confirmado',()=>{
 const {api,b,salir,map}=entorno();
 const a=api.iniciar(true);api.requisito(b,true);
 api.resultado('No se confirmó. No vuelvas a cobrar.','duda');api.terminar(a);
 assert.equal(b.disabled,true);assert.equal(salir.disabled,false);
 assert.match(map.get('ukiEstadoGuardadoPedido').textContent,/No vuelvas a cobrar/);
 const siguiente=api.iniciar(true);api.terminar(siguiente);
 assert.equal(map.has('ukiEstadoGuardadoPedido'),false);
});
test('El panel enlaza el clic, vuelve a aplicar el bloqueo y confirma solo tras el guardado verificado',()=>{
 assert.match(html,/uki-estado-guardado-pedido\.js\?v=20261127-guardado-visible-v1/);
 assert.match(html,/innerHTML=msg\+f\(\);\s*window\.ukiEstadoGuardadoPedido\?\.controlesActuales\(\)/);
 const a=html.indexOf('async function ndGuardar(){');
 const b=html.indexOf('async function ukiGuardarFormularioQA(',a);
 const fn=html.slice(a,b);
 assert.match(fn,/S\.vista!=='nuevo'\|\|window\.ukiEstadoGuardadoPedido\?\.ocupado\(\)/);
 assert.ok(fn.indexOf('guardadoUI?.iniciar(')<fn.indexOf('await'));
 assert.match(fn,/finally\{uki\w+=false;guardadoUI\?\.terminar\(operacion\)/);
 if(romo)assert.match(html,/await ukiRomoGuardarOperacionQA\(copia,cobrar\?'Pago confirmado'[\s\S]{0,300}resultado\('✅ Pago confirmado/);
 else assert.match(html,/await window\.ukiConfirmarGuardadoPago[\s\S]{0,840}else if\(confirmaPago\)\{\s*const mensaje='✅ Pago confirmado/);
});

test('Ambas sucursales Uki esperan la revisión exacta, incluso si había otro guardado en curso',async()=>{
 const {crearAutoGuardadoOperativo}=await import('../firebase/uki-sushi-autoguardado.js');
 for(const suc of ['Uki Regimiento Arica','Uki La Serena']){
  let datos={suc,pedidos:[]},completar;
  const commits=[];
  const auto=crearAutoGuardadoOperativo({getEstado:()=>datos,avisar(){},scheduler:()=>1,cancel(){},
   guardar:({revisionEsperada,estado})=>new Promise((ok,rechazar)=>{
    commits.push({revisionEsperada,estado});
    completar=(fallo=false)=>fallo?rechazar(Error('Sin respuesta')):ok({revision:revisionEsperada+1});
   })});
  const espera=()=>new Promise(r=>setImmediate(r));
  auto.activar({suc,rev:7,estadoBase:datos});
  datos={suc,pedidos:[{id:23,pagado:false}]};
  const anterior=auto.enviar();await espera();
  datos={suc,pedidos:[{id:23,pagado:true}]};
  const coincide=x=>x?.pedidos[0]?.pagado===true;
  let resultado;
  const confirmacion=auto.confirmar(suc,coincide).then(v=>{resultado=v;});
  assert.equal(commits.length,1);
  completar();await anterior;await espera();
  assert.equal(resultado,undefined);
  assert.deepEqual(commits.map(x=>x.revisionEsperada),[7,8]);
  assert.equal(commits[1].estado.pedidos[0].pagado,true);
  completar();await confirmacion;
  assert.equal(resultado,true);
  assert.equal(await auto.confirmar(suc,coincide),true);
  assert.equal(commits.length,2);
  datos={suc,pedidos:[{id:23,pagado:true},{id:24,pagado:true}]};
  const incierto=auto.confirmar(suc,x=>x?.pedidos[1]?.pagado===true);await espera();
  completar(true);
  assert.equal(await incierto,false);
  assert.equal(await auto.confirmar(suc,coincide),false);
  assert.equal(commits.length,3);
 }
});
