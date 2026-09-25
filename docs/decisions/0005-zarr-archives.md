# 0005: dynamical.org Zarr archives for AIFS 2024 and full ensembles

**Context.** Open-Meteo's AIFS archive starts 2025-02-17, so the 2024 training year had no AI model.
Open-Meteo keeps ensemble members for only about 3 days.

**Decision.** Read ECMWF AIFS (from 2024-04-01) and NOAA GEFS (31 members) from dynamical.org's
anonymous Zarr archives, at the same points and on the same day conventions. The AIFS back-fill stops
at the run of 2025-02-15, so it never overlaps the Open-Meteo archive, and the loader prefers
Open-Meteo on any overlap. IFS ENS (51 members) is configured but disabled until approved, because it is
a ~70 min backfill.

**Consequences.** An AI model is present in training, and ensemble spread and member-counted
probabilities become features. Validation on July 2024: AIFS had the best lead-1 correlation with IMD
(0.72), with its mean within 0.5 mm of IMD. IMERG from the same provider needs Icechunk v2, which the
stable library cannot read yet.
