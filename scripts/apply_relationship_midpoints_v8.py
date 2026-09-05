from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


path = "relationship_western_v1.py"

replace_once(
    path,
    "- Davison relationship chart (uncorrected time/space midpoint)\n",
    "- Davison relationship chart (classical uncorrected mean latitude/longitude; optional spherical variant)\n",
)

replace_once(
    path,
    'ENGINE_VERSION = "relationship-western-v1.6-polar-safe-houses"',
    'ENGINE_VERSION = "relationship-western-v1.7-midpoint-contract"',
)

replace_once(
    path,
    '''def _mid_angle(a, b):
    a = _norm(a); b = _norm(b)
    d = ((_norm(b - a) + 180.0) % 360.0) - 180.0
    return _norm(a + d / 2.0)
''',
    '''def _mid_angle(a, b):
    a = _norm(a); b = _norm(b)
    separation = _angle_distance(a, b)
    if abs(separation - 180.0) <= 1e-10:
        # Exact opposition has two equally valid midpoint candidates. Pick a
        # canonical numeric candidate so A/B ordering cannot flip the composite.
        return min(_norm(a + 90.0), _norm(a - 90.0))
    d = ((_norm(b - a) + 180.0) % 360.0) - 180.0
    return _norm(a + d / 2.0)
''',
)

replace_once(
    path,
    '''def _geo_midpoint(lat1, lon1, lat2, lon2):
    # Great-circle midpoint; stable across the date line.
    phi1, lam1, phi2, lam2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    x1, y1, z1 = math.cos(phi1)*math.cos(lam1), math.cos(phi1)*math.sin(lam1), math.sin(phi1)
    x2, y2, z2 = math.cos(phi2)*math.cos(lam2), math.cos(phi2)*math.sin(lam2), math.sin(phi2)
    x, y, z = x1+x2, y1+y2, z1+z2
    lon = math.degrees(math.atan2(y, x))
    hyp = math.hypot(x, y)
    lat = math.degrees(math.atan2(z, hyp))
    return lat, lon


def _davison_from_profiles(a, b):
    a_utc = _utc_datetime(a["birth_date"], a["birth_time"], a.get("utc_offset_hours", 9.0))
    b_utc = _utc_datetime(b["birth_date"], b["birth_time"], b.get("utc_offset_hours", 9.0))
    mid_ts = (a_utc.timestamp() + b_utc.timestamp()) / 2.0
    mid_utc = datetime.fromtimestamp(mid_ts, tz=timezone.utc)
    lat, lon = _geo_midpoint(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
    jd = _jd_from_utc(mid_utc)
    chart = _chart_from_jd(jd, lat, lon, include_moon=True, include_angles=True)
    chart.update({"latitude": round(lat, 6), "longitude": round(lon, 6), "method": "uncorrected Davison: midpoint in UTC time + great-circle geographic midpoint"})
    return chart
''',
    '''def _geo_midpoint(lat1, lon1, lat2, lon2, variant="uncorrected"):
    """Return the geographic location for an explicit Davison variant.

    `uncorrected` follows the classical DRC convention used by Astrodienst:
    latitude and longitude are averaged separately. `spherical` follows the
    shortest great-circle path and is a distinct Davison variant.
    """
    lat1 = float(lat1); lon1 = float(lon1); lat2 = float(lat2); lon2 = float(lon2)
    if variant == "uncorrected":
        return (lat1 + lat2) / 2.0, (lon1 + lon2) / 2.0
    if variant != "spherical":
        raise ValueError(f"unsupported Davison geographic midpoint variant: {variant}")

    phi1, lam1, phi2, lam2 = map(math.radians, [lat1, lon1, lat2, lon2])
    x1, y1, z1 = math.cos(phi1)*math.cos(lam1), math.cos(phi1)*math.sin(lam1), math.sin(phi1)
    x2, y2, z2 = math.cos(phi2)*math.cos(lam2), math.cos(phi2)*math.sin(lam2), math.sin(phi2)
    x, y, z = x1+x2, y1+y2, z1+z2
    magnitude = math.sqrt(x*x + y*y + z*z)
    if magnitude <= 1e-12:
        raise ValueError("spherical geographic midpoint is undefined for antipodal locations")
    lon = math.degrees(math.atan2(y, x))
    hyp = math.hypot(x, y)
    lat = math.degrees(math.atan2(z, hyp))
    return lat, lon


def _davison_from_profiles(a, b, variant="uncorrected"):
    a_utc = _utc_datetime(a["birth_date"], a["birth_time"], a.get("utc_offset_hours", 9.0))
    b_utc = _utc_datetime(b["birth_date"], b["birth_time"], b.get("utc_offset_hours", 9.0))
    mid_ts = (a_utc.timestamp() + b_utc.timestamp()) / 2.0
    mid_utc = datetime.fromtimestamp(mid_ts, tz=timezone.utc)
    lat, lon = _geo_midpoint(
        a["latitude"], a["longitude"], b["latitude"], b["longitude"], variant=variant
    )
    jd = _jd_from_utc(mid_utc)
    chart = _chart_from_jd(jd, lat, lon, include_moon=True, include_angles=True)
    if variant == "uncorrected":
        method = "uncorrected Davison: midpoint in UTC time + separate mean latitude and longitude"
    else:
        method = "spherical Davison: midpoint in UTC time + great-circle geographic midpoint"
    chart.update({
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "variant": variant,
        "method": method,
    })
    return chart
''',
)

print("V8 relationship midpoint patch applied")
