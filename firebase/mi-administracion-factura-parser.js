// Intérprete conservador de facturas chilenas: sugiere, nunca guarda automáticamente.
// Utilizado solo tras extracción local del texto de imagen o PDF.
export function interpretarFacturaChile(input){
  const lines=String(input||'').split(/\r?\n/).map(s=>s.replace(/\u00a0/g,' ').trim()).filter(Boolean);
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const out={fecha:null,proveedor:'',receptor:'',observacion:'',referencia:'',total:null,neto:null,iva:null,otros:null,descuento:null,productos:[],avisos:[]};
  if(!lines.length)return out;
  function amount(token){
    let s=String(token||'').replace(/\s/g,'').replace(/^\$/,'').replace(/^CLP/i,'').replace(/\$$/,'');
    if(!/^\d[\d.,]*$/.test(s))return null;
    // En CLP los importes suelen ser enteros con separadores de miles.
    if(/\d[.,]\d{1,2}$/.test(s)&&!/\d[.,]\d{3}$/.test(s)){
      const v=Number(s.replace(/\./g,'').replace(',','.'));
      return Number.isFinite(v)&&v>=0&&v<=1e9?Math.round(v):null;
    }
    const v=Number(s.replace(/[.,]/g,''));
    return Number.isSafeInteger(v)&&v>=0&&v<=1e9?v:null;
  }
  function moneyOnLine(raw,hasLabel=true){
    let s=String(raw||'');
    if(hasLabel)s=s.replace(/^\s*(?:monto|valor|importe|total|iva|neto|afecto|subtotal|exento|descuento|otros|recargo|flete|precio|a pagar|iva\s*\d+\s*%|19\s*%)\b[\s:.\-\t]*/i,'');
    // Un IVA de 19% no constituye una cifra monetaria.
    s=s.replace(/\b(?:\d{1,2})\s*%\s*/g,'');
    const tokens=s.match(/(?:\$|CLP\s*)?\s*\d[\d.,]*/gi)||[];
    const vals=tokens.map(amount).filter(x=>x!==null);
    return vals.length?vals[vals.length-1]:null;
  }
  function nearValue(i){
    let value=moneyOnLine(lines[i]);
    if(value!==null)return value;
    // PDF con etiqueta en una línea y valor en la siguiente.
    for(let j=i+1;j<=Math.min(i+2,lines.length-1);j++){
      const next=lines[j].trim();
      if(/^(?:\$|CLP\s*)?\s*\d[\d.,]*\s*$/i.test(next))return moneyOnLine(next,false);
      if(/[a-zA-Záéíóúñ]{3,}/.test(next))break;
    }
    return null;
  }
  function validDate(y,m,d){
    const iso=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const dt=new Date(iso+'T12:00:00Z');
    return !Number.isNaN(dt.getTime())&&dt.toISOString().slice(0,10)===iso?iso:null;
  }
  const noName=/\b(?:factura|electronica|boleta|rut|fecha|giro|direccion|sii|servicio de impuestos|telefono|telefonos|www\.|correo|monto|neto|total|subtotal|emision|comuna|vendedor)\b/;
  const initial=lines.slice(0,18).find(s=>/[a-zA-Záéíóúñ]{4,}/.test(s)&&!noName.test(norm(s))&&s.length>=5);
  if(initial){
    // El proveedor puede compartir la misma línea del PDF con el cuadro «N° 78969».
    out.proveedor=initial.split(/\s{2,}/)[0].replace(/\s+N[°ºo.]\s*\d{2,12}\s*$/i,'').trim().slice(0,120);
  }
  let docHeaderAt=-1;
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],line=norm(raw).replace(/\s+/g,' ');
    if(/\b(?:factura|boleta|documento tributario electronico)\b/.test(line)&&docHeaderAt<0)docHeaderAt=i;
    const receptor=raw.match(/señor\s*(?:\(es\))?\s*:\s*(.{3,140}?)(?:\s+RUT\s*:|$)/i);
    if(receptor)out.receptor=receptor[1].trim().slice(0,120);
    const obs=raw.match(/observaci[oó]n\s*:\s*(.{2,140})/i);
    if(obs)out.observacion=obs[1].trim().slice(0,140);
    const labeled=raw.match(/(?:raz[oó]n social|proveedor|emisor)\s*[:\-]\s*(.{3,120})/i);
    if(labeled&&!/\b(?:receptor|cliente)\b/i.test(raw))out.proveedor=labeled[1].trim().slice(0,120);
    const iso=raw.match(/\b(20\d{2})[\/-]([01]?\d)[\/-]([0-3]?\d)\b/);
    const dmy=raw.match(/\b([0-3]?\d)[\/\-.]([01]?\d)[\/\-.](20\d{2})\b/);
    // Facturas facturapy.me: «Coquimbo, 06 de Noviembre de 2026».
    const longDate=norm(raw).match(/\b([0-3]?\d)\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(20\d{2})\b/);
    if(longDate){
      const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
      const d=validDate(longDate[3],months[longDate[2]],longDate[1]);
      if(d)out.fecha=d;
    }
    if(/fecha|emisi[oó]n|documento|factura/i.test(raw)&&(iso||dmy)){
      const d=iso?validDate(iso[1],iso[2],iso[3]):validDate(dmy[3],dmy[2],dmy[1]);
      if(d)out.fecha=d;
    }else if(!out.fecha&&(iso||dmy)){
      const d=iso?validDate(iso[1],iso[2],iso[3]):validDate(dmy[3],dmy[2],dmy[1]);
      if(d)out.fecha=d;
    }
    // Folios pueden venir en la línea siguiente del encabezado, p.ej. «FACTURA ELECTRÓNICA» y «N° 78969».
    const direct=raw.match(/\b(?:factura|boleta)(?:\s+electr[oó]nica)?\s*(?:n[úu]mero|n[°ºo.]|no\.?|nro\.?|#|folio)\s*[:#.\-º°]*\s*(\d{2,12})\b/i)
      ||raw.match(/\b(?:folio|documento n[°ºo.]|n[úu]mero de factura)\s*[:#.\-º°]*\s*(\d{2,12})\b/i)
      ||raw.match(/\b(?:factura|boleta)(?:\s+electr[oó]nica)?\s+(\d{3,12})\b/i);
    const short=raw.match(/(?:^|\s)(?:n[°ºo.]|nro\.?|no\.?|n[úu]mero|#)\s*[:#.\-º°]*\s*(\d{2,12})\b/i);
    if(direct)out.referencia=direct[1];
    else if(short&&docHeaderAt>=0&&i<=docHeaderAt+8&&!out.referencia)out.referencia=short[1];
    if(!out.referencia&&docHeaderAt>=0&&i>=docHeaderAt&&i<=docHeaderAt+3&&/^\d{3,12}$/.test(line))out.referencia=line;
    // Facturas facturapy.me: encabezado de tres columnas y los tres importes debajo.
    if(/^neto\s+iva(?:\s*19\s*%)?\s+total$/.test(line)){
      const next=(lines[i+1]||'').replace(/\s+/g,' ').trim()
        .match(/^(\d[\d.,]*)\s+(\d[\d.,]*)\s+(\d[\d.,]*)$/);
      if(next){
        const vals=next.slice(1).map(amount);
        if(vals.every(v=>v!==null)){
          out.neto=vals[0];out.iva=vals[1];out.total=vals[2];
          i++;continue;
        }
      }
    }
    // Algunos PDF juntan «NETO 10.000 IVA 1.900 TOTAL 11.900» en una sola fila.
    const inlineNeto=line.match(/(?:^|\s)(?:monto\s+)?neto\s*[:$]?\s*(\d[\d.,]*)\b/);
    const inlineIva=line.match(/(?:^|\s)(?:i\.v\.a\.?|iva)(?:\s*19\s*%)?\s*[:$]?\s*(\d[\d.,]*)\b/);
    const inlineTotal=line.match(/(?:^|\s)(?:monto\s+)?total(?:\s+a pagar)?\s*[:$]?\s*(\d[\d.,]*)\b/);
    const several=[inlineNeto,inlineIva,inlineTotal].filter(Boolean).length;
    if(several>=2){
      if(inlineNeto){const v=amount(inlineNeto[1]);if(v!==null)out.neto=v;}
      if(inlineIva){const v=amount(inlineIva[1]);if(v!==null)out.iva=v;}
      if(inlineTotal){const v=amount(inlineTotal[1]);if(v!==null)out.total=v;}
      continue;
    }
    if(/\b(?:monto|valor|total|importe)\s*(?:a pagar|total|general|factura|del documento)\b/.test(line)
       ||/^total(?:\s*[:$]|$)/.test(line)
       ||/^total\s+(?:\$|clp)\b/.test(line)){
      if(!/\b(?:neto|iva|exento|descuento|unidad|item|productos|cantidad|documentos|folio)\b/.test(line)){
        const v=nearValue(i);if(v!==null)out.total=v;
      }
    }else if(/\b(?:monto neto|valor neto|total neto|neto afecto|neto|subtotal)\b/.test(line)&&!/\bdescuento\b/.test(line)){
      const v=nearValue(i);if(v!==null)out.neto=v;
    }else if(/(?:\biva\b|i\.v\.a\.?)/.test(line)&&!/\b(?:credito fiscal|iva incluido)\b/.test(line)){
      const v=nearValue(i);if(v!==null)out.iva=v;
    }else if(/\bdescuentos?\b/.test(line)){
      const v=nearValue(i);if(v!==null)out.descuento=v;
    }else if(/\b(?:otros cargos|recargo|flete)\b/.test(line)){
      const v=nearValue(i);if(v!==null)out.otros=v;
    }
    // Artículos en formatos comunes: «2 UN ARROZ 1.500 3.000» o «ARROZ 2 UN 1.500 3.000».
    const row=raw.replace(/\t/g,'  ').replace(/\s{2,}/g,' ');
    const tail=row.match(/^(.*?)\s+\$?\s*(\d[\d.,]*)\s+\$?\s*(\d[\d.,]*)\s*$/);
    if(tail){
      const a=amount(tail[2]),b=amount(tail[3]);
      let pre=tail[1].trim(),m,qty=null,unit='un',name='';
      const first=pre.match(/^(\d+(?:[.,]\d{1,3})?)\s+(?:(UN|UND|UNID|KG|GR|G|LT|L|ML|CAJA|PAQ|PACK)\s+)?(.{3,150})$/i);
      const last=pre.match(/^(.{3,150}?)\s+(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|UNID|KG|GR|G|LT|L|ML|CAJA|PAQ|PACK)?$/i);
      // Facturas Bombo: «QUESO GAUDA MOLFINO ... 3.44 Un 5.546 19.079».
      // La cantidad puede ser decimal y los artículos comienzan con su descripción.
      if(first){qty=Number(first[1].replace(',','.'));unit=first[2]?.toLowerCase()||'un';name=first[3].trim();}
      else if(last){qty=Number(last[2].replace(',','.'));unit=last[3]?.toLowerCase()||'un';name=last[1].trim();}
      if(qty>0&&qty<=100000&&a!==null&&b!==null&&name.length>=3
          &&Math.abs(Math.round(qty*a)-b)<=2
          &&!/factura|boleta|total|iva|neto|subtotal|rut|direccion|descuento|precio|cantidad|item|producto|importe|codigo|sii/i.test(name)){
        out.productos.push({nombre:name.slice(0,180),cantidad:String(qty),unidad:unit,precio_unitario:String(a),total:String(b)});
      }
    }
  }
  if(out.total===null&&out.neto!==null&&out.iva!==null)
    out.total=out.neto+out.iva+(out.otros||0)-(out.descuento||0);
  // No inventar neto ni IVA si la factura no trae un desglose reconocible.
  if(out.total===null)out.avisos.push('No se identificó el total de la factura.');
  if(!out.referencia)out.avisos.push('No se identificó el número de factura.');
  if(!out.productos.length)out.avisos.push('No se reconoció un listado de productos completo.');
  return out;
}
