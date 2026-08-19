import streamlit as st
from datetime import datetime, date, time, timedelta
import math
from skyfield.api import load

# 1. 페이지 설정
st.set_page_config(page_title="별빛의 운명", page_icon="✨", layout="centered", initial_sidebar_state="collapsed")

# --- 2. 커스텀 CSS (첫 번째 일러스트 배경 + 핑크/골드/라벤더/민트 팔레트) ---
st.markdown("""
<style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

    /* 전체 배경: 은은한 핑크/골드 블렌딩 및 천체 테마 */
    .stApp {
        background: linear-gradient(180deg, #FDEBF2 0%, #F5E4F0 40%, #EAF3F5 100%);
        background-attachment: fixed;
        font-family: 'Pretendard', -apple-system, sans-serif;
        color: #583F52;
    }

    /* 상단 장식 헤더 */
    .header-box {
        text-align: center;
        padding: 15px 10px 8px 10px;
    }
    .header-title {
        font-size: 27px;
        font-weight: 800;
        letter-spacing: 3px;
        background: linear-gradient(135deg, #B57496 0%, #C99368 50%, #987AB8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 3px;
    }
    .header-sub {
        font-size: 12px;
        color: #A6879E;
        letter-spacing: 1px;
        font-weight: 500;
    }

    /* 메인 종합 운세 카드 (샴페인 골드 테두리 + 로즈 글래스) */
    .main-card {
        background: rgba(255, 255, 255, 0.85);
        border: 1.5px solid #EADBCE;
        border-radius: 28px;
        padding: 22px 18px;
        margin: 12px 0 18px 0;
        box-shadow: 0 12px 36px rgba(200, 165, 190, 0.22);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        text-align: center;
    }
    
    .gauge-circle {
        display: inline-block;
        border: 1.5px dashed #D5BFD2;
        border-radius: 50%;
        padding: 16px 24px;
        margin: 10px 0;
        background: radial-gradient(circle, rgba(255,248,252,0.95) 0%, rgba(247,237,249,0.6) 100%);
    }

    .main-score {
        font-size: 48px;
        font-weight: 800;
        background: linear-gradient(135deg, #D4799E 0%, #C89065 50%, #9875B8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.1;
    }

    .main-grade {
        font-size: 15px;
        font-weight: 700;
        color: #7E5972;
        margin-top: 4px;
    }

    /* 4대 영역별 카드 스타일 */
    .theme-card {
        background: rgba(255, 255, 255, 0.88);
        border: 1.2px solid #EEDFCE;
        border-radius: 20px;
        padding: 16px 18px;
        margin-bottom: 12px;
        box-shadow: 0 6px 16px rgba(215, 185, 205, 0.14);
    }
    .theme-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
    }
    .theme-title {
        font-size: 15px;
        font-weight: 700;
        color: #6C4B62;
    }
    .theme-score {
        font-size: 14px;
        font-weight: 800;
        color: #BF6C90;
        background: #FDF0F6;
        padding: 2px 10px;
        border-radius: 12px;
        border: 1px solid #F6D6E5;
    }
    .theme-desc {
        font-size: 13px;
        color: #6D5667;
        line-height: 1.55;
    }
    .theme-trigger {
        font-size: 11px;
        color: #A3889B;
        margin-top: 6px;
        background: rgba(247, 240, 248, 0.7);
        padding: 4px 8px;
        border-radius: 8px;
    }

    /* 럭키 칩 */
    .chip-gold {
        background: rgba(255, 250, 240, 0.92);
        border: 1.2px solid #E8D6BC;
        border-radius: 16px;
        padding: 10px;
        text-align: center;
    }
    .chip-mint {
        background: rgba(235, 250, 247, 0.92);
        border: 1.2px solid #BFE7DF;
        border-radius: 16px;
        padding: 10px;
        text-align: center;
    }
    .chip-label { font-size: 11px; color: #9A8495; font-weight: 600; }
    .chip-val { font-size: 13px; font-weight: 700; color: #62485A; margin-top: 3px; }

    /* 탭 디자인 */
    .stTabs [data-baseweb="tab-list"] {
        gap: 6px;
        justify-content: center;
        background: rgba(255, 255, 255, 0.5);
        padding: 6px;
        border-radius: 20px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 14px;
        padding: 6px 14px;
        font-size: 13px;
        color: #8C6F84;
        border: none;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #ECCFE0 0%, #E6E1F6 100%) !important;
        color: #5F3C55 !important;
        font-weight: 700 !important;
    }
</style>
""", unsafe_allow_html=True)

# 헤더 UI
st.markdown("""
<div class="header-box">
    <div class="header-title">✦ 별빛의 운명 ✦</div>
    <div class="header-sub">너의 별이 속삭이는 오늘의 이야기</div>
</div>
""", unsafe_allow_html=True)

