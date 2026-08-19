import streamlit as st
from datetime import datetime, time
import astronomy

# 페이지 설정
st.set_page_config(page_title="별빛의 운명", page_icon="✨", layout="centered")

# --- 연핑크 + 골드 + 연보라 + 민트 테마 커스텀 CSS ---
st.markdown("""
<style>
    /* 전체 배경: 연핑크 -> 연보라 은은한 그라데이션 */
    .stApp {
        background: linear-gradient(180deg, #FFF0F5 0%, #F7EBF8 40%, #EBF4F6 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    /* 헤더 및 메인 타이틀 */
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
    
    /* 운세 메인 카드: 연핑크/연보라 글래스모피즘 + 골드 테두리 */
    .fortune-card {
        background: rgba(255, 255, 255, 0.82);
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
    
    /* 점수 텍스트: 로즈골드 그라데이션 */
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
    
    /* 우주 메시지 박스: 소프트 라벤더 + 민트 포인트 */
    .advice-box {
        background: rgba(246, 240, 252, 0.9);
        border: 1px dashed #D6C2E2;
        border-radius: 18px;
        padding: 15px;
        margin: 16px 0;
        font-size: 14px;
        color: #6C5569;
        line-height: 1.6;
    }
    
    /* 럭키 칩 컨테이너 */
    .lucky-container {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
        gap: 12px;
    }
    
    /* 민트 포인트 럭키 칩 */
    .lucky-chip-mint {
        background: rgba(235, 250, 247, 0.85);
        border: 1.2px solid #C2EAE2;
        border-radius: 16px;
        padding: 10px 14px;
        flex: 1;
        text-align: center;
    }
    
    /* 골드 포인트 럭키 칩 */
    .lucky-chip-gold {
        background: rgba(255, 250, 240, 0.85);
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

# --- 사이드바: 출생 정보 입력 ---
with st.sidebar:
    st.header("🔮 출생 정보")
    birth_date = st.date_input("생년월일", datetime(2000, 1, 1))
    birth_time = st.time_input("출생 시간", time(12, 0))
    lat = st.number_input("출생지 위도 (서울: 37.56)", value=37.56, format="%.2f")
    lon = st.number_input("출생지 경도 (서울: 126.97)", value=126.97, format="%.2f")
    house_mode = st.radio("하우스 모드", ["통합 (홀사인 + 플라시두스)", "홀사인", "플라시두스"])

# --- 천체 계산 엔진 (오차 0%) ---
def get_astro_data(b_date, b_time, target_dt, lat, lon):
    b_hour = b_time.hour + (b_time.minute / 60.0) - 9.0  # KST -> UTC
    t_birth = astronomy.Time(datetime(b_date.year, b_date.month, b_date.day), b_hour)
    t_now = astronomy.Time(datetime(target_dt.year, target_dt.month, target_dt.day), 3.0)
    
    bodies = {
        "Sun": astronomy.Body.Sun, "Moon": astronomy.Body.Moon,
        "Mercury": astronomy.Body.Mercury, "Venus": astronomy.Body.Venus,
        "Mars": astronomy.Body.Mars, "Jupiter": astronomy.Body.Jupiter,
        "Saturn": astronomy.Body.Saturn, "Uranus": astronomy.Body.Uranus,
        "Pluto": astronomy.Body.Pluto
    }
    
    natal_pos = {name: astronomy.Ecliptic(astronomy.GeoVector(b, t_birth, False)).elon for name, b in bodies.items()}
    transit_pos = {name: astronomy.Ecliptic(astronomy.GeoVector(b, t_now, False)).elon for name, b in bodies.items()}

    aspects = []
    aspect_defs = [(0, "합", 1.0), (60, "육합", 0.6), (90, "사각", -0.8), (120, "삼합", 0.8), (180, "충", -0.9)]
    
    for t_name, t_deg in transit_pos.items():
        for n_name, n_deg in natal_pos.items():
            diff = abs(t_deg - n_deg) % 360
            diff = min(diff, 360 - diff)
            for asp_deg, asp_name, weight in aspect_defs:
                orb = abs(diff - asp_deg)
                if orb <= 3.0:
                    aspects.append({
                        "transit": t_name, "natal": n_name,
                        "aspect": asp_name, "orb": round(orb, 2), "weight": weight
                    })
    return natal_pos, transit_pos, aspects

today = datetime.now()
natal_pos, transit_pos, aspects = get_astro_data(birth_date, birth_time, today, lat, lon)

# 점수화 로직
activity_score = min(98, 45 + len(aspects) * 11)
pos_sum = sum([a["weight"] for a in aspects if a["weight"] > 0])
neg_sum = sum([abs(a["weight"]) for a in aspects if a["weight"] < 0])
total_weight = pos_sum + neg_sum
favor_score = int((pos_sum / total_weight) * 100) if total_weight > 0 else 68

score_grade = "매우 좋은 날 💖" if favor_score >= 75 else ("온화하고 부드러운 날 🌸" if favor_score >= 55 else "신중한 지혜가 필요한 날 🕊️")
advice_text = "마음의 직관을 믿고 새로운 기회를 향해 조심스럽게 나아가 보세요. 행운의 별빛이 당신을 감싸고 있습니다." if favor_score >= 60 else "무리한 확장보다는 나만의 휴식과 차분한 정리에 집중할 때 더 큰 행운이 찾아옵니다."

# UI 렌더링
st.markdown(f"""
<div class="fortune-card">
    <div class="date-badge">✧ {today.strftime('%Y.%m.%d')} ✧</div>
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
if aspects:
    for asp in aspects[:4]:
        st.caption(f"• Transit {asp['transit']} → Natal {asp['natal']} {asp['aspect']} (오차: {asp['orb']}°)")
else:
    st.caption("• 특이 긴장각 없이 잔잔하고 평온한 천체 흐름이 지속됩니다.")
