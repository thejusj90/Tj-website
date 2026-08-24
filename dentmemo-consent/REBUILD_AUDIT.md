# REBUILD_AUDIT.md — DentMemo Consent

Phase 1 audit of the reconstruction starter, produced before any further Supabase/auth/dashboard work. Written after inspecting every file in the ZIP, reading both reference artifacts (`references/DentMemo Digital Consent App.png`, `references/DC-2026-F4F3146E.pdf`), getting the starter building cleanly, and hardening the chairside flow.

## A. Current working functionality

Verified locally (`npm install && npm run build` clean; full workflow walked with Playwright on iPad-landscape and iPad-portrait viewports; zero console/runtime errors):

- Next.js 16 / React 19 app boots and builds with no TypeScript or hydration errors.
- 4-step wizard: Patient Details → Treatment → Consent → Sign & Submit.
- 8 seeded consent templates (root canal, extraction, implant, crown/bridge, restoration, scaling, orthodontics, photography/media) matching `CLAUDE_CODE_BRIEF.md`.
- Signature capture via Pointer Events (mouse, touch, stylus/Apple Pencil all use the same handler — `setPointerCapture`, `touch-action: none`), with Clear and resize-preserving canvas.
- Consent ID generation in `DC-YYYY-XXXXXXXX` format (`lib/consent-id.ts`), using `crypto.randomBytes` — cryptographically random, not sequential.
- Save → PDF → optional email pipeline in the correct order (save first, PDF next, email last, per the reliability rule in the brief). Save failure blocks the flow; PDF failure is reported but the saved record and consent ref remain valid; email failure is fully decoupled and retryable from the success screen.
- Local `localStorage` fallback when Supabase isn't configured, so the demo works with zero backend setup.
- Optional Supabase persistence (service-role insert/select) and optional Resend email delivery, both fail gracefully with clear user-facing messages when unconfigured.
- Consents list page reads from Supabase when configured, otherwise from `localStorage`.
- Server-rendered PDF (`pdf-lib`) matching the known reference PDF's structure: header, clinic name, title, patient/doctor/procedure/tooth metadata, wrapped consent body, acknowledgements with `[X]`/`[ ]` markers, embedded handwritten signature image (not a placeholder string), consent ID, signer, signed-at timestamp, and a footer with page number on every page. Multi-page pagination via an `ensure()`/`newPage()` height guard — verified with a 6x-length consent body.

## B. Reconstruction assumptions

The starter is explicitly a clean-room reconstruction (`README.md` says so directly), not recovered original source. Treated as assumption, not fact:

- The exact wording of the 8 default consent templates — plausible dental-consent language, but not verified against any original DentMemo copy. Flagged again in product philosophy below: **must be reviewed by each clinic's dental/legal advisor before production use**, not shipped as-is.
- The PDF's exact typography/spacing choices (font sizes, margins, colors) — inferred from the one sample PDF (`DC-2026-F4F3146E.pdf`), which is a **minimal/placeholder** sample (patient "Jjjj", doctor "DDDD", one-line squiggle signature) rather than a fully populated real document. The structure (header → metadata → body → signature/acknowledgements page → footer) is faithfully reproduced; exact pixel-level styling is a best-effort match to the reference mockup image, not a pixel copy.
- The visual mockup PNG shows a **single unified panel** combining patient/treatment summary + consent text + acknowledgements + signature on what appears to be one screen, while the written brief describes 4 distinct wizard steps. I kept the 4-step architecture (matches the explicit step list in `CLAUDE_CODE_BRIEF.md` and is easier to use one-handed at the chair) but made step 3 a genuine patient-readable consent screen (see Section D) rather than a plain edit form, closing most of the gap with the mockup's reading experience.

## C. Technical weaknesses (must fix before real patient data)

In priority order:

