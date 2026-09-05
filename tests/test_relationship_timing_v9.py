from __future__ import annotations

from datetime import date, datetime, time as dt_time, timezone

import pytest

import relationship_western_v1 as rw


def _profile(*, birth_date, birth_time, utc_offset_hours, latitude, longitude):
    return {
        "name": "test",
        "birth_date": birth_date,
        "birth_time": birth_time,
        "utc_offset_hours": utc_offset_hours,
        "latitude": latitude,
        "longitude": longitude,
        "time_known": True,
    }


@pytest.mark.parametrize(
    ("offset", "expected"),
    [
        (0.0, datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc)),
        (5.75, datetime(2026, 9, 5, 6, 15, tzinfo=timezone.utc)),
        (-3.5, datetime(2026, 9, 5, 15, 30, tzinfo=timezone.utc)),
        (None, datetime(2026, 9, 5, 3, 0, tzinfo=timezone.utc)),
    ],
)
def test_local_noon_utc_preserves_zero_and_fractional_offsets(offset, expected):
    assert rw._local_noon_utc(date(2026, 9, 5), offset) == expected


def test_reunion_transit_uses_zero_offset_instead_of_falling_back_to_kst(monkeypatch):
    seen = []

    def fake_local_noon(day, offset):
        seen.append((day, offset))
        return datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(rw, "_local_noon_utc", fake_local_noon)
    monkeypatch.setattr(rw, "_jd_from_utc", lambda dt: 2451545.0)
    monkeypatch.setattr(
        rw,
        "_chart_from_jd",
        lambda *args, **kwargs: {"positions": {}, "angles": {}},
    )

    result = rw._build_reunion_transits(
        {"positions": {}, "angles": {}},
        {"positions": {}, "angles": {}},
        date(2026, 9, 5),
        date(2026, 9, 5),
        0.0,
    )

    assert seen == [(date(2026, 9, 5), 0.0)]
    assert result["period"] == {"start": "2026-09-05", "end": "2026-09-05"}


def test_monthly_progressed_layers_use_user_local_noon_not_hardcoded_kst(monkeypatch):
    captured_targets = []

    def fake_progressed(profile, target_dt, include_angles=False):
        captured_targets.append(target_dt)
        return {
            "jd_ut": 2451545.0,
            "utc": target_dt.astimezone(timezone.utc).isoformat(),
            "positions": {"Sun": {"lon": 10.0}, "Moon": {"lon": 20.0}},
            "angles": {},
        }

    monkeypatch.setattr(rw, "_secondary_progressed_chart", fake_progressed)

    user = _profile(
        birth_date=date(1990, 1, 1),
        birth_time=dt_time(12, 0),
        utc_offset_hours=0.0,
        latitude=10.0,
        longitude=20.0,
    )
    counterpart = _profile(
        birth_date=date(1990, 1, 3),
        birth_time=dt_time(12, 0),
        utc_offset_hours=9.0,
        latitude=30.0,
        longitude=80.0,
    )

    out = rw.build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
        analysis_mode="compatibility",
    )

    assert out["ok"] is True
    assert out["timing_timezone_policy"].startswith("user-facing calendar dates use local noon")
    assert captured_targets == [
        datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc),
    ]


def test_transit_hit_score_formula_and_orb_cutoff_are_stable():
    transit = {"positions": {"Mercury": {"lon": 10.0}}, "angles": {}}
    natal = {
        "positions": {
            "Venus": {"lon": 10.0},
            "Saturn": {"lon": 70.0},
            "Mars": {"lon": 11.0001},
        },
        "angles": {},
    }

    hits = rw._transit_hits(transit, natal, "user")
    keyed = {(row["target"], row["aspect"]): row for row in hits}

    assert keyed[("Venus", "conjunction")]["orb"] == 0.0
    assert keyed[("Venus", "conjunction")]["score"] == 100.0
    assert keyed[("Saturn", "sextile")]["score"] == 49.4
    assert not any(row["target"] == "Mars" for row in hits)


def test_side_trigger_score_uses_top_four_and_documented_scale():
    hits = [
        {"score": 40.0},
        {"score": 30.0},
        {"score": 20.0},
        {"score": 10.0},
        {"score": 99.0},  # ignored because caller contract supplies sorted hits
    ]
    assert rw._side_trigger_score(hits) == 42.6


def test_relationship_timing_stat_separates_adjacent_peak_dates():
    rows = [
        {"date": "2026-09-01", "score": 90.0},
        {"date": "2026-09-02", "score": 89.0},
        {"date": "2026-09-03", "score": 88.0},
        {"date": "2026-09-05", "score": 70.0},
        {"date": "2026-09-08", "score": 60.0},
    ]
    stat = rw._relationship_timing_stat(rows, "score", "test")
    assert stat is not None
    assert [x["date"] for x in stat["best_days"][:3]] == [
        "2026-09-01",
        "2026-09-03",
        "2026-09-05",
    ]
