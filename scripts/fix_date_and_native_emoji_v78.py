from pathlib import Path

APP = Path("app.py")
app = APP.read_text(encoding="utf-8")
changed = False

# 1) Restore the fortune reference date to the main surface.
old_date = '''    st.markdown("<div class='profile-inner-label'>운세 기준 날짜</div>", unsafe_allow_html=True)
    query_date=st.date_input("기준 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택돼. 다른 날짜를 볼 때만 바꿔.", label_visibility="collapsed")
# 날짜는 오늘 자동. 사용자가 원할 때만 바꾼다.'''
new_date = '''# 날짜는 오늘 자동. 사용자가 원할 때만 바꾼다.
query_date=st.date_input("운세 기준 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택돼. 다른 날짜를 볼 때 바로 바꿔.")'''
if old_date in app:
    app = app.replace(old_date, new_date, 1)
    changed = True
elif 'st.date_input("운세 기준 날짜"' not in app:
    raise SystemExit("visible date control marker not found")

# 2) Date no longer belongs in the profile summary card; keep profile only.
old_summary = '''st.markdown(f"""
<div class="identity-summary-card">
  <div class="identity-date-block">
    <span class="identity-eyebrow">기준 날짜</span>
    <strong>{query_date:%Y / %m / %d} ({WEEKDAY_KO[query_date.weekday()]})</strong>
  </div>
  <div class="identity-person-block">
    <span class="identity-eyebrow">나의 프로필</span>
    <strong>{user_name}</strong><span> · {birth_date:%Y.%m.%d} {birth_time:%H:%M}</span><br>
    <span>{place_label} · ASC </span><b>{asc_sign} {asc_deg:.2f}°</b>
  </div>
</div>
""",unsafe_allow_html=True)'''
new_summary = '''st.markdown(f"""
<div class="identity-summary-card identity-profile-only">
  <div class="identity-person-block">
    <span class="identity-eyebrow">나의 프로필</span>
    <strong>{user_name}</strong><span> · {birth_date:%Y.%m.%d} {birth_time:%H:%M}</span><br>
    <span>{place_label} · ASC </span><b>{asc_sign} {asc_deg:.2f}°</b>
  </div>
</div>
""",unsafe_allow_html=True)'''
if old_summary in app:
    app = app.replace(old_summary, new_summary, 1)
    changed = True
elif 'identity-profile-only' not in app:
    raise SystemExit("profile-only summary marker not found")

# 3) Replace typographic symbols with native emoji in period labels.
old_period = '''    _period_items=[("오늘","☀ 오늘"),("주간","▣ 주간"),("월간","☾ 월간"),("연간","◎ 연간")]'''
new_period = '''    _period_items=[("오늘","☀️ 오늘"),("주간","📅 주간"),("월간","🌙 월간"),("연간","🪐 연간")]'''
if old_period in app:
    app = app.replace(old_period, new_period, 1)
    changed = True
elif '☀️ 오늘' not in app:
    raise SystemExit("period emoji marker not found")

# 4) Final override: Apple-style native emoji for the four analysis cards.
if "ASTRO_DESIGN_V78_CSS" not in app:
    marker = 'st.markdown(ASTRO_DESIGN_V77_CSS, unsafe_allow_html=True)\n'
    if marker not in app:
        raise SystemExit("v7.7 CSS marker not found")
    css = r'''

# ============================================================
# 0-A8. VISUAL SYSTEM v7.8 · VISIBLE DATE + NATIVE EMOJI
# ============================================================
ASTRO_DESIGN_V78_CSS = """
<style>
/* The date is a first-class, always-visible control again. */
[data-testid="stDateInput"]{margin:8px 0 10px!important}
[data-testid="stDateInput"] label p{
  color:#4d3c32!important;font-size:.78rem!important;font-weight:850!important;
}
[data-testid="stDateInput"] input{
  min-height:46px!important;background:#fffdf9!important;
  border:1px solid rgba(111,78,55,.14)!important;border-radius:14px!important;
  box-shadow:0 6px 16px rgba(69,45,29,.035)!important;
}

/* Profile summary now has one purpose only. */
.identity-summary-card.identity-profile-only{display:block!important;margin:10px 0 14px!important}
.identity-profile-only .identity-person-block{padding:13px 15px!important;border:0!important}

/* Use color emoji glyphs instead of pseudo-icon typography. */
div[class*="st-key-astro_tool_nav_group"] button::before{
  font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif!important;
  font-size:1.55rem!important;line-height:1!important;margin-bottom:5px!important;
  filter:none!important;color:initial!important;
}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(1) button::before{content:"✨"!important}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(2) button::before{content:"💗"!important}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(3) button::before{content:"📚"!important}
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]:nth-child(4) button::before{content:"🔍"!important}

/* Period buttons render native emoji naturally and stay compact. */
div[class*="st-key-astro_period_nav_group"] button p,
div[class*="st-key-astro_period_nav_group"] button span{
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Apple Color Emoji",sans-serif!important;
}

@media(max-width:640px){
  div[class*="st-key-astro_tool_nav_group"] button{height:78px!important;min-height:78px!important}
  div[class*="st-key-astro_tool_nav_group"] button::before{font-size:1.45rem!important}
}
</style>
"""
st.markdown(ASTRO_DESIGN_V78_CSS, unsafe_allow_html=True)
'''
    app = app.replace(marker, marker + css, 1)
    changed = True

if not changed:
    print("Already applied visible-date/native-emoji v7.8")
else:
    APP.write_text(app, encoding="utf-8")
    print("Applied visible-date/native-emoji v7.8")
