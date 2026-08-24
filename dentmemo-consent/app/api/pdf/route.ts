import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ConsentForm } from "@/lib/types";

const A4 = { width: 595.28, height: 841.89 };
const margin = 52;

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

export async function POST(request: Request) {
  const data = (await request.json()) as ConsentForm;

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
  const light = rgb(0.87, 0.9, 0.94);

  const footer = (p: PDFPage, n: number) => {
    p.drawLine({
      start: { x: margin, y: 36 },
      end: { x: A4.width - margin, y: 36 },
      thickness: 0.5,
      color: light,
    });
    p.drawText(`${data.consentRef} - Page ${n}`, {
      x: margin,
      y: 22,
      size: 8,
      font: regular,
      color: slate,
    });
    p.drawText("Generated using DentMemo Consent", {
      x: A4.width - margin - 150,
      y: 22,
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
    if (y - height < 58) newPage();
  };

  const drawWrapped = (text: string, size = 10.5, lineHeight = 16, font = regular, color = navy) => {
    const lines = wrap(text, font, size, A4.width - margin * 2);
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= lineHeight;
    }
  };

  page.drawText("DentMemo Consent", {
    x: margin,
    y,
    size: 21,
    font: bold,
    color: blue,
  });
  y -= 25;

  page.drawText(data.clinicName || "Dental Clinic", {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: navy,
  });
  y -= 28;

  drawWrapped(data.consentTitle, 16, 21, bold);
  y -= 8;

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
    ensure(18);
    page.drawText(`${label}:`, { x: margin, y, size: 9.5, font: bold, color: slate });
    page.drawText(value, { x: margin + 78, y, size: 9.5, font: regular, color: navy });
    y -= 15;
  }

  y -= 13;
  drawWrapped(data.consentBody, 10.5, 16, regular, navy);
  y -= 22;

  ensure(40);
  page.drawText("Signature & Acknowledgements", {
    x: margin,
    y,
    size: 14,
    font: bold,
    color: navy,
  });
  y -= 24;

  data.acknowledgements.forEach((ack, i) => {
    const accepted = data.acceptedAcknowledgements[i];
    const prefix = accepted ? "[X] " : "[ ] ";
    drawWrapped(prefix + ack, 9.8, 15, regular, navy);
    y -= 3;
  });

  y -= 10;

  if (data.signatureDataUrl.startsWith("data:image/png;base64,")) {
    try {
      const signatureBytes = Buffer.from(data.signatureDataUrl.split(",")[1], "base64");
      const signature = await pdf.embedPng(signatureBytes);
      const maxW = 230;
      const maxH = 90;
      const scale = Math.min(maxW / signature.width, maxH / signature.height, 1);
      const w = signature.width * scale;
      const h = signature.height * scale;
      ensure(h + 80);

      page.drawText("Patient Signature", {
        x: margin,
        y,
        size: 9.5,
        font: bold,
        color: slate,
      });
      y -= 8;
      page.drawImage(signature, { x: margin, y: y - h, width: w, height: h });
      y -= h + 14;
    } catch {
      // If the canvas payload is malformed, keep the document usable and show text evidence.
    }
  }

  const signedAt = data.signedAt || new Date().toISOString();

  drawWrapped(`Consent ID: ${data.consentRef}`, 9.5, 14, bold);
  drawWrapped(`Signer: ${data.signerName}`, 9.5, 14, regular);
  drawWrapped(`Signed at: ${signedAt}`, 9.5, 14, regular);
  drawWrapped("Patient handwritten signature captured electronically.", 9.5, 14, regular);

  footer(page, pageNumber);

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${data.consentRef}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
