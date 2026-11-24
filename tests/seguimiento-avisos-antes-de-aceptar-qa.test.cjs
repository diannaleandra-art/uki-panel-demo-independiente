'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const api=fs.readFileSync(path.join(__dirname,'../api/seguimiento-personal-tres-qa.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs'),'utf8');
test('el personal ve avisos sin esperar a que la solicitud esté aceptada',()=>{
 assert.match(api,/s\.estado IN \('pendiente','aceptada'\)/);
 assert.match(api,/cliente_aviso_en/);
 assert.match(api,/AND s\.branch=\$2/);
 assert.match(api,/s\.store_id=\$1/);
 assert.match(api,/list\.map\(r=>/);
});
test('ninguna transferencia de pedido pendiente puede confirmarse como cobrada',()=>{
 assert.match(api,/if\(req\.method==='POST'&&order\.estado!=='aceptada'\)/);
 assert.match(api,/return fail\(res,409,'La solicitud sigue pendiente/);
 assert.match(api,/puedeConfirmar:order\.estado==='aceptada'/);
 assert.match(ui,/if\(p\.estadoPedido==='aceptada'\)link\.append\(linkButton\)/);
 assert.match(ui,/p\.estadoPedido==='pendiente'/);
});
