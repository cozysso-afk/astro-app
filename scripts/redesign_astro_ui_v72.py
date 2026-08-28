from pathlib import Path

APP = Path("app.py")
FORTUNE = Path("fortune_lab_v71.py")
app = APP.read_text(encoding="utf-8")
fortune = FORTUNE.read_text(encoding="utf-8")
changed = False

# 1) Warm ivory / champagne visual system for 별빛의 운명.
if "ASTRO_DESIGN_V72_CSS" not in app:
    marker = 'st.markdown(CUSTOM_CSS, unsafe_allow_html=True)\n'
    if marker not in app:
        raise SystemExit("CUSTOM_CSS render marker not found")
    css = r'''

# ============================================================
# 0-A2. VISUAL SYSTEM v7.2 · WARM CELESTIAL OBSERVATORY
# ============================================================
ASTRO_DESIGN_V72_CSS = """
<style>
:root{
  --astro-bg:#f7f2e9;
  --astro-paper:rgba(255,252,247,.90);
  --astro-paper-strong:#fffdf9;
  --astro-ink:#332d2a;
  --astro-muted:#7b6e67;
  --astro-gold:#b48853;
  --astro-rose:#b9827a;
  --astro-sage:#829184;
  --astro-line:rgba(126,103,87,.18);
  --astro-shadow:0 14px 38px rgba(83,61,45,.09);
}
html,body,[class*="css"]{color:var(--astro-ink)!important}
.stApp{
  background:
    radial-gradient(circle at 92% 2%,rgba(213,178,137,.26),transparent 28%),
    radial-gradient(circle at 4% 30%,rgba(190,146,135,.13),transparent 30%),
    linear-gradient(180deg,#fbf8f2 0%,#f4ece2 55%,#f8f5ef 100%)!important;
  color:var(--astro-ink)!important;
}
.block-container{max-width:760px!important;padding-top:.8rem!important}
h1,h2,h3,h4{color:#342c28!important;letter-spacing:-.025em}
p,[data-testid="stCaptionContainer"],.stCaption{color:var(--astro-muted)!important}

/* Brand hero */
.astro-hero{padding:18px 4px 7px;margin-bottom:8px}
.astro-hero-kicker{font-size:.67rem;letter-spacing:.22em;font-weight:800;color:#9a806c;margin-bottom:8px}
.astro-hero-row{display:flex;align-items:center;gap:12px}
.astro-hero-sigil{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#fffaf1,#e5caa8);border:1px solid rgba(180,136,83,.28);box-shadow:0 8px 22px rgba(120,89,58,.12);font-size:1.55rem;color:#a77b48}
.astro-hero-title{font-size:2rem;line-height:1.05;font-weight:900;color:#342c28;letter-spacing:-.055em}
.astro-hero-sub{font-size:.73rem;color:#8c7a70;margin-top:6px;letter-spacing:.04em}

/* Cards / profile */
.profile-strip,.ast-card,.ai-overview,.period-range,.astro-note,
[data-testid="stExpander"],div[data-testid="stVerticalBlockBorderWrapper"]{
  background:var(--astro-paper)!important;
  border-color:var(--astro-line)!important;
  box-shadow:var(--astro-shadow)!important;
}
.profile-strip{border-radius:20px!important;padding:14px 15px!important;color:#534841!important}
[data-testid="stExpander"]{border-radius:18px!important;overflow:hidden}

/* Menu radios -> horizontal pill navigation */
div[role="radiogroup"]{display:flex!important;flex-wrap:nowrap!important;gap:7px!important;overflow-x:auto!important;padding:3px 1px 8px!important;scrollbar-width:none!important}
div[role="radiogroup"]::-webkit-scrollbar{display:none}
div[role="radiogroup"] label{
  flex:0 0 auto!important;
  min-height:38px!important;
  border:1px solid var(--astro-line)!important;
  border-radius:999px!important;
  background:rgba(255,252,247,.72)!important;
  padding:7px 12px!important;
  box-shadow:0 5px 14px rgba(84,63,48,.04)!important;
}
div[role="radiogroup"] label:has(input:checked){
  background:linear-gradient(135deg,#4d4039,#725b4c)!important;
  border-color:#5e4b40!important;
  color:#fff!important;
  box-shadow:0 8px 20px rgba(73,52,41,.18)!important;
}
div[role="radiogroup"] label:has(input:checked) p{color:#fff!important}
div[role="radiogroup"] label [data-testid="stMarkdownContainer"] p{font-size:.83rem!important;font-weight:760!important;white-space:nowrap!important}

/* Inputs */
[data-baseweb="select"]>div,
[data-testid="stDateInput"] input,
[data-testid="stTimeInput"] input,
[data-testid="stTextInput"] input,
[data-testid="stNumberInput"] input,
[data-testid="stTextArea"] textarea{
  background:#fffdf9!important;
  border-color:rgba(128,104,87,.20)!important;
  border-radius:14px!important;
  color:#3e3530!important;
  min-height:46px!important;
}
label,[data-testid="stWidgetLabel"] p{color:#4b4039!important;font-weight:720!important}

/* Buttons */
.stButton>button[kind="primary"],.stDownloadButton>button[kind="primary"]{
  background:linear-gradient(135deg,#a67947,#c49a68)!important;
  color:white!important;border:0!important;border-radius:15px!important;
  min-height:48px!important;box-shadow:0 10px 24px rgba(159,116,69,.20)!important;
}
.stButton>button:not([kind="primary"]),.stDownloadButton>button{
  border-radius:14px!important;border-color:var(--astro-line)!important;background:#fffdf9!important;color:#51443d!important;
}

/* Tables / metrics */
[data-testid="stMetric"]{background:rgba(255,253,249,.86);border:1px solid var(--astro-line);border-radius:16px;padding:11px 12px}
[data-testid="stDataFrame"]{border-radius:16px;overflow:hidden;border:1px solid var(--astro-line)}

.fortune-kicker{font-size:.68rem;letter-spacing:.18em;font-weight:850;color:#a17b54;margin:2px 0 4px}
.fortune-title{font-size:1.55rem;font-weight:900;letter-spacing:-.045em;color:#342c28;margin-bottom:4px}
.fortune-lead{font-size:.88rem;line-height:1.65;color:#7a6b63;margin-bottom:14px}
.fortune-section-label{font-size:.78rem;font-weight:850;color:#765f50;letter-spacing:.02em;margin:6px 0 2px}

@media(max-width:640px){
  .block-container{padding-left:1rem!important;padding-right:1rem!important;padding-bottom:calc(8rem + env(safe-area-inset-bottom))!important}
  .astro-hero-title{font-size:1.95rem}
  .astro-hero-sigil{width:42px;height:42px}
  div[role="radiogroup"] label{padding:7px 11px!important}
}
</style>
"""
st.markdown(ASTRO_DESIGN_V72_CSS, unsafe_allow_html=True)
'''
    app = app.replace(marker, marker + css, 1)
    changed = True

