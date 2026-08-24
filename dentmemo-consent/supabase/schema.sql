-- DentMemo Consent — Phase 2 production schema.
-- This is the schema actually applied to the live Supabase project
-- (qcwsmepvucxtqgqohuqe, "DentMemo Product") as of Phase 2. Re-run this
-- against a fresh project to reproduce it.

create extension if not exists pgcrypto;

-- =========================================================
-- clinics
-- =========================================================
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  email text,
  phone text,
  address text,
  logo_storage_path text,
  timezone text not null default 'Asia/Kolkata',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- clinic_users (membership + role)
-- =========================================================
create table public.clinic_users (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'dentist', 'assistant', 'admin')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create index clinic_users_user_id_idx on public.clinic_users (user_id);

-- =========================================================
-- doctors
-- =========================================================
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  registration_number text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index doctors_clinic_id_idx on public.doctors (clinic_id);

-- =========================================================
-- patients (optional — a consent can exist without one)
-- =========================================================
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_code text,
  full_name text not null check (length(trim(full_name)) >= 2),
  dob date,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_clinic_id_idx on public.patients (clinic_id);
create index patients_full_name_idx on public.patients (lower(full_name));

-- =========================================================
-- consent_templates (clinic_id null = DentMemo global default)
-- =========================================================
create table public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  slug text not null,
  procedure text not null,
  title text not null,
  body text not null check (length(trim(body)) >= 40),
  acknowledgements jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, slug, version)
);

create index consent_templates_clinic_id_idx on public.consent_templates (clinic_id);
create index consent_templates_slug_idx on public.consent_templates (slug);

-- =========================================================
-- consents — immutable signed snapshot
-- =========================================================
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  consent_ref text not null unique,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  template_id uuid references public.consent_templates(id) on delete set null,
  template_version integer,

  -- patient snapshot (frozen at signing time)
  patient_name text not null,
  patient_id_snapshot text,
  patient_dob date,
  patient_age text,
  patient_phone text,

  -- treatment snapshot
  doctor_name text not null,
  procedure text not null,
  tooth text,

  -- consent snapshot
  consent_title text not null,
  consent_body text not null,
  acknowledgements jsonb not null default '[]'::jsonb,
  accepted_acknowledgements jsonb not null default '[]'::jsonb,

  -- signing
  signer_name text not null,
  signer_relationship text,
  signed_at timestamptz not null,
  signature_storage_path text not null,

  -- document
  pdf_storage_path text,

  -- delivery
  email_status text not null default 'not_applicable' check (email_status in ('not_applicable', 'pending', 'sent', 'failed')),
  email_sent_at timestamptz,
  email_error text,

  -- metadata
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index consents_clinic_id_idx on public.consents (clinic_id);
create index consents_signed_at_idx on public.consents (signed_at desc);
create index consents_patient_name_idx on public.consents (lower(patient_name));
create index consents_consent_ref_idx on public.consents (consent_ref);

-- =========================================================
-- audit_events
-- =========================================================
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  consent_id uuid references public.consents(id) on delete set null,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_clinic_id_idx on public.audit_events (clinic_id);
create index audit_events_consent_id_idx on public.audit_events (consent_id);

-- =========================================================
-- updated_at triggers
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clinics_set_updated_at before update on public.clinics
  for each row execute function public.set_updated_at();
create trigger patients_set_updated_at before update on public.patients
  for each row execute function public.set_updated_at();
create trigger consent_templates_set_updated_at before update on public.consent_templates
  for each row execute function public.set_updated_at();

-- =========================================================
-- RLS
-- =========================================================
alter table public.clinics enable row level security;
alter table public.clinic_users enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.consent_templates enable row level security;
alter table public.consents enable row level security;
alter table public.audit_events enable row level security;

