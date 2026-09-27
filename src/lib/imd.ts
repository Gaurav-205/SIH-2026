/** IMD rainfall categories and warning colours (official thresholds, mm per 24 h). */

export type AlertLevel = "Yellow" | "Orange" | "Red";

export const IMD_CATEGORIES = [
  { min: 204.5, label: "Extremely heavy", color: "#09090b" },
  { min: 115.6, label: "Very heavy", color: "#27272a" },
  { min: 64.5, label: "Heavy", color: "#52525b" },
  { min: 35.5, label: "Moderate", color: "#71717a" },
  { min: 7.5, label: "Light", color: "#a1a1aa" },
  { min: 0, label: "Very light / none", color: "#d4d4d8" },
] as const;

export function imdCategory(mm: number) {
  return IMD_CATEGORIES.find((c) => mm >= c.min) ?? IMD_CATEGORIES[IMD_CATEGORIES.length - 1];
}

export const ALERT_COLORS: Record<AlertLevel, string> = { Red: "#09090b", Orange: "#52525b", Yellow: "#a1a1aa" };

export const FAMILY_LABEL: Record<string, string> = { physics: "Physics NWP", ai: "AI / ML", ensemble: "Ensemble" };

/** Monochrome grayscale palette assigned to sources in the order the cycle lists them. */
const PALETTE = ["#09090b", "#52525b", "#a1a1aa", "#27272a", "#71717a", "#d4d4d8", "#18181b", "#3f3f46", "#8e8e99", "#333338", "#b5b5be", "#4b4b52", "#e4e4e7"];

export function sourceColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
