# 0003: IMD gridded truth, 03 UTC rain day, offset measured

**Context.** NCMRWF and IMD scientists trust IMD's gauge-based 0.25° rain grid. IMD's rain day ends at
03 UTC (08:30 IST), while models are usually summed 00–00 UTC.

**Decision.**
- Score rain against IMD grids only.
- Build every forecast day as the 24 h ending 03 UTC (from hourly totals, or from exactly integrated
  step rates).
- Measure, rather than assume, the date label that matches IMD's files. Offset 0 won for all 9 models
  on 29k point-days.

**Consequences.** IMD's final grids arrive yearly, so 2026 uses IMD's real-time grids until then. Every
report names its truth.
