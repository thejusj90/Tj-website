import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const DEFAULT_CLINIC_ID =
  process.env.DEFAULT_CLINIC_ID || "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });

  const { data, error } = await supabase
    .from("clinic_brand_profiles")
    .select("*")
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .order("version", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const active = (data || []).find((row) => row.status === "active") || null;
  return NextResponse.json({ active, versions: data || [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });

  const body = await request.json();
  const letterheadMode = body.letterheadMode === "uploaded" ? "uploaded" : "generated";
  const brandingStyle = ["professional", "minimal", "compact"].includes(body.brandingStyle)
    ? body.brandingStyle
    : "professional";

  if (letterheadMode === "uploaded" && !body.logoDataUrl) {
    return NextResponse.json({ error: "An uploaded letterhead needs a logo image." }, { status: 400 });
  }

  const { data: maxRow } = await supabase
    .from("clinic_brand_profiles")
    .select("version")
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version ?? 0) + 1;
  const profileId = crypto.randomUUID();

  let logoStoragePath: string | null = null;
  if (letterheadMode === "uploaded" && typeof body.logoDataUrl === "string") {
    const match = body.logoDataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Logo must be a PNG or JPEG image." }, { status: 400 });
    }
    const ext = match[1] === "image/png" ? "png" : "jpg";
    const bytes = Buffer.from(match[2], "base64");
    logoStoragePath = `${DEFAULT_CLINIC_ID}/${profileId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("clinic-branding")
      .upload(logoStoragePath, bytes, {
        contentType: match[1],
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Could not store the logo: ${uploadError.message}` }, { status: 500 });
    }
  }

  const { error: insertError } = await supabase.from("clinic_brand_profiles").insert({
    id: profileId,
    clinic_id: DEFAULT_CLINIC_ID,
    version: nextVersion,
    status: "draft",
    letterhead_mode: letterheadMode,
    branding_style: brandingStyle,
    clinic_display_name: body.clinicDisplayName?.trim() || null,
    clinic_address: body.clinicAddress?.trim() || null,
    clinic_phone: body.clinicPhone?.trim() || null,
    accent_color: body.accentColor?.trim() || null,
    logo_storage_path: logoStoragePath,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // This route already runs server-side with the service-role client (same trust
  // level as /api/consents), so the archive-then-activate swap is done directly
  // rather than via the activate_brand_profile() RPC, which is gated on
  // auth.uid() for direct authenticated-client calls and would see no caller
  // identity here.
  await supabase
    .from("clinic_brand_profiles")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .eq("status", "active")
    .neq("id", profileId);

  const { error: activateError } = await supabase
    .from("clinic_brand_profiles")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", profileId);

  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 });

  await supabase.from("audit_events").insert({
    clinic_id: DEFAULT_CLINIC_ID,
    event_type: "branding_activated",
    metadata: { brand_profile_id: profileId, version: nextVersion },
  });

  return NextResponse.json({ ok: true, profileId, version: nextVersion });
}