# --- 3. NASA JPL 천문 계산 엔진 (Skyfield) ---
@st.cache_resource
def get_engine():
    ts = load.timescale()
    eph = load('de421.bsp')
    return ts, eph

ts, eph = get_engine()
earth = eph['earth']
planets = {
    'Sun': eph['sun'], 'Moon': eph['moon'], 'Mercury': eph['mercury'],
    'Venus': eph['venus'], 'Mars': eph['mars'], 'Jupiter': eph['jupiter barycenter'],
    'Saturn': eph['saturn barycenter'], 'Uranus': eph['uranus barycenter']
}

# --- 4. 내 출생 정보 입력 패널 (네이탈 차트 설정) ---
with st.expander("🔮 내 차트 정보 (Natal Chart) 설정 & 수정", expanded=False):
    col_a, col_b = st.columns(2)
    with col_a:
        b_date = st.date_input("생년월일", date(2000, 1, 1))
        b_time = st.time_input("출생 시간", time(12, 0))
    with col_b:
        city_coords = {
            "서울": (37.56, 126.97),
            "부산": (35.18, 129.07),
            "대구": (35.87, 128.60),
            "광주": (35.16, 126.85),
            "대전": (36.35, 127.38)
        }
        city = st.selectbox("출생 도시", list(city_coords.keys()))
        h_system = st.radio("하우스 체계", ["홀사인 (Whole Sign)", "플라시두스 (Placidus)"], horizontal=True)

lat, lon = city_coords[city]

# --- 5. 점성술 핵심 계산 (ASC / 하우스 / 애스펙트) ---
def get_ascendant(t_obj, lat, lon):
    # 그리니치 항성시(GST) 및 지방항성시(LST) 계산
    gst = t_obj.gast
    lst = (gst * 15.0 + lon) % 360.0
    # 황도경사각 (약 23.44도)
    eps = math.radians(23.4392911)
    ramc = math.radians(lst)
    phi = math.radians(lat)
    
    y = -math.cos(ramc)
    x = math.sin(ramc) * math.cos(eps) + math.tan(phi) * math.sin(eps)
    asc_rad = math.atan2(y, x)
    asc_deg = (math.degrees(asc_rad) + 360.0) % 360.0
    return asc_deg