# 2) Replace the large emoji title with a compact brand hero.
old_header = '''st.markdown('<div class="top-nav">✦ ASTROLOGY · HOROSCOPE · PRIVATE ✦</div>',unsafe_allow_html=True)\nst.title("🌙 별빛의 운명")\nst.caption(f"{EPHEMERIS_USED} · Tropical · Whole Sign 주 기준 · Placidus 보조")'''
new_header = '''st.markdown("""\n<div class="astro-hero">\n  <div class="astro-hero-kicker">CELESTIAL TIMING LAB</div>\n  <div class="astro-hero-row">\n    <div class="astro-hero-sigil">☾</div>\n    <div>\n      <div class="astro-hero-title">별빛의 운명</div>\n      <div class="astro-hero-sub">시간의 흐름과 삶의 패턴을 읽는 개인 관측실</div>\n    </div>\n  </div>\n</div>\n""",unsafe_allow_html=True)\nst.caption(f"{EPHEMERIS_USED} · Tropical · Whole Sign 주 기준 · Placidus 보조")'''
if old_header in app:
    app = app.replace(old_header, new_header, 1)
    changed = True

# 3) Two-stage Korean birthplace selector in the profile.
old_profile = '''with st.expander("👤 출생정보 수정", expanded=False):\n    user_name=st.text_input("성함 또는 호칭",value=PROFILE_NAME_DEFAULT,key="profile_name")\n    birth_gender=st.selectbox("성별 · 사주 대운 계산용",["여성","남성"],index=0,key="profile_birth_gender")\n    birth_date=st.date_input("출생일",PROFILE_BIRTH_DATE_DEFAULT,key="profile_birth_date")\n    birth_time=st.time_input("출생 시간",PROFILE_BIRTH_TIME_DEFAULT,step=60,key="profile_birth_time")\n    places=list(KOREA_BIRTHPLACES)+["직접 좌표 입력(고급)"]\n    birth_place=st.selectbox("출생 지역",places,index=places.index(PROFILE_BIRTH_PLACE_DEFAULT),key="profile_birth_place")\n    if birth_place=="직접 좌표 입력(고급)":\n        lat=st.number_input("출생지 위도(N)",value=34.7604,format="%.6f",key="_direct_lat"); lon=st.number_input("출생지 경도(E)",value=127.6622,format="%.6f",key="_direct_lon"); place_label="직접 좌표"\n    else:\n        lat,lon=KOREA_BIRTHPLACES[birth_place]; place_label=birth_place'''
new_profile = '''with st.expander("👤 나의 출생 프로필", expanded=False):\n    user_name=st.text_input("호칭",value=PROFILE_NAME_DEFAULT,key="profile_name")\n    birth_gender=st.selectbox("성별 · 사주 대운 계산용",["여성","남성"],index=0,key="profile_birth_gender")\n    birth_date=st.date_input("출생일",PROFILE_BIRTH_DATE_DEFAULT,key="profile_birth_date")\n    birth_time=st.time_input("출생 시간",PROFILE_BIRTH_TIME_DEFAULT,step=60,key="profile_birth_time")\n    _place_groups={}\n    for _place_name in KOREA_BIRTHPLACES:\n        _province=_place_name.split()[0]\n        _place_groups.setdefault(_province,[]).append(_place_name)\n    _default_province=PROFILE_BIRTH_PLACE_DEFAULT.split()[0]\n    _province_options=list(_place_groups)+["해외·직접 좌표"]\n    _province_index=_province_options.index(_default_province) if _default_province in _province_options else 0\n    birth_province=st.selectbox("출생 시·도",_province_options,index=_province_index,key="profile_birth_province")\n    if birth_province=="해외·직접 좌표":\n        place_label=st.text_input("출생 지역명",value="",placeholder="예: Tokyo, Japan",key="profile_birth_place_direct") or "직접 좌표"\n        lat=st.number_input("출생지 위도(N)",value=34.7604,format="%.6f",key="_direct_lat")\n        lon=st.number_input("출생지 경도(E)",value=127.6622,format="%.6f",key="_direct_lon")\n        birth_place="직접 좌표 입력(고급)"\n    else:\n        _city_options=_place_groups[birth_province]\n        _default_city=PROFILE_BIRTH_PLACE_DEFAULT if PROFILE_BIRTH_PLACE_DEFAULT in _city_options else _city_options[0]\n        birth_place=st.selectbox(\n            "출생 시·군·구",_city_options,index=_city_options.index(_default_city),\n            format_func=lambda x:(x[len(birth_province):].strip() or x),key="profile_birth_place"\n        )\n        lat,lon=KOREA_BIRTHPLACES[birth_place]; place_label=birth_place'''
if old_profile in app:
    app = app.replace(old_profile, new_profile, 1)
    changed = True

