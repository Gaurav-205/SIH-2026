import type { Cycle } from "./types";

/** Per-district max and mean of a field, land cells only, sorted by max descending. */
export function byDistrict(cy: Cycle, field: Float32Array) {
  const rows = cy.region.districts.map((d) => ({ name: d.name, max: 0, sum: 0, n: 0, cell: -1 }));
  for (let c = 0; c < field.length; c++) {
    const k = cy.district[c];
    if (k < 0) continue;
    const r = rows[k];
    r.sum += field[c]; r.n++;
    if (field[c] >= r.max) { r.max = field[c]; r.cell = c; }
  }
  return rows.filter((r) => r.n > 0).map((r) => ({ ...r, mean: r.sum / r.n })).sort((a, b) => b.max - a.max);
}

export function districtName(cy: Cycle, c: number) {
  const k = cy.district[c];
  return k >= 0 ? cy.region.districts[k].name : "Sea";
}
