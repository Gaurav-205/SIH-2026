"""Optional modelled context with independent failures and explicit provenance."""

import datetime as dt
import json
import logging
import math
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

log = logging.getLogger(__name__)
_CACHE: dict[str, tuple[dict, float]] = {}
_LOCK = threading.Lock()
COASTAL = {
    "mumbai",
    "thane",
    "palghar",
    "raigad",
    "ratnagiri",
    "sindhudurg",
    "north-goa",
    "south-goa",
    "alappuzha",
    "kozhikode",
    "kannur",
    "kasaragod",
    "kollam",
    "thiruvananthapuram",
    "ernakulam",
    "thrissur",
}


def fetch_product(host: str, params: dict) -> dict:
    url = host + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Bharosa/3.0"})
    try:
        with urllib.request.urlopen(req, timeout=4) as response:
            payload = json.loads(response.read())
        current = payload.get("current")
        if not isinstance(current, dict) or not current.get("time"):
            raise ValueError("Missing current product")
        # Providers can return a timestamp with every requested measurement null.
        fields = params["current"].split(",")

        def valid(value):
            return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

        if not any(valid(current.get(field)) for field in fields):
            raise ValueError("No available measurements")
        current = {"time": current["time"], **{field: current.get(field) if valid(current.get(field)) else None for field in fields}}
        return {"status": "available", "data": current, "units": payload.get("current_units", {})}
    except (OSError, ValueError, TypeError, AttributeError):
        log.warning("Environmental provider unavailable: %s", host)
        return {"status": "unavailable", "data": None, "units": {}}


def context_for(point: dict) -> dict:
    # Coordinates participate in the key so a republished point cannot reuse old-place data.
    key = f"{point['id']}:{point['lat']}:{point['lon']}"
    now = time.monotonic()
    with _LOCK:
        cached = _CACHE.get(key)
        if cached and now < cached[1]:
            return cached[0]
    geo = {"latitude": point["lat"], "longitude": point["lon"], "timezone": "UTC"}
    products = {
        "air_quality": (
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            {**geo, "current": "pm2_5,pm10,european_aqi,uv_index"},
            "CAMS via Open-Meteo",
        ),
        "surface": (
            "https://api.open-meteo.com/v1/forecast",
            {**geo, "current": "relative_humidity_2m,surface_pressure,soil_moisture_0_to_1cm"},
            "Open-Meteo weather models",
        ),
    }
    coastal = point["id"] in COASTAL
    if coastal:
        products["marine"] = (
            "https://marine-api.open-meteo.com/v1/marine",
            {**geo, "current": "wave_height,wave_direction,wave_period", "cell_selection": "sea"},
            "Open-Meteo marine models",
        )
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {name: pool.submit(fetch_product, url, params) for name, (url, params, _) in products.items()}
        results = {name: future.result() for name, future in futures.items()}
    fetched = dt.datetime.now(dt.UTC).isoformat()
    out = {
        "point_id": point["id"],
        "name": point["name"],
        "lat": point["lat"],
        "lon": point["lon"],
        "is_coastal": coastal,
        "fetched_at": fetched,
        "air_quality": None,
        "surface": None,
        "marine": None,
        "products": {},
    }
    for name, result in results.items():
        out[name] = result["data"]
        out["products"][name] = {
            "status": result["status"],
            "source": products[name][2],
            "kind": "modelled",
            "units": result["units"],
            "valid_at": (result["data"] or {}).get("time"),
            "fetched_at": fetched,
        }
    if not coastal:
        out["products"]["marine"] = {"status": "not_applicable", "kind": "modelled", "source": "Open-Meteo marine models"}
    ttl = 300 if all(r["status"] == "available" for r in results.values()) else 60
    with _LOCK:
        # Bounded process-local cache; shared cache is a multi-worker deployment follow-up.
        if len(_CACHE) >= 128:
            _CACHE.pop(next(iter(_CACHE)))
        _CACHE[key] = (out, now + ttl)
    return out