app = app.replace('query_date=st.date_input("📅 일일/주간 시작 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택됩니다. 다른 날짜 운세를 보고 싶을 때만 바꾸세요.")',
                  'query_date=st.date_input("기준 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택돼. 다른 날짜를 볼 때만 바꿔.")')

# 4) Simplify main navigation labels and rename counterpart tab -> 궁합운.
nav_map = {
    '"🌙 일일"':'"오늘"',
    '"📅 주간"':'"주간"',
    '"🌕 월간"':'"월간"',
    '"🌌 연간"':'"연간"',
    '"🧭 포춘랩"':'"포춘랩"',
    '"💞 상대재회"':'"궁합운"',
    '"📚 저장함"':'"저장함"',
    '"🔬 정밀분석"':'"정밀분석"',
}
for old,new in nav_map.items():
    if old in app:
        app = app.replace(old,new)
        changed = True

# Pass birthplace choices to Fortune Lab so counterpart location is selectable too.
ctx_marker = '        "birth_gender":birth_gender,\n'
if '"birthplace_options":KOREA_BIRTHPLACES' not in app:
    if ctx_marker not in app:
        raise SystemExit("Fortune Lab ctx marker not found")
    app = app.replace(ctx_marker, ctx_marker + '        "birthplace_options":KOREA_BIRTHPLACES,\n', 1)
    changed = True

