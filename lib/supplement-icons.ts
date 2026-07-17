/**
 * Playful catalog icons for supplements (mockup-style thumbs). Stored as
 * `supplements.iconId`. Gradients live in globals.css as `.supp-icon-*`.
 */

export interface SupplementIcon {
  id: string;
  label: string;
  glyph: string;
}

export const SUPPLEMENT_ICONS: SupplementIcon[] = [
  { id: "sun", label: "Sun", glyph: "☀️" },
  { id: "fish", label: "Fish", glyph: "🐟" },
  { id: "leaf", label: "Leaf", glyph: "🌿" },
  { id: "droplet", label: "Droplet", glyph: "💧" },
  { id: "zap", label: "Energy", glyph: "⚡" },
  { id: "moon", label: "Moon", glyph: "🌙" },
  { id: "shield", label: "Shield", glyph: "🛡️" },
  { id: "flame", label: "Flame", glyph: "🔥" },
  { id: "heart", label: "Heart", glyph: "❤️" },
  { id: "sparkle", label: "Sparkle", glyph: "✨" },
  { id: "pill", label: "Pill", glyph: "💊" },
  { id: "flask", label: "Flask", glyph: "🧪" },
  { id: "bone", label: "Bone", glyph: "🦴" },
  { id: "brain", label: "Brain", glyph: "🧠" },
  { id: "muscle", label: "Muscle", glyph: "💪" },
  { id: "apple", label: "Apple", glyph: "🍎" },
  { id: "dna", label: "DNA", glyph: "🧬" },
  { id: "microscope", label: "Microscope", glyph: "🔬" },
  { id: "tea", label: "Tea", glyph: "🍵" },
  { id: "berry", label: "Berry", glyph: "🫐" },
  { id: "balance", label: "Balance", glyph: "⚖️" },
  { id: "seed", label: "Seed", glyph: "🌱" },
  { id: "eye", label: "Eye", glyph: "👁️" },
  { id: "lotus", label: "Lotus", glyph: "🪷" },
];

const byId = new Map(SUPPLEMENT_ICONS.map((i) => [i.id, i]));

export function getSupplementIcon(iconId?: string | null): SupplementIcon | null {
  if (!iconId) return null;
  return byId.get(iconId) ?? null;
}

/** CSS class for the icon's gradient tile (defined in globals.css). */
export function supplementIconClass(iconId: string): string {
  return `supp-icon-${iconId}`;
}
