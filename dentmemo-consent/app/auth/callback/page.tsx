"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        setError("Login is not configured for this deployment.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        setError("That sign-in link is invalid or has expired. Request a new one.");
        return;
      }

      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Could not complete sign-in.");
        return;
      }

      router.replace("/new");
    }

    run();
  }, [router]);

  return (
    <main className="shell">
      <div className="container" style={{ maxWidth: 440 }}>
        <section className="card" style={{ padding: 34, marginTop: 60 }}>
          {error ? (
            <>
              <div className="sectionTitle">Sign-in failed</div>
              <div className="sectionDescription">{error}</div>
              <Link className="btn btnPrimary" href="/login">Back to sign in</Link>
            </>
          ) : (
            <div className="sectionDescription">Signing you in...</div>
          )}
        </section>
      </div>
    </main>
  );
}
