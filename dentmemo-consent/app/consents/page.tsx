"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireSession } from "@/lib/use-session";

type Row = {
  consentRef: string;
  patientName: string;
  doctor: string;
  procedure: string;
  tooth?: string;
  signedAt: string;
  emailStatus?: string;
};

function formatEmailStatus(status?: string) {
  switch (status) {
    case "sent":
      return "Sent";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    default:
      return "-";
  }
}

export default function ConsentsPage() {
  const { email, ready, signOut } = useRequireSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/consents");
        if (res.ok) {
          const result = await res.json();
          if (result.persisted && Array.isArray(result.records)) {
            setRows(result.records);
            return;
          }
        }
      } catch {}

      const local = JSON.parse(localStorage.getItem("dentmemo-consents") || "[]");
      setRows(local);
      setLoading(false);
    }

    load().finally(() => setLoading(false));
  }, []);

  if (!ready) {
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
            <h1>Consent Records</h1>
            <div className="muted">Recent signed consents</div>
          </div>
        </div>

        <section className="card tableCard">
          {loading ? (
            <div className="empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="empty">
              No consent records yet.<br /><br />
              <Link href="/new" className="btn btnPrimary">Create first consent</Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Consent ID</th>
                  <th>Patient</th>
                  <th>Procedure</th>
                  <th>Doctor</th>
                  <th>Tooth</th>
                  <th>Signed</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.consentRef}-${row.signedAt}`}>
                    <td><strong>{row.consentRef}</strong></td>
                    <td>{row.patientName}</td>
                    <td>{row.procedure}</td>
                    <td>{row.doctor}</td>
                    <td>{row.tooth || "-"}</td>
                    <td>{new Date(row.signedAt).toLocaleString()}</td>
                    <td>{formatEmailStatus(row.emailStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
