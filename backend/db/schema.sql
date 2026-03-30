-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assets (
  id integer NOT NULL DEFAULT nextval('assets_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  category_id integer,
  serial_number character varying UNIQUE,
  location character varying,
  status character varying DEFAULT 'available'::character varying CHECK (status::text = ANY (ARRAY['available'::character varying, 'borrowed'::character varying, 'maintenance'::character varying, 'damaged'::character varying]::text[])),
  quantity integer DEFAULT 1 CHECK (quantity >= 0),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  condition_notes text,
  area character varying DEFAULT 'sistemas'::character varying CHECK (area::text = ANY (ARRAY['sistemas'::character varying, 'laboratorio'::character varying]::text[])),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['asset'::character varying, 'consumable'::character varying]::text[])),
  area character varying,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.consumables (
  id integer NOT NULL DEFAULT nextval('consumables_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  category_id integer,
  min_quantity integer DEFAULT 0 CHECK (min_quantity >= 0),
  unit character varying DEFAULT 'units'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  quantity integer DEFAULT 0 CHECK (quantity >= 0),
  expiry_date date,
  location character varying DEFAULT 'Lab. Ciencias Básicas'::character varying,
  CONSTRAINT consumables_pkey PRIMARY KEY (id),
  CONSTRAINT consumables_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.labs (
  id integer NOT NULL DEFAULT nextval('labs_id_seq'::regclass),
  edificio character varying NOT NULL,
  nombre character varying NOT NULL,
  capacidad integer DEFAULT 30,
  open_time time without time zone NOT NULL DEFAULT '07:00:00'::time without time zone,
  close_time time without time zone NOT NULL DEFAULT '22:00:00'::time without time zone,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT labs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.logs (
  id integer NOT NULL DEFAULT nextval('logs_id_seq'::regclass),
  user_id integer,
  action character varying NOT NULL,
  table_name character varying,
  record_id integer,
  details text,
  timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  item_type character varying,
  item_id integer,
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.request_items (
  id integer NOT NULL DEFAULT nextval('request_items_id_seq'::regclass),
  request_id integer NOT NULL,
  asset_id integer,
  consumable_id integer,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  return_condition character varying CHECK (return_condition::text = ANY (ARRAY['bueno'::character varying, 'dañado'::character varying, 'perdido'::character varying]::text[])),
  replacement_serial character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT request_items_pkey PRIMARY KEY (id),
  CONSTRAINT request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id),
  CONSTRAINT request_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT request_items_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id)
);
CREATE TABLE public.requests (
  id integer NOT NULL DEFAULT nextval('requests_id_seq'::regclass),
  user_id integer,
  asset_id integer,
  consumable_id integer,
  quantity_requested integer DEFAULT 1 CHECK (quantity_requested > 0),
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'pending_admin'::character varying, 'approved'::character varying, 'rejected'::character varying, 'returned'::character varying]::text[])),
  request_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  approval_date timestamp without time zone,
  return_date timestamp without time zone,
  notes text,
  pickup_date timestamp without time zone,
  pickup_location character varying DEFAULT 'Laboratorio de Sistemas A'::character varying,
  docente_id integer,
  incident boolean DEFAULT false,
  incident_cause text,
  incident_solution text,
  admin_message text,
  request_type character varying DEFAULT 'asset'::character varying CHECK (request_type::text = ANY (ARRAY['asset'::character varying, 'consumable'::character varying, 'laboratorio'::character varying]::text[])),
  purpose text,
  rejected_by integer,
  rejected_reason text,
  rejected_at timestamp without time zone,
  CONSTRAINT requests_pkey PRIMARY KEY (id),
  CONSTRAINT requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT requests_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id),
  CONSTRAINT requests_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.users(id),
  CONSTRAINT requests_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id)
);
CREATE TABLE public.reservation_consumables (
  id integer NOT NULL DEFAULT nextval('reservation_consumables_id_seq'::regclass),
  reservation_id integer NOT NULL,
  consumable_id integer NOT NULL,
  quantity_requested integer NOT NULL DEFAULT 1 CHECK (quantity_requested > 0),
  quantity_delivered integer,
  leftover_qty integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reservation_consumables_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_consumables_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id),
  CONSTRAINT reservation_consumables_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id)
);
CREATE TABLE public.reservations (
  id integer NOT NULL DEFAULT nextval('reservations_id_seq'::regclass),
  alumno_id integer NOT NULL,
  docente_id integer NOT NULL,
  edificio character varying NOT NULL CHECK (edificio::text = ANY (ARRAY['Edificio A'::character varying, 'Edificio B'::character varying]::text[])),
  laboratorio character varying NOT NULL,
  grupo character varying,
  semestre character varying,
  encargado_grupo character varying,
  fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  fecha_uso date NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  proposito text NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'occupied'::character varying, 'released'::character varying, 'cancelled'::character varying]::text[])),
  docente_message text,
  entrada_fecha timestamp without time zone,
  entrada_nota text,
  salida_fecha timestamp without time zone,
  salida_nota text,
  consumable_id integer,
  consumable_cantidad integer,
  consumable_entrega time without time zone,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  lab_id integer,
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id),
  CONSTRAINT reservations_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.users(id),
  CONSTRAINT reservations_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id),
  CONSTRAINT reservations_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  email character varying UNIQUE,
  role USER-DEFINED DEFAULT 'alumno'::user_role,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  max_active_loans integer DEFAULT 3,
  max_consumable_qty integer DEFAULT 10,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);