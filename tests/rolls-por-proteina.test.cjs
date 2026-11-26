'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const panel=fs.existsSync(path.join(__dirname,'../public/romo-panel-qa/index.html'))&&fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/index.html'),'utf8').includes('function ukiStatsGruposRegistrados(')?'public/romo-panel-qa/index.html':'firebase/uki-sushi-local.html';
const source=fs.readFileSync(path.join(__dirname,'..',panel),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function ukiNombreStats('),source.indexOf('function ukiStatsProductosUI(')),context);
const result=(...p)=>JSON.parse(JSON.stringify(context.ukiStatsVentas(p)));
const roll='Roll 1: Pollo / Pepino / Panko\nRoll 2: Carne / Palta / Tempura\nRoll 3: Kanicama / Cebollín / Panko';
const ingredients=[['Pollo',1],['Carne',1],['Kanicama',1]];
const group=(name='Clásico 36 piezas', rows=roll, qty=1, amount=12500)=>['*− '+qty+' × '+name+'*',amount===null?'':'Importe línea: $'+amount,rows].filter(Boolean).join('\n');
const carta=(g,total=12500,brand='UKI SUSHI',code='821')=>' *'+brand+'*\nN.º de pedido: '+code+'\n\n*COCINA*\n'+g+'\n\n*ENTREGA*\nRETIRO\n\n*PAGO*\nTotal productos: $'+total;
const saved=(g,{nombre='36 piezas clásicas',cantidad=1,precioUnit=12500,detalle='',codigoCarta='821',pagado=true,estado='Entregado',esPremio=false,textoOriginal=carta(g)}={})=>({pagado,estado,esPremio,codigoCarta,textoOriginal,productos:[{nombre,cantidad,precioUnit,detalle}]});
test('Un pedido con nombre directo desglosa sus tres proteínas',()=>{
 assert.deepEqual(result(saved(group())).porProteina,ingredients);
});
test('El formato público Uki sin precios por línea toma el subtotal de productos',()=>{
 const a=group('Clásico 36 piezas',roll,1,null);
 assert.deepEqual(result(saved(a)).porProteina,ingredients);
 assert.equal(result(saved(a,{textoOriginal:carta(a,12500,'Texto libre')})).rollsIdentificados,0);
});
test('Dos promos idénticas cuentan dos veces y el total no incluye delivery',()=>{
 const a=group('Clásico 36 piezas',roll.split('\n').map(x=>'2 × '+x).join('\n'),2,25000);
 const p=saved(a,{cantidad:2,textoOriginal:carta(a,25000,'ROMO’S SUSHI')+'\nDelivery: $2000\nTotal con delivery: $27000'});
 const r=result(p);
 assert.equal(r.rolls,6);
 assert.deepEqual(r.porProteina,ingredients.map(([n])=>[n,2]));
});
test('Canasta agrupada antigua y varios ítems guardados conservan el desglose sin duplicarlo',()=>{
 const a=group()+ '\n\n'+group('Topping para sushi Cebollín','',1,1500);
 const p=saved(a,{nombre:'Productos de carta digital (ver detalle)',precioUnit:14000,textoOriginal:carta(a,14000)});
 assert.deepEqual(result(p).porProteina,ingredients);
 p.productos=[{nombre:'Clásico 36 piezas',cantidad:1,precioUnit:12500},{nombre:'Topping para sushi Cebollín',cantidad:1,precioUnit:1500}];
 assert.equal(result(p).rolls,3);
 assert.deepEqual(result(p).porProteina,ingredients);
});
test('Un monto, código, nombre, cantidad o detalle distinto impide reutilizar la comanda',()=>{
 for(const change of [{precioUnit:12600},{codigoCarta:'820'},{nombre:'Premium 30 piezas'},{cantidad:2},{detalle:'Roll 2: Pollo / Palta / Tempura'}]){
  assert.equal(result(saved(group(),change)).rollsIdentificados,0);
 }
});
test('No se inventan proteínas de un pedido sin armado, cancelado, impago o premio',()=>{
 const p=saved(group(),{textoOriginal:''});
 const r=result(p,saved(group(),{pagado:false}),saved(group(),{estado:'Cancelado'}),saved(group(),{esPremio:true}));
 assert.equal(r.rolls,3);
 assert.equal(r.rollsIdentificados,0);
});
test('Ignora cantidades de roll inconsistentes o numeración incompleta',()=>{
 assert.equal(result(saved(group('Clásico 36 piezas',roll.replace('Roll 2:','Roll 1:')))).rollsIdentificados,0);
 assert.equal(result(saved(group('Clásico 36 piezas',roll.split('\n').slice(0,2).join('\n')))).rollsIdentificados,0);
});
