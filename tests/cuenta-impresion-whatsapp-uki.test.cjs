'use strict';
// Sin pedidos reales, sin nube, sin mensajes reales. node --test tests/cuenta-impresion-whatsapp-uki.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const begin=html.indexOf('function ukiDetalleCuentaTexto(p){');
const end=html.indexOf('function copiarComanda(id){',begin);
assert.ok(begin>=0&&end>begin);
const functions=html.slice(begin,end);
function fixture(){
 const suc='Uki Regimiento Arica';
 const p={id:100,suc,cliente:'Cliente Prueba',codigoCarta:'C100',fechaISO:'2026-11-02T16:00',
  mesaReferencia:'Mesa 4',modalidad:'Consumo en local',productos:[
   {nombre:'Handroll',cantidad:2,precioUnit:3800,detalle:'Sin cebollín'},
   {nombre:'Gohan',cantidad:1,precioUnit:6000,detalle:''}],
  subtotal:13600,envio:0,propina:1360,medioPropina:'Efectivo',total:14960,pagado:false,estado:'Pendiente'};
 const S={suc,pedidos:[p],propinas:[],cierres:[]};
 const clicks=[],messages=[],els=[],warnings=[];
 let printed=0,area=null;
 const document={
  body:{appendChild(e){if(e.id==='ukiReciboImpresion')area=e}},
  getElementById(id){return id==='ukiReciboImpresion'?area:null},
  createElement(tag){
   const e={tag,attrs:{},setAttribute(a,b){this.attrs[a]=b},
    click(){clicks.push({href:this.href,target:this.target,rel:this.rel})},remove(){this.removed=true}};
   els.push(e);return e;
  }
 };
 const funcs=new Function('S','fmt','esc','row','navigator','window','aviso','document','ukiMontoProductosOtroLocal',
  functions+'\nreturn {ukiDetalleCuentaTexto,ukiDetalleCuentaVista,ukiWhatsAppCuenta,ukiImprimirCuenta};')
 (S,n=>'$'+Number(n||0).toLocaleString('es-CL'),x=>String(x??''),()=>'',{},
   {print(){printed++}},x=>warnings.push(x),document,()=>0);
 return {S,p,funcs,clicks,els,warnings,printed:()=>printed,area:()=>area};
}
test('WhatsApp prepara detalle con productos, propina y total sin enviarlo solo',()=>{
 const x=fixture(),original=JSON.stringify(x.S),text=x.funcs.ukiDetalleCuentaTexto(x.p);
 x.funcs.ukiWhatsAppCuenta(x.p.id);
 assert.equal(x.clicks.length,1);
 assert.equal(x.clicks[0].target,'_blank');
 assert.match(x.clicks[0].rel,/noopener/);
 assert.ok(x.clicks[0].href.startsWith('https://wa.me/?text='));
 assert.equal(decodeURIComponent(x.clicks[0].href.split('?text=')[1]),text);
 assert.match(text,/TOTAL: \$14\.960/);
 assert.match(text,/Propina opcional: \$1\.360/);
 assert.equal(JSON.stringify(x.S),original);
});
test('Impresión aísla el recibo del resto del panel y no modifica el pedido',()=>{
 const x=fixture(),before=JSON.stringify(x.S),text=x.funcs.ukiDetalleCuentaTexto(x.p);
 x.funcs.ukiImprimirCuenta(x.p.id);
 assert.equal(x.printed(),1);
 assert.equal(x.area().textContent,text);
 assert.equal(x.area().tag,'div');
 assert.match(html,/body>:not\(#ukiReciboImpresion\)\{display:none!important\}/);
 assert.equal(JSON.stringify(x.S),before);
});
test('No permite imprimir ni compartir pedidos de otra sucursal',()=>{
 const x=fixture();
 x.S.pedidos.push({...x.p,id:101,suc:'Uki La Serena'});
 x.funcs.ukiWhatsAppCuenta(101);
 x.funcs.ukiImprimirCuenta(101);
 assert.equal(x.clicks.length,0);
 assert.equal(x.printed(),0);
 assert.equal(x.warnings.length,2);
});
test('Ambas opciones son visibles en la cuenta, sin perder copiar y compartir',()=>{
 const x=fixture(),ui=x.funcs.ukiDetalleCuentaVista(x.p);
 for(const word of ['Enviar por WhatsApp','Imprimir cuenta','Compartir detalle','Copiar detalle'])
   assert.ok(ui.includes(word));
});
