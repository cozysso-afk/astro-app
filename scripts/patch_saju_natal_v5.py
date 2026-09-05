from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


integrated_path = Path("integrated_fortune_v1.py")
s = integrated_path.read_text(encoding="utf-8")

s = replace_once(
    s,
    'SAJU_ENGINE_VERSION = "lunar_python-1.4.8-true-solar-jie-exact"',
    'SAJU_ENGINE_VERSION = "lunar_python-1.4.8-true-solar-absolute-jie-v5"',
    "saju engine version",
)

anchor = '''def _aware_to_lunar_exact(value: datetime):\n    cst = value.astimezone(_CST)\n    return Solar.fromYmdHms(cst.year, cst.month, cst.day, cst.hour, cst.minute, cst.second).getLunar()\n\n\n'''
helper = '''def _aware_to_lunar_exact(value: datetime):\n    cst = value.astimezone(_CST)\n    return Solar.fromYmdHms(cst.year, cst.month, cst.day, cst.hour, cst.minute, cst.second).getLunar()\n\n\ndef _set_saju_sect2(eight):\n    try:\n        eight.setSect(2)\n    except Exception:\n        pass\n    return eight\n\n\ndef _natal_saju_components(\n    birth_date: date,\n    birth_time: dt_time,\n    utc_offset_hours: float,\n    longitude: float | None = None,\n):\n    \"\"\"Build natal Four Pillars with consistent time frames.\n\n    Year/month are solar-term boundaries, so they are selected from the birth\n    instant itself after normalizing that instant to lunar_python's UTC+8\n    boundary frame. Day/hour use the effective local clock used by this app:\n    local apparent solar time when longitude is known, otherwise legal local\n    time. This avoids moving LiChun/Jie merely because true-solar correction\n    changes the displayed wall clock.\n    \"\"\"\n    offset = float(utc_offset_hours)\n    legal_local = datetime.combine(birth_date, birth_time)\n    legal_aware = legal_local.replace(tzinfo=_fixed_timezone(offset))\n    boundary_eight = _set_saju_sect2(_aware_to_lunar_exact(legal_aware).getEightChar())\n\n    if longitude is None:\n        effective_local = legal_local\n        true_solar_meta = None\n        effective_policy = \"legal_local_time\"\n    else:\n        effective_local, true_solar_meta = _true_solar_datetime(\n            birth_date, birth_time, float(longitude), offset\n        )\n        effective_policy = \"local_apparent_solar_time\"\n\n    effective_eight = _set_saju_sect2(\n        Solar.fromYmdHms(\n            effective_local.year, effective_local.month, effective_local.day,\n            effective_local.hour, effective_local.minute, effective_local.second,\n        ).getLunar().getEightChar()\n    )\n    pillars = {\n        \"year\": boundary_eight.getYear(),\n        \"month\": boundary_eight.getMonth(),\n        \"day\": effective_eight.getDay(),\n        \"hour\": effective_eight.getTime(),\n    }\n    return {\n        \"pillars\": pillars,\n        \"boundary_eight\": boundary_eight,\n        \"effective_eight\": effective_eight,\n        \"effective_local\": effective_local,\n        \"true_solar_meta\": true_solar_meta,\n        \"effective_policy\": effective_policy,\n        \"boundary_policy\": {\n            \"year_month\": \"absolute birth instant vs exact LiChun/Jie boundary (lunar_python UTC+8 boundary frame)\",\n            \"day_hour\": \"local apparent solar time when longitude is known; legal local time otherwise\",\n            \"late_zi\": \"EightChar sect=2: 23:00-23:59 day pillar stays on the civil day; lunar_python late-Zi hour stem follows its built-in next-day stem convention\",\n        },\n    }\n\n\n'''
s = replace_once(s, anchor, helper, "insert natal saju components")

old_start = '''    try:\n        true_solar, true_solar_meta = _true_solar_datetime(\n            birth_date, birth_time, longitude, utc_offset_hours\n        )\n        solar = Solar.fromYmdHms(\n            true_solar.year, true_solar.month, true_solar.day,\n            true_solar.hour, true_solar.minute, true_solar.second,\n        )\n        eight = solar.getLunar().getEightChar()\n        try:\n            eight.setSect(2)\n        except Exception:\n            pass\n\n        pillars = {\n            \"year\": eight.getYear(),\n            \"month\": eight.getMonth(),\n            \"day\": eight.getDay(),\n            \"hour\": eight.getTime(),\n        }\n        day_master = eight.getDayGan() if hasattr(eight, \"getDayGan\") else pillars[\"day\"][:1]\n'''
new_start = '''    try:\n        natal = _natal_saju_components(\n            birth_date, birth_time, utc_offset_hours, longitude\n        )\n        true_solar_meta = natal[\"true_solar_meta\"]\n        eight = natal[\"effective_eight\"]\n        boundary_eight = natal[\"boundary_eight\"]\n        pillars = natal[\"pillars\"]\n        day_master = eight.getDayGan() if hasattr(eight, \"getDayGan\") else pillars[\"day\"][:1]\n'''
s = replace_once(s, old_start, new_start, "saju payload natal start")

