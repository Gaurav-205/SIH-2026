/** Regions the app covers (app configuration, mirrors ml/config.yaml; the live data lists its own points). */
export type RegionId = "konkan" | "kerala";

export const REGIONS: Record<RegionId, { id: RegionId; name: string }> = {
  konkan: { id: "konkan", name: "Konkan, Goa & Ghats" },
  kerala: { id: "kerala", name: "Kerala" },
};
