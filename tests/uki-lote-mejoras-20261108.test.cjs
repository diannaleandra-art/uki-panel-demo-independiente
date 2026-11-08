'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('Panel mantiene JS válido y conserva funciones de caja',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new vm.Script(script));
 for(const name of ['function cerrar(){','ukiDatosPago(D,sub)','ukiCajaAcumulada','ukiMesasUI()'])
  assert.ok(html.includes(name),name);
});
test('Timbres sin teléfono permiten WhatsApp del local, copiar y confirmar por separado',()=>{
 assert.match(html,/function avisarTimbres\(key,modo='abrir'\)/);
 assert.match(html,/tieneNumeroValido\?mensaje/);
 assert.match(html,/const destino=tieneNumeroValido\?"https:\/\/wa\.me\/"\+numero:"https:\/\/api\.whatsapp\.com\/send"/);
 assert.doesNotMatch(html,/numero=S\.suc===SUCURSALES\[0\]/);
 assert.ok(html.includes("avisarTimbres("+String.fromCharCode(36)+"{keyArg},'copiar')"));
 assert.ok(html.includes("ultimoTimbre?"));
 const f=html.slice(html.indexOf('function avisarTimbres('),html.indexOf('function canjear12('));
 assert.doesNotMatch(f,/timbreEnviadoEn\s*=/,'Abrir WhatsApp no marca enviado');
});
test('Borradores se encuentran desde Pedidos sin sumarse a ventas',()=>{
 assert.match(html,/function ukiBorradoresResumenPedidos\(\)/);
 assert.ok(html.includes(String.fromCharCode(36)+'{ukiBorradoresResumenPedidos()}'));
 assert.match(html,/Continuar pedido/);
 assert.match(html,/No aparecen entre los pedidos del turno hasta que pulses Guardar/);
});
test('Rechazados de otros días no se mezclan con el filtro de hoy',()=>{
 assert.match(html,/Rechazados de este día/);
 assert.match(html,/Archivo de rechazados de días anteriores/);
 assert.match(html,/const remotas=remotasTurno/);
 assert.doesNotMatch(html,/viendoArchivoRechazados\?remotasTodas\.filter/);
});
test('Búsquedas permiten escribir y borrar hasta solicitar resultados',()=>{
 assert.doesNotMatch(html,/oninput="S\.filtroCliente=this\.value;render\(\)"/);
 assert.doesNotMatch(html,/oninput="S\.filtro=this\.value;render\(\)"/);
 assert.match(html,/ukiTimbresBuscarInput/);
 assert.match(html,/ukiHistorialFiltroTexto/);
});
test('Por entregar no es por cobrar ni solicitud sin confirmar',()=>{
 assert.ok(html.includes('["pendientes","Por entregar"]'));
 assert.ok(html.includes('["por-confirmar","Solicitudes por confirmar"]'));
 assert.match(html,/categoria==="sin-pago"\)return !p\.pagado/);
 assert.match(html,/categoria==="pendientes"\)return p\.estado==="Pendiente"/);
 assert.match(html,/function ukiMarcarPedidoEntregado\(id\)/);
 assert.match(html,/p\.estado='Entregado';p\.entregadoEn=/);
 const f=html.slice(html.indexOf('function ukiMarcarPedidoEntregado('),html.indexOf('function ukiCoincideCategoriaPedido('));
 assert.doesNotMatch(f,/p\.pagado\s*=|p\.total\s*=|S\.caja\s*=/);
 assert.match(html,/✓ Marcar entregado/);
});
