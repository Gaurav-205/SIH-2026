# Data sources

Every dataset below is free, and its licence allows this research use. Each was verified by
downloading real data before it went into the pipeline; the "verified" column gives the date.
Configuration lives in [`ml/config.yaml`](../ml/config.yaml).

## In use

### Forecasts

| Dataset | Models | Coverage used | Access | Licence | Verified |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [Open-Meteo Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api) | ECMWF IFS 0.25° & 9 km, NCEP GFS, DWD ICON, JMA GSM, CMA GRAPES, ECCC GEM, Météo-France ARPEGE, BOM ACCESS-G (discontinued 2025-06), UKMO 10 km, ECMWF AIFS, NCEP AIGFS, NCEP HGEFS mean | from each model's first archived day (2024-01 onwards; see `sources:` in config) | HTTP JSON, no key; free tier 10,000 weighted calls/day | CC BY 4.0, non-commercial | 2026-09-25 |
| [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | same models, live runs | latest run, days 1–5 | HTTP JSON | CC BY 4.0 | 2026-09-25 |
| [dynamical.org](https://dynamical.org/catalog/) ECMWF AIFS Single | ECMWF's AI model | 2024-04-01 → 2025-02-15 (Open-Meteo's AIFS archive starts 2025-02-17) | anonymous Zarr v3 over HTTPS | CC BY 4.0 (ECMWF data) | 2026-09-26 |
| dynamical.org NOAA GEFS 35-day | 31-member ensemble | 2024-01-01 onwards | anonymous Zarr | CC BY 4.0 (NOAA data) | 2026-09-26 |
| dynamical.org ECMWF IFS ENS 15-day | 51-member ensemble | from 2024-04-01 (disabled until approved: ~70 min backfill) | anonymous Zarr | CC BY 4.0 + ECMWF terms | 2026-09-26 |

Open-Meteo variables are `precipitation`, `temperature_2m` and `wind_speed_10m`, with the suffix
`_previous_dayL`, which is the value predicted about L × 24 h before the valid hour. dynamical.org
stores `precipitation_surface` as an average rate over each forecast step. It is integrated exactly
over IMD's 03–03 UTC day (see [methodology](methodology.md#day-conventions)).

**Validation of the Zarr back-fill (July 2024, lead 1, 29 districts).** AIFS correlates 0.72 with IMD
rain, against 0.60 for IFS and 0.57 for GFS. Its mean is 31.1 mm against IMD's 31.6 mm, which confirms
the units and the day window.

### Truth and climatology

| Dataset | Grid | Used for | Access | Licence |
| :--- | :--- | :--- | :--- | :--- |
| IMD gridded daily rainfall (final) | 0.25° | primary rain truth 2024–2025; the scorecards are always scored against this | [imdlib](https://pypi.org/project/imdlib/) from imdpune.gov.in, mirrored in `ml/cache/imd` | IMD, free for research |
| IMD real-time daily rainfall and Tmax | 0.25° / 1° | truth for 2026 until the final grids are released | imdlib real-time files | IMD |
| IMD gridded Tmax (final) | 1.0° | temperature truth | imdlib | IMD |
| IMD 1991–2020 rain and Tmax | 0.25° / 1° | WMO-standard normal: climatological probabilities (the Brier-skill reference), 95th percentiles, regime anomalies | imdlib, one year at a time | IMD |
| ERA5 (via Open-Meteo Historical Weather API) | 0.25° | wind truth. The ingester (`ml/ingest/era5.py`) is written but runs only after the archive backfill, because they share the daily budget. Until then wind is shown unverified, with equal weights. | HTTP JSON | CC BY 4.0 (Copernicus) |

Truth values are taken from the IMD cell nearest each district centroid that has data on at least 90%
of days. IMD grids are land-only, so a coastal centroid can map to a neighbouring cell. The chosen cell
is stored with every value.

### Static and Environmental Telemetry

| Dataset | Used for | Access | Licence |
| :--- | :--- | :--- | :--- |
| [Copernicus DEM GLO-90](https://registry.opendata.aws/copernicus-dem/) | elevation, slope, aspect, windward index, land fraction | anonymous COG tiles on AWS | Copernicus DEM licence (free) |
| [Natural Earth 10 m coastline](https://www.naturalearthdata.com/) | distance to coast | direct download | public domain |
| Open-Meteo Elevation API | point elevation shown on the website | HTTP JSON | CC BY 4.0 |
| Open-Meteo Air Quality API (CAMS / SAFAR) | PM2.5, PM10, European AQI, UV index for Pune & Mumbai | HTTP JSON | CC BY 4.0 |
| Open-Meteo Marine API | Arabian Sea swell, wave height, wave period for coastal Maharashtra (Mumbai, MMR) | HTTP JSON | CC BY 4.0 |
| Catchment Hydrology (Open-Meteo) | Topsoil moisture (0–1 cm), atmospheric pressure, relative humidity | HTTP JSON | CC BY 4.0 |
| IMD Doppler Weather Radar (DWR) & INSAT-3D | Real-time nowcasts from IMD Pune (Pashan) & IMD Mumbai radars | Public IMD Mausam Portal | IMD Public Service |

## Evaluated but not used (yet), and why

| Dataset | Status | Reason / next step |
| :--- | :--- | :--- |
| NASA GPM IMERG Late (dynamical.org mirror) | blocked by tooling | Published only in Icechunk v2 format. The stable `icechunk` (1.1.x) cannot read it, and the 2.0 alpha fails on the manifest. Retry when icechunk 2.0 is released. NASA's own copy needs an Earthdata login (ask first). |
| Open-Meteo Ensemble API (incl. Google WeatherNext 2) | not used for history | It keeps only about 3 days of members. Usable for live spread, but GEFS/IFS ENS from Zarr covers training. |
| IMDAA 12 km reanalysis (NCMRWF) | needs registration | Registration on the NCMRWF Data Web Portal is a credential step: ask first. |
| NCUM-G, NEPS-G (NCMRWF), BharatFS (IMD) | not public | Request letter via the college nodal centre / SIH SPOC. A loader slots into the same Parquet layout. |
| IMD district warnings API | needs IP whitelisting | Apply to IMD. The site links IMD's public warnings meanwhile. |
| CHIRPS v3 daily | candidate second rain truth | It uses IMERG or ERA5 to split pentads into days, so it is not independent at daily scale. It adds little over IMD for the scorecard. |
| WeatherBench 2 (IFS HRES 2016–2022) | optional, Track B | Longer ECMWF history for robustness. Not needed for the 2024–2025 multi-model study. |

## Rate limits and caching

- **Open-Meteo:** every request is weighted as locations × max(1, variables/10) × max(1, days/14).
  `ml/ingest/budget.py` keeps a persistent log (`ml/cache/openmeteo_budget.json`) and never exceeds 500
  calls/min, 4,500 calls/h or 9,900 calls/day. The archive backfill stops at 8,500 a day, which leaves
  room for the live cycle. HTTP responses are cached forever (`ml/cache/openmeteo_http.sqlite`).
- **Newest archive chunk:** it is extended day by day rather than re-downloaded, which saves about 290
  calls per model per day.
- **dynamical.org:** there is no quota. Reads are parallel (6 workers) and stored as one Parquet file
  per source and month.
- **IMD:** yearly files are mirrored locally the first time, because imdpune.gov.in is sometimes offline.
