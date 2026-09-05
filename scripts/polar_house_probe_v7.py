from __future__ import annotations

from datetime import datetime, timezone

import swisseph as swe


EPOCHS = (
    ("J2000", datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)),
    ("Lichun 2024", datetime(2024, 2, 4, 8, 26, 53, tzinfo=timezone.utc)),
)

LATITUDES = (0.0, 60.0, 65.0, 66.0, 66.4, 66.55, 66.6, 67.0, 69.6492, 78.2232, -66.6, -69.0, -78.0)
LONGITUDE = 18.9553


def jd(moment: datetime) -> float:
    hour = moment.hour + moment.minute / 60.0 + moment.second / 3600.0
    return swe.julday(moment.year, moment.month, moment.day, hour, swe.GREG_CAL)


def norm(values):
    return tuple(round(float(x) % 360.0, 9) for x in values)


def max_circular_delta(a, b):
    def d(x, y):
        return abs((float(x) - float(y) + 180.0) % 360.0 - 180.0)
    return max(d(x, y) for x, y in zip(a, b))


def main() -> None:
    print("pyswisseph", getattr(swe, "version", "unknown"))
    for label, moment in EPOCHS:
        value = jd(moment)
        print(f"\n## {label} {moment.isoformat()} jd={value:.9f}")
        try:
            ecl = swe.calc_ut(value, swe.ECL_NUT)
            print("ECL_NUT", ecl)
        except Exception as exc:
            print("ECL_NUT_ERROR", type(exc).__name__, repr(exc))
        for lat in LATITUDES:
            print(f"\nlat={lat}")
            results = {}
            for name, code in (("P", b"P"), ("O", b"O")):
                for api in ("houses", "houses_ex"):
                    try:
                        if api == "houses":
                            cusps, ascmc = swe.houses(value, lat, LONGITUDE, code)
                        else:
                            cusps, ascmc = swe.houses_ex(value, lat, LONGITUDE, code, 0)
                        results[(name, api)] = (norm(cusps), norm(ascmc))
                        print(
                            f"{name}-{api}: ok cusp1={cusps[0]:.9f} cusp2={cusps[1]:.9f} "
                            f"asc={ascmc[0]:.9f} mc={ascmc[1]:.9f}"
                        )
                    except Exception as exc:
                        print(f"{name}-{api}: ERROR {type(exc).__name__}: {exc!r}")
            p = results.get(("P", "houses")) or results.get(("P", "houses_ex"))
            o = results.get(("O", "houses")) or results.get(("O", "houses_ex"))
            if p and o:
                print("P_vs_O_cusp_max_deg", max_circular_delta(p[0], o[0]))
                print("P_vs_O_ascmc_max_deg", max_circular_delta(p[1], o[1]))


if __name__ == "__main__":
    main()
