"""M1 report: data coverage, IMD rain-day alignment, and truth caveats.

    python -m ml.evaluate.m1_report      # writes ml/reports/m1_report.md and m1_coverage.csv
"""

from __future__ import annotations

import datetime as dt
import logging

import numpy as np
import pandas as pd

from ml.common import path, points, sources

log = logging.getLogger("m1")


def load_forecasts() -> pd.DataFrame:
    files = sorted(path("data_dir", "forecasts").glob("source=*/chunk*.parquet"))
    if not files:
        raise SystemExit("no forecast chunks yet; run python -m ml.ingest.openmeteo --run")
    df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    df["date"] = pd.to_datetime(df["date"])
    return df


def load_truth(var: str) -> pd.DataFrame:
    df = pd.read_parquet(path("data_dir", "truth") / f"imd_{var}.parquet")
    df["date"] = pd.to_datetime(df["date"])
    return df


def coverage(fc: pd.DataFrame) -> pd.DataFrame:
    """% non-missing per source x lead x month (rain), over the dates each source should have."""
    rain = fc[fc["var"] == "rain"].copy()
    rain["month"] = rain["date"].dt.to_period("M").astype(str)
    return (rain.groupby(["source", "lead", "month"])["value"]
            .apply(lambda v: round(100 * v.notna().mean(), 1)).rename("pct_non_missing").reset_index())


def alignment(fc: pd.DataFrame, truth: pd.DataFrame, offsets=(-1, 0, 1)) -> pd.DataFrame:
    """Correlate IMD day D with lead-1 forecast windows labelled D + k (monsoon months only).

    Our forecast rain for label E is the 24 h ending 03 UTC on E. If IMD's day D is that same
    window, k = 0 correlates best; if IMD labels it by the start date, k = +1 wins.
    """
    f1 = fc[(fc["var"] == "rain") & (fc["lead"] == 1)][["point_id", "date", "source", "value"]]
    t = truth[truth["date"].dt.month.between(6, 9)][["point_id", "date", "value"]].rename(columns={"value": "obs"})
    rows = []
    for k in offsets:
        shifted = f1.assign(date=f1["date"] - pd.Timedelta(days=k))
        m = shifted.merge(t, on=["point_id", "date"]).dropna()
        for src, g in list(m.groupby("source")) + [("ALL sources", m)]:
            if len(g) < 100:
                continue
            rows.append({
                "source": src, "offset_k": k, "n": len(g),
                "pearson_log1p": np.corrcoef(np.log1p(g["value"]), np.log1p(g["obs"]))[0, 1],
            })
    return pd.DataFrame(rows, columns=["source", "offset_k", "n", "pearson_log1p"])


def duplicate_cells(truth: pd.DataFrame) -> list[tuple[str, ...]]:
    cells = truth.groupby("point_id")[["cell_lat", "cell_lon"]].first()
    groups = cells.groupby(["cell_lat", "cell_lon"]).groups
    return [tuple(sorted(ids)) for ids in groups.values() if len(ids) > 1]


def quality_log() -> pd.DataFrame:
    """Values masked as physically impossible during ingestion (see ingest.daily.mask_implausible)."""
    files = sorted(path("data_dir", "quality").glob("removed_*.parquet"))
    if not files:
        return pd.DataFrame()
    q = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    if "source" not in q:
        q["source"] = "era5"
    return (q.groupby(["source", "var"])
            .agg(values=("value", "size"), min=("value", "min"), max=("value", "max"),
                 first=("date", "min"), last=("date", "max"))
            .reset_index())


