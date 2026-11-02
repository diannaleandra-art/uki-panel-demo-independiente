# Precierre por trabajador — Uki Sushi · Panel v8.15 · LOCALES

**Este es el panel CORRECTO:** `firebase/uki-sushi-local.html` del repositorio `diannaleandra-art/uki-panel-demo-independiente`.

- Rama de trabajo: `feature/precierres-por-trabajador-en-panel-locales-20261102`.
- Fuente base: `main` del MISMO repositorio.
- **No confundir** con `uki-sushi-respaldo` (panel `mi-local-qa.html`) ni con `index.html` de la demo.
- **No desplegado / no publicado / no fusionado a main.**
- No se cambiaron las sucursales, los pedidos, cierres históricos, timbres, ni las credenciales/código de Firebase.
- Solo se añadió a **Caja → Cierre** el inicio de turno por trabajador y el precierre, con hora de entrada y salida, efectivo contado, notas, reparto de ventas confirmado por diferencia de totales, y un informe Excel/CSV desde **Caja → Historial**.
- Los registros usan `cajasDiarias[sucursal|díaOperativo].precierres`, dentro del respaldo cifrado y el guardado de nube ya existente. No se creó otro sistema ni base de datos.
- El cierre diario original se mantiene **idéntico a `main`**, sin bloquearlo ni cambiar su comportamiento. Para conservar también el precierre de cada trabajador, se recomienda guardarlo antes del cierre diario.
- El flujo exige `Nube: sincronizado` antes de guardar cada turno; si otro teléfono guardó, debe recargarse la nube para evitar conflictos. **No promete colaboración simultánea** ni actualización automática del contenido en otro teléfono.
- La fecha operativa y los cierres después de medianoche mantienen **exactamente la lógica de Uki v8.15 original**, sin condiciones nuevas: un cierre que el panel considera del día anterior continúa siendo de ese día.
- **Pruebas:** `tests/precierre-locales.test.cjs`; 8 escenarios simulados aprobados. Sin lecturas/escrituras en Firebase real, sin tocar ventas auténticas.

**Importante:** antes de incorporarlo al panel que usa personal, validar en un entorno de prueba aislado el flujo real de lectura, escritura, cifrado y recarga de nube. No activar/pasar a producción sin autorización expresa y validación. No enviar enlaces de otros paneles como si fueran el panel original.
