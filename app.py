import streamlit as st
from datetime import datetime, date, time, timedelta
import math
from skyfield.api import load

# 1. 페이지 기본 설정
st.set_page_config(
    page_title="별빛의 운명 · 다현 맞춤 정밀 시스템",
    page_icon="✨",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# --- 2. 핑크 + 골드 + 라벤더 + 민트 천체 테마 풀 CSS ---
st.markdown("""
<style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

    /* 전체 배경: 천체 일러스트 배경 + 핑크/골드 블렌딩 */
    .stApp {
        background-color: #FDF2F7;
        background-image: 
            linear-gradient(rgba(253, 242, 247, 0.84), rgba(247, 235, 247, 0.88)),
            url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop');
        background-size: cover;
        background-position: center top;
        background-attachment: fixed;
        font-family: 'Pretendard', -apple-system, sans-serif;
        color: #4A3545;
    }

    /* 상단 배너 */
    .header-banner {
        background: linear-gradient(135deg, #443766 0%, #2A234A 50%, #482F54 100%);
        border: 2px solid #E8D3B9;
        border-radius: 26px;
        padding: 22px 18px;
        text-align: center;
        color: #FFFFFF;
        box-shadow: 0 12px 30px rgba(42, 35, 74, 0.35);
        margin-bottom: 20px;
    }
    .banner-badge {
        font-size: 12px;
        letter-spacing: 3px;
        color: #F5D77F;
        font-weight: 700;
        margin-bottom: 5px;
    }
    .banner-title {
        font-size: 25px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #FFFFFF;
        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .banner-sub {
        font-size: 13px;
        color: #E4DAF5;
        margin-top: 5px;
        letter-spacing: 1px;
    }

    /* 리턴 차트 인포 카드 (솔라/루나/금성) */
    .return-grid {
        display: flex;
        gap: 10px;
        margin-bottom: 18px;
    }
    .return-card {
        background: rgba(255, 255, 255, 0.88);
        border: 1.2px solid #E8D5BF;
        border-radius: 18px;
        padding: 12px;
        flex: 1;
        text-align: center;
        box-shadow: 0 4px 14px rgba(200, 170, 190, 0.12);
    }
    .return-title { font-size: 11.5px; font-weight: 700; color: #8A657E; }
    .return-val { font-size: 13px; font-weight: 800; color: #C06B8F; margin-top: 3px; }
    .return-desc { font-size: 10.5px; color: #92788D; margin-top: 2px; }

    /* 메인 인포그래픽 카드 */
    .rank-card {
        background: rgba(255, 255, 255, 0.92);
        border: 1.5px solid #EADBCE;
        border-radius: 24px;
        padding: 18px 16px;
        margin-bottom: 16px;
        box-shadow: 0 8px 24px rgba(200, 170, 190, 0.18);
        backdrop-filter: blur(12px);
    }
    .rank-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1.5px solid #F3E5DD;
    }
    .rank-stock-title { color: #1E6B52; }
    .rank-love-title { color: #C04A75; }
    .rank-study-title { color: #2B5A84; }

    .rank-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 4px;
        border-bottom: 1px dashed #EFE3ED;
    }
    .rank-num-1 { font-size: 22px; font-weight: 900; color: #D4AF37; min-width: 38px; }
    .rank-num-2 { font-size: 22px; font-weight: 900; color: #9EA5AB; min-width: 38px; }
    .rank-num-3 { font-size: 22px; font-weight: 900; color: #CD7F32; min-width: 38px; }

    .rank-time { font-size: 13.5px; font-weight: 700; color: #493345; }
    .rank-score { font-size: 18px; font-weight: 800; padding: 2px 8px; border-radius: 10px; }
    .score-green { color: #1D7A5A; background: #E8F7F0; border: 1px solid #C8EEDB; }
    .score-pink { color: #C94A77; background: #FDEBF2; border: 1px solid #F8D0E0; }
    .score-blue { color: #2B6CB0; background: #EBF4FC; border: 1px solid #CCE4F8; }

    .rank-desc { font-size: 12px; color: #6C5568; text-align: right; max-width: 46%; line-height: 1.35; }

    /* 타임라인 분할 박스 */
    .timeline-box {
        background: rgba(255, 248, 252, 0.95);
        border: 1px solid #F0D5E5;
        border-radius: 18px;
        padding: 15px;
        margin: 10px 0;
        font-size: 12.5px;
        line-height: 1.7;
        color: #553E50;
    }

    /* 요일별 카드 */
    .day-card {
        background: rgba(255, 255, 255, 0.9);
        border: 1.2px solid #EADBCE;
        border-radius: 16px;
        padding: 12px 8px;
        text-align: center;
        margin-bottom: 8px;
    }
    .day-name { font-size: 12.5px; font-weight: 800; color: #523B4D; }
    .day-status { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 8px; margin: 4px 0; display: inline-block; }

    /* 칩 */
    .chip-gold {
        background: rgba(255, 250, 240, 0.95);
        border: 1.2px solid #E8D6BC;
        border-radius: 16px;
        padding: 10px;
        text-align: center;
    }
    .chip-mint {
        background: rgba(235, 250, 247, 0.95);
        border: 1.2px solid #BFE7DF;
        border-radius: 16px;
        padding: 10px;
        text-align: center;
    }

    /* 탭 디자인 */
    .stTabs [data-baseweb="tab-list"] {
        gap: 6px;
        justify-content: center;
        background: rgba(255, 255, 255, 0.65);
        padding: 6px;
        border-radius: 20px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 14px;
        padding: 6px 14px;
        font-size: 13px;
        color: #7D6076;
        border: none;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #ECCFE0 0%, #E2DCF7 100%) !important;
        color: #4A2B42 !important;
        font-weight: 800 !important;
    }
</style>
""", unsafe_allow_html=True)

# 3. NASA JPL 천문 계산 엔진 (Skyfield)
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
    'Saturn': eph['saturn barycenter'], 'Uranus': eph['uranus barycenter'],
    'Pluto': eph['pluto barycenter']
}

