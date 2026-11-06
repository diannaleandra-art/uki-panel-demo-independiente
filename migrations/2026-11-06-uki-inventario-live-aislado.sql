-- Migración aditiva exclusiva para inventario de producción.
-- No se modifica ninguna tabla preexistente, ni QR/carta/caja/pedidos.
-- Uki Sushi, Producción: módulo aislado sin modificar caja, carta ni pedidos.
-- Inventario separado del agendador. Código de 6 dígitos con PBKDF2, jamás literal.
CREATE TABLE IF NOT EXISTS public.uki_inventario_pin_live (
 id INTEGER PRIMARY KEY CHECK(id=1),
 salt TEXT NOT NULL,hash TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.uki_inventario_pin_intentos_live (
 branch TEXT NOT NULL CHECK(branch IN('arica','serena')),
 identity TEXT NOT NULL,fallos INTEGER NOT NULL DEFAULT 0,
 bloqueado_hasta TIMESTAMPTZ,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(branch,identity)
);
CREATE TABLE IF NOT EXISTS public.uki_inventario_revisiones_live (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 branch TEXT NOT NULL CHECK(branch IN('arica','serena')),
 request_id UUID NOT NULL,worker_name TEXT NOT NULL,identity TEXT NOT NULL,
 items JSONB NOT NULL,summary JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(branch,request_id)
);

-- Inventario de producción: tablas independientes de carta, caja y pedidos.
-- Insumos de inventario que NO se publican en la carta de clientes.
CREATE TABLE IF NOT EXISTS public.uki_inventario_extras_live (
  branch TEXT NOT NULL CHECK(branch IN ('arica','serena')),
  sku TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
  category TEXT NOT NULL CHECK(category IN ('ingrediente','envase','otro')),
  stock_unit TEXT NOT NULL CHECK(stock_unit IN ('un','kg','g','l','ml','porciones')),
  stock_qty NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(stock_qty>=0 AND stock_qty<=100000),
  min_stock_qty NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(min_stock_qty>=0 AND min_stock_qty<=100000),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(branch,sku)
);
CREATE UNIQUE INDEX IF NOT EXISTS uki_inventario_extras_live_name_branch_uq
  ON public.uki_inventario_extras_live (branch,lower(name));
CREATE TABLE IF NOT EXISTS public.uki_inventario_extras_movimientos_live (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL CHECK(branch IN('arica','serena')),
  sku TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN('conteo','entrada')),
  quantity NUMERIC(12,3) NOT NULL CHECK(quantity>=0),
  stock_after NUMERIC(12,3) NOT NULL CHECK(stock_after>=0),
  worker_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(branch,sku) REFERENCES public.uki_inventario_extras_live(branch,sku)
);

