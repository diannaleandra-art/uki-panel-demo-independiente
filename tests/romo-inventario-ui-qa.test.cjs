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
  'romoQAInventarioHay','romoQAInventarioMinimo','romoQAInventarioDisponible','romoQAInventarioBuscar',
  'romoQAInventarioAgregar','romoQAInventarioFiltro','romoQAInventarioComprasVista',
  'romoQAInventarioRemotoEstado','romoQAInventarioGuardarRemoto'];
 const nodes=new Map(ids.map(id=>[id,make('div')]));
 const document={createElement:make,getElementById:id=>nodes.get(id)||null};
 const win={document,confirm:()=>true};
 vm.runInNewContext(js,{window:win,Date});
 return {win,nodes};
}
test('inventario sólo en QA de Romo y en el mismo HTML panel; nunca se guarda',()=>{
 assert.match(html,/uki-romo-inventario-qa\.js/);
 assert.match(carta,/ukiRomoInventarioPanelHTMLQA\?\.\(\)/);
 assert.doesNotMatch(js,/(localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket)/);
 assert.match(js,/\/api\/romo-catalogo-qa\?origen=inventario/);
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

test('mismo inventario permite corregir cantidades sin duplicar artículo',()=>{
 const {win,nodes}=start();
 nodes.get('romoQAInventarioNombre').value='Palta';
 nodes.get('romoQAInventarioUnidad').value='kg';
 nodes.get('romoQAInventarioRecibido').value='10';
 nodes.get('romoQAInventarioHay').value='4';
 nodes.get('romoQAInventarioMinimo').value='5';
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 let first=win.ukiRomoInventarioQAModelo().articulos[0];
 assert.equal(win.ukiRomoInventarioQAEditar(first.id),true);
 assert.equal(nodes.get('romoQAInventarioAgregar').textContent,'Guardar corrección de prueba');
 nodes.get('romoQAInventarioHay').value='7,5';
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 const model=win.ukiRomoInventarioQAModelo();
 assert.equal(model.articulos.length,1);
 assert.equal(model.articulos[0].hay,7.5);
 assert.equal(model.articulos[0].reponer,0);
 assert.equal(win.ukiRomoInventarioQACancelar(),true);
});
test('filtros agotados y reponer; lista para compras no manda WhatsApp',()=>{
 const {win,nodes}=start();
 const n=nodes.get('romoQAInventarioNombre'),u=nodes.get('romoQAInventarioUnidad'),
 r=nodes.get('romoQAInventarioRecibido'),hay=nodes.get('romoQAInventarioHay'),
 min=nodes.get('romoQAInventarioMinimo');
 n.value='Arroz';u.value='kg';r.value='10';hay.value='3';min.value='8';
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 n.value='Nori';u.value='unidad';r.value='30';hay.value='20';min.value='10';
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 assert.equal(win.ukiRomoInventarioQAFiltro('reponer'),true);
 assert.equal(nodes.get('romoQAInventarioLista').children.length,1);
 const lista=win.ukiRomoInventarioQACompras();
 assert.match(lista,/Arroz: 5 kilos/);
 assert.doesNotMatch(lista,/Nori/);
 assert.match(nodes.get('romoQAInventarioComprasVista').textContent,/LISTA DE REPOSICIÓN DE PRUEBA/);
 const item=win.ukiRomoInventarioQAModelo().articulos[1];
 win.ukiRomoInventarioQAEditar(item.id);
 nodes.get('romoQAInventarioDisponible').checked=false;
 assert.equal(win.ukiRomoInventarioQAAgg(),true);
 assert.equal(win.ukiRomoInventarioQAFiltro('agotados'),true);
 assert.equal(nodes.get('romoQAInventarioLista').children.length,1);
 assert.equal(win.ukiRomoInventarioQAFiltro('otro'),false);
});

test('sin autorización el inventario remoto queda bloqueado y no modifica simulación',async()=>{
 const {win,nodes}=start();
 assert.equal(await win.ukiRomoInventarioQACargarRemoto(),false);
 assert.match(nodes.get('romoQAInventarioRemotoEstado').textContent,/no está conectado/i);
 assert.equal(await win.ukiRomoInventarioQAGuardarRemoto(),false);
 assert.equal(win.ukiRomoInventarioQAModelo().conexionRealCargada,false);
 assert.equal(win.ukiRomoInventarioQAModelo().revisionRemota,null);
 assert.equal(win.ukiRomoInventarioQAModelo().articulos.length,0);
});
test('botones remotos separan consultar de guardar con autorización explícita',()=>{
 const {win}=start(),markup=win.ukiRomoInventarioPanelHTMLQA();
 assert.match(markup,/Consultar inventario protegido/);
 assert.match(markup,/Guardar cambios en Romo/);
 assert.match(markup,/id="romoQAInventarioGuardarRemoto"/);
 assert.match(markup,/disabled id="romoQAInventarioGuardarRemoto"/);
 assert.match(js,/expectedRevision:remoteRevision/);
 assert.match(js,/remoteRevision\+1/);
 assert.match(js,/¿Guardar los cambios de inventario de Romo\?/);
});
