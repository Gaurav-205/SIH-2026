"""Static features per point (computed once): elevation from Open-Meteo's Elevation API
(Copernicus DEM GLO-90), plus coordinates and region.

Slope, aspect, windward index and distance to coast need a gridded DEM and are added when the
pipeline moves from district points to the 0.25 deg grid.

    python -m ml.ingest.static
"""

from __future__ import annotations

import logging

import pandas as pd
import requests

from ml.common import config, path, points
from ml.ingest.budget import Budget

log = logging.getLogger("static")


def main() -> None:
    out = path("data_dir", "static") / "points.parquet"
    if out.exists():
        log.info("already have %s", out)
        return
    cfg = config()
    pts = points()
    Budget(path("cache_dir") / "openmeteo_budget.json", cfg["openmeteo"]["limits"]).acquire(len(pts))
    r = requests.get(cfg["openmeteo"]["elevation_url"], params={
        "latitude": ",".join(str(p.lat) for p in pts),
        "longitude": ",".join(str(p.lon) for p in pts),
    }, timeout=30)
    r.raise_for_status()
    elevation = r.json()["elevation"]
    if len(elevation) != len(pts):
        raise RuntimeError("elevation count mismatch")
    df = pd.DataFrame([{"point_id": p.id, "region": p.region, "name": p.name, "lat": p.lat, "lon": p.lon,
                        "elevation_m": float(e)} for p, e in zip(pts, elevation, strict=True)])
    df.to_parquet(out, index=False)
    log.info("static features for %d points -> %s", len(df), out)


if __name__ == "__main__":
    main()
