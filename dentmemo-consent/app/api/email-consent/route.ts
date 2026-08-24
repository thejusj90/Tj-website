import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const DEFAULT_CLINIC_ID =
  process.env.DEFAULT_CLINIC_ID || "00000000-0000-0000-0000-000000000001";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONSENT_FROM_EMAIL;

  const body = await request.json();
  const { to, patientName, consentRef, consentId, pdfBase64 } = body;

  if (!to || !pdfBase64 || !consentRef) {
    return NextResponse.json({ error: "Missing email fields." }, { status: 400 });
  }

  if (!apiKey || !from) {
    await recordEmailStatus(consentId, "failed", "Email delivery is not configured.");
    return NextResponse.json(
      { error: "Email delivery is not configured. Add RESEND_API_KEY and CONSENT_FROM_EMAIL." },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from,
    to,
    subject: `DentMemo Consent - ${patientName || consentRef}`,
    text: `Attached is the signed DentMemo consent ${consentRef}.`,
    attachments: [
      {
        filename: `${consentRef}.pdf`,
        content: pdfBase64,
      },
    ],
  });

  if (result.error) {
    await recordEmailStatus(consentId, "failed", result.error.message);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  await recordEmailStatus(consentId, "sent", null);
  return NextResponse.json({ ok: true, id: result.data?.id });
}

async function recordEmailStatus(consentId: string | undefined, status: "sent" | "failed", error: string | null) {
  if (!consentId) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("consents")
    .update({
      email_status: status,
      email_sent_at: status === "sent" ? new Date().toISOString() : null,
      email_error: error,
    })
    .eq("id", consentId);

  await supabase.from("audit_events").insert({
    clinic_id: DEFAULT_CLINIC_ID,
    consent_id: consentId,
    event_type: status === "sent" ? "email_sent" : "email_failed",
    metadata: error ? { error } : {},
  });
}
