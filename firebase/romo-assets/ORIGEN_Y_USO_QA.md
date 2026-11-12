# Fotos originales reutilizadas de la carta previa Romo — QA

Fuente: `diannaleandra-art/romos-sushi-qa.`, archivo `public/index.html` en main. Sin fotos generadas por IA.

| Archivo | Procedencia | Uso aprobado en QA |
|---|---|---|
| `logo-original.jpg` | logo del encabezado y pie | logo de Romo |
| `portada-sushi.jpg` | imagen de portada sushi real | encabezado / portada |
| `promo-foto-1.jpg` a `promo-foto-4.jpg` | secuencia de cuatro fotos del carrusel de promociones | **candidatas**, no asignadas a SKU |

La carta antigua utiliza `romosRealPhotos[i%romosRealPhotos.length]`, por lo que la foto que veía un cliente dependía de la posición de la promoción, NO de un producto identificado. Para evitar correspondencias falsas, no asignar ninguna foto a una promoción concreta hasta verificar su SKU.

La foto de cabecera y el logo se conservaron; un logo duplicado en el HTML fue guardado sólo una vez. Todos estos recursos están únicamente en la rama privada de pruebas, no están enlazados a la carta pública ni a pedidos.
