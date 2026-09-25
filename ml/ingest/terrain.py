"""Terrain features per point from Copernicus DEM GLO-90 and the Natural Earth coastline.

Sources (anonymous, cached under ml/cache/terrain the first time):
- Copernicus DEM GLO-90 (ESA / Copernicus, free licence), 1 deg COG tiles on AWS Open Data:
  https://copernicus-dem-90m.s3.amazonaws.com/  (all-sea tiles do not exist: treated as sea level)
- Natural Earth 10 m coastline (public domain): https://naciscdn.org/naturalearth/10m/physical/

Per point, the DEM is resampled to `resolution_deg` over two windows: the 0.25 deg forecast cell
("cell", +/- 0.125 deg) and a wider orographic context ("context", +/- context_deg).

Features (ml/data/static/terrain.parquet):
  elev_mean, elev_std, elev_max           cell statistics (m)
  slope_mean_deg                          mean terrain slope in the cell
  aspect_deg                              mean downslope direction in the cell (0 = north, 90 = east)
  windward_index                          mean positive terrain rise along the monsoon flow in the
                                          context window (m per km): high where south-westerlies are forced up
  land_frac                               share of the cell above sea level (DEM > 0.5 m)
  dist_coast_km                           great-circle distance from the point to the nearest coastline vertex
  terrain_class                           coast | windward_slope | crest | plateau | lowland (rules in config)

    python -m ml.ingest.terrain
"""

from __future__ import annotations

import io
import logging
import math
import zipfile

import numpy as np
import pandas as pd
import requests

from ml.common import config, path, points

log = logging.getLogger("terrain")

DEM_URL = "https://copernicus-dem-90m.s3.amazonaws.com/{name}/{name}.tif"
COAST_URL = "https://naciscdn.org/naturalearth/10m/physical/ne_10m_coastline.zip"
EARTH_KM = 6371.0


def tile_name(lat: int, lon: int) -> str:
    ns, ew = ("N" if lat >= 0 else "S"), ("E" if lon >= 0 else "W")
    return f"Copernicus_DSM_COG_30_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def fetch_tile(lat: int, lon: int):
    """Local path of a DEM tile, or None for an all-sea tile (404)."""
    name = tile_name(lat, lon)
    out = path("cache_dir", "terrain", "dem") / f"{name}.tif"
    missing = out.with_suffix(".missing")
    if out.exists():
        return out
    if missing.exists():
        return None
    r = requests.get(DEM_URL.format(name=name), timeout=120)
    if r.status_code in (403, 404):
        missing.touch()
        return None
    r.raise_for_status()
    out.write_bytes(r.content)
    log.info("DEM tile %s (%.1f MB)", name, len(r.content) / 1e6)
    return out


def dem_window(lat: float, lon: float, half: float, res: float) -> np.ndarray:
    """DEM heights on a regular grid (north-up) covering lat/lon +/- half, sea = 0."""
    from rasterio.enums import Resampling
    from rasterio.merge import merge

    bounds = (lon - half, lat - half, lon + half, lat + half)
    tiles = [
        t for la in range(math.floor(lat - half), math.floor(lat + half) + 1)
        for lo in range(math.floor(lon - half), math.floor(lon + half) + 1)
        if (t := fetch_tile(la, lo)) is not None
    ]
    n = round(2 * half / res)
    if not tiles:
        return np.zeros((n, n))
    arr, _ = merge([str(t) for t in tiles], bounds=bounds, res=res, nodata=0.0, resampling=Resampling.average)
    z = arr[0].astype("float64")
    z[~np.isfinite(z)] = 0.0
    return z[:n, :n]


def gradients(z: np.ndarray, lat: float, res: float) -> tuple[np.ndarray, np.ndarray]:
    """dz/dx (east) and dz/dy (north), metres per metre. Row 0 is the northern edge."""
    dx = res * 111_320.0 * math.cos(math.radians(lat))
    dy = res * 110_574.0
    dz_drow, dz_dcol = np.gradient(z, dy, dx)
    return dz_dcol, -dz_drow


