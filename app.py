import streamlit as st
from datetime import datetime, time
import numpy as np
from skyfield.api import load
from skyfield import almanac

# 1. 페이지 설정
st.set_page_config(page_title="별빛의 운명", page_icon="✨", layout="centered")

# --- 2. 핑크 + 골드 + 라벤더 + 민트 테마 커스텀 CSS ---
st.markdown("""

""", unsafe_allow_html=True)

# 헤더 타이틀
st.markdown('✦ 별빛의 운명 ✦', unsafe_allow_html=True)
st.markdown('너의 별이 속삭이는 오늘의 이야기', unsafe_allow_html=True)

# --- 3. 사이드바 ---
with st.sidebar:
    st.header("🔮 출생 정보 설정")
    birth_date = st.date_input("생년월일", datetime(2000, 1, 1))
    birth_time = st.time_input("출생 시간", time(12, 0))
    st.markdown("---")
    st.caption("• NASA JPL 고정밀 에페메리스 연산 엔진 가동")

# --- 4. NASA JPL 천문 계산 엔진 (Skyfield) ---
@st.cache_resource
def load_ephemeris():
    ts = load.timescale()
    eph = load('de421.bsp')  # NASA JPL 표준 천체력 데이터
    return ts, eph

ts, eph = load_ephemeris()
earth = eph['earth']

planets_dict = {
    'Sun': eph['sun'],
    'Moon': eph['moon'],
    'Mercury': eph['mercury'],
    'Venus': eph['venus'],
    'Mars': eph['mars'],
    'Jupiter': eph['jupiter barycenter'],
    'Saturn': eph['saturn barycenter'],
    'Uranus': eph['uranus barycenter']
}

def get_positions(t_obj):
    positions = {}
    for name, body in planets_dict.items():
        astrometric = earth.at(t_obj).observe(body)
        lat, lon, dist = astrometric.ecliptic_latlon()
        positions[name] = lon.degrees
    return positions

# 출생 및 오늘 시간 (KST -> UTC)
utc_hour = birth_time.hour - 9
b_day = birth_date.day
if utc_hour < 0:
    utc_hour += 24
    b_day -= 1

t_natal = ts.utc(birth_date.year, birth_date.month, max(1, b_day), utc_hour, birth_time.minute)
today_dt = datetime.now()
t_transit = ts.utc(today_dt.year, today_dt.month, today_dt.day, 3, 0)

natal_pos = get_positions(t_natal)
transit_pos = get_positions(t_transit)

# 애스펙트 추출
aspect_defs = [(0, "합(0°)", 1.0), (60, "육합(60°)", 0.6), (90, "사각(90°)", -0.8), (120, "삼합(120°)", 0.8), (180, "충(180°)", -0.9)]
detected_aspects = []

for t_name, t_deg in transit_pos.items():
    for n_name, n_deg in natal_pos.items():
        diff = abs(t_deg - n_deg) % 360
        diff = min(diff, 360 - diff)
        for asp_deg, asp_name, weight in aspect_defs:
            orb = abs(diff - asp_deg)
            if orb <= 3.0:
                detected_aspects.append({
                    "transit": t_name, "natal": n_name,
                    "aspect": asp_name, "orb": round(orb, 2), "weight": weight
                })

# 점수 산출
pos_sum = sum([a["weight"] for a in detected_aspects if a["weight"] > 0])
neg_sum = sum([abs(a["weight"]) for a in detected_aspects if a["weight"] < 0])
total_w = pos_sum + neg_sum
favor_score = int((pos_sum / total_w) * 100) if total_w > 0 else 68

score_grade = "매우 좋은 날 💖" if favor_score >= 75 else ("온화하고 부드러운 날 🌸" if favor_score >= 55 else "신중한 지혜가 필요한 날 🕊️")
advice_text = "마음의 직관을 믿고 새로운 기회를 향해 나아가 보세요. 행운의 별빛이 당신의 길을 밝혀줍니다." if favor_score >= 60 else "무리한 확장보다는 나만의 휴식과 차분한 정리에 집중할 때 더 큰 행운이 찾아옵니다."

# --- 5. UI 화면 렌더링 ---
st.markdown(f"""

    ✧ {today_dt.strftime('%Y.%m.%d')} 오늘의 운세 ✧
    {favor_score}%
    {score_grade}
    
        ✦ 오늘의 우주 메시지
        {advice_text}
    
    
        
            ✦ 럭키 아이템
            진주 / 크리스탈
        
        
            ✦ 럭키 컬러
            바다품 민트 & 로즈
        
    

""", unsafe_allow_html=True)

# 근거 로그
st.markdown("##### 🌙 오늘의 활성 천체 트리거 (NASA JPL 고정밀)")
if detected_aspects:
    for asp in detected_aspects[:4]:
        orb_tag = "🔥 최강" if asp['orb'] <= 0.8 else "✨ 유효"
        st.caption(f"• Transit {asp['transit']} → Natal {asp['natal']} {asp['aspect']} (오차: {asp['orb']}° | {orb_tag})")
else:
    st.caption("• 특이 긴장각 없이 잔잔하고 평온한 천체 흐름이 지속됩니다.")