-- helper: is the current user a member of this clinic?
create or replace function public.is_clinic_member(target_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_users
    where clinic_id = target_clinic_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_clinic_member(uuid) from public;
revoke execute on function public.is_clinic_member(uuid) from anon;
grant execute on function public.is_clinic_member(uuid) to authenticated;

create policy "clinic members can read their clinic" on public.clinics
  for select using (public.is_clinic_member(id));
create policy "clinic members can update their clinic" on public.clinics
  for update using (public.is_clinic_member(id));

create policy "clinic members can read their membership rows" on public.clinic_users
  for select using (public.is_clinic_member(clinic_id));

create policy "clinic members can manage their doctors" on public.doctors
  for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy "clinic members can manage their patients" on public.patients
  for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy "everyone can read global default templates" on public.consent_templates
  for select using (clinic_id is null);
create policy "clinic members can manage their templates" on public.consent_templates
  for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy "clinic members can read their consents" on public.consents
  for select using (public.is_clinic_member(clinic_id));
create policy "clinic members can create consents" on public.consents
  for insert with check (public.is_clinic_member(clinic_id));

create policy "clinic members can read their audit events" on public.audit_events
  for select using (public.is_clinic_member(clinic_id));

-- No public/anon policies anywhere. Until Supabase Auth is wired into the
-- app (Phase 3), all app access goes through the server-side service role,
-- which bypasses RLS by design. These policies are the enforcement layer
-- once authenticated clinic sessions exist.

-- =========================================================
-- storage buckets — private, path convention {clinic_id}/{consent_id}/...
-- =========================================================
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('consent-pdfs', 'consent-pdfs', false)
on conflict (id) do nothing;

create policy "clinic members can read their signatures"
  on storage.objects for select
  using (bucket_id = 'signatures' and public.is_clinic_member((storage.foldername(name))[1]::uuid));

create policy "clinic members can read their pdfs"
  on storage.objects for select
  using (bucket_id = 'consent-pdfs' and public.is_clinic_member((storage.foldername(name))[1]::uuid));

-- =========================================================
-- seed: 8 global default consent templates + one demo clinic/doctor
-- (used by the app until Phase 3 clinic onboarding replaces it —
-- see DEFAULT_CLINIC_ID in .env.example)
-- =========================================================
insert into public.consent_templates (clinic_id, slug, procedure, title, body, acknowledgements, version, active) values
(null, 'root-canal', 'Root Canal Treatment', 'Consent for Root Canal Treatment',
 'The reason for root canal treatment, the nature of the procedure, expected benefits, reasonable alternatives and material risks have been explained to me. I understand that treatment may require more than one visit and that a final restoration or crown may be recommended after the root canal. I understand that discomfort, swelling, instrument separation, persistent infection, fracture, perforation, the need for retreatment or surgery, and eventual loss of the tooth are possible even with appropriate care.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'extraction', 'Tooth Extraction', 'Consent for Tooth Extraction',
 'The reason for extraction and reasonable alternatives have been explained to me. I understand that risks can include pain, swelling, bleeding, infection, delayed healing, dry socket, damage to adjacent teeth or restorations, sinus involvement, altered sensation or numbness, and the possible need for additional treatment. I understand the importance of following post-operative instructions.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'implant', 'Dental Implant', 'Consent for Dental Implant Treatment',
 'The purpose and stages of dental implant treatment, alternatives, expected benefits and material risks have been explained to me. I understand that implant treatment may involve surgery and healing time, and that success depends on bone, gum health, hygiene and other biological factors. I understand risks may include infection, implant failure, bone loss, injury to nearby structures, altered sensation, sinus involvement and the need for further treatment.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'crown-bridge', 'Crown / Bridge', 'Consent for Crown / Bridge Treatment',
 'The reason for the proposed crown or bridge, the preparation required and reasonable alternatives have been explained to me. I understand that tooth preparation is irreversible and that temporary sensitivity, pulp irritation, the need for root canal treatment, fracture, loss of retention, gum irritation, shade limitations and the future need for repair or replacement may occur.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'restoration', 'Filling / Restoration', 'Consent for Dental Restoration',
 'The reason for the proposed filling or restoration and reasonable alternatives have been explained to me. I understand that sensitivity, discomfort, bite adjustment, fracture, recurrent decay, pulp irritation and the future need for root canal treatment, crown or replacement restoration may occur depending on the condition of the tooth.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'scaling', 'Scaling / Cleaning', 'Consent for Scaling / Dental Cleaning',
 'The purpose of scaling and dental cleaning has been explained to me. I understand that temporary sensitivity, gum bleeding, soreness and the exposure of spaces or root surfaces previously covered by deposits or inflamed tissue may occur. I understand that periodontal disease may require further treatment and maintenance.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'orthodontics', 'Orthodontic Treatment', 'Consent for Orthodontic Treatment',
 'The goals, expected duration, alternatives and limitations of orthodontic treatment have been explained to me. I understand that treatment depends on attendance, appliance care and oral hygiene. Risks can include discomfort, tooth decay, gum problems, root shortening, relapse, appliance breakage and the need for additional dental or surgical treatment.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions.","I understand that outcomes cannot be guaranteed."]'::jsonb, 1, true),

(null, 'media', 'Dental Photography / Media', 'Dental Photography / Media Consent',
 'The purpose and intended use of dental photographs or related media have been explained to me. I understand what information may be captured and the clinic has explained whether the media is intended for clinical records, education or another approved purpose. I have had an opportunity to ask questions before giving this consent.',
 '["I have read and understood the information above.","I have had an opportunity to ask questions."]'::jsonb, 1, true);

insert into public.clinics (id, name, email, timezone)
values ('00000000-0000-0000-0000-000000000001', 'Demo Dental Clinic', 'demo@dentmemo.in', 'Asia/Kolkata');

insert into public.doctors (id, clinic_id, full_name, active)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Dr. Blessin Mathew', true);
