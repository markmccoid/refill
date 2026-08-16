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

  // Sits above the mobile nav rail (Sidebar.tsx) so the actions stay tappable;
  // flush to the bottom once that rail becomes a side rail at md.
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-border-strong bg-surface px-4 py-3 md:bottom-0 md:px-6 md:py-3.5">
      <div className="max-w-[860px] mx-auto flex items-center gap-2.5">
        <span className="text-[12.5px] text-text-faint mr-auto hidden sm:inline">
          {hint}
        </span>
        {step > 1 && (
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="btn-outline flex-1 disabled:opacity-50 sm:flex-none"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={saving}
          className="btn-primary flex-1 disabled:opacity-50 sm:flex-none"
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
