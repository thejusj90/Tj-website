# Claude Code Brief — Rebuild consent.dentmemo.in

## Objective

Rebuild **DentMemo Consent**, a fast digital consent tool for dental clinics.

Core promise:

> Dental consent. Signed in under a minute.

The workflow must feel extremely lightweight on an iPad/tablet at the dental chair.

This repository is a reconstruction starter, not the original source. Preserve the current working flow and improve it incrementally.

## Known product behavior

The user should be able to:

1. Start a new consent.
2. Enter patient details.
3. Select a dental procedure and optional tooth number.
4. Select/enter the doctor.
5. Show treatment-specific consent wording to the patient.
6. Let the patient confirm acknowledgements.
7. Capture handwritten signature with stylus or finger.
8. Submit.
9. Generate a clean PDF.
10. Save the consent.
11. Automatically or manually email the PDF to the doctor/clinic.
12. Search previously generated consents.

Known generated PDF structure:

- DentMemo Consent
- Clinic name
- Consent title
- Patient name
- Doctor
- Tooth
- Procedure-specific consent body
- Signature & Acknowledgements
- Consent reference in `DC-YYYY-XXXXXXXX` format
- Acknowledgement statements
- Signer
- Signed-at timestamp
- Note that handwritten signature was captured electronically
- "Generated using DentMemo Consent"

## Visual direction

Use the DentMemo product style:

- clean white / very light blue surfaces
- strong blue primary CTA
- dark navy text
- soft borders
- rounded cards
- generous whitespace
- professional clinical software, not a hospital ERP
- optimized for iPad landscape and portrait
- readable by patients at arm's length

The main wizard should visually communicate four steps:

1. Patient Details
2. Treatment
3. Consent
4. Sign & Submit

## Phase 1 — Make this starter fully operational

First, run the app and fix any compile/runtime issues.

Then verify:

- new consent flow works on desktop and mobile
- signature pad works with mouse, touch, Apple Pencil/stylus pointer events
- clear/sign-again works
- PDF generates correctly
- long consent text wraps across PDF pages
- consent ID is unique enough for practical use
- local fallback works without Supabase
- Supabase save works when configured
- consents list can display saved records
- email route works when Resend is configured
- failures are shown clearly to user

Do not redesign everything before making the full flow work.

## Phase 2 — Production data architecture

Use Supabase.

Suggested tables:

### clinics
- id uuid
- name
- email
- logo_url
- created_at

### clinic_users
- clinic_id
- user_id
- role

### doctors
- id
- clinic_id
- full_name
- registration_number
- email
- active

### patients
- id
- clinic_id
- patient_code
- full_name
- dob
- phone

### consent_templates
- id
- clinic_id nullable for DentMemo defaults
- slug
- title
- procedure
- body
- acknowledgements jsonb
- version
- active
- created_at

### consents
- id
- consent_ref
- clinic_id
- patient_id or patient snapshot
- doctor_id or doctor snapshot
- template_id
- template_version
- procedure
- tooth
- consent_body_snapshot
- acknowledgements_snapshot
- signature_storage_path
- pdf_storage_path
- signed_at
- created_by
- created_at

### audit_events
- id
- clinic_id
- consent_id
- actor_user_id
- event_type
- metadata
- created_at

Implement Row Level Security so clinics can never see one another's records.

## Phase 3 — Authentication and onboarding

Use Supabase Auth.

Required onboarding:

- Sign in with Google or email magic link.
- First login asks for clinic name, email, primary dentist.
- Create clinic membership.
- Returning users go directly to dashboard.
- Keep patient signing screen free of unnecessary navigation.

## Phase 4 — Consent templates

Keep default templates editable only by DentMemo admin; clinics may clone/customize.

Seed at least:

- Root Canal Treatment
- Tooth Extraction
- Dental Implant
- Crown / Bridge
- Filling / Restoration
- Scaling / Cleaning
- Orthodontic Treatment
- Dental Photography / Media Consent

Important:
Generic text is only starter content. Build template versioning because clinics may need their own reviewed language.

When a consent is signed, store the exact consent body and acknowledgement wording as immutable snapshots.

## Phase 5 — PDF quality

Improve the PDF into a professional, printable medical record:

Header:
DentMemo Consent
Clinic name
Consent title

Patient metadata:
Patient
Patient ID
DOB / age
Phone
Doctor
Procedure
Tooth
Date

Body:
Consent wording

Acknowledgements:
checked items

Signature:
render handwritten image
Signer
Signed date/time
Consent ID

Footer:
Consent ID — Page X
Generated using DentMemo Consent

Requirements:
- A4
- multi-page
- no clipping
- signature image not stretched
- timestamps stored UTC, displayed in clinic timezone
- PDF should be deterministic from the signed snapshot

## Phase 6 — Delivery

After submit:

- save record
- generate PDF
- store privately
- email doctor/clinic
- show success screen
- allow Download PDF
- allow Start another consent

Add retry state for email failure without losing the signed consent.

## Phase 7 — Dashboard

Dashboard should show:

- New Consent CTA
- Today's consents
- recent consents
- search by patient / consent ID / phone
- status: signed / email sent / email failed

Keep it intentionally narrow. This is not a full practice-management system.

## Security / privacy requirements

Treat this as sensitive patient data.

Do not expose service-role keys to browser code.
Do not put signatures/PDFs in public buckets.
Do not log patient details casually.
Use server routes for privileged operations.
Use private signed URLs for document retrieval.
Add audit events for:
- consent created
- signed
- PDF generated
- email sent
- downloaded
- deleted

## Product constraint

DentMemo Consent should remain a standalone product that can later integrate with the main DentMemo patient-memory app. Avoid coupling the core consent flow to unrelated DentMemo features.

## Domain / deployment target

Target production domain:

`consent.dentmemo.in`

Deploy on Vercel unless the owner explicitly chooses another platform.

## Definition of done for rebuild

A dentist on an iPad should be able to open the app, create a patient consent, hand the tablet to the patient, capture a signature, submit, and receive a professional PDF with no manual file handling.
