from pathlib import Path

APP = Path('app.py')
app = APP.read_text(encoding='utf-8')
changed = False

# 1) Keep the date control inside the existing profile expander so the main
# surface can show one clean summary card instead of a full-width form field.
old_date = '''# 날짜는 오늘 자동. 사용자가 원할 때만 바꾼다.\nquery_date=st.date_input("기준 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택돼. 다른 날짜를 볼 때만 바꿔.")'''
new_date = '''    st.markdown("<div class='profile-inner-label'>운세 기준 날짜</div>", unsafe_allow_html=True)\n    query_date=st.date_input("기준 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택돼. 다른 날짜를 볼 때만 바꿔.", label_visibility="collapsed")\n# 날짜는 오늘 자동. 사용자가 원할 때만 바꾼다.'''
if old_date in app:
    app = app.replace(old_date, new_date, 1)
    changed = True
elif "profile-inner-label" not in app:
    raise SystemExit('date control marker not found')

# 2) Replace the separate profile strip with a single date + identity summary card.
old_profile = '''st.markdown(f"<div class='profile-strip'><strong>{user_name}</strong> · {birth_date:%Y.%m.%d} {birth_time:%H:%M} · {place_label}<br>ASC <strong>{asc_sign} {asc_deg:.2f}°</strong></div>",unsafe_allow_html=True)'''
new_profile = '''st.markdown(f"""\n<div class="identity-summary-card">\n  <div class="identity-date-block">\n    <span class="identity-eyebrow">기준 날짜</span>\n    <strong>{query_date:%Y / %m / %d} ({WEEKDAY_KO[query_date.weekday()]})</strong>\n  </div>\n  <div class="identity-person-block">\n    <span class="identity-eyebrow">나의 프로필</span>\n    <strong>{user_name}</strong><span> · {birth_date:%Y.%m.%d} {birth_time:%H:%M}</span><br>\n    <span>{place_label} · ASC </span><b>{asc_sign} {asc_deg:.2f}°</b>\n  </div>\n</div>\n""",unsafe_allow_html=True)'''
if old_profile in app:
    app = app.replace(old_profile, new_profile, 1)
    changed = True
elif 'identity-summary-card' not in app:
    raise SystemExit('profile summary marker not found')

# 3) Tool cards use clean labels; icons are structural CSS pseudo-elements so
# they sit above the label instead of looking like stray unicode text.
old_tools = '''    _tool_items=[\n        ("통합운세","✦  통합운세"),\n        ("궁합운","♥  궁합운"),\n        ("저장함","▣  저장함"),\n        ("정밀분석","⌕  정밀분석"),\n    ]'''
new_tools = '''    _tool_items=[\n        ("통합운세","통합운세"),\n        ("궁합운","궁합운"),\n        ("저장함","저장함"),\n        ("정밀분석","정밀분석"),\n    ]'''
if old_tools in app:
    app = app.replace(old_tools, new_tools, 1)
    changed = True

# 4) The daily report gets its own surface card, matching the approved mockup.
old_daily = '''if main_view=="오늘":\n    st.markdown(f"### 🌙 {query_date:%Y년 %m월 %d일}({WEEKDAY_KO[query_date.weekday()]}) 일일 리포트")\n    if query_date==today_kst: st.caption("앱을 열었을 때 오늘 날짜를 자동으로 계산합니다. 기준 시각 입력은 필요 없습니다.")\n    else: st.caption("선택한 날짜의 하루 전체 흐름을 여러 시간대로 나눠 계산합니다.")'''
new_daily = '''if main_view=="오늘":\n    _daily_sub = "오늘의 흐름을 분야별로 정리했어." if query_date==today_kst else "선택한 날짜의 하루 흐름을 시간대별로 계산했어."\n    st.markdown(f"""\n    <div class="daily-cover-card">\n      <div class="daily-cover-moon">☾</div>\n      <div>\n        <div class="daily-cover-kicker">DAILY CELESTIAL REPORT</div>\n        <div class="daily-cover-title">{query_date:%Y년 %m월 %d일}({WEEKDAY_KO[query_date.weekday()]}) 오늘의 리포트</div>\n        <div class="daily-cover-sub">{_daily_sub}</div>\n      </div>\n    </div>\n    """, unsafe_allow_html=True)'''
if old_daily in app:
    app = app.replace(old_daily, new_daily, 1)
    changed = True
elif 'daily-cover-card' not in app:
    raise SystemExit('daily heading marker not found')

