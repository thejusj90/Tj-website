"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireSession } from "@/lib/use-session";

type BrandProfile = {
  id: string;
  version: number;
  status: string;
  letterhead_mode: "generated" | "uploaded";
  branding_style: string | null;
  clinic_display_name: string | null;
  clinic_address: string | null;
  clinic_phone: string | null;
  accent_color: string | null;
  activated_at: string | null;
  archived_at: string | null;
};

export default function BrandingSettingsPage() {
  const { email, ready, signOut } = useRequireSession();
  const [active, setActive] = useState<BrandProfile | null>(null);
  const [versions, setVersions] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [letterheadMode, setLetterheadMode] = useState<"generated" | "uploaded">("generated");
  const [brandingStyle, setBrandingStyle] = useState("professional");
  const [clinicDisplayName, setClinicDisplayName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/branding");
      const result = await res.json();
      if (res.ok) {
        setActive(result.active);
        setVersions(result.versions || []);
        if (result.active) {
          setLetterheadMode(result.active.letterhead_mode);
          setBrandingStyle(result.active.branding_style || "professional");
          setClinicDisplayName(result.active.clinic_display_name || "");
          setClinicAddress(result.active.clinic_address || "");
          setClinicPhone(result.active.clinic_phone || "");
          setAccentColor(result.active.accent_color || "#2563eb");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function onLogoFile(file: File | null) {
    if (!file) {
      setLogoDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function saveAndActivate() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          letterheadMode,
          brandingStyle,
          clinicDisplayName,
          clinicAddress,
          clinicPhone,
          accentColor,
          logoDataUrl: letterheadMode === "uploaded" ? logoDataUrl : undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not save branding.");
        return;
      }
      setSuccess(`Version ${result.version} is now active.`);
      setLogoDataUrl(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <main className="shell">
        <div className="container"><div className="empty">Loading...</div></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="logoMark">D</span>
          <span>DentMemo <small>Digital Consent</small></span>
        </Link>
        <nav className="nav">
          <Link href="/settings/templates" className="btn btnSecondary hideMobile">Templates</Link>
          <Link href="/new" className="btn btnPrimary">New Consent</Link>
          {email && (
            <button type="button" className="btn btnSecondary hideMobile" onClick={signOut}>
              Sign out
            </button>
          )}
        </nav>
      </header>

      <div className="container">
        <div className="pageHeader">
          <div>
            <h1>Clinic Branding</h1>
            <div className="muted">
              Changes create a new version and never alter consents already signed.
            </div>
          </div>
        </div>

        {error && <div className="notice noticeError">{error}</div>}
        {success && <div className="notice noticeSuccess">{success}</div>}

        <section className="card wizardCard">
          <div className="wizardBody">
            <div className="sectionTitle">Letterhead</div>
            <div className="sectionDescription">
              {active
                ? `Currently active: version ${active.version} (${active.letterhead_mode}).`
                : "No branding version yet — the app falls back to plain text."}
            </div>

            <div className="formGrid">
              <div className="field">
                <label>Letterhead type</label>
                <select value={letterheadMode} onChange={(e) => setLetterheadMode(e.target.value as "generated" | "uploaded")}>
                  <option value="generated">Generated from clinic details</option>
                  <option value="uploaded">Upload a logo image</option>
                </select>
              </div>
              <div className="field">
                <label>Style</label>
                <select value={brandingStyle} onChange={(e) => setBrandingStyle(e.target.value)}>
                  <option value="professional">Professional</option>
                  <option value="minimal">Minimal</option>
                  <option value="compact">Compact</option>
                </select>
              </div>

              {letterheadMode === "uploaded" ? (
                <div className="field full">
                  <label>Logo (PNG or JPEG)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onLogoFile(e.target.files?.[0] || null)}
                  />
                  <div className="fieldHint">Stored privately, scoped to this clinic. Kept with this version forever, even if you upload a new one later.</div>
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>Clinic display name</label>
                    <input value={clinicDisplayName} onChange={(e) => setClinicDisplayName(e.target.value)} placeholder="Demo Dental Clinic" />
                  </div>
                  <div className="field">
                    <label>Accent color</label>
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label>Address</label>
                    <input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="Clinic address" />
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="Clinic phone" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="wizardFooter">
            <span className="muted">
              {versions.length} version{versions.length === 1 ? "" : "s"} on file
            </span>
            <button type="button" className="btn btnPrimary" disabled={saving} onClick={saveAndActivate}>
              {saving ? "Saving..." : "Save & activate"}
            </button>
          </div>
        </section>

        {versions.length > 0 && (
          <section className="card tableCard" style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Activated</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.version}</td>
                    <td>{v.status}</td>
                    <td>{v.letterhead_mode}</td>
                    <td>{v.activated_at ? new Date(v.activated_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}