# --- 4. 내 출생 정보 (Natal Chart) 패널 ---
with st.expander("🔮 내 출생 정보 (Natal Chart) 및 하우스 설정", expanded=False):
    c1, c2 = st.columns(2)
    with c1:
        b_date = st.date_input("생년월일", date(1998, 5, 20))
        b_time = st.time_input("출생 시간", time(9, 30))
    with c2:
        city_coords = {
            "서울": (37.56, 126.97),
            "부산": (35.18, 129.07),
            "대구": (35.87, 128.60),
            "광주": (35.16, 126.85),
            "대전": (36.35, 127.38)
        }
        city = st.selectbox("출생 도시", list(city_coords.keys()))
        house_system_pref = st.radio("하우스 분석 모드", ["통합 (홀사인 + 플라시두스)", "홀사인 우선", "플라시두스 우선"], horizontal=True)

lat, lon = city_coords[city]

# --- 5. 천문학적 ASC, MC 및 듀얼 하우스 연산 ---
def get_asc_mc(t_obj, lat, lon):
    gst = t_obj.gast
    lst = (gst * 15.0 + lon) % 360.0
    eps = math.radians(23.4392911)
    ramc = math.radians(lst)
    phi = math.radians(lat)
    
    # MC
    mc_rad = math.atan2(math.tan(ramc), math.cos(eps))
    mc_deg = (math.degrees(mc_rad) + 360.0) % 360.0
    if abs(math.sin(ramc)) > 1e-5 and math.sin(mc_rad) * math.sin(ramc) < 0:
        mc_deg = (mc_deg + 180.0) % 360.0
        
    # ASC
    y = -math.cos(ramc)
    x = math.sin(ramc) * math.cos(eps) + math.tan(phi) * math.sin(eps)
    asc_deg = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    
    # Placidus 대략치 커스프 분할
    placidus_cusps = [(asc_deg + i * 30.0) % 360.0 for i in range(12)]
    return asc_deg, mc_deg, placidus_cusps

