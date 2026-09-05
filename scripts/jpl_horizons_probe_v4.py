from __future__ import annotations

import csv
import io
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from integrated_fortune_v1 import PLANET_KEYS, _planet_lon, _to_jd_ut
from relationship_western_v1 import _planet_positions

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


def angular_delta(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


def horizons_obs_ecl_lon(command: str, moment: datetime) -> float:
    params = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'500@399'",
        "QUANTITIES": "'31'",
        "TIME_DIGITS": "'SECONDS'",
        "CSV_FORMAT": "'YES'",
        "ANG_FORMAT": "'DEG'",
    }
    jd = 2440587.5 + moment.timestamp() / 86400.0
    params["TLIST"] = f"'{jd:.9f}'"
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as response:
        text = response.read().decode("utf-8")
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError(text[:4000])
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
    row = next(csv.reader(io.StringIO(block)))
    numeric = []
    for field in row[1:]:
        try:
            value = float(field.strip())
        except ValueError:
            continue
        numeric.append(value)
    if not numeric:
        raise RuntimeError(f"No numeric Horizons output parsed: {row!r}\n{text[:4000]}")
    for value in numeric:
        if 0.0 <= value < 360.0:
            return value
    raise RuntimeError(f"No longitude candidate parsed: {row!r}")


def main() -> None:
    assert set(TARGETS) == set(PLANET_KEYS)
    for label, moment in EPOCHS:
        jd = _to_jd_ut(moment)
        swiss = _planet_positions(jd, include_moon=True)
        print(f"\n## {label} {moment.isoformat()}")
        for body, command in TARGETS.items():
            jpl = horizons_obs_ecl_lon(command, moment)
            sf = _planet_lon(body, moment)
            sw = float(swiss[body]["lon"])
            print(
                f"{body:8s} JPL={jpl:.9f} SF={sf:.9f} SW={sw:.9f} "
                f"dSF={angular_delta(jpl, sf)*3600:.3f}arcsec "
                f"dSW={angular_delta(jpl, sw)*3600:.3f}arcsec"
            )


if __name__ == "__main__":
    main()
