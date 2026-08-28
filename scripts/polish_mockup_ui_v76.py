from pathlib import Path

APP=Path('app.py')
LAB=Path('fortune_lab_v71.py')
app=APP.read_text(encoding='utf-8')
lab=LAB.read_text(encoding='utf-8')
changed=False

# 1) Richer celestial hero card matching the approved warm observatory mockup.
old_hero='''st.markdown("""
<div class="astro-hero">
  <div class="astro-hero-kicker">CELESTIAL TIMING LAB</div>
  <div class="astro-hero-row">
    <div class="astro-hero-sigil">☾</div>
    <div>
      <div class="astro-hero-title">별빛의 운명</div>
      <div class="astro-hero-sub">시간의 흐름과 삶의 패턴을 읽는 개인 관측실</div>
    </div>
  </div>
</div>
""",unsafe_allow_html=True)'''
new_hero='''st.markdown("""
<div class="astro-hero astro-hero-v76">
  <div class="astro-hero-orbit orbit-a"></div>
  <div class="astro-hero-orbit orbit-b"></div>
  <div class="astro-hero-star star-a">✦</div>
  <div class="astro-hero-star star-b">✧</div>
  <div class="astro-hero-kicker">CELESTIAL OBSERVATORY</div>
  <div class="astro-hero-row">
    <div class="astro-hero-sigil">☾</div>
    <div>
      <div class="astro-hero-title">별빛의 운명 <span class="astro-title-spark">✦</span></div>
      <div class="astro-hero-sub">시간의 흐름과 삶의 패턴을 읽는 개인 관측실</div>
    </div>
  </div>
</div>
""",unsafe_allow_html=True)'''
if old_hero in app:
    app=app.replace(old_hero,new_hero,1); changed=True
elif 'astro-hero-v76' not in app:
    raise SystemExit('hero marker not found')

# 2) Navigation labels: route keys stay stable, visible labels gain intuitive icons.
old_period='''    for _i,_label in enumerate(["오늘","주간","월간","연간"]):
        if _nav_period[_i].button(_label,key=f"main_nav_period_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):
            if main_view!=_label:
                st.session_state["main_view"]=_label
                st.rerun()'''
new_period='''    _period_items=[("오늘","☀ 오늘"),("주간","▣ 주간"),("월간","☾ 월간"),("연간","◎ 연간")]
    for _i,(_route,_display) in enumerate(_period_items):
        if _nav_period[_i].button(_display,key=f"main_nav_period_{_i}",use_container_width=True,type="primary" if main_view==_route else "secondary"):
            if main_view!=_route:
                st.session_state["main_view"]=_route
                st.rerun()'''
if old_period in app:
    app=app.replace(old_period,new_period,1); changed=True
elif '_period_items=' not in app:
    raise SystemExit('period nav marker not found')

old_tools='''    for _i,_label in enumerate(["통합운세","궁합운","저장함","정밀분석"]):
        if _nav_tools[_i].button(_label,key=f"main_nav_tool_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):
            if main_view!=_label:
                st.session_state["main_view"]=_label
                st.rerun()'''
new_tools='''    _tool_items=[
        ("통합운세","✦  통합운세"),
        ("궁합운","♥  궁합운"),
        ("저장함","▣  저장함"),
        ("정밀분석","⌕  정밀분석"),
    ]
    for _i,(_route,_display) in enumerate(_tool_items):
        if _nav_tools[_i].button(_display,key=f"main_nav_tool_{_i}",use_container_width=True,type="primary" if main_view==_route else "secondary"):
            if main_view!=_route:
                st.session_state["main_view"]=_route
                st.rerun()'''
if old_tools in app:
    app=app.replace(old_tools,new_tools,1); changed=True
elif '_tool_items=' not in app:
    raise SystemExit('tool nav marker not found')

app=app.replace('<div class="astro-nav-label">기간 운세</div>','<div class="astro-nav-label">기간 선택</div>')

# 3) Fortune/compatibility page headers become real page cards, not floating text.
old_head='''    st.markdown('<div class="fortune-kicker">INTEGRATED FORTUNE</div>',unsafe_allow_html=True)
    if is_compat:
        st.markdown('<div class="fortune-title">두 사람의 궁합과 관계 흐름</div>',unsafe_allow_html=True)
        st.markdown('<div class="fortune-lead">궁합의 기본 패턴과 선택한 기간의 관계 흐름을 분리해서 봐. 상대 정보는 아는 범위까지만 사용해.</div>',unsafe_allow_html=True)
    else:
        st.markdown('<div class="fortune-title">통합운세</div>',unsafe_allow_html=True)
        st.markdown('<div class="fortune-lead">서양점성술·사주명리·태국점성술을 각각 계산한 뒤, 같은 기간에서 겹치는 흐름과 차이를 한눈에 비교해.</div>',unsafe_allow_html=True)
    st.caption(f"운영 버전 · {FORTUNE_LAB_VERSION}")'''
