import { NextResponse } from "next/server";
import { createConsentRef } from "@/lib/consent-id";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { ConsentForm } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as ConsentForm;

  if (!body.patientName?.trim() || !body.doctor?.trim() || !body.consentBody?.trim()) {
    return NextResponse.json({ error: "Missing required consent fields." }, { status: 400 });
  }

  if (!body.signatureDataUrl?.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "A handwritten signature is required." }, { status: 400 });
  }

  if (!body.acceptedAcknowledgements?.every(Boolean)) {
    return NextResponse.json({ error: "All acknowledgements must be accepted." }, { status: 400 });
  }

  const signedAt = body.signedAt || new Date().toISOString();
  const consentRef = body.consentRef || createConsentRef();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      persisted: false,
      consentRef,
      signedAt,
    });
  }

  const { error } = await supabase.from("consents").insert({
    consent_ref: consentRef,
    clinic_name: body.clinicName,
    clinic_email: body.clinicEmail || null,
    patient_name: body.patientName,
    patient_id: body.patientId || null,
    dob: body.dob || null,
    age: body.age || null,
    phone: body.phone || null,
    doctor: body.doctor,
    procedure: body.procedure,
    tooth: body.tooth || null,
    template_slug: body.templateSlug,
    consent_title: body.consentTitle,
    consent_body: body.consentBody,
    acknowledgements: body.acknowledgements,
    accepted_acknowledgements: body.acceptedAcknowledgements,
    signer_name: body.signerName,
    signature_data_url: body.signatureDataUrl,
    signed_at: signedAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    persisted: true,
    consentRef,
    signedAt,
  });
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ persisted: false, records: [] });
  }

  const { data, error } = await supabase
    .from("consents")
    .select("consent_ref, patient_name, doctor, procedure, tooth, signed_at")
    .order("signed_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = (data || []).map((row) => ({
    consentRef: row.consent_ref,
    patientName: row.patient_name,
    doctor: row.doctor,
    procedure: row.procedure,
    tooth: row.tooth,
    signedAt: row.signed_at,
  }));

  return NextResponse.json({ persisted: true, records });
}
