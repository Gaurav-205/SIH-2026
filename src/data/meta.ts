import type { Region, Source } from "./types";

export const SOURCES: Source[] = [
  { id: "IFS", name: "ECMWF IFS", family: "physics", note: "Global physics model, 9 km" },
  { id: "GFS", name: "NCEP GFS", family: "physics", note: "Global physics model, 13 km" },
  { id: "NCUM", name: "NCMRWF NCUM", family: "physics", note: "India's unified model" },
  { id: "ENS", name: "IFS ensemble mean", family: "ensemble", note: "Mean of 50 members" },
  { id: "AIFS", name: "ECMWF AIFS", family: "ai", note: "Machine-learned global model" },
  { id: "GraphCast", name: "GraphCast", family: "ai", note: "Machine-learned global model" },
];

export const FAMILY_COLOR = { physics: "#5B8DEF", ensemble: "#A083E0", ai: "#49C08A" } as const;
export const FAMILY_LABEL = { physics: "Physics", ensemble: "Ensemble", ai: "AI" } as const;
export const SOURCE_COLOR: Record<string, string> = {
  IFS: "#5B8DEF", GFS: "#3E6FD0", NCUM: "#8FB2F5", ENS: "#A083E0", AIFS: "#49C08A", GraphCast: "#2E9C6C",
};

export const THRESHOLDS = [
  { mm: 64.5, label: "Heavy", long: "heavy rain (64.5 mm or more)" },
  { mm: 115.6, label: "Very heavy", long: "very heavy rain (115.6 mm or more)" },
  { mm: 204.5, label: "Extremely heavy", long: "extremely heavy rain (204.5 mm or more)" },
];

export const REGIONS: Record<string, Region> = {
  konkan: {
    id: "konkan", name: "Konkan and Goa", lat0: 14.75, lon0: 72.5, nLat: 26, nLon: 15, step: 0.25,
    districts: [
      { name: "Palghar", lat: 19.8, lon: 72.9 }, { name: "Thane", lat: 19.3, lon: 73.2 },
      { name: "Mumbai", lat: 19.05, lon: 72.87 }, { name: "Raigad", lat: 18.4, lon: 73.1 },
      { name: "Ratnagiri", lat: 17.2, lon: 73.4 }, { name: "Sindhudurg", lat: 16.1, lon: 73.6 },
      { name: "North Goa", lat: 15.6, lon: 73.9 }, { name: "South Goa", lat: 15.1, lon: 74.1 },
      { name: "Nashik ghats", lat: 20.0, lon: 73.8 }, { name: "Pune ghats", lat: 18.6, lon: 73.7 },
      { name: "Satara ghats", lat: 17.6, lon: 73.9 }, { name: "Kolhapur ghats", lat: 16.6, lon: 74.0 },
      { name: "Belagavi", lat: 15.9, lon: 74.6 }, { name: "Pune plains", lat: 18.5, lon: 74.4 },
      { name: "Nashik plains", lat: 20.0, lon: 74.4 },
    ],
  },
  kerala: {
    id: "kerala", name: "Kerala", lat0: 8.25, lon0: 74.75, nLat: 20, nLon: 12, step: 0.25,
    districts: [
      { name: "Kasaragod", lat: 12.5, lon: 75.1 }, { name: "Kannur", lat: 11.9, lon: 75.5 },
      { name: "Wayanad", lat: 11.7, lon: 76.1 }, { name: "Kozhikode", lat: 11.3, lon: 75.9 },
      { name: "Malappuram", lat: 11.0, lon: 76.1 }, { name: "Palakkad", lat: 10.8, lon: 76.6 },
      { name: "Thrissur", lat: 10.5, lon: 76.2 }, { name: "Ernakulam", lat: 10.0, lon: 76.4 },
      { name: "Idukki", lat: 9.9, lon: 77.0 }, { name: "Kottayam", lat: 9.6, lon: 76.6 },
      { name: "Alappuzha", lat: 9.4, lon: 76.4 }, { name: "Pathanamthitta", lat: 9.3, lon: 76.9 },
      { name: "Kollam", lat: 8.9, lon: 76.7 }, { name: "Thiruvananthapuram", lat: 8.5, lon: 77.0 },
    ],
  },
};

export const DATES = [
  { date: "2025-07-14", regime: "Monsoon active", intensity: 1.0 },
  { date: "2025-07-15", regime: "Offshore trough, heavy spells", intensity: 1.45 },
  { date: "2025-07-16", regime: "Offshore trough, heavy spells", intensity: 1.55 },
  { date: "2025-07-17", regime: "Monsoon active", intensity: 1.1 },
  { date: "2025-07-18", regime: "Weakening, break likely", intensity: 0.55 },
];
