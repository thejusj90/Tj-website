import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { ConsentForm } from "@/lib/types";

const A4 = { width: 595.28, height: 841.89 };
const margin = 48;
const DEFAULT_CLINIC_ID =
  process.env.DEFAULT_CLINIC_ID || "00000000-0000-0000-0000-000000000001";

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

type BrandProfile = {
  letterhead_mode: "generated" | "uploaded";
  branding_style: string | null;
  clinic_display_name: string | null;
  clinic_address: string | null;
  clinic_phone: string | null;
  accent_color: string | null;
  logo_storage_path: string | null;
};

async function fetchActiveBrandProfile(clinicId: string): Promise<BrandProfile | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const result = await withTimeout(
      Promise.resolve(
        supabase
          .from("clinic_brand_profiles")
          .select("letterhead_mode, branding_style, clinic_display_name, clinic_address, clinic_phone, accent_color, logo_storage_path")
          .eq("clinic_id", clinicId)
          .eq("status", "active")
          .maybeSingle()
      ),
      4000
    );
    return (result?.data as BrandProfile) ?? null;
  } catch {
    // A branding lookup failure should never block consent PDF generation.
    return null;
  }
}

async function fetchLogoBytes(logoStoragePath: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const downloadResult = await withTimeout(
      Promise.resolve(supabase.storage.from("clinic-branding").download(logoStoragePath)),
      4000
    );
    if (!downloadResult || downloadResult.error || !downloadResult.data) return null;
    return Buffer.from(await downloadResult.data.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const data = (await request.json()) as ConsentForm & { consentId?: string };

  if (!data.consentRef || !data.patientName || !data.signatureDataUrl) {
    return NextResponse.json({ error: "Incomplete signed consent payload." }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - margin;
  let pageNumber = 1;

  const navy = rgb(0.06, 0.09, 0.16);
  const slate = rgb(0.28, 0.35, 0.44);
  const blue = rgb(0.15, 0.39, 0.92);
  const white = rgb(1, 1, 1);
  const light = rgb(0.87, 0.9, 0.94);

  const footer = (p: PDFPage, n: number) => {
    p.drawLine({
      start: { x: margin, y: 34 },
      end: { x: A4.width - margin, y: 34 },
      thickness: 0.5,
      color: light,
    });
    p.drawText(`${data.consentRef} - Page ${n}`, {
      x: margin,
      y: 21,
      size: 8,
      font: regular,
      color: slate,
    });
    p.drawText("Generated using DentMemo Consent", {
      x: A4.width - margin - 150,
      y: 21,
      size: 8,
      font: regular,
      color: slate,
    });
  };

  const newPage = () => {
    footer(page, pageNumber);
    pageNumber += 1;
    page = pdf.addPage([A4.width, A4.height]);
    y = A4.height - margin;
  };

  const ensure = (height: number) => {
    if (y - height < 48) newPage();
  };

  const drawWrapped = (text: string, size = 10, lineHeight = 14.5, font = regular, color = navy, indent = 0) => {
    const lines = wrap(text, font, size, A4.width - margin * 2 - indent);
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= lineHeight;
    }
  };

  // Checkbox glyph: filled blue square with a white check for accepted
  // acknowledgements, an outlined square otherwise. Text wraps with a
  // fixed indent so continuation lines line up under the first line.
  const drawAcknowledgement = (text: string, accepted: boolean) => {
    const size = 9.5;
    const lineHeight = 13.5;
    const indent = 16;
    const boxSize = 8;
    const lines = wrap(text, regular, size, A4.width - margin * 2 - indent);

    lines.forEach((line, i) => {
      ensure(lineHeight);
      if (i === 0) {
        // Aligned to sit on the text baseline and rise to roughly cap-height,
        // rather than hanging below the line like a subscript.
        const boxY = y - 1;
        if (accepted) {
          page.drawRectangle({ x: margin, y: boxY, width: boxSize, height: boxSize, color: blue });
          page.drawLine({ start: { x: margin + 1.5, y: boxY + 4 }, end: { x: margin + 3.3, y: boxY + 2 }, thickness: 1, color: white });
          page.drawLine({ start: { x: margin + 3.3, y: boxY + 2 }, end: { x: margin + 6.5, y: boxY + 6.5 }, thickness: 1, color: white });
        } else {
          page.drawRectangle({ x: margin, y: boxY, width: boxSize, height: boxSize, borderColor: slate, borderWidth: 1 });
        }
      }
      page.drawText(line, { x: margin + indent, y, size, font: regular, color: navy });
      y -= lineHeight;
    });
  };

  const brandProfile = await fetchActiveBrandProfile(DEFAULT_CLINIC_ID);

  let logoImage: PDFImage | null = null;
  if (brandProfile?.letterhead_mode === "uploaded" && brandProfile.logo_storage_path) {
    const logoBytes = await fetchLogoBytes(brandProfile.logo_storage_path);
    if (logoBytes) {
      try {
        logoImage = await pdf.embedPng(logoBytes);
      } catch {
        try {
          logoImage = await pdf.embedJpg(logoBytes);
        } catch {
          logoImage = null;
        }
      }
    }
  }

  const accentHex = brandProfile?.accent_color;
  const accent =
    accentHex && /^#[0-9a-fA-F]{6}$/.test(accentHex)
      ? rgb(
          parseInt(accentHex.slice(1, 3), 16) / 255,
          parseInt(accentHex.slice(3, 5), 16) / 255,
          parseInt(accentHex.slice(5, 7), 16) / 255
        )
      : blue;

  const clinicDisplayName = brandProfile?.clinic_display_name || data.clinicName || "Dental Clinic";
  const headerTextX = logoImage ? margin + 46 : margin;
  if (logoImage) {
    const maxDim = 36;
    const scale = Math.min(maxDim / logoImage.width, maxDim / logoImage.height, 1);
    page.drawImage(logoImage, { x: margin, y: y - maxDim + 6, width: logoImage.width * scale, height: logoImage.height * scale });
  }

  page.drawText("DentMemo Consent", { x: headerTextX, y, size: 18, font: bold, color: accent });
  y -= 20;
  page.drawText(clinicDisplayName, { x: headerTextX, y, size: 10, font: bold, color: navy });
  y -= 14;

  if (brandProfile?.letterhead_mode === "generated") {
    const contactLine = [brandProfile.clinic_address, brandProfile.clinic_phone].filter(Boolean).join("  ·  ");
    if (contactLine) {
      page.drawText(contactLine, { x: headerTextX, y, size: 8.5, font: regular, color: slate });
      y -= 12;
    }
  }
  y -= 10;

  drawWrapped(data.consentTitle, 14.5, 18, bold);
  y -= 6;

  const meta = [
    ["Patient", data.patientName],
    ["Patient ID", data.patientId || "-"],
    ["DOB / Age", [data.dob, data.age].filter(Boolean).join(" / ") || "-"],
    ["Phone", data.phone || "-"],
    ["Doctor", data.doctor || "-"],
    ["Procedure", data.procedure || "-"],
    ["Tooth", data.tooth || "-"],
  ];

  for (const [label, value] of meta) {
    ensure(14);
    page.drawText(`${label}:`, { x: margin, y, size: 9, font: bold, color: slate });
    page.drawText(value, { x: margin + 74, y, size: 9, font: regular, color: navy });
    y -= 13;
  }

  y -= 10;
  drawWrapped(data.consentBody, 10, 14.5, regular, navy);
  y -= 16;

  ensure(30);
  page.drawText("Signature & Acknowledgements", { x: margin, y, size: 12.5, font: bold, color: navy });
  y -= 19;

  data.acknowledgements.forEach((ack, i) => {
    drawAcknowledgement(ack, Boolean(data.acceptedAcknowledgements[i]));
    y -= 3;
  });

  y -= 8;

  if (data.signatureDataUrl.startsWith("data:image/png;base64,")) {
    try {
      const signatureBytes = Buffer.from(data.signatureDataUrl.split(",")[1], "base64");
      const signature = await pdf.embedPng(signatureBytes);
      const maxW = 210;
      const maxH = 70;
      const scale = Math.min(maxW / signature.width, maxH / signature.height, 1);
      const w = signature.width * scale;
      const h = signature.height * scale;
      ensure(h + 60);

      page.drawText("Patient Signature", { x: margin, y, size: 9, font: bold, color: slate });
      y -= 7;
      page.drawImage(signature, { x: margin, y: y - h, width: w, height: h });
      y -= h + 12;
    } catch {
      // If the canvas payload is malformed, keep the document usable and show text evidence.
    }
  }

  const signedAt = data.signedAt || new Date().toISOString();

  drawWrapped(`Consent ID: ${data.consentRef}`, 9, 13, bold);
  drawWrapped(`Signer: ${data.signerName}`, 9, 13, regular);
  drawWrapped(`Signed at: ${signedAt}`, 9, 13, regular);
  drawWrapped("Patient handwritten signature captured electronically.", 9, 13, regular);

  footer(page, pageNumber);

  const bytes = await pdf.save();

  const pdfSha256 = createHash("sha256").update(bytes).digest("hex");

  if (data.consentId) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const pdfPath = `${DEFAULT_CLINIC_ID}/${data.consentId}/consent.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("consent-pdfs")
        .upload(pdfPath, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });

      if (!uploadError) {
        await supabase
          .from("consents")
          .update({ pdf_storage_path: pdfPath, pdf_sha256: pdfSha256 })
          .eq("id", data.consentId);

        await supabase.from("audit_events").insert({
          clinic_id: DEFAULT_CLINIC_ID,
          consent_id: data.consentId,
          event_type: "pdf_generated",
          metadata: { consent_ref: data.consentRef, pdf_sha256: pdfSha256 },
        });
      }
    }
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${data.consentRef}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