1. **Signature and PDF stored as base64 in the database**, not as private object storage. `supabase/schema.sql` has a `signature_data_url text` column holding the full data URL. This is fine for local demo, unacceptable for production: it bloats the row, defeats access control (anyone who can `select` the row gets the raw image), and there's no separate PDF storage at all — PDFs are generated on-demand and streamed, never persisted.
2. **No authentication whatsoever.** Every API route is anonymous; anyone with the URL can call `/api/consents` or read Supabase through the app if `NEXT_PUBLIC_SUPABASE_URL`/anon key were ever exposed for reads. There is no concept of a logged-in dentist or clinic session.
3. **No tenant isolation.** The `consents` table is a single flat table with a `clinic_name` free-text column, not a foreign key to a `clinics` table. RLS is enabled but *no policies exist* — the comment in `schema.sql` says so explicitly. All writes currently go through the service-role key, which bypasses RLS entirely, so in practice there is zero enforced isolation between clinics today.
4. **No immutable snapshot separation.** `consent_body`/`acknowledgements` are stored per-row (good — this *is* effectively a snapshot), but there's no `template_id`/`template_version` link back to a versioned template table, so there's no way to know which template version a consent traces to, or to reconstruct "what changed" if a clinic edits its wording later.
5. **No audit trail.** No `audit_events` table, no logging of consent_started/signed/pdf_generated/email_sent/downloaded/deleted events.
6. **No patient/doctor/clinic entities.** Patient, doctor, and clinic are all free-text snapshot fields on the consent row with no backing tables, no dedupe, no search-by-patient-history.
7. **No rate limiting or abuse protection** on any API route (an unauthenticated `/api/pdf` could be hammered to run `pdf-lib` generation repeatedly).
8. **`.env.local` / service role key handling** is currently correct (service role only touched server-side in `lib/supabase-server.ts`, never imported by client components) — this one is *not* a weakness, worth confirming explicitly.
9. **Consents list has no search/filter** (`app/consents/page.tsx` just lists the latest 100) — acceptable for Phase 1, insufficient for Phase 5 dashboard.
10. **No tests existed** in the starter at all. Added minimal unit coverage for the two purest modules (`lib/consent-id.ts`, `lib/templates.ts`) using Node's built-in test runner — see Section E.

## D. Proposed production architecture

**Frontend.** Keep Next.js App Router + React 19 + plain CSS (no framework bloat — the existing hand-written CSS in `app/globals.css` is small, fast, and matches the reference direction well). Split `app/new/page.tsx`'s ~400-line client component into the components already stubbed in the brief (`PatientDetailsStep`, `TreatmentStep`, `ConsentReviewStep`, `AcknowledgementList`) once Phase 2+ adds enough branching logic (template versioning, clinic branding) to justify it — premature to split now while it's still simple and every reviewer can read the whole flow in one file.

**Backend/API.** Keep Next.js route handlers, but move all business logic out of them into the service modules the brief specifies (`consent-service`, `pdf-service`, `email-service`, `storage-service`, `audit-service`, `template-service`) so routes stay thin (parse → call service → respond) and services stay testable without an HTTP layer.

**Auth.** Supabase Auth, Google + email magic link, no passwords. Onboarding creates `clinics` + `clinic_users` (owner role) + a `doctors` row for the primary dentist in one transaction (a Postgres function via `apply_migration`, called from a server route, service-role only).

**Database.** Full schema from Section 16 of the brief: `clinics`, `clinic_users`, `doctors`, `patients` (optional per-consent — a consent can reference a patient row *or* just carry a snapshot with no `patient_id`), `consent_templates` (nullable `clinic_id` for DentMemo global defaults, `version` int, `active` bool), `consents` (patient/treatment/consent snapshot columns exactly as specified, plus `template_id` + `template_version` FK/version pair), `audit_events`.

**RLS.** Every table gets `clinic_id`-scoped policies: `USING (clinic_id IN (SELECT clinic_id FROM clinic_users WHERE user_id = auth.uid()))` for select, similarly scoped for insert/update, keyed off `clinic_users`. Global default templates (`clinic_id IS NULL`) get a separate read-only-for-everyone policy. Service-role key stays server-only, used only for the two operations that must bypass RLS (clinic onboarding transaction, PDF/email background jobs) — everything else goes through the user's own authenticated Supabase client so RLS is the actual enforcement layer, not application-level filtering.

**Storage.** Two private Supabase Storage buckets: `signatures` and `consent-pdfs`, both keyed `{clinic_id}/{consent_id}/...`, both with RLS-equivalent storage policies scoped to clinic membership. The app never returns a public URL — it returns a short-lived `createSignedUrl` (e.g. 5 minute expiry) for download/view, generated server-side per request.

**PDF generation.** Keep `pdf-lib` — the current implementation already handles multi-page pagination, embedded signature images, and a proper footer cleanly, and switching to server-rendered HTML→PDF would be strictly heavier for no capability the brief actually needs (no complex layout requirements beyond what `pdf-lib` already does well here). Store the generated bytes to the `consent-pdfs` bucket immediately after generation rather than only streaming them to the client.

**Email.** Resend, unchanged provider choice. Move the send call server-side-only (currently the client base64-encodes and POSTs the PDF bytes it already has — fine for now, but once PDFs are stored server-side after signing, the email route should re-fetch the stored PDF by `consent_id` rather than trusting client-supplied bytes, closing a tampering vector).

**Audit trail.** `audit-service` inserts into `audit_events` at each of the events listed in Section 17 of the brief; called from the relevant service methods, not scattered through route handlers.

