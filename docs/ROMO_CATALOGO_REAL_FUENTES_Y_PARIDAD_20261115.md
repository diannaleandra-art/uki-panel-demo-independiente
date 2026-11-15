# Romo La Serena · fuente del catálogo y paridad con Uki

Fecha: 15 de noviembre de 2026. **Revisión de solo lectura** del repositorio real de la carta pública, su conexión Supabase y el documento de catálogo de Neon Romo. Sin modificar productos comerciales.

## Fuentes efectivas comprobadas

1. La carta Romo en `diannaleandra-art/romos-sushi-qa.`, rama `publicacion/romo-carta-whatsapp-20261114`, archivo `public/index.html`, consulta productos mediante la API REST `/rest/v1/romos_products` del proyecto Supabase `romos-sushi`, ref `awldmutolllpyucvhicc`. La clave incrustada es **publicable**; la seguridad depende de las políticas RLS de Supabase. El panel alternativo de esa carta utiliza acceso Supabase Auth, separado de Google Firebase del panel Uki.
2. La base independiente de Neon Romo `romos_sushi` tiene `public.romo_catalogo_v1`: un único documento de catálogo con `revision`, categorías, productos, ingredientes y promociones. El endpoint `api/romo-catalogo-lectura-qa.js` de la rama Preview permite exclusivamente leerlo con Google y los roles Neon de Romo. **No confirma que la carta pública lo utilice.**
3. La consulta de datos reales mostró **12 productos** en `public.romos_products` de Supabase y **7 productos** en el documento de Neon. Son dos representaciones distintas. Una escritura solo en Neon **no** actualizaría automáticamente el precio que ve el cliente en la carta pública.
4. Las políticas RLS de `romos_products` permiten consulta pública de productos disponibles y edición autenticada restringida a miembros de `romos_admins`. No se han relajado estas políticas.

## Decisión para el panel unificado
El editor de `Carta y precios` de la versión final Uki incluye categorías CRUD, precios, disponibilidad y armado. Para alcanzar la misma función en Romo hay que confirmar un guardado autorizado que actualice **la fuente consumida realmente por la carta** y que no consulte ni modifique las APIs de Uki. No activar la interfaz de edición de Romo sobre el documento aislado de Neon si ello daría una confirmación falsa al usuario. No copiar automáticamente el catálogo Neon encima de Supabase ni viceversa: podrían perderse productos, precios o categorías.

**Hasta conectar las fuentes y probar manualmente**, Romo conserva la consulta y el banner existentes. La carta pública y el registro comercial no se han modificado en esta auditoría.

## Edición de pedidos
Se mantuvo el mismo límite operativo previamente aplicado en el formulario de pedido pendiente de Romo: delivery entre **$1 y $4.000 CLP** cuando la modalidad es Delivery, y pedido de hasta **$3.000.000 CLP**. Los pedidos ya cobrados o de turnos cerrados no se editan desde ese procedimiento. El cambio no registra dinero ni cobros.
