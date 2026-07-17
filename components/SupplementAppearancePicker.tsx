"use client";

import { useEffect, useState } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { SupplementThumb } from "@/components/SupplementThumb";
import {
  getSupplementIcon,
  SUPPLEMENT_ICONS,
  supplementIconClass,
} from "@/lib/supplement-icons";

interface SupplementAppearancePickerProps {
  iconId?: string;
  imageUrl?: string;
  name?: string;
  onChange: (next: { iconId?: string; imageUrl?: string }) => void;
}

type Mode = "icon" | "photo";

export function SupplementAppearancePicker({
  iconId,
  imageUrl,
  name = "Supplement",
  onChange,
}: SupplementAppearancePickerProps) {
  const [mode, setMode] = useState<Mode>(imageUrl && !iconId ? "photo" : "icon");
  // Accordion starts open when nothing is chosen yet.
  const [iconsOpen, setIconsOpen] = useState(!iconId);

  useEffect(() => {
    if (iconId) setIconsOpen(false);
  }, [iconId]);

  const selected = getSupplementIcon(iconId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold text-text-label">Appearance</label>
        <div className="flex gap-1 p-0.5 rounded-lg bg-surface-alt border border-border-strong">
          <button
            type="button"
            onClick={() => setMode("icon")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mode === "icon"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Icon
          </button>
          <button
            type="button"
            onClick={() => setMode("photo")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mode === "photo"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Photo
          </button>
        </div>
      </div>

      {mode === "icon" ? (
        <div className="border border-border-strong rounded-xl overflow-hidden bg-surface">
          <button
            type="button"
            onClick={() => setIconsOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-alt transition-colors"
            aria-expanded={iconsOpen}
          >
            <SupplementThumb
              iconId={iconId}
              imageUrl={undefined}
              name={name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">
                {selected ? selected.label : "Choose an icon"}
              </div>
              <div className="text-[12px] text-text-muted">
                {selected
                  ? "Tap to change"
                  : "Colorful tiles for a cleaner list"}
              </div>
            </div>
            <span className="text-text-faint text-xs flex-shrink-0">
              {iconsOpen ? "▾" : "▸"}
            </span>
          </button>

          {iconsOpen && (
            <div className="border-t border-border-strong px-3 py-3 bg-surface-alt">
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {SUPPLEMENT_ICONS.map((icon) => {
                  const isSelected = iconId === icon.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      title={icon.label}
                      onClick={() => {
                        onChange({
                          iconId: isSelected ? undefined : icon.id,
                          imageUrl: undefined,
                        });
                        if (!isSelected) setIconsOpen(false);
                      }}
                      className={`supp-icon ${supplementIconClass(icon.id)} w-full aspect-square text-[16px] sm:text-[18px] rounded-md transition-shadow ${
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-bg"
                          : "hover:ring-2 hover:ring-primary/30"
                      }`}
                    >
                      <span aria-hidden>{icon.glyph}</span>
                    </button>
                  );
                })}
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ iconId: undefined, imageUrl: undefined });
                    setIconsOpen(true);
                  }}
                  className="mt-2 text-xs text-text-muted hover:text-critical"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <SupplementThumb
              iconId={undefined}
              imageUrl={imageUrl}
              name={name}
              size="sm"
            />
            <p className="text-[12.5px] text-text-muted leading-relaxed">
              Upload or drag a product photo. Switching back to Icon will
              replace it.
            </p>
          </div>
          <ImageUploader
            imageUrl={imageUrl}
            onImageChange={(url) =>
              onChange({
                imageUrl: url || undefined,
                iconId: url ? undefined : iconId,
              })
            }
            label="Product photo (optional)"
          />
        </div>
      )}
    </div>
  );
}
