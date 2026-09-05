from __future__ import annotations

import csv
import io
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from astrocartography_v1 import BODIES, _birth_jd, _planet_equatorial

TARGETS = {
    "Sun": "10",
    "Moon": "301",
    "Mercury": "199",
    "Venus": "299",
    "Mars": "499",
    "Jupiter": "599",
    "Saturn": "699",
    "Uranus": "799",
    "Neptune": "899",
    "Pluto": "999",
}

EPOCHS = (
    ("J2000", datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)),
    ("Lichun 2024", datetime(2024, 2, 4, 8, 26, 53, tzinfo=timezone.utc)),
)


def norm180(value: float) -> float:
    return ((float(value) + 180.0) % 360.0) - 180.0


def angular_delta(a: float, b: float) -> float:
    return abs(norm180(float(a) - float(b)))


def horizons_apparent_ra_dec(command: str, moment: datetime) -> tuple[float, float]:
    jd = 2440587.5 + moment.timestamp() / 86400.0
    params = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'500@399'",
        "QUANTITIES": "'2'",
        "TIME_DIGITS": "'SECONDS'",
        "CSV_FORMAT": "'YES'",
        "ANG_FORMAT": "'DEG'",
        "CAL_FORMAT": "'JD'",
        "TLIST": f"'{jd:.9f}'",
    }
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "astro-app-calculation-audit/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8")
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError(text[:4000])
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
    row = next(csv.reader(io.StringIO(block)))
    numeric: list[float] = []
    for field in row:
        try:
            numeric.append(float(field.strip()))
        except ValueError:
            pass
    if len(numeric) < 3:
        raise RuntimeError(f"Could not parse apparent RA/DEC from {row!r}\n{text[:4000]}")
    # CSV observer rows are JD, [presence fields], RA, DEC for quantity 2.
    ra, dec = numeric[-2], numeric[-1]
    if not 0.0 <= ra < 360.0 or not -90.0 <= dec <= 90.0:
        raise RuntimeError(f"Bad RA/DEC candidate: {ra}, {dec}; row={row!r}")
    return ra, dec


def _find_key(value, key: str):
    if isinstance(value, dict):
        for k, v in value.items():
            if str(k).lower() == key.lower():
                return v
            found = _find_key(v, key)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_key(item, key)
            if found is not None:
                return found
    return None


def _hours_from_value(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(" ", ":")
    parts = [p for p in text.split(":") if p]
    if len(parts) >= 2:
        sign = -1.0 if parts[0].startswith("-") else 1.0
        h = abs(float(parts[0]))
        m = float(parts[1])
        s = float(parts[2]) if len(parts) > 2 else 0.0
        return sign * (h + m / 60.0 + s / 3600.0)
    return float(text)


def usno_gast_hours(moment: datetime) -> float:
    params = {
        "date": moment.strftime("%Y-%m-%d"),
        "time": moment.strftime("%H:%M:%S"),
        "coords": "0,0",
        "reps": "1",
    }
    url = "https://aa.usno.navy.mil/api/siderealtime?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "astro-app-calculation-audit/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    gast = _find_key(payload, "gast")
    if gast is None:
        print("USNO payload:", json.dumps(payload, ensure_ascii=False, indent=2))
        raise RuntimeError("GAST not found in USNO response")
    return _hours_from_value(gast) % 24.0


def main() -> None:
    assert set(TARGETS) == set(BODIES)
    import swisseph as swe

    for label, moment in EPOCHS:
        jd = 2440587.5 + moment.timestamp() / 86400.0
        positions = _planet_equatorial(jd)
        gast = usno_gast_hours(moment)
        swiss_gast = float(swe.sidtime(jd)) % 24.0
        gast_delta_arcsec = angular_delta(gast * 15.0, swiss_gast * 15.0) * 3600.0
        print(f"\n## {label} {moment.isoformat()} JD={jd:.9f}")
        print(f"USNO_GAST_H={gast:.9f} SWISS_GAST_H={swiss_gast:.9f} d={gast_delta_arcsec:.3f}arcsec")
        for body, command in TARGETS.items():
            jpl_ra, jpl_dec = horizons_apparent_ra_dec(command, moment)
            sw_ra, sw_dec = positions[body]
            ra_err = angular_delta(jpl_ra, sw_ra) * 3600.0
            dec_err = abs(jpl_dec - sw_dec) * 3600.0
            mc_lon = norm180(jpl_ra - gast * 15.0)
            ic_lon = norm180(mc_lon + 180.0)
            print(
                f"{body:8s} JPL_RA={jpl_ra:.9f} JPL_DEC={jpl_dec:.9f} "
                f"SW_RA={sw_ra:.9f} SW_DEC={sw_dec:.9f} "
                f"dRA={ra_err:.3f}arcsec dDEC={dec_err:.3f}arcsec "
                f"MC={mc_lon:.9f} IC={ic_lon:.9f}"
            )


if __name__ == "__main__":
    main()
