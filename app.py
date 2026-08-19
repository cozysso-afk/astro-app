import streamlit as st
from datetime import datetime, date, time, timedelta
import math
from skyfield.api import load

# 1. 페이지 기본 설정
st.set_page_config(page_title="별빛의 운명", page_icon="✨", layout="centered", initial_sidebar_state="collapsed")

# --- 2. 커스텀 CSS (배경 일러스트 + 핑크/골드/라벤더/민트 팔레트 + 글래스모피즘) ---
st.markdown("""
<style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

    /* 전체 앱 배경: 천체 일러스트 + 파스텔 블렌딩 */
    .stApp {
        background-color: #FBF4F8;
        background-image: 
            radial-gradient(circle at 50% 15%, rgba(255, 235, 245, 0.85) 0%, rgba(247, 230, 243, 0.7) 40%, rgba(235, 245, 247, 0.9) 100%),
            url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop');
        background-size: cover;
        background-position: center top;
        background-attachment: fixed;
        font-family: 'Pretendard', -apple-system, sans-serif;
        color: #5A4354;
    }

    /* 상단 장식 헤더 */
    .header-box {
        text-align: center;
        padding: 20px 10px 10px 10px;
    }
    .header-title {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: 3px;
        background: linear-gradient(135deg, #B27B9B 0%, #D49D75 50%, #9F82B8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 4px;
    }
    .header-sub {
        font-size: 12px;
        color: #A3889B;
        letter-spacing: 1px;
        font-weight: 500;
    }

    /* 메인 운세 카드 (골드 프레임 + 글래스) */
    .main-fortune-card {
        background: rgba(255, 255, 255, 0.78);
        border: 1.5px solid #EADBCE;
        border-radius: 28px;
        padding: 24px 20px;
        margin: 12px 0 20px 0;
        box-shadow: 0 12px 36px rgba(195, 160, 185, 0.22);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        text-align: center;
    }
    
    .orbit-circle {
        display: inline-block;
        border: 1.5px dashed #D9BFD4;
        border-radius: 50%;
        padding: 18px 24px;
        margin: 10px 0;
        background: radial-gradient(circle, rgba(255,248,252,0.9) 0%, rgba(246,236,248,0.5) 100%);
    }

    .fortune-score {
        font-size: 50px;
        font-weight: 800;
        background: linear-gradient(135deg, #D4799E 0%, #C89065 50%, #9875B8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.1;
    }

    .fortune-grade {
        font-size: 15px;
        font-weight: 700;
        color: #7E5972;
        margin-top: 4px;
    }

    /* 세부 영역별 미니 카드 */
    .theme-card {
        background: rgba(255, 255, 255, 0.85);
        border: 1.2px solid #EEDFCE;
        border-radius: 20px;
        padding: 16px 18px;
        margin-bottom: 14px;
        box-shadow: 0 6px 18px rgba(215, 185, 205, 0.15);
    }
    .theme-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    .theme-title {
        font-size: 15px;
        font-weight: 700;
        color: #6C4B62;
    }
    .theme-score {
        font-size: 15px;
        font-weight: 800;
        color: #C06B8F;
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

    /* 트리거 로그 */
    .log-box {
        background: rgba(255, 255, 255, 0.65);
        border-radius: 16px;
        padding: 14px;
        border: 1px solid #EDE0EC;
        font-size: 12px;
        color: #7B6476;
    }
    
    /* 탭 스타일링 */
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

# 3. 헤더 UI
st.markdown("""
<div class="header-box">
    <div class="header-title">✧ 별빛의 운명 ✧</div>
    <div class="header-sub">너의 별이 속삭이는 오늘의 이야기</div>
</div>
""", unsafe_allow_html=True)

# --- 4. NASA JPL 천문 계산 엔진 ---
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

# --- 5. 내 차트 설정 (상단 접이식 패널) ---
with st.expander("🔮 내 출생 차트 (Natal Chart) 정보 설정 및 수정", expanded=False):
    col_a, col_b = st.columns(2)
    with col_a:
        b_date = st.date_input("생년월일", date(1998, 5, 20))
        b_time = st.time_input("출생 시간 (모르면 12:00)", time(9, 30))
    with col_b:
        city = st.selectbox("출생 도시", ["서울 (37.56°N, 126.97°E)", "부산 (35.18°N, 129.07°E)", "대구 (35.87°N, 128.60°E)", "광주 (35.16°N, 126.85°E)", "기타/해외 직접입력"])
        h_system = st.selectbox("하우스 시스템", ["홀사인 (Whole Sign)", "플라시두스 (Placidus)", "통합 엔진"])

# 천체 좌표 계산 함수
def calculate_chart(target_dt, b_d, b_t):
    utc_h = b_t.hour - 9
    b_day = b_d.day + (1 if utc_h >= 24 else (-1 if utc_h < 0 else 0))
    utc_h = utc_h % 24
    t_natal = ts.utc(b_d.year, b_d.month, max(1, b_day), utc_h, b_t.minute)
    t_transit = ts.utc(target_dt.year, target_dt.month, target_dt.day, 3, 0)
    
    n_pos, t_pos = {}, {}
    for name, p in planets.items():
        n_pos[name] = earth.at(t_natal).observe(p).ecliptic_latlon()[1].degrees
        t_pos[name] = earth.at(t_transit).observe(p).ecliptic_latlon()[1].degrees
        
    aspects = []
    aspect_rules = [
        (0, "합", 1.0), (60, "육합", 0.6), (90, "사각", -0.9), 
        (120, "삼합", 0.9), (180, "충", -1.0)
    ]
    for t_name, t_deg in t_pos.items():
        for n_name, n_deg in n_pos.items():
            diff = abs(t_deg - n_deg) % 360
            diff = min(diff, 360 - diff)
            for asp_deg, asp_name, weight in aspect_rules:
                orb = abs(diff - asp_deg)
                if orb <= 3.5:
                    aspects.append({
                        "transit": t_name, "natal": n_name,
                        "aspect": asp_name, "orb": round(orb, 2), "weight": weight
                    })
    return n_pos, t_pos, aspects

# 테마별 점수 및 해석 계산 함수
def evaluate_theme(aspects, theme_key):
    # 각 영역별 가중 천체 룰
    rules = {
        "love": {"planets": ["Venus", "Mars", "Moon", "Sun"], "base": 72},
        "reunion": {"planets": ["Venus", "Mercury", "Saturn", "Moon"], "base": 65},
        "study": {"planets": ["Mercury", "Jupiter", "Saturn", "Sun"], "base": 75},
        "money": {"planets": ["Jupiter", "Venus", "Saturn", "Mars"], "base": 70}
    }
    target = rules[theme_key]
    matched = [a for a in aspects if a["transit"] in target["planets"] or a["natal"] in target["planets"]]
    
    score = target["base"]
    for a in matched:
        score += a["weight"] * (4.0 - a["orb"]) * 4.5
    score = int(max(20, min(99, score)))
    return score, matched

# 6. 상단 네비게이션 탭 (일일 / 주간 / 월간 운세)
tab_daily, tab_weekly, tab_monthly = st.tabs(["✨ 오늘의 운세", "📅 주간 흐름", "🌕 월간 리포트"])

now_date = datetime.now().date()
n_pos, t_pos, daily_aspects = calculate_chart(now_date, b_date, b_time)

# --- TAB 1: 오늘의 운세 (연애/재회/학업/투자 상세) ---
with tab_daily:
    love_score, _ = evaluate_theme(daily_aspects, "love")
    reunion_score, _ = evaluate_theme(daily_aspects, "reunion")
    study_score, _ = evaluate_theme(daily_aspects, "study")
    money_score, _ = evaluate_theme(daily_aspects, "money")
    total_score = int((love_score + reunion_score + study_score + money_score) / 4)
    
    grade_desc = "하늘의 별빛이 강하게 축복하는 날 ✨" if total_score >= 80 else ("부드럽고 조화로운 순풍의 날 🌸" if total_score >= 60 else "신중하게 내실을 다져야 하는 날 🕊️")

    # 메인 점수 원형 카드
    st.markdown(f"""
    <div class="main-fortune-card">
        <div style="font-size: 13px; font-weight:600; color:#A28499;">✧ {now_date.strftime('%Y년 %m월 %d일')} 오늘의 종합 에너지 ✧</div>
        <div class="orbit-circle">
            <div class="fortune-score">{total_score}%</div>
        </div>
        <div class="fortune-grade">{grade_desc}</div>
        <div style="font-size: 13px; color:#785F73; margin-top: 10px; line-height: 1.6;">
            행성의 흐름이 당신의 직관과 잠재력을 부드럽게 이끌고 있습니다.<br>사소한 감정에 휘둘리지 말고 오늘의 우선순위에 집중해 보세요.
        </div>
    </div>
    """, unsafe_allow_html=True)

    # 4대 세부 영역별 맞춤 분석 카드
    st.markdown("#### 🌸 테마별 정밀 운세")
    
    # 1. 연애운
    love_msg = "금성과 달의 각도가 우호적입니다. 매력이 자연스럽게 발산되며 설레는 대화가 이어질 수 있습니다." if love_score >= 70 else "상대방의 사소한 말에 예민해질 수 있으니 한 템포 여유를 두고 반응하세요."
    st.markdown(f"""
    <div class="theme-card">
        <div class="theme-header">
            <span class="theme-title">💖 연애운 & 매력도</span>
            <span class="theme-score">{love_score}점</span>
        </div>
        <div class="theme-desc">{love_msg}</div>
    </div>
    """, unsafe_allow_html=True)

    # 2. 재회운
    re_msg = "과거의 인연이나 미해결된 감정의 실마리가 풀리는 타이밍입니다. 먼저 온화한 안부를 건네기 좋습니다." if reunion_score >= 70 else "아직은 감정의 파도가 가라앉지 않았습니다. 조급한 연락보다는 스스로의 중심을 지키세요."
    st.markdown(f"""
    <div class="theme-card">
        <div class="theme-header">
            <span class="theme-title">🕊️ 재회운 & 인연의 고리</span>
            <span class="theme-score">{reunion_score}점</span>
        </div>
        <div class="theme-desc">{re_msg}</div>
    </div>
    """, unsafe_allow_html=True)

    # 3. 학업 / 시험운
    study_msg = "수성과 목성의 흐름이 머리를 맑게 합니다. 암기력과 집중력이 상승해 시험이나 과제에 최고의 효율을 냅니다." if study_score >= 70 else "잡생각이나 피로도가 집중을 방해할 수 있습니다. 45분 집중 후 10분 휴식 루틴을 지키세요."
    st.markdown(f"""
    <div class="theme-card">
        <div class="theme-header">
            <span class="theme-title">📚 학업운 & 시험·합격운</span>
            <span class="theme-score">{study_score}점</span>
        </div>
        <div class="theme-desc">{study_msg}</div>
    </div>
    """, unsafe_allow_html=True)

    # 4. 주식 / 투자 실현운
    money_msg = "현금 흐름과 수익 실현에 길한 기운이 돕니다. 정해둔 익절 기준에 맞춰 차분하게 결실을 거두세요." if money_score >= 70 else "충동적인 뇌동매매나 고위험 투자는 금물입니다. 관망하며 시드를 보존하는 것이 최선입니다."
    st.markdown(f"""
    <div class="theme-card">
        <div class="theme-header">
            <span class="theme-title">💎 주식 투자 & 재물 실현운</span>
            <span class="theme-score">{money_score}점</span>
        </div>
        <div class="theme-desc">{money_msg}</div>
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
            <div class="chip-val">샴페인 민트 & 로즈</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    
    # 천체 활성 로그
    with st.expander("🌙 오늘의 활성 천체 트리거 (NASA JPL Data)", expanded=False):
        if daily_aspects:
            for a in daily_aspects[:5]:
                orb_str = "🔥 최강" if a['orb'] <= 0.8 else "✨ 유효"
                st.caption(f"• Transit {a['transit']} ➔ Natal {a['natal']} {a['aspect']} (오차: {a['orb']}° | {orb_str})")
        else:
            st.caption("• 특이 긴장각 없이 평온한 기운이 흐르는 날입니다.")

# --- TAB 2: 주간 흐름 (향후 7일간의 에너지 곡선) ---
with tab_weekly:
    st.markdown("#### 📅 향후 7일간의 운세 추이")
    for i in range(7):
        target_d = now_date + timedelta(days=i)
        _, _, w_aspects = calculate_chart(target_d, b_date, b_time)
        l_s, _ = evaluate_theme(w_aspects, "love")
        s_s, _ = evaluate_theme(w_aspects, "study")
        m_s, _ = evaluate_theme(w_aspects, "money")
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
        <div class="theme-title" style="margin-bottom:8px;">🌌 이달의 핵심 천체 이벤트</div>
        <div class="theme-desc">
            • <b>내면의 확장과 기회:</b> 목성의 순행각이 강화되며 학업과 재물 영역에서 새로운 전환점이 열립니다.<br>
            • <b>관계의 재정립:</b> 중순 이후 금성과 토성의 각도로 인해 진솔하고 책임감 있는 대화가 인연을 더욱 깊게 만듭니다.<br>
            • <b>투자 조언:</b> 월초의 과열 국면을 지나 월말 정산 타이밍에 유의미한 수익 실현이 가능합니다.
        </div>
    </div>
    """, unsafe_allow_html=True)
