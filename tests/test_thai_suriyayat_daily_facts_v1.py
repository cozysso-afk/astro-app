from datetime import date
from thai_astrology_v2 import _suriyayat_daily_facts
from thai_suriyayat_v1 import snapshot_for_local_date

def test_suriyayat_daily_geometry_matches_calculated_positions():
    natal = snapshot_for_local_date(date(2000, 1, 1), utc_offset_hours=9)
    rows = _suriyayat_daily_facts(date(2026, 10, 26), date(2026, 10, 27), 9, natal)
    assert [x["date"] for x in rows] == ["2026-10-26", "2026-10-27"]
    assert len(rows[0]["positions"]) == 10
    sample = snapshot_for_local_date(date(2026, 10, 26), utc_offset_hours=9)
    for planet, p in rows[0]["positions"].items():
        transit, birth = sample["positions"][planet], natal["positions"][planet]
        assert p["longitude_deg"] == transit["longitude_deg"]
        assert p["natal_longitude_deg"] == birth["longitude_deg"]
        arc = abs((transit["arcmin"] - birth["arcmin"]) % 21600)
        assert p["same_planet_separation_deg"] == round(min(arc, 21600 - arc) / 60, 4)
        assert 0 <= p["same_planet_separation_deg"] <= 180
        assert "score" not in p and "aspect" not in p
    assert rows[0]["positions"]["moon"]["longitude_deg"] != rows[1]["positions"]["moon"]["longitude_deg"]

def test_suriyayat_same_instant_has_zero_angular_distance():
    natal = snapshot_for_local_date(date(2026, 10, 26), utc_offset_hours=9)
    row = _suriyayat_daily_facts(date(2026, 10, 26), date(2026, 10, 26), 9, natal)[0]
    assert all(p["same_planet_separation_deg"] == 0 for p in row["positions"].values())
    assert all(p["same_natal_sign"] for p in row["positions"].values())
