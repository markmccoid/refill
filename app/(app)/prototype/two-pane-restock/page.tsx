"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PrototypeSwitcher } from "@/components/prototype/PrototypeSwitcher";
import { VariantA, variantName as nameA } from "@/components/prototype/two-pane-restock/VariantA";
import { VariantB, variantName as nameB } from "@/components/prototype/two-pane-restock/VariantB";
import { VariantC, variantName as nameC } from "@/components/prototype/two-pane-restock/VariantC";

// PROTOTYPE — two-pane Restock decision UI: three variants on ?variant=A|B|C
// Question: how do candidate selection and retailer baskets co-present, replacing the offer grid?

const variants = [
  { key: "A", name: nameA },
  { key: "B", name: nameB },
  { key: "C", name: nameC },
];

function TwoPaneRestockPrototypeInner() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <div className="space-y-2 pb-20">
      <h1 className="text-2xl font-bold tracking-tight">Two-pane Restock prototype</h1>
      <p className="text-sm text-text-muted max-w-3xl">
        Decision-support layout replacing the brand×retailer offer table. Uses locked domain rules:
        one selected candidate per item, cycle-scoped prices, all-in basket totals with shipping,
        soft nudges only.
      </p>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={variants} />
    </div>
  );
}

export default function TwoPaneRestockPrototypePage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-text-muted">Loading prototype…</div>}>
      <TwoPaneRestockPrototypeInner />
    </Suspense>
  );
}
