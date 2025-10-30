-- Run in Supabase SQL editor or psql. Adjust schemas/policies to your environment.

-- Extensions needed for UUIDs and password hashing (bcrypt via pgcrypto)
create extension if not exists pgcrypto;

-- Application users (custom auth)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  full_name text,
  phone text,
  location text,
  password_hash text not null,
  email_verified boolean not null default false,
  email_verification_token text,
  email_verification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User sessions for cookie auth
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Patients master
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  device_id text unique,
  dob date,
  gender text check (gender in ('male','female','other')),
  address text,
  patient_email text,
  patient_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_email text,
  lat double precision,
  lng double precision,
  emergency boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure column exists when upgrading an existing DB
do $$ begin
  -- Ensure these columns exist for upgrades
  alter table public.patients add column if not exists patient_email text;
  alter table public.patients add column if not exists patient_phone text;
  alter table public.patients add column if not exists emergency_contact_name text;
  alter table public.patients add column if not exists emergency_contact_phone text;
  alter table public.patients add column if not exists emergency_contact_email text;
exception when duplicate_column then null; end $$;

create index if not exists idx_patients_device on public.patients(device_id);
create index if not exists idx_patients_geo on public.patients(lat,lng);
-- removed: marker linkage index (user_bin)

-- Vitals history (time-series)
create table if not exists public.patient_vitals (
  id bigserial primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  heart_rate smallint,
  spo2 real,
  body_temp real,
  room_temp real,
  room_humidity real,
  ecg real,
  fall_detected boolean default false
);

-- Ensure column exists when upgrading an existing DB
-- no marker linkage in vitals

create index if not exists idx_vitals_patient_time on public.patient_vitals(patient_id, recorded_at desc);
create index if not exists idx_vitals_time on public.patient_vitals(recorded_at desc);
-- removed: idx_vitals_user_bin

-- Alerts feed
create table if not exists public.alerts (
  id bigserial primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  alert_type text not null check (alert_type in ('spo2_low','hr_abnormal','fall','manual','other')),
  severity text not null check (severity in ('normal','warning','critical')),
  message text,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_patient_time on public.alerts(patient_id, created_at desc);
create index if not exists idx_alerts_time on public.alerts(created_at desc);

-- Optional: caregiver/user mapping (assumes Supabase auth.users)
create table if not exists public.patient_caregivers (
  user_id uuid not null references public.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('owner','caregiver','clinician','admin')),
  primary key (user_id, patient_id)
);

-- Latest vitals per patient (view)
create or replace view public.patient_latest_vitals as
select distinct on (pv.patient_id)
  pv.patient_id,
  pv.recorded_at,
  pv.heart_rate,
  pv.spo2,
  pv.body_temp,
  pv.room_temp,
  pv.room_humidity,
  pv.ecg,
  pv.fall_detected
from public.patient_vitals pv
order by pv.patient_id, pv.recorded_at desc;

-- Helper: simple status function
create or replace function public.classify_vitals(hr smallint, spo2 real, body_temp real, fall boolean)
returns text language sql immutable as $$
  select case
    when fall is true then 'critical'
    when spo2 is not null and spo2 < 90 then 'critical'
    when hr is not null and (hr < 50 or hr > 120) then 'warning'
    when body_temp is not null and (body_temp < 35 or body_temp > 38.5) then 'warning'
    else 'normal'
  end;
$$;

-- Combined view for map/dashboard
create or replace view public.patient_status as
select p.id,
       p.full_name,
       p.lat,
       p.lng,
       p.emergency,
       lv.recorded_at as last_updated,
       lv.heart_rate,
       lv.spo2,
       lv.body_temp,
       lv.room_temp,
       lv.room_humidity,
       lv.ecg,
       lv.fall_detected,
       public.classify_vitals(lv.heart_rate, lv.spo2, lv.body_temp, coalesce(p.emergency, false) or coalesce(lv.fall_detected, false)) as status
from public.patients p
left join public.patient_latest_vitals lv on lv.patient_id = p.id;

-- Updated timestamp trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_patients_updated on public.patients;
create trigger trg_patients_updated before update on public.patients
for each row execute function public.set_updated_at();

-- Admin accounts (separate from public.users)
create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  email text unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_accounts(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Seed a default admin as requested (username=admin, password=Admin@6849)
-- Note: stores a bcrypt hash using pgcrypto's blowfish (bf). Change cost as needed.
insert into public.admin_accounts (username, email, password_hash)
select 'admin', null, crypt('Admin@6849', gen_salt('bf', 10))
where not exists (select 1 from public.admin_accounts where username = 'admin');

-- Note: Add RLS policies for production as needed.
-- Example (uncomment and adapt):
-- alter table public.patients enable row level security;
-- create policy "caregivers can read" on public.patients
--   for select using (exists (select 1 from public.patient_caregivers pc where pc.patient_id = id and pc.user_id = auth.uid()));
-- create policy "admins can manage" on public.patients
--   for all using (exists (select 1 from public.patient_caregivers pc where pc.patient_id = id and pc.user_id = auth.uid() and pc.role='admin'));
