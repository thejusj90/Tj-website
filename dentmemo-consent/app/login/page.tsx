"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendCode() {
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
    });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  async function verifyCode() {
    setError("");
    const supabase = getSupabaseBrowser();
    if (!supabase || !code.trim()) return;

    setSubmitting(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    if (verifyError || !data.session) {
      setSubmitting(false);
      setError(verifyError?.message || "That code didn't work. Check it and try again.");
      return;
    }

    const res = await fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: { authorization: `Bearer ${data.session.access_token}` },
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not complete sign-in.");
      return;
    }

    router.replace("/new");
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
              <div className="sectionTitle">Enter your code</div>
              <div className="sectionDescription">
                We sent a 6-digit code to {email}. Enter it below — don&apos;t tap a link if your email app also shows one.
              </div>
              <div className="field">
                <label>Sign-in code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                  autoFocus
                  inputMode="numeric"
                  placeholder="123456"
                />
              </div>
              {error && <div className="notice noticeError" style={{ marginTop: 14 }}>{error}</div>}
              <button
                type="button"
                className="btn btnPrimary"
                style={{ marginTop: 18, width: "100%" }}
                disabled={submitting || !code.trim()}
                onClick={verifyCode}
              >
                {submitting ? "Verifying..." : "Verify & sign in"}
              </button>
              <button
                type="button"
                className="textButton"
                style={{ marginTop: 14 }}
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </>
          ) : (
            <>
              <div className="sectionTitle">Sign in</div>
              <div className="sectionDescription">
                Enter the email address your clinic gave access to. We&apos;ll send a 6-digit sign-in code — no password needed.
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
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
                onClick={sendCode}
              >
                {submitting ? "Sending..." : "Send sign-in code"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
