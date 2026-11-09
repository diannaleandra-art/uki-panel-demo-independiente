'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)};
test('El script operativo conserva sintaxis JavaScript válida',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const main=scripts.find(x=>x.includes('function vPedidos(){')&&x.includes('function vInicio(){'));
 assert.ok(main,'Falta el script principal');
 assert.doesNotThrow(()=>new vm.Script(main));
});
test('Inicio muestra acciones operativas antes de acceso avanzado a jefes',()=>{
 const h=cut('function vInicio(){','// Datos temporales de cierre:');
 assert.ok(h.indexOf('<div class="quick-grid">')<h.indexOf('id="ukiAccesoJefes"'));
 assert.match(h,/Información del turno/);
 assert.match(h,/Reportes <span>/);
 for(const x of ["ir('pedidos')","ir('inventario')","ir('clientes')","ir('cierre')","ir('historial')"])assert.ok(h.includes(x),x);
});
test('Pedidos conserva todos los filtros, pero los distribuye en principales y avanzados',()=>{
 const p=cut('function vPedidos(){','function vHistorialCompacto(){');
 for(const k of ['todos','por-confirmar','pendientes','sin-pago','pagados'])assert.ok(p.includes(k),k);
 assert.match(p,/const categoriasExtra=/);
 assert.match(p,/<b>Más filtros<\/b>/);
 const categorias=cut('const UKI_CATEGORIAS_PEDIDOS=[','function ukiOrigenPedido(');
 for(const k of ['cuentas','entregados','cancelados','rechazados','errores'])assert.ok(categorias.includes(k),k);
 assert.match(p,/ukiMesasUI\(\)/);
});
test('Borradores sin registrar quedan compactos sin afectar la caja ni la edición',()=>{
 const p=cut('function ukiVistaBorradores(){','function ukiWhatsAppSolicitudesSucursal(){');
 assert.match(p,/if\(D.editando\)return ''/);
 assert.match(p,/Guardar en espera y abrir otro/);
 assert.match(p,/En atención/);
 assert.match(p,/list\.length\?'<details/);
 assert.match(p,/ukiRetomarBorrador/);
});
test('Los rechazados antiguos salen del listado principal, se consultan por calendario en Caja > Historial',()=>{
 const p=cut('function vPedidos(){','// Archivo visual consultable por calendario');
 assert.doesNotMatch(p,/<summary><b>📚 Archivo de rechazados de días anteriores/);
 const hist=cut('function ukiArchivoRechazadosHistorialUI(){','function vHistorialCompacto(){');
 assert.match(hist,/Consultar por fecha/);
 assert.match(hist,/type="date"/);
 assert.match(hist,/ukiWhatsAppFicha\(x\.valor,false\)/);
 assert.match(hist,/ukiCartaRemotaFicha\(x\.valor\)/);
 assert.match(html,/ukiVAgregarPedidoOlvidado\(\)\+ukiArchivoRechazadosHistorialUI\(\)/);
});
test('Historial filtra rechazos de otra jornada por fecha sin modificar registros',()=>{
 const part=cut('function ukiArchivoRechazadosHistorialUI(){','function vHistorialCompacto(){');
 const local=[{estado:'rechazada',suc:'Uki Regimiento Arica',creadoEn:1704153600000,fechaISO:'2024-01-02'}];
 const remote=[{estado:'rechazada',creado_en:'2024-01-02T12:00:00.000Z'}];
 const ctx={S:{suc:'Uki Regimiento Arica'},ukiArchivoRechazadosDia:'',
  fechaOperativaActual:()=> '2026-11-08',ukiWhatsAppSolicitudesSucursal:()=>local,
  ukiCartaRemotasSucursal:()=>remote,fechaTurnoRegistro:r=>r.fechaISO,
  fechaLocalRegistro:r=>String(r).slice(0,10),corteDelDiaMs:()=>Date.parse('2026-11-08'),
  esc:String,ukiWhatsAppFicha:()=>'<p>Manual archivado</p>',ukiCartaRemotaFicha:()=>'<p>Carta archivada</p>'
 };
 const fn=vm.runInNewContext(part+'\nukiArchivoRechazadosHistorialUI',ctx);
 const out=fn();assert.match(out,/Manual archivado/);assert.match(out,/Carta archivada/);
 assert.equal(local.length,1);assert.equal(remote.length,1);
 ctx.ukiArchivoRechazadosDia='2024-01-03';
 assert.doesNotMatch(fn(),/Manual archivado|Carta archivada/);
});