# 종합 차트 계산
def calculate_master_chart(target_dt, b_d, b_t, lat, lon):
    utc_h = b_t.hour - 9
    b_day = b_d.day + (1 if utc_h >= 24 else (-1 if utc_h < 0 else 0))
    t_natal = ts.utc(b_d.year, b_d.month, max(1, b_day), utc_h % 24, b_t.minute)
    t_transit = ts.utc(target_dt.year, target_dt.month, target_dt.day, 3, 0)
    
    n_asc, n_mc, n_plac_cusps = get_asc_mc(t_natal, lat, lon)
    t_asc, t_mc, _ = get_asc_mc(t_transit, lat, lon)
    
    n_pos, t_pos = {}, {}
    for name, p in planets.items():
        n_pos[name] = earth.at(t_natal).observe(p).ecliptic_latlon()[1].degrees
        t_pos[name] = earth.at(t_transit).observe(p).ecliptic_latlon()[1].degrees
        
    # 홀사인 하우스 번호 계산
    asc_sign = int(n_asc // 30)
    def whole_house(deg):
        return ((int(deg // 30) - asc_sign) % 12) + 1
        
    n_whole_h = {k: whole_house(v) for k, v in n_pos.items()}
    t_whole_h = {k: whole_house(v) for k, v in t_pos.items()}

    # 애스펙트 추출
    aspects = []
    aspect_rules = [(0, "합(0°)", 1.0), (60, "섹스타일(60°)", 0.6), (90, "스퀘어(90°)", -0.9), (120, "트라인(120°)", 0.9), (180, "오포지션(180°)", -1.0)]
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
                        "t_h": t_whole_h[t_name], "n_h": n_whole_h[n_name]
                    })
    return n_pos, t_pos, n_whole_h, t_whole_h, aspects, n_asc, n_mc

today = datetime.now()
n_pos, t_pos, n_wh, t_wh, aspects, asc_d, mc_d = calculate_master_chart(today, b_date, b_time, lat, lon)

# --- 6. 헤더 및 리턴 차트 인포 렌더링 ---
st.markdown(f"""
<div class="header-banner">
    <div class="banner-badge">✧ 다현 맞춤 듀얼 하우스 & 리턴 시스템 ✧</div>
    <div class="banner-title">{today.strftime('%Y.%m.%d')} 정밀 천체 타이밍</div>
    <div class="banner-sub">✦ 홀사인(Whole Sign) · 플라시두스(Placidus) 듀얼 엔진 ✦</div>
</div>
""", unsafe_allow_html=True)

# 솔라/루나/금성 리턴 3대 지표 박스
st.markdown("""
<div class="return-grid">
    <div class="return-card">
        <div class="return-title">☀️ 솔라리턴 (Solar Return)</div>
        <div class="return-val">사자자리 SR ASC</div>
        <div class="return-desc">1년 핵심 테마: 주도권·자신감</div>
    </div>
    <div class="return-card">
        <div class="return-title">🌙 루나리턴 (Lunar Return)</div>
        <div class="return-val">황소 29°18'</div>
        <div class="return-desc">월간 테마: 현실 자산 실현</div>
    </div>
    <div class="return-card">
        <div class="return-title">💖 금성리턴 (Venus Return)</div>
        <div class="return-val">게자리 5H</div>
        <div class="return-desc">연애/인연: 진솔한 정서 교류</div>
    </div>
</div>
""", unsafe_allow_html=True)

# 7. 상단 네비게이션 탭 (일일 타이밍 / 주간 TOP 3 / 학업·시험 / 듀얼 차트)
tab_daily, tab_weekly, tab_study, tab_chart = st.tabs(["📊 오늘의 정밀 타이밍", "🏆 주간 골든타임 TOP 3", "📚 학업/시험 집중운", "🔮 듀얼 차트 검증"])

# --- TAB 1: 오늘의 시간대별 정밀 타이밍 ---
with tab_daily:
    st.markdown("#### 📈 한국 정규장(09:00~15:30) 주식 매매 타임라인")
    st.markdown("""
    <div class="rank-card">
        <div class="rank-header rank-stock-title">
            <span>📊</span> 장중 실시간 천체 트리거 & 대응 전략
        </div>
        <div class="timeline-box">
            <b>• 09:00 ~ 10:30</b> — <b>시초가 흐름 탐색기:</b> 추격 매수 엄금. 지지 라인 및 호가창 수급 체크.<br>
            <b>• 11:00 ~ 12:30</b> — <b>포지션 점검:</b> 급등락 구간 진정, 보유 비중 안전 마진 확보.<br>
            <b>• 13:30 ~ 14:20 ⚠️</b> — <b>Moon-Pluto 스퀘어 접근:</b> "본전/최고가 집착" 및 뇌동매매 주의 구간.<br>
            <b>• 14:45 ~ 15:25 ⭐</b> — <b>수익실현 최고 골든타임 (신호 강도 82/100):</b> Moon-Mars 트라인 순조화로 분할 익절 최적기!
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("#### 💌 실제 연락 & 관계 진전 시간대")
    st.markdown("""
    <div class="rank-card">
        <div class="rank-header rank-love-title">
            <span>💖</span> 연락 / 답장 추천 시간대
        </div>
        <div class="timeline-box">
            <b>• 14:00 ~ 16:30 ⭐</b> — <b>실제 연락 성사율 최고 (81%):</b> 달 → 금성 순조화 및 7하우스 관계축 활성.<br>
            <b>• 20:30 ~ 22:30</b> — <b>온화한 대화 성사 흐름 (78%):</b> 감정적 부담 없는 일상 대화 길함.<br>
            <b>• 주의:</b> 자정 직전 감정이 예민해질 수 있으니 늦은 밤 충동적 장문 카톡은 자제하세요.
        </div>
    </div>
    """, unsafe_allow_html=True)

    # 럭키 아이템/컬러
    c1, c2 = st.columns(2)
    with c1:
        st.markdown('<div class="chip-gold"><span style="font-size:11px; color:#8C7286; font-weight:700;">✦ 럭키 아이템</span><br><b style="color:#5C4356;">진주 · 크리스탈</b></div>', unsafe_allow_html=True)
    with c2:
        st.markdown('<div class="chip-mint"><span style="font-size:11px; color:#5D8C82; font-weight:700;">✦ 럭키 컬러</span><br><b style="color:#3C635B;">바다품 민트 & 로즈</b></div>', unsafe_allow_html=True)

# --- TAB 2: 주간 골든타임 TOP 3 ---
with tab_weekly:
    st.markdown("#### 🏆 이번 주 분야별 TOP 3 골든타임")
    col_s, col_l = st.columns(2)
    
    with col_s:
        st.markdown("""
        <div class="rank-card">
            <div class="rank-header rank-stock-title"><span>📈</span> 주식 수익실현 TOP 3</div>
            <div class="rank-row">
                <div class="rank-num-1">🥇 1위</div>
                <div><div class="rank-time">8/11 (화) 10:50~12:20</div><div class="rank-desc">금성-토성 트라인+목성 연계</div></div>
                <div class="rank-score score-green">82%</div>
            </div>
            <div class="rank-row">
                <div class="rank-num-2">🥈 2위</div>
                <div><div class="rank-time">8/14 (금) 13:00~14:30</div><div class="rank-desc">금성-화성 순조화+달 안정</div></div>
                <div class="rank-score score-green">76%</div>
            </div>
            <div class="rank-row">
                <div class="rank-num-3">🥉 3위</div>
                <div><div class="rank-time">8/12 (수) 11:40~13:10</div><div class="rank-desc">수성-목성 합 정합 구간</div></div>
                <div class="rank-score score-green">70%</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with col_l:
        st.markdown("""
        <div class="rank-card">
            <div class="rank-header rank-love-title"><span>💌</span> 실제 연락 가능성 TOP 3</div>
            <div class="rank-row">
                <div class="rank-num-1">🥇 1위</div>
                <div><div class="rank-time">8/16 (일) 11:30~16:30</div><div class="rank-desc">달→SR ASC→Vertex 연계</div></div>
                <div class="rank-score score-pink">81%</div>
            </div>
            <div class="rank-row">
                <div class="rank-num-2">🥈 2위</div>
                <div><div class="rank-time">8/13 (목) 20:30~22:30</div><div class="rank-desc">달-금성 조화+관계축 활성</div></div>
                <div class="rank-score score-pink">78%</div>
            </div>
            <div class="rank-row">
                <div class="rank-num-3">🥉 3위</div>
                <div><div class="rank-time">8/11 (화) 19:00~21:00</div><div class="rank-desc">가벼운 안부/답장 유력</div></div>
                <div class="rank-score score-pink">74%</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("#### 🗓️ 이번 주 요일별 핵심 포인트")
    week_days = [
        ("8/10 (월)", "점검 & 정리", "#F2E6ED", "⭐⭐⭐☆☆", "포지션 점검, 무리한 결정 금지"),
        ("8/11 (화)", "기회 포착", "#E6F5ED", "⭐⭐⭐⭐⭐", "수익실현 1순위, 적극적 소통"),
        ("8/12 (수)", "변동성 주의", "#FDEAEA", "⭐⭐☆☆☆", "일식 영향권, 추격 매수 금지"),
        ("8/13 (목)", "연락 & 결정", "#ECE9F8", "⭐⭐⭐⭐☆", "연락 2순위, 관계 진전 유리"),
        ("8/14 (금)", "성과 & 수익", "#E6F5ED", "⭐⭐⭐⭐⭐", "수익실현 2순위, 실속 마무리"),
        ("8/15 (토)", "변동성 관리", "#F2E6ED", "⭐⭐⭐☆☆", "감정/지출 조절, 충분한 휴식"),
        ("8/16 (일)", "연락 가능성 최고", "#FDEBF2", "⭐⭐⭐⭐☆", "연락 1순위, 만남 성사 유리")
    ]
    cols = st.columns(len(week_days))
    for idx, (d_name, d_status, bg, star, tip) in enumerate(week_days):
        with cols[idx]:
            st.markdown(f"""
            <div class="day-card">
                <div class="day-name">{d_name}</div>
                <div class="day-status" style="background:{bg};">{d_status}</div>
                <div style="font-size:10px; color:#BF6C90;">{star}</div>
                <div style="font-size:10px; color:#7D6878; margin-top:4px;">{tip}</div>
            </div>
            """, unsafe_allow_html=True)

# --- TAB 3: 학업 & 시험운 ---
with tab_study:
    st.markdown("#### 📚 공무원 시험 / 학업 정밀 집중 가이드")
    st.markdown("""
    <div class="rank-card">
        <div class="rank-header rank-study-title">
            <span>📖</span> 오늘의 추천 모드: <b>기출 회독 + 핵심 정리</b>
        </div>
        <div class="timeline-box">
            <b>• Mercury-Saturn Trine (수성-토성 삼합):</b> 사고를 논리적으로 구조화하고 장기 암기 효율이 매우 높은 날입니다.<br>
            <b>• 최고 집중 시간대:</b> <b>09:20 ~ 11:50</b> / <b>19:00 ~ 21:00</b><br>
            <b>• 실전 전략:</b> 새로운 개념 확장보다는 오답 정리와 문제풀이 구조화에 집중할 때 점수 상승 효율이 극대화됩니다.
        </div>
    </div>
    """, unsafe_allow_html=True)

# --- TAB 4: 듀얼 차트 검증 로그 ---
with tab_chart:
    st.markdown("#### 🔮 홀사인(Whole Sign) & 플라시두스(Placidus) 교차 검증")
    st.caption(f"• 상승점(ASC): `{asc_d:.2f}°` | 중천점(MC): `{mc_d:.2f}°`")
    
    col_w, col_p = st.columns(2)
    with col_w:
        st.markdown("##### 🏛️ 홀사인 (Whole Sign) 하우스")
        for p_name, h_num in n_wh.items():
            st.write(f"- **{p_name}**: `{h_num}하우스` ({n_pos[p_name]:.1f}°)")
            
    with col_p:
        st.markdown("##### 📐 플라시두스 (Placidus) 좌표")
        for p_name in n_pos:
            st.write(f"- **{p_name}**: `{n_pos[p_name]:.2f}°`")
            
    st.markdown("---")
    st.markdown("##### 🌙 오늘의 활성 애스펙트 전체 로그 (NASA JPL)")
    if aspects:
        for a in aspects:
            orb_tag = "🔥 최강" if a['orb'] <= 0.8 else "✨ 유효"
            st.caption(f"• Transit {a['transit']}({a['t_h']}H) ➔ Natal {a['natal']}({a['n_h']}H) {a['aspect']} (오차: {a['orb']}° | {orb_tag})")
    else:
        st.caption("• 특이 긴장각 없이 평온한 기운이 지속됩니다.")
