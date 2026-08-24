# DentMemo Consent — Reconstruction Starter

This is a clean-room reconstruction starter for the DentMemo digital dental consent workflow.

It is **not claimed to be the original lost source code**. It was rebuilt from the known product behavior and available DentMemo Consent artifacts so a coding agent such as Claude Code can continue the project.

## What is included

- Next.js 16 + React 19 app
- Responsive tablet/desktop/mobile consent wizard
- Patient details
- Treatment / tooth / doctor fields
- Treatment-specific consent templates
- Acknowledgement checkboxes
- Handwritten signature capture using canvas
- Consent reference generation (`DC-YYYY-XXXXXXXX`)
- Server-generated PDF using `pdf-lib`
- PDF download
- Optional Supabase persistence
- Optional Resend email delivery
- Local browser fallback storage for demo use
- Consent list/history page
- SQL schema for Supabase
- Claude Code rebuild brief

## Product flow

1. Patient Details
2. Treatment
3. Consent
4. Sign & Submit
5. Generate PDF
6. Save consent record
7. Optionally email PDF to clinic

The generated document follows the known DentMemo Consent structure:

- DentMemo Consent
- Clinic
- Consent title
- Patient
- Doctor
- Tooth
- Consent text
- Signature & Acknowledgements
- Consent ID
- Signer
- Signed timestamp
- Electronic handwritten signature note
- "Generated using DentMemo Consent"

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The app works in demo mode without Supabase. Records are kept in browser `localStorage`.
For production, configure Supabase.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Add these values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The starter API stores the record in `consents`. The signature is stored in the JSON payload in this starter for simplicity. Claude Code should move signatures/PDFs to private object storage before production.

## Email setup

Add a Resend API key and a verified sending domain:

```env
RESEND_API_KEY=...
CONSENT_FROM_EMAIL=consent@yourdomain.com
```

The email API accepts the PDF bytes from the app and sends them to the configured clinic email.

## Production hardening required

Before using this for real patient data:

- Add authenticated clinic accounts.
- Add strict tenant isolation / RLS.
- Store signatures and PDFs in private encrypted object storage.
- Add audit logs.
- Add explicit consent-template versioning.
- Add retention/deletion policy.
- Add backup/restore.
- Add clinic-configurable branding and doctor list.
- Add safer server-side validation and rate limiting.
- Review all consent wording with the clinic's dental/legal advisors.
- Do not treat generic template text in this starter as jurisdiction-specific legal advice.

## Deploy to Vercel

Create a new Vercel project from this folder/repository, add environment variables, deploy, then attach:

`consent.dentmemo.in`

## Recommended next instruction to Claude Code

Open `CLAUDE_CODE_BRIEF.md` and ask Claude Code to implement Phase 1 first, verify the full workflow locally, then proceed through the hardening checklist.
