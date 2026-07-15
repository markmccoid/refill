"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PrototypeSwitcher } from "@/components/prototype/PrototypeSwitcher";
import { VariantA, variantName as nameA } from "@/components/prototype/candidate-capture/VariantA";
import { VariantB, variantName as nameB } from "@/components/prototype/candidate-capture/VariantB";
import { VariantC, variantName as nameC } from "@/components/prototype/candidate-capture/VariantC";

// PROTOTYPE — candidate capture UX: three variants on ?variant=A|B|C
// Question: where does durable candidate CRUD live vs where does Restock selection happen?

const variants = [
  { key: "A", name: nameA },
  { key: "B", name: nameB },
  { key: "C", name: nameC },
];

function CandidateCapturePrototypeInner() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={variants} />
    </>
  );
}

export default function CandidateCapturePrototypePage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-text-muted">Loading prototype…</div>}>
      <CandidateCapturePrototypeInner />
    </Suspense>
  );
}
