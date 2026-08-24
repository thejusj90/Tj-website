"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SignaturePad from "@/components/SignaturePad";
import StepIndicator from "@/components/StepIndicator";
import { consentTemplates, getTemplate } from "@/lib/templates";
import type { ConsentForm } from "@/lib/types";

const clinicNameDefault =
  process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Dental Clinic";
const clinicEmailDefault =
  process.env.NEXT_PUBLIC_CLINIC_EMAIL || "";

const initialTemplate = consentTemplates[0];

const initialForm: ConsentForm = {
  patientName: "",
  patientId: "",
  dob: "",
  age: "",
  phone: "",
  doctor: "",
  procedure: initialTemplate.procedure,
  tooth: "",
  templateSlug: initialTemplate.slug,
  consentTitle: initialTemplate.title,
  consentBody: initialTemplate.body,
  acknowledgements: initialTemplate.acknowledgements,
  acceptedAcknowledgements: initialTemplate.acknowledgements.map(() => false),
  signerName: "",
  signatureDataUrl: "",
  clinicName: clinicNameDefault,
  clinicEmail: clinicEmailDefault,
};

export default function NewConsentPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ConsentForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [consentRef, setConsentRef] = useState("");
  const [consentId, setConsentId] = useState("");
  const [editingConsent, setEditingConsent] = useState(false);
  const [signerTouched, setSignerTouched] = useState(false);
  const [recentDoctors, setRecentDoctors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("dentmemo-recent-doctors") || "[]");
      if (Array.isArray(stored)) setRecentDoctors(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (step === 4 && !signerTouched && form.patientName) {
      setForm((prev) => (prev.signerName ? prev : { ...prev, signerName: prev.patientName }));
    }
  }, [step, signerTouched, form.patientName]);

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(form.patientName.trim());
    if (step === 2) return Boolean(form.doctor.trim() && form.procedure.trim());
    if (step === 3) return Boolean(form.consentBody.trim());
    if (step === 4) {
      return (
        Boolean(form.signerName.trim()) &&
        Boolean(form.signatureDataUrl) &&
        form.acceptedAcknowledgements.every(Boolean)
      );
    }
    return true;
  }, [form, step]);

  const step4Missing = useMemo(() => {
    if (step !== 4) return "";
    const missing: string[] = [];
    if (!form.acceptedAcknowledgements.every(Boolean)) missing.push("all acknowledgements checked");
    if (!form.signerName.trim()) missing.push("signer name");
    if (!form.signatureDataUrl) missing.push("signature");
    if (missing.length === 0) return "";
    return `Before submitting, add: ${missing.join(", ")}.`;
  }, [step, form.acceptedAcknowledgements, form.signerName, form.signatureDataUrl]);

  function update<K extends keyof ConsentForm>(key: K, value: ConsentForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectTemplate(slug: string) {
    const t = getTemplate(slug);
    setForm((prev) => ({
      ...prev,
      templateSlug: t.slug,
      procedure: t.procedure,
      consentTitle: t.title,
      consentBody: t.body,
      acknowledgements: t.acknowledgements,
      acceptedAcknowledgements: t.acknowledgements.map(() => false),
    }));
  }

  function toggleAck(index: number, value: boolean) {
    setForm((prev) => {
      const next = [...prev.acceptedAcknowledgements];
      next[index] = value;
      return { ...prev, acceptedAcknowledgements: next };
    });
  }

  async function submit() {
    if (!canNext) return;
    setSubmitting(true);
    setMessage(null);

    const signedAt = new Date().toISOString();
    const payload = { ...form, signedAt };

    try {
      const saveRes = await fetch("/api/consents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) throw new Error("Could not save consent.");
      const saved = await saveRes.json();
      const ref = saved.consentRef as string;
      setConsentRef(ref);
      if (saved.consentId) setConsentId(saved.consentId as string);

      const finalPayload = { ...payload, consentRef: ref, consentId: saved.consentId };

      const pdfRes = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(finalPayload),
      });
      if (!pdfRes.ok) throw new Error("Consent saved, but PDF generation failed.");

      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      if (form.doctor.trim()) {
        const recents = [form.doctor.trim(), ...recentDoctors.filter((d) => d !== form.doctor.trim())].slice(0, 8);
        setRecentDoctors(recents);
        localStorage.setItem("dentmemo-recent-doctors", JSON.stringify(recents));
      }

      const localRecords = JSON.parse(localStorage.getItem("dentmemo-consents") || "[]");
      localRecords.unshift({
        consentRef: ref,
        patientName: form.patientName,
        doctor: form.doctor,
        procedure: form.procedure,
        tooth: form.tooth,
        signedAt,
      });
      localStorage.setItem("dentmemo-consents", JSON.stringify(localRecords.slice(0, 250)));

      setMessage({
        type: "success",
        text: saved.persisted
          ? "Consent signed, saved and PDF generated."
          : "Consent signed and PDF generated. Supabase is not configured, so this demo record is stored only in this browser.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function emailPdf() {
    if (!pdfUrl || !form.clinicEmail) return;
    setMessage(null);

    try {
      const blob = await fetch(pdfUrl).then((r) => r.blob());
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      const pdfBase64 = btoa(binary);

      const res = await fetch("/api/email-consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: form.clinicEmail,
          patientName: form.patientName,
          consentRef,
          consentId,
          pdfBase64,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Email failed.");
      setMessage({ type: "success", text: "PDF emailed to the clinic." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Email failed.",
      });
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="logoMark">D</span>
          <span>DentMemo <small>Digital Consent</small></span>
        </Link>
        <nav className="nav">
          <Link href="/consents" className="btn btnSecondary hideMobile">Records</Link>
        </nav>
      </header>

      <div className="container">
        <div className="pageHeader">
          <div>
            <h1>New Consent</h1>
            <div className="muted">{form.clinicName}</div>
          </div>
          {consentRef && <strong>{consentRef}</strong>}
        </div>

        {message && (
          <div className={`notice ${message.type === "success" ? "noticeSuccess" : "noticeError"}`}>
            {message.text}
          </div>
        )}

        <section className="card wizardCard">
          <StepIndicator current={step} />

          <div className="wizardBody">
            {step === 1 && (
              <>
                <div className="sectionTitle">Patient Details</div>
                <div className="sectionDescription">Enter only the information needed for this consent.</div>
                <div className="formGrid">
                  <div className="field full">
                    <label>Patient name *</label>
                    <input value={form.patientName} onChange={(e) => update("patientName", e.target.value)} autoFocus />
                  </div>
                  <div className="field">
                    <label>Patient ID</label>
                    <input value={form.patientId} onChange={(e) => update("patientId", e.target.value)} placeholder="P-000184" />
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <input value={form.phone} onChange={(e) => update("phone", e.target.value)} inputMode="tel" />
                  </div>
                  <div className="field">
                    <label>Date of birth</label>
                    <input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Age</label>
                    <input value={form.age} onChange={(e) => update("age", e.target.value)} inputMode="numeric" />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="sectionTitle">Treatment</div>
                <div className="sectionDescription">Choose the procedure and doctor.</div>
                <div className="formGrid">
                  <div className="field full">
                    <label>Consent template *</label>
                    <select value={form.templateSlug} onChange={(e) => selectTemplate(e.target.value)}>
                      {consentTemplates.map((t) => (
                        <option value={t.slug} key={t.slug}>{t.procedure}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Doctor *</label>
                    <input
                      value={form.doctor}
                      onChange={(e) => update("doctor", e.target.value)}
                      placeholder="Dr. Blessin Mathew"
                      list="recent-doctors"
                    />
                    <datalist id="recent-doctors">
                      {recentDoctors.map((d) => (
                        <option value={d} key={d} />
                      ))}
                    </datalist>
                  </div>
                  <div className="field">
                    <label>Tooth number</label>
                    <input value={form.tooth} onChange={(e) => update("tooth", e.target.value)} placeholder="16" />
                  </div>
                  <div className="field full">
                    <label>Clinic email for PDF</label>
                    <input type="email" value={form.clinicEmail} onChange={(e) => update("clinicEmail", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="sectionTitle">Consent</div>
                <div className="sectionDescription">Hand the tablet to the patient once you have explained the treatment.</div>
                <div className="summaryGrid">
                  <div className="summaryCard">
                    <div className="summaryList">
                      <div className="summaryRow"><span>Patient</span><strong>{form.patientName || "-"}</strong></div>
                      <div className="summaryRow"><span>Procedure</span><strong>{form.procedure}</strong></div>
                      <div className="summaryRow"><span>Tooth</span><strong>{form.tooth || "-"}</strong></div>
                      <div className="summaryRow"><span>Doctor</span><strong>{form.doctor || "-"}</strong></div>
                    </div>
                  </div>
                  <div className="summaryCard">
                    {editingConsent ? (
                      <>
                        <div className="field">
                          <label>Consent title</label>
                          <input value={form.consentTitle} onChange={(e) => update("consentTitle", e.target.value)} />
                        </div>
                        <div className="field" style={{ marginTop: 14 }}>
                          <label>Consent text</label>
                          <textarea value={form.consentBody} onChange={(e) => update("consentBody", e.target.value)} />
                        </div>
                        <button type="button" className="textButton" style={{ marginTop: 10 }} onClick={() => setEditingConsent(false)}>
                          Done editing
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="consentReadHeader">
                          <h2 className="consentReadTitle">{form.consentTitle}</h2>
                          <button type="button" className="textButton" onClick={() => setEditingConsent(true)}>
                            Edit wording
                          </button>
                        </div>
                        <p className="consentText">{form.consentBody}</p>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {step === 4 && !pdfUrl && (
              <>
                <div className="sectionTitle">Sign & Submit</div>
                <div className="sectionDescription">The patient should complete the acknowledgements and sign below.</div>

                <div className="ackList">
                  {form.acknowledgements.map((ack, index) => (
                    <label className="ack" key={`${ack}-${index}`}>
                      <input
                        type="checkbox"
                        checked={form.acceptedAcknowledgements[index] || false}
                        onChange={(e) => toggleAck(index, e.target.checked)}
                      />
                      <span>{ack}</span>
                    </label>
                  ))}
                </div>

                <div className="field" style={{ marginBottom: 18 }}>
                  <label>Signer name *</label>
                  <input
                    value={form.signerName}
                    onChange={(e) => {
                      setSignerTouched(true);
                      update("signerName", e.target.value);
                    }}
                    placeholder={form.patientName}
                  />
                  <div className="fieldHint">Defaults to the patient&apos;s name. Change this if a parent, guardian or representative is signing.</div>
                </div>

                <SignaturePad onChange={(data) => update("signatureDataUrl", data)} />
                {step4Missing && <div className="fieldHint" style={{ marginTop: 12 }}>{step4Missing}</div>}
              </>
            )}

            {step === 4 && pdfUrl && (
              <>
                <div className="sectionTitle">Consent completed</div>
                <div className="sectionDescription">The signed consent has been generated.</div>
                <div className="summaryCard">
                  <div className="summaryList">
                    <div className="summaryRow"><span>Consent ID</span><strong>{consentRef}</strong></div>
                    <div className="summaryRow"><span>Patient</span><strong>{form.patientName}</strong></div>
                    <div className="summaryRow"><span>Procedure</span><strong>{form.procedure}</strong></div>
                    <div className="summaryRow"><span>Doctor</span><strong>{form.doctor}</strong></div>
                  </div>
                  <div className="buttonRow">
                    <a className="btn btnPrimary" href={pdfUrl} download={`${consentRef}.pdf`}>Download PDF</a>
                    {form.clinicEmail && (
                      <button type="button" className="btn btnSecondary" onClick={emailPdf}>Email to clinic</button>
                    )}
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={() => {
                        setForm(initialForm);
                        setPdfUrl(null);
                        setConsentRef("");
                        setConsentId("");
                        setStep(1);
                        setMessage(null);
                        setEditingConsent(false);
                        setSignerTouched(false);
                      }}
                    >
                      Start another
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {!pdfUrl && (
            <div className="wizardFooter">
              <button
                type="button"
                className="btn btnSecondary"
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  className="btn btnPrimary"
                  disabled={!canNext}
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btnPrimary"
                  disabled={!canNext || submitting}
                  onClick={submit}
                >
                  {submitting ? "Generating..." : "Accept & Submit"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
