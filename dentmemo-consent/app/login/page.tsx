"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendLink() {
    setError("");
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("Login is not configured for this deployment.");
      return;
    }
    if (!email.trim()) return;

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="shell">
      <div className="container" style={{ maxWidth: 440 }}>
        <section className="card" style={{ padding: 34, marginTop: 60 }}>
          <div className="brand" style={{ marginBottom: 22 }}>
            <span className="logoMark">D</span>
            <span>DentMemo <small>Digital Consent</small></span>
          </div>

          {sent ? (
            <>
              <div className="sectionTitle">Check your email</div>
              <div className="sectionDescription">
                We sent a sign-in link to {email}. Open it on this device to continue.
              </div>
            </>
          ) : (
            <>
              <div className="sectionTitle">Sign in</div>
              <div className="sectionDescription">
                Enter the email address your clinic gave access to. We&apos;ll send a one-time sign-in link — no password needed.
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendLink()}
                  autoFocus
                  placeholder="you@clinic.com"
                />
              </div>
              {error && <div className="notice noticeError" style={{ marginTop: 14 }}>{error}</div>}
              <button
                type="button"
                className="btn btnPrimary"
                style={{ marginTop: 18, width: "100%" }}
                disabled={submitting || !email.trim()}
                onClick={sendLink}
              >
                {submitting ? "Sending..." : "Send sign-in link"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
