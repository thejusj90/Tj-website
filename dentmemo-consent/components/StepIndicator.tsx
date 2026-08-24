"use client";

const steps = ["Patient Details", "Treatment", "Consent", "Sign & Submit"];

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="steps" aria-label="Consent steps">
      {steps.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        const completed = step < current;
        return (
          <div className="stepItem" key={label}>
            <div
              className={`stepDot ${active ? "active" : ""} ${completed ? "completed" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              {completed ? "✓" : step}
            </div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
