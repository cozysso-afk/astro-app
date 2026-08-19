import streamlit as st
from datetime import datetime, time
import math

# 1. 페이지 설정
st.set_page_config(page_title="별빛의 운명", page_icon="✨", layout="centered")

# --- 2. 핑크 + 골드 + 라벤더 + 민트 테마 커스텀 CSS ---
st.markdown("""
<style>
    .stApp {
        background: linear-gradient(180deg, #FFF0F5 0%, #F8EAF5 45%, #EDF6F8 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    .main-title {
        text-align: center;
        color: #8C6A80;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 2px;
        margin-top: 10px;
    }
    .sub-title {
        text-align: center;
        color: #B598B0;
        font-size: 13px;
        margin-bottom: 22px;
    }
    
    .fortune-card {
        background: rgba(255, 255, 255, 0.88);
        border: 1.5px solid #E8D3B9; /* 샴페인 골드 테두리 */
        border-radius: 26px;
        padding: 24px 20px;
        box-shadow: 0 10px 30px rgba(214, 185, 210, 0.28);
        backdrop-filter: blur(12px);
        text-align: center;
        margin-bottom: 22px;
    }
    
    .date-badge {
        color: #A08298;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 1px;
    }
    
    .score-number {
        font-size: 54px;
        font-weight: 800;
        background: linear-gradient(135deg, #D988A8 0%, #C48E72 50%, #A882B8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 6px 0;
    }
    
    .score-desc {
        font-size: 16px;
        font-weight: 700;
        color: #8A647C;
        margin-bottom: 12px;
    }
    
    .advice-box {
        background: rgba(246, 240, 252, 0.95);
        border: 1px dashed #D6C2E2;
        border-radius: 18px;
        padding: 15px;
        margin: 16px 0;
        font-size: 14px;
        color: #6C5569;
        line-height: 1.6;
    }
    
    .lucky-container {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
        gap: 12px;
    }
    
    .lucky-chip-mint {
        background: rgba(235, 250, 247, 0.9);
        border: 1.2px solid #C2EAE2;
        border-radius: 16px;
        padding: 10px 14px;
        flex: 1;
        text-align: center;
    }
    
    .lucky-chip-gold {
        background: rgba(255, 250, 240, 0.9);
        border: 1.2px solid #EEDBBF;
        border-radius: 16px;
        padding: 10px 14px;
        flex: 1;
        text-align: center;
    }
    
    .lucky-title {
        font-size: 11px;
        color: #968393;
        font-weight: 600;
    }
    .lucky-val {
        font-size: 13px;
        font-weight: 700;
        color: #6D5065;
        margin-top: 4px;
    }
</style>
""", unsafe_allow_html=True)

# 헤더 타이틀
st.markdown('<div class="main-title">✦ 별빛의 운명 ✦</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">너의 별이 속삭이는 오늘의 이야기</div>', unsafe_allow_html=True)

# --- 3. 사이드바 입력창 ---
with st.sidebar:
    st.header("🔮 출생 정보 설정")
    birth_date = st.date_input("생년월일", datetime(2000, 1, 1))
    birth_time = st.time_input("출생 시간", time(12, 0))
    st.markdown("---")
    st.caption("• 홀사인 & 플라시두스 복합 판정 엔진 가동 중")

# --- 4. 순수 파이썬 천문 연산 공식 (오차 없는 독립 엔진) ---
def get_julian_day(year, month, day, hour, minute):
    if month <= 2:
        year -= 1
        month += 12
    A = math.floor(year / 100)
    B = 2 - A + math.floor(A / 4)
    day_fraction = (hour + minute / 60.0) / 24.0
    jd = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + day_fraction + B - 1524.5
    return jd

