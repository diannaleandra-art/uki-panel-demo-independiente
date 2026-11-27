import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconocerFotoFactura} from '../public/uki-factura-foto-v2.mjs';
import {leerTextoFactura,leerCabeceraFacturaPDF,nombrePropuestoFactura,construirFilaLeida,vinculoAutomaticoFactura} from '../public/uki-factura-lectura-live.mjs';

const rows=`Articulo Cantidad Unid. P. Unitario Total
POCILLO C/TAPA 1.5 OZ (100 unds) 3 Un 1.748 5,244
QUESO CREMA IMPORTADO 1,36 KL RENY PICOT (UND) 2.Un 8.235 16.471
PANKO BLANCO X 1 KG (UND) 2 Un 2.017 4.034
PALILLOS DE SUSHI REDONDOS 100 UND 2 Un 1.092 2.185
NORI GOLD YAKI 100 HOJAS 1 Un 8.395 8.395
ARROZ TUCAPEL FOOD SERVICE NACIONAL G2 (5X2 KG) 1 Un 12.597 12.597`;
const cabecera='DISTRIBUIDORES\n\nFACTURA ELECTRÓNICA\n\nCOMERCIALIZADORA DEMO SPA\nR.U.T: 77.000.000-0\nN* 12345';
const crear=(width,height)=>({width,height,getContext:()=>({fillRect(){},setTransform(){},drawImage(){},
 getImageData(){return {data:new Uint8ClampedArray(width*height*4).fill(255)}},putImageData(){}})});
const cantidades=filas=>filas.map(x=>[x.cantidad,x.unidad]);
test('interpreta cantidades y empaques sin confundir los precios de la tabla',()=>{
 assert.deepEqual(cantidades(leerTextoFactura(rows)),[['300','un'],['2.72','kg'],['2','kg'],['200','un'],['100','un'],['10','kg']]);
 assert.equal(nombrePropuestoFactura('PANKO BLANCO 1 KG'),'Panko blanco');
 assert.equal(nombrePropuestoFactura('PANKO 1 KG'),'Panko amarillo');
 assert.equal(leerCabeceraFacturaPDF(cabecera).proveedor,'COMERCIALIZADORA DEMO SPA');
 assert.equal(leerCabeceraFacturaPDF(cabecera).folio,'12345');
});
test('elige la lectura ampliada completa y conserva cabecera sin duplicar líneas',async()=>{
 const res=[{text:'Articulo\nCantidad\nUnid.\n3 Un\n2 Un\n1 Un',confidence:80},{text:cabecera,confidence:76},
  {text:rows.split('\n').slice(0,3).join('\n'),confidence:98},{text:rows,confidence:86}];
 const worker={setParameters:async()=>{},recognize:async()=>({data:res.shift()||{text:'',confidence:80}})};
 const d=await reconocerFotoFactura({width:220,height:400},worker,{crear});
 assert.equal(d.lineasTabulares,6);
 assert.equal(d.lecturaParcial,false);
 assert.equal(d.meta.folio,'12345');
 assert.deepEqual(cantidades(leerTextoFactura(d.texto)),cantidades(d.filas));
});
test('un OCR débil queda marcado incompleto, no inventa productos',async()=>{
 const worker={setParameters:async()=>{},recognize:async()=>({data:{text:'SE. y AS ee\nZ e A STO\nE A UNE',confidence:22}})};
 const d=await reconocerFotoFactura({width:180,height:300},worker,{crear});
 assert.equal(d.lecturaParcial,true);
 assert.equal(d.filas.length,0);
});

test('las cifras sin descripción nunca pasan como productos',()=>{
 const malas='1.748 5.244 3 Un\n742 1.748 5.244 3 Un 1748 5244\nTOTAL 2 Un 50 100';
 assert.deepEqual(leerTextoFactura(malas),[]);
 assert.equal(construirFilaLeida('1748 5244','3','Un'),null);
});
test('las presentaciones recuperadas separan cantidad facturada y cantidad de inventario',()=>{
 const casos=[
  ['QUESO GAUDA','3.59','Kg','3.59','kg'],
  ['PALMITOS ENTEROS 800 GR (UND)','1','Un','800','g'],
  ['VINAGRE MANZANA MAXIFOODS 5 LTS','2','Un','10','l'],
  ['PANKO BLANCO X 1 KG (UND)','3','Un','3','kg'],
  ['NORI GOLD YAKI 100 HOJAS','1','Un','100','un']
 ];
 for(const [nombre,q,u,cantidad,unidad] of casos){
  const fila=construirFilaLeida(nombre,q,u);
  assert.deepEqual([fila.cantidad,fila.unidad],[cantidad,unidad]);
 }
 assert.ok(vinculoAutomaticoFactura('VINAGRE MANZANA MAXIFOODS 5 LTS',
  [{name:'Vinagre de manzana',sku:'inv:vinagre',kind:'inventory'}]));
});
