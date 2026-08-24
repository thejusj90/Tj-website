create extension if not exists pgcrypto;

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  consent_ref text not null unique,
  clinic_name text not null,
  clinic_email text,
  patient_name text not null,
  patient_id text,
  dob date,
  age text,
  phone text,
  doctor text not null,
  procedure text not null,
  tooth text,
  template_slug text not null,
  consent_title text not null,
  consent_body text not null,
  acknowledgements jsonb not null default '[]'::jsonb,
  accepted_acknowledgements jsonb not null default '[]'::jsonb,
  signer_name text not null,
  signature_data_url text not null,
  signed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists consents_signed_at_idx
  on public.consents (signed_at desc);

create index if not exists consents_patient_name_idx
  on public.consents (lower(patient_name));

-- IMPORTANT:
-- This starter uses a server-side service role to write records.
-- Before production, migrate to clinic/user tables and enable strict RLS.
alter table public.consents enable row level security;

-- No public policies are intentionally created here.
-- Production access should be through authenticated, tenant-aware server routes.
