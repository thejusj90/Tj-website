# BRANDING_TEMPLATE_IMPLEMENTATION.md — Clinic Branding, Letterhead & Consent Template Studio

What was actually built, following the plan in `BRANDING_TEMPLATE_IMPLEMENTATION_PLAN.md`. Nothing existing was rebuilt or rewritten — this is additive on top of the app documented in `REBUILD_AUDIT.md`.

## Database

Two new tables, both versioned (a new row per change, never an in-place edit of an already-active row):

- **`clinic_brand_profiles`** — one row per branding version. `status` is `draft`/`active`/`archived`; a partial unique index (`one_active_brand_per_clinic`) guarantees at most one `active` row per clinic. `letterhead_mode` is `generated` (clinic name/address/phone/accent color, drawn as text) or `uploaded` (a logo image). Every version's fields are frozen forever once created.
- **`consent_template_versions`** — one row per template version, keyed by `(clinic_id, base_template_slug, version)`. `clinic_id is null` rows are DentMemo's global defaults (seeded from the existing 8 templates); `clinic_id` set rows are a clinic's customized copies. Same partial-unique-active-row pattern (`one_active_template_per_clinic_slug`) scoped to `(clinic_id, base_template_slug)`.
- **`consents`** gained four new nullable columns: `brand_profile_id`, `brand_profile_version`, `template_version_id`, `pdf_sha256`. All four are frozen at signing time — a later branding or template change never touches a past consent's row or PDF. Existing consents keep `null` here (they predate the feature).

The existing `consent_templates` table (plain version-int, no history) is untouched and still seeds the wizard's built-in defaults — `consent_template_versions` is a separate, additive table, not a migration of it, since retrofitting history onto a table with live FKs from 7 signed consents was unnecessary risk.

Two `security definer` helper functions (`activate_brand_profile`, `activate_template_version`) exist for direct authenticated-client use in the future; the shipped API routes perform the archive-then-activate swap directly with the service-role client instead (same trust boundary the existing `/api/consents` and `/api/pdf` routes already operate in), since those functions gate on `auth.uid()` which a service-role call has none of. Both paths insert `audit_events` (`branding_activated`, `template_activated`).

## RLS

Same `is_clinic_member(clinic_id)` pattern used by every existing table. `clinic_brand_profiles` and `consent_template_versions` allow SELECT and draft-only INSERT for clinic members; there is deliberately no UPDATE/DELETE policy, since the app never modifies a version in place — the only way from `draft` to `active` is the service-role activation path described above. `consent_template_versions` additionally lets everyone read global (`clinic_id is null`) rows, mirroring the existing `consent_templates` global-read policy.

## Storage

No new bucket — the `clinic-branding` bucket created in an earlier pass (with a clinic-scoped read policy already in place, but no write policy) now has an INSERT policy scoped identically. Logo files land at `clinic-branding/{clinic_id}/{brand_profile_id}/logo.{png|jpg}` — a fresh path per version, so an old version's logo is never overwritten by a newer upload.

## UI

- **`/settings/branding`** — shows the active version, a form to create+activate a new one (generated fields or a logo upload), and a read-only version history table.
- **`/settings/templates`** — one card per procedure showing whichever version is currently active for the clinic (its own customization, or the DentMemo default). "Duplicate & customize" opens a plain-textarea editor (title/body/one-acknowledgement-per-line) and saves+activates a new clinic version on submit. "Restore DentMemo default" (shown only once a clinic has customized a slug) creates a new clinic version copying the current global default's content and activates it — it never deletes the clinic's history.

Both pages reuse `useRequireSession()` and the existing card/button CSS classes; no new UI kit was introduced.

## PDF integration

`app/api/pdf/route.ts`'s old `fetchClinicLogo` became `fetchActiveBrandProfile` (same `Promise.race` 4-second-timeout, try/catch-swallowed shape, so a slow or missing branding row still never blocks a consent from generating). The header now draws the active profile's logo (uploaded mode) or clinic name/address/phone/accent color (generated mode), falling back to the old plain "DentMemo Consent" header when a clinic has no active profile yet — not an error state. After `pdf.save()`, a SHA-256 hash of the final bytes is computed and stored in `consents.pdf_sha256` alongside the existing `pdf_storage_path` — the historical-integrity anchor: any later re-render of the same consent can be hash-compared to prove the signed document was never altered.

`app/api/consents/route.ts` now resolves and freezes the clinic's currently-active `brand_profile_id`/`brand_profile_version` and the selected procedure's currently-active `template_version_id` (clinic override, or global default) at the moment of signing — the same "freeze at signing" pattern the route already used for `template_id`/`template_version`.

## Historical integrity, verified

Simulated directly against the live schema (`qcwsmepvucxtqgqohuqe`): created a second `clinic_brand_profiles` draft, ran the archive-then-activate swap, and confirmed exactly one `active` row remains and the prior version stayed intact as `archived` — the partial unique index and the swap logic hold. Tenant isolation itself was not re-tested with a throwaway second clinic (avoided to keep from adding noise to production data); both new tables use the exact same `is_clinic_member(clinic_id)` predicate already proven correct for every other table in the Phase 2 addendum, so no new isolation logic was introduced to test.

## Verification performed

- `npm run build` — clean, no TypeScript errors, all new routes (`/api/branding`, `/api/templates`, `/settings/branding`, `/settings/templates`) compiled.
- `npm test` — all 7 existing unit tests still pass (untouched).
- `mcp__Supabase__get_advisors` (security) — no new findings beyond the same "authenticated-role can call a security-definer RPC" pattern already present and accepted for `is_clinic_member`/`next_patient_code`; explicitly revoked `anon` execute on both new activation functions.
- Live SQL simulation of the consent write path's new joins (branding + template version resolution) against the real schema.

**Not verified from this session** (same network-egress limitation documented in `REBUILD_AUDIT.md`'s Phase 2/3 addenda): an actual HTTP round trip exercising the new UI pages and API routes against the deployed app. `npm run build`/`npm test` are clean; the first real test of `/settings/branding` and `/settings/templates` — including the logo file upload — should be on the live Vercel deployment.

## Scope trade-offs (documented, not silently dropped)

- Uploaded letterhead supports PNG/JPEG images only; PDF-file letterhead upload is not built.
- "Save" and "Activate" are one combined action — there is no separate draft-review step before a new version goes live.
- The template editor is a plain textarea, not a rich-text editor.

These match the trade-offs already called out in the implementation plan's own scope section.
