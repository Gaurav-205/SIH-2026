# M1 report: data ingestion
_Generated 2026-09-25 14:34 UTC from the files in ml/data._

## Scope
- Points: 29 district centroids (Konkan-Goa and Kerala), same list as the website.
- Sources configured: 13; sources with data so far: 8.
- Forecast rows: 315,462 (point x date x source x lead x variable); dates 2024-01-01 to 2024-06-30.
- Truth: IMD 0.25° rain and 1.0° Tmax, 2024-01-01 to 2025-12-31.

## Forecast coverage (rain, % non-missing by lead)
Coverage below 100% at lead 5 near a source's first date is expected: day-5 values start ~4 days after day-1.

| source | first month | last month | months | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|---|
| bom_access_global | 2024-01 | 2024-06 | 6 | 97.4 | 96.1 | 94.9 | 93.6 | 91.2 |
| cma_grapes_global | 2024-01 | 2024-06 | 6 | 97.4 | 96.1 | 94.9 | 93.6 | 91.2 |
| ecmwf_ifs025 | 2024-02 | 2024-03 | 2 | 96.3 | 94.4 | 92.6 | 90.8 | 88.9 |
| gem_global | 2024-01 | 2024-03 | 3 | 94.9 | 92.3 | 89.7 | 87.2 | 84.6 |
| gfs_global | 2024-01 | 2024-03 | 3 | 94.9 | 92.3 | 89.7 | 87.2 | 84.6 |
| icon_global | 2024-01 | 2024-03 | 3 | 94.9 | 92.3 | 89.7 | 87.2 | 84.6 |
| jma_gsm | 2024-01 | 2024-03 | 3 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| meteofrance_arpege_world | 2024-01 | 2024-03 | 3 | 94.9 | 92.3 | 89.7 | nan | nan |

Full model x lead x month table: `m1_coverage.csv`.

## IMD rain-day alignment (measured, not assumed)
Our daily forecast rain for date E is the 24 h ending 03 UTC on E (IMD's 08:30 IST observation time).
Correlation of log(1 + rain) between IMD day D and lead-1 forecasts labelled D + k, June–September:

| source | offset_k | n | pearson_log1p |
|---|---|---|---|
| ALL sources | 0 | 1740 | 0.562 |
| ALL sources | -1 | 1798 | 0.508 |
| ALL sources | 1 | 1682 | 0.493 |

**Result:** offset k = +0 fits best pooled over sources; per source, best offsets: {0: 2}. IMD's day D is the 24 h ending 03 UTC on D, matching the pipeline default (`rain_label_offset_days: 0`).

## Data quality: values removed
Physically impossible values are set to missing (never used for training) and logged in ml/data/quality/.
Known case: CMA GRAPES `temperature_2m` reads about -48 °C over Maharashtra from 18 Apr to 4 May 2024,
most likely an upper-air field in the provider archive; its rain and wind for those days look normal and are kept.
ARPEGE: the archive has no 10 m wind and its ~4-day runs end inside the day-4 window, so it is used for leads 1-3 only.

| source | var | values | min | max | first | last |
|---|---|---|---|---|---|---|
| cma_grapes_global | tmax | 1798 | -61.965 | -31.527 | 2024-04-18 | 2024-05-04 |

## Truth caveats
- District centroids sharing one IMD 0.25° cell (identical rain truth): [('alappuzha', 'kottayam')].
- At 1.0° many districts share a Tmax cell (10 shared groups); Tmax truth is regional, not district-level.
- IMD grids are land-only: coastal centroids use the nearest land cell (distance stored per point).
- Check suspicious monsoon totals against district records; centroids came from the website demo and need
  verification against Survey of India boundaries before M2.

### June–September IMD rain totals (mm) at each point

| point | 2024 | 2025 |
|---|---|---|
| alappuzha | 1622.0 | 1757.0 |
| belagavi | 842.0 | 611.0 |
| ernakulam | 2013.0 | 2357.0 |
| idukki | 1979.0 | 2153.0 |
| kannur | 2953.0 | 2935.0 |
| kasaragod | 2816.0 | 3254.0 |
| kolhapur-ghats | 1970.0 | 2729.0 |
| kollam | 1308.0 | 1435.0 |
| kottayam | 1622.0 | 1757.0 |
| kozhikode | 1869.0 | 1798.0 |
| malappuram | 1966.0 | 1754.0 |
| mumbai | 2848.0 | 2638.0 |
| nashik-ghats | 782.0 | 927.0 |
| nashik-plains | 532.0 | 612.0 |
| north-goa | 5272.0 | 3779.0 |
| palakkad | 1599.0 | 1446.0 |
| palghar | 3144.0 | 3321.0 |
| pathanamthitta | 511.0 | 459.0 |
| pune-ghats | 1130.0 | 889.0 |
| pune-plains | 529.0 | 471.0 |
| raigad | 3975.0 | 3494.0 |
| ratnagiri | 4309.0 | 3380.0 |
| satara-ghats | 1434.0 | 781.0 |
| sindhudurg | 4259.0 | 3021.0 |
| south-goa | 4326.0 | 3119.0 |
| thane | 3230.0 | 3903.0 |
| thiruvananthapuram | 705.0 | 682.0 |
| thrissur | 1980.0 | 2076.0 |
| wayanad | 1228.0 | 1159.0 |

## Rows per source

| source | rows |
|---|---|
| bom_access_global | 71340 |
| cma_grapes_global | 71340 |
| ecmwf_ifs025 | 25230 |
| gem_global | 31755 |
| gfs_global | 31755 |
| icon_global | 31755 |
| jma_gsm | 39585 |
| meteofrance_arpege_world | 12702 |
