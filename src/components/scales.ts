type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops: [number, string][]) {
  const s = stops.map(([v, c]) => [v, hex(c)] as [number, RGB]);
  return (v: number): RGB => {
    if (v <= s[0][0]) return s[0][1];
    for (let k = 1; k < s.length; k++) {
      if (v <= s[k][0]) {
        const t = (v - s[k - 1][0]) / (s[k][0] - s[k - 1][0]);
        const a = s[k - 1][1], b = s[k][1];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
    }
    return s[s.length - 1][1];
  };
}
/** Rain in mm/day. Breaks follow IMD categories so colours mean something. */
export const RAIN_STOPS: [number, string][] = [[0, "#F4F8F8"], [7.5, "#CDEBE7"], [35.5, "#6FC2B7"], [64.5, "#16A394"], [115.6, "#0B6F7A"], [204.5, "#173B6B"], [300, "#2A1F5C"]];
export const rainColor = ramp(RAIN_STOPS);
export const probColor = ramp([[0, "#F7F4EE"], [0.2, "#F9E3BE"], [0.5, "#F2A541"], [0.8, "#C7661A"], [1, "#8A3A12"]]);
export const spreadColor = ramp([[0, "#F4F3F8"], [15, "#D7CCEE"], [40, "#A083E0"], [80, "#5B3FA0"], [140, "#2F1F63"]]);
export const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const SEA = "#DCE7EE";
export const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const pct = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 });