def md_table(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    out = ["| " + " | ".join(map(str, cols)) + " |", "|" + "---|" * len(cols)]
    for _, r in df.iterrows():
        out.append("| " + " | ".join(str(round(v, 3)) if isinstance(v, float) else str(v) for v in r) + " |")
    return "\n".join(out)


def main() -> None:
    fc = load_forecasts()
    rain_truth = load_truth("rain")
    tmax_truth = load_truth("tmax")
    rep = path("reports_dir")

    cov = coverage(fc)
    cov.to_csv(rep / "m1_coverage.csv", index=False)
    pivot = cov.pivot_table(index="source", columns="lead", values="pct_non_missing", aggfunc="mean").round(1)
    months = cov.groupby("source")["month"].agg(["min", "max", "nunique"]).rename(
        columns={"min": "first month", "max": "last month", "nunique": "months"})
    summary = months.join(pivot).reset_index()

    al = alignment(fc, rain_truth)
    pooled = al[al["source"] == "ALL sources"].sort_values("pearson_log1p", ascending=False)
    best_k = int(pooled.iloc[0]["offset_k"]) if len(pooled) else None
    per_src = al[al["source"] != "ALL sources"]
    per_src_best = (per_src.loc[per_src.groupby("source")["pearson_log1p"].idxmax(), "offset_k"].value_counts().to_dict()
                    if len(per_src) else {})

    rows_by_src = fc.groupby("source").size().rename("rows")
    dup = duplicate_cells(rain_truth)
    dup_t = duplicate_cells(tmax_truth)
    jjas = rain_truth[rain_truth["date"].dt.month.between(6, 9)]
    totals = jjas.groupby([jjas["date"].dt.year, "point_id"])["value"].sum().unstack(0).round(0)

    lines = [
        "# M1 report: data ingestion",
        f"_Generated {dt.datetime.now(dt.UTC):%Y-%m-%d %H:%M} UTC from the files in ml/data._",
        "",
        "## Scope",
        f"- Points: {len(points())} district centroids (Konkan-Goa and Kerala), same list as the website.",
        f"- Sources configured: {len(sources())}; sources with data so far: {fc['source'].nunique()}.",
        f"- Forecast rows: {len(fc):,} (point x date x source x lead x variable); dates "
        f"{fc['date'].min():%Y-%m-%d} to {fc['date'].max():%Y-%m-%d}.",
        f"- Truth: IMD 0.25° rain and 1.0° Tmax, {rain_truth['date'].min():%Y-%m-%d} to {rain_truth['date'].max():%Y-%m-%d}.",
        "",
        "## Forecast coverage (rain, % non-missing by lead)",
        "Coverage below 100% at lead 5 near a source's first date is expected: day-5 values start ~4 days after day-1.",
        "",
        md_table(summary),
        "",
        "Full model x lead x month table: `m1_coverage.csv`.",
        "",
        "## IMD rain-day alignment (measured, not assumed)",
        "Our daily forecast rain for date E is the 24 h ending 03 UTC on E (IMD's 08:30 IST observation time).",
        "Correlation of log(1 + rain) between IMD day D and lead-1 forecasts labelled D + k, June–September:",
        "",
        md_table(pooled.round(3)) if len(pooled) else "_Not enough monsoon forecast data yet._",
        "",
        (f"**Result:** offset k = {best_k:+d} fits best pooled over sources; per source, best offsets: {per_src_best}. "
         + ("IMD's day D is the 24 h ending 03 UTC on D, matching the pipeline default (`rain_label_offset_days: 0`)."
            if best_k == 0 else
            f"Set `rain_label_offset_days: {best_k}` in config.yaml and re-aggregate."))
        if best_k is not None else "",
        "",
        "## Data quality: values removed",
        "Physically impossible values are set to missing (never used for training) and logged in ml/data/quality/.",
        "Known case: CMA GRAPES `temperature_2m` reads about -48 °C over Maharashtra from 18 Apr to 4 May 2024,",
        "most likely an upper-air field in the provider archive; its rain and wind for those days look normal and are kept.",
        "ARPEGE: the archive has no 10 m wind and its ~4-day runs end inside the day-4 window, so it is used for leads 1-3 only.",
        "",
        md_table(q) if len(q := quality_log()) else "_Nothing removed._",
        "",
        "## Truth caveats",
        f"- District centroids sharing one IMD 0.25° cell (identical rain truth): {dup or 'none'}.",
        f"- At 1.0° many districts share a Tmax cell ({len(dup_t)} shared groups); Tmax truth is regional, not district-level.",
        "- IMD grids are land-only: coastal centroids use the nearest land cell (distance stored per point).",
        "- Check suspicious monsoon totals against district records; centroids came from the website demo and need",
        "  verification against Survey of India boundaries before M2.",
        "",
        "### June–September IMD rain totals (mm) at each point",
        "",
        md_table(totals.reset_index().rename(columns={"point_id": "point"})),
        "",
        "## Rows per source",
        "",
        md_table(rows_by_src.reset_index()),
        "",
    ]
    (rep / "m1_report.md").write_text("\n".join(lines), encoding="utf-8")
    log.info("wrote %s", rep / "m1_report.md")


if __name__ == "__main__":
    main()