old_elements = '''        elements = []\n        for getter in [\"getYearWuXing\", \"getMonthWuXing\", \"getDayWuXing\", \"getTimeWuXing\"]:\n            try:\n                elements.extend(list(getattr(eight, getter)()))\n            except Exception:\n                pass\n        element_count = {e: elements.count(e) for e in [\"木\", \"火\", \"土\", \"金\", \"水\"]}\n\n        natal_ten_gods = {}\n        for label, getter in [\n            (\"년간\", \"getYearShiShenGan\"),\n            (\"월간\", \"getMonthShiShenGan\"),\n            (\"시간\", \"getTimeShiShenGan\"),\n        ]:\n            try:\n                natal_ten_gods[label] = getattr(eight, getter)()\n            except Exception:\n                pass\n\n        gender_code = 1 if gender in {\"male\", \"남성\", \"남\"} else 0\n        yun = eight.getYun(gender_code, 1)\n'''
new_elements = '''        elements = []\n        for source, getter in [\n            (boundary_eight, \"getYearWuXing\"),\n            (boundary_eight, \"getMonthWuXing\"),\n            (eight, \"getDayWuXing\"),\n            (eight, \"getTimeWuXing\"),\n        ]:\n            try:\n                elements.extend(list(getattr(source, getter)()))\n            except Exception:\n                pass\n        element_count = {e: elements.count(e) for e in [\"木\", \"火\", \"土\", \"金\", \"水\"]}\n\n        natal_ten_gods = {\n            \"년간\": _ten_god(day_master, pillars[\"year\"][:1]),\n            \"월간\": _ten_god(day_master, pillars[\"month\"][:1]),\n            \"시간\": _ten_god(day_master, pillars[\"hour\"][:1]),\n        }\n\n        gender_code = 1 if gender in {\"male\", \"남성\", \"남\"} else 0\n        yun = boundary_eight.getYun(gender_code, 1)\n'''
s = replace_once(s, old_elements, new_elements, "saju elements and yun source")

old_return = '''            \"engine\": SAJU_ENGINE_VERSION,\n            \"calendar_input\": \"legal local time corrected to local apparent solar time\",\n            \"true_solar\": true_solar_meta,\n            \"pillars\": pillars,\n'''
new_return = '''            \"engine\": SAJU_ENGINE_VERSION,\n            \"calendar_input\": \"year/month from absolute solar-term instant; day/hour from effective local time\",\n            \"true_solar\": true_solar_meta,\n            \"pillar_boundary_policy\": natal[\"boundary_policy\"],\n            \"pillars\": pillars,\n'''
s = replace_once(s, old_return, new_return, "saju payload boundary metadata")

integrated_path.write_text(s, encoding="utf-8")

relationship_path = Path("relationship_saju_v1.py")
r = relationship_path.read_text(encoding="utf-8")
r = replace_once(
    r,
    'from integrated_fortune_v1 import _true_solar_datetime, _ten_god',
    'from integrated_fortune_v1 import _natal_saju_components, _ten_god',
    "relationship import",
)

old_pillars = '''def _pillars(profile: dict) -> dict:\n    known = bool(profile.get(\"time_known\", True) and profile.get(\"birth_time\") is not None)\n    bt = profile.get(\"birth_time\") or dt_time(12, 0)\n    bd: date = profile[\"birth_date\"]\n    lon = profile.get(\"longitude\")\n    offset = float(profile.get(\"utc_offset_hours\", 9.0))\n    if known and lon is not None:\n        true_solar, meta = _true_solar_datetime(bd, bt, float(lon), offset)\n        precision = \"exact_true_solar\"\n    else:\n        true_solar = __import__(\"datetime\").datetime.combine(bd, bt)\n        meta = None\n        precision = \"date_noon_proxy\" if not known else \"legal_time_no_longitude\"\n    eight = Solar.fromYmdHms(true_solar.year, true_solar.month, true_solar.day, true_solar.hour, true_solar.minute, true_solar.second).getLunar().getEightChar()\n    try:\n        eight.setSect(2)\n    except Exception:\n        pass\n    year = eight.getYear(); month = eight.getMonth(); day = eight.getDay(); hour = eight.getTime() if known else None\n    return {\n        \"year\": year, \"month\": month, \"day\": day, \"hour\": hour,\n        \"day_stem\": day[:1], \"day_branch\": day[1:2],\n        \"precision\": precision,\n        \"true_solar\": meta if known and meta else None,\n        \"time_known\": known,\n    }\n'''
new_pillars = '''def _pillars(profile: dict) -> dict:\n    known = bool(profile.get(\"time_known\", True) and profile.get(\"birth_time\") is not None)\n    bt = profile.get(\"birth_time\") or dt_time(12, 0)\n    bd: date = profile[\"birth_date\"]\n    lon = profile.get(\"longitude\")\n    offset = float(profile.get(\"utc_offset_hours\", 9.0))\n    effective_lon = float(lon) if known and lon is not None else None\n    natal = _natal_saju_components(bd, bt, offset, effective_lon)\n    pillars = natal[\"pillars\"]\n    day = pillars[\"day\"]\n    precision = (\n        \"exact_true_solar\" if known and lon is not None\n        else \"legal_time_no_longitude\" if known\n        else \"date_noon_proxy\"\n    )\n    return {\n        \"year\": pillars[\"year\"], \"month\": pillars[\"month\"], \"day\": day,\n        \"hour\": pillars[\"hour\"] if known else None,\n        \"day_stem\": day[:1], \"day_branch\": day[1:2],\n        \"precision\": precision,\n        \"true_solar\": natal[\"true_solar_meta\"] if known and natal[\"true_solar_meta\"] else None,\n        \"pillar_boundary_policy\": natal[\"boundary_policy\"],\n        \"time_known\": known,\n    }\n'''
r = replace_once(r, old_pillars, new_pillars, "relationship pillars")
relationship_path.write_text(r, encoding="utf-8")

print("Saju V5 runtime patch applied")
