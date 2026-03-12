-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assets (
  id integer NOT NULL DEFAULT nextval('assets_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  category_id integer,
  serial_number character varying UNIQUE,
  location character varying,
  status character varying DEFAULT 'available'::character varying CHECK (status::text = ANY (ARRAY['available'::character varying, 'borrowed'::character varying, 'maintenance'::character varying]::text[])),
  quantity integer DEFAULT 1 CHECK (quantity >= 0),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['asset'::character varying, 'consumable'::character varying]::text[])),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.consumables (
  id integer NOT NULL DEFAULT nextval('consumables_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  category_id integer,
  quantity integer DEFAULT 0 CHECK (quantity >= 0),
  min_quantity integer DEFAULT 0 CHECK (min_quantity >= 0),
  unit character varying DEFAULT 'units'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT consumables_pkey PRIMARY KEY (id),
  CONSTRAINT consumables_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.logs (
  id integer NOT NULL DEFAULT nextval('logs_id_seq'::regclass),
  user_id integer,
  action character varying NOT NULL,
  table_name character varying,
  record_id integer,
  details text,
  timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.requests (
  id integer NOT NULL DEFAULT nextval('requests_id_seq'::regclass),
  user_id integer,
  asset_id integer,
  consumable_id integer,
  quantity_requested integer DEFAULT 1 CHECK (quantity_requested > 0),
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'returned'::character varying]::text[])),
  request_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  approval_date timestamp without time zone,
  return_date timestamp without time zone,
  notes text,
  CONSTRAINT requests_pkey PRIMARY KEY (id),
  CONSTRAINT requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT requests_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.consumables(id)
);
CREATE TABLE public.reservations (
  id integer NOT NULL DEFAULT nextval('reservations_id_seq'::regclass),
  user_id integer,
  lab_name character varying NOT NULL,
  start_time timestamp without time zone NOT NULL,
  end_time timestamp without time zone NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'confirmed'::character varying, 'cancelled'::character varying]::text[])),
  purpose text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  email character varying UNIQUE,
  role USER-DEFINED DEFAULT 'alumno'::user_role,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);