// Palette offered when adding/editing a person. Stored as the `color` string on
// the person row and used directly as a CSS color for their dot/avatar.

export interface PersonColor {
  name: string; // stored value
  label: string;
  value: string; // CSS color to render
}

export const PERSON_COLORS: PersonColor[] = [
  { name: "green", label: "Green", value: "#22c55e" },
  { name: "amber", label: "Amber", value: "#f59e0b" },
  { name: "blue", label: "Blue", value: "#3b82f6" },
  { name: "violet", label: "Violet", value: "#8b5cf6" },
  { name: "rose", label: "Rose", value: "#f43f5e" },
  { name: "teal", label: "Teal", value: "#14b8a6" },
  { name: "orange", label: "Orange", value: "#f97316" },
  { name: "slate", label: "Slate", value: "#64748b" },
];

/**
 * Resolve a stored color to a renderable CSS color. Maps known palette names
 * (incl. legacy "amber", which isn't a valid CSS keyword) to hex; otherwise
 * passes the value through (covers legacy keywords like "green" and any raw
 * hex already stored).
 */
export function colorValue(stored: string): string {
  const match = PERSON_COLORS.find((c) => c.name === stored);
  return match ? match.value : stored;
}
