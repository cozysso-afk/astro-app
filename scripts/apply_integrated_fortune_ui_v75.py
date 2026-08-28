from pathlib import Path

APP=Path('app.py')
LAB=Path('fortune_lab_v71.py')
app=APP.read_text(encoding='utf-8')
lab=LAB.read_text(encoding='utf-8')
changed=False

# 1) Rename the user-facing navigation value everywhere in app.py so routing,
# session state, and push navigation all agree on the same label.
if '포춘랩' in app:
    app=app.replace('포춘랩','통합운세')
    changed=True

# 2) Fortune Lab surface language -> clear Korean product language.
if 'FORTUNE_LAB_VERSION = "v0.1.7"' in lab:
    lab=lab.replace('FORTUNE_LAB_VERSION = "v0.1.7"','FORTUNE_LAB_VERSION = "v0.1.8"',1)
    changed=True
elif 'FORTUNE_LAB_VERSION = "v0.1.8"' not in lab:
    raise SystemExit('fortune version marker not found')

repls=[
    ('<div class="fortune-kicker">FORTUNE LAB</div>','<div class="fortune-kicker">INTEGRATED FORTUNE</div>'),
    ('<div class="fortune-title">운의 흐름을 겹쳐보기</div>','<div class="fortune-title">통합운세</div>'),
    ('<div class="fortune-lead">서양점성술의 시간축과 사주 대운·세운·월운, 태국 출생층을 한 화면에서 비교해.</div>',
     '<div class="fortune-lead">서양점성술·사주명리·태국점성술을 각각 계산한 뒤, 같은 기간에서 겹치는 흐름과 차이를 한눈에 비교해.</div>'),
    ('별빛의 운명 FORTUNE LAB의 해석자다.','별빛의 운명 통합운세 해석자다.'),
]
for old,new in repls:
    if old in lab:
        lab=lab.replace(old,new)
        changed=True

# 3) Add a final mobile-polish layer after v7.4. This deliberately targets only
# the main navigation/profile/input surfaces and leaves report data layouts alone.
if 'ASTRO_DESIGN_V75_CSS' not in app:
    marker='st.markdown(ASTRO_DESIGN_V74_CSS, unsafe_allow_html=True)\n'
    if marker not in app:
        raise SystemExit('v7.4 CSS render marker not found')
    css=r'''

# ============================================================
# 0-A5. VISUAL SYSTEM v7.5 · WARM OBSERVATORY POLISH
# ============================================================
ASTRO_DESIGN_V75_CSS = """
<style>
/* Softer paper background with stronger text contrast. */
.stApp{
  background:
    radial-gradient(circle at 10% 2%,rgba(224,184,126,.12),transparent 28%),
    radial-gradient(circle at 94% 18%,rgba(186,142,105,.08),transparent 24%),
    linear-gradient(180deg,#fbf7f0 0%,#f7f0e5 55%,#fbf8f3 100%)!important;
}
.block-container{max-width:760px!important}

/* Profile becomes a deliberate compact summary card. */
.profile-strip{
  background:rgba(255,253,249,.96)!important;
  border:1px solid rgba(141,105,79,.14)!important;
  border-radius:18px!important;
  padding:13px 15px!important;
  margin:9px 0 12px!important;
  color:#51443c!important;
  line-height:1.58!important;
  box-shadow:0 9px 24px rgba(81,58,42,.055)!important;
}
.profile-strip strong{color:#302824!important}

/* Main navigation: true compact segmented cards. */
.astro-nav-label{
  color:#806754!important;
  font-size:.64rem!important;
  font-weight:850!important;
  letter-spacing:.12em!important;
  margin:10px 2px 5px!important;
}
div[class*="st-key-astro_period_nav_group"] button,
div[class*="st-key-astro_tool_nav_group"] button{
  border-radius:13px!important;
  border:1px solid rgba(128,96,73,.14)!important;
  background:rgba(255,253,249,.94)!important;
  color:#625146!important;
  box-shadow:0 5px 14px rgba(74,54,40,.035)!important;
  transition:none!important;
}
div[class*="st-key-astro_period_nav_group"] button[kind="primary"],
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"]{
  background:linear-gradient(135deg,#5a4437,#7b5a45)!important;
  border-color:#654a3c!important;
  color:#fff!important;
  box-shadow:0 8px 18px rgba(72,49,35,.16)!important;
}
div[class*="st-key-astro_period_nav_group"] button[kind="primary"] p,
div[class*="st-key-astro_period_nav_group"] button[kind="primary"] span,
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"] p,
div[class*="st-key-astro_tool_nav_group"] button[kind="primary"] span{color:#fff!important;opacity:1!important}

/* Cleaner form controls. */
[data-baseweb="select"]>div,
[data-testid="stDateInput"] input,
[data-testid="stTimeInput"] input,
[data-testid="stTextInput"] input,
[data-testid="stNumberInput"] input,
[data-testid="stTextArea"] textarea{
  background:rgba(255,253,249,.97)!important;
  border:1px solid rgba(128,96,73,.15)!important;
  box-shadow:none!important;
}
[data-testid="stExpander"]{
  background:rgba(255,253,249,.82)!important;
  border:1px solid rgba(128,96,73,.13)!important;
  border-radius:17px!important;
  overflow:hidden!important;
}

/* Report headings no longer overpower the entire first viewport. */
h1,h2,h3{color:#302824!important;letter-spacing:-.035em!important}
.block-container h3{font-size:1.42rem!important;line-height:1.23!important;margin-top:1.05rem!important}
.fortune-kicker{color:#a06f3e!important;letter-spacing:.16em!important}
.fortune-title{font-size:1.62rem!important;color:#302824!important}
.fortune-lead{color:#74645a!important;max-width:38rem}

/* Secondary captions stay readable instead of disappearing into beige. */
[data-testid="stCaptionContainer"],
[data-testid="stCaptionContainer"] p{color:#89786d!important}

@media(max-width:640px){
  .block-container{padding-left:1rem!important;padding-right:1rem!important;padding-top:.55rem!important}
  .profile-strip{padding:12px 13px!important;border-radius:16px!important}
  div[class*="st-key-astro_period_nav_group"] button,
  div[class*="st-key-astro_tool_nav_group"] button{
    height:37px!important;min-height:37px!important;font-size:.71rem!important;border-radius:11px!important;
  }
  .block-container h3{font-size:1.28rem!important}
  .fortune-title{font-size:1.48rem!important}
}
</style>
"""
st.markdown(ASTRO_DESIGN_V75_CSS, unsafe_allow_html=True)
'''
    app=app.replace(marker,marker+css,1)
    changed=True

# Make the home labels slightly more human-readable without changing route keys.
# Existing period/tool group structure is retained for mobile stability.

if not changed:
    print('Already applied integrated-fortune UI v7.5')
else:
    APP.write_text(app,encoding='utf-8')
    LAB.write_text(lab,encoding='utf-8')
    print('Applied integrated-fortune UI v7.5')