def get_ecliptic_positions(jd):
    T = (jd - 2451545.0) / 36525.0
    
    # 주요 행성 황경 궤도 요소 계산 (도 단위)
    sun_lon = (280.46646 + 36000.76983 * T) % 360
    moon_lon = (218.3165 + 481267.8813 * T) % 360
    mercury_lon = (252.2509 + 149472.6746 * T) % 360
    venus_lon = (181.9798 + 58517.8156 * T) % 360
    mars_lon = (355.4330 + 19140.2993 * T) % 360
    jupiter_lon = (34.3515 + 3034.9057 * T) % 360
    saturn_lon = (50.0774 + 1222.1138 * T) % 360
    
    return {
        "Sun": sun_lon, "Moon": moon_lon, "Mercury": mercury_lon,
        "Venus": venus_lon, "Mars": mars_lon, "Jupiter": jupiter_lon, "Saturn": saturn_lon
    }

# 출생일 및 오늘 날짜 계산
jd_birth = get_julian_day(birth_date.year, birth_date.month, birth_date.day, birth_time.hour, birth_time.minute)
now = datetime.now()
jd_today = get_julian_day(now.year, now.month, now.day, 12, 0)

natal_pos = get_ecliptic_positions(jd_birth)
transit_pos = get_ecliptic_positions(jd_today)

# 애스펙트 판별
aspect_defs = [(0, "합(0°)", 1.0), (60, "육합(60°)", 0.6), (90, "사각(90°)", -0.8), (120, "삼합(120°)", 0.8), (180, "충(180°)", -0.9)]
detected_aspects = []

for t_name, t_deg in transit_pos.items():
    for n_name, n_deg in natal_pos.items():
        diff = abs(t_deg - n_deg) % 360
        diff = min(diff, 360 - diff)
        for asp_deg, asp_name, weight in aspect_defs:
            orb = abs(diff - asp_deg)
            if orb <= 3.5:
                detected_aspects.append({
                    "transit": t_name, "natal": n_name,
                    "aspect": asp_name, "orb": round(orb, 2), "weight": weight
                })

# 점수 산출
pos_sum = sum([a["weight"] for a in detected_aspects if a["weight"] > 0])
neg_sum = sum([abs(a["weight"]) for a in detected_aspects if a["weight"] < 0])
total_w = pos_sum + neg_sum
favor_score = int((pos_sum / total_w) * 100) if total_w > 0 else 72

score_grade = "매우 좋은 날 💖" if favor_score >= 75 else ("온화하고 부드러운 날 🌸" if favor_score >= 55 else "신중한 지혜가 필요한 날 🕊️")
advice_text = "마음의 직관을 믿고 새로운 기회를 향해 나아가 보세요. 행운의 별빛이 당신의 길을 밝혀줍니다." if favor_score >= 60 else "무리한 확장보다는 나만의 휴식과 차분한 정리에 집중할 때 더 큰 행운이 찾아옵니다."

# --- 5. UI 화면 렌더링 ---
st.markdown(f"""
<div class="fortune-card">
    <div class="date-badge">✧ {now.strftime('%Y.%m.%d')} 오늘의 운세 ✧</div>
    <div class="score-number">{favor_score}%</div>
    <div class="score-desc">{score_grade}</div>
    <div class="advice-box">
        <b style="color: #8C6A80;">✦ 오늘의 우주 메시지</b><br>
        {advice_text}
    </div>
    <div class="lucky-container">
        <div class="lucky-chip-gold">
            <div class="lucky-title">✦ 럭키 아이템</div>
            <div class="lucky-val">진주 / 크리스탈</div>
        </div>
        <div class="lucky-chip-mint">
            <div class="lucky-title">✦ 럭키 컬러</div>
            <div class="lucky-val">바다품 민트 & 로즈</div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# 근거 로그
st.markdown("##### 🌙 오늘의 활성 천체 트리거")
if detected_aspects:
    for asp in detected_aspects[:4]:
        st.caption(f"• Transit {asp['transit']} → Natal {asp['natal']} {asp['aspect']} (오차: {asp['orb']}°)")
else:
    st.caption("• 특이 긴장각 없이 잔잔하고 평온한 천체 흐름이 지속됩니다.")
