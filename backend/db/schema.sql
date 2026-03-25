-- ============================================================
-- SGIAC-ISC · Migración Fase 1
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. TABLA labs (centraliza todos los laboratorios)
CREATE TABLE IF NOT EXISTS public.labs (
  id          SERIAL PRIMARY KEY,
  edificio    VARCHAR NOT NULL,
  nombre      VARCHAR NOT NULL,
  capacidad   INTEGER DEFAULT 30,
  open_time   TIME    NOT NULL DEFAULT '07:00',
  close_time  TIME    NOT NULL DEFAULT '22:00',
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(edificio, nombre)
);

-- Datos iniciales (ampliar según necesidad)
INSERT INTO public.labs (edificio, nombre, capacidad, open_time, close_time) VALUES
  ('Edificio A', 'Laboratorio de Ciencias Básicas', 35, '07:00', '21:00'),
  ('Edificio A', 'Laboratorio A',                   30, '07:00', '21:00'),
  ('Edificio B', 'Laboratorio A',                   30, '07:00', '21:00'),
  ('Edificio B', 'Laboratorio B',                   25, '07:00', '21:00')
ON CONFLICT (edificio, nombre) DO NOTHING;

-- 2. TABLA request_items (multi-ítem por solicitud)
CREATE TABLE IF NOT EXISTS public.request_items (
  id                  SERIAL PRIMARY KEY,
  request_id          INTEGER NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  asset_id            INTEGER REFERENCES public.assets(id),
  consumable_id       INTEGER REFERENCES public.consumables(id),
  quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  return_condition    VARCHAR CHECK (return_condition IN ('bueno','dañado','perdido')),
  replacement_serial  VARCHAR,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA reservation_consumables (multi-consumible por reserva)
CREATE TABLE IF NOT EXISTS public.reservation_consumables (
  id                  SERIAL PRIMARY KEY,
  reservation_id      INTEGER NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  consumable_id       INTEGER NOT NULL REFERENCES public.consumables(id),
  quantity_requested  INTEGER NOT NULL DEFAULT 1 CHECK (quantity_requested > 0),
  quantity_delivered  INTEGER,
  leftover_qty        INTEGER,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ALTER requests: nuevos campos
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS purpose        TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by    INTEGER REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at    TIMESTAMP;

-- Ampliar el CHECK de request_type para incluir 'laboratorio'
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_request_type_check;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_request_type_check
  CHECK (request_type IN ('asset','consumable','laboratorio'));

-- 5. ALTER reservations: agregar lab_id FK, mantener columnas legacy como nullable
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS lab_id INTEGER REFERENCES public.labs(id);

-- Poblar lab_id desde los datos existentes (si los hay)
UPDATE public.reservations r
SET lab_id = l.id
FROM public.labs l
WHERE l.edificio = r.edificio AND l.nombre = r.laboratorio
  AND r.lab_id IS NULL;

-- Las columnas edificio/laboratorio/consumable_id/consumable_cantidad/consumable_entrega
-- quedan en la tabla pero se dejan de usar en código nuevo.
-- entrada_fecha/salida_fecha también se ocultan en UI pero no se borran (histórico).

-- 6. ALTER assets: condición y valor 'dañado' en status
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS condition_notes TEXT;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_status_check
  CHECK (status IN ('available','borrowed','maintenance','damaged'));

-- 7. ALTER users: límites de préstamo
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS max_active_loans    INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_consumable_qty  INTEGER DEFAULT 10;

-- 8. ALTER logs: tipo e id de ítem
ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS item_type VARCHAR,
  ADD COLUMN IF NOT EXISTS item_id   INTEGER;

-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================