"use client";

import {
  getSupplementIcon,
  supplementIconClass,
} from "@/lib/supplement-icons";

const SIZE = {
  sm: "w-10 h-10 text-[19px]",
  md: "w-14 h-14 sm:w-16 sm:h-16 text-[26px] sm:text-[30px]",
  lg: "w-20 h-20 text-[34px]",
} as const;

interface SupplementThumbProps {
  iconId?: string | null;
  imageUrl?: string | null;
  name: string;
  size?: keyof typeof SIZE;
  className?: string;
}

/**
 * Prefer catalog icon → product photo → checkerboard placeholder.
 */
export function SupplementThumb({
  iconId,
  imageUrl,
  name,
  size = "md",
  className = "",
}: SupplementThumbProps) {
  const icon = getSupplementIcon(iconId);
  const sizeClass = SIZE[size];

  if (icon) {
    return (
      <div
        className={`supp-icon ${supplementIconClass(icon.id)} ${sizeClass} ${className}`}
        title={icon.label}
        aria-label={`${name} icon`}
      >
        <span aria-hidden>{icon.glyph}</span>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div
        className={`${sizeClass} rounded-lg overflow-hidden border border-border-strong bg-surface-alt flex-shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-lg border border-border-strong bg-surface-alt img-placeholder flex-shrink-0 ${className}`}
      aria-label={`${name} (no image)`}
    />
  );
}
