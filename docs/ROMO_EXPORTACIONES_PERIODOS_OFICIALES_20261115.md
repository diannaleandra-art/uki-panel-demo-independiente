# Romo · exportaciones ajustadas al informe oficial de Uki

Fecha: 15 de noviembre de 2026.

La sección `Caja > Reportes` de Romo ya usa la función `vReportes()` de la última versión oficial de Uki, con filtros **Día**, **Semana** y **Mes**. El botón de exportar que ya existía todavía forzaba una semana incluso si la pantalla mostraba otro período.

Se corrigió la selección del rango en `ukiRomoExportarCajaQA`, únicamente para Romo, para utilizar el mismo día, semana o mes seleccionado y mostrar un título coherente. Los datos proceden de cierres definitivos confirmados en la revisión cifrada Neon Romo; el exportador valida la identidad del turno y rechaza duplicados. Los CSV y la vista imprimible PDF existentes no se sustituyen.

Este cambio es **solo consulta/exportación**, no registra pagos, saldos, cierres ni timbres. No habilita rectificaciones ni agrega nuevas funciones comerciales a la versión final de Uki.