new_head='''    if is_compat:
        st.markdown('''<div class="fortune-page-head compat-head">
          <div class="fortune-page-icon">♥</div>
          <div><div class="fortune-kicker">RELATIONSHIP ASTROLOGY</div>
          <div class="fortune-title">궁합운</div>
          <div class="fortune-lead">두 사람의 기본 궁합과 관계·재회 흐름을 분리해서 분석해.</div></div>
        </div>''',unsafe_allow_html=True)
    else:
        st.markdown('''<div class="fortune-page-head integrated-head">
          <div class="fortune-page-icon">✦</div>
          <div><div class="fortune-kicker">INTEGRATED FORTUNE</div>
          <div class="fortune-title">통합운세</div>
          <div class="fortune-lead">서양점성술·사주명리·태국점성술을 각각 계산해 겹치는 흐름과 차이를 비교해.</div></div>
        </div>''',unsafe_allow_html=True)
    st.caption(f"운영 버전 · {FORTUNE_LAB_VERSION}")'''
if old_head in lab:
    lab=lab.replace(old_head,new_head,1); changed=True
elif 'fortune-page-head' not in lab:
    raise SystemExit('fortune header marker not found')

# 4) Compatibility mode: selectbox -> three-tab segmented control.
old_compat='''        topic=st.selectbox(
            "궁합운에서 볼 것",
            ["궁합 전체","관계 흐름","재회 흐름"],
            key="fortune_lab_compat_topic",
            help="궁합 전체는 기본 관계 패턴을 먼저 보고, 관계/재회 흐름은 선택 기간의 활성도를 더 강조해.",
        )'''
new_compat='''        st.markdown('<div class="compat-tab-label">어떤 흐름을 볼까?</div>',unsafe_allow_html=True)
        topic=st.radio(
            "궁합운에서 볼 것",
            ["궁합 전체","관계 흐름","재회 흐름"],
            horizontal=True,
            label_visibility="collapsed",
            key="fortune_lab_compat_topic",
            help="궁합 전체는 기본 관계 패턴을 먼저 보고, 관계/재회 흐름은 선택 기간의 활성도를 더 강조해.",
        )'''
if old_compat in lab:
    lab=lab.replace(old_compat,new_compat,1); changed=True
elif 'compat-tab-label' not in lab:
    raise SystemExit('compat selector marker not found')

if 'FORTUNE_LAB_VERSION = "v0.1.8"' in lab:
    lab=lab.replace('FORTUNE_LAB_VERSION = "v0.1.8"','FORTUNE_LAB_VERSION = "v0.1.9"',1); changed=True