def load_coastline() -> np.ndarray:
    """Coastline vertices (lat, lon in radians) within a box around the configured domain."""
    cache = path("cache_dir", "terrain") / "ne_10m_coastline.zip"
    if not cache.exists():
        r = requests.get(COAST_URL, timeout=120)
        r.raise_for_status()
        cache.write_bytes(r.content)
    import shapefile

    with zipfile.ZipFile(cache) as z:
        shp = io.BytesIO(z.read("ne_10m_coastline.shp"))
        shx = io.BytesIO(z.read("ne_10m_coastline.shx"))
        dbf = io.BytesIO(z.read("ne_10m_coastline.dbf"))
        reader = shapefile.Reader(shp=shp, shx=shx, dbf=dbf)
        box = config()["grid"]["india_box"]
        pts = [
            (y, x) for s in reader.shapes() for x, y in s.points
            if box["lat"][0] - 5 <= y <= box["lat"][1] + 5 and box["lon"][0] - 5 <= x <= box["lon"][1] + 5
        ]
    return np.radians(np.array(pts))


def dist_to_coast_km(lat: float, lon: float, coast: np.ndarray) -> float:
    la, lo = math.radians(lat), math.radians(lon)
    d = np.sin((coast[:, 0] - la) / 2) ** 2 + math.cos(la) * np.cos(coast[:, 0]) * np.sin((coast[:, 1] - lo) / 2) ** 2
    return float(2 * EARTH_KM * np.arcsin(np.sqrt(d.min())))


def classify(f: dict, rules: dict) -> str:
    if f["dist_coast_km"] <= rules["coast_km"] and f["elev_mean"] < rules["coast_max_elev_m"]:
        return "coast"
    if f["elev_max"] >= rules["crest_min_elev_m"] and f["slope_mean_deg"] >= rules["crest_min_slope_deg"]:
        return "crest"
    if f["windward_index"] >= rules["windward_min_m_per_km"]:
        return "windward_slope"
    if f["elev_mean"] >= rules["plateau_min_elev_m"]:
        return "plateau"
    return "lowland"


def features(lat: float, lon: float, coast: np.ndarray) -> dict:
    cfg = config()["terrain"]
    res = cfg["resolution_deg"]
    cell = dem_window(lat, lon, 0.125, res)
    gx, gy = gradients(cell, lat, res)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    # downslope direction = opposite of the gradient; circular mean over the cell
    aspect = (math.degrees(math.atan2(-gx.mean(), -gy.mean())) + 360) % 360

    ctx = dem_window(lat, lon, cfg["context_deg"], res)
    cx, cy = gradients(ctx, lat, res)
    to = math.radians((cfg["monsoon_flow_from_deg"] + 180) % 360)  # direction the flow blows towards
    rise = cx * math.sin(to) + cy * math.cos(to)                    # m per m along the flow
    land = ctx > 0.5
    windward = float(np.clip(rise[land], 0, None).mean() * 1000) if land.any() else 0.0

    f = {
        "elev_mean": float(cell.mean()), "elev_std": float(cell.std()), "elev_max": float(cell.max()),
        "slope_mean_deg": float(slope.mean()), "aspect_deg": aspect, "windward_index": windward,
        "land_frac": float((cell > 0.5).mean()), "dist_coast_km": dist_to_coast_km(lat, lon, coast),
    }
    f["terrain_class"] = classify(f, cfg["classes"])
    return f


def main() -> None:
    coast = load_coastline()
    rows = []
    for p in points():
        rows.append({"point_id": p.id, "region": p.region, "lat": p.lat, "lon": p.lon, **features(p.lat, p.lon, coast)})
        log.info("%s: %s", p.id, rows[-1]["terrain_class"])
    df = pd.DataFrame(rows)
    out = path("data_dir", "static") / "terrain.parquet"
    df.to_parquet(out, index=False)
    with pd.option_context("display.width", 200, "display.max_columns", 20):
        print(df.drop(columns=["lat", "lon"]).round(1).to_string(index=False))


if __name__ == "__main__":
    main()
