# 0001: Open-Meteo Previous Runs API as the primary forecast archive

**Context.** Blending needs each model's past forecasts at fixed lead times, for two monsoons at least.
Gridded archives (WeatherBench 2, the ECMWF MARS archive) cover only some models, or need accounts
and GRIB decoding.

**Decision.** Use Open-Meteo's Previous Runs API, which has about a dozen physics and AI models at leads of
1–7 days, archived from 2024 for most. It is plain JSON, keyless, and CC BY 4.0.

**Consequences.**
- The free tier (10,000 weighted calls/day) makes the backfill take several days, so the budget is
  enforced in code and the work resumes across days.
- Coverage differs by model; each model's first archived date was verified before any bulk download.
- Non-commercial only: any paid product needs Open-Meteo's commercial plan or self-hosting.
