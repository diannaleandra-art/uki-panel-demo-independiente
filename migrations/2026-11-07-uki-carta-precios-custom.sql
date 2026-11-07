-- Aditiva, sin cambios en tablas de inventario, ventas, caja ni cierres.
-- Ejecutar en Neon QA primero. Producción sólo al aprobar la próxima publicación.
CREATE TABLE IF NOT EXISTS public.uki_carta_productos_custom_v1 (
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 sku text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('pizza','dish')),
 group_key text NOT NULL CHECK (group_key IN ('pizzas','entradas')),
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
 description text NOT NULL DEFAULT '',
 price integer NOT NULL CHECK (price BETWEEN 1 AND 1000000),
 available boolean NOT NULL DEFAULT TRUE,
 version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
 updated_by text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (branch,sku),
 CHECK ((kind='pizza' AND group_key='pizzas' AND branch='arica') OR
        (kind='dish' AND group_key='entradas')),
 CHECK (char_length(sku) BETWEEN 4 AND 120)
);
