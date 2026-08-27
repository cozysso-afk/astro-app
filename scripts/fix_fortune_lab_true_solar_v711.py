from pathlib import Path

P=Path("fortune_lab_v71.py")
text=P.read_text(encoding="utf-8")

if 'FORTUNE_LAB_TRUE_SOLAR_V711 = True' in text:
    print("Fortune Lab true-solar v7.1.1 already applied")
    raise SystemExit(0)


def replace_once(old,new,label):
    global text
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"[{label}] expected exactly 1 match, got {count}")
    text=text.replace(old,new,1)

replace_once(
    'import streamlit as st\n',
    'import streamlit as st\nimport swisseph as swe\n',
    'Swiss Ephemeris import',
)

replace_once(
    'FORTUNE_LAB_VERSION = "v0.1.0"\n',
    'FORTUNE_LAB_VERSION = "v0.1.1"\nFORTUNE_LAB_TRUE_SOLAR_V711 = True\n',
    'version marker',
)

anchor='''def _ten_god(day_stem,target_stem):\n'''
helper='''def _true_solar_datetime(birth_date,birth_time,longitude):\n    """KST legal time -> local apparent/true solar time.\n\n    Korea standard meridian is 135E. Local mean solar time differs by\n    4 minutes per degree of longitude; Swiss Ephemeris swe.time_equ returns\n    equation of time E = LAT - LMT in days.\n    """\n    legal=datetime.combine(birth_date,birth_time)\n    longitude=float(longitude)\n    utc=legal-timedelta(hours=9)\n    ut_hour=utc.hour+utc.minute/60+utc.second/3600+utc.microsecond/3_600_000_000\n    jd_ut=swe.julday(utc.year,utc.month,utc.day,ut_hour,swe.GREG_CAL)\n    eot_days=float(swe.time_equ(jd_ut))\n    longitude_minutes=4.0*(longitude-135.0)\n    eot_minutes=eot_days*1440.0\n    total_minutes=longitude_minutes+eot_minutes\n    apparent=legal+timedelta(minutes=total_minutes)\n    return apparent,{\n        "legal_kst":legal.strftime("%Y-%m-%d %H:%M:%S"),\n        "longitude_east":round(longitude,6),\n        "kst_standard_meridian_east":135.0,\n        "longitude_correction_minutes":round(longitude_minutes,4),\n        "equation_of_time_minutes":round(eot_minutes,4),\n        "total_correction_minutes":round(total_minutes,4),\n        "true_solar_time":apparent.strftime("%Y-%m-%d %H:%M:%S"),\n        "formula":"KST + 4*(longitude-135E) minutes + Swiss Ephemeris equation_of_time(LAT-LMT)",\n    }\n\n\ndef _ten_god(day_stem,target_stem):\n'''
replace_once(anchor,helper,'true solar helper')

replace_once(
    'def _saju_payload(birth_date,birth_time,gender,start_date,end_date):\n',
    'def _saju_payload(birth_date,birth_time,longitude,gender,start_date,end_date):\n',
    'saju signature',
)

replace_once(
    '        solar=Solar.fromYmdHms(birth_date.year,birth_date.month,birth_date.day,birth_time.hour,birth_time.minute,birth_time.second)\n        lunar=solar.getLunar()\n',
    '        true_solar,true_solar_meta=_true_solar_datetime(birth_date,birth_time,longitude)\n        solar=Solar.fromYmdHms(true_solar.year,true_solar.month,true_solar.day,true_solar.hour,true_solar.minute,true_solar.second)\n        lunar=solar.getLunar()\n',
    'saju true solar input',
)

replace_once(
    '            "ok":True,"engine":"lunar_python 1.4.8","calendar_input":"solar wall-clock KST",\n',
    '            "ok":True,"engine":"lunar_python 1.4.8 + Swiss Ephemeris true-solar correction","calendar_input":"legal KST corrected to local apparent solar time",\n            "true_solar":true_solar_meta,\n',
    'saju metadata',
)

replace_once(
    '            "not_calculated":["진태양시/균시차 최종보정","신강·신약","용신·희신·기신","형·파·해 전체 규칙"],\n',
    '            "not_calculated":["신강·신약","용신·희신·기신","형·파·해 전체 규칙"],\n',
    'not calculated list',
)

replace_once(
    '    saju=_saju_payload(ctx["birth_date"],ctx["birth_time"],gender,start_date,end_date)\n',
    '    saju=_saju_payload(ctx["birth_date"],ctx["birth_time"],ctx["birth_lon"],gender,start_date,end_date)\n',
    'bundle longitude',
)

replace_once(
    '3. Saju에는 원국·대운·연간 간지·월별 대표 절기월 간지가 있다. 신강·신약/용희기신/진태양시/형파해가 not_calculated에 있으면 임의 생성하지 않는다.\n',
    '3. Saju에는 진태양시로 보정한 원국·대운·연간 간지·월별 대표 절기월 간지가 있다. 신강·신약/용희기신/형파해가 not_calculated에 있으면 임의 생성하지 않는다.\n',
    'prompt saju rule',
)

replace_once(
    '    fp=hashlib.sha256(f"{FORTUNE_LAB_VERSION}|{topic}|{start_date}|{end_date}|{gender}|{ctx[\'birth_date\']}|{ctx[\'birth_time\']}|{ctx[\'natal_packed\']}|{ctx[\'houses_packed\']}".encode()).hexdigest()[:24]\n',
    '    fp=hashlib.sha256(f"{FORTUNE_LAB_VERSION}|{topic}|{start_date}|{end_date}|{gender}|{ctx[\'birth_date\']}|{ctx[\'birth_time\']}|{ctx[\'birth_lon\']}|{ctx[\'natal_packed\']}|{ctx[\'houses_packed\']}".encode()).hexdigest()[:24]\n',
    'cache fingerprint longitude',
)

replace_once(
    '            st.caption("1차 버전은 lunar_python의 절기 기준 원국/대운/연간/월간 간지를 사용해. 진태양시·신강약·용희기신·형파해 전체는 아직 미계산이라 AI가 만들지 못하게 프롬프트에서 잠가뒀어.")\n',
    '            st.caption("원국은 출생지 경도 + Swiss Ephemeris 균시차로 진태양시를 보정한 뒤 lunar_python 절기 기준으로 계산해. 신강약·용희기신·형파해 전체는 아직 미계산이라 AI가 만들지 못하게 프롬프트에서 잠가뒀어.")\n',
    'UI true solar caption',
)

P.write_text(text,encoding="utf-8")
print("Applied Fortune Lab true-solar correction v7.1.1")
