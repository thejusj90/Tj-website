import { NextResponse } from "next/server";
import { createConsentRef } from "@/lib/consent-id";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getTemplate } from "@/lib/templates";
import type { ConsentForm } from "@/lib/types";

const DEFAULT_CLINIC_ID =
  process.env.DEFAULT_CLINIC_ID || "00000000-0000-0000-0000-000000000001";

async function findOrCreateDoctor(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  clinicId: string,
  fullName: string
) {
  const name = fullName.trim();
  const { data: existing } = await supabase
    .from("doctors")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("full_name", name)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("doctors")
    .insert({ clinic_id: clinicId, full_name: name })
    .select("id")
    .single();

  if (error) return null;
  return created.id as string;
}

async function findOrCreatePatient(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  clinicId: string,
  body: ConsentForm
) {
  const name = body.patientName.trim();
  if (!name) return null;

  let query = supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("full_name", name);

  if (body.phone?.trim()) {
    query = query.eq("phone", body.phone.trim());
  }

  const { data: existing } = await query.limit(1).maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      full_name: name,
      patient_code: body.patientId?.trim() || null,
      dob: body.dob || null,
      phone: body.phone?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return null;
  return created.id as string;
}

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

  const consentId = crypto.randomUUID();
  const clinicId = DEFAULT_CLINIC_ID;

  const [doctorId, patientId] = await Promise.all([
    findOrCreateDoctor(supabase, clinicId, body.doctor),
    findOrCreatePatient(supabase, clinicId, body),
  ]);

  const template = getTemplate(body.templateSlug);
  const { data: templateRow } = await supabase
    .from("consent_templates")
    .select("id, version")
    .is("clinic_id", null)
    .eq("slug", template.slug)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const signatureBytes = Buffer.from(body.signatureDataUrl.split(",")[1], "base64");
  const signaturePath = `${clinicId}/${consentId}/signature.png`;

  const { error: uploadError } = await supabase.storage
    .from("signatures")
    .upload(signaturePath, signatureBytes, { contentType: "image/png", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Could not store the signature: ${uploadError.message}` }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("consents").insert({
    id: consentId,
    consent_ref: consentRef,
    clinic_id: clinicId,
    patient_id: patientId,
    doctor_id: doctorId,
    template_id: templateRow?.id ?? null,
    template_version: templateRow?.version ?? null,

    patient_name: body.patientName,
    patient_id_snapshot: body.patientId || null,
    patient_dob: body.dob || null,
    patient_age: body.age || null,
    patient_phone: body.phone || null,

    doctor_name: body.doctor,
    procedure: body.procedure,
    tooth: body.tooth || null,

    consent_title: body.consentTitle,
    consent_body: body.consentBody,
    acknowledgements: body.acknowledgements,
    accepted_acknowledgements: body.acceptedAcknowledgements,

    signer_name: body.signerName,
    signed_at: signedAt,
    signature_storage_path: signaturePath,

    email_status: body.clinicEmail ? "pending" : "not_applicable",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    clinic_id: clinicId,
    consent_id: consentId,
    event_type: "consent_signed",
    metadata: { procedure: body.procedure, doctor: body.doctor, consent_ref: consentRef },
  });

  return NextResponse.json({
    persisted: true,
    consentId,
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
    .select("consent_ref, patient_name, doctor_name, procedure, tooth, signed_at, email_status")
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .order("signed_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = (data || []).map((row) => ({
    consentRef: row.consent_ref,
    patientName: row.patient_name,
    doctor: row.doctor_name,
    procedure: row.procedure,
    tooth: row.tooth,
    signedAt: row.signed_at,
    emailStatus: row.email_status,
  }));

  return NextResponse.json({ persisted: true, records });
}
