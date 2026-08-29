# BRANDING_TEMPLATE_IMPLEMENTATION_PLAN.md — Clinic Branding, Letterhead & Consent Template Studio

Written before any code for this feature is touched, per the spec's explicit requirement. Extends the existing app audited in `REBUILD_AUDIT.md` (Phases 1–3) — nothing here rebuilds working functionality.

## 1. Current architecture (as of this audit)

**Stack.** Next.js 16 App Router, React 19, TypeScript, `pdf-lib`, Supabase (Postgres + Auth OTP + private Storage), Resend, Vercel, single Supabase project `qcwsmepvucxtqgqohuqe`.

**Tenancy.** One live clinic today (`DEFAULT_CLINIC_ID` env var, single hardcoded UUID). All server-side API routes (`app/api/consents`, `app/api/pdf`, `app/api/email-consent`) use the **service-role admin client** (`lib/supabase-server.ts`), not the caller's session — so today RLS is defense-in-depth, not the live enforcement path. Auth (`app/login`, `lib/use-session.ts`, `app/api/auth/bootstrap`) gates the UI via invite-only OTP sign-in and `clinic_users` membership, independent of RLS.

**Live tables** (from `list_tables`): `clinics`, `clinic_users`, `doctors`, `patients`, `consent_templates` (plain `version int`, `active bool`, nullable `clinic_id` for DentMemo global defaults), `consents` (fully denormalized snapshot columns — patient/doctor/procedure/consent body/acknowledgements/signature path — `template_id`/`template_version` FK+version pair for provenance, `pdf_storage_path`, `email_status`), `audit_events`, `clinic_invites`. Current row counts: 1 clinic, 2 clinic_users, 5 doctors, 7 patients, 8 default templates, 7 consents, 17 audit events, 9 invites — **must survive untouched**.

**RLS today** (`pg_policies`, all `security definer` via `is_clinic_member(clinic_id)`, execute revoked from `anon`): clinic-scoped SELECT/ALL policies on every table, global templates readable by everyone when `clinic_id is null`. No policies reference branding or template versions yet, obviously.

**Storage today.** Five buckets exist: `signatures`, `consent-pdfs`, `clinic-branding` (created this session, has one read policy keyed on `storage.foldername(name)[1]::uuid` = clinic id, but **no logo has ever been uploaded to it** — `fetchClinicLogo` in `app/api/pdf/route.ts` already looks for `clinics.logo_storage_path` there and no-ops gracefully if absent). Two legacy buckets (`dm-consent-branding`, `dm-consent-documents`) and their `private.dm_is_owner`/`private.dm_is_member` policies are dead leftovers from a prior unrelated build — **do not touch, do not reuse**, they belong to schema that was already dropped.

**PDF generation** (`app/api/pdf/route.ts`). Single-page-optimized `pdf-lib` document, drawn top-to-bottom with `ensure()`/`newPage()` pagination guards. Already has a `fetchClinicLogo()` helper with 4-second `Promise.race` timeouts on both the DB lookup and the storage download, wrapped in try/catch so a slow/missing logo never blocks generation — this is the exact shape branding-aware rendering should extend, not replace. Uploads to `consent-pdfs`, records `pdf_storage_path` + a `pdf_generated` audit event, only when `consentId` is present.

**Consent write path** (`app/api/consents/route.ts`). Find-or-create doctor/patient by name(+phone), atomic patient-code sequence via `next_patient_code` RPC, resolves the active global template row for provenance, uploads signature to `signatures`, inserts the consent snapshot, logs `consent_signed`.

## 2. Existing functionality (do not rebuild)

Wizard (`app/new/page.tsx`), signature capture, consent-ID generation, auto patient ID, auto age-from-DOB, OTP+invite login, automatic email send with live retry status, PDF checkbox rendering, one-page PDF layout, logo plumbing scaffold — all shipped and confirmed working. This feature adds branding/template management **around** that flow; the wizard's step structure and the consent write/PDF/email pipeline stay as-is except where explicitly extended below.

## 3. Database changes (additive only)