# 5) Final mockup-grade CSS layer. This intentionally overrides earlier visual layers.
if 'ASTRO_DESIGN_V76_CSS' not in app:
    marker='st.markdown(ASTRO_DESIGN_V75_CSS, unsafe_allow_html=True)\n'
    if marker not in app:
        raise SystemExit('v7.5 CSS render marker not found')
    css=r'''

# ============================================================
# 0-A6. VISUAL SYSTEM v7.6 · MOCKUP-GRADE CELESTIAL MOBILE UI
# ============================================================
ASTRO_DESIGN_V76_CSS = """
<style>
:root{
  --obs-cream:#fbf7ef;
  --obs-paper:#fffdf9;
  --obs-brown:#6c4934;
  --obs-brown-dark:#493126;
  --obs-gold:#c18a45;
  --obs-line:rgba(112,78,54,.13);
  --obs-shadow:0 14px 35px rgba(76,51,34,.075);
}
.stApp{
  background:
    radial-gradient(circle at 15% 0%,rgba(235,196,132,.17),transparent 30%),
    radial-gradient(circle at 100% 24%,rgba(210,169,129,.10),transparent 27%),
    linear-gradient(180deg,#fbf8f1 0%,#f7efe4 58%,#fcfaf6 100%)!important;
}
.block-container{max-width:720px!important;padding-top:.65rem!important}

/* Hero is now an actual celestial card. */
.astro-hero-v76{
  position:relative!important;overflow:hidden!important;
  margin:6px 0 12px!important;padding:24px 20px 22px!important;
  border:1px solid rgba(184,137,81,.17)!important;border-radius:27px!important;
  background:
    radial-gradient(circle at 89% 18%,rgba(224,183,111,.18),transparent 21%),
    radial-gradient(circle at 12% 85%,rgba(244,222,184,.34),transparent 28%),
    linear-gradient(135deg,rgba(255,253,248,.99),rgba(249,238,219,.94))!important;
  box-shadow:0 18px 44px rgba(91,62,39,.085)!important;
}
.astro-hero-v76:after{
  content:"";position:absolute;right:-55px;top:-76px;width:185px;height:185px;border-radius:50%;
  border:1px solid rgba(190,143,79,.20);box-shadow:0 0 0 18px rgba(201,155,93,.035),0 0 0 38px rgba(201,155,93,.025);
}
.astro-hero-orbit{position:absolute;border:1px solid rgba(186,139,78,.17);border-radius:50%;pointer-events:none}
.astro-hero-orbit.orbit-a{width:210px;height:86px;right:-55px;top:35px;transform:rotate(-18deg)}
.astro-hero-orbit.orbit-b{width:120px;height:120px;left:-72px;bottom:-70px}
.astro-hero-star{position:absolute;color:#c49658;opacity:.72;pointer-events:none}
.astro-hero-star.star-a{right:66px;top:30px;font-size:1.08rem}.astro-hero-star.star-b{right:35px;bottom:25px;font-size:.82rem}
.astro-hero-kicker{color:#a17b54!important;font-size:.61rem!important;letter-spacing:.19em!important;margin-bottom:9px!important}
.astro-hero-row{gap:13px!important;position:relative;z-index:2}
.astro-hero-sigil{width:48px!important;height:48px!important;background:linear-gradient(145deg,#fffdf7,#efd4a9)!important;border-color:rgba(184,136,70,.22)!important;color:#a86f2f!important;box-shadow:0 10px 26px rgba(127,86,45,.12)!important}
.astro-hero-title{font-size:2.02rem!important;color:#3b281f!important}.astro-title-spark{color:#c18a45;font-size:.72em}
.astro-hero-sub{color:#7d685b!important;font-size:.76rem!important}

/* Profile/date/form cards */
.profile-strip,[data-testid="stExpander"]{
  background:rgba(255,253,249,.96)!important;border:1px solid var(--obs-line)!important;
  box-shadow:var(--obs-shadow)!important;border-radius:18px!important;
}
[data-testid="stDateInput"] input,[data-baseweb="select"]>div,[data-testid="stTextInput"] input,
[data-testid="stTimeInput"] input,[data-testid="stTextArea"] textarea,[data-testid="stNumberInput"] input{
  background:rgba(255,254,251,.98)!important;border:1px solid rgba(120,86,61,.13)!important;
  border-radius:13px!important;box-shadow:0 5px 15px rgba(75,51,34,.025)!important;
}

/* Period navigation = slim segmented selector. */
div[class*="st-key-astro_period_nav_group"] [data-testid="stHorizontalBlock"]{gap:8px!important}
div[class*="st-key-astro_period_nav_group"] button{
  height:43px!important;min-height:43px!important;border-radius:13px!important;
  font-size:.76rem!important;font-weight:800!important;background:rgba(255,253,249,.96)!important;
  border:1px solid var(--obs-line)!important;color:#665247!important;box-shadow:0 5px 15px rgba(76,51,34,.035)!important;
}
div[class*="st-key-astro_period_nav_group"] button[kind="primary"]{
  background:linear-gradient(135deg,#65452f,#8a613f)!important;color:#fff!important;border-color:#725038!important;
  box-shadow:0 10px 22px rgba(91,60,37,.18)!important;
}

/* Analysis tools = stronger quick-action cards like the visual mockup. */
div[class*="st-key-astro_tool_nav_group"] [data-testid="stHorizontalBlock"]{gap:8px!important}
div[class*="st-key-astro_tool_nav_group"] button{
  height:64px!important;min-height:64px!important;border-radius:16px!important;
  font-size:.75rem!important;font-weight:850!important;background:rgba(255,253,249,.97)!important;
  border:1px solid rgba(120,86,61,.13)!important;color:#514038!important;
  box-shadow:0 9px 23px rgba(76,51,34,.055)!important;padding:0 5px!important;
}
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"]{
  background:linear-gradient(145deg,#fff8ea,#f0d6ae)!important;color:#553c2b!important;
  border:1.5px solid rgba(190,132,61,.55)!important;box-shadow:0 12px 28px rgba(132,87,42,.12)!important;
}
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"] p,
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"] span{color:#553c2b!important}

.astro-nav-label{font-size:.64rem!important;color:#856955!important;letter-spacing:.10em!important;margin:13px 2px 6px!important}
.astro-nav-tools{margin-top:11px!important}

/* Fortune/compatibility top card. */
.fortune-page-head{
  display:flex;align-items:center;gap:13px;margin:9px 0 12px;padding:16px 16px;
  border-radius:20px;border:1px solid rgba(120,86,61,.13);background:rgba(255,253,249,.94);
  box-shadow:var(--obs-shadow);
}
.fortune-page-icon{width:43px;height:43px;flex:0 0 43px;border-radius:14px;display:grid;place-items:center;font-size:1.25rem;font-weight:900;background:#fff7e8;color:#ad7431;border:1px solid rgba(188,131,63,.18)}
.compat-head .fortune-page-icon{background:#fff0f2;color:#d65d77;border-color:rgba(214,93,119,.15)}
.fortune-page-head .fortune-kicker{margin:0 0 2px!important;font-size:.58rem!important}
.fortune-page-head .fortune-title{margin:0!important;font-size:1.38rem!important;line-height:1.18!important}
.fortune-page-head .fortune-lead{margin:4px 0 0!important;font-size:.78rem!important;line-height:1.48!important}

/* Compatibility sub-navigation behaves like the 3-tab mockup. */
.compat-tab-label{font-size:.72rem;font-weight:850;color:#6d5749;margin:13px 1px 6px}
div[class*="st-key-fortune_lab_compat_topic"] [role="radiogroup"]{
  width:100%!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:0!important;padding:4px!important;background:rgba(246,237,225,.72)!important;border:1px solid rgba(124,88,61,.11)!important;border-radius:15px!important;overflow:hidden!important;
}
div[class*="st-key-fortune_lab_compat_topic"] [role="radiogroup"] label{
  width:100%!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:11px!important;padding:8px 4px!important;
}
div[class*="st-key-fortune_lab_compat_topic"] [role="radiogroup"] label:has(input:checked){
  background:#fffdf9!important;color:#68482f!important;box-shadow:0 5px 14px rgba(89,59,36,.08)!important;
}
div[class*="st-key-fortune_lab_compat_topic"] [data-testid="stWidgetLabel"]{display:none!important}

/* Primary action buttons look more like the mockup CTA. */
.stButton>button[kind="primary"]{
  border-radius:14px!important;background:linear-gradient(135deg,#68462f,#8e633f)!important;
  color:#fff!important;border:0!important;min-height:48px!important;box-shadow:0 11px 26px rgba(91,59,36,.18)!important;
}
.stButton>button[kind="primary"] p,.stButton>button[kind="primary"] span{color:#fff!important}

@media(max-width:640px){
  .block-container{padding-left:.92rem!important;padding-right:.92rem!important;padding-top:.45rem!important}
  .astro-hero-v76{padding:21px 17px 20px!important;border-radius:23px!important}
  .astro-hero-title{font-size:1.78rem!important}.astro-hero-sigil{width:44px!important;height:44px!important}
  div[class*="st-key-astro_period_nav_group"] button{height:41px!important;min-height:41px!important;font-size:.70rem!important}
  div[class*="st-key-astro_tool_nav_group"] button{height:61px!important;min-height:61px!important;font-size:.68rem!important;padding:0 2px!important}
  .fortune-page-head{padding:14px 13px;border-radius:17px}.fortune-page-icon{width:39px;height:39px;flex-basis:39px;border-radius:12px}
  .fortune-page-head .fortune-title{font-size:1.23rem!important}.fortune-page-head .fortune-lead{font-size:.73rem!important}
}
</style>
"""
st.markdown(ASTRO_DESIGN_V76_CSS, unsafe_allow_html=True)
'''
    app=app.replace(marker,marker+css,1); changed=True

if not changed:
    print('Already applied mockup-grade UI v7.6')
else:
    APP.write_text(app,encoding='utf-8')
    LAB.write_text(lab,encoding='utf-8')
    print('Applied mockup-grade UI v7.6')
