from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'integrated_fortune_v1.py'
s = p.read_text(encoding='utf-8')

s = s.replace('import calendar\n', 'import calendar\nimport json\nfrom pathlib import Path\n', 1)
old = '''def _is_market_day(day_value: date) -> bool:\n    # The API intentionally avoids making price claims. This is only a display\n    # gate for investment indices. Weekends are always closed; exchange holidays\n    # fall back to weekday display when a calendar dependency is unavailable.\n    try:\n        import pandas as pd\n        import exchange_calendars as xcals\n        cal = xcals.get_calendar("XKRX")\n        return bool(cal.is_session(pd.Timestamp(day_value.isoformat())))\n    except Exception:\n        return day_value.weekday() < 5\n'''
new = '''@lru_cache(maxsize=1)\ndef _krx_session_set() -> frozenset[str]:\n    path = Path(__file__).resolve().parent / "data" / "krx_sessions_2020_2035.json"\n    try:\n        payload = json.loads(path.read_text(encoding="utf-8"))\n        values = payload.get("sessions") if isinstance(payload, dict) else payload\n        if isinstance(values, list):\n            return frozenset(str(x) for x in values)\n    except Exception:\n        pass\n    return frozenset()\n\n\ndef _is_market_day(day_value: date) -> bool:\n    # Runtime stays lightweight: the exact XKRX calendar is precomputed at build\n    # time. Outside the bundled range we explicitly fall back to weekdays.\n    sessions = _krx_session_set()\n    iso = day_value.isoformat()\n    if sessions and "2020-01-01" <= iso <= "2035-12-31":\n        return iso in sessions\n    return day_value.weekday() < 5\n'''
if old not in s:
    raise SystemExit('market-day anchor missing')
s = s.replace(old, new, 1)
s = s.replace('rows = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 30, natal_lons, natal_houses, offset_hours)',
              'rows = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 45, natal_lons, natal_houses, offset_hours)', 1)
p.write_text(s, encoding='utf-8')
print('optimized mobile depth runtime')