```sql
-- Branding: one row per *version*. Only one 'active' row per clinic at a time.
create table clinic_brand_profiles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  version int not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  letterhead_mode text not null check (letterhead_mode in ('generated','uploaded')),
  branding_style text check (branding_style in ('professional','minimal','compact')),
  clinic_display_name text,
  clinic_address text,
  clinic_phone text,
  accent_color text,
  logo_storage_path text,       -- uploaded-mode source image, private bucket path
  letterhead_asset_path text,   -- rendered/generated letterhead asset if pre-rendered
  created_by uuid references clinic_users(user_id),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  unique (clinic_id, version)
);
create unique index one_active_brand_per_clinic
  on clinic_brand_profiles (clinic_id) where status = 'active';

-- Templates: DentMemo default OR clinic-customized copy, versioned the same way.
create table consent_template_versions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id),      -- null = DentMemo global default
  base_template_slug text not null,           -- links customized copies back to the default family
  source_version_id uuid references consent_template_versions(id), -- 'duplicated from'
  version int not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  title text not null,
  body text not null,
  acknowledgements jsonb not null,
  created_by uuid references clinic_users(user_id),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  unique (clinic_id, base_template_slug, version)
);
create unique index one_active_template_per_clinic_slug
  on consent_template_versions (clinic_id, base_template_slug) where status = 'active';

-- Consents: record exactly which branding/template version produced this PDF.
alter table consents
  add column brand_profile_id uuid references clinic_brand_profiles(id),
  add column brand_profile_version int,
  add column template_version_id uuid references consent_template_versions(id),
  add column pdf_sha256 text;
```

Nothing here alters an existing column's type, drops anything, or rewrites a row. `consents.template_id`/`template_version` (the existing plain-`consent_templates` FK/version pair) stays exactly as-is for backward compatibility with the 7 signed consents; the new `template_version_id` is additive and only populated going forward. `consent_templates` (the existing plain table) is **left in place, untouched** — it continues to be the seed source for the wizard's built-in 8 templates; `consent_template_versions` is new and separate, since retrofitting version history onto a table with live FKs from 7 consents is unnecessary risk for zero benefit (the spec's own "don't overengineer" allowance).

## 4. Storage changes

Reuse the existing `clinic-branding` bucket (already created, already has a clinic-scoped read policy) — no new bucket needed. Path convention, versioned so an old branding version's files are never overwritten:

```
clinic-branding/{clinic_id}/{brand_profile_id}/logo.png
clinic-branding/{clinic_id}/{brand_profile_id}/letterhead.png   (generated-mode render, if pre-rendered)
```

No new bucket for templates — template content is plain text/JSON, stored in the DB column directly (small, versioned, queryable), consistent with the "no base64 blobs, but also no pointless object-storage indirection for plain text" rule.

## 5. RLS changes

Same `is_clinic_member(clinic_id)` pattern as every existing table:

- `clinic_brand_profiles`: SELECT + INSERT for clinic members (`is_clinic_member`); no UPDATE/DELETE policy at all — versions are immutable once created, status transitions (`draft`→`active`→`archived`) happen through a single service-role-only Postgres function (`activate_brand_profile`) so "activate" can atomically flip the old active row to `archived` and the new one to `active` in one transaction, which a same-row RLS UPDATE policy can't express safely against the partial-unique-index constraint.
- `consent_template_versions`: identical shape — SELECT for clinic members, global rows (`clinic_id is null`) readable by everyone (matches existing `consent_templates` global-read policy), INSERT for clinic members creating drafts, activation via the same kind of service-role function (`activate_template_version`).
- Storage: extend the existing `clinic-branding` bucket policy with an INSERT policy scoped the same way as the existing SELECT one (`bucket_id = 'clinic-branding' and is_clinic_member(foldername[1]::uuid)`), restricted to `authenticated` role. No public access anywhere.

## 6. UI changes

- `/settings/branding` — current active profile summary, "Create new version" form (generated: display name/address/phone/accent color/style picker with live preview; uploaded: logo file input), Activate button, version history list (read-only, shows which is currently active/archived).
- `/settings/templates` — list of the clinic's active template versions per base slug (falling back to the DentMemo default when the clinic has never customized one), "Duplicate & Customize" (creates a `draft` row with `source_version_id` set to the DentMemo default and `clinic_id` set), "Restore DentMemo Default" (creates a **new** clinic-scoped version copying the current DentMemo default's content — never deletes or rewrites the clinic's history), plain textarea editor for title/body/acknowledgements (per spec's own allowance — a rich editor is out of scope), Activate button.
- Both pages reuse the existing `useRequireSession()` guard and the app's existing CSS (`app/globals.css` card/button classes) rather than introducing a new UI kit.

