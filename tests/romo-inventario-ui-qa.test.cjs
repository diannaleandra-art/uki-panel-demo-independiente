'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../firebase/uki-romo-inventario-qa.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const carta=fs.readFileSync(path.join(__dirname,'../firebase/uki-romo-carta-panel-qa.js'),'utf8');
const make=tag=>({
 tagName:tag,textContent:'',value:'',checked:true,children:[],className:'',style:{},
 appendChild(x){this.children.push(x)},replaceChildren(...xs){this.children=[...xs]},
 addEventListener(_event,cb){this.click=cb}
});
function start(){
 const ids=['romoQAInventarioLista','romoQAInventarioResumen','romoQAInventarioEstado',
  'romoQAInventarioNombre','romoQAInventarioUnidad','romoQAInventarioRecibido',
  'romoQAInventarioHay','romoQAInventarioMinimo','romoQAInventarioDisponible','romoQAInventarioBuscar'];
 const nodes=new Map(ids.map(id=>[id,make('div')]));
 const document={createElement:make,getElementById:id=>nodes.get(id)||null};
 const win={document,confirm:()=>true};
 vm.runInNewContext(js,{window:win,Date});
 return {win,nodes};
}
test('inventario sólo en QA de Romo y en el mismo HTML panel; nunca se guarda',()=>{
 assert.match(html,/uki-romo-inventario-qa\.js/);
 assert.match(carta,/ukiRomoInventarioPanelHTMLQA\?\.\(\)/);
 assert.doesNotMatch(js,/(fetch\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|\.post\()/);
 const {win}=start();
 assert.match(win.ukiRomoInventarioPanelHTMLQA(),/pruebas/);
 assert.equal(win.ukiRomoInventarioQAModelo().sucursal,'romo:serena');
 assert.equal(win.ukiRomoInventarioQAModelo().articulos.length,0);
});
test('cantidades con coma, diferencia y reposición sin modificar caja',()=>{
 const {win,nodes}=start();
 nodes.get('romoQAInventarioNombre').value='Arroz';
 nodes.get('romoQAInventarioUnidad').value='kg';
 nodes.get('romoQAInventarioRecibido').value='10,5';
 nodes.get('romoQAInventarioHay').value='7';
 nodes.get('romoQAInventarioMinimo').value='8';
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 const item=win.ukiRomoInventarioQAModelo().articulos[0];
 assert.equal(item.recibido,10.5);
 assert.equal(item.diferencia,3.5);
 assert.equal(item.reponer,1);
 assert.equal(win.ukiRomoInventarioQAModelo().porReponer,1);
 assert.equal(nodes.get('romoQAInventarioLista').children.length,1);
});
test('nombre repetido, cantidad negativa o inválida no se agregan',()=>{
 const {win,nodes}=start();
 nodes.get('romoQAInventarioNombre').value='Palta';
 nodes.get('romoQAInventarioUnidad').value='kg';
 nodes.get('romoQAInventarioRecibido').value='2';
 nodes.get('romoQAInventarioHay').value='2';
 nodes.get('romoQAInventarioMinimo').value='3';
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 assert.equal(win.ukiRomoInventarioQAAgg(),false);
 nodes.get('romoQAInventarioNombre').value='Tomate';
 nodes.get('romoQAInventarioHay').value='-1';
 assert.equal(win.ukiRomoInventarioQAAgg(),false);
 assert.equal(win.ukiRomoInventarioQAModelo().articulos.length,1);
});
test('buscar, marcar agotado y quitar sólo cambia memoria local de prueba',()=>{
 const {win,nodes}=start();
 nodes.get('romoQAInventarioNombre').value='Arroz';
 nodes.get('romoQAInventarioUnidad').value='kg';
 nodes.get('romoQAInventarioRecibido').value='10';
 nodes.get('romoQAInventarioHay').value='7';
 nodes.get('romoQAInventarioMinimo').value='5';
 win.ukiRomoInventarioQAAgg();
 win.ukiRomoInventarioQABuscar('palta');
 assert.equal(nodes.get('romoQAInventarioLista').children.length,1);
 win.ukiRomoInventarioQABuscar('arroz');
 const card=nodes.get('romoQAInventarioLista').children[0];
 card.children[3].click();
 assert.equal(win.ukiRomoInventarioQAModelo().articulos[0].disponible,false);
 assert.equal(win.ukiRomoInventarioQALimpiar(),true);
 assert.equal(win.ukiRomoInventarioQAModelo().articulos.length,0);
});
