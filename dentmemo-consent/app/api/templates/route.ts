import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { consentTemplates } from "@/lib/templates";

const DEFAULT_CLINIC_ID =
  process.env.DEFAULT_CLINIC_ID || "00000000-0000-0000-0000-000000000001";

type TemplateVersionRow = {
  id: string;
  clinic_id: string | null;
  base_template_slug: string;
  version: number;
  title: string;
  body: string;
  acknowledgements: string[];
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });

  const { data, error } = await supabase
    .from("consent_template_versions")
    .select("id, clinic_id, base_template_slug, version, title, body, acknowledgements")
    .eq("status", "active")
    .or(`clinic_id.eq.${DEFAULT_CLINIC_ID},clinic_id.is.null`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as TemplateVersionRow[];

  const templates = consentTemplates.map((defaultTemplate) => {
    const clinicVersion = rows.find(
      (r) => r.clinic_id === DEFAULT_CLINIC_ID && r.base_template_slug === defaultTemplate.slug
    );
    const globalVersion = rows.find(
      (r) => r.clinic_id === null && r.base_template_slug === defaultTemplate.slug
    );
    const active = clinicVersion || globalVersion;

    return {
      baseSlug: defaultTemplate.slug,
      procedure: defaultTemplate.procedure,
      isCustomized: Boolean(clinicVersion),
      versionId: active?.id ?? null,
      version: active?.version ?? 1,
      title: active?.title ?? defaultTemplate.title,
      body: active?.body ?? defaultTemplate.body,
      acknowledgements: active?.acknowledgements ?? defaultTemplate.acknowledgements,
    };
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });

  const body = await request.json();
  const baseSlug = String(body.baseTemplateSlug || "");
  const action = body.action === "restore-default" ? "restore-default" : "save";
  const defaultTemplate = consentTemplates.find((t) => t.slug === baseSlug);

  if (!defaultTemplate) {
    return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  }

  let title: string;
  let text: string;
  let acknowledgements: string[];
  let sourceVersionId: string | null = null;

  if (action === "restore-default") {
    const { data: globalVersion } = await supabase
      .from("consent_template_versions")
      .select("id, title, body, acknowledgements")
      .is("clinic_id", null)
      .eq("base_template_slug", baseSlug)
      .eq("status", "active")
      .maybeSingle();

    title = globalVersion?.title ?? defaultTemplate.title;
    text = globalVersion?.body ?? defaultTemplate.body;
    acknowledgements = globalVersion?.acknowledgements ?? defaultTemplate.acknowledgements;
    sourceVersionId = globalVersion?.id ?? null;
  } else {
    title = String(body.title || "").trim();
    text = String(body.body || "").trim();
    acknowledgements = Array.isArray(body.acknowledgements)
      ? body.acknowledgements.map((a: unknown) => String(a).trim()).filter(Boolean)
      : [];

    if (!title || !text || acknowledgements.length === 0) {
      return NextResponse.json({ error: "Title, body, and at least one acknowledgement are required." }, { status: 400 });
    }

    const { data: currentActive } = await supabase
      .from("consent_template_versions")
      .select("id")
      .eq("clinic_id", DEFAULT_CLINIC_ID)
      .eq("base_template_slug", baseSlug)
      .eq("status", "active")
      .maybeSingle();
    sourceVersionId = currentActive?.id ?? null;
  }

  const { data: maxRow } = await supabase
    .from("consent_template_versions")
    .select("version")
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .eq("base_template_slug", baseSlug)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();

  const { error: insertError } = await supabase.from("consent_template_versions").insert({
    id: versionId,
    clinic_id: DEFAULT_CLINIC_ID,
    base_template_slug: baseSlug,
    source_version_id: sourceVersionId,
    version: nextVersion,
    status: "draft",
    title,
    body: text,
    acknowledgements,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase
    .from("consent_template_versions")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("clinic_id", DEFAULT_CLINIC_ID)
    .eq("base_template_slug", baseSlug)
    .eq("status", "active")
    .neq("id", versionId);

  const { error: activateError } = await supabase
    .from("consent_template_versions")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", versionId);

  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 });

  await supabase.from("audit_events").insert({
    clinic_id: DEFAULT_CLINIC_ID,
    event_type: "template_activated",
    metadata: { template_version_id: versionId, base_template_slug: baseSlug, action },
  });

  return NextResponse.json({ ok: true, versionId, version: nextVersion });
}
