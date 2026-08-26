import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const DEFAULT_CLINIC_ID =
  process.env.DEFAULT_CLINIC_ID || "00000000-0000-0000-0000-000000000001";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const verifier = createClient(url, anonKey);
  const { data: userData, error: userError } = await verifier.auth.getUser(token);
  if (userError || !userData.user?.email) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const userId = userData.user.id;
  const email = userData.user.email.toLowerCase();

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
  }

  const { data: existingMembership } = await admin
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", userId)
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json({ ok: true, clinicId: DEFAULT_CLINIC_ID });
  }

  const { data: invite } = await admin
    .from("clinic_invites")
    .select("clinic_id, role")
    .eq("email", email)
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .is("claimed_at", null)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json(
      { error: "This email has not been invited to a clinic. Ask the clinic owner for access." },
      { status: 403 }
    );
  }

  const { error: insertError } = await admin.from("clinic_users").insert({
    clinic_id: invite.clinic_id,
    user_id: userId,
    role: invite.role,
    display_name: userData.user.email,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await admin
    .from("clinic_invites")
    .update({ claimed_at: new Date().toISOString() })
    .eq("email", email);

  return NextResponse.json({ ok: true, clinicId: invite.clinic_id });
}
