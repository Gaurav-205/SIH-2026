/** IMD rainfall categories and warning colours (official thresholds, mm per 24 h). */

export type AlertLevel = "Yellow" | "Orange" | "Red";

export const IMD_CATEGORIES = [
  { min: 204.5, label: "Extremely heavy", color: "#ef4444" },
  { min: 115.6, label: "Very heavy", color: "#f97316" },
  { min: 64.5, label: "Heavy", color: "#eab308" },
  { min: 35.5, label: "Moderate", color: "#3b82f6" },
  { min: 7.5, label: "Light", color: "#10b981" },
  { min: 0, label: "Very light / none", color: "#94a3b8" },
] as const;

export function imdCategory(mm: number) {
  return IMD_CATEGORIES.find((c) => mm >= c.min) ?? IMD_CATEGORIES[IMD_CATEGORIES.length - 1];
}

export const ALERT_COLORS: Record<AlertLevel, string> = { Red: "#ef4444", Orange: "#f97316", Yellow: "#eab308" };

export const FAMILY_LABEL: Record<string, string> = { physics: "Physics NWP", ai: "AI / ML", ensemble: "Ensemble" };

/** Colour-blind-safe palette assigned to sources in the order the cycle lists them. */
const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00", "#F0E442", "#332288", "#44AA99", "#882255", "#999933", "#AA4499", "#117733"];

export function sourceColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
