import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const start=src.indexOf('function ukiTimbreTextoPedido(nombre,cantidad){');
const end=src.indexOf('function ukiAbrirTimbreBorrador(){',start);
const fn=src.slice(start,end);
const SUC='Romo’s Sushi La Serena';
const texto=(suc)=>new Function('S','ROMO_SUCURSAL_QA',
 fn+'; return ukiTimbreTextoPedido("Cliente",1)')({suc},SUC);
test('timbre de Uki conserva EXACTAMENTE su marca y premios',()=>{
 const t=texto('Uki La Serena');
 assert.match(t,/UKI SUSHI · TARJETA DE TIMBRES/);
 assert.match(t,/Gracias por preferir Uki Sushi/);
 assert.match(t,/6 compras = 12 piezas gratis/);
 assert.match(t,/10 compras = 36 piezas \+ 2 korokes gratis/);
 assert.doesNotMatch(t,/ROMO’S/);
});
test('timbre Romo usa su marca sin alterar mecánica Uki',()=>{
 const t=texto(SUC);
 assert.match(t,/ROMO’S SUSHI · TARJETA DE TIMBRES/);
 assert.match(t,/Gracias por preferir Romo’s Sushi/);
 assert.match(t,/Sucursal: Romo’s Sushi La Serena/);
 assert.match(t,/6 compras = 12 piezas gratis/);
 assert.match(t,/10 compras = 36 piezas \+ 2 korokes gratis/);
});
test('Romo no permite timbre duplicado ni sin envío real',()=>{
 const a=src.slice(src.indexOf('function ukiRomoPuedeEnviarTimbreQA(p)'),
   src.indexOf('function vRomoPedidosConsultaQA(){'));
 assert.match(a,/!p\.timbreEnviadoEn/);
 assert.match(a,/if\(!confirm\('¿Pulsaste realmente Enviar/);
 assert.match(a,/whatsappAbiertoEn:pendiente\.apertura/);
 assert.match(a,/envioConfirmado:true/);
 assert.match(a,/ukiRomoTimbrePendienteQA=null/);
 assert.match(src,/const ROMO_PANEL_INTEGRACION_HABILITADA_QA=false/);
});