# 5) Fortune Lab UI + region picker.
fortune = fortune.replace('FORTUNE_LAB_VERSION = "v0.1.4"','FORTUNE_LAB_VERSION = "v0.1.5"')

if "def _select_birthplace_from_options(" not in fortune:
    insert_marker = '\ndef render_fortune_lab(ctx):\n'
    if insert_marker not in fortune:
        raise SystemExit("render_fortune_lab marker not found")
    helper = r'''

def _select_birthplace_from_options(options,key_prefix):
    """Two-stage Korea selector with direct-input fallback. Returns (label, longitude)."""
    places=dict(options or {})
    if not places:
        label=st.text_input("상대 출생 지역",value="",placeholder="예: 광주광역시",key=f"{key_prefix}_direct_label")
        lon_raw=st.text_input("상대 출생지 경도(E) · 선택",value="",placeholder="출생시간을 알 때만",key=f"{key_prefix}_direct_lon")
        try: lon=float(lon_raw.strip()) if lon_raw.strip() else None
        except Exception:
            lon=None; st.warning("경도는 숫자로 입력해줘.")
        return label.strip(),lon
    groups={}
    for name in places:
        province=name.split()[0]
        groups.setdefault(province,[]).append(name)
    province_options=list(groups)+["해외·직접 입력"]
    province=st.selectbox("상대 출생 시·도",province_options,key=f"{key_prefix}_province")
    if province=="해외·직접 입력":
        label=st.text_input("상대 출생 지역명",value="",placeholder="예: Tokyo, Japan",key=f"{key_prefix}_direct_label")
        lon_raw=st.text_input("상대 출생지 경도(E) · 선택",value="",placeholder="출생시간을 알 때만",key=f"{key_prefix}_direct_lon")
        try: lon=float(lon_raw.strip()) if lon_raw.strip() else None
        except Exception:
            lon=None; st.warning("경도는 숫자로 입력해줘.")
        return label.strip(),lon
    city_options=groups[province]
    selected=st.selectbox(
        "상대 출생 시·군·구",city_options,
        format_func=lambda x:(x[len(province):].strip() or x),key=f"{key_prefix}_city"
    )
    coords=places.get(selected) or (None,None)
    return selected,(float(coords[1]) if len(coords)>1 and coords[1] is not None else None)
'''
    fortune = fortune.replace(insert_marker, helper + insert_marker, 1)
    changed = True

