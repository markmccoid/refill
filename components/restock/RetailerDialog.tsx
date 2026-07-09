"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface RetailerLike {
  _id: Id<"retailers">;
  name: string;
  baseUrl?: string;
  freeShippingThreshold?: number;
}

/**
 * Create or edit a Retailer inline (ADR-0006: no dedicated retailers page, no
 * delete in v1). Threshold is optional — unset means "we don't know", not $0.
 */
export function RetailerDialog({
  householdId,
  retailer,
  onClose,
}: {
  householdId: Id<"households">;
  retailer: RetailerLike | null; // null = create
  onClose: () => void;
}) {
  const create = useMutation(api.retailers.create);
  const update = useMutation(api.retailers.update);

  const [name, setName] = useState(retailer?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(retailer?.baseUrl ?? "");
  const [threshold, setThreshold] = useState(
    retailer?.freeShippingThreshold?.toString() ?? ""
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const thresholdNum = parseFloat(threshold);
      if (retailer) {
        await update({
          id: retailer._id,
          name: name.trim(),
          baseUrl: baseUrl,
          freeShippingThreshold:
            !Number.isNaN(thresholdNum) && thresholdNum > 0
              ? thresholdNum
              : null,
        });
      } else {
        await create({
          householdId,
          name: name.trim(),
          baseUrl: baseUrl.trim() || undefined,
          freeShippingThreshold:
            !Number.isNaN(thresholdNum) && thresholdNum > 0
              ? thresholdNum
              : undefined,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold">
          {retailer ? "Edit retailer" : "Add retailer"}
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. iHerb"
              autoFocus
              className="mt-1 w-full px-3 py-2 text-sm border border-border-strong rounded-lg bg-surface"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Website (optional)
            </span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://www.iherb.com"
              className="mt-1 w-full px-3 py-2 text-sm border border-border-strong rounded-lg bg-surface"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">
              Free-shipping threshold (optional)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 35"
              className="mt-1 w-full px-3 py-2 text-sm border border-border-strong rounded-lg bg-surface"
            />
            <span className="block text-[11px] text-text-muted mt-1">
              Leave blank if you don&apos;t know — blank means unknown, not $0.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-lg disabled:opacity-50"
          >
            {busy ? "Saving…" : retailer ? "Save" : "Add retailer"}
          </button>
        </div>
      </div>
    </div>
  );
}