**Multi-clinic architecture.** `clinic_id` is the tenancy key everywhere. A clinic switcher is deferred (single-clinic-per-user is the common case for the target audience of independent dentists / small clinics) until multi-clinic membership is an actual user request.

## E. Migration strategy

**Retained as-is (proven, no rework needed):**
- Wizard step structure and validation logic (`canNext` per step).
- `lib/consent-id.ts` — the format and randomness are already production-appropriate.
- `lib/templates.ts` content and shape — becomes the seed data for the `consent_templates` table's global-default rows (`clinic_id = null`), not a code change, a data migration.
- `components/SignaturePad.tsx` — the Pointer Events handling, resize-preserving canvas, and touch-action:none are already correct for Apple Pencil/stylus/touch/mouse. No rework needed for Phase 2+.
- `app/api/pdf/route.ts`'s core drawing logic (wrap/ensure/footer helpers) — extract into `pdf-service` unchanged, just add the storage-upload step after `pdf.save()`.
- The reliability ordering (save → PDF → email, email failure never rolling back the save) — already correct, carry forward exactly.

**Replaced in Phase 2+:**
- `lib/supabase-server.ts`'s single service-role client → per-request authenticated client (RLS-driven) for user-facing reads/writes, service-role reserved for the two exceptions named above.
- `supabase/schema.sql`'s single flat `consents` table → the full relational schema in Section D, with a data-shape migration path (the existing columns map close to 1:1 onto the new `consents` table's snapshot columns, so this is additive, not a rewrite).
- `signature_data_url text` column → `signature_storage_path text` (bucket path, not bytes).
- Anonymous API routes → auth-gated route handlers reading the caller's Supabase session.

**New in Phase 2+ (nothing to migrate from, built fresh):** `clinics`/`clinic_users`/`doctors`/`patients`/`audit_events` tables, onboarding flow, dashboard, template management UI, storage buckets + signed-URL retrieval, RLS policies.

## Phase 1 changes made in this pass

Beyond confirming the starter builds and runs cleanly, the following were changed to close real gaps against the brief before calling Phase 1 done:

- **Step 3 ("Consent") now shows the patient a genuinely readable consent** — large title, 15.5px/1.75 line-height body text, max `62ch` width — instead of only an editable textarea. An "Edit wording" toggle keeps the dentist's ability to adjust text before handing the tablet over, without making that the default patient-facing view. (`app/new/page.tsx`, `app/globals.css` — the `.consentText`/`.consentReadTitle` classes existed in the stylesheet but were never used in markup; this was a real gap between the CSS and the UI.)
- **Signer name auto-fills from patient name** (editable, with a hint explaining when to change it for a parent/guardian/representative), per Section 29 of the master prompt.
- **Doctor field remembers recently used doctors** via a `<datalist>` backed by `localStorage`, so a clinic that mostly sees the same 1-2 dentists gets faster entry after the first consent.
- **Step 4 shows a specific "what's missing" hint** (e.g. "Before submitting, add: signature.") instead of just a disabled button with no explanation, per the error-handling requirement that users should always understand what happened.
- **Added a favicon** (`app/icon.svg`, Next.js file convention) — was a hard 404 on every page load.
- **Added `overscroll-behavior-y: contain`** to prevent pull-to-refresh interfering with signature capture on mobile Safari/Chrome.
- **Added unit tests** for `lib/consent-id.ts` (format, UTC-year correctness, uniqueness across 200 calls) and `lib/templates.ts` (all 8 procedures present, unique slugs, non-empty content, `getTemplate` fallback behavior) using Node's built-in test runner (`npm test`, `node --experimental-strip-types --test lib/*.test.ts` — zero new dependencies).
- **Verified** (Playwright, iPad-landscape 1024×768 and iPad-portrait 768×1024, touch-enabled): full flow from patient name entry through signature capture to "Consent completed" success screen, zero console/runtime errors, signer-name autofill working correctly.

## What's explicitly NOT done in this pass (by design — see the two AskUserQuestion exchanges at the start of this session)

- No Supabase project was created or connected — this repo location (`tj-website/dentmemo-consent/`, chosen because this session's GitHub access is scoped to `thejusj90/tj-website` only and the tooling needed to attach or create a separate repo was unavailable) has no live backend credentials.
- No Vercel deployment or `consent.dentmemo.in` DNS work — needs a real Vercel project and domain access.
- Phases 2–8 (Supabase persistence, auth, multi-tenant RLS, dashboard, template management, production hardening, deployment) are architected above but not implemented — they need live credentials this session doesn't have, per the user's explicit choice to scope this session to Phase 1 only.
