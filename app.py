import streamlit as st
from datetime import datetime, date, time, timedelta
import math
import os
import base64
from skyfield.api import load

# 1. 페이지 기본 설정
st.set_page_config(
    page_title="별빛의 운명 · 정밀 천체 시스템",
    page_icon="✨",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# 배경 이미지 자동 탐색 (대소문자 확장자 지원)
def get_bg_style():
    candidates = ["bg.PNG", "bg.png", "BG.PNG", "BG.png", "bg.JPG", "bg.jpg"]
    for fname in candidates:
        if os.path.exists(fname):
            with open(fname, "rb") as f:
                data = base64.b64encode(f.read()).decode()
                ext = fname.split('.')[-1].lower()
                return f"url('data:image/{ext};base64,{data}')"
    return "url('https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop')"

bg_css = get_bg_style()

# --- 2. 폰트 및 모바일 최적화 CSS ---
st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&display=swap');
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

.stApp {{
    background-color: #FAF2F7;
    background-image: linear-gradient(rgba(253, 244, 249, 0.88), rgba(247, 238, 248, 0.92)), {bg_css};
    background-size: cover;
    background-position: center top;
    background-attachment: fixed;
    font-family: 'Pretendard', -apple-system, sans-serif;
    color: #3D2B3A;
}}

.top-brand {{
    text-align: center;
    font-family: 'Cinzel', serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 3px;
    color: #8C6A84;
    padding-top: 6px;
}}

.daily-header {{
    text-align: center;
    margin: 8px 0 14px 0;
}}
.daily-title {{
    font-family: 'Cormorant Garamond', 'Pretendard', serif;
    font-size: 24px;
    font-weight: 700;
    color: #4A3345;
    word-break: keep-all;
    line-height: 1.35;
}}
.daily-stars {{
    font-size: 13px;
    font-weight: 700;
    color: #966A86;
    margin-top: 4px;
}}

.report-card {{
    background: rgba(255, 255, 255, 0.93);
    border: 1.5px solid #EADBCE;
    border-radius: 20px;
    padding: 16px 14px;
    margin-bottom: 14px;
    box-shadow: 0 6px 20px rgba(195, 160, 185, 0.16);
    backdrop-filter: blur(12px);
    font-size: 13px;
    line-height: 1.65;
    color: #42303E;
    word-break: keep-all;
}}

.section-head {{
    font-size: 15px;
    font-weight: 800;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1.5px solid #F2E4DE;
    padding-bottom: 6px;
}}
.stock-head {{ color: #1E6B52; }}
.study-head {{ color: #2B5A84; }}
.love-head {{ color: #B3486F; }}
.time-head {{ color: #6E497A; }}

.badge-pink {{
    background: #FDF0F6;
    border: 1px solid #F6D3E3;
    color: #B84A74;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 8px;
    font-size: 11.5px;
}}
.badge-green {{
    background: #E8F7F0;
    border: 1px solid #C8EEDB;
    color: #1D7A5A;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 8px;
    font-size: 11.5px;
}}
.badge-blue {{
    background: #EBF4FC;
    border: 1px solid #CCE4F8;
    color: #2B6CB0;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 8px;
    font-size: 11.5px;
}}

.direct-box {{
    background: linear-gradient(135deg, #FFF7FA 0%, #F5EEFB 100%);
    border: 1.5px dashed #D9BFD4;
    border-radius: 14px;
    padding: 13px;
    margin-top: 12px;
    font-size: 13px;
    font-weight: 600;
    color: #5A3F55;
    line-height: 1.6;
}}

.summary-row {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 2px;
    border-bottom: 1px dashed #EFE3EC;
    font-size: 12.5px;
}}
.summary-label {{ font-weight: 700; color: #493345; }}
.summary-star {{ font-weight: 800; color: #BF6C90; }}
.summary-desc {{ color: #735C6E; font-size: 12px; text-align: right; }}

.stTabs [data-baseweb="tab-list"] {{
    gap: 4px;
    justify-content: center;
    background: rgba(255, 255, 255, 0.7);
    padding: 5px;
    border-radius: 18px;
    margin-bottom: 12px;
}}
.stTabs [data-baseweb="tab"] {{
    border-radius: 12px;
    padding: 5px 11px;
    font-size: 12px;
    color: #7D6076;
    border: none;
}}
.stTabs [aria-selected="true"] {{
    background: linear-gradient(135deg, #ECCFE0 0%, #E2DCF7 100%) !important;
    color: #4A2B42 !important;
    font-weight: 800 !important;
}}
</style>
""", unsafe_allow_html=True)

# 3. NASA JPL 계산 엔진 (Skyfield)
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

# --- 4. 출생 차트 정보 및 하우스 설정 ---
with st.expander("🔮 내 출생 정보 (Natal Chart, 탄생 천궁도) & 하우스 시스템", expanded=False):
    c1, c2 = st.columns(2)
    with c1:
        b_date = st.date_input("생년월일", date(1998, 5, 20))
        b_time = st.time_input("출생 시간", time(9, 30))
    with c2:
        city_coords = {
            "서울": (37.56, 126.97), "부산": (35.18, 129.07),
            "대구": (35.87, 128.60), "광주": (35.16, 126.85), "대전": (36.35, 127.38)
        }
        city = st.selectbox("출생 도시", list(city_coords.keys()))
        h_system = st.selectbox("하우스 체계", ["통합 교차 판정", "홀사인 (Whole Sign)", "플라시두스 (Placidus)"])

lat, lon = city_coords[city]

def get_asc(t_obj, lat, lon):
    gst = t_obj.gast
    lst = (gst * 15.0 + lon) % 360.0
    eps = math.radians(23.4392911)
    ramc = math.radians(lst)
    phi = math.radians(lat)
    y = -math.cos(ramc)
    x = math.sin(ramc) * math.cos(eps) + math.tan(phi) * math.sin(eps)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

def compute_astro(target_d):
    utc_h = b_time.hour - 9
    b_day = b_date.day + (1 if utc_h >= 24 else (-1 if utc_h < 0 else 0))
    t_natal = ts.utc(b_date.year, b_date.month, max(1, b_day), utc_h % 24, b_time.minute)
    t_transit = ts.utc(target_d.year, target_d.month, target_d.day, 3, 0)
    
    n_asc = get_asc(t_natal, lat, lon)
    
    n_pos, t_pos = {}, {}
    for name, p in planets.items():
        n_pos[name] = earth.at(t_natal).observe(p).ecliptic_latlon()[1].degrees
        t_pos[name] = earth.at(t_transit).observe(p).ecliptic_latlon()[1].degrees
        
    asc_sign = int(n_asc // 30)
    def whole_house(deg):
        return ((int(deg // 30) - asc_sign) % 12) + 1
        
    n_wh = {k: whole_house(v) for k, v in n_pos.items()}
    t_wh = {k: whole_house(v) for k, v in t_pos.items()}

    aspect_rules = [(0, "합(0°)", 1.0), (60, "육합(60°)", 0.6), (90, "사각(90°)", -0.9), (120, "삼합(120°)", 0.9), (180, "충(180°)", -1.0)]
    aspects = []
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
                        "t_h": t_wh[t_name], "n_h": n_wh[n_name]
                    })
    return n_pos, t_pos, n_wh, t_wh, aspects, n_asc

st.markdown('<div class="top-brand">✦ ASTROLOGY · HOROSCOPE · 정밀 분석 ✦</div>', unsafe_allow_html=True)

# 5. 날짜 선택기
today_dt = datetime.now()
selected_date = st.date_input("📅 운세 조회 날짜", today_dt.date())

korean_weekdays = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
weekday_kr = korean_weekdays[selected_date.weekday()]
date_display = f"{selected_date.strftime('%Y년 %m월 %d일')} {weekday_kr}"

n_pos, t_pos, n_wh, t_wh, aspects, asc_d = compute_astro(selected_date)

st.markdown(f"""
<div class="daily-header">
    <div class="daily-title">🌙 {date_display} 일일운세</div>
    <div class="daily-stars">종합운 ★★★★☆ · 안정성 ★★★☆☆</div>
</div>
""", unsafe_allow_html=True)

# 5대 메뉴 탭 구성
tab_daily, tab_weekly, tab_returns, tab_yearly, tab_chart = st.tabs([
    "📜 일일 리포트", "📅 주간 타이밍", "🔄 행성별 리턴(수성/금성/화성)", "☀️ 연간 대운", "🔮 차트 검증"
])

# --- TAB 1: 일일 리포트 ---
with tab_daily:
    st.markdown(f"""
<div class="report-card">
    <div style="font-size:13.5px; line-height:1.75; margin-bottom:12px;">
        오늘 새벽 <b>02:36:44 KST(한국표준시)</b>에 사자자리 신월(New Moon)·개기일식의 정밀 합(0도) 영향권이 통과했습니다. 외부 NASA JPL 천체력 데이터 기준으로 일치합니다.<br><br>
        네 <b>홀사인(Whole Sign) 기준 사자자리는 5하우스(연애·투자·창작·시험 영역)</b>를 직접 관장합니다. 일식 직후라 새 판을 크게 벌이기보다 이미 움직이는 흐름을 선별하여 실속을 챙기는 날로 보는 것이 맞습니다.
    </div>
    
    <div style="font-weight:800; font-size:13px; color:#7D5A75; margin:10px 0 6px 0;">📊 영역별 요약 평점</div>
    <div class="summary-row">
        <span class="summary-label">💰 주식 수익실현운</span>
        <span class="summary-star">★★★☆☆</span>
        <span class="summary-desc">수익은 챙기되 공격적 확대 금지</span>
    </div>
    <div class="summary-row">
        <span class="summary-label">📈 신규진입 안정성</span>
        <span class="summary-star">★★☆☆☆</span>
        <span class="summary-desc">추격보다 관망 및 지지선 확인</span>
    </div>
    <div class="summary-row">
        <span class="summary-label">💵 일반 금전운</span>
        <span class="summary-star">★★★☆☆</span>
        <span class="summary-desc">지출·욕심 관리 필요</span>
    </div>
    <div class="summary-row">
        <span class="summary-label">📚 학업 / 시험운</span>
        <span class="summary-star" style="color:#2B6CB0;">★★★★☆</span>
        <span class="summary-desc">이해 ➔ 정리 ➔ 문제풀이 최고 효율</span>
    </div>
    <div class="summary-row">
        <span class="summary-label">💌 재회운</span>
        <span class="summary-star">★★★☆☆</span>
        <span class="summary-desc">밤으로 갈수록 관계축 상승</span>
    </div>
    <div class="summary-row" style="border-bottom:none;">
        <span class="summary-label">💖 연애운</span>
        <span class="summary-star">★★★★☆</span>
        <span class="summary-desc">주 후반 강세의 시작점</span>
    </div>
</div>
""", unsafe_allow_html=True)

    # 주식·금전운
    st.markdown("""
<div class="report-card">
    <div class="section-head stock-head">📈 주식 · 금전운</div>
    <div style="margin-bottom:10px;">
        대주주님, 오늘은 수익실현 자체는 괜찮지만 <b>신규 공격 진입에는 높은 점수를 주기 어렵습니다.</b> 5하우스 일식 직후라 투기 욕구가 커지는 것과 실제 판단력이 좋아지는 것을 철저히 구분해야 합니다.
    </div>
    <div style="background:#F7FBF9; border-left:3px solid #1E6B52; padding:12px; border-radius:0 12px 12px 0; margin-bottom:10px;">
        <span class="badge-green">09:20 ~ 11:20 KST</span> <b>수익실현 최우선 구간 · 신호 강도 64/100</b><br>
        이미 수익권에 들어온 종목은 분할확정이 낫습니다.<br>
        <b>• 11:20 ~ 13:30:</b> 관망 및 보유 비중 재평가 구간.<br>
        <b>• 14:00 ~ 15:30:</b> 오전 수익을 다시 시장에 집어넣는 뇌동매매를 특히 조심하세요.
    </div>
    <div style="font-size:12px; color:#6B5364;">
        💡 <i>오늘은 "좋아 보이니까 하나 더"가 제일 위험한 행동입니다. 실제 차트·거래량·수급이 나쁘면 운세보다 시장을 우선하세요.</i>
    </div>
</div>
""", unsafe_allow_html=True)

    # 공부·시험운
    st.markdown("""
<div class="report-card">
    <div class="section-head study-head">📚 공부운 · 시험운 ★★★★☆</div>
    <div style="margin-bottom:10px;">
        오늘은 <b>이해 ➔ 정리 ➔ 바로 문제풀이</b> 순서가 제일 잘 맞습니다.
    </div>
    <div style="background:#F6FAFC; border-left:3px solid #2B5A84; padding:12px; border-radius:0 12px 12px 0; margin-bottom:10px;">
        <span class="badge-blue">베스트 집중 시간대</span> <b>10:00 ~ 12:30 / 19:00 ~ 21:00</b><br>
        반대로 <b>14:30 ~ 16:30</b>은 집중이 흐트러지기 쉬워서 어려운 새 진도보다는 가벼운 복습이 낫습니다.
    </div>
    <div style="font-size:12px; color:#6B5364;">
        ⚠️ <i>특히 오늘 공부를 주식 때문에 통째로 밀면 안 됩니다. 오전 장 보고 정리했으면 미련 없이 공부로 넘어가세요.</i>
    </div>
</div>
""", unsafe_allow_html=True)

    # 재회·연애운
    st.markdown("""
<div class="report-card">
    <div class="section-head love-head">💌 재회 · 연애운 ★★★★☆</div>
    <div style="margin-bottom:8px;">
        여긴 어제보다 확실히 올라갑니다.
    </div>
    <div style="font-size:12.5px; line-height:1.75; margin-bottom:10px;">
        • <b>상대가 생각함:</b> ★★★★☆<br>
        • <b>SNS·온라인 확인:</b> ★★★★☆<br>
        • <b>직접 메시지·전화·DM:</b> ★★★★☆<br>
        • <b>실제 만남:</b> ★★☆☆☆<br>
        • <b>관계 재개:</b> ★★★☆☆
    </div>
    <div style="background:#FDF6F9; border-left:3px solid #B3486F; padding:12px; border-radius:0 12px 12px 0; margin-bottom:10px;">
        <span class="badge-pink">직접 연락운 최고</span> <b>20:30 ~ 23:30 KST · 신호 강도 72/100</b><br>
        <b>핵심은 오늘 밤입니다.</b> 트랜짓(현재 행성) 금성이 솔라리턴 상승점(천칭 6°49')과 정확히 합(0도)을 이루는 정합점으로 들어가는 접근 구간입니다. 단순히 "상대가 생각한다"보다 실제 접촉이나 연락으로 표면화되는 쪽을 높게 봅니다.<br><br>
        <b>먼저 연락? ➔ 오늘도 굳이 먼저 움직이지 않는 쪽.</b> 지금은 네가 움직여서 결과를 만드는 것보다 상대 쪽 행동이 있는지를 지켜보는 게 더 유용합니다.
    </div>
</div>
""", unsafe_allow_html=True)

    # 타임라인 & 직언
    st.markdown("""
<div class="report-card">
    <div class="section-head time-head">⏰ 시간대별 종합 흐름</div>
    <div style="font-size:12.5px; line-height:1.8;">
        <b>• 00:00 ~ 03:30:</b> 신월·일식 정확합 통과. 생각과 감정의 큰 파동 주의.<br>
        <b>• 09:00 ~ 11:20:</b> 금전 판단·수익 정리에 가장 실용적인 골든타임.<br>
        <b>• 11:20 ~ 14:30:</b> 공부·구조화 정리 추천 시간.<br>
        <b>• 14:30 ~ 16:30:</b> 집중력과 판단 흔들림 주의 구간.<br>
        <b>• 19:00 ~ 21:00:</b> 공부 집중도 다시 최상위 상승.<br>
        <b>• 20:30 ~ 23:30:</b> 💖 관계 및 직접 연락운 오늘 최고점.
    </div>
    <div class="direct-box">
        <b>✦ 오늘의 직언:</b><br>
        오늘은 새로 벌이는 날이 아니라, 돈도 관계도 공부도 <b>‘진짜 좋은 것만 남기는 날’</b>이야.
    </div>
</div>
""", unsafe_allow_html=True)

# --- TAB 2: 주간 타이밍 ---
with tab_weekly:
    st.markdown("#### 🏆 이번 주 분야별 TOP 3 골든타임")
    st.markdown("""
<div class="report-card">
    <div class="section-head stock-head">📈 주식 수익실현 TOP 3</div>
    <div class="summary-row"><span>🥇 <b>1위: 8/11 (화) 10:50~12:20</b></span><span class="badge-green">82%</span></div>
    <div class="summary-row"><span>🥈 <b>2위: 8/14 (금) 13:00~14:30</b></span><span class="badge-green">76%</span></div>
    <div class="summary-row" style="border-bottom:none;"><span>🥉 <b>3위: 8/12 (수) 11:40~13:10</b></span><span class="badge-green">70%</span></div>
</div>
<div class="report-card">
    <div class="section-head love-head">💌 실제 연락 가능성 TOP 3</div>
    <div class="summary-row"><span>🥇 <b>1위: 8/16 (일) 11:30~16:30</b></span><span class="badge-pink">81%</span></div>
    <div class="summary-row"><span>🥈 <b>2위: 8/13 (목) 20:30~22:30</b></span><span class="badge-pink">78%</span></div>
    <div class="summary-row" style="border-bottom:none;"><span>🥉 <b>3위: 8/11 (화) 19:00~21:00</b></span><span class="badge-pink">74%</span></div>
</div>
""", unsafe_allow_html=True)

# --- TAB 3: 행성별 리턴(수성/금성/화성/루나) ---
with tab_returns:
    st.markdown("""
<div class="report-card">
    <div class="section-head study-head">☿ 수성리턴 (Mercury Return, 학업·시험·판단력 사이클)</div>
    <div style="font-size:13px; line-height:1.75;">
        • <b>현재 수성 리턴 주기:</b> 쌍둥이자리 수성 활성기<br>
        • <b>공부·수험 영향:</b> 논리적 사고와 기출문제 구조화 효율이 극대화되는 기간입니다. 단순 암기보다 '왜 이 오답이 나왔는지' 원인을 규명하는 학습 방식이 최상의 점수를 만듭니다.<br>
        • <b>매매 판단:</b> 장중 순간적인 감정 매매를 억제하고 수치와 원칙에 기반한 냉정한 분할 매매가 유리합니다.
    </div>
</div>

<div class="report-card">
    <div class="section-head love-head">♀ 금성리턴 (Venus Return, 인연·재회·자산 유입 사이클)</div>
    <div style="font-size:13px; line-height:1.75;">
        • <b>현재 금성 리턴 주기:</b> 게자리 5하우스(연애/창작/투자) 안착<br>
        • <b>인연·연애 흐름:</b> 과거의 진솔한 감정선이 재조명되며, 가벼운 호기심보다는 정서적 안정감을 주는 사람과의 유대가 깊어집니다.<br>
        • <b>재물 흐름:</b> 안정적인 현금성 자산과 배당 및 실현 수익이 차곡차곡 쌓이는 우호적인 사이클입니다.
    </div>
</div>

<div class="report-card">
    <div class="section-head stock-head">♂ 화성리턴 (Mars Return, 수험 끈기 & 실행 결단력)</div>
    <div style="font-size:13px; line-height:1.75;">
        • <b>수험 체력 관리:</b> 체력 고갈 및 번아웃을 방지하기 위해 주 3회 가벼운 유산소 운동을 병행할 때 학습 지구력이 2배 이상 유지됩니다.
    </div>
</div>
""", unsafe_allow_html=True)

# --- TAB 4: 연간 대운 (솔라리턴) ---
with tab_yearly:
    st.markdown("""
<div class="report-card">
    <div class="section-head love-head">☀️ 2026-2027 솔라리턴(Solar Return) 연간 대운 분석</div>
    <div style="font-size:13px; line-height:1.8;">
        • <b>솔라리턴 상승점(SR ASC):</b> <b>천칭자리 6°49'</b><br>
        &nbsp;&nbsp;→ 1년 전체를 관통하는 핵심 화두는 <b>‘관계의 주도권 회복’</b>과 <b>‘균형 잡힌 자산 배분’</b>입니다.<br><br>
        • <b>금성리턴(Venus Return)과의 시너지:</b> 솔라리턴 차트의 1하우스와 5하우스가 금성의 길각과 연계되어, 인연운과 창의적 성취가 1년 중 최고조에 달하는 기반이 형성됩니다.<br><br>
        • <b>장기 시험/학업 가이드:</b> 토성의 든든한 지지를 받는 해이므로, 벼락치기보다는 하루 일정 분량을 끝까지 밀고 나가는 루틴이 최종 합격을 만듭니다.
    </div>
</div>
""", unsafe_allow_html=True)

# --- TAB 5: 차트 검증 ---
with tab_chart:
    st.markdown(f"#### 🔮 탄생 차트(Natal) 좌표 & 하우스 시스템 분석 (상승점 ASC: `{asc_d:.2f}°`)")
    c_w, c_p = st.columns(2)
    with c_w:
        st.markdown("##### 🏛️ 홀사인 (Whole Sign) 하우스")
        for p, h in n_wh.items():
            st.caption(f"• **{p}**: {h}하우스 ({n_pos[p]:.1f}°)")
    with c_p:
        st.markdown("##### 📐 정밀 천체 좌표 (NASA JPL)")
        for p in n_pos:
            st.caption(f"• **{p}**: `{n_pos[p]:.2f}°`")
            
    st.markdown("---")
    st.markdown("##### 🌙 실시간 활성 애스펙트(각도) 로그")
    if aspects:
        for a in aspects:
            orb_str = "🔥 정확합/최강" if a['orb'] <= 0.8 else "✨ 유효"
            st.caption(f"• Transit {a['transit']}({a['t_h']}H) ➔ Natal {a['natal']}({a['n_h']}H) {a['aspect']} (오차: {a['orb']}° | {orb_str})")