## 7. PDF changes

`fetchClinicLogo` becomes `fetchActiveBrandProfile(clinicId)` returning the active `clinic_brand_profiles` row (same `withTimeout` + try/catch shape, same "never block generation" guarantee). The header-drawing block in `app/api/pdf/route.ts` becomes branding-aware: uploaded-mode draws the stored logo image exactly as today; generated-mode draws clinic name/address/phone/accent-colored rule using the profile's fields, no image. After `pdf.save()`, compute `crypto.createHash('sha256').update(bytes).digest('hex')` and store it in `consents.pdf_sha256` alongside the existing `pdf_storage_path` update — this is the historical-integrity anchor the spec requires (any later re-render can be checked against this hash to prove a signed PDF was never altered). The consent write path (`app/api/consents/route.ts`) resolves and freezes the clinic's *currently active* `brand_profile_id`/`version` and `template_version_id` at signing time, exactly like it already freezes `template_id`/`template_version` today — so a later branding or template change can never alter a past consent's rendering.

## 8. Template-versioning strategy

Every activation is a new row, never an UPDATE of `status='active'` content. "Restore DentMemo Default" and "Duplicate & Customize" are both just "create a new draft row, then activate it" — the same single code path, differing only in what `source_version_id`/`clinic_id` get set to. A consent always stores the specific `template_version_id` it was signed against, so template history is fully reconstructable per consent regardless of what the clinic does afterward.

## 9. Data migration / rollout strategy

Everything above is additive (`create table`, `alter table ... add column`, new storage paths under an already-existing bucket). No existing column is dropped, renamed, or retyped. Existing consents get `null` for all four new columns — the app must treat `null` branding/template-version on old consents as "predates this feature," never as an error. The one live clinic gets its first `clinic_brand_profiles` row seeded as `status='active', letterhead_mode='generated'` with sensible defaults (clinic name, no logo) so `fetchActiveBrandProfile` always has something to find post-migration, and its 8 existing `consent_templates` rows are left exactly as they are — `consent_template_versions` starts empty and is populated lazily the first time a clinic customizes or the seed script mirrors the 8 defaults in as global (`clinic_id null`) versioned rows for the Studio to display.

## 10. Risks / explicit scope trade-offs (documented, not silently dropped)

- **Generated letterhead is the primary path**; uploaded-logo mode reuses the already-built `fetchClinicLogo` pattern. PDF-file letterhead upload (as opposed to image) is not built in this pass — documented here as a fast-follow, per the spec's own allowance.
- **Save and Activate are combined** into one action in the UI (no separate "save draft, review, then activate" review step) — reduces UI surface for a single-clinic-admin use case; the underlying versioning still keeps every prior version intact.
- Both `activate_*` Postgres functions are `security definer`, callable only by an authenticated clinic member for their own clinic (checked inside the function body, mirroring `is_clinic_member`) — kept minimal, not a generic RPC surface.
- Audit events (`branding_activated`, `template_activated`) are inserted from these same functions, consistent with the existing `audit_events` pattern.

## 11. Implementation order

1. Migrations: `clinic_brand_profiles`, `consent_template_versions`, `consents` new columns, `activate_brand_profile`/`activate_template_version` functions, RLS policies, storage INSERT policy, seed the live clinic's first active brand profile and mirror the 8 default templates as global template versions.
2. `/settings/branding` UI + API routes.
3. `/settings/templates` UI + API routes.
4. PDF integration (branding header rendering + SHA-256 hashing) and consent-write-path freezing of `brand_profile_id`/`template_version_id`.
5. Verification: build/typecheck/tests, SQL-level Clinic-A-vs-Clinic-B RLS isolation check (same method used in Phase 2 addendum, since live HTTP testing from this sandbox is not possible per the network-egress limitation already documented in `REBUILD_AUDIT.md`), then `BRANDING_TEMPLATE_IMPLEMENTATION.md` write-up.
