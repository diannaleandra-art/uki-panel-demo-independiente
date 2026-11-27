const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const file='firebase/uki-carta-refresco-silencioso.js';
const src=fs.readFileSync(file,'utf8');
function rig(){
 const state={b:'arica',view:'pedidos',busy:false,open:false,reject:false,focus:false,onList:true,drew:0};
 const events={},tasks=[];
 const el=(k)=>({k,textContent:'',dataset:{},style:{},setAttribute(){},remove(){if(navBadge===this)navBadge=null;}});
 let navBadge=null;
 const btn={querySelector:()=>navBadge,append:x=>{navBadge=x;}};
 const root={querySelector:()=>state.open?{}:null,querySelectorAll:()=>state.reject?[{value:'Motivo'}]:[],contains:()=>state.focus};
 const document={visibilityState:'visible',getElementById:k=>k==='app'?root:null,querySelector:()=>btn,
  createElement:el,addEventListener:(k,fn)=>events[k]=fn};
 Object.defineProperty(document,'activeElement',{get:()=>state.focus?{matches:()=>true}:null});
 const window={scrollY:0};
 vm.runInNewContext(src,{window,document,setTimeout:f=>{tasks.push(f);return tasks.length;},MutationObserver:class{observe(){}}});
 const c=window.ukiCrearRefrescoCarta({branch:()=>state.b,view:()=>state.view,protectedWork:()=>state.busy,showsPending:()=>state.onList,render:()=>state.drew++});
 const poll=(id,b='arica')=>c.complete(b,(Array.isArray(id)?id:[id]).filter(Boolean).map(id=>({id,estado:'pendiente'})),true);
 const settle=k=>{events[k]();while(tasks.length)tasks.shift()();};
 return {state,poll,settle,badge:()=>navBadge?.textContent};
}
test('aplica pedidos al instante cuando la bandeja está libre',()=>{
 const x=rig();x.poll('a');
 assert.equal(x.state.drew,1);assert.equal(x.badge(),undefined);
});
test('durante cobro, escritura o rechazo, sólo muestra el indicador; al cerrar aplica sin otra consulta',()=>{
 for(const type of ['focus','open','busy','reject']){
  const x=rig();x.state[type]=true;
  x.poll('a');x.poll(['a','b']);assert.equal(x.state.drew,0);assert.equal(x.badge(),'2 nuevos');
  x.state[type]=false;x.settle(type==='open'?'toggle':'focusout');
  assert.equal(x.state.drew,1);assert.equal(x.badge(),undefined);
 }
});
test('no mueve otro formulario, ni mezcla sucursales ni repite pedidos',()=>{
 const x=rig();x.state.view='nuevo';
 x.poll('a');x.poll('a');assert.equal(x.badge(),'1 nuevo');assert.equal(x.state.drew,0);
 x.state.b='serena';x.poll('a');x.settle('click');assert.equal(x.badge(),undefined);
 x.state.view='pedidos';x.poll('b','serena');assert.equal(x.state.drew,1);
});
