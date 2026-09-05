from pathlib import Path

p = Path('relationship_western_v1.py')
s = p.read_text(encoding='utf-8')

replacements = [
    ('ENGINE_VERSION = "relationship-western-v1.7-midpoint-contract"',
     'ENGINE_VERSION = "relationship-western-v1.8-timing-timezone-contract"'),
    ('    tz = timezone(timedelta(hours=float(utc_offset_hours or 9.0)))\n    while cursor <= end_date:\n        target_local = datetime.combine(cursor, dt_time(12, 0), tzinfo=tz)\n        transit_chart = _chart_from_jd(_jd_from_utc(target_local.astimezone(timezone.utc)), include_moon=False, include_angles=False)',
     '    while cursor <= end_date:\n        target_utc = _local_noon_utc(cursor, utc_offset_hours)\n        transit_chart = _chart_from_jd(_jd_from_utc(target_utc), include_moon=False, include_angles=False)'),
    ('def _utc_datetime(birth_date, birth_time, utc_offset_hours):\n    local = datetime.combine(birth_date, birth_time)\n    return (local - timedelta(hours=float(utc_offset_hours))).replace(tzinfo=timezone.utc)\n\n\ndef _jd_from_utc(dt):',
     'def _utc_datetime(birth_date, birth_time, utc_offset_hours):\n    local = datetime.combine(birth_date, birth_time)\n    return (local - timedelta(hours=float(utc_offset_hours))).replace(tzinfo=timezone.utc)\n\n\ndef _utc_offset_value(value, default=9.0):\n    """Return a fixed UTC offset without treating numeric zero as missing."""\n    return float(default if value is None else value)\n\n\ndef _local_noon_utc(day, utc_offset_hours):\n    """Map a user-facing local calendar date to local noon, then UTC."""\n    offset = _utc_offset_value(utc_offset_hours)\n    local_tz = timezone(timedelta(hours=offset))\n    return datetime.combine(day, dt_time(12, 0), tzinfo=local_tz).astimezone(timezone.utc)\n\n\ndef _jd_from_utc(dt):'),
    ('    month_segments: iterable of (segment_start: date, segment_end: date); midpoint noon KST is used as\n    the representative timing date. Exact partner birth time/place unlocks Davison and Marks layers.',
     '    month_segments: iterable of (segment_start: date, segment_end: date); midpoint local noon in the\n    user profile\'s fixed UTC offset is used as the representative timing instant. Exact partner birth\n    time/place unlocks Davison and Marks layers.'),
    ('        "orb_policy": "natal 3-6° by point; secondary 1.5°; tertiary 1.0°; major aspects + quincunx",\n        "limitations": [],',
     '        "orb_policy": "natal 3-6° by point; secondary 1.5°; tertiary 1.0°; major aspects + quincunx",\n        "timing_timezone_policy": "user-facing calendar dates use local noon in the user profile fixed utc_offset_hours; numeric 0 is preserved; IANA/DST inference is not performed",\n        "limitations": [],'),
    ('        target = datetime.combine(rep_date, dt_time(12, 0), tzinfo=timezone(timedelta(hours=9))).astimezone(timezone.utc)',
     '        target = _local_noon_utc(rep_date, user_profile.get("utc_offset_hours", 9.0))'),
]

for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one match, got {count}: {old[:90]!r}')
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
