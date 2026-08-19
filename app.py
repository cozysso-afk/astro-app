import streamlit as st
import swisseph as swe
from datetime import datetime, time
import os

st.set_page_config(page_title="Personal Astro Analyzer", page_icon="✨", layout="centered")

st.title("✨ 나만의 맞춤 별자리 운세")
st.caption("홀사인(Whole Sign) & 플라시두스(Placidus) 듀얼 엔진 분석 시스템")

# --- 1. 사용자 출생 정보 입력 폼 ---
with st.sidebar:
    st.header("🔮 출생 정보 설정")
    birth_date = st.date_input("생년월일", datetime(2000, 1, 1))
    birth_time = st.time_input("출생 시간", time(12, 0))
    lat = st.number_input("출생지 위도 (서울 기준: 37.56)", value=37.56, format="%.2f")
    lon = st.number_input("출생지 경도 (서울 기준: 126.97)", value=126.97, format="%.2f")
    
    st.markdown("---")
    house_mode = st.radio("하우스 시스템 선택", ["통합 (홀사인 + 플라시두스)", "홀사인 (Whole Sign)", "플라시두스 (Placidus)"])

# --- 2. 천체 계산 로직 ---
def calculate_astro(b_date, b_time, target_dt, lat, lon):
    # 생년월일시 Julian Day 계산 (UTC 기준 대략치 계산)
    b_hour_dec = b_time.hour + (b_time.minute / 60.0) - 9.0  # KST -> UTC 보정
    jd_natal = swe.julday(b_date.year, b_date.month, b_date.day, b_hour_dec)
    
    # 오늘 날짜 Julian Day 계산
    t_hour_dec = 12.0 - 9.0
    jd_transit = swe.julday(target_dt.year, target_dt.month, target_dt.day, t_hour_dec)
    
    # 주요 행성 정의
    planets = {
        "Sun": swe.SUN, "Moon": swe.MOON, "Mercury": swe.MERCURY, 
        "Venus": swe.VENUS, "Mars": swe.MARS, "Jupiter": swe.JUPITER, 
        "Saturn": swe.SATURN, "Uranus": swe.URANUS, "Pluto": swe.PLUTO
    }
    
    # 네이탈 좌표 계산
    natal_pos = {}
    for name, pid in planets.items():
        res, _ = swe.calc_ut(jd_natal, pid)
        natal_pos[name] = res[0]
        
    # 트랜짓 좌표 계산
    transit_pos = {}
    for name, pid in planets.items():
        res, _ = swe.calc_ut(jd_transit, pid)
        transit_pos[name] = res[0]
        
    # 하우스 계산 (W: Whole Sign, P: Placidus)
    h_whole, ascmc_w = swe.houses_ex(jd_natal, lat, lon, b'W')
    h_placidus, ascmc_p = swe.houses_ex(jd_natal, lat, lon, b'P')
    
    # 주요 애스펙트(0, 60, 90, 120, 180) 탐지 및 오브 계산
    aspect_types = [(0, "합(Conjunction)", 1.0), (60, "육합(Sextile)", 0.6), (90, "사각(Square)", -0.8), (120, "삼합(Trine)", 0.8), (180, "충(Opposition)", -0.9)]
    detected_aspects = []
    
    for t_name, t_deg in transit_pos.items():
        for n_name, n_deg in natal_pos.items():
            diff = abs(t_deg - n_deg) % 360
            diff = min(diff, 360 - diff)
            
            for asp_deg, asp_name, weight in aspect_types:
                orb = abs(diff - asp_deg)
                if orb <= 3.0:  # 유효 오브 3도 이내
                    detected_aspects.append({
                        "transit": t_name,
                        "natal": n_name,
                        "aspect": asp_name,
                        "orb": round(orb, 2),
                        "weight": weight
                    })
                    
    return natal_pos, transit_pos, detected_aspects, ascmc_p[0]

# --- 3. 실행 및 화면 표시 ---
today = datetime.now()
natal_pos, transit_pos, aspects, asc_deg = calculate_astro(birth_date, birth_time, today, lat, lon)

# 점수 계산 (활성도 & 우호도)
base_activity = min(100, 40 + len(aspects) * 12)
pos_scores = [a["weight"] for a in aspects if a["weight"] > 0]
neg_scores = [abs(a["weight"]) for a in aspects if a["weight"] < 0]

favor_score = 50
if aspects:
    pos_sum = sum(pos_scores)
    neg_sum = sum(neg_scores)
    total = pos_sum + neg_sum
    if total > 0:
        favor_score = int((pos_sum / total) * 100)

col1, col2 = st.columns(2)
with col1:
    st.metric(label="🔥 오늘의 활성도 (에너지/사건성)", value=f"{base_activity} / 100")
with col2:
    st.metric(label="☀️ 오늘의 우호도 (흐름/조화)", value=f"{favor_score} / 100")

st.markdown("---")
st.subheader("📊 오늘의 주요 천체 트리거 (근거 로그)")

if aspects:
    for asp in aspects:
        orb_strength = "🔥 최강" if asp['orb'] <= 0.5 else ("⚡ 강함" if asp['orb'] <= 1.5 else "✨ 유효")
        st.write(f"- **Transit {asp['transit']}** → **Natal {asp['natal']}** {asp['aspect']} (오차: `{asp['orb']}°` | {orb_strength})")
else:
    st.info("오늘 강하게 걸리는 메이저 애스펙트가 적어 평온하고 잔잔한 하루입니다.")

st.markdown("---")
st.subheader("💡 점성학적 맞춤 조언")
if favor_score >= 60:
    st.success("자연스러운 지원 흐름과 긍정적인 기회가 돋보이는 날입니다. 중요한 결정이나 소통에 자신감을 가지셔도 좋습니다.")
elif favor_score <= 40:
    st.warning("내외부적인 압력이나 긴장감이 발생하기 쉬운 날입니다. 감정적 충돌을 피하고 꼼꼼한 마무리에 집중하세요.")
else:
    st.info("활동성과 사건성이 균형을 이루는 날입니다. 루틴을 일정하게 유지하며 흐름을 관망하는 것이 좋습니다.")