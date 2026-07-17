"use client";

const STEPS = [
  { num: 1, title: "What is it?", sub: "Name, label & grouping" },
  { num: 2, title: "Your bottles", sub: "The jars on your shelf" },
  { num: 3, title: "Who takes it?", sub: "Dosage per person" },
] as const;

export function WizardStepIndicator({
  current,
  maxStep,
  onGoTo,
}: {
  current: number;
  maxStep: number;
  onGoTo: (step: number) => void;
}) {
  return (
    <div className="flex items-start gap-0 mb-6">
      {STEPS.map((step, i) => {
        const hidden = step.num > maxStep;
        if (hidden) return null;

        const done = step.num < current;
        const isCurrent = step.num === current;
        const clickable = done || isCurrent;

        return (
          <div key={step.num} className="contents">
            {i > 0 && step.num <= maxStep && (
              <div
                className="flex-[0_0_26px] h-[1.5px] bg-border-strong mt-[15px]"
                aria-hidden
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onGoTo(step.num)}
              className={`flex flex-1 items-center gap-2.5 px-1 text-left disabled:cursor-default ${
                clickable ? "cursor-pointer" : ""
              }`}
            >
              <span
                className={`w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold border-[1.5px] ${
                  isCurrent
                    ? "bg-primary border-primary text-white"
                    : done
                      ? "bg-primary-light border-primary text-primary"
                      : "bg-surface border-border-strong text-text-muted"
                }`}
              >
                {done ? "✓" : step.num}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-semibold ${
                    isCurrent ? "text-text" : "text-text-muted"
                  }`}
                >
                  {step.title}
                </span>
                <span className="block text-[11.5px] font-normal text-text-faint">
                  {step.sub}
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
