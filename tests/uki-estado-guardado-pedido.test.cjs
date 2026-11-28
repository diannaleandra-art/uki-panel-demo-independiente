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
 assert.match(html,/uki-estado-guardado-pedido\.js\?v=20261127-guardado-visible-v2/);
 assert.match(html,/innerHTML=msg\+f\(\);\s*window\.ukiEstadoGuardadoPedido\?\.controlesActuales\(\)/);
 const a=html.indexOf('async function ndGuardar(){');
 const b=html.indexOf('async function ukiGuardarFormularioQA(',a);
 const fn=html.slice(a,b);
 assert.match(fn,/S\.vista!=='nuevo'\|\|window\.ukiEstadoGuardadoPedido\?\.ocupado\(\)/);
 assert.ok(fn.indexOf('guardadoUI?.iniciar(')<fn.indexOf('await'));
 assert.match(fn,/finally\{uki\w+=false;guardadoUI\?\.terminar\(operacion\)/);
 if(romo)assert.match(html,/await ukiRomoGuardarOperacionQA\(copia,cobrar\?'Pago confirmado'[\s\S]{0,300}resultado\('✅ Pago confirmado/);
 else assert.match(html,/confirmado=guardado&&await window\.ukiRespaldarRectificacionDelivery[\s\S]{0,620}else if\(confirmaPago\)\{\s*const mensaje='✅ Pago confirmado/);
});

test('Cobro directo de Romo bloquea el botón antes de consultar la nube y conserva el resultado',()=>{
 const {api,crear,map}=entorno();
 const boton=crear('romoCobroGuardar42','Registrar pago');
 const op=api.iniciar(true,'romoCobroGuardar42');
 assert.equal(boton.disabled,true);
 assert.equal(api.iniciar(true,'romoCobroGuardar42'),null);
 const nuevo=crear(boton.id,'Registrar pago');api.controlesActuales();
 assert.equal(nuevo.disabled,true);
 api.resultado('Pago confirmado · Pedido #42','ok');api.terminar(op);
 assert.equal(nuevo.disabled,false);
 assert.match(map.get('ukiEstadoGuardadoPedido').textContent,/Pago confirmado/);
 const inicio=html.indexOf('async function ukiRomoConfirmarCobroQA(id)');
 const fin=html.indexOf('async function ukiRomoProbarPermisoNeonQA',inicio);
 const fn=html.slice(inicio,fin);
 assert.ok(fn.indexOf('guardadoUI?.iniciar(true')<fn.indexOf('await'));
 assert.ok(fn.indexOf('await ukiRomoGuardarOperacionQA')<fn.indexOf("resultado('✅ Pago confirmado"));
});
