/**
 * Proyección idéntica para lectura pública y cotizador del servidor.
 * Solo los cambios del catálogo Romo, sin responsable, clientes ni pagos.
 * Fuente: tabla de ediciones Romo con revisión CAS y hash de carta base.
 */
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const MONEY=x=>Number.isSafeInteger(x)&&x>=1&&x<=1000000;
export function construirFeedRomoQA(base,vista){
 if(!OBJ(base)||base.storeId!==STORE||base.brand!=='romo'||
    base.source!=='carta-aprobada-en-codigo'||base.readOnly!==true||
    !Array.isArray(base.products)||base.products.length!==40||
    !OBJ(vista)||vista.storeId!==STORE||!Array.isArray(vista.products)||
    vista.products.length<base.products.length||vista.products.length>110||
    !Number.isSafeInteger(vista.revision)||vista.revision<1||
    !/^[a-f0-9]{64}$/.test(vista.baseSha256||''))
   throw Error('Fuentes de catálogo Romo no verificadas');
 const originals=new Map(base.products.map(p=>[p.sku,p]));
 if(originals.size!==base.products.length)throw Error('SKUs de carta duplicados');
 const changes=[],seen=new Set(),customProducts=[],customSeen=new Set();
 for(const item of vista.products){
  const previous=originals.get(item?.sku);
  if(!previous&&item?.custom===true){
   if(!/^dish:romoq-[a-f0-9-]{36}$/.test(item.sku)||!MONEY(item.price)||customSeen.has(item.sku))throw Error('Producto nuevo inválido');
   customSeen.add(item.sku);customProducts.push({sku:item.sku,id:item.sourceId,kind:'dish',name:item.name,price:item.price,description:item.description,categoriaSlug:item.categoriaSlug,available:item.available,...(item.originalPrice?{originalPrice:item.originalPrice}:{})});
   continue;
  }
  if(!previous||seen.has(item.sku)||!MONEY(item.price)||
     !MONEY(previous.price)||item.kind!==previous.kind||
     item.sourceId!==previous.sourceId)
    throw Error('El producto no corresponde a la carta Romo');
  seen.add(item.sku);
  const row={sku:item.sku,kind:item.kind,id:item.sourceId,
    basePrice:previous.price,baseName:previous.name};
  for(const k of ['price','available','name','description','categoriaSlug','originalPrice'])
   if(item[k]!==previous[k])row[k]=item[k];
  if(Object.keys(row).length>5)changes.push(row);
 }
 if(seen.size!==originals.size)throw Error('Faltan productos Romo');
 const customCategories=(vista.categories||[]).filter(c=>/^romoq-[a-f0-9-]{36}$/.test(c.slug)).map(c=>({slug:c.slug,nombre:c.nombre}));
 return Object.freeze({
  ok:true,storeId:STORE,readOnly:true,revision:vista.revision,
  baseSha256:vista.baseSha256,baseCount:base.products.length,changes,...(customCategories.length||customProducts.length?{customCategories,customProducts}:{}),
  ...(vista.publishedPromotions?.length?{customPromotions:vista.publishedPromotions}:{}),
  ...(vista.ingredientConfig?{ingredientConfig:vista.ingredientConfig}:{}),
  archivedProducts:[...(vista.archivedProducts||[])],
  archivedCategories:[...(vista.archivedCategories||[])],
  ...(Object.keys(vista.originalPromoConfigs||{}).length?{originalPromoConfigs:vista.originalPromoConfigs}:{}),
  status:'qa_solo_lectura_no_habilita_pedidos'
 });
}