# 5) Final visual layer: this is intentionally structural, not another small palette tweak.
if 'ASTRO_DESIGN_V77_CSS' not in app:
    marker = 'st.markdown(ASTRO_DESIGN_V76_CSS, unsafe_allow_html=True)\n'
    if marker not in app:
        raise SystemExit('v7.6 CSS render marker not found')
    css = r'''

# ============================================================
# 0-A7. VISUAL SYSTEM v7.7 · STRUCTURAL MOBILE SHELL
# ============================================================
ASTRO_DESIGN_V77_CSS = """
<style>
:root{
  --v77-ink:#33251e;
  --v77-muted:#7c6b60;
  --v77-gold:#b77a37;
  --v77-gold-soft:#efd9b6;
  --v77-rose:#c9747e;
  --v77-sage:#7f9278;
  --v77-paper:#fffdf8;
  --v77-line:rgba(104,72,51,.13);
  --v77-shadow:0 12px 30px rgba(69,45,29,.065);
}

/* Remove Streamlit's dead top chrome/spacing on mobile. */
header[data-testid="stHeader"],[data-testid="stToolbar"],[data-testid="stDecoration"]{
  display:none!important;height:0!important;min-height:0!important;visibility:hidden!important;
}
[data-testid="stAppViewContainer"], [data-testid="stAppViewContainer"] > .main{
  padding-top:0!important;margin-top:0!important;
}
.block-container,.stMainBlockContainer{
  padding-top:.35rem!important;margin-top:0!important;
}

.stApp{
  background:
    radial-gradient(circle at 8% 4%,rgba(236,196,130,.17),transparent 27%),
    radial-gradient(circle at 98% 29%,rgba(210,168,124,.09),transparent 25%),
    linear-gradient(180deg,#fbf8f1 0%,#f8f1e7 56%,#fcfaf6 100%)!important;
  color:var(--v77-ink)!important;
}

/* Hero: shorter, more editorial, no giant dead air. */
.astro-hero-v76{
  margin:0 0 11px!important;
  min-height:0!important;
  padding:20px 18px 18px!important;
  border-radius:23px!important;
}
.astro-hero-title{font-size:1.82rem!important;letter-spacing:-.055em!important}
.astro-hero-sub{font-size:.73rem!important}
.astro-hero-sigil{width:44px!important;height:44px!important;flex:0 0 44px!important}

/* Profile expander becomes one compact control row. */
[data-testid="stExpander"]{
  border:1px solid var(--v77-line)!important;
  box-shadow:0 7px 19px rgba(66,43,28,.045)!important;
  background:rgba(255,253,248,.96)!important;
  border-radius:15px!important;
}
[data-testid="stExpander"] summary{min-height:48px!important}
.profile-inner-label{font-size:.72rem;font-weight:800;color:#806655;margin:8px 0 5px}

/* One summary card replaces the old date input + profile strip stack. */
.identity-summary-card{
  display:grid;grid-template-columns:.9fr 1.45fr;
  margin:11px 0 14px;padding:0;
  background:rgba(255,253,248,.97);border:1px solid var(--v77-line);border-radius:18px;
  box-shadow:var(--v77-shadow);overflow:hidden;color:#534238;
}
.identity-date-block,.identity-person-block{padding:13px 15px;min-width:0}
.identity-date-block{border-right:1px solid rgba(108,75,53,.10);display:flex;flex-direction:column;justify-content:center}
.identity-eyebrow{display:block;font-size:.61rem;font-weight:850;letter-spacing:.10em;color:#a2836d;margin-bottom:4px}
.identity-date-block strong{font-size:.91rem;color:#362820;white-space:nowrap}
.identity-person-block{font-size:.75rem;line-height:1.55;color:#6d5c51}
.identity-person-block strong{font-size:.86rem;color:#33251e}.identity-person-block b{color:#5a4334}

/* Period selector: small, equal, restrained. */
.astro-nav-label{font-size:.61rem!important;font-weight:850!important;letter-spacing:.12em!important;color:#8d715e!important;margin:12px 2px 6px!important}
div[class*="st-key-astro_period_nav_group"] button{
  height:42px!important;min-height:42px!important;border-radius:13px!important;
  font-size:.75rem!important;box-shadow:0 5px 14px rgba(70,46,30,.035)!important;
}

/* Analysis tools become actual icon cards. */
div[class*="st-key-astro_tool_nav_group"] button{
  position:relative!important;height:82px!important;min-height:82px!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-end!important;
  gap:4px!important;padding:12px 3px 11px!important;border-radius:17px!important;
  font-size:.72rem!important;font-weight:850!important;line-height:1!important;
  background:rgba(255,253,248,.98)!important;border:1px solid var(--v77-line)!important;
  color:#514038!important;box-shadow:0 9px 22px rgba(71,46,29,.055)!important;
}
div[class*="st-key-astro_tool_nav_group"] button::before{
  display:block;font-size:1.45rem;line-height:1;margin-bottom:3px;font-weight:500;
}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(1) button::before{content:"✦";color:#b77a37}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(2) button::before{content:"♥";color:#d36f82}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(3) button::before{content:"▣";color:#9a7db2}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(4) button::before{content:"⌕";color:#728971}
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"]{
  background:linear-gradient(145deg,#fff9ec,#efd8b4)!important;
  border:1.5px solid rgba(183,122,55,.52)!important;color:#493326!important;
  box-shadow:0 12px 28px rgba(111,71,34,.12)!important;
}

/* Daily report cover visually separates navigation from content. */
.daily-cover-card{
  display:flex;align-items:center;gap:12px;margin:23px 0 13px;padding:15px 16px;
  border-radius:18px;border:1px solid var(--v77-line);background:rgba(255,253,248,.96);box-shadow:var(--v77-shadow)
}
.daily-cover-moon{width:40px;height:40px;flex:0 0 40px;border-radius:13px;display:grid;place-items:center;background:#fff4df;color:#ac7130;font-size:1.25rem;border:1px solid rgba(183,122,55,.15)}
.daily-cover-kicker{font-size:.56rem;letter-spacing:.13em;font-weight:900;color:#aa8059;margin-bottom:3px}
.daily-cover-title{font-size:1rem;font-weight:900;color:#35261f;letter-spacing:-.025em;line-height:1.3}
.daily-cover-sub{font-size:.72rem;color:#88766a;margin-top:3px}

/* Score/report cards use the same warm visual language. */
.score-card,[data-testid="stMetric"]{
  background:rgba(255,253,249,.97)!important;border:1px solid var(--v77-line)!important;
  box-shadow:0 8px 20px rgba(69,45,29,.045)!important;border-radius:17px!important;
}
.score-num,.topic-score-num{color:#8d662c!important}
.score-band{background:#f5ede3!important;color:#7c695d!important}

/* Kill the leftover lavender report styling from the old app. */
.ai-overview{
  background:linear-gradient(145deg,#fffdf8,#faf2e5)!important;
  border:1px solid rgba(142,98,62,.14)!important;
  box-shadow:var(--v77-shadow)!important;border-radius:19px!important;
}
.ai-kicker{color:#a2713f!important}.ai-head,.ai-verdict{color:#3c2b23!important}.ai-body{color:#65554b!important}
.ai-cluster{background:#fbf5eb!important;border-color:rgba(139,98,65,.10)!important;color:#625248!important}
.ai-cluster strong{color:#46342b!important}
.ai-chip{background:#f1e4d2!important;color:#6a513f!important}
.ai-analysis{background:linear-gradient(135deg,#fbf5e9,#f7eee5)!important;border-left-color:#bd8650!important;color:#5c4a40!important}
.ai-label{color:#9a6d47!important}.ai-confidence{background:#efe3d5!important;color:#705845!important}
.rule-summary,.astro-note{color:#74635a!important}
.decision-strip{background:#fbf0ed!important;border-left-color:#c97b7b!important;color:#654f49!important}
.timing-strip{background:#f2eee4!important;color:#665b4e!important}

/* Standard inputs no longer look like gray system fields. */
[data-baseweb="select"]>div,[data-testid="stDateInput"] input,[data-testid="stTimeInput"] input,
[data-testid="stTextInput"] input,[data-testid="stNumberInput"] input,[data-testid="stTextArea"] textarea{
  background:#fffdf9!important;color:#44352d!important;border-color:rgba(111,78,55,.14)!important;
}

@media(max-width:640px){
  .block-container,.stMainBlockContainer{padding:.2rem .95rem calc(8.5rem + env(safe-area-inset-bottom))!important}
  .astro-hero-v76{padding:18px 16px 17px!important;border-radius:21px!important}
  .astro-hero-title{font-size:1.72rem!important}.astro-hero-kicker{font-size:.57rem!important}
  .identity-summary-card{grid-template-columns:.88fr 1.5fr;border-radius:16px!important}
  .identity-date-block,.identity-person-block{padding:11px 12px}
  .identity-date-block strong{font-size:.79rem}.identity-person-block{font-size:.68rem}.identity-person-block strong{font-size:.78rem}
  div[class*="st-key-astro_tool_nav_group"] button{height:78px!important;min-height:78px!important;font-size:.68rem!important}
  .daily-cover-card{margin-top:20px;padding:13px 14px}.daily-cover-title{font-size:.93rem}
}
</style>
"""
st.markdown(ASTRO_DESIGN_V77_CSS, unsafe_allow_html=True)
'''
    app = app.replace(marker, marker + css, 1)
    changed = True

if not changed:
    print('Already applied structural visual shell v7.7')
else:
    APP.write_text(app, encoding='utf-8')
    print('Applied structural visual shell v7.7')
