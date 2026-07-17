"use client";

export function WizardFooter({
  step,
  maxStep,
  saving,
  onBack,
  onContinue,
}: {
  step: number;
  maxStep: number;
  saving: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const isLast = step === maxStep;
  const hint =
    maxStep === 2 && step === 2
      ? "Step 2 of 2 — dosage comes from the group"
      : `Step ${step} of ${maxStep} — everything can be edited later`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border-strong px-6 py-3.5">
      <div className="max-w-[860px] mx-auto flex items-center gap-2.5">
        <span className="text-[12.5px] text-text-faint mr-auto hidden sm:inline">
          {hint}
        </span>
        {step > 1 && (
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="btn-outline disabled:opacity-50"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : isLast
              ? "Save supplement ✓"
              : "Continue →"}
        </button>
      </div>
    </div>
  );
}