-- Uki Sushi · INVENTARIO LIVE aislado: sin ALTER en las tablas de carta ni pedidos.
CREATE TABLE IF NOT EXISTS public.uki_inventario_items_live (
 branch TEXT NOT NULL CHECK(branch IN ('arica','serena')),
 sku TEXT NOT NULL CHECK(sku LIKE 'ingredient:%'),
 name TEXT NOT NULL,
 stock_unit TEXT NOT NULL CHECK(stock_unit IN ('un','kg','g','l','ml','porciones')),
 stock_qty NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(stock_qty>=0 AND stock_qty<=100000),
 min_stock_qty NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(min_stock_qty>=0 AND min_stock_qty<=100000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(branch,sku)
);
CREATE TABLE IF NOT EXISTS public.uki_inventario_movimientos_live (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 branch TEXT NOT NULL CHECK(branch IN('arica','serena')),
 sku TEXT NOT NULL,
 accion TEXT NOT NULL CHECK(accion IN ('conteo','entrada')),
 cantidad_anterior NUMERIC(12,3),
 cantidad_nueva NUMERIC(12,3) NOT NULL,
 disponibilidad_anterior BOOLEAN,
 disponibilidad_nueva BOOLEAN,
 precio_anterior INTEGER,
 precio_nuevo INTEGER,
 realizado_por TEXT NOT NULL,
 rol TEXT NOT NULL,
 identidad_autorizada TEXT NOT NULL DEFAULT '',
 cantidad_ingresada NUMERIC(12,3),
 unidad_ingresada TEXT,
 cantidad_base NUMERIC(12,3),
 unidad_base TEXT,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uki_inventario_movimientos_live_b_s
 ON public.uki_inventario_movimientos_live(branch,sku,creado_en DESC);

-- Uki Sushi INVENTARIO LIVE: sólo tablas separadas, sin modificar QR/caja/carta.
-- Protección transaccional para facturas cargadas desde varios celulares.
CREATE TABLE IF NOT EXISTS public.uki_factura_lineas_live (
 branch TEXT NOT NULL CHECK (branch IN ('arica','serena')),
 rut_emisor TEXT NOT NULL,
 tipo_doc TEXT NOT NULL,
 folio TEXT NOT NULL,
 linea INTEGER NOT NULL CHECK (linea BETWEEN 1 AND 500),
 descripcion TEXT NOT NULL,
 sku TEXT NOT NULL,
 unidad_base TEXT NOT NULL CHECK (unidad_base IN ('un','kg','g','l','ml','porciones')),
 cantidad_factura_base NUMERIC(12,3) NOT NULL CHECK (cantidad_factura_base>0),
 cantidad_recibida_base NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (cantidad_recibida_base>=0),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(branch,rut_emisor,tipo_doc,folio,linea),
 CHECK (cantidad_recibida_base <= cantidad_factura_base)
);
CREATE TABLE IF NOT EXISTS public.uki_factura_recepciones_live (
 branch TEXT NOT NULL,
 rut_emisor TEXT NOT NULL,
 tipo_doc TEXT NOT NULL,
 folio TEXT NOT NULL,
 linea INTEGER NOT NULL,
 entrega INTEGER NOT NULL CHECK (entrega BETWEEN 1 AND 50),
 solicitud UUID NOT NULL UNIQUE,
 sku TEXT NOT NULL,
 cantidad_original NUMERIC(12,3) NOT NULL,
 unidad_original TEXT NOT NULL,
 cantidad_base NUMERIC(12,3) NOT NULL CHECK (cantidad_base>0),
 trabajador TEXT NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(branch,rut_emisor,tipo_doc,folio,linea,entrega),
 FOREIGN KEY(branch,rut_emisor,tipo_doc,folio,linea)
 REFERENCES public.uki_factura_lineas_live(branch,rut_emisor,tipo_doc,folio,linea)
);
CREATE INDEX IF NOT EXISTS uki_factura_recepciones_live_ultima
 ON public.uki_factura_recepciones_live (branch,rut_emisor,tipo_doc,folio,creado_en DESC);

-- Una única función, por línea y entrega: bloquea clave de factura y
-- actualiza stock+auditoría+recepción de manera ATÓMICA.
CREATE OR REPLACE FUNCTION public.uki_factura_recibir_live(
 p_branch TEXT, p_rut TEXT, p_tipo TEXT, p_folio TEXT, p_linea INTEGER,
 p_descripcion TEXT, p_sku TEXT, p_cantidad NUMERIC, p_unidad TEXT,
 p_base NUMERIC, p_limite NUMERIC, p_version INTEGER,
 p_trabajador TEXT, p_entrega INTEGER, p_solicitud UUID)
 RETURNS JSONB LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
 anterior RECORD;
 inventario RECORD;
 resto NUMERIC;
 nuevo NUMERIC;
 v_total NUMERIC;
 v_old NUMERIC;
 v_available BOOLEAN;
 v_precio INTEGER;
 v_id TEXT;
 v_unidad TEXT;
 v_sku TEXT;
 v_descripcion TEXT;
 v_limit NUMERIC;
 v_recibida NUMERIC;
 v_es_extra BOOLEAN;
BEGIN
 IF p_branch NOT IN ('arica','serena') OR p_rut !~ '^[0-9]{7,8}-[0-9K]$'
 OR p_tipo !~ '^[0-9]{2,3}$' OR p_folio !~ '^[0-9]{1,15}$'
 OR p_linea NOT BETWEEN 1 AND 500 OR p_entrega NOT BETWEEN 1 AND 50
 OR LENGTH(TRIM(p_descripcion)) NOT BETWEEN 3 AND 180
 OR LENGTH(TRIM(p_trabajador)) NOT BETWEEN 2 AND 60
 OR p_sku !~ '^[a-z0-9:-]{3,120}$'
 OR p_unidad NOT IN ('un','kg','g','l','ml','porciones')
 OR p_cantidad<=0 OR p_base<=0 OR p_limite<=0 OR p_limite>100000
 OR p_base>100000 OR p_version<0
 OR p_base<>ROUND(p_base,3) OR p_limite<>ROUND(p_limite,3)
 OR p_cantidad<>ROUND(p_cantidad,3) THEN
  RAISE EXCEPTION 'Datos de factura o unidades inválidos' USING ERRCODE='22023';
 END IF;
 IF p_solicitud IS NULL THEN RAISE EXCEPTION 'Falta identificador de recepción' USING ERRCODE='22023'; END IF;

 -- Serializa únicamente esta línea de esta factura, entre celulares.
 PERFORM pg_advisory_xact_lock(hashtextextended(
  p_branch||':'||p_rut||':'||p_tipo||':'||p_folio||':'||p_linea::TEXT,0));

 SELECT * INTO anterior FROM public.uki_factura_recepciones_live
 WHERE solicitud=p_solicitud;
 IF FOUND THEN
  IF anterior.branch<>p_branch OR anterior.rut_emisor<>p_rut OR
   anterior.tipo_doc<>p_tipo OR anterior.folio<>p_folio OR
   anterior.linea<>p_linea OR anterior.entrega<>p_entrega OR
   anterior.sku<>p_sku THEN
   RAISE EXCEPTION 'Identificador reutilizado en otra recepción' USING ERRCODE='23505';
  END IF;
  SELECT * INTO inventario FROM public.uki_factura_lineas_live
   WHERE branch=p_branch AND rut_emisor=p_rut AND tipo_doc=p_tipo
    AND folio=p_folio AND linea=p_linea;
  RETURN jsonb_build_object('duplicada',true,'guardada',true,'sku',p_sku,
   'recibida_total',inventario.cantidad_recibida_base,
   'restante',inventario.cantidad_factura_base-inventario.cantidad_recibida_base,
   'mensaje','Esta solicitud ya se registró. No se duplicó.');
 END IF;

 SELECT * INTO anterior FROM public.uki_factura_recepciones_live
 WHERE branch=p_branch AND rut_emisor=p_rut AND tipo_doc=p_tipo
 AND folio=p_folio AND linea=p_linea AND entrega=p_entrega;
 IF FOUND THEN
  RAISE EXCEPTION 'Esta entrega ya fue registrada en esta factura. No se volvió a sumar.' USING ERRCODE='23505';
 END IF;

 SELECT * INTO inventario FROM public.uki_factura_lineas_live
 WHERE branch=p_branch AND rut_emisor=p_rut AND tipo_doc=p_tipo
 AND folio=p_folio AND linea=p_linea FOR UPDATE;
 IF FOUND THEN
  IF inventario.sku<>p_sku OR inventario.unidad_base IS DISTINCT FROM
  (SELECT CASE WHEN p_sku LIKE 'inv:%' THEN e.stock_unit ELSE c.stock_unit END
   FROM (SELECT 1) d
   LEFT JOIN public.uki_inventario_extras_live e ON p_sku LIKE 'inv:%' AND e.branch=p_branch AND e.sku=p_sku
   LEFT JOIN public.uki_inventario_items_live c ON p_sku NOT LIKE 'inv:%' AND c.branch=p_branch AND c.sku=p_sku)
  OR LOWER(REGEXP_REPLACE(inventario.descripcion,'\s+',' ','g'))<>
     LOWER(REGEXP_REPLACE(TRIM(p_descripcion),'\s+',' ','g'))
  OR inventario.cantidad_factura_base<>p_limite THEN
   RAISE EXCEPTION 'El artículo, la descripción o el total facturado cambiaron. Revisa antes de continuar.' USING ERRCODE='22023';
  END IF;
  v_total=inventario.cantidad_recibida_base;
 ELSE v_total=0;
 END IF;
 IF v_total+p_base>p_limite THEN
  RAISE EXCEPTION 'La cantidad supera el saldo pendiente de la factura; no se sumó inventario.' USING ERRCODE='22023';
 END IF;

 v_es_extra=(p_sku LIKE 'inv:%');
 IF v_es_extra THEN
  SELECT * INTO anterior FROM public.uki_inventario_extras_live
   WHERE branch=p_branch AND sku=p_sku FOR UPDATE;
  IF NOT FOUND OR anterior.stock_unit NOT IN ('un','kg','g','l','ml','porciones')
   OR anterior.version<>p_version OR anterior.stock_qty+p_base>100000 THEN
   RAISE EXCEPTION 'Inventario modificado o artículo sin configurar. Actualiza y comprueba la unidad.' USING ERRCODE='40001';
  END IF;
  v_old=anterior.stock_qty;v_unidad=anterior.stock_unit;
  UPDATE public.uki_inventario_extras_live SET stock_qty=stock_qty+p_base,
  version=version+1,updated_by=p_trabajador,updated_at=NOW()
  WHERE branch=p_branch AND sku=p_sku
  RETURNING stock_qty,version INTO nuevo, resto;
  INSERT INTO public.uki_inventario_extras_movimientos_live
   (branch,sku,action,quantity,stock_after,worker_name,cantidad_ingresada,unidad_ingresada,unidad_base)
  VALUES(p_branch,p_sku,'entrada',p_base,nuevo,p_trabajador,p_cantidad,p_unidad,v_unidad);
 ELSE
  SELECT * INTO anterior FROM public.uki_inventario_items_live
   WHERE branch=p_branch AND sku=p_sku AND kind='ingredient' FOR UPDATE;
  IF NOT FOUND OR anterior.version<>p_version OR anterior.stock_qty+p_base>100000 THEN
   RAISE EXCEPTION 'Inventario modificado o ingrediente sin configurar. Actualiza la lista.' USING ERRCODE='40001';
  END IF;
  v_old=anterior.stock_qty;v_unidad=anterior.stock_unit;
  v_available=true;v_precio=NULL;
  UPDATE public.uki_inventario_items_live SET stock_qty=stock_qty+p_base,
    version=version+1,updated_by=p_trabajador||' (trabajador)',
    updated_at=NOW()
    WHERE branch=p_branch AND sku=p_sku
    RETURNING stock_qty,version INTO nuevo, resto;
  INSERT INTO public.uki_inventario_movimientos_live
    (branch,sku,accion,cantidad_anterior,cantidad_nueva,
     disponibilidad_anterior,disponibilidad_nueva,precio_anterior,precio_nuevo,
     realizado_por,rol,identidad_autorizada,cantidad_ingresada,unidad_ingresada,cantidad_base,unidad_base)
  VALUES (p_branch,p_sku,'entrada',v_old,nuevo,v_available,v_available,
   v_precio,v_precio,p_trabajador,'trabajador','inventario:factura-qa',
   p_cantidad,p_unidad,p_base,v_unidad);
 END IF;

 -- p_base ya fue convertido y VALIDADO por el servidor antes de entrar a la función.
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar el inventario' USING ERRCODE='40001'; END IF;
 IF v_total=0 THEN
  INSERT INTO public.uki_factura_lineas_live
   (branch,rut_emisor,tipo_doc,folio,linea,descripcion,sku,unidad_base,cantidad_factura_base,cantidad_recibida_base)
  VALUES(p_branch,p_rut,p_tipo,p_folio,p_linea,TRIM(p_descripcion),p_sku,v_unidad,p_limite,p_base);
 ELSE
  UPDATE public.uki_factura_lineas_live
   SET cantidad_recibida_base=cantidad_recibida_base+p_base,actualizado_en=NOW()
   WHERE branch=p_branch AND rut_emisor=p_rut AND tipo_doc=p_tipo
     AND folio=p_folio AND linea=p_linea;
 END IF;
 INSERT INTO public.uki_factura_recepciones_live
  (branch,rut_emisor,tipo_doc,folio,linea,entrega,solicitud,sku,
   cantidad_original,unidad_original,cantidad_base,trabajador)
 VALUES(p_branch,p_rut,p_tipo,p_folio,p_linea,p_entrega,p_solicitud,p_sku,
        p_cantidad,p_unidad,p_base,p_trabajador);

 RETURN jsonb_build_object('duplicada',false,'guardada',true,
  'item',jsonb_build_object('sku',p_sku,'stock_qty',nuevo,'stock_unit',v_unidad,'version',resto),
  'recibida_total',v_total+p_base,'restante',p_limite-v_total-p_base,
  'entrega',p_entrega);
END $$;
-- Conexión de QA tiene la propiedad de la función; otros roles no pueden ejecutarla.
REVOKE ALL ON FUNCTION public.uki_factura_recibir_live(
 TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,INTEGER,TEXT,INTEGER,UUID)
 FROM PUBLIC;