old_intro = '''def render_fortune_lab(ctx):\n    st.markdown("### 🧭 FORTUNE LAB · 다체계 운세 분석")\n    st.caption(f"운영 버전 · {FORTUNE_LAB_VERSION}")\n    st.caption("별빛의 서양 계산 + 사주 대운·세운·월운 + 태국 출생요일층을 한 번에 정리하고, 해석가는 Gemini 또는 외부 AI로 자유롭게 선택해.")'''
new_intro = '''def render_fortune_lab(ctx):\n    st.markdown('<div class="fortune-kicker">FORTUNE LAB</div>',unsafe_allow_html=True)\n    st.markdown('<div class="fortune-title">운의 흐름을 겹쳐보기</div>',unsafe_allow_html=True)\n    st.markdown('<div class="fortune-lead">서양점성술의 시간축과 사주 대운·세운·월운, 태국 출생층을 한 화면에서 비교해.</div>',unsafe_allow_html=True)\n    st.caption(f"운영 버전 · {FORTUNE_LAB_VERSION}")'''
if old_intro in fortune:
    fortune = fortune.replace(old_intro,new_intro,1)
    changed = True

fortune = fortune.replace('st.success("💞 특정 상대 재회 분석 · 상대 정보를 바로 입력해.")',
                          'st.success("궁합운 · 특정 상대의 관계 흐름을 보는 모드야.")')
fortune = fortune.replace('st.info("특정 상대 정보를 아래에 입력하면, 아는 데이터만 사용해서 재회 흐름을 계산해.")',
                          'st.info("상대 정보를 아는 만큼 입력해. 출생시간이 없으면 시간·ASC·하우스는 만들지 않아.")')
fortune = fortune.replace('st.markdown("#### 💞 특정 상대 정보")','st.markdown("#### 상대 프로필")')
fortune = fortune.replace('st.caption("출생시간을 몰라도 가능해. 그 경우 상대 시주·ASC·하우스는 계산하지 않고, 아는 데이터만 사용해.")',
                          'st.caption("출생시간은 몰라도 돼. 아는 범위까지만 계산해.")')

old_cp_place = '''        cp_place=st.text_input("상대 출생지 · 선택",value="",placeholder="예: 광주",key="fortune_lab_cp_place")\n        cp_lon_raw=st.text_input("상대 출생지 경도(E) · 시간 보정용 선택",value="",placeholder="시간을 정확히 알 때만 예: 126.85",key="fortune_lab_cp_lon")\n        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점/현재 단절 여부 정도만",key="fortune_lab_cp_context")\n        cp_lon=None\n        if cp_time_known and cp_lon_raw.strip():\n            try: cp_lon=float(cp_lon_raw.strip())\n            except Exception: st.warning("상대 경도는 숫자로 입력해줘. 경도를 비우면 상대 시주는 사용하지 않아.")'''
new_cp_place = '''        cp_place,cp_lon=_select_birthplace_from_options(ctx.get("birthplace_options") or {},"fortune_lab_cp")\n        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점, 현재 단절 여부 정도",key="fortune_lab_cp_context")'''
if old_cp_place in fortune:
    fortune = fortune.replace(old_cp_place,new_cp_place,1)
    changed = True

fortune = fortune.replace('calc=st.button("🧭 세 체계 계산자료 만들기",type="primary",use_container_width=True,key="fortune_lab_calc")',
                          'calc=st.button("✨ 운의 흐름 계산하기",type="primary",use_container_width=True,key="fortune_lab_calc")')
fortune = fortune.replace('st.info("주제와 기간을 고른 뒤 계산자료 만들기를 눌러줘. Gemini를 안 써도 계산자료와 심층 프롬프트는 만들어져.")',
                          'st.info("정보와 기간을 확인한 뒤 ‘운의 흐름 계산하기’를 눌러줘. Gemini 없이도 계산자료와 심층 프롬프트는 만들어져.")')

APP.write_text(app,encoding="utf-8")
FORTUNE.write_text(fortune,encoding="utf-8")
print("Applied Astro UI redesign v7.2 / Fortune Lab v0.1.5" if changed else "No changes needed")
