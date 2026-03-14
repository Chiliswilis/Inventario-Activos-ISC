-- ============================================
-- SGIAC-ISC | Schema completo corregido
-- Ejecutar en Supabase → SQL Editor
-- ============================================

-- 1. TIPO ENUM para roles
CREATE TYPE user_role AS ENUM ('administrador', 'docente', 'alumno');

-- 2. USUARIOS
CREATE TABLE public.users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  email         VARCHAR UNIQUE,
  role          user_role DEFAULT 'alumno',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. CATEGORÍAS
CREATE TABLE public.categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR NOT NULL,
  description TEXT,
  type        VARCHAR NOT NULL CHECK (type IN ('asset', 'consumable'))
);

-- 4. ACTIVOS
CREATE TABLE public.assets (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR NOT NULL,
  description   TEXT,
  category_id   INTEGER REFERENCES public.categories(id),
  serial_number VARCHAR UNIQUE,
  location      VARCHAR,
  status        VARCHAR DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance')),
  quantity      INTEGER DEFAULT 1 CHECK (quantity >= 0),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. CONSUMIBLES
CREATE TABLE public.consumables (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR NOT NULL,
  description  TEXT,
  category_id  INTEGER REFERENCES public.categories(id),
  quantity     INTEGER DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER DEFAULT 0 CHECK (min_quantity >= 0),
  unit         VARCHAR DEFAULT 'units',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. SOLICITUDES
CREATE TABLE public.requests (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER REFERENCES public.users(id),
  asset_id           INTEGER REFERENCES public.assets(id),
  consumable_id      INTEGER REFERENCES public.consumables(id),
  quantity_requested INTEGER DEFAULT 1 CHECK (quantity_requested > 0),
  status             VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned')),
  request_date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approval_date      TIMESTAMP,
  return_date        TIMESTAMP,
  notes              TEXT
);

-- 7. RESERVACIONES
CREATE TABLE public.reservations (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES public.users(id),
  lab_name   VARCHAR NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time   TIMESTAMP NOT NULL,
  status     VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  purpose    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. LOGS
CREATE TABLE public.logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES public.users(id),
  action     VARCHAR NOT NULL,
  table_name VARCHAR,
  record_id  INTEGER,
  details    TEXT,
  timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CATEGORÍAS INICIALES
-- ============================================
INSERT INTO public.categories (name, description, type) VALUES
('Equipos de Escritorio y Laptops',  'Torres, CPUs, monitores, laptops y cargadores',                         'asset'),
('Servidores',                        'Equipos de rack o torre para almacenamiento y procesamiento',            'asset'),
('Componentes Internos',              'CPUs, GPUs, RAM, HDD, SSD',                                             'asset'),
('Equipos de Conectividad',           'Routers, switches, hubs, firewalls, access points',                     'asset'),
('Infraestructura de Red',            'Racks, UPS, no-breaks, reguladores de voltaje',                         'asset'),
('Periféricos de Entrada/Salida',     'Teclados, ratones, impresoras, escáneres, cámaras web',                 'asset'),
('Almacenamiento Externo',            'Discos duros portátiles, unidades flash USB',                           'asset'),
('Multimedia',                        'Diademas, micrófonos, altavoces',                                       'asset'),
('Mobiliario',                        'Escritorios, sillas ergonómicas, estanterías, mesas de trabajo',        'asset'),
('Cables y Conectores',               'Cables UTP, HDMI, poder, conectores RJ45',                              'consumable'),
('Herramientas de Mantenimiento',     'Herramientas de limpieza, pasta térmica, destornilladores',             'consumable'),
('Servicios en la Nube',              'Suscripciones a plataformas de almacenamiento o servicios de terceros', 'consumable');