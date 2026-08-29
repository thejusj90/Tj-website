"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireSession } from "@/lib/use-session";

type Template = {
  baseSlug: string;
  procedure: string;
  isCustomized: boolean;
  versionId: string | null;
  version: number;
  title: string;
  body: string;
  acknowledgements: string[];
};

export default function TemplateStudioPage() {
  const { email, ready, signOut } = useRequireSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftAcks, setDraftAcks] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const result = await res.json();
      if (res.ok) setTemplates(result.templates || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function startEdit(t: Template) {
    setEditingSlug(t.baseSlug);
    setDraftTitle(t.title);
    setDraftBody(t.body);
    setDraftAcks(t.acknowledgements.join("\n"));
    setError("");
    setSuccess("");
  }

  async function saveEdit(baseSlug: string) {
    setError("");
    setSuccess("");
    setBusySlug(baseSlug);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseTemplateSlug: baseSlug,
          action: "save",
          title: draftTitle,
          body: draftBody,
          acknowledgements: draftAcks.split("\n").map((a) => a.trim()).filter(Boolean),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not save template.");
        return;
      }
      setSuccess(`Saved as version ${result.version} and activated.`);
      setEditingSlug(null);
      await load();
    } finally {
      setBusySlug(null);
    }
  }

  async function restoreDefault(baseSlug: string) {
    setError("");
    setSuccess("");
    setBusySlug(baseSlug);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseTemplateSlug: baseSlug, action: "restore-default" }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not restore the default.");
        return;
      }
      setSuccess(`Restored the DentMemo default as version ${result.version}.`);
      await load();
    } finally {
      setBusySlug(null);
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
          <Link href="/settings/branding" className="btn btnSecondary hideMobile">Branding</Link>
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
            <h1>Consent Template Studio</h1>
            <div className="muted">
              Editing creates a new version — it never rewrites a version already used on a signed consent.
            </div>
          </div>
        </div>

        {error && <div className="notice noticeError">{error}</div>}
        {success && <div className="notice noticeSuccess">{success}</div>}

        <div style={{ display: "grid", gap: 16 }}>
          {templates.map((t) => (
            <section key={t.baseSlug} className="card wizardCard">
              <div className="wizardBody">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                  <div>
                    <div className="sectionTitle" style={{ marginBottom: 2 }}>{t.procedure}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Version {t.version} · {t.isCustomized ? "Clinic-customized" : "DentMemo default"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {t.isCustomized && (
                      <button
                        type="button"
                        className="btn btnSecondary"
                        disabled={busySlug === t.baseSlug}
                        onClick={() => restoreDefault(t.baseSlug)}
                      >
                        Restore DentMemo default
                      </button>
                    )}
                    <button type="button" className="btn btnPrimary" onClick={() => startEdit(t)}>
                      {editingSlug === t.baseSlug ? "Editing..." : "Duplicate & customize"}
                    </button>
                  </div>
                </div>

                {editingSlug === t.baseSlug ? (
                  <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                    <div className="field">
                      <label>Title</label>
                      <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Consent body</label>
                      <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} style={{ minHeight: 160 }} />
                    </div>
                    <div className="field">
                      <label>Acknowledgements (one per line)</label>
                      <textarea value={draftAcks} onChange={(e) => setDraftAcks(e.target.value)} style={{ minHeight: 100 }} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="btn btnPrimary"
                        disabled={busySlug === t.baseSlug}
                        onClick={() => saveEdit(t.baseSlug)}
                      >
                        {busySlug === t.baseSlug ? "Saving..." : "Save & activate"}
                      </button>
                      <button type="button" className="textButton" onClick={() => setEditingSlug(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="consentText" style={{ marginTop: 14, fontSize: 14 }}>{t.body}</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
