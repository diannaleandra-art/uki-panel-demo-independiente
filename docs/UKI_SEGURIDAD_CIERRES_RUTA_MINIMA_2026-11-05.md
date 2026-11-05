# Uki Sushi — separación de cierres: ruta mínima de implementación

Fecha: 2026-11-05. Proyecto exclusivo Uki Sushi. Solo código QA/Preparación.
No hay cambios en producción ni migraciones financieras ejecutadas.

## Resultado de la auditoría

El panel vigente utiliza `firebase/uki-sushi-local.html`, estado `S`.
`datosSoloSucursal()` guarda/copía todas las categorías, incluidos
`cierres`, `cajasDiarias`, `gastos` y `pedidos`.
`entrarDatosSucursal` abre el mismo bloque AES-GCM usando la contraseña
compartida de esa sucursal. La nube Firestore cifra también un snapshot
del estado unificado; `uki-particion-local.js` divide físicamente en
bloques, pero usa **la misma clave** de descifrado.

**Conclusión:** una pestaña Caja escondida o protegida con un botón no
puede garantizar privacidad frente a un trabajador que conozca la clave
del snapshot compartido. Una puerta visual Google tampoco basta si
se carga el snapshot completo en su navegador.

## Preparación ya realizada (reversible y sin impacto operativo)

- `firebase/uki-inventario-revision.html`: acceso independiente al
  inventario mediante llave QR de dispositivo autorizada, sin cargar
  snapshot operativo ni finanzas.
- `firebase/uki-inventario-reposicion.mjs`: calcula cantidades a reponer
  por mínimo configurado; envía la lista por WhatsApp manualmente.
- `firebase/uki-separacion-cierres-v1.mjs`: prototipo **sin conectar**
  de partición por lista blanca: pedidos e información operativa pasan
  al paquete de personal; caja/cierres/gastos/reportes y cualquier campo
  nuevo pasan al paquete reservado de administración.
- `tests/uki-separacion-cierres.test.cjs`: pruebas de no filtración
  de campos financieros, no pérdida de pedidos, aislamiento por sucursal,
  rechazo de campos prohibidos e invariantes de no publicación.
- Las pruebas pasan en GitHub Actions. No se cambió el almacenamiento real.

## Próxima implementación segura, sin rehacer todo el panel

1. **Respaldar y validar** una copia cifrada de ambas sucursales,
   además de la revisión remota actual y de los pedidos aún pendientes.
2. Crear dos almacenamiento/colecciones diferentes:
   - trabajo de personal (pedidos y datos operativos necesarios);
   - finanzas privadas (cierres, totales, gastos, balances y reportes).
   Deben tener **llaves de cifrado y permisos de servidor separados**.
3. Administración autentica con Google autorizado y obtiene exclusivamente
   el acceso a finanzas. El trabajador entra con equipo QR autorizado de
   su sucursal, registra pedidos/conteos y **no puede descargar ni descifrar**
   el conjunto financiero. Se preservan nombres de turno y PIN compartido
   donde siguen siendo necesarios, sin usarlo como llave financiera.
4. Hacer migración de ensayo **solo en QA** con una copia sintética/ficticia;
   verificar que no cambien folios, pagos mixtos, reparto, gastos, pre-cierre,
   historial, notas, WhatsApp ni fecha operativa.
5. Verificar lectura/escritura concurrente en dos teléfonos, cierres
   tardíos y retroceso seguro. Comprobar que un trabajador (también con
   el PIN anterior) no pueda abrir cierres, obtener respaldo financiero
   ni consultar reportes desde el navegador, API o Firebase.
6. Únicamente tras aprobación expresa, ejecutar plan de corte real
   con copia y rollback comprobados. **Nunca sustituir automáticamente
   los datos del día actual**.

## Estado: BLOQUEADO PARA PRODUCCIÓN

Las pantallas de inventario QA y la lista de reposición están verificadas.
La separación del panel operativo y los cierres NO está implementada.
Faltan autenticación y almacenamiento financiero separados; no promocionar
`uki-separacion-cierres-v1.mjs` sin esa implementación.
