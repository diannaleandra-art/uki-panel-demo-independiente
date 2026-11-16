/**
 * Comparación SIN ESCRITURAS entre el código aprobado de la carta Romo
 * y el documento incompleto romo_catalogo_v1 de Neon Romo.
 *
 * IMPORTANTE: que un producto no tenga equivalente en Neon no significa
 * que deba crearse, eliminarse ni cambiar su precio automáticamente.
 * Un contrato de lectura NO habilita el editor.
 */
const STORE='romo:serena';
function intPrice(n){return Number.isSafeInteger(n)&&n>=0&&n<=1000000;}
const label=p=>({sku:p.sku,nombre:p.name,precio:p.price,categoria:p.categoriaSlug});
export function compararCatalogosAprobadosRomoQA(carta,neon){
  if(carta?.storeId!==STORE||carta?.readOnly!==true||!Array.isArray(carta.products)||
     neon?.storeId!==STORE||neon?.readOnly!==true||!Array.isArray(neon.catalogo?.products))
    throw new Error('Comparación prohibida fuera de los catálogos Romo');
  const catalogoCarta=new Map();
  for(const p of carta.products){
    if(!p||typeof p.sku!=='string'||catalogoCarta.has(p.sku)||!intPrice(p.price))
      throw new Error('Carta Romo inválida o con SKUs repetidos');
    catalogoCarta.set(p.sku,p);
  }
  const productosPanel=new Map();
  for(const p of neon.catalogo.products){
    if(!p||typeof p.sku!=='string'||productosPanel.has(p.sku)||!intPrice(p.price))
      throw new Error('Catálogo Neon Romo inválido o repetido');
    productosPanel.set(p.sku,p);
  }
  const coincidentes=[],diferencias=[],sinCorrespondencia=[];
  for(const p of carta.products){
    // ÚNICO mapa verificado entre ambas fuentes: promociones clásicas por piezas.
    // Premium, mensual, gohan, extras, burger, toppings y categorías no se
    // equiparan por nombre ni se insertan por iniciativa del comparador.
    const currentSku=p.kind==='classic'?'romo:piezas:'+p.sourceId:null;
    if(!currentSku){
      sinCorrespondencia.push(label(p));
      continue;
    }
    const existente=productosPanel.get(currentSku);
    if(!existente){
      diferencias.push({...label(p),tipo:'falta_promocion_clasica',skuNeon:currentSku});
    }else if(existente.price!==p.price){
      diferencias.push({...label(p),tipo:'precio_distinto',skuNeon:currentSku,
        precioNeon:existente.price});
    }else{
      coincidentes.push({skuCarta:p.sku,skuNeon:currentSku,precio:p.price});
    }
  }
  const categoriasCarta=Array.isArray(carta.categories)?carta.categories.length:0;
  const categoriasNeon=Array.isArray(neon.catalogo.categories)?neon.catalogo.categories.length:0;
  return Object.freeze({
    ok:true,storeId:STORE,readOnly:true,sinCambios:true,
    fuenteCarta:carta.source,revisionNeon:neon.revision,
    totalProductosCarta:carta.products.length,
    totalProductosNeon:neon.catalogo.products.length,
    categoriasCarta,categoriasNeon,
    promocionesClasicasCoincidentes:coincidentes,
    promocionesClasicasConDiferencias:diferencias,
    restoDeCartaSinEquivalenciaVerificada:sinCorrespondencia,
    // Solo referencia de cobertura, jamás una instrucción de sincronización.
    editorHabilitable:false,
    mensaje:'La carta aprobada continúa independiente. No sustituir por el catálogo Neon.'
  });
}
