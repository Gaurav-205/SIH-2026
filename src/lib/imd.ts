// Reference: https://mausam.imd.gov.in/imd_latest/contents/pdf/pubbrochures/Heavy%20Rainfall%20Warning%20Services.pdf
/** IMD rainfall categories and warning colours (official thresholds, mm per 24 h). */

export type AlertLevel = "Yellow" | "Orange" | "Red";

export const IMD_CATEGORIES = [
  { min: 204.5, label: "Extremely heavy", color: "#b42e48" },
  { min: 115.6, label: "Very heavy", color: "#d86a2c" },
  { min: 64.5, label: "Heavy", color: "#d3a62b" },
  { min: 15.6, label: "Moderate", color: "#218e85" },
  { min: 2.5, label: "Light", color: "#73b9af" },
  { min: 0.1, label: "Very light", color: "#c6dfd6" },
  { min: 0, label: "No rain / trace", color: "#e5eee9" },
] as const;

export function imdCategory(mm: number) {
  return IMD_CATEGORIES.find((c) => mm >= c.min) ?? IMD_CATEGORIES[IMD_CATEGORIES.length - 1];
}

export const ALERT_COLORS: Record<AlertLevel, string> = { Red: "#b42e48", Orange: "#d86a2c", Yellow: "#d3a62b" };

export const FAMILY_LABEL: Record<string, string> = { physics: "Physics NWP", ai: "AI / ML", ensemble: "Ensemble" };

/** Distinct categorical palette assigned to sources in the order the cycle lists them. */
const PALETTE = ["#b42e48", "#d3a62b", "#73b9af", "#d86a2c", "#218e85", "#c6dfd6", "#18181b", "#3f3f46", "#8e8e99", "#333338", "#b5b5be", "#4b4b52", "#e4e4e7"];

export function sourceColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
