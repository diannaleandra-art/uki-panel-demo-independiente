'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepararIngredientesRomoQA,calcularRecargosRomoQA}=
 require('../lib/romo-ingredientes-armado-qa.cjs');

const raw=[
 ['Proteínas','Pollo',{clasicas:0,premium:0,burger_extra:600}],
 ['Proteínas','Camarón',{clasicas:800,premium:0,mensual_extra:800,burger_extra:1000}],
 ['Proteínas','Cerdo',{clasicas:0,premium:0,mensual_extra:0,burger_extra:800}],
 ['Vegetales','Cebollín',{clasicas:0,premium:0}],
 ['Vegetales','Palta',{clasicas:0,premium:0}],
 ['Vegetales','Pepino',{clasicas:0,premium:0}],
 ['Envolturas','Panko',{clasicas:0,premium:0}],
 ['Envolturas','Palta',{clasicas:1000,premium:1000,mensual_extra:1000}],
 ['Salsas','Soya',{salsas_incluidas:0}],
 ['Salsas','Teriyaki',{salsas_incluidas:0}],
];
function view(){
 return {storeId:'romo:serena',
  ingredients:[...raw.map(([category,name,contexts])=>({
   sku:'ingredient:'+category+':'+name,name,category,contexts,available:true,draftOnly:false
  })),...Array.from({length:15},(_,i)=>({
   sku:'ingredient:Vegetales:Dummy'+i,name:'Dummy'+i,category:'Vegetales',
   contexts:{clasicas:0,premium:0},available:true,draftOnly:false
  }))]};
}
function roll(extra={}){
 return {protein:'Pollo',vegetable:'Palta',wrap:'Panko',vegetariano:false,...extra};
}
function item(extra={}){return {kind:'classic',size:24,qty:1,
 rolls:[roll(),roll()],sauces:['Soya'],extraSauces:[],toppings:[],...extra};}
function q(surcharge,rolls){
 return {extrasModelo:surcharge,componentesModelo:{
  surcharge,sauceExtra:0,toppingExtra:0,rolls:rolls.map(([cost,wrapFree=false,extraFree=false])=>({
   surcharge:cost,wrapFree,extraProteinFree:extraFree
  }))
 }};
}
test('la carta aprobada mantiene sus recargos clásicos y el motor de rolls',()=>{
 const v=view(),i=item();
 assert.deepEqual(prepararIngredientesRomoQA(v,i).normalizado,i);
 assert.equal(calcularRecargosRomoQA(v,i,q(0,[[0],[0]])),0);
 assert.equal(calcularRecargosRomoQA(v,item({rolls:[
  roll({protein:'Camarón'}),roll()]}),q(800,[[800],[0]])),800);
});
test('editar recargo de proteína aumenta el total y respeta beneficio gratuito de cerdo',()=>{
 const v=view();const shrimp=v.ingredients.find(x=>x.name==='Camarón'&&x.category==='Proteínas');
 shrimp.contexts.clasicas=1300;
 const c=item({rolls:[roll({protein:'Camarón'}),roll()]});
 assert.equal(calcularRecargosRomoQA(v,c,q(800,[[800],[0]])),1300);
 const pig=v.ingredients.find(x=>x.name==='Cerdo');
 pig.contexts.clasicas=1700;
 const free=item({rolls:[roll({extraProtein:'Cerdo'}),roll()]});
 assert.equal(calcularRecargosRomoQA(v,free,q(0,[[0,false,true],[0]])),0);
});
test('envoltura premium incluida sigue sin costo aunque cambie el recargo',()=>{
 const v=view();
 v.ingredients.find(x=>x.name==='Palta'&&x.category==='Envolturas').contexts.premium=2100;
 const premium={kind:'premium',size:20,qty:1,rolls:[
  {protein:'Pollo',vegetables:['Cebollín','Palta'],wrap:'Palta'},
  {protein:'Pollo',vegetables:['Pepino','Palta'],wrap:'Panko'}
 ],sauces:['Soya','Soya']};
 assert.equal(calcularRecargosRomoQA(v,premium,q(0,[[0,true],[0]])),0);
});
test('vegetal personalizado conserva selección y suma solo su recargo',()=>{
 const v=view();
 v.ingredients.push({sku:'ingredient:demo',name:'Frutilla nueva',category:'vegetal',
  surcharge:450,surfaces:['classic','premium'],available:true,draftOnly:true});
 const i=item({rolls:[roll({vegetable:'Frutilla nueva'}),roll()]});
 const result=prepararIngredientesRomoQA(v,i);
 assert.equal(result.normalizado.rolls[0].vegetable,'Cebollín');
 assert.equal(i.rolls[0].vegetable,'Frutilla nueva');
 assert.equal(calcularRecargosRomoQA(v,i,q(0,[[0],[0]])),450);
 const distinct=item({rolls:[roll({vegetariano:true,protein:'',vegetable:'Cebollín',
  vegetable2:'Frutilla nueva'}),roll()]});
 const mapped=prepararIngredientesRomoQA(v,distinct).normalizado;
 assert.notEqual(mapped.rolls[0].vegetable,mapped.rolls[0].vegetable2);
});
test('proteína personalizada y vegetal premium se calculan sin perder el armado',()=>{
 const v=view();
 v.ingredients.push({sku:'ingredient:demo-protein',name:'Proteína nueva',
  category:'proteina',surcharge:1100,surfaces:['classic'],available:true,draftOnly:true});
 const i=item({rolls:[roll({protein:'Proteína nueva'}),roll()]});
 assert.equal(prepararIngredientesRomoQA(v,i).normalizado.rolls[0].protein,'Pollo');
 assert.equal(calcularRecargosRomoQA(v,i,q(0,[[0],[0]])),1100);
});
test('promoción mensual suma envoltura extra sin duplicarla, sin duplicarlo',()=>{
 const v=view();
 const m={kind:'monthly',productId:'romo-72-clasicas',qty:1,
  rolls:[roll({wrap:'Palta'})],sauces:['Soya'],toppings:[]};
 assert.equal(calcularRecargosRomoQA(v,m,{
  extrasModelo:1000,componentesModelo:{surcharge:1000,sauceExtra:0,toppingExtra:0,rolls:[{surcharge:0}]}
 }),1000);
});
test('Sushi Burger cambia solo precio de proteína extra, no el principal pollo gratuito',()=>{
 const v=view();
 v.ingredients.find(x=>x.name==='Pollo').contexts.burger_extra=950;
 const b={kind:'dish',productId:'sushi-burger',qty:1,
  protein:'Pollo',vegetables:['Palta','Cebollín'],
  extraProteins:[{name:'Pollo',qty:2}],extraVegetables:[],sauce:'Soya'};
 assert.equal(calcularRecargosRomoQA(v,b,{
  extrasModelo:1200,componentesModelo:{surcharge:1200,sauceExtra:0,toppingExtra:0,rolls:[]}
 }),1900);
});
test('ingrediente agotado impide simular su selección',()=>{
 const v=view();
 v.ingredients.find(x=>x.name==='Pollo').available=false;
 assert.throws(()=>prepararIngredientesRomoQA(v,item()),/agotado/);
});
test('modificaciones desconocidas, contexto incompatible y desglose adulterado se rechazan',()=>{
 const v=view();
 assert.throws(()=>prepararIngredientesRomoQA(v,item({
  rolls:[roll({protein:'Dragón'}),roll()]
 })),/Ingrediente/);
 assert.throws(()=>calcularRecargosRomoQA(v,item(),{
  extrasModelo:10,componentesModelo:{surcharge:0,sauceExtra:0,toppingExtra:0,rolls:[{surcharge:0},{surcharge:0}]}
 }),/coinciden/);
 v.ingredients.push({sku:'ingredient:demo',name:'Solo premium',category:'vegetal',
  surcharge:400,surfaces:['premium'],available:true,draftOnly:true});
 assert.throws(()=>prepararIngredientesRomoQA(v,item({
  rolls:[roll({vegetable:'Solo premium'}),roll()]
 })),/no incluido/);
});

