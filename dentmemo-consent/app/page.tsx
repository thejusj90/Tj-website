import Link from "next/link";

const items = [
  ["1", "Add Patient", "Enter the patient details."],
  ["2", "Select Treatment", "Choose procedure and tooth number."],
  ["3", "Patient Reads", "Show the consent and explain treatment."],
  ["4", "Patient Signs", "Sign on tablet in seconds."],
  ["5", "PDF Generated", "Download, save and optionally email."],
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="logoMark">D</span>
          <span>DentMemo <small>Digital Consent</small></span>
        </Link>
        <nav className="nav">
          <Link href="/consents" className="btn btnSecondary hideMobile">Consent Records</Link>
          <Link href="/new" className="btn btnPrimary">New Consent</Link>
        </nav>
      </header>

      <div className="container">
        <div className="heroGrid">
          <section className="card heroCard">
            <div className="eyebrow">DentMemo Digital Consent</div>
            <h1>Dental consent.<br />Signed in under<br />a minute.</h1>
            <p>
              Create treatment-specific consent forms, let patients sign directly on your tablet,
              and generate a professional PDF immediately.
            </p>
            <div className="buttonRow">
              <Link className="btn btnPrimary" href="/new">Start Digital Consent</Link>
              <Link className="btn btnSecondary" href="/consents">View saved consents</Link>
            </div>
          </section>

          <section className="card workflowCard">
            <div className="workflowTitle">Simple chairside workflow</div>
            {items.map(([n, title, desc]) => (
              <div className="workflowItem" key={n}>
                <div className="workflowNumber">{n}</div>
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
