import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONSENT_FROM_EMAIL;

  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Email delivery is not configured. Add RESEND_API_KEY and CONSENT_FROM_EMAIL." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { to, patientName, consentRef, pdfBase64 } = body;

  if (!to || !pdfBase64 || !consentRef) {
    return NextResponse.json({ error: "Missing email fields." }, { status: 400 });
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
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.data?.id });
}