test('integración privada suma precio de panel, descuento e ingrediente cambiado sin ventas',()=>{
 const {ensamblarArmadoRomoQA}=require('../lib/romo-simular-armado-qa.cjs');
 const v=view();
 const camarón=v.ingredients.find(x=>x.name==='Camarón'&&x.category==='Proteínas');
 camarón.contexts.clasicas=1300;
 v.ok=true;v.draftOnly=true;v.publishable=false;
 v.revisionComercial=1;v.revisionAdministracion=4;
 v.products=Array.from({length:40},(_,n)=>({
  sku:n===0?'classic:24':'dish:'+n,
  kind:n===0?'classic':'dish',name:'Prueba '+n,
  available:true,draftOnly:false,
  precioOriginal:n===0?9000:5000,precioFinal:n===0?8100:5000,
  descuentoPorcentaje:n===0?10:0
 }));
 const i=item({qty:2,rolls:[roll({protein:'Camarón'}),roll()]});
 const modelo={ok:true,storeId:'romo:serena',previewOnly:true,
  canSendOrder:false,countsAsSale:false,sku:'classic:24',cantidad:2,
  precioBaseAprobado:8000,unitarioModelo:8800,extrasModelo:800,
  componentesModelo:{surcharge:800,sauceExtra:0,toppingExtra:0,
   rolls:[{surcharge:800,wrapFree:false,extraProteinFree:false},
    {surcharge:0,wrapFree:false,extraProteinFree:false}]}
 };
 const result=ensamblarArmadoRomoQA(v,{data:{}},{
  action:'simularArmado',revisionComercial:1,revisionAdministracion:4,item:i
 },modelo);
 assert.equal(result.precioBaseConDescuento,8100);
 assert.equal(result.recargosArmado,1300);
 assert.equal(result.variacionIngredientes,500);
 assert.equal(result.subtotalProductos,18800);
 assert.equal(result.canSendOrder,false);
 assert.equal(result.countsAsSale,false);
});
