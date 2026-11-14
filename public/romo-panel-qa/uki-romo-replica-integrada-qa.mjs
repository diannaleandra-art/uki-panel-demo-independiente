/**
 * Librería recuperada del panel completo Romo/Uki (noviembre 2026).
 * Estas exportaciones NO activan ninguna operación por sí solas.
 * Se usan desde el mismo formulario de Uki tras incorporar
 * permisos, persistencia CAS y recepción de carta.
 * Los módulos importados conservan sus banderas de operación apagadas.
 */
export {consultarCajaRomoQA,consultarHistorialRomoQA} from './uki-romo-caja-consulta-qa.mjs';
export {prepararCierreDefinitivoRomoQA,prepararAperturaTurnoRomoQA} from './uki-romo-cierre-definitivo-qa.mjs';
export {crearGuardadoTurnosRomoQA} from './uki-romo-turnos-atomicos-qa.mjs';
export {crearGuardadoTimbreRomoQA} from './uki-romo-timbres-atomicos-qa.mjs';
export {crearGuardadoCajaRomoQA} from './uki-romo-movimientos-atomicos-qa.mjs';
export {crearGuardadoCobroRomoQA} from './uki-romo-cobro-pendiente-qa.mjs';
export {crearGuardadoEdicionRomoQA} from './uki-romo-edicion-atomica-qa.mjs';
export {crearGuardadoEntregaRomoQA} from './uki-romo-entrega-atomica-qa.mjs';
export {crearGuardadoCancelacionRomoQA} from './uki-romo-cancelacion-atomica-qa.mjs';
export {crearGuardadoRomoDesdeFormularioQA} from './uki-romo-guardado-atomico-qa.mjs';
export {crearControlRomoMismoPanelQA} from './uki-romo-panel-control-qa.mjs';
export {crearBandejaRomoMismoPanelQA} from './uki-romo-recepcion-formulario-qa.mjs';
export {construirCandidatoRomoFormatoUkiQA} from './uki-romo-pedido-formato-qa.mjs';
// NO exportar ni activar automáticamente cobros o cierres: requieren
// autorización de dueños y revisión confirmada por Neon.
