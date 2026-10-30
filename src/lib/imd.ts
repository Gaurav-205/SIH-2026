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

/**
 * Categorical palette assigned to sources in the order the cycle lists them. It deliberately avoids the
 * IMD warning hues (yellow, orange, red) and the rain-category teals, so a model colour is never read as
 * a hazard level, and every colour stays visible on both light and dark backgrounds.
 */
const PALETTE = ["#2f6fde", "#8b5cf6", "#d0468c", "#0891b2", "#65a30d", "#7c5a3a", "#4f46e5", "#be185d", "#15803d", "#64748b", "#a21caf", "#0369a1"];

export function sourceColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
