# 14-11-2026 — ruta 404 corregida para pruebas Romo

La ruta antigua /firebase/uki-sushi-local.html devolvía 404 porque el proyecto Vercel sirve los archivos estáticos de public/, no los HTML de firebase/.

Se añadió en la rama interna `preparacion/uki-romo-sobre-main-20261114` una copia QA del panel bajo `public/romo-panel-qa/index.html`, con 23 dependencias cliente existentes sin alterarlas, un adaptador de rutas internas y el módulo de sesión Romo. Es una copia de prueba del MISMO panel, no otro panel de producción.

La URL de acceso es `/romo-panel-qa/?sucursal=romo-serena`. No modificar la ruta de la carta comercial o de Uki. Las rutas de pedidos, caja, inventario y cierres de Romo siguen cerradas; las opciones de Vercel solo permiten el alta de la prueba cifrada de clave y lectura del catálogo en preview. Se agregó aviso visible de "no registrar pedidos ni caja" y segundo render al terminar de cargar módulos para mostrar el formulario de alta.

**Verificar manualmente en iPhone**: página y recursos abren, cuenta Google de Uki, respaldo cifrado legítimo y alta del verificador. Nunca enviar archivos o claves a ChatGPT. Si falla Firebase Authorized Domains, solicitar permiso preciso; no sortear controles de autenticación. No se realizaron pruebas automáticas funcionales, ni cambios de datos, ni publicación productiva.