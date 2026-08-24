# Vercel Deployment Checklist

1. Put this project in a Git repository.
2. Import the repository into Vercel.
3. Framework preset: Next.js.
4. Add environment variables:
   - NEXT_PUBLIC_APP_URL
   - NEXT_PUBLIC_CLINIC_NAME
   - NEXT_PUBLIC_CLINIC_EMAIL
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - RESEND_API_KEY
   - CONSENT_FROM_EMAIL
5. Deploy.
6. In Vercel Project → Settings → Domains, add:
   - consent.dentmemo.in
7. Update DNS for the `consent` subdomain as Vercel instructs.
8. Verify:
   - tablet signing
   - PDF download
   - database persistence
   - email delivery
   - mobile layout
   - no service role key in browser bundle
9. Add authentication/RLS before real multi-clinic use.