def calculate_full_chart(target_dt, b_d, b_t, lat, lon):
    utc_h = b_t.hour - 9
    b_day = b_d.day + (1 if utc_h >= 24 else (-1 if utc_h < 0 else 0))
    utc_h = utc_h % 24
    t_natal = ts.utc(b_d.year, b_d.month, max(1, b_day), utc_h, b_t.minute)
    t_transit = ts.utc(target_dt.year, target_dt.month, target_dt.day, 3, 0)
    
    # ASC 계산
    natal_asc = get_ascendant(t_natal, lat, lon)
    
    n_pos, t_pos = {}, {}
    for name, p in planets.items():
        n_pos[name] = earth.at(t_natal).observe(p).ecliptic_latlon()[1].degrees
        t_pos[name] = earth.at(t_transit).observe(p).ecliptic_latlon()[1].degrees
        
    # 하우스 위치 판정 (Whole Sign 기준)
    asc_sign_index = int(natal_asc // 30)
    def get_house(deg):
        sign_idx = int(deg // 30)
        return ((sign_idx - asc_sign_index) % 12) + 1
        
    natal_houses = {k: get_house(v) for k, v in n_pos.items()}
    transit_houses = {k: get_house(v) for k, v in t_pos.items()}

    # 애스펙트 탐지
    aspects = []
    aspect_rules = [
        (0, "합(0°)", 1.0), (60, "육합(60°)", 0.6), (90, "사각(90°)", -0.9), 
        (120, "삼합(120°)", 0.9), (180, "충(180°)", -1.0)
    ]
    for t_name, t_deg in t_pos.items():
        for n_name, n_deg in n_pos.items():
            diff = abs(t_deg - n_deg) % 360
            diff = min(diff, 360 - diff)
            for asp_deg, asp_name, weight in aspect_rules:
                orb = abs(diff - asp_deg)
                if orb <= 3.2:
                    aspects.append({
                        "transit": t_name, "natal": n_name,
                        "aspect": asp_name, "orb": round(orb, 2), "weight": weight,
                        "t_house": transit_houses[t_name],
                        "n_house": natal_houses[n_name]
                    })
    return n_pos, t_pos, natal_houses, transit_houses, aspects, natal_asc

# 4대 세부 영역별 점성학적 가중치 분석 엔진
def evaluate_domain(aspects, t_houses, domain_key):
    # 도메인별 핵심 하우스 및 행성 정의
    rules = {
        "love": {
            "name": "💖 연애운 & 애정 매력도",
            "houses": [5, 7], "planets": ["Venus", "Mars", "Moon", "Sun"],
            "base": 72,
            "good_msg": "금성과 5/7하우스의 흐름이 우호적입니다. 매력이 돋보이며 설레는 소통과 진솔한 호감이 무르익는 타이밍입니다.",
            "bad_msg": "달과 화성의 긴장각으로 사소한 서운함이 생길 수 있습니다. 감정적인 직언보다는 부드러운 화법이 필요합니다."
        },
        "reunion": {
            "name": "🕊️ 재회운 & 인연의 고리",
            "houses": [7, 12, 4], "planets": ["Venus", "Mercury", "Saturn", "Moon"],
            "base": 64,
            "good_msg": "수성과 금성의 순행각으로 과거 인연과의 오해가 풀릴 수 있는 온화한 기운입니다. 자연스러운 안부가 길합니다.",
            "bad_msg": "토성의 압박으로 과거의 아쉬움이 떠오를 수 있습니다. 성급하게 연락하기보다 내 감정을 먼저 정리하세요."
        },
        "study": {
            "name": "📚 학업운 & 시험·합격운",
            "houses": [9, 3, 10], "planets": ["Mercury", "Jupiter", "Saturn", "Sun"],
            "base": 75,
            "good_msg": "수성과 목성의 조화로 두뇌 회전과 암기 효율이 최고조에 달합니다. 시험이나 실전 과제에서 유의미한 성과를 냅니다.",
            "bad_msg": "해당 영역에 긴장각이 걸려 피로도나 집중력 저하가 올 수 있습니다. 50분 집중 후 10분 스트레칭 루틴을 지키세요."
        },
        "money": {
            "name": "💎 주식 투자 & 재물 실현운",
            "houses": [2, 8, 5], "planets": ["Jupiter", "Venus", "Saturn", "Mars"],
            "base": 68,
            "good_msg": "2/8하우스와 길성의 조화로 현금 흐름 및 익절 실현에 유리합니다. 원칙에 맞춘 결실을 거두기에 적기입니다.",
            "bad_msg": "변동성 행성의 사각으로 뇌동매매나 충동 매수가 위험할 수 있습니다. 관망하며 시드를 지키는 것이 이득입니다."
        }
    }
    
    cfg = rules[domain_key]
    score = cfg["base"]
    matched_triggers = []
    
    for a in aspects:
        is_relevant = (a["transit"] in cfg["planets"] or a["natal"] in cfg["planets"] or 
                       a["t_house"] in cfg["houses"] or a["n_house"] in cfg["houses"])
        if is_relevant:
            # 오차가 작을수록 가중치 증폭
            delta = a["weight"] * (3.5 - a["orb"]) * 4.2
            score += delta
            matched_triggers.append(f"Transit {a['transit']}({a['t_house']}H) ➔ Natal {a['natal']}({a['n_house']}H) {a['aspect']}")
            
    final_score = int(max(15, min(99, score)))
    msg = cfg["good_msg"] if final_score >= 70 else cfg["bad_msg"]
    return cfg["name"], final_score, msg, matched_triggers

# 6. 상단 네비게이션 탭 (일일 운세 / 주간 흐름 / 월간 리포트)
tab_daily, tab_weekly, tab_monthly = st.tabs(["✨ 오늘의 운세", "📅 주간 흐름", "🌕 월간 리포트"])

now_date = datetime.now().date()
n_pos, t_pos, n_houses, t_houses, daily_aspects, asc_deg = calculate_full_chart(now_date, b_date, b_time, lat, lon)

# --- TAB 1: 오늘의 운세 (4대 테마 완벽 분리) ---
with tab_daily:
    love_title, love_score, love_msg, love_trig = evaluate_domain(daily_aspects, t_houses, "love")
    re_title, re_score, re_msg, re_trig = evaluate_domain(daily_aspects, t_houses, "reunion")
    study_title, study_score, study_msg, study_trig = evaluate_domain(daily_aspects, t_houses, "study")
    money_title, money_score, money_msg, money_trig = evaluate_domain(daily_aspects, t_houses, "money")
    
    total_score = int((love_score + re_score + study_score + money_score) / 4)
    grade_desc = "하늘의 별빛이 강력하게 밀어주는 날 ✨" if total_score >= 80 else ("온화하고 조화로운 순풍의 하루 🌸" if total_score >= 60 else "신중하게 페이스를 조절해야 하는 날 🕊️")

    # 메인 원형 점수 카드
    st.markdown(f"""
    <div class="main-card">
        <div style="font-size: 13px; font-weight:600; color:#A28499;">✧ {now_date.strftime('%Y년 %m월 %d일')} 오늘의 종합 운세 ✧</div>
        <div class="gauge-circle">
            <div class="main-score">{total_score}%</div>
        </div>
        <div class="main-grade">{grade_desc}</div>
        <div style="font-size: 13px; color:#785F73; margin-top: 10px; line-height: 1.6;">
            상승궁(ASC: {asc_deg:.1f}°)과 오늘 하늘의 천체 에너지가 조화를 이루고 있습니다.<br>내면의 직관을 신뢰하고 중요한 과제에 집중해 보세요.
        </div>
    </div>
    """, unsafe_allow_html=True)

    # 4대 세부 테마 카드 렌더링
    st.markdown("#### 🌸 테마별 정밀 분석 리포트")
    
    for title, score, msg, trigs in [
        (love_title, love_score, love_msg, love_trig),
        (re_title, re_score, re_msg, re_trig),
        (study_title, study_score, study_msg, study_trig),
        (money_title, money_score, money_msg, money_trig)
    ]:
        trig_html = f"<div class='theme-trigger'>• 주요 트리거: {trigs[0]}</div>" if trigs else ""
        st.markdown(f"""
        <div class="theme-card">
            <div class="theme-header">
                <span class="theme-title">{title}</span>
                <span class="theme-score">{score}점</span>
            </div>
            <div class="theme-desc">{msg}</div>
            {trig_html}
        </div>
        """, unsafe_allow_html=True)

    # 럭키 아이템 / 컬러 칩
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("""
        <div class="chip-gold">
            <div class="chip-label">✦ 럭키 아이템</div>
            <div class="chip-val">천연 진주 / 골드 링</div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("""
        <div class="chip-mint">
            <div class="chip-label">✦ 럭키 컬러</div>
            <div class="chip-val">바다품 민트 & 로즈</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    
    # NASA JPL 정밀 트리거 로그
    with st.expander("🌙 오늘의 활성 천체 전체 로그 (NASA JPL)", expanded=False):
        if daily_aspects:
            for a in daily_aspects:
                orb_str = "🔥 최강" if a['orb'] <= 0.8 else "✨ 유효"
                st.caption(f"• Transit {a['transit']}({a['t_house']}H) ➔ Natal {a['natal']}({a['n_house']}H) {a['aspect']} (오차: {a['orb']}° | {orb_str})")
        else:
            st.caption("• 특이 긴장각 없이 평온한 기운이 지속됩니다.")

# --- TAB 2: 주간 흐름 ---
with tab_weekly:
    st.markdown("#### 📅 향후 7일간의 에너지 곡선")
    for i in range(7):
        target_d = now_date + timedelta(days=i)
        _, _, _, _, w_aspects, _ = calculate_full_chart(target_d, b_date, b_time, lat, lon)
        _, l_s, _, _ = evaluate_domain(w_aspects, t_houses, "love")
        _, s_s, _, _ = evaluate_domain(w_aspects, t_houses, "study")
        _, m_s, _, _ = evaluate_domain(w_aspects, t_houses, "money")
        avg_w = int((l_s + s_s + m_s) / 3)
        
        day_str = target_d.strftime('%m.%d (%a)')
        if i == 0: day_str += " (오늘)"
        
        st.markdown(f"""
        <div class="theme-card" style="padding: 12px 16px; margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:#6B4962;">{day_str}</span>
                <span style="font-weight:800; color:#BF6C90;">{avg_w}%</span>
            </div>
            <div style="font-size:12px; color:#8C7386; margin-top:4px;">
                연애: {l_s}점 | 학업: {s_s}점 | 투자: {m_s}점
            </div>
        </div>
        """, unsafe_allow_html=True)

# --- TAB 3: 월간 리포트 ---
with tab_monthly:
    st.markdown(f"#### 🌕 {now_date.strftime('%Y년 %m월')} 천체 대전환 리포트")
    st.markdown("""
    <div class="theme-card">
        <div class="theme-title" style="margin-bottom:8px;">🌌 이달의 핵심 천체 이벤트 & 가이드</div>
        <div class="theme-desc">
            • <b>내면의 확장과 기회:</b> 목성의 순행각이 강화되며 학업과 시험, 직무 영역에서 유의미한 결실을 기대할 수 있습니다.<br>
            • <b>인연과 관계의 재정립:</b> 중순 이후 금성과 토성의 각도로 인해 일시적인 감정보다 책임감 있는 관계가 빛을 발합니다.<br>
            • <b>투자 및 재물 전략:</b> 충동 매수를 경계하고 월말 현금 흐름을 안정적으로 확보하는 것이 최선의 수익 실현 전략입니다.
        </div>
    </div>
    """, unsafe_allow_html=True)
