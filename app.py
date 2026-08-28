import base64
import calendar
import hashlib
import hmac
import html
import json
import math
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time as dt_time, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytz
import streamlit as st
import streamlit.components.v1 as components
import swisseph as swe
from PIL import Image
from scipy.optimize import brentq
from skyfield.api import load, wgs84
from skyfield.framelib import ecliptic_frame
import importlib
import fortune_lab_v71 as fortune_lab_module
fortune_lab_module = importlib.reload(fortune_lab_module)
render_fortune_lab = fortune_lab_module.render_fortune_lab

try:
    from streamlit_js_eval import streamlit_js_eval
except Exception:
    streamlit_js_eval = None

try:
    import exchange_calendars as xcals
except Exception:
    xcals = None


# ============================================================
# 0. PAGE / DESIGN
# ============================================================
APP_DIR = Path(__file__).resolve().parent
ICON_PATH = APP_DIR / "icon.PNG"
ICON_URL = "https://raw.githubusercontent.com/cozysso-afk/astro-app/main/icon.PNG"

try:
    with Image.open(ICON_PATH) as _page_icon_src:
        _page_icon_src.load()
        PAGE_ICON = _page_icon_src.copy()
except Exception:
    PAGE_ICON = "✨"

st.set_page_config(
    page_title="별빛의 운명 - 고정밀 점성술",
    page_icon=PAGE_ICON,
    layout="centered",
    initial_sidebar_state="collapsed",
)

# config.toml이 없어도 상단 개발자 도구를 최소화합니다.
try:
    st.set_option("client.toolbarMode", "minimal")
except Exception:
    pass

# iOS 홈 화면 아이콘 + Streamlit 관리자 오버레이 best-effort 숨김.
# Manage app 숨김은 Streamlit 공식 API가 아니므로 DOM 변경 시 다시 보일 수 있습니다.
components.html(
    f"""
    <script>
    (() => {{
      try {{
        const d = window.parent.document;
        const head = d.head;
        const upsert = (rel, href, sizes='') => {{
          let el = head.querySelector(`link[rel='${{rel}}']`);
          if (!el) {{ el = d.createElement('link'); el.rel = rel; head.appendChild(el); }}
          el.href = href;
          if (sizes) el.sizes = sizes;
        }};
        upsert('icon', '{ICON_URL}');
        upsert('shortcut icon', '{ICON_URL}');
        upsert('apple-touch-icon', '{ICON_URL}', '180x180');

        let title = head.querySelector("meta[name='apple-mobile-web-app-title']");
        if (!title) {{ title = d.createElement('meta'); title.name = 'apple-mobile-web-app-title'; head.appendChild(title); }}
        title.content = '별빛의 운명';

        // Streamlit Community Cloud의 앱 관리자/상단 툴바를 최대한 숨긴다.
        // 공식 API가 아닌 DOM 정리이므로 Streamlit이 구조를 바꾸면 다시 보일 수 있다.
        const cleanupStyleId = 'astro-streamlit-chrome-cleanup';
        if (!head.querySelector('#' + cleanupStyleId)) {{
          const style = d.createElement('style');
          style.id = cleanupStyleId;
          style.textContent = `
            [data-testid="stAppDeployButton"],
            [data-testid="stToolbar"],
            [data-testid="stDecoration"],
            header[data-testid="stHeader"] {{ display:none !important; visibility:hidden !important; }}
            #MainMenu {{ display:none !important; }}
          `;
          head.appendChild(style);
        }}

        const hideManage = () => {{
          // 알려진 test id는 텍스트 검사 없이 바로 숨김.
          d.querySelectorAll('[data-testid="stAppDeployButton"], [data-testid="stToolbar"], header[data-testid="stHeader"]').forEach(el => {{
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
          }});

          // Streamlit 버전에 따라 Manage app이 별도 fixed/sticky wrapper로 렌더될 수 있어
          // 텍스트를 가진 leaf element를 찾고 가장 가까운 고정형 조상까지 숨긴다.
          d.querySelectorAll('button, a, div, span, [role="button"]').forEach(el => {{
            const txt = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            if (!txt || txt.length > 40 || !txt.includes('manage app')) return;
            let node = el;
            let candidate = el;
            for (let i = 0; i < 8 && node; i++, node = node.parentElement) {{
              candidate = node;
              const testId = (node.getAttribute && node.getAttribute('data-testid')) || '';
              const cs = window.parent.getComputedStyle ? window.parent.getComputedStyle(node) : null;
              const pos = cs ? cs.position : '';
              if (testId === 'stAppDeployButton' || pos === 'fixed' || pos === 'sticky') {{
                candidate = node;
                break;
              }}
            }}
            candidate.style.setProperty('display', 'none', 'important');
            candidate.style.setProperty('visibility', 'hidden', 'important');
          }});
        }};
        hideManage();
        const observer = new MutationObserver(hideManage);
        observer.observe(d.body, {{ childList: true, subtree: true, characterData: true }});
        window.parent.setInterval(hideManage, 1200);
      }} catch (e) {{ console.warn('UI cleanup skipped', e); }}
    }})();
    </script>
    """,
    height=0,
    width=0,
)

CUSTOM_CSS = """
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Cormorant+Garamond:wght@500;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    color: #2D3142;
}
.stApp {
    background: linear-gradient(135deg, #FFF5F7 0%, #F5F0FA 50%, #F0F7F7 100%);
    background-attachment: fixed;
}
.block-container { padding-top: 1.15rem; padding-bottom: 4rem; }
#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header [data-testid="stToolbar"] { opacity: .18; }

.top-nav {
    text-align:center; color:#8B7697; font-size:.72rem; letter-spacing:.16em;
    margin-bottom:.25rem;
}
.ast-card {
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(207,190,218,.45);
    border-radius: 18px;
    padding: 16px 17px;
    box-shadow: 0 8px 24px rgba(180,150,190,.10);
    margin-bottom: 12px;
}
.ast-title { font-weight: 800; color:#4A3E56; font-size:1.02rem; margin-bottom:7px; }
.ast-body { color:#5F5767; line-height:1.72; font-size:.92rem; }
.ast-sub { color:#83788B; font-size:.80rem; line-height:1.55; }
.profile-strip {
    background:rgba(255,255,255,.72); border:1px solid rgba(211,190,220,.50);
    border-radius:15px; padding:10px 12px; margin-bottom:10px; font-size:.83rem; line-height:1.55;
}
.score-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin:8px 0 14px; }
.score-card { background:rgba(255,255,255,.84); border:1px solid rgba(202,185,214,.42); border-radius:15px; padding:12px 13px; }
.score-name { font-size:.80rem; font-weight:800; color:#53475E; }
.score-num { font-family:'Cinzel','Pretendard',serif; font-weight:800; font-size:1.55rem; line-height:1.05; color:#806632; margin-top:7px; letter-spacing:-.02em; }
.score-band { display:inline-block; font-size:.68rem; color:#75697C; margin-top:6px; padding:2px 7px; border-radius:999px; background:rgba(240,234,244,.78); }
.topic-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.topic-score { min-width:58px; text-align:right; white-space:nowrap; }
.topic-score-num { font-family:'Cinzel','Pretendard',serif; font-size:1.28rem; line-height:1; font-weight:800; color:#806632; }
.topic-score-band { display:block; margin-top:4px; font-size:.66rem; color:#7F7486; font-weight:700; }
.event-pill { background:rgba(255,255,255,.67); border-left:4px solid rgba(154,123,56,.58); padding:9px 11px; border-radius:9px; margin:7px 0; font-size:.86rem; line-height:1.58; }
.window-card { background:rgba(255,255,255,.75); border:1px solid rgba(196,178,205,.40); border-left:4px solid rgba(154,123,56,.72); border-radius:11px; padding:11px 12px; margin:8px 0; line-height:1.58; font-size:.87rem; }
.window-card.risk { border-left-color:rgba(210,105,105,.78); }
.window-card.love { border-left-color:rgba(201,92,135,.78); }
.window-card.study { border-left-color:rgba(75,113,160,.78); }
.market-closed { border-left:4px solid #A6A0AC; }
.section-kicker { color:#8A7A92; font-size:.77rem; font-weight:700; letter-spacing:.03em; margin:4px 0 8px; }
.period-range { background:rgba(255,255,255,.68); border-radius:13px; padding:10px 12px; margin:5px 0 12px; color:#665C70; font-size:.86rem; }

.timing-strip { margin-top:10px; padding:9px 11px; border-radius:10px; background:rgba(244,239,249,.78); color:#655A70; font-size:.80rem; line-height:1.55; }
.decision-strip { margin-top:8px; padding:9px 11px; border-radius:10px; background:rgba(255,247,250,.88); border-left:3px solid rgba(201,92,135,.52); color:#5D5364; font-size:.82rem; line-height:1.55; }
.ai-overview { background:linear-gradient(135deg,rgba(255,255,255,.95),rgba(246,239,252,.94)); border:1px solid rgba(175,146,198,.44); border-radius:18px; padding:16px; margin:8px 0 16px; box-shadow:0 10px 28px rgba(154,123,175,.09); }
.ai-kicker { color:#8C7899; font-size:.70rem; font-weight:800; letter-spacing:.08em; margin-bottom:5px; }
.ai-head { font-weight:900; color:#4C3D59; font-size:1.04rem; margin-bottom:8px; }
.ai-body { color:#5C5263; font-size:.90rem; line-height:1.76; }
.ai-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:11px; }
.ai-cluster { padding:10px 11px; border-radius:12px; background:rgba(248,244,251,.86); border:1px solid rgba(202,185,214,.34); color:#5F5567; font-size:.80rem; line-height:1.58; }
.ai-cluster strong { color:#51445A; }
.ai-chip { display:inline-block; padding:4px 8px; margin:3px 4px 1px 0; border-radius:999px; background:rgba(236,226,244,.92); color:#675573; font-size:.71rem; font-weight:800; }
.ai-analysis { margin-top:11px; padding:11px 12px; border-radius:12px; background:linear-gradient(135deg,rgba(249,245,252,.96),rgba(255,249,251,.92)); border-left:3px solid rgba(141,113,160,.58); color:#594F60; font-size:.82rem; line-height:1.65; }
.ai-verdict { font-weight:900; color:#493B53; font-size:.88rem; margin-bottom:7px; }
.ai-row { margin-top:5px; }
.ai-label { font-weight:800; color:#7A6587; margin-right:4px; }
.ai-confidence { display:inline-block; margin-top:8px; padding:2px 7px; border-radius:999px; background:rgba(235,228,241,.86); color:#716079; font-size:.68rem; font-weight:800; }
.rule-summary { color:#716778; font-size:.80rem; line-height:1.62; }
.astro-note { background:rgba(255,255,255,.62); border:1px solid rgba(202,185,214,.32); border-radius:12px; padding:9px 11px; margin:6px 0 12px; color:#6B6073; font-size:.80rem; line-height:1.55; }

.stTabs [data-baseweb="tab-list"] { overflow-x:auto; flex-wrap:nowrap; justify-content:flex-start; gap:4px; background:rgba(255,255,255,.62); border-radius:16px; padding:5px; scrollbar-width:none; }
.stTabs [data-baseweb="tab-list"]::-webkit-scrollbar { display:none; }
.stTabs [data-baseweb="tab"] { flex:0 0 auto; white-space:nowrap; border-radius:11px; padding:7px 11px; }
.stTabs [aria-selected="true"] { background:linear-gradient(135deg, rgba(247,201,221,.85), rgba(221,211,247,.90)) !important; color:#4A3E56 !important; font-weight:800 !important; }

@media (max-width:640px) {
    html, body { scroll-padding-bottom: calc(9rem + env(safe-area-inset-bottom)); }
    .block-container {
        padding-left: .9rem;
        padding-right: .9rem;
        padding-top: .7rem;
        padding-bottom: calc(9rem + env(safe-area-inset-bottom));
    }
    .score-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .ast-card { padding:14px 14px; border-radius:16px; }
    .ast-body { font-size:.89rem; line-height:1.68; }
    .stTabs [data-baseweb="tab"] { font-size:.80rem; padding:6px 9px; }
    .ai-grid { grid-template-columns:1fr; }
}
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


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


# ============================================================
# 0-A3. VISUAL SYSTEM v7.3 · NAVIGATION + MONTH TIMELINE
# ============================================================
ASTRO_DESIGN_V73_CSS = """
<style>
.astro-nav-label{
  margin:10px 2px 6px;
  color:#8e745f;
  font-size:.68rem;
  font-weight:850;
  letter-spacing:.12em;
  text-transform:uppercase;
}
.astro-nav-tools{margin-top:5px}

/* Main navigation uses real buttons: no radio circle, no clipped horizontal scroll. */
div[class*="st-key-main_nav_"] button{
  min-height:42px!important;
  padding:.5rem .35rem!important;
  border-radius:13px!important;
  font-size:.80rem!important;
  font-weight:800!important;
  letter-spacing:-.02em!important;
  white-space:nowrap!important;
}
div[class*="st-key-main_nav_"] button[kind="secondary"]{
  background:rgba(255,253,249,.78)!important;
  border:1px solid rgba(126,103,87,.16)!important;
  color:#67564b!important;
  box-shadow:0 4px 12px rgba(75,55,42,.035)!important;
}
div[class*="st-key-main_nav_"] button[kind="primary"]{
  background:linear-gradient(135deg,#55473e,#7b6251)!important;
  color:#fff!important;
  border:1px solid #665247!important;
  box-shadow:0 8px 20px rgba(75,54,42,.16)!important;
}

/* Fortune Lab monthly timeline */
.fortune-month-stack{position:relative;margin:10px 0 18px;padding-left:18px}
.fortune-month-stack:before{
  content:"";position:absolute;left:6px;top:14px;bottom:18px;width:1px;
  background:linear-gradient(#c9a577,rgba(201,165,119,.18));
}
.fortune-month-card{
  position:relative;
  margin:0 0 12px;
  padding:15px 15px 14px;
  border:1px solid rgba(137,108,84,.16);
  border-radius:19px;
  background:rgba(255,253,249,.90);
  box-shadow:0 10px 26px rgba(78,58,43,.07);
}
.fortune-month-card:before{
  content:"";position:absolute;left:-17px;top:20px;width:9px;height:9px;border-radius:50%;
  background:#b68b58;border:3px solid #f7f0e6;box-shadow:0 0 0 1px rgba(147,111,76,.2);
}
.fortune-month-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
.fortune-month-name{font-size:1.02rem;font-weight:900;color:#3d322c;letter-spacing:-.035em}
.fortune-month-period{font-size:.68rem;color:#9a8779;margin-top:2px}
.fortune-month-band{
  flex:0 0 auto;padding:4px 8px;border-radius:999px;background:#f1e5d6;color:#755b45;
  font-size:.68rem;font-weight:800;white-space:nowrap
}
.fortune-month-score{
  display:flex;align-items:flex-end;justify-content:space-between;gap:10px;
  padding:10px 11px;border-radius:13px;background:#f8f1e8;margin-bottom:10px
}
.fortune-month-score span{font-size:.72rem;color:#806e61;font-weight:750}
.fortune-month-score strong{font-family:'Cinzel','Pretendard',serif;font-size:1.45rem;line-height:1;color:#9b7043}
.fortune-month-facts{display:grid;gap:7px}
.fortune-month-fact{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px;align-items:start}
.fortune-month-fact span{font-size:.70rem;color:#958174;font-weight:750}
.fortune-month-fact b{font-size:.79rem;color:#554942;line-height:1.5;font-weight:720}
.fortune-month-days{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}
.fortune-month-day{
  padding:9px 10px;border-radius:12px;background:#fbf7f0;border:1px solid rgba(137,108,84,.10)
}
.fortune-month-day.caution{background:#faf3f0}
.fortune-month-day small{display:block;font-size:.63rem;color:#9b8778;font-weight:800;margin-bottom:4px}
.fortune-month-day span{display:block;font-size:.72rem;color:#5f5148;line-height:1.45;font-weight:680}
.fortune-scope-card{
  padding:12px 13px;margin:8px 0 14px;border-radius:15px;background:rgba(255,252,246,.82);
  border:1px solid rgba(147,113,77,.15);color:#66574e;font-size:.79rem;line-height:1.62
}

@media(max-width:640px){
  div[class*="st-key-main_nav_"] button{min-height:40px!important;font-size:.76rem!important;padding:.42rem .2rem!important}
  .fortune-month-days{grid-template-columns:1fr}
  .fortune-month-fact{grid-template-columns:68px minmax(0,1fr)}
}
</style>
"""
st.markdown(ASTRO_DESIGN_V73_CSS, unsafe_allow_html=True)


# ============================================================
# 0-A4. VISUAL SYSTEM v7.4 · COMPACT MOBILE SEGMENTED NAV
# ============================================================
ASTRO_DESIGN_V74_CSS = """
<style>
/* Only the two primary nav groups are forced to remain 4-up on phones. */
div[class*="st-key-astro_period_nav_group"] [data-testid="stHorizontalBlock"],
div[class*="st-key-astro_tool_nav_group"] [data-testid="stHorizontalBlock"]{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:6px!important;
}
div[class*="st-key-astro_period_nav_group"] [data-testid="column"],
div[class*="st-key-astro_tool_nav_group"] [data-testid="column"]{
  width:auto!important;
  min-width:0!important;
  flex:none!important;
}
div[class*="st-key-astro_period_nav_group"] button,
div[class*="st-key-astro_tool_nav_group"] button{
  width:100%!important;
  min-height:38px!important;
  height:38px!important;
  padding:0 4px!important;
  border-radius:12px!important;
  font-size:.76rem!important;
  font-weight:800!important;
  line-height:1!important;
  white-space:nowrap!important;
  box-shadow:none!important;
}
.astro-nav-label{
  margin:9px 2px 5px!important;
  font-size:.62rem!important;
  letter-spacing:.10em!important;
  color:#9a806d!important;
}
.astro-nav-tools{margin-top:7px!important}
@media(max-width:640px){
  div[class*="st-key-astro_period_nav_group"],
  div[class*="st-key-astro_tool_nav_group"]{margin-bottom:0!important}
  div[class*="st-key-astro_period_nav_group"] button,
  div[class*="st-key-astro_tool_nav_group"] button{
    min-height:36px!important;height:36px!important;font-size:.72rem!important;border-radius:11px!important;
  }
}
</style>
"""
st.markdown(ASTRO_DESIGN_V74_CSS, unsafe_allow_html=True)


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


# ============================================================
# 0-A6. VISUAL SYSTEM v7.6 · MOCKUP-GRADE CELESTIAL MOBILE UI
# ============================================================
ASTRO_DESIGN_V76_CSS = """
<style>
:root{--obs-paper:#fffdf9;--obs-brown:#6c4934;--obs-gold:#c18a45;--obs-line:rgba(112,78,54,.13);--obs-shadow:0 14px 35px rgba(76,51,34,.075)}
.stApp{background:radial-gradient(circle at 15% 0%,rgba(235,196,132,.17),transparent 30%),radial-gradient(circle at 100% 24%,rgba(210,169,129,.10),transparent 27%),linear-gradient(180deg,#fbf8f1 0%,#f7efe4 58%,#fcfaf6 100%)!important}
.block-container{max-width:720px!important;padding-top:.65rem!important}
.astro-hero-v76{position:relative!important;overflow:hidden!important;margin:6px 0 12px!important;padding:24px 20px 22px!important;border:1px solid rgba(184,137,81,.17)!important;border-radius:27px!important;background:radial-gradient(circle at 89% 18%,rgba(224,183,111,.18),transparent 21%),radial-gradient(circle at 12% 85%,rgba(244,222,184,.34),transparent 28%),linear-gradient(135deg,rgba(255,253,248,.99),rgba(249,238,219,.94))!important;box-shadow:0 18px 44px rgba(91,62,39,.085)!important}
.astro-hero-v76:after{content:"";position:absolute;right:-55px;top:-76px;width:185px;height:185px;border-radius:50%;border:1px solid rgba(190,143,79,.20);box-shadow:0 0 0 18px rgba(201,155,93,.035),0 0 0 38px rgba(201,155,93,.025)}
.astro-hero-orbit{position:absolute;border:1px solid rgba(186,139,78,.17);border-radius:50%;pointer-events:none}.astro-hero-orbit.orbit-a{width:210px;height:86px;right:-55px;top:35px;transform:rotate(-18deg)}.astro-hero-orbit.orbit-b{width:120px;height:120px;left:-72px;bottom:-70px}
.astro-hero-star{position:absolute;color:#c49658;opacity:.72;pointer-events:none}.astro-hero-star.star-a{right:66px;top:30px;font-size:1.08rem}.astro-hero-star.star-b{right:35px;bottom:25px;font-size:.82rem}
.astro-hero-kicker{color:#a17b54!important;font-size:.61rem!important;letter-spacing:.19em!important;margin-bottom:9px!important}.astro-hero-row{gap:13px!important;position:relative;z-index:2}.astro-hero-sigil{width:48px!important;height:48px!important;background:linear-gradient(145deg,#fffdf7,#efd4a9)!important;border-color:rgba(184,136,70,.22)!important;color:#a86f2f!important;box-shadow:0 10px 26px rgba(127,86,45,.12)!important}.astro-hero-title{font-size:2.02rem!important;color:#3b281f!important}.astro-title-spark{color:#c18a45;font-size:.72em}.astro-hero-sub{color:#7d685b!important;font-size:.76rem!important}
.profile-strip,[data-testid="stExpander"]{background:rgba(255,253,249,.96)!important;border:1px solid var(--obs-line)!important;box-shadow:var(--obs-shadow)!important;border-radius:18px!important}
[data-testid="stDateInput"] input,[data-baseweb="select"]>div,[data-testid="stTextInput"] input,[data-testid="stTimeInput"] input,[data-testid="stTextArea"] textarea,[data-testid="stNumberInput"] input{background:rgba(255,254,251,.98)!important;border:1px solid rgba(120,86,61,.13)!important;border-radius:13px!important;box-shadow:0 5px 15px rgba(75,51,34,.025)!important}
div[class*="st-key-astro_period_nav_group"] [data-testid="stHorizontalBlock"]{gap:8px!important}div[class*="st-key-astro_period_nav_group"] button{height:43px!important;min-height:43px!important;border-radius:13px!important;font-size:.76rem!important;font-weight:800!important;background:rgba(255,253,249,.96)!important;border:1px solid var(--obs-line)!important;color:#665247!important;box-shadow:0 5px 15px rgba(76,51,34,.035)!important}div[class*="st-key-astro_period_nav_group"] button[kind="primary"]{background:linear-gradient(135deg,#65452f,#8a613f)!important;color:#fff!important;border-color:#725038!important;box-shadow:0 10px 22px rgba(91,60,37,.18)!important}
div[class*="st-key-astro_tool_nav_group"] [data-testid="stHorizontalBlock"]{gap:8px!important}div[class*="st-key-astro_tool_nav_group"] button{height:64px!important;min-height:64px!important;border-radius:16px!important;font-size:.75rem!important;font-weight:850!important;background:rgba(255,253,249,.97)!important;border:1px solid rgba(120,86,61,.13)!important;color:#514038!important;box-shadow:0 9px 23px rgba(76,51,34,.055)!important;padding:0 5px!important}div[class*="st-key-astro_tool_nav_group"] button[kind="primary"]{background:linear-gradient(145deg,#fff8ea,#f0d6ae)!important;color:#553c2b!important;border:1.5px solid rgba(190,132,61,.55)!important;box-shadow:0 12px 28px rgba(132,87,42,.12)!important}div[class*="st-key-astro_tool_nav_group"] button[kind="primary"] p,div[class*="st-key-astro_tool_nav_group"] button[kind="primary"] span{color:#553c2b!important}
.astro-nav-label{font-size:.64rem!important;color:#856955!important;letter-spacing:.10em!important;margin:13px 2px 6px!important}.astro-nav-tools{margin-top:11px!important}
.fortune-page-head{display:flex;align-items:center;gap:13px;margin:9px 0 12px;padding:16px;border-radius:20px;border:1px solid rgba(120,86,61,.13);background:rgba(255,253,249,.94);box-shadow:var(--obs-shadow)}.fortune-page-icon{width:43px;height:43px;flex:0 0 43px;border-radius:14px;display:grid;place-items:center;font-size:1.25rem;font-weight:900;background:#fff7e8;color:#ad7431;border:1px solid rgba(188,131,63,.18)}.compat-head .fortune-page-icon{background:#fff0f2;color:#d65d77;border-color:rgba(214,93,119,.15)}.fortune-page-head .fortune-kicker{margin:0 0 2px!important;font-size:.58rem!important}.fortune-page-head .fortune-title{margin:0!important;font-size:1.38rem!important;line-height:1.18!important}.fortune-page-head .fortune-lead{margin:4px 0 0!important;font-size:.78rem!important;line-height:1.48!important}
.compat-tab-label{font-size:.72rem;font-weight:850;color:#6d5749;margin:13px 1px 6px}div[class*="st-key-fortune_lab_compat_topic"] [role="radiogroup"]{width:100%!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;padding:4px!important;background:rgba(246,237,225,.72)!important;border:1px solid rgba(124,88,61,.11)!important;border-radius:15px!important;overflow:hidden!important}div[class*="st-key-fortune_lab_compat_topic"] [role="radiogroup"] label{width:100%!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:11px!important;padding:8px 4px!important}div[class*="st-key-fortune_lab_compat_topic"] [role="radiogroup"] label:has(input:checked){background:#fffdf9!important;color:#68482f!important;box-shadow:0 5px 14px rgba(89,59,36,.08)!important}div[class*="st-key-fortune_lab_compat_topic"] [data-testid="stWidgetLabel"]{display:none!important}
.stButton>button[kind="primary"]{border-radius:14px!important;background:linear-gradient(135deg,#68462f,#8e633f)!important;color:#fff!important;border:0!important;min-height:48px!important;box-shadow:0 11px 26px rgba(91,59,36,.18)!important}.stButton>button[kind="primary"] p,.stButton>button[kind="primary"] span{color:#fff!important}
@media(max-width:640px){.block-container{padding-left:.92rem!important;padding-right:.92rem!important;padding-top:.45rem!important}.astro-hero-v76{padding:21px 17px 20px!important;border-radius:23px!important}.astro-hero-title{font-size:1.78rem!important}.astro-hero-sigil{width:44px!important;height:44px!important}div[class*="st-key-astro_period_nav_group"] button{height:41px!important;min-height:41px!important;font-size:.70rem!important}div[class*="st-key-astro_tool_nav_group"] button{height:61px!important;min-height:61px!important;font-size:.68rem!important;padding:0 2px!important}.fortune-page-head{padding:14px 13px;border-radius:17px}.fortune-page-icon{width:39px;height:39px;flex-basis:39px;border-radius:12px}.fortune-page-head .fortune-title{font-size:1.23rem!important}.fortune-page-head .fortune-lead{font-size:.73rem!important}}
</style>
"""
st.markdown(ASTRO_DESIGN_V76_CSS, unsafe_allow_html=True)

# ============================================================
# 0-B. PRIVATE PIN LOCK / 30-DAY REMEMBER-ME (LOCAL STORAGE PRIMARY)
# ============================================================
# Streamlit Community Cloud는 프록시 계층에서 대부분의 사용자 정의 cookie를
# st.context.cookies에 전달하지 않는 경우가 있어 cookie 기반 자동로그인이 풀릴 수 있다.
# V6.2.1부터는 브라우저 localStorage를 Streamlit custom component로 직접 읽고/쓰는
# 방식을 1순위로 사용한다. 기존 first-party cookie는 self-host/local 환경용 보조수단.
REMEMBER_COOKIE_NAME = "astro_remember_v2"
LEGACY_REMEMBER_COOKIE_NAME = "astro_remember_v1"
REMEMBER_STORAGE_NAME = "astro_remember_local_v1"
REMEMBER_DAYS = 30
REMEMBER_TOKEN_AUDIENCE = "cozysso-astro-app"
REMEMBER_EMPTY_SENTINEL = "__ASTRO_REMEMBER_EMPTY__"


def _secret_text(key, default=""):
    try:
        value = st.secrets.get(key, default)
    except Exception:
        value = default
    return str(value).strip()


def _configured_app_pin():
    return _secret_text("APP_PIN", "")


def _remember_secret():
    return _secret_text("REMEMBER_ME_SECRET", "")


def _b64url_encode(raw):
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def _pin_fingerprint(pin):
    # PIN 원문은 저장하지 않음. PIN이 바뀌면 기존 자동로그인 토큰도 무효화.
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()[:20]


def _make_remember_token(pin, signing_secret, now_ts=None):
    now_ts = int(time.time() if now_ts is None else now_ts)
    payload = {
        "aud": REMEMBER_TOKEN_AUDIENCE,
        "v": 2,
        "iat": now_ts,
        "exp": now_ts + REMEMBER_DAYS * 86400,
        "pin_fp": _pin_fingerprint(pin),
        "nonce": secrets.token_urlsafe(12),
    }
    payload_bytes = json.dumps(
        payload,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = hmac.new(
        signing_secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).digest()
    return f"{_b64url_encode(payload_bytes)}.{_b64url_encode(signature)}"


def _verify_remember_token(token, pin, signing_secret, now_ts=None):
    if not token or not signing_secret or len(signing_secret) < 32:
        return False
    try:
        payload_part, sig_part = token.split(".", 1)
        payload_bytes = _b64url_decode(payload_part)
        supplied_sig = _b64url_decode(sig_part)
        expected_sig = hmac.new(
            signing_secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(supplied_sig, expected_sig):
            return False

        payload = json.loads(payload_bytes.decode("utf-8"))
        now_ts = int(time.time() if now_ts is None else now_ts)

        if payload.get("aud") != REMEMBER_TOKEN_AUDIENCE:
            return False
        if payload.get("v") != 2:
            return False
        if payload.get("pin_fp") != _pin_fingerprint(pin):
            return False

        iat = int(payload.get("iat", 0))
        exp = int(payload.get("exp", 0))
        if iat <= 0 or exp <= iat:
            return False
        if iat > now_ts + 300:
            return False
        if exp <= now_ts:
            return False
        if exp - iat > (REMEMBER_DAYS * 86400 + 300):
            return False
        return True
    except Exception:
        return False


def _request_cookie(name):
    """보조수단: self-host/local 환경에서 최초 요청 cookie를 읽는다."""
    try:
        cookies = st.context.cookies
        value = cookies.get(name, "")
        return str(value or "").strip()
    except Exception:
        return ""


def _emit_cookie_write(token):
    """보조수단: 실제 앱 문서에 first-party cookie도 함께 기록한다."""
    cookie_name_js = json.dumps(REMEMBER_COOKIE_NAME)
    legacy_name_js = json.dumps(LEGACY_REMEMBER_COOKIE_NAME)
    token_js = json.dumps(token)
    max_age = REMEMBER_DAYS * 86400
    components.html(
        f"""
        <script>
        (() => {{
          try {{
            const d = window.parent.document;
            const name = {cookie_name_js};
            const legacy = {legacy_name_js};
            const token = {token_js};
            d.cookie = legacy + '=; Path=/; Max-Age=0; SameSite=Lax; Secure';
            d.cookie = name + '=' + token + '; Path=/; Max-Age={max_age}; SameSite=Lax; Secure';
          }} catch (e) {{
            console.warn('remember-cookie backup write skipped', e);
          }}
        }})();
        </script>
        """,
        height=0,
        width=0,
    )


def _emit_cookie_delete(reload_after=False):
    cookie_name_js = json.dumps(REMEMBER_COOKIE_NAME)
    legacy_name_js = json.dumps(LEGACY_REMEMBER_COOKIE_NAME)
    reload_js = "window.parent.setTimeout(() => window.parent.location.reload(), 180);" if reload_after else ""
    components.html(
        f"""
        <script>
        (() => {{
          try {{
            const d = window.parent.document;
            const name = {cookie_name_js};
            const legacy = {legacy_name_js};
            d.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax; Secure';
            d.cookie = legacy + '=; Path=/; Max-Age=0; SameSite=Lax; Secure';
            {reload_js}
          }} catch (e) {{
            console.warn('remember-cookie backup delete skipped', e);
          }}
        }})();
        </script>
        """,
        height=0,
        width=0,
    )


def _storage_epoch():
    return int(st.session_state.get("_astro_storage_epoch", 0) or 0)


def _read_local_remember_token():
    """
    브라우저 localStorage를 component frontend에서 직접 읽어 Python으로 반환.
    None = component 응답 대기 중, "" = 저장 토큰 없음.
    """
    if streamlit_js_eval is None:
        return ""
    storage_name_js = json.dumps(REMEMBER_STORAGE_NAME)
    expression = (
        "(()=>{"
        f"const v=localStorage.getItem({storage_name_js});"
        f"return v===null?{json.dumps(REMEMBER_EMPTY_SENTINEL)}:v;"
        "})()"
    )
    value = streamlit_js_eval(
        js_expressions=expression,
        key=f"astro_remember_ls_read_{_storage_epoch()}",
    )
    if value is None:
        return None
    value = str(value or "").strip()
    if value == REMEMBER_EMPTY_SENTINEL:
        return ""
    return value


def _write_local_remember_token(token):
    """localStorage 기록 완료 여부를 'ok'/'fail'로 되돌려 저장 경합을 막는다."""
    if streamlit_js_eval is None:
        return "unavailable"
    storage_name_js = json.dumps(REMEMBER_STORAGE_NAME)
    token_js = json.dumps(token)
    expression = (
        "(()=>{"
        f"localStorage.setItem({storage_name_js},{token_js});"
        f"return localStorage.getItem({storage_name_js})==={token_js}?'ok':'fail';"
        "})()"
    )
    token_fp = hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]
    value = streamlit_js_eval(
        js_expressions=expression,
        key=f"astro_remember_ls_write_{token_fp}",
    )
    if value is None:
        return None
    return str(value)


def _delete_local_remember_token(nonce):
    if streamlit_js_eval is None:
        return "unavailable"
    storage_name_js = json.dumps(REMEMBER_STORAGE_NAME)
    expression = (
        "(()=>{"
        f"localStorage.removeItem({storage_name_js});"
        f"return localStorage.getItem({storage_name_js})===null?'ok':'fail';"
        "})()"
    )
    value = streamlit_js_eval(
        js_expressions=expression,
        key=f"astro_remember_ls_delete_{nonce}",
    )
    if value is None:
        return None
    return str(value)


def _render_auth_wait(message):
    st.markdown("<div style='text-align:center;font-size:2.2rem;margin-top:7vh'>🌙</div>", unsafe_allow_html=True)
    st.markdown("<h3 style='text-align:center;color:#4A3E56'>별빛의 운명</h3>", unsafe_allow_html=True)
    st.caption(message)


def _flush_pending_local_write():
    token = str(st.session_state.get("_astro_pending_remember_token", "") or "").strip()
    if not token:
        return True

    result = _write_local_remember_token(token)
    if result is None:
        _render_auth_wait("이 기기 30일 자동 로그인을 저장하는 중이야…")
        st.stop()

    st.session_state.pop("_astro_pending_remember_token", None)
    if result == "ok":
        st.session_state["_astro_remember_storage_written"] = True
        _emit_cookie_write(token)  # self-host/local용 보조
        return True

    st.session_state["_astro_remember_storage_written"] = False
    st.session_state["_astro_remember_write_failed"] = True
    return False


def _process_pending_logout():
    nonce = str(st.session_state.get("_astro_pending_logout_nonce", "") or "").strip()
    if not nonce:
        return False

    result = _delete_local_remember_token(nonce)
    if result is None:
        _render_auth_wait("이 기기의 자동 로그인 정보를 지우는 중이야…")
        st.stop()

    _emit_cookie_delete(reload_after=False)
    st.session_state.pop("_astro_pending_logout_nonce", None)
    st.session_state["_astro_storage_epoch"] = _storage_epoch() + 1
    st.session_state["_astro_unlocked"] = False
    st.session_state["_astro_unlocked_via_storage"] = False
    st.session_state["_astro_remember_storage_written"] = False
    st.rerun()


def _try_persistent_unlock(configured_pin, signing_secret):
    if not configured_pin or not signing_secret or len(signing_secret) < 32:
        return False

    # 1순위: Streamlit Cloud proxy를 거치지 않는 브라우저 localStorage component.
    if streamlit_js_eval is not None:
        token = _read_local_remember_token()
        if token is None:
            return None  # component 응답 대기
        if token:
            if _verify_remember_token(token, configured_pin, signing_secret):
                st.session_state["_astro_unlocked"] = True
                st.session_state["_astro_unlocked_via_storage"] = True
                st.session_state["_astro_remember_storage_written"] = True
                return True
            # 만료/변조/PIN 변경 토큰은 지울 준비.
            st.session_state["_astro_pending_logout_nonce"] = "invalid_" + secrets.token_hex(4)
            return False

    # 2순위: self-host/local에서는 st.context cookie가 보일 수 있으므로 기존 토큰도 살림.
    token = _request_cookie(REMEMBER_COOKIE_NAME)
    if token and _verify_remember_token(token, configured_pin, signing_secret):
        st.session_state["_astro_unlocked"] = True
        st.session_state["_astro_unlocked_via_storage"] = True
        st.session_state["_astro_remember_storage_written"] = True
        return True

    return False


def require_app_unlock():
    # 명시적 로그아웃/잘못된 토큰 삭제를 인증 검사보다 먼저 처리.
    if st.session_state.get("_astro_pending_logout_nonce"):
        _process_pending_logout()

    if st.session_state.get("_astro_unlocked", False):
        _flush_pending_local_write()
        return

    configured_pin = _configured_app_pin()
    signing_secret = _remember_secret()

    # GitHub Actions의 headless browser는 streamlit_js_eval localStorage component가
    # 응답하지 않는 환경이 있을 수 있다. automation=1은 자동로그인 조회만 건너뛰며
    # PIN 검증 자체는 그대로 유지한다.
    automation_value = st.query_params.get("automation", "")
    if isinstance(automation_value, (list, tuple)):
        automation_value = automation_value[0] if automation_value else ""
    automation_mode = str(automation_value or "").strip() == "1"

    if automation_mode:
        persistent_state = False
    else:
        persistent_state = _try_persistent_unlock(configured_pin, signing_secret)
        if persistent_state is None:
            _render_auth_wait("이 기기의 자동 로그인 정보를 확인하는 중이야…")
            st.stop()
        if persistent_state is True:
            return
        if st.session_state.get("_astro_pending_logout_nonce"):
            _process_pending_logout()

    st.markdown("<div style='text-align:center;font-size:2.4rem;margin-top:7vh'>🌙</div>", unsafe_allow_html=True)
    st.markdown("<h2 style='text-align:center;color:#4A3E56'>별빛의 운명</h2>", unsafe_allow_html=True)
    st.caption("개인 운세 데이터 보호를 위해 PIN을 입력해 주세요.")

    if not configured_pin:
        st.warning("Streamlit Secrets에 APP_PIN을 먼저 설정해 주세요.")
        st.code('APP_PIN = "6자리 이상 PIN"', language="toml")
        st.stop()
    if len(configured_pin) < 6:
        st.error("APP_PIN은 6자리 이상으로 설정해 주세요.")
        st.stop()

    remember_enabled = (not automation_mode) and streamlit_js_eval is not None and len(signing_secret) >= 32
    if not remember_enabled:
        st.info(
            "📱 30일 로그인 유지를 쓰려면 streamlit_js_eval 설치와 "
            "REMEMBER_ME_SECRET(32자 이상)이 필요해."
        )

    if st.session_state.pop("_astro_remember_write_failed", False):
        st.warning("자동 로그인 저장을 완료하지 못했어. PIN 로그인 자체는 정상이고, 다음 배포에서 저장 기능을 다시 확인해.")

    now = time.time()
    blocked_until = float(st.session_state.get("_astro_lock_until", 0.0) or 0.0)
    if now < blocked_until:
        st.error(f"PIN 입력 실패가 누적되어 약 {int(blocked_until-now)+1}초 동안 잠겼습니다.")
        st.stop()

    with st.form("astro_private_pin_form", clear_on_submit=True):
        entered_pin = st.text_input(
            "PIN",
            type="password",
            label_visibility="collapsed",
            placeholder="PIN 입력",
        )
        remember_device = st.checkbox(
            f"이 기기에서 {REMEMBER_DAYS}일 동안 로그인 유지",
            value=True,
            disabled=not remember_enabled,
            help="개인 기기에서만 사용해. 공용 기기에서는 체크를 꺼두는 게 좋아.",
        )
        submitted = st.form_submit_button("🌙 별빛의 운명 열기", use_container_width=True)

    if submitted:
        if hmac.compare_digest(entered_pin.strip(), configured_pin):
            st.session_state["_astro_unlocked"] = True
            st.session_state["_astro_pin_failures"] = 0
            st.session_state["_astro_lock_until"] = 0.0
            st.session_state["_astro_unlocked_via_storage"] = False
            st.session_state["_astro_remember_storage_written"] = False

            if remember_device and remember_enabled:
                st.session_state["_astro_pending_remember_token"] = _make_remember_token(
                    configured_pin,
                    signing_secret,
                )
            else:
                st.session_state.pop("_astro_pending_remember_token", None)
            st.rerun()
        else:
            failures = int(st.session_state.get("_astro_pin_failures", 0)) + 1
            if failures >= 5:
                st.session_state["_astro_pin_failures"] = 0
                st.session_state["_astro_lock_until"] = time.time() + 30
                st.error("PIN을 5회 틀려 30초 동안 잠겼습니다.")
            else:
                st.session_state["_astro_pin_failures"] = failures
                st.error(f"PIN이 맞지 않습니다. 잠기기까지 {5-failures}회 남았습니다.")
    st.stop()


require_app_unlock()

with st.sidebar:
    if (
        st.session_state.get("_astro_unlocked_via_storage", False)
        or st.session_state.get("_astro_remember_storage_written", False)
    ):
        st.caption("✅ 이 기기 30일 자동 로그인 사용 중")

    if st.button("🔒 이 기기에서 로그아웃", use_container_width=True):
        st.session_state["_astro_pending_logout_nonce"] = secrets.token_hex(8)
        st.session_state["_astro_unlocked"] = False
        st.session_state["_astro_unlocked_via_storage"] = False
        st.session_state["_astro_remember_storage_written"] = False
        st.session_state.pop("_astro_pending_remember_token", None)
        st.rerun()

# ============================================================
# 1. CONSTANTS
# ============================================================
KST = pytz.timezone("Asia/Seoul")
UTC = pytz.UTC
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]
SIGNS_KO = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리","천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"]

PLANET_KEYS = {
    "Sun": ("sun",), "Moon": ("moon",),
    "Mercury": ("mercury", "mercury barycenter"),
    "Venus": ("venus", "venus barycenter"),
    "Mars": ("mars", "mars barycenter"),
    "Jupiter": ("jupiter", "jupiter barycenter"),
    "Saturn": ("saturn", "saturn barycenter"),
    "Uranus": ("uranus", "uranus barycenter"),
    "Neptune": ("neptune", "neptune barycenter"),
    "Pluto": ("pluto", "pluto barycenter"),
}
PLANET_KO = {"Sun":"태양","Moon":"달","Mercury":"수성","Venus":"금성","Mars":"화성","Jupiter":"목성","Saturn":"토성","Uranus":"천왕성","Neptune":"해왕성","Pluto":"명왕성","ASC":"ASC","MC":"MC","Vertex":"Vertex","PoF":"행운점"}

KOREA_BIRTHPLACES = {
    "전라남도 여수시": (34.7604,127.6622), "전라남도 순천시": (34.9507,127.4872), "전라남도 광양시": (34.9407,127.6959),
    "광주광역시": (35.1595,126.8526), "전북특별자치도 전주시": (35.8242,127.1480), "전북특별자치도 군산시": (35.9677,126.7366),
    "서울특별시": (37.5665,126.9780), "부산광역시": (35.1796,129.0756), "대구광역시": (35.8714,128.6014),
    "인천광역시": (37.4563,126.7052), "대전광역시": (36.3504,127.3845), "울산광역시": (35.5384,129.3114),
    "세종특별자치시": (36.4800,127.2890), "경기도 수원시": (37.2636,127.0286), "경기도 성남시": (37.4200,127.1265),
    "경기도 고양시": (37.6584,126.8320), "경기도 용인시": (37.2411,127.1776), "강원특별자치도 춘천시": (37.8813,127.7300),
    "강원특별자치도 강릉시": (37.7519,128.8761), "충청북도 청주시": (36.6424,127.4890), "충청남도 천안시": (36.8151,127.1139),
    "충청남도 공주시": (36.4465,127.1190), "경상북도 포항시": (36.0190,129.3435), "경상북도 경주시": (35.8562,129.2247),
    "경상남도 창원시": (35.2279,128.6811), "경상남도 진주시": (35.1800,128.1076), "경상남도 통영시": (34.8544,128.4332),
    "제주특별자치도 제주시": (33.4996,126.5312), "제주특별자치도 서귀포시": (33.2541,126.5601),
}

TRADITIONAL_RULER_BY_SIGN = {0:"Mars",1:"Venus",2:"Mercury",3:"Moon",4:"Sun",5:"Mercury",6:"Venus",7:"Mars",8:"Jupiter",9:"Saturn",10:"Saturn",11:"Jupiter"}

ASPECTS = {
    "합": {"angle":0.0,"activation":1.00,"polarity":0.00},
    "육십분위": {"angle":60.0,"activation":0.72,"polarity":0.55},
    "사분위": {"angle":90.0,"activation":0.90,"polarity":-0.55},
    "삼분위": {"angle":120.0,"activation":0.82,"polarity":0.65},
    "충": {"angle":180.0,"activation":1.00,"polarity":-0.45},
}
EXACT_ORB = 0.02
LAYER_BY_TRANSIT = {"Moon":"일일","Sun":"중기","Mercury":"중기","Venus":"중기","Mars":"중기","Jupiter":"장기","Saturn":"장기","Uranus":"장기","Neptune":"장기","Pluto":"장기"}
PLANET_TONE = {"Sun":0.15,"Moon":0.05,"Mercury":0.00,"Venus":0.45,"Mars":-0.25,"Jupiter":0.50,"Saturn":-0.45,"Uranus":-0.15,"Neptune":-0.10,"Pluto":-0.25,"ASC":0.0,"MC":0.0}

# Whole Sign = 주 기준, Placidus = 독립 보조 신호.
TOPIC_SPECS = {
    "금전": {"icon":"💵","targets":{"Venus":1.0,"Jupiter":.90,"Mercury":.65,"Saturn":.50,"Moon":.25,"MC":.30},"transits":{"Venus":1.0,"Jupiter":.95,"Mercury":.70,"Saturn":.55,"Mars":.40,"Moon":.35,"Uranus":.35},"houses":{2:1.0,8:.70,11:.80,10:.30},"ruler_houses":[2,8,11]},
    "투자심리": {"icon":"📈","targets":{"Mercury":.90,"Mars":.80,"Jupiter":.75,"Saturn":.70,"Uranus":.65,"Moon":.40},"transits":{"Mercury":.90,"Mars":.85,"Jupiter":.80,"Saturn":.75,"Uranus":.75,"Moon":.55,"Venus":.45},"houses":{2:.95,5:.80,8:.75,11:.85},"ruler_houses":[2,5,8,11]},
    "학업": {"icon":"📚","targets":{"Mercury":1.0,"Saturn":.80,"Sun":.55,"Mars":.45,"Moon":.35,"MC":.25},"transits":{"Mercury":1.0,"Saturn":.75,"Mars":.55,"Sun":.50,"Moon":.45,"Jupiter":.35},"houses":{3:1.0,6:.80,9:1.0,10:.30},"ruler_houses":[3,6,9]},
    "시험": {"icon":"📝","targets":{"Mercury":1.0,"Jupiter":.80,"Saturn":.85,"Mars":.55,"Moon":.45,"Sun":.45,"MC":.45},"transits":{"Mercury":1.0,"Jupiter":.75,"Saturn":.85,"Mars":.60,"Moon":.55,"Sun":.40},"houses":{3:.85,6:.65,9:1.0,10:.75},"ruler_houses":[3,9,10]},
    "직장": {"icon":"💼","targets":{"MC":1.0,"Sun":.85,"Saturn":.90,"Mercury":.70,"Jupiter":.70,"Mars":.55,"Moon":.30},"transits":{"Saturn":.90,"Jupiter":.85,"Sun":.70,"Mercury":.70,"Mars":.65,"Uranus":.45,"Moon":.30},"houses":{6:.90,10:1.0,2:.45,11:.40},"ruler_houses":[6,10]},
    "이직": {"icon":"🚪","targets":{"MC":1.0,"Jupiter":.90,"Uranus":.90,"Mercury":.70,"Saturn":.65,"Venus":.55,"Sun":.45},"transits":{"Jupiter":.95,"Uranus":1.0,"Mercury":.75,"Saturn":.70,"Venus":.60,"Sun":.45,"Mars":.40},"houses":{6:.55,10:1.0,2:.55,9:.65,11:.75},"ruler_houses":[6,10,11]},
    "연애": {"icon":"💖","targets":{"Venus":1.0,"Moon":.85,"Mars":.65,"Sun":.45,"Mercury":.35,"ASC":.45},"transits":{"Venus":1.0,"Moon":.85,"Mars":.65,"Mercury":.50,"Jupiter":.55,"Saturn":.35,"Sun":.35},"houses":{5:1.0,7:1.0,1:.35,8:.40},"ruler_houses":[5,7]},
    "연락": {"icon":"💌","targets":{"Mercury":1.0,"Venus":.70,"Moon":.60,"Sun":.30,"ASC":.30},"transits":{"Mercury":1.0,"Moon":.85,"Venus":.70,"Mars":.35,"Jupiter":.30,"Saturn":.25,"Uranus":.35},"houses":{3:1.0,7:.85,1:.25,11:.30},"ruler_houses":[3,7]},
    "재회": {"icon":"🔄","targets":{"Mercury":.90,"Venus":1.0,"Moon":.80,"Saturn":.65,"Pluto":.55,"ASC":.25},"transits":{"Mercury":.90,"Venus":1.0,"Moon":.75,"Saturn":.65,"Jupiter":.45,"Uranus":.45,"Pluto":.55},"houses":{3:.65,5:.80,7:1.0,8:.45,12:.40},"ruler_houses":[5,7,12]},
    "소식": {"icon":"📨","targets":{"Mercury":1.0,"Moon":.65,"Jupiter":.60,"Uranus":.60,"MC":.45,"Sun":.30},"transits":{"Mercury":1.0,"Moon":.80,"Jupiter":.60,"Uranus":.65,"Saturn":.35,"Sun":.30},"houses":{3:1.0,9:.70,10:.70,11:.70},"ruler_houses":[3,9,10,11]},
    "컨디션": {"icon":"🌿","targets":{"Moon":1.0,"Sun":.85,"Mars":.55,"Saturn":.55,"ASC":.80},"transits":{"Moon":1.0,"Sun":.60,"Mars":.65,"Saturn":.65,"Neptune":.35,"Jupiter":.25},"houses":{1:1.0,6:.90,12:.80},"ruler_houses":[1,6,12]},
}

DISPLAY_LABELS = {"금전":"일반 금전운","학업":"공부운","시험":"시험운","직장":"직장운","이직":"이직운","연애":"연애운","연락":"연락·교류 활성도","재회":"재회·과거인연","소식":"일반 소식·문서운","컨디션":"건강·컨디션운"}

RETURN_CONFIG = {"Moon":{"window_days":35,"step_hours":1.0},"Sun":{"window_days":370,"step_hours":12.0},"Mercury":{"window_days":400,"step_hours":6.0},"Venus":{"window_days":450,"step_hours":12.0},"Mars":{"window_days":800,"step_hours":12.0}}

# ============================================================
# 2. EPHEMERIS / TIME
# ============================================================
@st.cache_resource
def load_ephemeris():
    ts_local = load.timescale()
    try:
        eph_local = load("de440s.bsp")
        return ts_local, eph_local, "DE440s", None
    except Exception as exc:
        eph_local = load("de421.bsp")
        return ts_local, eph_local, "DE421 (fallback)", str(exc)


ts, eph, EPHEMERIS_USED, EPHEMERIS_FALLBACK_REASON = load_ephemeris()
earth = eph["earth"]


def resolve_planet_targets():
    targets, used = {}, {}
    for body, candidates in PLANET_KEYS.items():
        last_error = None
        for candidate in candidates:
            try:
                targets[body] = eph[candidate]
                used[body] = candidate
                break
            except (KeyError, ValueError) as exc:
                last_error = exc
        else:
            raise KeyError(f"{EPHEMERIS_USED}에서 {body} target을 찾지 못했습니다: {last_error}")
    return targets, used


BODY_TARGETS, BODY_TARGET_KEYS = resolve_planet_targets()


def sf_time(dt_aware):
    return ts.from_datetime(dt_aware.astimezone(UTC))


def to_jd_ut(dt_utc):
    dt_utc = dt_utc.astimezone(UTC)
    hour = dt_utc.hour + dt_utc.minute/60 + dt_utc.second/3600 + dt_utc.microsecond/3_600_000_000
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour, swe.GREG_CAL)


def get_tropical_ecliptic_lon(body_name, time_obj):
    apparent = earth.at(time_obj).observe(BODY_TARGETS[body_name]).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return float(lon.degrees % 360.0)


def get_tropical_ecliptic_lons(body_name, time_objs):
    apparent = earth.at(time_objs).observe(BODY_TARGETS[body_name]).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return np.mod(np.asarray(lon.degrees, dtype=float), 360.0)


def get_sign_and_degree(lon):
    lon = lon % 360.0
    return SIGNS_KO[int(lon//30)], lon % 30.0, int(lon//30)


def circular_delta(a,b):
    return (a-b+180.0)%360.0-180.0


def circular_delta_array(a,b):
    return (np.asarray(a)-b+180.0)%360.0-180.0


def angular_separation(a,b):
    return abs(circular_delta(a,b))

# ============================================================
# 3. HOUSES / ANGLES
# ============================================================
def compute_houses(dt_utc, latitude, longitude):
    jd_ut = to_jd_ut(dt_utc)
    placidus_cusps, ascmc = swe.houses_ex(jd_ut, float(latitude), float(longitude), b"P", 0)
    asc, mc, vertex = float(ascmc[0]%360), float(ascmc[1]%360), float(ascmc[3]%360)
    asc_sign = int(asc//30)
    whole_cusps = [float(((asc_sign+i)%12)*30.0) for i in range(12)]
    return {"jd_ut":jd_ut,"asc":asc,"mc":mc,"vertex":vertex,"whole_cusps":whole_cusps,"placidus_cusps":[float(x%360) for x in placidus_cusps]}


def whole_sign_house(lon, natal_asc_lon):
    return (int((lon%360)//30) - int((natal_asc_lon%360)//30)) % 12 + 1


def cusp_house(lon, cusps):
    lon %= 360.0
    for i in range(12):
        start, end = cusps[i]%360.0, cusps[(i+1)%12]%360.0
        span, pos = (end-start)%360.0, (lon-start)%360.0
        if span > 0 and pos < span:
            return i+1
    return None


def house_ruler(house_no, natal_asc_lon):
    asc_sign = int((natal_asc_lon%360)//30)
    return TRADITIONAL_RULER_BY_SIGN[(asc_sign + house_no - 1)%12]


def sun_altitude_degrees(dt_utc, latitude, longitude):
    observer = earth + wgs84.latlon(latitude_degrees=float(latitude), longitude_degrees=float(longitude))
    apparent = observer.at(sf_time(dt_utc)).observe(eph["sun"]).apparent()
    alt, _, _ = apparent.altaz()
    return float(alt.degrees)


def is_day_chart(dt_utc, latitude, longitude):
    return sun_altitude_degrees(dt_utc, latitude, longitude) > 0.0


def calculate_pof(asc_lon, sun_lon, moon_lon, day_chart):
    return (asc_lon + moon_lon - sun_lon) % 360 if day_chart else (asc_lon + sun_lon - moon_lon) % 360

# ============================================================
# 4. ASPECT ENGINE
# ============================================================
def max_orb_for(body, aspect_name):
    # 지나치게 넓은 단일 오브 대신 이동 속도/애스펙트 중요도에 따라 제한.
    if body == "Moon":
        base = 2.6
    elif body in {"Sun","Mercury","Venus","Mars"}:
        base = 3.0
    else:
        base = 2.5
    if aspect_name in {"합","충"}:
        base += 0.35
    return base


def orb_weight(orb, max_orb):
    if orb <= .40: return 1.0
    if orb <= .90: return .86
    if orb <= 1.60: return .68
    if orb <= 2.30: return .50
    if orb <= max_orb: return .32
    return 0.0


def motion_window_hours(body):
    if body == "Moon": return .25
    if body in {"Sun","Mercury","Venus","Mars"}: return 1.0
    return 6.0


def planet_snapshot(body, query_dt_utc):
    h = motion_window_hours(body)
    past, future = query_dt_utc - timedelta(hours=h), query_dt_utc + timedelta(hours=h)
    lon_now = get_tropical_ecliptic_lon(body, sf_time(query_dt_utc))
    lon_past = get_tropical_ecliptic_lon(body, sf_time(past))
    lon_future = get_tropical_ecliptic_lon(body, sf_time(future))
    speed = circular_delta(lon_future, lon_past) / ((2*h)/24.0)
    direction = "순행" if speed > .002 else "역행" if speed < -.002 else "정지권"
    return {"lon":lon_now,"past_lon":lon_past,"future_lon":lon_future,"speed":speed,"direction":direction}


def analyze_aspect_from_snapshot(body, snapshot, natal_lon):
    candidates = []
    for name, spec in ASPECTS.items():
        orb = abs(angular_separation(snapshot["lon"], natal_lon) - spec["angle"])
        max_orb = max_orb_for(body, name)
        if orb > max_orb:
            continue
        orb_past = abs(angular_separation(snapshot["past_lon"], natal_lon)-spec["angle"])
        orb_future = abs(angular_separation(snapshot["future_lon"], natal_lon)-spec["angle"])
        if orb <= EXACT_ORB:
            motion, motion_mult = "정확(Exact)", 1.15
        else:
            slope = orb_future - orb_past
            if slope < -1e-5: motion, motion_mult = "적용(Applying)", 1.08
            elif slope > 1e-5: motion, motion_mult = "분리(Separating)", .92
            else: motion, motion_mult = "변화 미미", 1.0
        candidates.append({"name":name,"angle":spec["angle"],"orb":orb,"orb_weight":orb_weight(orb,max_orb),"motion":motion,"motion_mult":motion_mult,"activation_mult":spec["activation"],"base_polarity":spec["polarity"]})
    return min(candidates, key=lambda x:x["orb"]) if candidates else None


def build_transit_records_subset(query_dt_utc, natal_lons, natal_houses, bodies):
    natal_core = dict(natal_lons)
    natal_core["ASC"], natal_core["MC"] = natal_houses["asc"], natal_houses["mc"]
    snapshots = {body:planet_snapshot(body, query_dt_utc) for body in bodies}
    records = []
    for body, snap in snapshots.items():
        w_house = whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        for target, target_lon in natal_core.items():
            asp = analyze_aspect_from_snapshot(body, snap, target_lon)
            if asp:
                records.append({"layer":LAYER_BY_TRANSIT[body],"transit":body,"target":target,"whole_house":w_house,"placidus_house":p_house,"speed":snap["speed"],"direction":snap["direction"],**asp})
    records.sort(key=lambda r:(r["orb"],-r["orb_weight"]))
    return snapshots, records


def build_transit_records(query_dt_utc, natal_lons, natal_houses):
    return build_transit_records_subset(query_dt_utc, natal_lons, natal_houses, list(PLANET_KEYS))

# ============================================================
# 5. TOPIC SCORING
# ============================================================
def clamp(x, low=0.0, high=100.0):
    return max(low, min(high, x))


def aspect_polarity(record):
    base = record["base_polarity"]
    transit_tone = PLANET_TONE.get(record["transit"],0.0)
    target_tone = PLANET_TONE.get(record["target"],0.0)
    if record["name"] == "합":
        value = .70*transit_tone + .30*target_tone
    else:
        value = .75*base + .30*transit_tone + .10*target_tone
    return max(-1.0,min(1.0,value))


def target_weight_for_topic(spec, target, natal_asc_lon):
    weight = spec["targets"].get(target,0.0)
    if target in PLANET_KEYS:
        rulers = {house_ruler(h,natal_asc_lon) for h in spec["ruler_houses"]}
        if target in rulers:
            weight += .18
    return weight


def direction_modifier(topic, body, direction):
    # 역행은 '무조건 나쁨'이 아니라 재검토/과거 재활성 여부에 따라 다르게 처리.
    if direction == "정지권":
        return 1.06, 0.0
    if direction != "역행":
        return 1.0, 0.0
    if topic == "재회" and body in {"Mercury","Venus"}:
        return 1.10, -0.02
    if topic in {"연락","소식"} and body == "Mercury":
        return 1.02, -0.07
    if topic in {"직장","이직","시험","학업"} and body == "Mercury":
        return .98, -0.05
    return 1.0, -0.02


def score_topic(topic_name, transit_records, snapshots, natal_houses):
    spec = TOPIC_SPECS[topic_name]
    raw_activation = 0.0
    polarity_num = 0.0
    polarity_den = 0.0
    evidences = []
    layers = set()

    for rec in transit_records:
        transit_w = spec["transits"].get(rec["transit"],0.0)
        target_w = target_weight_for_topic(spec, rec["target"], natal_houses["asc"])
        if transit_w <= 0 or target_w <= 0:
            continue
        dir_mult, dir_pol = direction_modifier(topic_name, rec["transit"], rec["direction"])
        contribution = rec["orb_weight"]*rec["motion_mult"]*rec["activation_mult"]*transit_w*target_w*dir_mult
        if contribution <= 0:
            continue
        pol = max(-1.0,min(1.0,aspect_polarity(rec)+dir_pol))
        raw_activation += contribution
        polarity_num += contribution*pol
        polarity_den += contribution
        layers.add(rec["layer"])
        evidences.append({"kind":"aspect","score":contribution,"polarity":pol,"transit":rec["transit"],"target":rec["target"],"aspect":rec["name"],"orb":rec["orb"],"motion":rec["motion"],"direction":rec["direction"]})

    # Whole Sign 주 가중치 + Placidus 독립 보조 가중치.
    for body, snap in snapshots.items():
        transit_w = spec["transits"].get(body,0.0)
        if transit_w <= 0:
            continue
        w_house = whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        w_weight = spec["houses"].get(w_house,0.0)
        p_weight = spec["houses"].get(p_house,0.0) if p_house else 0.0
        house_contrib = .22*transit_w*w_weight + .09*transit_w*p_weight
        if house_contrib <= 0:
            continue
        raw_activation += house_contrib
        layers.add(LAYER_BY_TRANSIT[body])
        evidences.append({"kind":"house","score":house_contrib,"polarity":0.0,"transit":body,"whole_house":w_house,"placidus_house":p_house,"whole_relevant":bool(w_weight),"placidus_relevant":bool(p_weight)})

    strong_count = sum(1 for e in evidences if e["kind"]=="aspect" and e["score"]>=.50)
    stacking_bonus = min(7.0, max(0,len(layers)-1)*2.0 + min(3,strong_count)*.8)
    activation = clamp(raw_activation*18.0 + stacking_bonus)
    if polarity_den:
        favorability = clamp(50.0 + (polarity_num/polarity_den)*40.0)
    else:
        favorability = 50.0
    evidences.sort(key=lambda x:x["score"], reverse=True)
    return {"topic":topic_name,"activation":int(round(activation)),"favorability":int(round(favorability)),"layers":sorted(layers),"evidence":evidences}


def blend_topic(result, activation_weight=.46):
    return int(round(clamp(activation_weight*result["activation"] + (1-activation_weight)*result["favorability"])))


def derived_action_scores(topic_results):
    money, invest = topic_results["금전"], topic_results["투자심리"]
    overheat = max(0.0, invest["activation"]-invest["favorability"])
    realize = clamp(.40*money["activation"] + .40*money["favorability"] + .20*(100-.70*overheat))
    entry = clamp(.25*money["activation"] + .35*money["favorability"] + .15*invest["activation"] + .25*invest["favorability"] - .25*overheat)
    risk = clamp(.55*invest["activation"] + .45*(100-invest["favorability"]) + .15*overheat)
    out = {k:blend_topic(v) for k,v in topic_results.items() if k != "투자심리"}
    out.update({"수익실현":int(round(realize)),"신규진입":int(round(entry)),"투자주의":int(round(risk))})
    return out


def context_at_kst(dt_kst, natal_lons, natal_houses):
    snapshots, records = build_transit_records(dt_kst.astimezone(UTC), natal_lons, natal_houses)
    topic_results = {topic:score_topic(topic,records,snapshots,natal_houses) for topic in TOPIC_SPECS}
    return {"dt":dt_kst,"snapshots":snapshots,"records":records,"topics":topic_results,"actions":derived_action_scores(topic_results)}

# ============================================================
# 6. MARKET CALENDAR
# ============================================================
@st.cache_resource
def get_krx_calendar():
    if xcals is None:
        return None
    try:
        return xcals.get_calendar("XKRX")
    except Exception:
        return None


KRX = get_krx_calendar()


def is_krx_session(day_value):
    if KRX is None:
        # 라이브러리 로드 실패 시 주말은 확실히 휴장. 공휴일 정확성은 검증 탭에서 경고.
        return day_value.weekday() < 5
    try:
        return bool(KRX.is_session(pd.Timestamp(day_value.isoformat())))
    except Exception:
        return day_value.weekday() < 5


def krx_sessions_in_range(start_date, end_date):
    return [d for d in (start_date + timedelta(days=i) for i in range((end_date-start_date).days+1)) if is_krx_session(d)]


def next_krx_session(after_date, max_days=14):
    for i in range(1,int(max_days)+1):
        candidate=after_date+timedelta(days=i)
        if is_krx_session(candidate):
            return candidate
    return None

# ============================================================
# 7. SCANS / PERIOD AGGREGATION
# ============================================================
def pack_natal_lons(natal_lons):
    return tuple((body,float(natal_lons[body])) for body in PLANET_KEYS)


def unpack_natal_lons(packed):
    return {body:float(v) for body,v in packed}


def pack_houses(houses):
    return (float(houses["asc"]),float(houses["mc"]),float(houses["vertex"]),tuple(float(x) for x in houses["whole_cusps"]),tuple(float(x) for x in houses["placidus_cusps"]))


def unpack_houses(packed):
    asc,mc,vertex,whole,placidus=packed
    return {"asc":asc,"mc":mc,"vertex":vertex,"whole_cusps":list(whole),"placidus_cusps":list(placidus)}


def make_kst_time_points(day_value,start_time,end_time,step_minutes):
    start_dt=KST.localize(datetime.combine(day_value,start_time)); end_dt=KST.localize(datetime.combine(day_value,end_time))
    points=[]; cur=start_dt; step=timedelta(minutes=step_minutes)
    while cur<=end_dt:
        points.append(cur); cur += step
    return points


def scan_intraday(day_value,start_time,end_time,step_minutes,natal_lons,natal_houses):
    points=make_kst_time_points(day_value,start_time,end_time,step_minutes)
    if not points: return []
    midpoint=points[len(points)//2]
    static_bodies=["Jupiter","Saturn","Uranus","Neptune","Pluto"]
    dynamic_bodies=["Sun","Moon","Mercury","Venus","Mars"]
    static_snapshots, static_records = build_transit_records_subset(midpoint.astimezone(UTC),natal_lons,natal_houses,static_bodies)
    rows=[]
    for point in points:
        dyn_snap,dyn_rec=build_transit_records_subset(point.astimezone(UTC),natal_lons,natal_houses,dynamic_bodies)
        snapshots={**static_snapshots,**dyn_snap}; records=static_records+dyn_rec
        topics={topic:score_topic(topic,records,snapshots,natal_houses) for topic in TOPIC_SPECS}
        rows.append({"dt":point,**derived_action_scores(topics),"topics":topics})
    return rows


@st.cache_data(ttl=21600, show_spinner=False)
def cached_intraday_scan(day_iso,start_hm,end_hm,step_minutes,natal_packed,houses_packed):
    return scan_intraday(date.fromisoformat(day_iso),dt_time.fromisoformat(start_hm),dt_time.fromisoformat(end_hm),int(step_minutes),unpack_natal_lons(natal_packed),unpack_houses(houses_packed))


def rows_avg(rows,key):
    vals=[r.get(key) for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    return int(round(sum(vals)/len(vals))) if vals else None


def row_topic_evidence(rows, topic):
    # 하루 여러 샘플 중 기여도가 큰 근거를 합쳐 중복 제거.
    pool=[]
    for row in rows:
        result=row.get("topics",{}).get(topic)
        if result:
            pool.extend(result.get("evidence",[])[:5])
    seen=set(); out=[]
    for e in sorted(pool,key=lambda x:x.get("score",0),reverse=True):
        if e.get("kind")=="aspect": key=("a",e.get("transit"),e.get("target"),e.get("aspect"),e.get("motion"))
        else: key=("h",e.get("transit"),e.get("whole_house"),e.get("placidus_house"))
        if key in seen: continue
        seen.add(key); out.append(e)
        if len(out)>=6: break
    return out




def aggregate_topic_result(rows, topic):
    results=[row.get("topics",{}).get(topic) for row in rows]
    results=[r for r in results if r]
    if not results:
        return {"topic":topic,"activation":0,"favorability":50,"layers":[],"evidence":[]}
    activation=int(round(sum(r["activation"] for r in results)/len(results)))
    favorability=int(round(sum(r["favorability"] for r in results)/len(results)))
    layers=sorted({layer for r in results for layer in r.get("layers",[])})
    return {"topic":topic,"activation":activation,"favorability":favorability,"layers":layers,"evidence":row_topic_evidence(rows,topic)}

def daily_aggregate(day_value,natal_packed,houses_packed,life_step=120,market_step=60):
    # 주/월 비교용: 하루 한 시각이 아니라 여러 시각 샘플을 평균.
    life=cached_intraday_scan(day_value.isoformat(),"08:00:00","22:00:00",life_step,natal_packed,houses_packed)
    market=[]
    if is_krx_session(day_value):
        market=cached_intraday_scan(day_value.isoformat(),"09:00:00","15:30:00",market_step,natal_packed,houses_packed)
    keys=["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션","수신신호","발신적합","과거인연접점"]
    row={"date":day_value,"label":f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})","market_open":bool(market)}
    for key in keys: row[key]=rows_avg(life,key)
    for key in ["수익실현","신규진입","투자주의"]: row[key]=rows_avg(market,key) if market else None
    return row


@st.cache_data(ttl=21600, show_spinner=False)
def cached_period_scores(start_iso,day_count,natal_packed,houses_packed):
    start=date.fromisoformat(start_iso)
    return [daily_aggregate(start+timedelta(days=i),natal_packed,houses_packed) for i in range(int(day_count))]


def period_values(rows,key):
    return [r[key] for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]


def period_avg(rows,key):
    vals=period_values(rows,key)
    return int(round(sum(vals)/len(vals))) if vals else None


def period_extreme(rows,key,highest=True):
    valid=[r for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    if not valid: return None
    return (max if highest else min)(valid,key=lambda r:r[key])


def top_period_days(rows,key,top_n=3,reverse=True):
    valid=[r for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    return sorted(valid,key=lambda r:r[key],reverse=reverse)[:top_n]


def rolling_top_windows(rows,key,window_slots=3,top_n=2):
    if not rows: return []
    window_slots=max(1,min(window_slots,len(rows)))
    step=rows[1]["dt"]-rows[0]["dt"] if len(rows)>1 else timedelta(minutes=30)
    candidates=[]
    for i in range(len(rows)-window_slots+1):
        vals=[rows[j].get(key) for j in range(i,i+window_slots)]
        if any(v is None for v in vals): continue
        candidates.append({"start_idx":i,"end_idx":i+window_slots-1,"start":rows[i]["dt"],"end":rows[i+window_slots-1]["dt"]+step,"score":int(round(sum(vals)/len(vals))),"center_row":rows[i+window_slots//2]})
    candidates.sort(key=lambda x:x["score"],reverse=True)
    selected=[]
    for c in candidates:
        if any(not(c["end_idx"]<s["start_idx"]-1 or c["start_idx"]>s["end_idx"]+1) for s in selected): continue
        selected.append(c)
        if len(selected)>=top_n: break
    return selected


def rolling_bottom_windows(rows,key,window_slots=3,top_n=1):
    """낮은 점수 구간. 일상 분야에서는 '덜 유리한/주의' 시간대용."""
    if not rows: return []
    window_slots=max(1,min(window_slots,len(rows)))
    step=rows[1]["dt"]-rows[0]["dt"] if len(rows)>1 else timedelta(minutes=30)
    candidates=[]
    for i in range(len(rows)-window_slots+1):
        vals=[rows[j].get(key) for j in range(i,i+window_slots)]
        if any(v is None for v in vals): continue
        candidates.append({"start_idx":i,"end_idx":i+window_slots-1,"start":rows[i]["dt"],"end":rows[i+window_slots-1]["dt"]+step,"score":int(round(sum(vals)/len(vals))),"center_row":rows[i+window_slots//2]})
    candidates.sort(key=lambda x:x["score"])
    selected=[]
    for c in candidates:
        if any(not(c["end_idx"]<s["start_idx"]-1 or c["start_idx"]>s["end_idx"]+1) for s in selected): continue
        selected.append(c)
        if len(selected)>=top_n: break
    return selected


TOPIC_TIMING_HOURS = {
    "금전":(7,23), "학업":(6,24), "시험":(6,24), "직장":(8,21), "이직":(7,23),
    "연애":(0,24), "연락":(0,24), "재회":(0,24), "소식":(7,23), "컨디션":(0,24),
}


def topic_timing_data(rows,key,window_slots=3):
    """하루 안에서 같은 분야끼리 비교한 좋은 구간/덜 유리한 구간/피크.
    직장·금전 같은 분야는 실제 활용 가능한 활동 시간으로 제한하고, 관계·연락은 24시간을 본다.
    """
    start_h,end_h=TOPIC_TIMING_HOURS.get(key,(0,24))
    rows=[r for r in rows if start_h <= r["dt"].hour < end_h]
    valid=[(i,r.get(key)) for i,r in enumerate(rows) if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    if not valid:
        return None
    scores=[v for _,v in valid]
    bests=rolling_top_windows(rows,key,window_slots,1)
    lows=rolling_bottom_windows(rows,key,window_slots,1)
    best=bests[0] if bests else None
    low=lows[0] if lows else None
    peak_row=None; low_row=None
    if best:
        subset=rows[best["start_idx"]:best["end_idx"]+1]
        peak_row=max(subset,key=lambda r:r.get(key,-10**9))
    if low:
        subset=rows[low["start_idx"]:low["end_idx"]+1]
        low_row=min(subset,key=lambda r:r.get(key,10**9))
    return {
        "best":best,
        "low":low,
        "peak_row":peak_row,
        "low_row":low_row,
        "spread":int(round(max(scores)-min(scores))),
        "day_max":int(round(max(scores))),
        "day_min":int(round(min(scores))),
    }


def investment_prep_rows(rows):
    """휴장일용 비매매 준비 지수. 실제 거래 신호와 분리한다."""
    out=[]
    for row in rows:
        if not (7 <= row["dt"].hour < 24):
            continue
        money=row.get("금전"); risk=row.get("투자주의"); news=row.get("소식")
        if not all(isinstance(v,(int,float)) for v in (money,risk,news)):
            continue
        # 돈 판단 + 정보 정리 + 과열 억제를 묶은 '준비/검토' 참고값.
        prep=clamp(.45*money + .20*news + .35*(100-risk))
        out.append({"dt":row["dt"],"투자준비":int(round(prep)),"투자주의":int(round(risk))})
    return out

# ============================================================
# 8. HUMAN READABLE INTERPRETATION · V5.3 TIMING + ACTION
# ============================================================
def score_band(score):
    """사용자용 강도 라벨. 40점대가 갑자기 '보통'으로 보이지 않도록 세분화."""
    if score is None: return "해당 없음"
    if score>=82:return "매우 강함"
    if score>=70:return "강함"
    if score>=60:return "보통 이상"
    if score>=50:return "보통"
    if score>=40:return "다소 약함"
    if score>=30:return "약함"
    return "매우 약함"


def score_level(score):
    if score is None:return "none"
    if score>=70:return "strong"
    if score>=60:return "upper"
    if score>=50:return "mid"
    if score>=40:return "lower"
    return "weak"


# 메인 본문은 천문학 내부 용어 대신 '그래서 현실에서 무엇을 뜻하는지'를 바로 말한다.
TOPIC_STATE_COPY = {
    "금전": {
        "strong":"돈과 관련된 선택을 정리하거나 실제 결정을 내리기 좋은 흐름이야.",
        "upper":"예산·구매·상환처럼 돈과 관련된 결정을 구체적으로 비교하기 괜찮은 날이야.",
        "mid":"큰 금전 변화보다는 평소 수입·지출을 얼마나 잘 관리하느냐가 중요한 날이야.",
        "lower":"돈이 크게 풀리는 날이라기보다 지출과 예산을 보수적으로 관리하는 쪽이 유리해.",
        "weak":"큰 수입이나 뜻밖의 금전 호재를 기대하기보다는 새는 돈을 막는 쪽이 더 중요한 날이야.",
    },
    "학업": {
        "strong":"이해한 내용을 빠르게 연결하고 기억에서 꺼내 쓰는 흐름이 좋은 편이야.",
        "upper":"집중과 이해가 비교적 잘 붙어서 난도 있는 공부를 밀어볼 만한 날이야.",
        "mid":"공부가 아주 잘 풀리는 날도, 완전히 막히는 날도 아니야. 과제 선택에 따라 효율 차이가 커.",
        "lower":"새 범위를 빠르게 넓히기보다 이미 본 내용을 회수하고 정리하는 쪽이 효율적이야.",
        "weak":"집중이 저절로 붙는 날은 아니야. 진도를 욕심내기보다 짧은 회독·암기 확인·오답 정리가 더 남아.",
    },
    "시험": {
        "strong":"실전에서 문제를 판단하고 준비한 내용을 꺼내 쓰는 흐름이 강한 편이야.",
        "upper":"시험·모의고사에서 준비한 실력을 비교적 안정적으로 꺼내기 좋은 흐름이야.",
        "mid":"시험운 자체가 결과를 끌어주기보다 준비도와 시간 관리가 그대로 성적에 반영되기 쉬워.",
        "lower":"실전에서는 아는 문제도 서두르거나 시간 배분이 꼬이면 점수를 잃기 쉬운 날이야.",
        "weak":"운이 실수를 덮어주는 날은 아니야. 어려운 문제보다 확실히 맞힐 문제부터 점수를 확보하는 전략이 중요해.",
    },
    "직장": {
        "strong":"업무 성과나 존재감을 드러내고 중요한 일을 진전시키기 좋은 흐름이야.",
        "upper":"업무 처리와 평가 흐름이 비교적 받쳐줘서 중요한 과제를 앞에 두기 좋아.",
        "mid":"직장에서 큰 변화보다는 맡은 일을 얼마나 정확하게 처리하느냐가 더 중요한 날이야.",
        "lower":"새 일을 벌이기보다 업무 범위·마감·책임을 분명히 해두는 게 유리해.",
        "weak":"직장 쪽에서 일이 술술 풀리는 날은 아니야. 불필요한 충돌을 줄이고 해야 할 일만 정확히 끝내는 편이 낫다.",
    },
    "이직": {
        "strong":"새 직장·직무·환경으로 움직일 기회를 구체적으로 잡아볼 만한 흐름이야.",
        "upper":"지원·면접·조건 비교처럼 이직을 실제 행동으로 옮기기 괜찮은 시기야.",
        "mid":"이직 생각은 현실적으로 검토할 수 있지만, 지금 당장 옮겨야 한다고 단정할 정도는 아니야.",
        "lower":"움직임 자체보다 선택지를 모으고 조건을 비교하는 준비 단계에 가까운 흐름이야.",
        "weak":"새 기회가 선명하게 열리는 날은 아니야. 퇴사 결정보다 공고 탐색·서류 정비·정보 수집이 더 맞아.",
    },
    "연애": {
        "strong":"호감·만남·감정 교류가 실제 관계 진전으로 이어지기 좋은 흐름이야.",
        "upper":"상대와의 분위기를 부드럽게 만들거나 자연스럽게 가까워지기 괜찮은 날이야.",
        "mid":"관계가 크게 진전되기보다 현재 분위기와 서로의 반응을 확인하는 날에 가까워.",
        "lower":"연애 쪽에서 큰 진전이나 극적인 변화가 강하게 잡히는 날은 아니야.",
        "weak":"새로운 감정 변화나 관계 진전 신호는 약한 편이야. 억지로 분위기를 만들기보다 상대의 실제 반응을 보는 게 정확해.",
    },
    "연락": {
        "strong":"메시지·전화·대화처럼 실제 접촉이 오가고 대화가 이어지기 좋은 흐름이야.",
        "upper":"연락을 시작하거나 끊긴 대화를 다시 이어보기 비교적 괜찮은 날이야.",
        "mid":"연락이 아예 막힌 날은 아니지만, 먼저 접점이 생겨야 흐름이 이어지는 쪽이야.",
        "lower":"먼저 연락이 오가거나 대화가 급진전될 신호는 강하지 않은 편이야.",
        "weak":"연락 자체의 움직임이 약한 날이야. 답이 늦거나 대화가 짧게 끝나도 의미를 크게 부여하지 않는 게 좋아.",
    },
    "재회": {
        "strong":"과거 인연·미완결 감정이 다시 움직이거나 실제 접점으로 이어질 여지가 강해지는 흐름이야.",
        "upper":"과거 관계를 다시 떠올리거나 재접촉 가능성을 살펴볼 만한 흐름이 살아 있어.",
        "mid":"과거 인연 테마는 어느 정도 움직이지만 실제 재접촉까지 이어진다고 단정하기는 어려워.",
        "lower":"과거 인연이 다시 떠오를 수는 있어도 관계가 실제로 다시 움직이는 힘은 아직 약한 편이야.",
        "weak":"과거 관계가 실제 재접촉이나 재결합 쪽으로 움직이는 신호는 뚜렷하지 않아.",
    },
    "소식": {
        "strong":"결과 통보·메일·문서·예상 밖 정보처럼 외부에서 들어오는 소식이 활발해질 수 있는 흐름이야.",
        "upper":"기다리던 답이나 문서가 움직일 가능성을 체크해볼 만한 날이야.",
        "mid":"소식이 올 수도 있지만 시점이나 내용이 크게 두드러지는 날은 아니야.",
        "lower":"기다리던 결과나 연락이 빠르게 들어오는 흐름은 약한 편이야.",
        "weak":"새 소식이 확 들어오는 날이라기보다 기존 일정·메일·문서를 다시 확인하는 쪽이 더 필요한 날이야.",
    },
    "컨디션": {
        "strong":"활력과 회복 리듬이 비교적 잘 받쳐줘서 중요한 일을 앞쪽에 배치하기 좋은 날이야.",
        "upper":"몸과 집중력이 비교적 잘 따라와서 일정 소화력이 괜찮은 편이야.",
        "mid":"컨디션이 크게 치솟거나 무너지기보다 관리한 만큼 유지되는 날이야.",
        "lower":"에너지가 넉넉한 날은 아니야. 일정 사이에 쉬는 시간을 남겨야 후반까지 버틸 수 있어.",
        "weak":"무리해서 밀어붙이기보다 회복을 우선해야 하는 흐름이야. 중요한 판단과 과한 일정은 피곤해지기 전에 끝내는 게 좋아.",
    },
}


def topic_favorability_note(topic, result):
    """활성도와 우호도가 엇갈릴 때 그 차이를 분야별 현실 언어로 설명."""
    a, f = result["activation"], result["favorability"]
    if f >= 62 and a < 45:
        notes = {
            "금전":"큰 변화는 적어도 실제 돈 관련 일이 생기면 비교적 무리 없이 정리될 가능성이 있어.",
            "학업":"집중이 자동으로 올라오진 않아도 일단 시작하면 이해 자체는 비교적 매끄러운 편이야.",
            "시험":"시험 이벤트의 힘은 약해도 실제 응시 상황에서는 지나친 압박보다 안정감이 더 나을 수 있어.",
            "직장":"큰 성과 이벤트는 적어도 평소 업무는 비교적 마찰 없이 처리하기 쉬운 편이야.",
            "이직":"기회 자체는 적어도 들어오는 제안이나 공고가 있다면 조건을 차분히 검토하기 좋아.",
            "연애":"큰 진전은 적어도 실제 만남이나 대화가 생기면 분위기는 비교적 부드럽게 흘러갈 수 있어.",
            "연락":"연락 빈도는 높지 않아도 대화가 시작되면 말이 크게 꼬이지 않고 이어질 가능성이 있어.",
            "재회":"과거 인연의 움직임은 약해도 실제 접점이 생긴다면 감정적으로 크게 부딪히는 흐름은 덜해.",
            "소식":"소식 자체는 많지 않아도 들어오는 정보는 비교적 정리된 형태일 가능성이 있어.",
            "컨디션":"활력이 높진 않아도 몸 상태가 크게 요동치기보다는 안정적으로 관리되는 쪽이야.",
        }
        return notes.get(topic,"")
    if f <= 42:
        notes = {
            "금전":"돈과 관련된 판단에서 만족감과 현실 조건이 어긋날 수 있으니 즉흥 결제나 큰 지출은 한 번 더 확인해.",
            "학업":"공부를 시작해도 헷갈림이나 피로감이 끼기 쉬워서 속도보다 정확도를 챙기는 편이 낫다.",
            "시험":"실전에서는 조급함·오독·시간 배분 실수가 끼어들 여지가 있어. 검산 루틴을 미리 정해두는 게 좋아.",
            "직장":"업무가 움직여도 말이 엇갈리거나 부담이 커질 수 있으니 기록과 책임 범위를 분명히 해두는 게 좋아.",
            "이직":"이직 생각이나 기회가 생겨도 조건 만족도까지 높다는 뜻은 아니야. 연봉·업무·거리·안정성을 따로 비교해.",
            "연애":"감정은 움직여도 분위기가 편하지 않을 수 있어. 상대 반응을 재촉하거나 한 번의 반응으로 관계를 단정하지 마.",
            "연락":"접점이 생겨도 답장 속도나 말의 뉘앙스가 기대와 다를 수 있어. 짧고 명확하게 소통하는 게 낫다.",
            "재회":"과거 감정이 다시 건드려지는 것과 좋은 방향의 재결합은 다른 문제야. 그리움만으로 재회 신호로 단정하지 마.",
            "소식":"소식이 와도 수정·지연·조건 변경이 붙을 수 있으니 문서와 날짜를 재확인해.",
            "컨디션":"할 일은 있어도 몸이 편하게 따라주지 않을 수 있어. 활동량보다 회복과 수면 리듬을 우선해.",
        }
        return notes.get(topic,"")
    return ""


def topic_action(topic, score):
    level = score_level(score)
    low = level in {"weak","lower"}
    if topic=="금전": return "오늘 할 일은 예정 지출·자동결제·예산을 확인하고, 큰 결제는 하루 정도 더 비교해보는 거야." if low else "예산·상환·구매 조건을 숫자로 비교해서 결정하면 좋아."
    if topic=="학업": return "새 진도 하나를 억지로 늘리기보다 회독·암기 테스트·오답 중 하나를 확실히 끝내." if low else "집중이 필요한 새 내용이나 문제풀이를 컨디션 좋은 시간대에 먼저 배치해."
    if topic=="시험": return "쉬운 문제부터 점수를 확보하고, 시간 체크 지점과 마킹 순서를 미리 고정해." if low else "실전 감각을 써먹기 좋은 날이니 시간 제한을 둔 모의풀이와 검산까지 한 세트로 해봐."
    if topic=="직장": return "업무 우선순위·마감·담당 범위를 문서로 남기고 불필요한 감정 대응은 줄여." if low else "중요 업무나 보고를 앞에 두되, 일까지 과하게 떠안지는 마."
    if topic=="이직": return "당장 퇴사 결론보다 공고 저장·조건 비교·이력서 보완처럼 되돌릴 수 있는 행동부터 해." if low else "지원·면접·조건 협상처럼 실제 선택지를 늘리는 행동으로 옮겨볼 만해."
    if topic=="연애": return "관계를 정의하려 하기보다 상대가 대화를 이어가는지, 만나려는 의지가 있는지 같은 실제 행동을 봐." if low else "호감 표현이나 만남 제안은 가볍고 자연스럽게 해도 좋아. 상대의 후속 반응까지 함께 봐."
    if topic=="연락": return "연락한다면 길게 설명하지 말고 답하기 쉬운 한두 문장으로 보내고, 반응이 없으면 재촉하지 마." if low else "연락을 시작하거나 이어가기 괜찮아. 다만 답을 정해놓고 상대 반응을 끌어내려 하진 마."
    if topic=="재회": return "특정 상대가 연락한다고 보는 점수는 아니야. 실제 행동 신호가 없으면 과거 생각이 난다는 것과 재회를 구분해." if low else "과거 인연과 접점이 생기면 말보다 후속 행동이 이어지는지 확인해. 그게 재회 가능성을 가르는 핵심이야."
    if topic=="소식": return "메일함·문자·기관 공지·마감일을 직접 확인하고, 기다리는 결과는 지연 가능성까지 감안해." if low else "중요 알림을 놓치지 않게 확인하고, 들어온 정보는 날짜·조건까지 바로 검토해."
    if topic=="컨디션": return "일정을 촘촘하게 잡지 말고 식사·수분·휴식 시간을 먼저 확보해. 이 점수는 질병 진단이 아니야." if low else "체력이 남아 있을 때 중요한 일을 먼저 끝내고, 괜찮다고 밤까지 무리하진 마."
    return "실제 상황을 우선해서 활용해."


def cross_topic_note(topic, all_scores):
    """서로 의미가 겹치는 분야는 조합으로 읽어 단일 점수 오해를 줄임."""
    if not all_scores:
        return ""
    s = all_scores
    if topic=="재회":
        r, c = s.get("재회"), s.get("연락")
        if r is None or c is None:return ""
        if r>=60 and c<45:return "과거 인연 테마는 살아 있어도 연락운이 낮아서, 생각이나 미련의 재활성화가 실제 연락 행동으로 바로 이어지지 않을 수 있어."
        if r>=60 and c>=60:return "재회·과거인연과 연락운이 같이 올라와서, 과거 관계 테마와 실제 접촉 가능성이 동시에 움직이는 조합이야."
        if r<45 and c>=60:return "연락운은 더 높지만 재회 신호는 약해. 연락이 생겨도 반드시 과거 인연의 재등장이라고 해석할 근거는 약한 편이야."
    if topic=="연락":
        c, r, l = s.get("연락"), s.get("재회"), s.get("연애")
        if c is None:return ""
        if c>=60 and r>=60:return "연락운과 과거인연 흐름이 함께 높아서, 일반적인 연락보다 과거 관계가 다시 접점으로 들어오는 가능성을 함께 봐야 해."
        if c>=60 and (r or 0)<45:return "연락운은 살아 있지만 재회운은 낮아서, 연락 이벤트가 생겨도 특정 과거 인연과 연결해 단정하진 않는 게 맞아."
        if c<45 and (l or 0)>=60:return "감정·호감 흐름에 비해 실제 연락 움직임은 약해. 마음이 있어도 표현이나 접촉이 늦을 수 있는 조합이야."
    if topic=="연애":
        l, c = s.get("연애"), s.get("연락")
        if l is None or c is None:return ""
        if l>=60 and c<45:return "호감이나 감정 흐름에 비해 연락운이 약해서, 감정이 있어도 표현이나 접촉 빈도는 따라오지 않을 수 있어."
        if l<45 and c>=60:return "연락은 오갈 수 있어도 연애운은 약해. 대화가 생긴다는 것과 관계가 깊어진다는 것은 따로 봐야 해."
    if topic=="시험":
        e, study, cond = s.get("시험"), s.get("학업"), s.get("컨디션")
        if e is None:return ""
        if e<50 and (study or 0)>=55:return "공부 흐름보다 실전 수행 쪽이 약해. 아는 내용을 늘리는 것보다 시간 제한 안에서 꺼내 쓰는 연습이 더 필요해."
        if e>=60 and (cond or 100)<40:return "시험 수행 흐름은 괜찮아도 컨디션이 약하면 체감이 깎일 수 있어. 수면과 식사 관리가 점수 활용의 전제야."
    if topic=="학업":
        study, cond = s.get("학업"), s.get("컨디션")
        if study is not None and study>=60 and (cond or 100)<40:return "공부운은 괜찮아도 컨디션이 약해 오래 버티기 어렵다. 긴 시간보다 집중 구간을 짧게 나눠 써."
    if topic=="이직":
        move, work = s.get("이직"), s.get("직장")
        if move is None or work is None:return ""
        if move>=60 and work<45:return "현재 직장 흐름보다 이동 쪽이 상대적으로 살아 있어. 불만 때문에 즉시 퇴사하기보다 실제 대안의 조건을 확인하는 게 중요해."
        if move<45 and work>=60:return "이직운보다 현재 직장운이 더 받쳐줘. 당장 이동보다 지금 자리에서 성과·조건을 개선하는 선택도 같이 볼 만해."
    if topic=="소식":
        news, contact = s.get("소식"), s.get("연락")
        if news is not None and news>=60 and (contact or 0)<45:return "사적인 연락운은 약해도 문서·기관·결과 통보 같은 공식적인 소식 흐름은 따로 살아 있을 수 있어."
    return ""


def evidence_to_korean(e):
    if e.get("kind")=="aspect":
        t=PLANET_KO.get(e.get("transit"),e.get("transit")); target=PLANET_KO.get(e.get("target"),e.get("target"))
        direction=e.get("direction",""); motion=e.get("motion","")
        return f"{t}가 네이탈 {target}과 {e.get('aspect')} · 오브 {e.get('orb',0):.2f}° · {motion} · {direction}"
    t=PLANET_KO.get(e.get("transit"),e.get("transit")); w=e.get("whole_house"); p=e.get("placidus_house")
    if e.get("whole_relevant") and e.get("placidus_relevant"):
        return f"{t}가 Whole Sign {w}H와 Placidus {p}H에서 해당 테마를 동시에 자극"
    if e.get("whole_relevant"):
        return f"{t}가 Whole Sign {w}H에서 해당 테마를 활성"
    return f"{t}가 Placidus {p}H에서 보조 신호를 형성"


def topic_decision_note(topic, score, timing=None):
    """관계/연락/소식 분야에서 사용자가 바로 행동으로 옮길 수 있는 한 줄 결론."""
    if score is None:
        return ""
    best_text=""
    if timing and timing.get("best"):
        b=timing["best"]
        best_text=f" 가능하면 {b['start'].strftime('%H:%M')}~{b['end'].strftime('%H:%M')} KST 쪽이 상대적으로 낫다."
    if topic=="연락":
        if score>=60:return "먼저 연락해도 돼? → 가볍게 시작해도 괜찮아."+best_text
        if score>=45:return "먼저 연락해도 돼? → 목적이 분명하면 짧게 한 번 정도는 괜찮아."+best_text
        return "먼저 연락해도 돼? → 특별히 해야 할 이유가 없다면 기다리는 편이 낫다. 꼭 보내야 한다면 답하기 쉬운 한두 문장만 보내."+best_text
    if topic=="연애":
        if score>=60:return "만남·호감 표현을 해도 돼? → 자연스럽게 제안해볼 만해. 다만 후속 반응까지 확인해."+best_text
        if score>=45:return "관계를 밀어도 돼? → 가벼운 만남·대화는 괜찮지만 확답이나 관계 정의는 서두르지 마."+best_text
        return "관계를 밀어도 돼? → 고백·확답 요구보다 상대의 자발적인 행동을 보는 편이 낫다."+best_text
    if topic=="재회":
        if score>=60:return "재회 쪽으로 움직여도 돼? → 접점이 생기면 대화는 가능하지만, 말보다 실제 후속 행동을 기준으로 봐."+best_text
        if score>=45:return "재회 확인을 위해 먼저 움직여도 돼? → 확인성 연락보다 자연스러운 접점이 생기는지 먼저 보는 게 낫다."+best_text
        return "재회를 확인하려 먼저 연락해도 돼? → 지금 점수만으로는 권하지 않아. 그리움과 실제 재접촉 신호를 분리해서 봐."+best_text
    if topic=="소식":
        if score>=60:return "기다리는 결과를 확인해도 돼? → 메일·문자·기관 공지를 적극적으로 확인해볼 만해."+best_text
        if score>=45:return "확인 문의해도 돼? → 약속된 확인일이 지났다면 짧고 명확하게 문의하는 건 괜찮아."+best_text
        return "확인 문의해도 돼? → 마감이나 약속된 날짜 전이라면 재촉보다 일정·스팸함·문서 상태를 먼저 확인해."+best_text
    return ""


def topic_narrative(topic, score, result, evidences=None, all_scores=None):
    level = score_level(score)
    opening = TOPIC_STATE_COPY[topic][level]
    favor = topic_favorability_note(topic, result)
    cross = cross_topic_note(topic, all_scores)
    action = topic_action(topic, score)
    return " ".join(part for part in [opening, favor, cross, action] if part)


def _render_ai_topic_analysis(ai_note):
    if not isinstance(ai_note,dict):
        return ""
    verdict=html.escape(ai_note.get("verdict",""))
    reason=html.escape(ai_note.get("reason",""))
    timing=html.escape(ai_note.get("timing",""))
    action=html.escape(ai_note.get("action",""))
    avoid=html.escape(ai_note.get("avoid",""))
    confidence=html.escape(ai_note.get("confidence","보통"))
    confidence_reason=html.escape(ai_note.get("confidence_reason",""))

    parts=[]
    if verdict:
        parts.append(f"<div class='ai-verdict'>{verdict}</div>")
    if reason:
        parts.append(f"<div class='ai-row'><span class='ai-label'>왜</span>{reason}</div>")
    if timing:
        parts.append(f"<div class='ai-row'><span class='ai-label'>시간 흐름</span>{timing}</div>")
    if action:
        parts.append(f"<div class='ai-row'><span class='ai-label'>오늘 행동</span>{action}</div>")
    if avoid:
        parts.append(f"<div class='ai-row'><span class='ai-label'>피할 것</span>{avoid}</div>")
    if confidence:
        ctext=f"해석 확신도 · {confidence}"
        if confidence_reason:
            ctext+=f" · {confidence_reason}"
        parts.append(f"<div class='ai-confidence'>{ctext}</div>")
    return "<div class='ai-analysis'>"+"".join(parts)+"</div>" if parts else ""


def render_topic_card(topic, score, result, evidences, key_prefix, all_scores=None, timing_rows=None, ai_note=None):
    icon=TOPIC_SPECS[topic]["icon"]; label=DISPLAY_LABELS[topic]
    timing=topic_timing_data(timing_rows,topic,3) if timing_rows else None
    timing_html=""
    if timing and timing.get("best"):
        b=timing["best"]; peak=timing.get("peak_row"); low=timing.get("low")
        peak_text=f" · 피크 {peak['dt'].strftime('%H:%M')} · 지수 {peak.get(topic)}" if peak else ""
        if timing.get("spread",0)<4:
            timing_html=(f"<div class='timing-strip'>⏰ 하루 안 시간대 차이는 크지 않아. "
                         f"상대적으로 나은 구간 <strong>{b['start'].strftime('%H:%M')}~{b['end'].strftime('%H:%M')}</strong>{peak_text}</div>")
        else:
            low_text=f" · 덜 유리한 구간 <strong>{low['start'].strftime('%H:%M')}~{low['end'].strftime('%H:%M')}</strong>" if low else ""
            timing_html=(f"<div class='timing-strip'>⏰ 상대적으로 좋은 구간 <strong>{b['start'].strftime('%H:%M')}~{b['end'].strftime('%H:%M')}</strong>{peak_text}{low_text} KST</div>")

    ai_html=_render_ai_topic_analysis(ai_note)
    fallback_html=""
    if not ai_html:
        fallback_html=f"<div class='ast-body'>{topic_narrative(topic,score,result,evidences,all_scores)}</div>"
        decision=topic_decision_note(topic,score,timing)
        if decision:
            fallback_html+=f"<div class='decision-strip'><strong>{decision}</strong></div>"

    st.markdown(
        f"<div class='ast-card'>"
        f"<div class='topic-head'><div class='ast-title'>{icon} {label}</div>"
        f"<div class='topic-score'><span class='topic-score-num'>{score}</span><span class='topic-score-band'>{score_band(score)}</span></div></div>"
        f"{ai_html}{fallback_html}{timing_html}</div>",
        unsafe_allow_html=True,
    )

    with st.expander(f"계산 근거 · {label}"):
        st.markdown(
            f"<div class='rule-summary'><strong>기본 규칙 해석</strong><br>"
            f"{topic_narrative(topic,score,result,evidences,all_scores)}</div>",
            unsafe_allow_html=True,
        )
        decision=topic_decision_note(topic,score,timing)
        if decision:
            st.caption("기본 행동 규칙 · "+decision)
        st.write(
            f"활성도 **{result['activation']}** · 우호도 **{result['favorability']}** "
            "· 둘은 각각 '얼마나 움직이는지'와 '움직일 때 얼마나 부드러운지'를 뜻해."
        )
        if timing and timing.get("best"):
            b=timing["best"]; p=timing.get("peak_row"); low=timing.get("low"); lr=timing.get("low_row")
            ptxt=f" · 피크 **{p['dt']:%H:%M} · {p.get(topic)}**" if p else ""
            st.write(f"⏰ 하루 안 상대 비교: 좋은 구간 **{b['start']:%H:%M}~{b['end']:%H:%M} KST**{ptxt}")
            if low and timing.get("spread",0)>=4:
                ltxt=f" · 저점 **{lr['dt']:%H:%M} · {lr.get(topic)}**" if lr else ""
                st.write(f"⚠️ 덜 유리한 구간 **{low['start']:%H:%M}~{low['end']:%H:%M} KST**{ltxt}")
            if p:
                peak_result=p.get("topics",{}).get(topic,{})
                peak_evidence=peak_result.get("evidence",[])[:2]
                if peak_evidence:
                    st.caption("피크 시간대를 만든 주요 근거")
                    for e in peak_evidence:
                        st.write("• "+evidence_to_korean(e))
        slow=[e for e in (evidences or []) if e.get("transit") in {"Jupiter","Saturn","Uranus","Neptune","Pluto"}]
        if slow:
            st.caption("장기 배경 · 하루 타이밍보다 느리게 지속되는 신호")
            for e in slow[:2]:
                st.write("• "+evidence_to_korean(e))
        if evidences:
            st.caption("주요 계산 근거")
            for e in evidences[:6]:
                st.write("• "+evidence_to_korean(e))
        else:
            st.caption("강한 단일 애스펙트보다 여러 약한 하우스·배경 신호의 합산 영향이 중심이야.")


def format_window(w):
    return f"{w['start'].strftime('%H:%M')} ~ {w['end'].strftime('%H:%M')} KST"


def render_windows(title, windows, key, css_class=""):
    st.markdown(f"#### {title}")
    if not windows:
        st.info("계산 가능한 구간이 없습니다.")
        return
    for i,w in enumerate(windows,1):
        st.markdown(f"<div class='window-card {css_class}'><strong>{i}위 · {format_window(w)}</strong><br>{key} 상대지수 <strong>{w['score']}</strong> · {score_band(w['score'])}</div>",unsafe_allow_html=True)


def period_topic_text(rows,key):
    avg=period_avg(rows,key); best=period_extreme(rows,key,True); worst=period_extreme(rows,key,False)
    if avg is None:return "해당 기간에 계산할 수 있는 데이터가 없습니다."
    band=score_band(avg)

    if key=="투자주의":
        return (
            f"기간 평균 <strong>{avg} · {band}</strong>. "
            f"과열·충동매매 위험이 가장 높은 거래일은 <strong>{best['label']} {best[key]}</strong>, "
            f"가장 낮은 거래일은 <strong>{worst['label']} {worst[key]}</strong>이야. "
            "점수가 높을수록 좋은 날이 아니라 주문 크기·추격·계획 변경을 더 경계해야 하는 날로 봐."
        )
    if key in {"수익실현","신규진입"}:
        noun="수익실현" if key=="수익실현" else "신규진입"
        return (
            f"거래일 기준 {noun} 상대지수 평균은 <strong>{avg} · {band}</strong>. "
            f"상대지수가 가장 높은 거래일은 <strong>{best['label']} {best[key]}</strong>, "
            f"가장 낮은 거래일은 <strong>{worst['label']} {worst[key]}</strong>이야. "
            "실제 매매는 이 순위보다 가격·수급·거래량·손절 기준을 먼저 확인해야 해."
        )

    intro = {
        "금전":"큰 돈의 변화보다 지출·예산·현금흐름을 어떻게 관리하느냐가 중요한 기간",
        "학업":"공부량 자체보다 집중이 잘 붙는 날에 난도 있는 과제를 몰아주는 게 효율적인 기간",
        "시험":"시험·모의고사에서는 준비한 내용을 실전에서 꺼내는 힘과 실수 관리가 중요한 기간",
        "직장":"업무 성과와 마찰이 날짜별로 달라질 수 있어 중요한 보고·결정의 타이밍을 골라 쓰는 기간",
        "이직":"이직을 확정하기보다 공고 탐색·지원·면접·조건 비교의 타이밍 차이를 보는 기간",
        "연애":"관계가 크게 움직이는 날과 조용한 날의 차이를 보면서 실제 만남과 반응을 확인하는 기간",
        "연락":"연락 빈도와 대화가 이어지는 힘이 날짜마다 달라질 수 있는 기간",
        "재회":"과거 인연·미완결 관계 테마가 다시 활성화되는 날을 보되 특정 상대의 행동 예측과는 구분해야 하는 기간",
        "소식":"결과 통보·메일·문서·기관 공지처럼 외부에서 들어오는 정보 흐름을 확인하는 기간",
        "컨디션":"활력과 회복 리듬의 차이를 보고 중요한 일정을 배치하는 기간",
    }
    best_word = {
        "금전":"돈 관리가 상대적으로 수월한 날", "학업":"공부 흐름이 상대적으로 잘 붙는 날",
        "시험":"실전 수행 흐름이 상대적으로 나은 날", "직장":"업무 흐름이 상대적으로 나은 날",
        "이직":"이동·지원 흐름이 상대적으로 살아나는 날", "연애":"관계 흐름이 상대적으로 살아나는 날",
        "연락":"연락·대화 흐름이 상대적으로 살아나는 날", "재회":"과거인연 테마가 상대적으로 강해지는 날",
        "소식":"소식·문서 흐름이 상대적으로 살아나는 날", "컨디션":"몸과 집중력이 상대적으로 잘 받쳐주는 날",
    }
    weak_word = {
        "금전":"돈 판단을 더 보수적으로 볼 날", "학업":"공부 강도를 낮추는 게 나은 날",
        "시험":"실수·시간관리를 더 챙길 날", "직장":"마찰과 업무 부담을 더 조심할 날",
        "이직":"결정보다 탐색에 머무는 게 나은 날", "연애":"관계 결론을 서두르지 않을 날",
        "연락":"연락 결과를 기대하지 않는 게 나은 날", "재회":"재회 의미를 크게 부여하지 않을 날",
        "소식":"지연·변경 가능성을 감안할 날", "컨디션":"회복 여백을 더 크게 잡을 날",
    }
    return (
        f"기간 평균 <strong>{avg} · {band}</strong>. {intro.get(key,'날짜별 차이를 보는 기간')}이야. "
        f"{best_word.get(key,'상대적으로 나은 날')}은 <strong>{best['label']} {best[key]}</strong>, "
        f"{weak_word.get(key,'상대적으로 약한 날')}은 <strong>{worst['label']} {worst[key]}</strong>이야. "
        "이 날짜 순위는 같은 분야 안에서 비교한 상대값으로 봐."
    )


# ============================================================
# 8-B. AI INTERPRETER · V6.1
# ============================================================
AI_INTERPRETER_VERSION = "v6.3.0"
AI_SUPPORTED_MODELS = {
    "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
    "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
}
AI_DEFAULT_MODEL = "gemini-3.7-flash"
AI_FALLBACK_MODEL = "gemini-3.6-flash"
AI_DEFAULT_THINKING_LEVEL = "high"
AI_ALLOWED_THINKING_LEVELS = {"low", "medium", "high"}
AI_MAX_OUTPUT_TOKENS = 16384

# 일일 AI 해설은 같은 기기에서 90일 보관한다. 같은 날짜/계산값/모델이면
# 저장본을 우선 사용하므로 과거 운세를 다시 열 때 Gemini를 재호출하지 않는다.
AI_BROWSER_CACHE_PREFIX = "astro_ai_daily_v1_"
AI_BROWSER_CACHE_TTL_SECONDS = 90 * 86400
AI_BROWSER_CACHE_MAX_ENTRIES = 120

# 주간/월간 계산 리포트도 별도 저장함에 남긴다. 이 둘은 현재 규칙 계산이므로
# Gemini 비용은 없지만, 다시 계산하는 시간을 줄이고 과거 흐름을 비교할 수 있게 한다.
PERIOD_ARCHIVE_STORAGE_KEY = "astro_period_archive_v1"
PERIOD_ARCHIVE_WEEKLY_LIMIT = 26
PERIOD_ARCHIVE_MONTHLY_LIMIT = 18

# Google 공식 2026-08 가격표 기준. 실제 청구액은 환율/세금/정책에 따라 다를 수 있다.
GEMINI_INTRO_END = date(2026, 12, 31)
GEMINI_PRICE_MODELS = {"gemini-3.7-flash", "gemini-3.6-flash"}
GEMINI_INTRO_INPUT_PER_M = 0.75
GEMINI_INTRO_OUTPUT_PER_M = 3.75
GEMINI_STANDARD_INPUT_PER_M = 1.50
GEMINI_STANDARD_OUTPUT_PER_M = 7.50
GEMINI_USD_KRW_DISPLAY_ESTIMATE = 1384.0

AI_TOPIC_ORDER = ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]


def _ai_api_key():
    return _secret_text("GEMINI_API_KEY", "")


def _ai_model():
    configured = _secret_text("GEMINI_MODEL", AI_DEFAULT_MODEL) or AI_DEFAULT_MODEL
    return configured if configured in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL


def _ai_thinking_level():
    configured = (_secret_text("GEMINI_THINKING_LEVEL", AI_DEFAULT_THINKING_LEVEL) or AI_DEFAULT_THINKING_LEVEL).lower()
    return configured if configured in AI_ALLOWED_THINKING_LEVELS else AI_DEFAULT_THINKING_LEVEL


def _clean_ai_text(value, max_chars=1200):
    if not isinstance(value, str):
        return ""
    value=" ".join(value.replace("\x00", " ").split()).strip()
    return value[:max_chars]


def _compact_evidence(e):
    """AI에는 계산 근거만 전달. 이름·생년월일·출생지·원시 네이탈 좌표는 보내지 않는다."""
    if not isinstance(e, dict):
        return None
    if e.get("kind")=="aspect":
        return {
            "kind":"aspect",
            "transit":e.get("transit"),
            "target":e.get("target"),
            "aspect":e.get("aspect"),
            "orb":round(float(e.get("orb",0.0)),2),
            "motion":e.get("motion",""),
            "direction":e.get("direction",""),
            "layer":e.get("layer",LAYER_BY_TRANSIT.get(e.get("transit"),"")),
        }
    return {
        "kind":"house",
        "transit":e.get("transit"),
        "whole_house":e.get("whole_house"),
        "placidus_house":e.get("placidus_house"),
        "whole_relevant":bool(e.get("whole_relevant")),
        "placidus_relevant":bool(e.get("placidus_relevant")),
        "layer":e.get("layer",LAYER_BY_TRANSIT.get(e.get("transit"),"")),
    }


def _timing_payload(rows, topic):
    timing=topic_timing_data(rows,topic,3) if rows else None
    if not timing:
        return None
    out={"spread":timing.get("spread")}
    b=timing.get("best"); low=timing.get("low"); peak=timing.get("peak_row"); low_row=timing.get("low_row")
    if b:
        out["best_window"]={"start":b["start"].strftime("%H:%M"),"end":b["end"].strftime("%H:%M"),"score":b.get("score")}
    if peak:
        out["peak"]={"time":peak["dt"].strftime("%H:%M"),"score":peak.get(topic)}
    if low:
        out["low_window"]={"start":low["start"].strftime("%H:%M"),"end":low["end"].strftime("%H:%M"),"score":low.get("score")}
    if low_row:
        out["low_point"]={"time":low_row["dt"].strftime("%H:%M"),"score":low_row.get(topic)}
    return out


def build_ai_daily_payload(query_date, daily_scores, topic_results, timing_rows, market_rows, moon_ingresses):
    topics={}
    for topic in AI_TOPIC_ORDER:
        result=topic_results.get(topic,{})
        evidence=[]
        for e in result.get("evidence",[])[:6]:
            c=_compact_evidence(e)
            if c: evidence.append(c)
        topics[topic]={
            "score":daily_scores.get(topic),
            "band":score_band(daily_scores.get(topic)),
            "activation":result.get("activation"),
            "favorability":result.get("favorability"),
            "timing":_timing_payload(timing_rows,topic),
            "evidence":evidence,
        }

    market={"krx_open":bool(market_rows)}
    if market_rows:
        for key in ["수익실현","신규진입","투자주의"]:
            market[key]={
                "score":rows_avg(market_rows,key),
                "best_windows":[
                    {"start":w["start"].strftime("%H:%M"),"end":w["end"].strftime("%H:%M"),"score":w["score"]}
                    for w in rolling_top_windows(market_rows,key,3,2)
                ],
            }
    else:
        nxt=next_krx_session(query_date)
        market["next_krx_session"]=nxt.isoformat() if nxt else None

    moon_events=[]
    for ts,sign in (moon_ingresses or []):
        try: t=datetime.fromisoformat(ts).strftime("%H:%M")
        except Exception: t=str(ts)
        moon_events.append({"time":t,"sign":sign})

    return {
        "version":AI_INTERPRETER_VERSION,
        "date":query_date.isoformat(),
        "weekday":WEEKDAY_KO[query_date.weekday()],
        "method_note":"점수는 앱의 점성술 상대지수이며 확률이 아니다. 일일 대표점수는 07:00~23:30 KST 다중시각 평균, 시간대 탐색은 00:00~23:30 KST.",
        "moon_ingresses":moon_events,
        "topics":topics,
        "market":market,
    }


AI_SYSTEM_PROMPT = """너는 '별빛의 운명' 앱의 정밀 점성술 해설자다. 계산자가 아니라 분석가다.
반드시 제공된 CALCULATED_DATA JSON 안의 값만 사용한다. 없는 행성 위치, 애스펙트, 하우스, 시간, 사건을 절대로 만들어내지 마라.
점수는 사건 확률이 아니라 앱 내부 상대지수다. activation은 테마의 움직임, favorability는 그 움직임의 매끄러움으로 구분해서 읽어라.

가장 중요한 목표는 '점수를 말로 다시 읽어주는 것'이 아니라 서로 다른 계산 신호의 관계를 분석하는 것이다.
예: 활성도는 높은데 우호도가 낮으면 '움직임은 강하지만 편하게 풀리는 흐름은 아니다'처럼 충돌 구조를 설명한다.
단기 시간대와 장기 행성 근거가 다르면 어느 쪽이 하루의 타이밍이고 어느 쪽이 배경 압력인지 구분한다.
연애-연락-재회, 학업-시험-컨디션, 직장-이직-금전처럼 관련 분야를 교차해서 읽되 숫자 크기만으로 인과관계를 만들지 않는다.

절대 기존 자동문구처럼 쓰지 마라.
'점수가 낮아서 약하다', '흐름이 좋다/나쁘다', '루틴을 우선', '사건성 신호', '무난한 날'만으로 문장을 끝내지 마라.
가능한 근거가 2개 이상이면 서로 어떻게 합쳐지거나 충돌하는지 설명한다.
시간대 spread가 작으면 억지로 피크를 과장하지 말고 '시간 차이가 작다'고 분명히 말한다.
evidence가 빈약하면 해석 확신도를 낮추고 무엇을 단정할 수 없는지 적는다.

각 topic_analysis는 반드시 다음 역할이 다르다.
- verdict: 사용자가 바로 이해할 오늘의 결론. 단순 점수 번역 금지.
- reason: 실제 계산 근거 2개 안팎을 연결한 분석. 근거가 부족하면 부족하다고 말한다.
- timing: 시간대 변화가 실제로 의미 있을 때만 구체적으로 설명. 차이가 작으면 그 사실을 설명.
- action: 오늘 현실적으로 할 행동 1개.
- avoid: 오늘 피할 행동 또는 과대해석 1개.
- confidence: 높음/보통/낮음 중 하나. 데이터의 밀도와 신호 일치도를 기준으로 한다.
- confidence_reason: 왜 그 확신도인지 짧게 설명.

연애·연락·재회에서는 특정 사람이 연락한다, 돌아온다, 마음이 있다처럼 타인의 의도나 미래 행동을 단정하지 마라.
컨디션은 질병·진단·치료 예측을 하지 말고 활동 리듬과 휴식 조언만 하라.
투자는 가격·수익률·매수/매도 성공을 예측하지 마라. KRX 휴장일에는 장중 매매 해설을 만들지 않는다.
한국어 반말로 자연스럽고 구체적으로 쓴다. 같은 시작문장과 상투어를 분야마다 반복하지 않는다.
출력은 JSON만 반환한다."""


AI_OUTPUT_SHAPE = {
    "headline":"오늘을 관통하는 핵심을 20자 안팎으로",
    "overall":{
        "summary":"전체 흐름을 4~6문장. 가장 중요한 충돌/합치 신호를 중심으로 분석",
        "dominant_pattern":"오늘 가장 지배적인 패턴 1~2문장",
        "turning_point":"시간대 변화가 의미 있으면 언제 무엇이 달라지는지. 의미 없으면 시간차가 작다고 명시",
    },
    "priorities":["오늘 실제로 하면 좋은 행동 1","행동 2","행동 3"],
    "clusters":{
        "relationship":"연애·연락·재회를 교차한 핵심 분석 2~4문장",
        "work_study":"학업·시험·직장·이직·컨디션을 필요한 만큼 교차한 분석 2~4문장",
        "money_news":"금전·소식·투자 데이터를 필요한 만큼 교차한 분석 2~4문장",
        "condition":"컨디션의 하루 리듬과 일정 배치 조언 1~3문장",
    },
    "topic_analysis":{
        topic:{
            "verdict":"이 분야의 오늘 결론 1문장",
            "reason":"계산 근거를 연결한 분석 2~4문장",
            "timing":"시간대 해석 1~2문장",
            "action":"오늘 할 행동 1문장",
            "avoid":"피할 행동/과대해석 1문장",
            "confidence":"높음|보통|낮음",
            "confidence_reason":"확신도 이유 1문장",
        } for topic in AI_TOPIC_ORDER
    },
    "limits":"전체 해설에서 단정하면 안 되는 부분이나 근거 한계를 1~2문장",
}


def _validate_ai_output(obj):
    if not isinstance(obj,dict):
        return None

    overall_raw=obj.get("overall",{})
    if isinstance(overall_raw,str):
        overall_raw={"summary":overall_raw}
    if not isinstance(overall_raw,dict):
        overall_raw={}

    clusters_raw=obj.get("clusters",{})
    if not isinstance(clusters_raw,dict):
        clusters_raw={}

    out={
        "headline":_clean_ai_text(obj.get("headline"),140),
        "overall":{
            "summary":_clean_ai_text(overall_raw.get("summary"),2200),
            "dominant_pattern":_clean_ai_text(overall_raw.get("dominant_pattern"),900),
            "turning_point":_clean_ai_text(overall_raw.get("turning_point"),900),
        },
        "clusters":{
            "relationship":_clean_ai_text(clusters_raw.get("relationship"),1400),
            "work_study":_clean_ai_text(clusters_raw.get("work_study"),1400),
            "money_news":_clean_ai_text(clusters_raw.get("money_news"),1400),
            "condition":_clean_ai_text(clusters_raw.get("condition"),1000),
        },
        "limits":_clean_ai_text(obj.get("limits"),900),
    }

    priorities=obj.get("priorities",[])
    out["priorities"]=[_clean_ai_text(x,260) for x in priorities[:3] if _clean_ai_text(x,260)] if isinstance(priorities,list) else []

    analyses=obj.get("topic_analysis",{})
    out["topic_analysis"]={}
    if isinstance(analyses,dict):
        for topic in AI_TOPIC_ORDER:
            item=analyses.get(topic,{})
            if isinstance(item,str):
                item={"verdict":item}
            if not isinstance(item,dict):
                continue
            confidence=_clean_ai_text(item.get("confidence"),20)
            if confidence not in {"높음","보통","낮음"}:
                confidence="보통"
            cleaned={
                "verdict":_clean_ai_text(item.get("verdict"),450),
                "reason":_clean_ai_text(item.get("reason"),1500),
                "timing":_clean_ai_text(item.get("timing"),800),
                "action":_clean_ai_text(item.get("action"),500),
                "avoid":_clean_ai_text(item.get("avoid"),500),
                "confidence":confidence,
                "confidence_reason":_clean_ai_text(item.get("confidence_reason"),500),
            }
            if any(cleaned[k] for k in ["verdict","reason","timing","action","avoid"]):
                out["topic_analysis"][topic]=cleaned

    if not out["overall"]["summary"] and not out["topic_analysis"]:
        return None
    return out


def _gemini_price_for_date(model_name, day_value=None):
    if model_name not in GEMINI_PRICE_MODELS:
        return None
    day_value = day_value or datetime.now(KST).date()
    if day_value <= GEMINI_INTRO_END:
        return {
            "input_per_m": GEMINI_INTRO_INPUT_PER_M,
            "output_per_m": GEMINI_INTRO_OUTPUT_PER_M,
            "price_phase": "intro_2026",
        }
    return {
        "input_per_m": GEMINI_STANDARD_INPUT_PER_M,
        "output_per_m": GEMINI_STANDARD_OUTPUT_PER_M,
        "price_phase": "standard_2027",
    }


def _gemini_usage_summary(raw, model_name):
    """Gemini usageMetadata를 저장용 소형 구조로 정리하고 예상 원가를 계산한다."""
    usage = raw.get("usageMetadata", {}) if isinstance(raw, dict) else {}
    if not isinstance(usage, dict):
        usage = {}

    def as_int(key):
        try:
            return max(0, int(usage.get(key, 0) or 0))
        except Exception:
            return 0

    prompt = as_int("promptTokenCount")
    candidates = as_int("candidatesTokenCount")
    thoughts = as_int("thoughtsTokenCount")
    total = as_int("totalTokenCount")
    billable_output = candidates + thoughts
    prices = _gemini_price_for_date(model_name)
    estimated_usd = None
    estimated_krw = None
    if prices:
        estimated_usd = (prompt / 1_000_000) * prices["input_per_m"] + (billable_output / 1_000_000) * prices["output_per_m"]
        estimated_krw = estimated_usd * GEMINI_USD_KRW_DISPLAY_ESTIMATE

    return {
        "prompt_tokens": prompt,
        "candidate_tokens": candidates,
        "thought_tokens": thoughts,
        "billable_output_tokens": billable_output,
        "total_tokens": total,
        "estimated_usd": round(estimated_usd, 6) if estimated_usd is not None else None,
        "estimated_krw": round(estimated_krw, 1) if estimated_krw is not None else None,
        "price_phase": prices.get("price_phase") if prices else None,
    }


def _call_gemini_once(payload_json, model_name, thinking_level, api_key):
    model_name=(model_name or AI_DEFAULT_MODEL).strip()
    safe_model=urllib.parse.quote(model_name,safe="-._")
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"
    user_prompt=(
        "아래 계산 JSON을 해석해. JSON 안에 없는 근거는 만들지 마. "
        "다음 출력 형태의 키를 그대로 사용하고 topic_analysis에는 10개 분야를 모두 채워. 분야별 문구를 서로 복제하지 마.\n\n"
        "OUTPUT_SHAPE:\n"+json.dumps(AI_OUTPUT_SHAPE,ensure_ascii=False,separators=(",",":"))+"\n\n"
        "CALCULATED_DATA:\n"+payload_json
    )
    body={
        "systemInstruction":{"parts":[{"text":AI_SYSTEM_PROMPT}]},
        "contents":[{"role":"user","parts":[{"text":user_prompt}]}],
        "generationConfig":{
            "maxOutputTokens":AI_MAX_OUTPUT_TOKENS,
            "responseMimeType":"application/json",
            "thinkingConfig":{"thinkingLevel":thinking_level},
        },
    }
    req=urllib.request.Request(
        url,
        data=json.dumps(body,ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type":"application/json","x-goog-api-key":api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req,timeout=55) as resp:
            raw=json.loads(resp.read().decode("utf-8"))
        parts=raw.get("candidates",[{}])[0].get("content",{}).get("parts",[])
        text="".join(p.get("text","") for p in parts if isinstance(p,dict) and not p.get("thought")).strip()
        if not text:
            text="".join(p.get("text","") for p in parts if isinstance(p,dict)).strip()
        if text.startswith("```"):
            text=text.strip("`").strip()
            if text.lower().startswith("json"): text=text[4:].lstrip()
        parsed=json.loads(text)
        valid=_validate_ai_output(parsed)
        if not valid:
            return {"ok":False,"error":"AI 응답 형식 검증에 실패했어.","error_code":"invalid_output","model":model_name}
        usage=_gemini_usage_summary(raw,model_name)
        return {"ok":True,"data":valid,"model":model_name,"usage":usage}
    except urllib.error.HTTPError as exc:
        try:
            detail=exc.read().decode("utf-8")[:700]
        except Exception:
            detail=""
        if exc.code==429:
            msg="Gemini API 사용량 한도 또는 요청 제한에 도달했어. 잠시 뒤 다시 열면 돼."
        elif exc.code in {401,403}:
            msg="Gemini API 키 권한이나 결제 프로젝트 연결 상태를 확인해줘."
        elif exc.code==404:
            msg=f"{model_name} 모델을 이 API 키/프로젝트에서 사용할 수 없는 것 같아."
        elif exc.code>=500:
            msg="Gemini 서버가 일시적으로 불안정해."
        else:
            msg=f"Gemini API 오류({exc.code})"
        return {"ok":False,"error":msg,"detail":detail,"error_code":exc.code,"model":model_name}
    except Exception as exc:
        return {
            "ok":False,
            "error":f"AI 해설 호출 실패: {type(exc).__name__}",
            "error_code":type(exc).__name__,
            "model":model_name,
        }



def _ai_browser_cache_id(payload_json, model, thinking_level, key_fingerprint):
    raw="|".join([
        AI_INTERPRETER_VERSION,
        model or "",
        thinking_level or "",
        key_fingerprint or "",
        payload_json,
    ])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:28]


def _ai_browser_storage_key(cache_id):
    return AI_BROWSER_CACHE_PREFIX + cache_id


def _read_ai_browser_cache(cache_id):
    """
    이 기기의 localStorage에서 AI 해설을 직접 읽는다.
    None = component 응답 대기 중, "" = 캐시 없음.
    """
    if streamlit_js_eval is None:
        return ""
    storage_key_js=json.dumps(_ai_browser_storage_key(cache_id))
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    expression=(
        "(()=>{"
        f"const v=localStorage.getItem({storage_key_js});"
        f"return v===null?{empty_js}:v;"
        "})()"
    )
    value=streamlit_js_eval(
        js_expressions=expression,
        key=f"astro_ai_cache_read_{cache_id}",
    )
    if value is None:
        return None
    value=str(value or "").strip()
    if value==REMEMBER_EMPTY_SENTINEL:
        return ""
    return value


def _write_ai_browser_cache(cache_id, ai_result):
    """
    검증이 끝난 AI 결과를 이 기기에 장기 보관한다.
    component key를 매 렌더마다 바꾸면 Streamlit이 계속 rerun하므로,
    결과 fingerprint를 사용해 같은 결과에는 항상 같은 key를 쓴다.
    """
    if streamlit_js_eval is None or not ai_result or not ai_result.get("ok"):
        return None

    result_json=json.dumps(ai_result,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    result_fp=hashlib.sha256(result_json.encode("utf-8")).hexdigest()[:12]
    written_key=f"_astro_ai_cache_written_{cache_id}_{result_fp}"
    if st.session_state.get(written_key,False):
        return "ok"

    storage_key=_ai_browser_storage_key(cache_id)
    now_ts=int(time.time())
    packed={
        "saved_at":now_ts,
        "expires_at":now_ts+AI_BROWSER_CACHE_TTL_SECONDS,
        "result":ai_result,
    }
    storage_key_js=json.dumps(storage_key)
    packed_js=json.dumps(json.dumps(packed,ensure_ascii=False,separators=(",",":")))
    prefix_js=json.dumps(AI_BROWSER_CACHE_PREFIX)
    expression=(
        "(()=>{"
        "try{"
        f"const prefix={prefix_js};"
        "const now=Math.floor(Date.now()/1000);"
        "const kept=[];"
        "for(let i=localStorage.length-1;i>=0;i--){"
        " const k=localStorage.key(i);"
        " if(!k||!k.startsWith(prefix)) continue;"
        " try{const o=JSON.parse(localStorage.getItem(k)||'{}');"
        " if(!o.expires_at||Number(o.expires_at)<=now){localStorage.removeItem(k);}"
        " else{kept.push({k:k,s:Number(o.saved_at||0)});}}catch(e){localStorage.removeItem(k);}"
        "}"
        "kept.sort((a,b)=>b.s-a.s);"
        f"kept.slice({AI_BROWSER_CACHE_MAX_ENTRIES - 1}).forEach(x=>localStorage.removeItem(x.k));"
        f"localStorage.setItem({storage_key_js},{packed_js});"
        "return 'ok';"
        "}catch(e){return 'fail';}"
        "})()"
    )
    value=streamlit_js_eval(
        js_expressions=expression,
        key=f"astro_ai_cache_write_{cache_id}_{result_fp}",
    )
    if value is None:
        return None
    value=str(value)
    if value=="ok":
        st.session_state[written_key]=True
    return value


def _delete_ai_browser_cache(cache_id):
    if streamlit_js_eval is None:
        return None
    storage_key_js=json.dumps(_ai_browser_storage_key(cache_id))
    expression=f"(()=>{{localStorage.removeItem({storage_key_js});return 'ok';}})()"
    return streamlit_js_eval(
        js_expressions=expression,
        key=f"astro_ai_cache_delete_{cache_id}",
    )


def _decode_ai_browser_cache(raw_value):
    if not raw_value:
        return None
    try:
        packed=json.loads(raw_value)
        if not isinstance(packed,dict):
            return None
        expires_at=int(packed.get("expires_at",0) or 0)
        if expires_at<=int(time.time()):
            return None
        result=packed.get("result")
        if not isinstance(result,dict) or not result.get("ok"):
            return None
        valid=_validate_ai_output(result.get("data"))
        if not valid:
            return None
        result=dict(result)
        result["data"]=valid
        result["cache_source"]="browser"
        result["cache_saved_at"]=int(packed.get("saved_at",0) or 0)
        return result
    except Exception:
        return None


@st.cache_data(ttl=AI_BROWSER_CACHE_TTL_SECONDS, show_spinner=False)
def cached_ai_daily_interpretation(payload_json, preferred_model, thinking_level, key_fingerprint):
    # key_fingerprint는 캐시 무효화용. 실제 키는 payload/캐시에 넣지 않는다.
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"error":"GEMINI_API_KEY가 설정되지 않았어."}

    preferred_model = preferred_model if preferred_model in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL
    thinking_level = thinking_level if thinking_level in AI_ALLOWED_THINKING_LEVELS else AI_DEFAULT_THINKING_LEVEL

    primary=_call_gemini_once(payload_json,preferred_model,thinking_level,api_key)
    if primary.get("ok"):
        primary["preferred_model"]=preferred_model
        primary["thinking_level"]=thinking_level
        primary["used_fallback"]=False
        return primary

    # 사용자가 3.7을 선택했을 때만 3.6으로 자동 대체.
    # 인증/권한 오류는 모델을 바꿔도 해결되지 않으므로 재시도하지 않는다.
    can_fallback=(
        preferred_model=="gemini-3.7-flash"
        and AI_FALLBACK_MODEL!=preferred_model
        and primary.get("error_code") not in {401,403}
    )
    if can_fallback:
        fallback=_call_gemini_once(payload_json,AI_FALLBACK_MODEL,thinking_level,api_key)
        if fallback.get("ok"):
            fallback["preferred_model"]=preferred_model
            fallback["thinking_level"]=thinking_level
            fallback["used_fallback"]=True
            fallback["fallback_from"]=preferred_model
            return fallback
        return {
            "ok":False,
            "error":primary.get("error","AI 해설 호출 실패"),
            "primary_error":primary,
            "fallback_error":fallback,
            "preferred_model":preferred_model,
            "thinking_level":thinking_level,
        }

    primary["preferred_model"]=preferred_model
    primary["thinking_level"]=thinking_level
    primary["used_fallback"]=False
    return primary


def get_ai_daily_interpretation(payload, preferred_model=None):
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"missing_key":True,"error":"GEMINI_API_KEY가 설정되지 않았어."}

    model=preferred_model if preferred_model in AI_SUPPORTED_MODELS else _ai_model()
    thinking_level=_ai_thinking_level()
    key_fp=hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    cache_id=_ai_browser_cache_id(payload_json,model,thinking_level,key_fp)

    # 1순위: 이 기기 브라우저 캐시. Streamlit Cloud 재시작/절전 후에도 남는다.
    if streamlit_js_eval is not None:
        raw_cache=_read_ai_browser_cache(cache_id)
        wait_key=f"_astro_ai_cache_wait_{cache_id}"
        if raw_cache is None:
            waits=int(st.session_state.get(wait_key,0) or 0)+1
            st.session_state[wait_key]=waits
            # custom component 응답은 비동기라 첫 렌더에서만 한 번 기다린다.
            # 페이지 전체를 중단하지 않고 기본 계산 화면을 그대로 보여준다.
            if waits<=1:
                return {"ok":False,"cache_waiting":True,"cache_id":cache_id}
        else:
            st.session_state.pop(wait_key,None)
            cached=_decode_ai_browser_cache(raw_cache)
            if cached:
                return cached
            if raw_cache:
                _delete_ai_browser_cache(cache_id)

    # 2순위: Streamlit 서버 메모리 캐시. 살아 있는 인스턴스에서는 API를 다시 부르지 않는다.
    result=cached_ai_daily_interpretation(payload_json,model,thinking_level,key_fp)
    if result and result.get("ok"):
        result=dict(result)
        result["cache_source"]=result.get("cache_source","server_or_api")
        result["archive_meta"]={
            "period":"daily",
            "date":str(payload.get("date") or ""),
            "label":str(payload.get("date") or "일일 운세"),
        }
        _write_ai_browser_cache(cache_id,result)
    return result


def _read_daily_archive_entries():
    """현재 기기의 살아 있는 일일 AI 캐시를 저장함 목록으로 읽는다."""
    if streamlit_js_eval is None:
        return []
    prefix_js=json.dumps(AI_BROWSER_CACHE_PREFIX)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    expression=(
        "(()=>{try{"
        f"const prefix={prefix_js};"
        "const now=Math.floor(Date.now()/1000);const out=[];"
        "for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);"
        " if(!k||!k.startsWith(prefix))continue;"
        " try{const o=JSON.parse(localStorage.getItem(k)||'{}');"
        " const r=o.result||{};const m=r.archive_meta||{};"
        " if(Number(o.expires_at||0)>now&&r.ok&&m.period==='daily'){out.push({saved_at:o.saved_at||0,expires_at:o.expires_at||0,result:r});}"
        " }catch(e){}"
        "}"
        "out.sort((a,b)=>Number(b.saved_at||0)-Number(a.saved_at||0));"
        "return JSON.stringify(out);"
        f"}}catch(e){{return {empty_js};}}}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"fortune_daily_archive_read_{nonce}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return []
    try:
        parsed=json.loads(str(value))
        return parsed if isinstance(parsed,list) else []
    except Exception:
        return []


def _period_snapshot(kind,start_date,end_date,rows):
    topics={}
    for key in AI_TOPIC_ORDER:
        topics[key]=period_topic_text(rows,key)
    market={}
    for key,label in [("수익실현","수익실현"),("신규진입","신규진입"),("투자주의","과열주의")]:
        if period_values(rows,key):
            market[label]=period_topic_text(rows,key)
    days=[]
    for row in rows:
        days.append({
            "label":row.get("label",""),
            "market_open":bool(row.get("market_open")),
            **{k:row.get(k) for k in AI_TOPIC_ORDER},
        })
    return {
        "id":f"{kind}:{start_date.isoformat()}:{end_date.isoformat()}",
        "period":kind,
        "start":start_date.isoformat(),
        "end":end_date.isoformat(),
        "saved_at":int(time.time()),
        "topics":topics,
        "market":market,
        "days":days,
    }


def _save_period_archive(kind,start_date,end_date,rows):
    if streamlit_js_eval is None or not rows or kind not in {"weekly","monthly"}:
        return None
    snapshot=_period_snapshot(kind,start_date,end_date,rows)
    fp=hashlib.sha256(json.dumps(snapshot,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:12]
    session_key=f"_period_archive_written_{snapshot['id']}_{fp}"
    if st.session_state.get(session_key):
        return "ok"
    key_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY)
    snap_js=json.dumps(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")))
    weekly_limit=PERIOD_ARCHIVE_WEEKLY_LIMIT
    monthly_limit=PERIOD_ARCHIVE_MONTHLY_LIMIT
    expression=(
        "(()=>{try{"
        f"const key={key_js};const snap=JSON.parse({snap_js});"
        "let arr=[];try{arr=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){arr=[];}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&x.id!==snap.id);arr.push(snap);"
        "const sortDesc=a=>a.sort((x,y)=>String(y.start||'').localeCompare(String(x.start||'')));"
        f"const w=sortDesc(arr.filter(x=>x.period==='weekly')).slice(0,{weekly_limit});"
        f"const m=sortDesc(arr.filter(x=>x.period==='monthly')).slice(0,{monthly_limit});"
        "arr=w.concat(m);localStorage.setItem(key,JSON.stringify(arr));return 'ok';"
        "}catch(e){return 'fail';}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"period_archive_write_{fp}")
    if value is None:
        return None
    if str(value)=="ok":
        st.session_state[session_key]=True
    return str(value)


def _read_period_archive_entries():
    if streamlit_js_eval is None:
        return []
    key_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    expression=(
        "(()=>{try{const v=localStorage.getItem("+key_js+");"
        f"return v===null?{empty_js}:v;"
        f"}}catch(e){{return {empty_js};}}}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"fortune_period_archive_read_{nonce}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return []
    try:
        parsed=json.loads(str(value))
        return parsed if isinstance(parsed,list) else []
    except Exception:
        return []



# ============================================================
# 8-C. WEEKLY / MONTHLY AI INTERPRETER · V6.4
# ============================================================
# 일일 AI와 저장 키를 분리한다. 주간/월간은 같은 기간 + 같은 계산값 + 같은 모델이면
# 브라우저 저장본을 우선 사용하고 Gemini를 다시 호출하지 않는다.
PERIOD_AI_INTERPRETER_VERSION = "v1.0"
PERIOD_AI_STORAGE_KEY = "astro_period_ai_v1"
PERIOD_AI_WEEKLY_LIMIT = 26
PERIOD_AI_MONTHLY_LIMIT = 18
PERIOD_AI_MAX_OUTPUT_TOKENS = 12000

PERIOD_AI_OUTPUT_SHAPE = {
    "headline":"이 기간을 관통하는 핵심을 25자 안팎으로",
    "overall":{
        "summary":"기간 전체의 핵심 흐름을 4~7문장으로",
        "dominant_pattern":"가장 지배적인 교차 패턴을 2~4문장으로",
        "best_phase":"상대적으로 활용하기 좋은 날짜/구간과 이유",
        "caution_phase":"상대적으로 보수적으로 볼 날짜/구간과 이유",
    },
    "priorities":["이 기간에 실제로 우선할 행동 1","행동 2","행동 3"],
    "clusters":{
        "relationship":"연애·연락·재회를 교차한 핵심 분석",
        "work_study":"학업·시험·직장·이직을 교차한 핵심 분석",
        "money_news":"금전·소식·투자 관련 흐름의 핵심 분석",
        "condition":"컨디션과 일정 배치 관점의 핵심 분석",
    },
    "topic_analysis":{
        topic:{
            "verdict":"기간 전체에서 이 분야의 결론",
            "reason":"제공된 날짜별 수치와 기간 집계 근거를 연결한 분석",
            "best_window":"상대적으로 좋은 날짜/구간. 차이가 작으면 차이가 작다고 명시",
            "caution_window":"상대적으로 덜 유리한 날짜/구간. 과장 금지",
            "action":"현실적으로 할 행동 1개",
            "confidence":"높음|보통|낮음",
            "confidence_reason":"확신도 이유",
        } for topic in AI_TOPIC_ORDER
    },
    "limits":"이 해설에서 단정할 수 없는 부분이나 데이터 한계",
}

PERIOD_AI_SYSTEM_PROMPT = """너는 '별빛의 운명' 앱의 기간형 점성술 해설자다.
입력은 이미 점성술 엔진이 계산한 주간 또는 월간의 날짜별 상대지수와 기간 집계다. 너는 계산자가 아니라 분석가다.
반드시 CALCULATED_DATA JSON 안의 값만 사용한다. JSON에 없는 행성 위치, 애스펙트, 하우스, 리턴, 특정 천체 사건을 절대로 만들어내지 마라.
점수는 사건 발생 확률이 아니다. 서로 다른 분야의 점수 크기만 보고 인과관계를 만들지 말고, 같은 분야의 날짜별 변화와 관련 분야의 동행/충돌을 중심으로 읽어라.

주간이면 7일 안의 전환과 날짜 차이를 우선하고, 월간이면 초·중·후반 및 반복되는 고점/저점 구간을 묶어서 설명한다.
단 하루의 최고점 하나를 기간 전체 운세처럼 과장하지 않는다. 최고·최저 차이가 작으면 '날짜 차이가 크지 않다'고 명시한다.
연애·연락·재회, 학업·시험·직장·이직, 금전·소식·컨디션처럼 서로 관련 있는 축을 교차해서 분석하되 숫자만으로 사건을 단정하지 않는다.

연애·연락·재회에서는 특정 사람이 연락한다, 돌아온다, 마음이 있다처럼 타인의 의도나 미래 행동을 단정하지 마라.
컨디션은 질병·진단·치료를 예측하지 않는다.
투자는 가격·수익률·매수/매도 성공을 예측하지 않는다. KRX 휴장일은 장중 매매 신호로 해석하지 않는다.
한국어 반말로 자연스럽고 구체적으로 쓴다. 희망고문과 공포 조장을 모두 피한다.
출력은 JSON만 반환한다."""


def _period_json_scalar(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def _period_row_date(row):
    value=row.get("date") if isinstance(row,dict) else None
    if isinstance(value,datetime):
        return value.date().isoformat()
    if isinstance(value,date):
        return value.isoformat()
    return str(value or row.get("label","") if isinstance(row,dict) else "")


def _period_topic_stats(rows,key):
    points=[]
    for row in rows or []:
        value=row.get(key) if isinstance(row,dict) else None
        if not isinstance(value,(int,float,np.integer,np.floating)):
            continue
        try:
            if pd.isna(value):
                continue
        except Exception:
            pass
        points.append({
            "date":_period_row_date(row),
            "label":str(row.get("label") or _period_row_date(row)),
            "score":float(value),
        })
    if not points:
        return None
    avg=sum(x["score"] for x in points)/len(points)
    high=sorted(points,key=lambda x:x["score"],reverse=True)[:3]
    low=sorted(points,key=lambda x:x["score"])[:3]
    spread=max(x["score"] for x in points)-min(x["score"] for x in points)
    return {
        "average":round(avg,1),
        "band":score_band(avg),
        "spread":round(spread,1),
        "best_days":high,
        "caution_days":low,
        "trajectory":points,
        "rule_summary":period_topic_text(rows,key),
    }


def build_ai_period_payload(kind,start_date,end_date,rows):
    topics={}
    for key in AI_TOPIC_ORDER:
        stats=_period_topic_stats(rows,key)
        if stats:
            topics[key]=stats

    market={"has_open_session":any(bool(r.get("market_open")) for r in (rows or []) if isinstance(r,dict))}
    for key in ["수익실현","신규진입","투자주의"]:
        stats=_period_topic_stats(rows,key)
        if stats:
            market[key]=stats

    days=[]
    for row in rows or []:
        if not isinstance(row,dict):
            continue
        packed={
            "date":_period_row_date(row),
            "label":str(row.get("label") or ""),
            "market_open":bool(row.get("market_open")),
        }
        for key in AI_TOPIC_ORDER+["수익실현","신규진입","투자주의"]:
            packed[key]=_period_json_scalar(row.get(key))
        days.append(packed)

    return {
        "version":PERIOD_AI_INTERPRETER_VERSION,
        "period":kind,
        "start":start_date.isoformat(),
        "end":end_date.isoformat(),
        "day_count":len(days),
        "method_note":"각 날짜는 하루의 여러 시각을 샘플링한 상대지수다. 점수는 사건 확률이 아니며 같은 분야 안의 날짜 변화와 관련 축의 동행/충돌을 읽는 데 사용한다.",
        "topics":topics,
        "market":market,
        "days":days,
    }


def _validate_ai_period_output(obj):
    if not isinstance(obj,dict):
        return None
    overall=obj.get("overall",{})
    if isinstance(overall,str):
        overall={"summary":overall}
    if not isinstance(overall,dict):
        overall={}
    clusters=obj.get("clusters",{})
    if not isinstance(clusters,dict):
        clusters={}

    out={
        "headline":_clean_ai_text(obj.get("headline"),180),
        "overall":{
            "summary":_clean_ai_text(overall.get("summary"),2600),
            "dominant_pattern":_clean_ai_text(overall.get("dominant_pattern"),1400),
            "best_phase":_clean_ai_text(overall.get("best_phase"),1000),
            "caution_phase":_clean_ai_text(overall.get("caution_phase"),1000),
        },
        "clusters":{
            "relationship":_clean_ai_text(clusters.get("relationship"),1600),
            "work_study":_clean_ai_text(clusters.get("work_study"),1600),
            "money_news":_clean_ai_text(clusters.get("money_news"),1600),
            "condition":_clean_ai_text(clusters.get("condition"),1200),
        },
        "limits":_clean_ai_text(obj.get("limits"),1000),
    }
    priorities=obj.get("priorities",[])
    out["priorities"]=[_clean_ai_text(x,300) for x in priorities[:3] if _clean_ai_text(x,300)] if isinstance(priorities,list) else []

    analyses=obj.get("topic_analysis",{})
    out["topic_analysis"]={}
    if isinstance(analyses,dict):
        for topic in AI_TOPIC_ORDER:
            item=analyses.get(topic,{})
            if isinstance(item,str):
                item={"verdict":item}
            if not isinstance(item,dict):
                continue
            confidence=_clean_ai_text(item.get("confidence"),20)
            if confidence not in {"높음","보통","낮음"}:
                confidence="보통"
            cleaned={
                "verdict":_clean_ai_text(item.get("verdict"),550),
                "reason":_clean_ai_text(item.get("reason"),1700),
                "best_window":_clean_ai_text(item.get("best_window"),900),
                "caution_window":_clean_ai_text(item.get("caution_window"),900),
                "action":_clean_ai_text(item.get("action"),550),
                "confidence":confidence,
                "confidence_reason":_clean_ai_text(item.get("confidence_reason"),550),
            }
            if any(cleaned[k] for k in ["verdict","reason","best_window","caution_window","action"]):
                out["topic_analysis"][topic]=cleaned

    if not out["overall"]["summary"] and not out["topic_analysis"]:
        return None
    return out


def _call_gemini_period_once(payload_json,model_name,thinking_level,api_key):
    model_name=(model_name or AI_DEFAULT_MODEL).strip()
    safe_model=urllib.parse.quote(model_name,safe="-._")
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"
    user_prompt=(
        "아래 기간 계산 JSON을 종합 해석해. JSON에 없는 천체 근거를 만들지 마. "
        "topic_analysis에는 제공된 10개 생활 분야를 모두 채워. 주간과 월간의 시간 단위를 구분해.\n\n"
        "OUTPUT_SHAPE:\n"+json.dumps(PERIOD_AI_OUTPUT_SHAPE,ensure_ascii=False,separators=(",",":"))+"\n\n"
        "CALCULATED_DATA:\n"+payload_json
    )
    body={
        "systemInstruction":{"parts":[{"text":PERIOD_AI_SYSTEM_PROMPT}]},
        "contents":[{"role":"user","parts":[{"text":user_prompt}]}],
        "generationConfig":{
            "maxOutputTokens":PERIOD_AI_MAX_OUTPUT_TOKENS,
            "responseMimeType":"application/json",
            "thinkingConfig":{"thinkingLevel":thinking_level},
        },
    }
    req=urllib.request.Request(
        url,
        data=json.dumps(body,ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type":"application/json","x-goog-api-key":api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req,timeout=70) as resp:
            raw=json.loads(resp.read().decode("utf-8"))
        parts=raw.get("candidates",[{}])[0].get("content",{}).get("parts",[])
        response_text="".join(p.get("text","") for p in parts if isinstance(p,dict) and not p.get("thought")).strip()
        if not response_text:
            response_text="".join(p.get("text","") for p in parts if isinstance(p,dict)).strip()
        if response_text.startswith("```"):
            lines=response_text.splitlines()
            if lines and lines[0].lstrip().startswith("```"):
                lines=lines[1:]
            if lines and lines[-1].strip()=="```":
                lines=lines[:-1]
            response_text="\n".join(lines).strip()
        obj=json.loads(response_text)
        valid=_validate_ai_period_output(obj)
        if not valid:
            return {"ok":False,"error":"기간형 AI 응답 구조를 검증하지 못했어.","model":model_name}
        usage=_gemini_usage_summary(raw,model_name)
        return {"ok":True,"data":valid,"model":model_name,"usage":usage,"period_ai_version":PERIOD_AI_INTERPRETER_VERSION}
    except urllib.error.HTTPError as exc:
        try:
            detail=exc.read().decode("utf-8",errors="replace")[:1200]
        except Exception:
            detail=str(exc)
        return {"ok":False,"error":f"Gemini HTTP {getattr(exc,'code','?')} · {detail}","error_code":getattr(exc,"code",None),"model":model_name}
    except Exception as exc:
        return {"ok":False,"error":f"기간형 AI 호출 실패: {type(exc).__name__}: {exc}","model":model_name}


@st.cache_data(ttl=30*86400,show_spinner=False)
def cached_ai_period_interpretation(payload_json,preferred_model,thinking_level,key_fingerprint):
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"missing_key":True,"error":"GEMINI_API_KEY가 설정되지 않았어."}
    preferred_model=preferred_model if preferred_model in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL
    thinking_level=thinking_level if thinking_level in AI_ALLOWED_THINKING_LEVELS else AI_DEFAULT_THINKING_LEVEL
    primary=_call_gemini_period_once(payload_json,preferred_model,thinking_level,api_key)
    if primary.get("ok"):
        primary["preferred_model"]=preferred_model
        primary["thinking_level"]=thinking_level
        primary["used_fallback"]=False
        return primary
    can_fallback=(
        preferred_model=="gemini-3.7-flash"
        and AI_FALLBACK_MODEL!=preferred_model
        and primary.get("error_code") not in {401,403}
    )
    if can_fallback:
        fallback=_call_gemini_period_once(payload_json,AI_FALLBACK_MODEL,thinking_level,api_key)
        if fallback.get("ok"):
            fallback["preferred_model"]=preferred_model
            fallback["thinking_level"]=thinking_level
            fallback["used_fallback"]=True
            fallback["fallback_from"]=preferred_model
            return fallback
        return {
            "ok":False,
            "error":primary.get("error","기간형 AI 호출 실패"),
            "primary_error":primary,
            "fallback_error":fallback,
            "preferred_model":preferred_model,
            "thinking_level":thinking_level,
        }
    primary["preferred_model"]=preferred_model
    primary["thinking_level"]=thinking_level
    primary["used_fallback"]=False
    return primary


def _period_ai_id(kind,start_date,end_date):
    return f"{kind}:{start_date.isoformat()}:{end_date.isoformat()}"


def _read_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level):
    if streamlit_js_eval is None:
        return ""
    key_js=json.dumps(PERIOD_AI_STORAGE_KEY)
    id_js=json.dumps(_period_ai_id(kind,start_date,end_date))
    hash_js=json.dumps(payload_hash)
    model_js=json.dumps(model)
    thinking_js=json.dumps(thinking_level)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    expression=(
        "(()=>{try{"
        f"const key={key_js},id={id_js},ph={hash_js},model={model_js},thinking={thinking_js};"
        "let arr=[];try{arr=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){arr=[];}"
        "if(!Array.isArray(arr))arr=[];"
        "const x=arr.find(v=>v&&v.id===id&&v.payload_hash===ph&&v.model===model&&v.thinking_level===thinking);"
        f"return x?JSON.stringify(x):{empty_js};"
        f"}}catch(e){{return {empty_js};}}}})()"
    )
    cache_key=hashlib.sha256(f"{kind}|{start_date}|{end_date}|{payload_hash}|{model}|{thinking_level}".encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=expression,key=f"period_ai_read_{cache_key}")


def _write_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level,result):
    if streamlit_js_eval is None or not result or not result.get("ok"):
        return None
    item={
        "id":_period_ai_id(kind,start_date,end_date),
        "period":kind,
        "start":start_date.isoformat(),
        "end":end_date.isoformat(),
        "payload_hash":payload_hash,
        "model":model,
        "thinking_level":thinking_level,
        "saved_at":int(time.time()),
        "result":result,
    }
    key_js=json.dumps(PERIOD_AI_STORAGE_KEY)
    item_js=json.dumps(json.dumps(item,ensure_ascii=False,separators=(",",":")))
    expression=(
        "(()=>{try{"
        f"const key={key_js};const item=JSON.parse({item_js});"
        "let arr=[];try{arr=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){arr=[];}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&x.id!==item.id);arr.push(item);"
        "const sortDesc=a=>a.sort((x,y)=>String(y.start||'').localeCompare(String(x.start||'')));"
        f"const w=sortDesc(arr.filter(x=>x.period==='weekly')).slice(0,{PERIOD_AI_WEEKLY_LIMIT});"
        f"const m=sortDesc(arr.filter(x=>x.period==='monthly')).slice(0,{PERIOD_AI_MONTHLY_LIMIT});"
        "localStorage.setItem(key,JSON.stringify(w.concat(m)));return 'ok';"
        "}catch(e){return 'fail';}})()"
    )
    fp=hashlib.sha256(json.dumps(item,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=expression,key=f"period_ai_write_{fp}")


def _read_period_ai_archive_entries():
    if streamlit_js_eval is None:
        return []
    key_js=json.dumps(PERIOD_AI_STORAGE_KEY)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    expression=(
        "(()=>{try{const v=localStorage.getItem("+key_js+");"
        f"return v===null?{empty_js}:v;"
        f"}}catch(e){{return {empty_js};}}}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"fortune_period_ai_archive_read_{nonce}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return []
    try:
        parsed=json.loads(str(value))
        return parsed if isinstance(parsed,list) else []
    except Exception:
        return []


def get_ai_period_interpretation(kind,start_date,end_date,rows,preferred_model=None):
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"missing_key":True,"error":"GEMINI_API_KEY가 설정되지 않았어."}
    model=preferred_model if preferred_model in AI_SUPPORTED_MODELS else _ai_model()
    thinking_level=_ai_thinking_level()
    key_fp=hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]
    payload=build_ai_period_payload(kind,start_date,end_date,rows)
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    payload_hash=hashlib.sha256(payload_json.encode("utf-8")).hexdigest()[:24]

    if streamlit_js_eval is not None:
        raw=_read_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level)
        wait_key=f"_period_ai_cache_wait_{kind}_{start_date}_{payload_hash}_{model}_{thinking_level}"
        if raw is None:
            waits=int(st.session_state.get(wait_key,0) or 0)+1
            st.session_state[wait_key]=waits
            if waits<=1:
                return {"ok":False,"cache_waiting":True}
        else:
            st.session_state.pop(wait_key,None)
            if str(raw)!=REMEMBER_EMPTY_SENTINEL:
                try:
                    stored=json.loads(str(raw))
                    result=stored.get("result",{}) if isinstance(stored,dict) else {}
                    valid=_validate_ai_period_output(result.get("data")) if isinstance(result,dict) else None
                    if result.get("ok") and valid and result.get("period_ai_version")==PERIOD_AI_INTERPRETER_VERSION:
                        result=dict(result)
                        result["data"]=valid
                        result["cache_source"]="browser"
                        return result
                except Exception:
                    pass

    result=cached_ai_period_interpretation(payload_json,model,thinking_level,key_fp)
    if result and result.get("ok"):
        result=dict(result)
        result["cache_source"]=result.get("cache_source","server_or_api")
        result["period_meta"]={
            "period":kind,
            "start":start_date.isoformat(),
            "end":end_date.isoformat(),
        }
        _write_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level,result)
    return result


def render_ai_period_overview(ai_result,period_label=""):
    if not ai_result or not ai_result.get("ok"):
        if ai_result and ai_result.get("missing_key"):
            st.info("✨ 기간형 AI 정밀해설은 준비되어 있어. Streamlit Secrets의 GEMINI_API_KEY를 확인해줘.")
        elif ai_result and ai_result.get("error"):
            st.caption("✨ 기간형 AI 해설을 이번에는 불러오지 못했어. 기본 계산 리포트는 정상 동작해. · "+str(ai_result.get("error")))
        return None

    data=ai_result.get("data",{})
    headline=html.escape(data.get("headline") or "기간 정밀 분석")
    overall=data.get("overall",{}) if isinstance(data.get("overall"),dict) else {}
    summary=html.escape(overall.get("summary","") or "")
    dominant=html.escape(overall.get("dominant_pattern","") or "")
    best_phase=html.escape(overall.get("best_phase","") or "")
    caution_phase=html.escape(overall.get("caution_phase","") or "")
    priorities=data.get("priorities",[]) if isinstance(data.get("priorities"),list) else []
    chips="".join(f"<span class='ai-chip'>{html.escape(str(x))}</span>" for x in priorities[:3])

    st.markdown(
        f"<div class='ai-overview'>"
        f"<div class='ai-kicker'>AI PERIOD DEEP INTERPRETATION</div>"
        f"<div class='ai-head'>✨ {headline}</div>"
        f"<div class='ai-body'>{dominant or summary}</div>"
        f"<div style='margin-top:9px'>{chips}</div>"
        f"</div>",
        unsafe_allow_html=True,
    )

    with st.expander("🔎 기간 AI 종합 정밀해설 펼치기",expanded=False):
        if period_label:
            st.caption(period_label)
        if summary:
            st.markdown(f"<div class='ai-body'>{summary}</div>",unsafe_allow_html=True)
        if best_phase:
            st.markdown(f"<div class='ai-analysis'><div class='ai-row'><span class='ai-label'>활용 구간</span>{best_phase}</div></div>",unsafe_allow_html=True)
        if caution_phase:
            st.markdown(f"<div class='ai-analysis'><div class='ai-row'><span class='ai-label'>주의 구간</span>{caution_phase}</div></div>",unsafe_allow_html=True)

        clusters=data.get("clusters",{}) if isinstance(data.get("clusters"),dict) else {}
        cluster_html=[]
        for label,key in [("💖 관계","relationship"),("📚 공부·진로","work_study"),("💵 돈·소식","money_news"),("🌿 컨디션","condition")]:
            value=clusters.get(key,"")
            if value:
                cluster_html.append(f"<div class='ai-cluster'><strong>{label}</strong><br>{html.escape(str(value))}</div>")
        if cluster_html:
            st.markdown(f"<div class='ai-grid'>{''.join(cluster_html)}</div>",unsafe_allow_html=True)

        analyses=data.get("topic_analysis",{}) if isinstance(data.get("topic_analysis"),dict) else {}
        if analyses:
            st.markdown("#### 분야별 AI 해설")
        for topic in AI_TOPIC_ORDER:
            info=analyses.get(topic,{}) if isinstance(analyses,dict) else {}
            if not isinstance(info,dict) or not info:
                continue
            body=[]
            if info.get("verdict"): body.append(f"<div class='ai-verdict'>{html.escape(info['verdict'])}</div>")
            if info.get("reason"): body.append(f"<div class='ai-row'>{html.escape(info['reason'])}</div>")
            if info.get("best_window"): body.append(f"<div class='ai-row'><span class='ai-label'>좋은 구간</span>{html.escape(info['best_window'])}</div>")
            if info.get("caution_window"): body.append(f"<div class='ai-row'><span class='ai-label'>주의 구간</span>{html.escape(info['caution_window'])}</div>")
            if info.get("action"): body.append(f"<div class='ai-row'><span class='ai-label'>행동</span>{html.escape(info['action'])}</div>")
            confidence=html.escape(info.get("confidence","보통"))
            reason=html.escape(info.get("confidence_reason","") or "")
            body.append(f"<span class='ai-confidence'>확신도 {confidence}</span> {reason}")
            st.markdown(f"<div class='ai-analysis'><strong>{TOPIC_SPECS[topic]['icon']} {DISPLAY_LABELS[topic]}</strong>{''.join(body)}</div>",unsafe_allow_html=True)

        if data.get("limits"):
            st.caption("해설 한계 · "+str(data.get("limits")))

    cache_source=ai_result.get("cache_source","")
    if cache_source in {"browser","archive"}:
        st.caption("⚡ 저장된 기간 AI 해설 사용 · Gemini API 재호출 0회.")
    else:
        st.caption("⚡ 이 기간의 새 AI 해설을 저장했어. 같은 계산값으로 다시 열면 Gemini API를 재호출하지 않아.")

    usage=ai_result.get("usage",{}) if isinstance(ai_result.get("usage"),dict) else {}
    if usage and usage.get("total_tokens"):
        p=usage.get("prompt_tokens",0); c=usage.get("candidate_tokens",0); t=usage.get("thought_tokens",0)
        cost_usd=usage.get("estimated_usd"); cost_krw=usage.get("estimated_krw")
        cost_text=""
        if isinstance(cost_usd,(int,float)):
            cost_text=f" · 최초 생성 예상비용 ${cost_usd:.4f}"
            if isinstance(cost_krw,(int,float)):
                cost_text+=f" ≈ {cost_krw:,.0f}원"
        st.caption(f"🧾 최초 생성 사용량 · 입력 {p:,} · 본문출력 {c:,} · 사고 {t:,} tokens{cost_text} · 저장본 재열람은 0원")

    model_caption="모델 · "+str(ai_result.get("model",AI_DEFAULT_MODEL))
    if ai_result.get("used_fallback"):
        model_caption+=f" · {ai_result.get('fallback_from')} 실패 후 자동 대체"
    model_caption+=f" · thinking {ai_result.get('thinking_level',AI_DEFAULT_THINKING_LEVEL)}"
    st.caption(model_caption)
    return data



# ============================================================
# 8-D. ANNUAL AI INTERPRETER / ARCHIVE · V6.5
# ============================================================
ANNUAL_AI_INTERPRETER_VERSION = "v1.0"
ANNUAL_ARCHIVE_STORAGE_KEY = "astro_annual_archive_v1"
ANNUAL_ARCHIVE_LIMIT = 8
ANNUAL_AI_MAX_OUTPUT_TOKENS = 14000
ANNUAL_LONG_BODIES = ["Jupiter","Saturn","Uranus","Neptune","Pluto"]

ANNUAL_AI_OUTPUT_SHAPE = {
    "headline":"한 해를 관통하는 핵심을 25자 안팎으로",
    "overall":{
        "summary":"한 해 전체 흐름을 5~8문장으로",
        "year_theme":"가장 지배적인 연간 패턴을 2~4문장으로",
        "turning_points":"분기 또는 월 단위의 주요 전환 구간을 근거와 함께",
    },
    "quarters":{
        "Q1":"1~3월의 핵심 흐름",
        "Q2":"4~6월의 핵심 흐름",
        "Q3":"7~9월의 핵심 흐름",
        "Q4":"10~12월의 핵심 흐름",
    },
    "months":{str(m):f"{m}월 핵심을 1~3문장" for m in range(1,13)},
    "priorities":["올해 우선할 행동 1","행동 2","행동 3"],
    "clusters":{
        "relationship":"연애·연락·재회를 연간 관점에서 교차 분석",
        "work_study":"학업·시험·직장·이직을 연간 관점에서 교차 분석",
        "money_news":"금전·소식·투자심리를 연간 관점에서 교차 분석",
        "condition":"컨디션과 일정 배치의 연간 흐름",
    },
    "topic_analysis":{
        topic:{
            "verdict":"올해 이 분야의 결론",
            "reason":"월별·분기별 계산 근거를 연결한 분석",
            "best_window":"상대적으로 활용하기 좋은 월/구간",
            "caution_window":"상대적으로 보수적으로 볼 월/구간",
            "action":"올해 현실적으로 가져갈 행동",
            "confidence":"높음|보통|낮음",
            "confidence_reason":"확신도 이유",
        } for topic in AI_TOPIC_ORDER
    },
    "solar_return":"제공된 Solar Return 시각의 의미와 해석 한계",
    "long_transits":"제공된 월별 장기 트랜짓 스냅샷에서 반복되는 패턴. 정확일로 오인하지 않게 설명",
    "limits":"연간 해설에서 단정할 수 없는 부분과 데이터 한계",
}

ANNUAL_AI_SYSTEM_PROMPT = """너는 '별빛의 운명' 앱의 연간 점성술 해설자다.
입력은 앱 엔진이 계산한 12개월의 일별 다중시각 집계, 분기 요약, Solar Return 정확 시각, 그리고 매월 중순에 샘플링한 장기 트랜짓 스냅샷이다.
너는 계산자가 아니라 분석가다. 반드시 CALCULATED_DATA JSON 안에 있는 값만 사용한다.

월별 점수는 사건 발생 확률이 아니다. 같은 분야의 월별 변화와 관련 분야의 동행/충돌을 중심으로 읽는다.
단일 최고월 하나를 한 해 전체처럼 과장하지 말고, 분기와 반복 패턴을 우선한다.
월별 장기 트랜짓은 매월 15일의 스냅샷이므로 '정확한 완성일'이라고 말하지 마라. 반복 등장하는 장기 배경과 압력으로만 사용한다.
Solar Return의 정확 시각은 사용할 수 있지만 실제 회귀 시점 체류 위치를 입력받지 않았으므로 Solar Return 하우스/ASC/MC를 추정하거나 만들어내지 마라.

연애·연락·재회에서는 특정 사람이 반드시 연락한다, 돌아온다, 마음이 있다처럼 타인의 의도나 미래 행동을 단정하지 않는다.
시험·학업은 준비도와 실제 공부가 우선이며 합격을 확정하지 않는다.
컨디션은 질병·진단·치료를 예측하지 않는다.
투자는 가격·수익률·종목의 매수·매도 성공을 예측하지 않는다.
희망고문과 공포 조장을 모두 피하고, 신호가 엇갈리거나 약하면 그대로 말한다.
한국어 반말로 자연스럽고 구체적으로 쓴다. 출력은 JSON만 반환한다."""


def _annual_compact_stats(rows,key):
    stats=_period_topic_stats(rows,key)
    if not stats:
        return None
    return {
        "average":stats.get("average"),
        "band":stats.get("band"),
        "spread":stats.get("spread"),
        "best_days":(stats.get("best_days") or [])[:2],
        "caution_days":(stats.get("caution_days") or [])[:2],
    }


def _annual_month_summary(year_value,month_value,natal_packed,houses_packed):
    first=date(int(year_value),int(month_value),1)
    day_count=calendar.monthrange(first.year,first.month)[1]
    last=date(first.year,first.month,day_count)
    rows=cached_period_scores(first.isoformat(),day_count,natal_packed,houses_packed)
    topics={}
    for key in AI_TOPIC_ORDER:
        compact=_annual_compact_stats(rows,key)
        if compact:
            topics[key]=compact
    market={}
    for key in ["수익실현","신규진입","투자주의"]:
        compact=_annual_compact_stats(rows,key)
        if compact:
            market[key]=compact
    return {
        "month":first.month,
        "start":first.isoformat(),
        "end":last.isoformat(),
        "topics":topics,
        "market":market,
    }


def _annual_topic_from_months(months,key):
    points=[]
    for month in months:
        info=(month.get("topics",{}) or {}).get(key)
        if info and isinstance(info.get("average"),(int,float)):
            points.append({"month":month["month"],"score":float(info["average"])})
    if not points:
        return None
    avg=sum(x["score"] for x in points)/len(points)
    best=sorted(points,key=lambda x:x["score"],reverse=True)[:3]
    caution=sorted(points,key=lambda x:x["score"])[:3]
    return {
        "average":round(avg,1),
        "band":score_band(avg),
        "spread":round(max(x["score"] for x in points)-min(x["score"] for x in points),1),
        "best_months":best,
        "caution_months":caution,
        "trajectory":points,
    }


def _annual_quarter_summaries(months):
    result={}
    for q in range(4):
        subset=[m for m in months if q*3+1 <= int(m.get("month",0)) <= q*3+3]
        q_topics={}
        for key in AI_TOPIC_ORDER:
            vals=[]
            for month in subset:
                info=(month.get("topics",{}) or {}).get(key)
                if info and isinstance(info.get("average"),(int,float)):
                    vals.append(float(info["average"]))
            if vals:
                q_topics[key]=round(sum(vals)/len(vals),1)
        result[f"Q{q+1}"]={
            "months":[m.get("month") for m in subset],
            "topics":q_topics,
        }
    return result


def _annual_solar_return(year_value,natal_lons):
    center=KST.localize(datetime(int(year_value),7,1,12,0)).astimezone(UTC)
    result=find_returns_near("Sun",natal_lons["Sun"],center)
    roots=[]
    for root in result.get("all",[]) or []:
        local=root.astimezone(KST)
        if local.year==int(year_value):
            roots.append(local)
    if not roots:
        return None
    # 한 해에 태양회귀는 하나이므로 해당 연도의 첫 유효 교차를 사용한다.
    exact=sorted(roots)[0]
    return {
        "exact_kst":exact.strftime("%Y-%m-%d %H:%M:%S KST"),
        "note":"정확 회귀 시각만 계산. 회귀 시점의 실제 체류 위치를 모르므로 Solar Return 하우스/ASC/MC는 계산하지 않음.",
    }


def _annual_long_transit_snapshots(year_value,natal_lons,natal_houses):
    out=[]
    for month in range(1,13):
        local=KST.localize(datetime(int(year_value),month,15,12,0))
        _,records=build_transit_records_subset(local.astimezone(UTC),natal_lons,natal_houses,ANNUAL_LONG_BODIES)
        picked=[]
        for rec in sorted(records,key=lambda r:(r.get("orb",99),-r.get("orb_weight",0))):
            if rec.get("orb",99)>1.8:
                continue
            picked.append({
                "transit":rec.get("transit"),
                "target":rec.get("target"),
                "aspect":rec.get("name"),
                "orb":round(float(rec.get("orb",0)),2),
                "motion":rec.get("motion"),
                "direction":rec.get("direction"),
                "whole_house":rec.get("whole_house"),
                "placidus_house":rec.get("placidus_house"),
            })
            if len(picked)>=4:
                break
        out.append({"month":month,"sample_date":local.date().isoformat(),"aspects":picked})
    return out


@st.cache_data(ttl=180*86400,show_spinner=False)
def cached_annual_payload(year_value,natal_packed,houses_packed):
    year_value=int(year_value)
    natal_lons=unpack_natal_lons(natal_packed)
    natal_houses=unpack_houses(houses_packed)
    months=[_annual_month_summary(year_value,m,natal_packed,houses_packed) for m in range(1,13)]
    annual_topics={}
    for key in AI_TOPIC_ORDER:
        stats=_annual_topic_from_months(months,key)
        if stats:
            annual_topics[key]=stats
    return {
        "version":ANNUAL_AI_INTERPRETER_VERSION,
        "year":year_value,
        "method_note":"각 월은 그 달의 모든 날짜를 하루 다중시각으로 계산한 뒤 월 단위로 압축했다. 분기는 월 평균을 다시 집계한다. 점수는 사건 확률이 아니다.",
        "months":months,
        "quarters":_annual_quarter_summaries(months),
        "annual_topics":annual_topics,
        "solar_return":_annual_solar_return(year_value,natal_lons),
        "long_transits":_annual_long_transit_snapshots(year_value,natal_lons,natal_houses),
        "long_transit_note":"장기 트랜짓은 매월 15일 12:00 KST 스냅샷이다. 정확한 애스펙트 완성일 목록이 아니라 연간 배경 추세용이다.",
    }


def _validate_ai_annual_output(obj):
    if not isinstance(obj,dict):
        return None
    overall=obj.get("overall",{})
    if isinstance(overall,str):
        overall={"summary":overall}
    if not isinstance(overall,dict):
        overall={}
    quarters=obj.get("quarters",{}) if isinstance(obj.get("quarters"),dict) else {}
    months=obj.get("months",{}) if isinstance(obj.get("months"),dict) else {}
    clusters=obj.get("clusters",{}) if isinstance(obj.get("clusters"),dict) else {}
    out={
        "headline":_clean_ai_text(obj.get("headline"),200),
        "overall":{
            "summary":_clean_ai_text(overall.get("summary"),3200),
            "year_theme":_clean_ai_text(overall.get("year_theme"),1800),
            "turning_points":_clean_ai_text(overall.get("turning_points"),1800),
        },
        "quarters":{f"Q{i}":_clean_ai_text(quarters.get(f"Q{i}"),1400) for i in range(1,5)},
        "months":{str(i):_clean_ai_text(months.get(str(i)),900) for i in range(1,13)},
        "clusters":{
            "relationship":_clean_ai_text(clusters.get("relationship"),1900),
            "work_study":_clean_ai_text(clusters.get("work_study"),1900),
            "money_news":_clean_ai_text(clusters.get("money_news"),1900),
            "condition":_clean_ai_text(clusters.get("condition"),1500),
        },
        "solar_return":_clean_ai_text(obj.get("solar_return"),1400),
        "long_transits":_clean_ai_text(obj.get("long_transits"),1800),
        "limits":_clean_ai_text(obj.get("limits"),1200),
    }
    priorities=obj.get("priorities",[])
    out["priorities"]=[_clean_ai_text(x,320) for x in priorities[:3] if _clean_ai_text(x,320)] if isinstance(priorities,list) else []
    analyses=obj.get("topic_analysis",{})
    out["topic_analysis"]={}
    if isinstance(analyses,dict):
        for topic in AI_TOPIC_ORDER:
            item=analyses.get(topic,{})
            if isinstance(item,str):
                item={"verdict":item}
            if not isinstance(item,dict):
                continue
            confidence=_clean_ai_text(item.get("confidence"),20)
            if confidence not in {"높음","보통","낮음"}:
                confidence="보통"
            cleaned={
                "verdict":_clean_ai_text(item.get("verdict"),650),
                "reason":_clean_ai_text(item.get("reason"),1900),
                "best_window":_clean_ai_text(item.get("best_window"),1000),
                "caution_window":_clean_ai_text(item.get("caution_window"),1000),
                "action":_clean_ai_text(item.get("action"),650),
                "confidence":confidence,
                "confidence_reason":_clean_ai_text(item.get("confidence_reason"),650),
            }
            if any(cleaned[k] for k in ["verdict","reason","best_window","caution_window","action"]):
                out["topic_analysis"][topic]=cleaned
    if not out["overall"]["summary"] and not out["topic_analysis"]:
        return None
    return out


def _call_gemini_annual_once(payload_json,model_name,thinking_level,api_key):
    model_name=(model_name or AI_DEFAULT_MODEL).strip()
    safe_model=urllib.parse.quote(model_name,safe="-._")
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"
    user_prompt=(
        "아래 연간 계산 JSON을 종합 해석해. JSON에 없는 천체/사건을 만들지 마. "
        "12개월과 4분기를 빠짐없이 다루되 숫자를 기계적으로 나열하지 말고 패턴을 분석해.\n\n"
        "OUTPUT_SHAPE:\n"+json.dumps(ANNUAL_AI_OUTPUT_SHAPE,ensure_ascii=False,separators=(",",":"))+"\n\n"
        "CALCULATED_DATA:\n"+payload_json
    )
    body={
        "systemInstruction":{"parts":[{"text":ANNUAL_AI_SYSTEM_PROMPT}]},
        "contents":[{"role":"user","parts":[{"text":user_prompt}]}],
        "generationConfig":{
            "maxOutputTokens":ANNUAL_AI_MAX_OUTPUT_TOKENS,
            "responseMimeType":"application/json",
            "thinkingConfig":{"thinkingLevel":thinking_level},
        },
    }
    req=urllib.request.Request(
        url,
        data=json.dumps(body,ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type":"application/json","x-goog-api-key":api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req,timeout=90) as resp:
            raw=json.loads(resp.read().decode("utf-8"))
        parts=raw.get("candidates",[{}])[0].get("content",{}).get("parts",[])
        response_text="".join(p.get("text","") for p in parts if isinstance(p,dict) and not p.get("thought")).strip()
        if not response_text:
            response_text="".join(p.get("text","") for p in parts if isinstance(p,dict)).strip()
        if response_text.startswith("```"):
            lines=response_text.splitlines()
            if lines and lines[0].lstrip().startswith("```"):
                lines=lines[1:]
            if lines and lines[-1].strip()=="```":
                lines=lines[:-1]
            response_text="\n".join(lines).strip()
        obj=json.loads(response_text)
        valid=_validate_ai_annual_output(obj)
        if not valid:
            return {"ok":False,"error":"연간 AI 응답 구조를 검증하지 못했어.","model":model_name}
        return {
            "ok":True,
            "data":valid,
            "model":model_name,
            "usage":_gemini_usage_summary(raw,model_name),
            "annual_ai_version":ANNUAL_AI_INTERPRETER_VERSION,
        }
    except urllib.error.HTTPError as exc:
        try: detail=exc.read().decode("utf-8",errors="replace")[:1400]
        except Exception: detail=str(exc)
        return {"ok":False,"error":f"Gemini HTTP {getattr(exc,'code','?')} · {detail}","error_code":getattr(exc,"code",None),"model":model_name}
    except Exception as exc:
        return {"ok":False,"error":f"연간 AI 호출 실패: {type(exc).__name__}: {exc}","model":model_name}


@st.cache_data(ttl=370*86400,show_spinner=False)
def cached_ai_annual_interpretation(payload_json,preferred_model,thinking_level,key_fingerprint):
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"missing_key":True,"error":"GEMINI_API_KEY가 설정되지 않았어."}
    preferred_model=preferred_model if preferred_model in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL
    thinking_level=thinking_level if thinking_level in AI_ALLOWED_THINKING_LEVELS else AI_DEFAULT_THINKING_LEVEL
    primary=_call_gemini_annual_once(payload_json,preferred_model,thinking_level,api_key)
    if primary.get("ok"):
        primary["preferred_model"]=preferred_model
        primary["thinking_level"]=thinking_level
        primary["used_fallback"]=False
        return primary
    can_fallback=(preferred_model=="gemini-3.7-flash" and AI_FALLBACK_MODEL!=preferred_model and primary.get("error_code") not in {401,403})
    if can_fallback:
        fallback=_call_gemini_annual_once(payload_json,AI_FALLBACK_MODEL,thinking_level,api_key)
        if fallback.get("ok"):
            fallback["preferred_model"]=preferred_model
            fallback["thinking_level"]=thinking_level
            fallback["used_fallback"]=True
            fallback["fallback_from"]=preferred_model
            return fallback
        return {"ok":False,"error":primary.get("error","연간 AI 호출 실패"),"primary_error":primary,"fallback_error":fallback,"preferred_model":preferred_model,"thinking_level":thinking_level}
    primary["preferred_model"]=preferred_model
    primary["thinking_level"]=thinking_level
    primary["used_fallback"]=False
    return primary


def _read_annual_archive_entries():
    if streamlit_js_eval is None:
        return []
    key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    expression=(
        "(()=>{try{const v=localStorage.getItem("+key_js+");"
        f"return v===null?{empty_js}:v;"
        f"}}catch(e){{return {empty_js};}}}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"fortune_annual_archive_read_{nonce}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return []
    try:
        parsed=json.loads(str(value))
        return parsed if isinstance(parsed,list) else []
    except Exception:
        return []


def _read_annual_year_entry(year_value):
    if streamlit_js_eval is None:
        return ""
    key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    year_js=json.dumps(int(year_value))
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    expression=(
        "(()=>{try{"
        f"const key={key_js},year={year_js};"
        "let arr=[];try{arr=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){arr=[];}"
        "if(!Array.isArray(arr))arr=[];const x=arr.find(v=>v&&Number(v.year)===Number(year));"
        f"return x?JSON.stringify(x):{empty_js};"
        f"}}catch(e){{return {empty_js};}}}})()"
    )
    return streamlit_js_eval(js_expressions=expression,key=f"annual_year_read_{int(year_value)}")


def _write_annual_entry(year_value,payload,model,thinking_level,result):
    if streamlit_js_eval is None or not result or not result.get("ok"):
        return None
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    item={
        "id":f"annual:{int(year_value)}",
        "period":"annual",
        "year":int(year_value),
        "payload_hash":hashlib.sha256(payload_json.encode("utf-8")).hexdigest()[:24],
        "model":model,
        "thinking_level":thinking_level,
        "saved_at":int(time.time()),
        "payload":payload,
        "result":result,
    }
    key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    item_js=json.dumps(json.dumps(item,ensure_ascii=False,separators=(",",":")))
    expression=(
        "(()=>{try{"
        f"const key={key_js};const item=JSON.parse({item_js});"
        "let arr=[];try{arr=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){arr=[];}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&Number(x.year)!==Number(item.year));arr.push(item);"
        f"arr.sort((a,b)=>Number(b.year||0)-Number(a.year||0));arr=arr.slice(0,{ANNUAL_ARCHIVE_LIMIT});"
        "localStorage.setItem(key,JSON.stringify(arr));return 'ok';"
        "}catch(e){return 'fail';}})()"
    )
    fp=hashlib.sha256(json.dumps(item,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=expression,key=f"annual_write_{fp}")


def generate_ai_annual_interpretation(payload,preferred_model=None):
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"missing_key":True,"error":"GEMINI_API_KEY가 설정되지 않았어."}
    model=preferred_model if preferred_model in AI_SUPPORTED_MODELS else _ai_model()
    thinking_level=_ai_thinking_level()
    key_fp=hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    result=cached_ai_annual_interpretation(payload_json,model,thinking_level,key_fp)
    if result and result.get("ok"):
        result=dict(result)
        result["cache_source"]=result.get("cache_source","server_or_api")
        _write_annual_entry(payload.get("year"),payload,model,thinking_level,result)
    return result


def render_ai_annual_overview(ai_result,payload,archive=False):
    if not ai_result or not ai_result.get("ok"):
        if ai_result and ai_result.get("missing_key"):
            st.info("✨ 연간 AI 정밀해설을 쓰려면 Streamlit Secrets의 GEMINI_API_KEY를 확인해줘.")
        elif ai_result and ai_result.get("error"):
            st.caption("✨ 연간 AI 해설을 이번에는 불러오지 못했어. · "+str(ai_result.get("error")))
        return None
    data=ai_result.get("data",{})
    year_value=int((payload or {}).get("year") or 0)
    headline=html.escape(data.get("headline") or f"{year_value}년 연간 정밀 분석")
    overall=data.get("overall",{}) if isinstance(data.get("overall"),dict) else {}
    summary=html.escape(overall.get("summary","") or "")
    theme=html.escape(overall.get("year_theme","") or "")
    turns=html.escape(overall.get("turning_points","") or "")
    priorities=data.get("priorities",[]) if isinstance(data.get("priorities"),list) else []
    chips="".join(f"<span class='ai-chip'>{html.escape(str(x))}</span>" for x in priorities[:3])
    st.markdown(
        f"<div class='ai-overview'><div class='ai-kicker'>ANNUAL DEEP INTERPRETATION</div>"
        f"<div class='ai-head'>🌌 {headline}</div><div class='ai-body'>{theme or summary}</div>"
        f"<div style='margin-top:9px'>{chips}</div></div>",unsafe_allow_html=True)

    with st.expander("🔎 연간 AI 종합 정밀해설 펼치기",expanded=False):
        if summary: st.markdown(f"<div class='ai-body'>{summary}</div>",unsafe_allow_html=True)
        if turns: st.markdown(f"<div class='ai-analysis'><span class='ai-label'>전환 구간</span>{turns}</div>",unsafe_allow_html=True)
        clusters=data.get("clusters",{}) if isinstance(data.get("clusters"),dict) else {}
        cluster_html=[]
        for label,key in [("💖 관계","relationship"),("📚 공부·진로","work_study"),("💵 돈·소식","money_news"),("🌿 컨디션","condition")]:
            value=clusters.get(key,"")
            if value: cluster_html.append(f"<div class='ai-cluster'><strong>{label}</strong><br>{html.escape(str(value))}</div>")
        if cluster_html: st.markdown(f"<div class='ai-grid'>{''.join(cluster_html)}</div>",unsafe_allow_html=True)
        if data.get("solar_return"): st.markdown(f"<div class='ai-analysis'><span class='ai-label'>☀️ Solar Return</span>{html.escape(str(data['solar_return']))}</div>",unsafe_allow_html=True)
        if data.get("long_transits"): st.markdown(f"<div class='ai-analysis'><span class='ai-label'>🪐 장기 트랜짓</span>{html.escape(str(data['long_transits']))}</div>",unsafe_allow_html=True)

    quarters=data.get("quarters",{}) if isinstance(data.get("quarters"),dict) else {}
    st.markdown("#### 🧭 분기별 흐름")
    for q,label in [("Q1","1~3월"),("Q2","4~6월"),("Q3","7~9월"),("Q4","10~12월")]:
        value=quarters.get(q)
        if value: st.markdown(f"<div class='ast-card'><div class='ast-title'>{q} · {label}</div><div class='ast-body'>{html.escape(str(value))}</div></div>",unsafe_allow_html=True)

    months=data.get("months",{}) if isinstance(data.get("months"),dict) else {}
    with st.expander("📆 1~12월 월별 해설",expanded=False):
        for m in range(1,13):
            value=months.get(str(m))
            if value: st.markdown(f"<div class='event-pill'><strong>{m}월</strong> · {html.escape(str(value))}</div>",unsafe_allow_html=True)

    analyses=data.get("topic_analysis",{}) if isinstance(data.get("topic_analysis"),dict) else {}
    with st.expander("🧩 분야별 연간 해설",expanded=False):
        for topic in AI_TOPIC_ORDER:
            info=analyses.get(topic,{}) if isinstance(analyses,dict) else {}
            if not isinstance(info,dict) or not info: continue
            body=[]
            if info.get("verdict"): body.append(f"<div class='ai-verdict'>{html.escape(info['verdict'])}</div>")
            if info.get("reason"): body.append(f"<div class='ai-row'>{html.escape(info['reason'])}</div>")
            if info.get("best_window"): body.append(f"<div class='ai-row'><span class='ai-label'>좋은 구간</span>{html.escape(info['best_window'])}</div>")
            if info.get("caution_window"): body.append(f"<div class='ai-row'><span class='ai-label'>주의 구간</span>{html.escape(info['caution_window'])}</div>")
            if info.get("action"): body.append(f"<div class='ai-row'><span class='ai-label'>행동</span>{html.escape(info['action'])}</div>")
            confidence=html.escape(info.get("confidence","보통")); reason=html.escape(info.get("confidence_reason","") or "")
            body.append(f"<span class='ai-confidence'>확신도 {confidence}</span> {reason}")
            st.markdown(f"<div class='ai-analysis'><strong>{TOPIC_SPECS[topic]['icon']} {DISPLAY_LABELS[topic]}</strong>{''.join(body)}</div>",unsafe_allow_html=True)

    sr=(payload or {}).get("solar_return")
    if isinstance(sr,dict) and sr.get("exact_kst"):
        st.caption("☀️ Solar Return 정확 시각 · "+str(sr.get("exact_kst"))+" · 회귀 하우스는 실제 체류 위치 미입력으로 계산하지 않음")
    st.caption("🪐 장기 트랜짓 표시는 매월 15일 스냅샷 기반이라 정확한 애스펙트 완성일 목록이 아니야.")

    cache_source=ai_result.get("cache_source","")
    if archive or cache_source in {"browser","archive"}:
        st.caption("⚡ 저장된 연간운세 사용 · 천체 재계산 0회 · Gemini API 재호출 0회.")
    else:
        st.caption("⚡ 새 연간운세를 이 기기에 저장했어. 다음 열람부터 계산/API 재호출 없이 저장본을 사용해.")
    usage=ai_result.get("usage",{}) if isinstance(ai_result.get("usage"),dict) else {}
    if usage and usage.get("total_tokens"):
        p=usage.get("prompt_tokens",0); c=usage.get("candidate_tokens",0); t=usage.get("thought_tokens",0)
        cost_usd=usage.get("estimated_usd"); cost_krw=usage.get("estimated_krw")
        cost_text=""
        if isinstance(cost_usd,(int,float)):
            cost_text=f" · 최초 생성 예상비용 ${cost_usd:.4f}"
            if isinstance(cost_krw,(int,float)): cost_text+=f" ≈ {cost_krw:,.0f}원"
        st.caption(f"🧾 최초 생성 사용량 · 입력 {p:,} · 본문출력 {c:,} · 사고 {t:,} tokens{cost_text} · 저장본 재열람은 0원")
    if data.get("limits"): st.caption("해설 한계 · "+str(data.get("limits")))
    return data

def render_ai_overview(ai_result):
    if not ai_result or not ai_result.get("ok"):
        if ai_result and ai_result.get("missing_key"):
            st.info("✨ AI 정밀해설은 준비되어 있어. Streamlit Secrets에 GEMINI_API_KEY를 추가하면 켜져.")
        elif ai_result and ai_result.get("error"):
            st.caption("✨ AI 정밀해설을 이번에는 불러오지 못했어. 기본 계산 해설은 정상 동작해. · "+ai_result.get("error",""))
        return None

    data=ai_result["data"]
    headline=html.escape(data.get("headline") or "오늘의 정밀 분석")
    overall=data.get("overall",{}) if isinstance(data.get("overall"),dict) else {}
    summary=html.escape(overall.get("summary",""))
    dominant=html.escape(overall.get("dominant_pattern",""))
    turning=html.escape(overall.get("turning_point",""))
    priorities=data.get("priorities",[]) if isinstance(data.get("priorities"),list) else []
    chips="".join(f"<span class='ai-chip'>{html.escape(x)}</span>" for x in priorities[:3])

    # 첫 화면에는 결론/핵심 패턴/오늘 할 일만 보여서 모바일 길이를 줄인다.
    quick_pattern=dominant or summary
    quick_html=""
    if quick_pattern:
        quick_html=f"<div class='ai-row'><span class='ai-label'>핵심 패턴</span>{quick_pattern}</div>"

    st.markdown(
        f"<div class='ai-overview'>"
        f"<div class='ai-kicker'>AI DEEP INTERPRETATION</div>"
        f"<div class='ai-head'>✨ {headline}</div>"
        f"<div class='ai-body'>{quick_html}</div>"
        f"<div style='margin-top:9px'>{chips}</div>"
        f"</div>",
        unsafe_allow_html=True,
    )

    with st.expander("🔎 AI 종합 정밀해설 펼치기", expanded=False):
        if summary:
            st.markdown(f"<div class='ai-body'>{summary}</div>",unsafe_allow_html=True)
        if turning:
            st.markdown(
                f"<div class='ai-analysis'><div class='ai-row'><span class='ai-label'>시간 흐름</span>{turning}</div></div>",
                unsafe_allow_html=True,
            )

        clusters=data.get("clusters",{}) if isinstance(data.get("clusters"),dict) else {}
        cluster_html=[]
        for label,key in [
            ("💖 관계","relationship"),
            ("📚 공부·진로","work_study"),
            ("💵 돈·소식","money_news"),
            ("🌿 컨디션","condition"),
        ]:
            value=clusters.get(key,"")
            if value:
                cluster_html.append(
                    f"<div class='ai-cluster'><strong>{label}</strong><br>{html.escape(value)}</div>"
                )
        if cluster_html:
            st.markdown(f"<div class='ai-grid'>{''.join(cluster_html)}</div>",unsafe_allow_html=True)

    cache_source=ai_result.get("cache_source","")
    if cache_source in {"browser","archive"}:
        st.caption("⚡ 이 기기에 저장된 해설을 사용했어 · Gemini API 재호출 0회.")
    else:
        st.caption("⚡ 새 해설은 서버 캐시 + 이 기기 IndexedDB에 장기 보관해. 같은 계산값을 다시 열면 API를 재호출하지 않아.")

    usage=ai_result.get("usage",{}) if isinstance(ai_result.get("usage"),dict) else {}
    if usage and usage.get("total_tokens"):
        p=usage.get("prompt_tokens",0); c=usage.get("candidate_tokens",0); t=usage.get("thought_tokens",0)
        cost_usd=usage.get("estimated_usd"); cost_krw=usage.get("estimated_krw")
        cost_text=""
        if isinstance(cost_usd,(int,float)):
            cost_text=f" · 최초 생성 예상비용 ${cost_usd:.4f}"
            if isinstance(cost_krw,(int,float)):
                cost_text+=f" ≈ {cost_krw:,.0f}원"
        st.caption(f"🧾 최초 생성 사용량 · 입력 {p:,} · 본문출력 {c:,} · 사고 {t:,} tokens{cost_text} · 저장본 재열람은 0원")

    with st.expander("AI 해설 기준 · 개인정보/한계"):
        st.write("AI는 점수나 천체를 새로 계산하지 않고, 앱이 계산한 숫자·시간대·애스펙트·하우스 근거만 종합합니다.")
        st.write("AI 요청에는 이름·생년월일·출생시간·출생지 원문·PIN을 보내지 않습니다.")
        st.write("AI 문장은 점성술적 해석이며 사건 확률, 특정인의 의도, 의료 진단, 주가 방향을 의미하지 않습니다.")
        if data.get("limits"):
            st.caption("이번 해설의 한계 · "+data["limits"])
        model_caption="모델 · "+str(ai_result.get("model",AI_DEFAULT_MODEL))
        if ai_result.get("used_fallback"):
            model_caption+=f" · {ai_result.get('fallback_from')} 실패 후 자동 대체"
        model_caption+=f" · thinking {ai_result.get('thinking_level',AI_DEFAULT_THINKING_LEVEL)}"
        st.caption(model_caption)
    return data


def _render_fortune_archive():
    st.markdown("### 📚 운세 저장함")
    st.caption("운세 저장함은 IndexedDB를 주 저장소로 써서 일일·주간·월간·연간을 장기 보관해. 앱에서 임의로 90일/26주/18개월 제한을 두지 않고, 저장본 재열람은 Gemini API 0회야.")
    storage_info=_render_browser_storage_estimate()
    if storage_info and storage_info.get("indexedDB") and not storage_info.get("persisted"):
        st.caption("🛡️ 브라우저 관리형 저장은 기기 저장공간이 매우 부족할 때 정리될 수 있어. 아래 버튼으로 지속 저장을 요청할 수 있어.")
        if st.button("🛡️ IndexedDB 오래 보관 요청",use_container_width=True,key="fortune_persist_storage"):
            st.session_state["_fortune_persist_request_nonce"]=int(st.session_state.get("_fortune_persist_request_nonce",0) or 0)+1
            st.session_state["_fortune_persist_request_pending"]=True
        if st.session_state.get("_fortune_persist_request_pending"):
            persist_result=_request_browser_persistent_storage()
            if persist_result is None:
                st.caption("🛡️ 브라우저에 지속 저장을 요청하는 중...")
            else:
                st.session_state["_fortune_persist_request_pending"]=False
                if persist_result.get("granted"):
                    st.success("🛡️ 지속 저장 모드가 허용됐어. 저장공간 압박 때 자동 정리될 가능성을 더 낮췄어.")
                    st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
                elif not persist_result.get("supported",True):
                    st.info("이 브라우저는 지속 저장 요청 API를 제공하지 않아. IndexedDB 자체 저장은 그대로 정상 동작해.")
                else:
                    st.info("브라우저가 이번에는 지속 저장을 허용하지 않았어. IndexedDB 데이터는 그대로 유지되며, 허용 여부는 브라우저 정책이 결정해.")
    elif storage_info and storage_info.get("persisted"):
        st.success("🛡️ 이 브라우저는 현재 지속 저장 모드야.")
    with st.expander("💾 저장함 백업 · 복원",expanded=False):
        st.caption("백업 파일에는 운세/AI 해설 문장이 들어가므로 개인 파일처럼 보관해. Gemini 키·PIN 같은 비밀값은 포함하지 않아.")
        backup_text=_read_browser_archive_backup()
        if backup_text is None:
            st.caption("백업 데이터를 준비하는 중...")
        else:
            try:
                backup_obj=json.loads(backup_text); backup_count=len(backup_obj.get("records",[])) if isinstance(backup_obj,dict) else 0
            except Exception: backup_count=0
            st.download_button(
                f"⬇️ 저장함 JSON 백업 다운로드 · {backup_count}개",
                data=backup_text.encode("utf-8"),
                file_name=f"astro-fortune-backup-{datetime.now(KST):%Y%m%d-%H%M}.json",
                mime="application/json",use_container_width=True,key="fortune_archive_backup_download",
            )
        restore_file=st.file_uploader("백업 JSON 복원",type=["json"],key="fortune_archive_restore_file")
        if restore_file is not None and st.button("⬆️ 이 백업을 저장함에 병합",use_container_width=True,key="fortune_archive_restore_button"):
            clean_records,restore_error=_validate_archive_backup(restore_file.getvalue())
            if restore_error:
                st.error(restore_error)
            else:
                st.session_state["_fortune_restore_payload"]=clean_records
                st.session_state["_fortune_restore_nonce"]=int(st.session_state.get("_fortune_restore_nonce",0) or 0)+1
                st.session_state["_fortune_restore_pending"]=True
        if st.session_state.get("_fortune_restore_pending"):
            restore_result=_restore_browser_archive_records(st.session_state.get("_fortune_restore_payload") or [])
            if restore_result is None:
                st.caption("복원 데이터를 IndexedDB에 병합하는 중...")
            else:
                st.session_state["_fortune_restore_pending"]=False
                if restore_result.get("ok"):
                    st.success(f"✅ 저장함 복원 완료 · {int(restore_result.get('count',0) or 0)}개 항목을 병합했어.")
                    st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
                else:
                    st.error("복원 실패 · "+str(restore_result.get("error") or "브라우저 저장 오류"))

    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
        st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
        st.rerun()

    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    period_ai=_read_period_ai_archive_entries()
    annual=_read_annual_archive_entries()
    if daily is None or periods is None or period_ai is None or annual is None:
        st.caption("📚 이 기기에 저장된 운세와 AI 해설을 확인하는 중...")
        return

    period_ai_by_id={}
    for saved in period_ai or []:
        if not isinstance(saved,dict):
            continue
        sid=str(saved.get("id") or "")
        result=saved.get("result",{}) if isinstance(saved.get("result"),dict) else {}
        if sid and result.get("ok"):
            period_ai_by_id[sid]=saved

    items=[]
    for entry in daily or []:
        result=entry.get("result",{}) if isinstance(entry,dict) else {}
        meta=result.get("archive_meta",{}) if isinstance(result,dict) else {}
        d=str(meta.get("date") or "")
        if not d:
            continue
        try:
            parsed=date.fromisoformat(d)
        except Exception:
            continue
        items.append({
            "type":"daily",
            "sort":d,
            "date_obj":parsed,
            "label":f"🌙 {d} · 일일 AI 해설",
            "entry":entry,
        })

    for saved in annual or []:
        if not isinstance(saved,dict):
            continue
        try:
            y=int(saved.get("year"))
        except Exception:
            continue
        result=saved.get("result",{}) if isinstance(saved.get("result"),dict) else {}
        if not result.get("ok"):
            continue
        items.append({
            "type":"annual",
            "sort":f"{y:04d}-01-01",
            "date_obj":date(y,1,1),
            "end_obj":date(y,12,31),
            "label":f"🌌 {y}년 · 연간",
            "entry":saved,
        })

    for entry in periods or []:
        if not isinstance(entry,dict):
            continue
        kind=entry.get("period")
        start=str(entry.get("start") or "")
        end=str(entry.get("end") or "")
        try:
            start_dt=date.fromisoformat(start)
            end_dt=date.fromisoformat(end)
        except Exception:
            continue
        if kind=="weekly":
            label=f"📅 {start} ~ {end} · 주간"
        elif kind=="monthly":
            label=f"🌕 {start_dt.year}년 {start_dt.month}월 · 월간"
        else:
            continue
        items.append({
            "type":kind,
            "sort":start,
            "date_obj":start_dt,
            "end_obj":end_dt,
            "label":label,
            "entry":entry,
        })

    if not items:
        st.info("아직 저장된 운세가 없어. 일일 AI 해설을 열거나 주간/월간 리포트를 보면 자동으로 저장돼.")
        return

    filter_label=st.selectbox("종류",["일일","주간","월간","연간","전체"],key="fortune_archive_filter")
    wanted={"일일":"daily","주간":"weekly","월간":"monthly","연간":"annual"}.get(filter_label)
    scoped=[x for x in items if not wanted or x["type"]==wanted]
    scoped.sort(key=lambda x:x["sort"],reverse=True)
    if not scoped:
        st.info("이 종류의 저장된 운세는 아직 없어.")
        return

    def choose_year(rows,key_suffix):
        years=sorted({x["date_obj"].year for x in rows},reverse=True)
        return st.selectbox("연도",years,key=f"fortune_archive_year_{key_suffix}")

    item=None

    if filter_label=="일일":
        year=choose_year(scoped,"daily")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        months=sorted({x["date_obj"].month for x in year_rows},reverse=True)
        month=st.selectbox("월",months,format_func=lambda m:f"{m}월",key="fortune_archive_month_daily")
        month_rows=[x for x in year_rows if x["date_obj"].month==month]
        month_rows.sort(key=lambda x:x["date_obj"],reverse=True)
        labels=[]
        for x in month_rows:
            d=x["date_obj"]
            labels.append(f"{d.month}월 {d.day}일 ({WEEKDAY_KO[d.weekday()]})")
        chosen=st.selectbox("날짜",labels,key="fortune_archive_day_daily")
        item=month_rows[labels.index(chosen)]

    elif filter_label=="주간":
        year=choose_year(scoped,"weekly")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        year_rows.sort(key=lambda x:x["date_obj"],reverse=True)
        labels=[]
        for x in year_rows:
            s=x["date_obj"]; e=x["end_obj"]
            labels.append(
                f"{s.month}/{s.day}({WEEKDAY_KO[s.weekday()]}) ~ "
                f"{e.month}/{e.day}({WEEKDAY_KO[e.weekday()]})"
            )
        chosen=st.selectbox("주간",labels,key="fortune_archive_week_weekly")
        item=year_rows[labels.index(chosen)]

    elif filter_label=="월간":
        year=choose_year(scoped,"monthly")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        year_rows.sort(key=lambda x:x["date_obj"].month,reverse=True)
        months=[x["date_obj"].month for x in year_rows]
        month=st.selectbox("월",months,format_func=lambda m:f"{m}월",key="fortune_archive_month_monthly")
        item=next(x for x in year_rows if x["date_obj"].month==month)

    elif filter_label=="연간":
        year=choose_year(scoped,"annual")
        item=next(x for x in scoped if x["date_obj"].year==year)

    else:
        labels=[x["label"] for x in scoped]
        chosen=st.selectbox("최근 저장 기록",labels,key="fortune_archive_choice_all")
        item=scoped[labels.index(chosen)]

    if not item:
        return

    if item["type"]=="daily":
        result=dict(item["entry"].get("result",{}))
        result["cache_source"]="archive"
        render_ai_overview(result)
        return

    if item["type"]=="annual":
        entry=item["entry"]
        result=dict(entry.get("result",{})) if isinstance(entry,dict) else {}
        result["cache_source"]="archive"
        payload=entry.get("payload",{}) if isinstance(entry,dict) else {}
        render_ai_annual_overview(result,payload,archive=True)
        return

    entry=item["entry"]
    saved_period_ai=period_ai_by_id.get(str(entry.get("id") or ""))
    if saved_period_ai:
        saved_result=saved_period_ai.get("result",{}) if isinstance(saved_period_ai,dict) else {}
        if isinstance(saved_result,dict) and saved_result.get("ok"):
            saved_result=dict(saved_result)
            saved_result["cache_source"]="archive"
            render_ai_period_overview(saved_result,item["label"])

    st.markdown(f"<div class='period-range'><strong>{html.escape(item['label'])}</strong></div>",unsafe_allow_html=True)
    topics=entry.get("topics",{}) if isinstance(entry.get("topics"),dict) else {}
    for key in AI_TOPIC_ORDER:
        body=topics.get(key)
        if body:
            st.markdown(f"<div class='ast-card'><div class='ast-title'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='ast-body'>{body}</div></div>",unsafe_allow_html=True)
    market=entry.get("market",{}) if isinstance(entry.get("market"),dict) else {}
    if market:
        st.markdown("#### 📈 주식·투자")
        for label,body in market.items():
            st.markdown(f"<div class='event-pill'><strong>{html.escape(str(label))}</strong> · {body}</div>",unsafe_allow_html=True)
    st.caption("📦 저장된 계산 리포트야. 이 화면을 다시 보는 건 API 호출이 아니야.")



# ============================================================
# 8-E. INDEXEDDB PRIMARY FORTUNE STORAGE · V6.7
# ============================================================
# 운세 데이터(일일/주간/월간/연간)는 IndexedDB를 주 저장소로 사용한다.
# 로그인 유지 토큰은 작고 민감도가 다른 상태값이므로 기존 localStorage 방식을 유지한다.
# 기존 localStorage 운세는 첫 IndexedDB 접근 시 자동 마이그레이션하며, 실패 시 fallback으로 남긴다.
BROWSER_IDB_SCHEMA_VERSION = 1
BROWSER_IDB_DB_NAME = "astro_fortune_db_v1"
BROWSER_IDB_STORE_NAME = "records"
BROWSER_IDB_MIGRATION_ID = "meta:migrated_localstorage_v1"
BROWSER_IDB_DAILY_FAR_FUTURE_EXPIRY = 4102444800  # 2100-01-01 UTC


def _idb_js_prelude():
    db_js=json.dumps(BROWSER_IDB_DB_NAME)
    store_js=json.dumps(BROWSER_IDB_STORE_NAME)
    migration_js=json.dumps(BROWSER_IDB_MIGRATION_ID)
    daily_prefix_js=json.dumps(AI_BROWSER_CACHE_PREFIX)
    period_archive_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY)
    period_ai_js=json.dumps(PERIOD_AI_STORAGE_KEY)
    annual_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    far_expiry=int(BROWSER_IDB_DAILY_FAR_FUTURE_EXPIRY)
    return (
        f"const DB_NAME={db_js},STORE={store_js},DB_VERSION={BROWSER_IDB_SCHEMA_VERSION},MIGRATION_ID={migration_js};"
        f"const LEGACY_DAILY_PREFIX={daily_prefix_js},LEGACY_PERIOD_KEY={period_archive_js},LEGACY_PERIOD_AI_KEY={period_ai_js},LEGACY_ANNUAL_KEY={annual_js};"
        "const reqP=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed'));});"
        "const txDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve(true);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));});"
        "const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);"
        "r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('kind','kind',{unique:false});s.createIndex('sort_key','sort_key',{unique:false});}};"
        "r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB open failed'));});"
        "const ensureMigration=async(db)=>{"
        "const checkTx=db.transaction(STORE,'readonly');const marker=await reqP(checkTx.objectStore(STORE).get(MIGRATION_ID));if(marker)return;"
        "const tx=db.transaction(STORE,'readwrite');const s=tx.objectStore(STORE);const now=Math.floor(Date.now()/1000);"
        "for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith(LEGACY_DAILY_PREFIX))continue;try{const p=JSON.parse(localStorage.getItem(k)||'{}');const r=p.result||{};const m=r.archive_meta||{};if(!r.ok)continue;p.expires_at="+str(far_expiry)+";const cid=k.slice(LEGACY_DAILY_PREFIX.length);s.put({id:'daily:'+cid,kind:'daily',sort_key:String(m.date||p.saved_at||''),saved_at:Number(p.saved_at||now),payload:p,schema:1});}catch(e){}}"
        "try{let arr=JSON.parse(localStorage.getItem(LEGACY_PERIOD_KEY)||'[]');if(Array.isArray(arr)){arr.forEach(x=>{if(!x||!x.id)return;s.put({id:'period_calc:'+x.id,kind:'period_calc',subtype:String(x.period||''),sort_key:String(x.start||''),saved_at:Number(x.saved_at||now),payload:x,schema:1});});}}catch(e){}"
        "try{let arr=JSON.parse(localStorage.getItem(LEGACY_PERIOD_AI_KEY)||'[]');if(Array.isArray(arr)){arr.forEach(x=>{if(!x||!x.id)return;s.put({id:'period_ai:'+x.id,kind:'period_ai',subtype:String(x.period||''),sort_key:String(x.start||''),saved_at:Number(x.saved_at||now),payload:x,schema:1});});}}catch(e){}"
        "try{let arr=JSON.parse(localStorage.getItem(LEGACY_ANNUAL_KEY)||'[]');if(Array.isArray(arr)){arr.forEach(x=>{if(!x||!x.year)return;s.put({id:'annual:'+String(x.year),kind:'annual',sort_key:String(x.year),saved_at:Number(x.saved_at||now),payload:x,schema:1});});}}catch(e){}"
        "s.put({id:MIGRATION_ID,kind:'meta',sort_key:'',saved_at:now,payload:{migrated_at:now},schema:1});await txDone(tx);};"
    )


def _idb_wrap(body,error_body):
    return "(async()=>{try{"+_idb_js_prelude()+"const db=await openDb();await ensureMigration(db);"+body+"}catch(e){"+error_body+"}})()"


def _read_ai_browser_cache(cache_id):
    """IndexedDB 우선 일일 AI 캐시. None=component 대기, ''=저장본 없음."""
    if streamlit_js_eval is None:
        return ""
    record_id_js=json.dumps("daily:"+cache_id)
    legacy_key_js=json.dumps(_ai_browser_storage_key(cache_id))
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    body=(
        f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({record_id_js}));db.close();"
        "if(rec&&rec.payload)return JSON.stringify(rec.payload);"
        f"const legacy=localStorage.getItem({legacy_key_js});return legacy===null?{empty_js}:legacy;"
    )
    error_body=f"try{{const v=localStorage.getItem({legacy_key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_daily_read_{cache_id}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return ""
    return value


def _write_ai_browser_cache(cache_id,ai_result):
    if streamlit_js_eval is None or not ai_result or not ai_result.get("ok"):
        return None
    now_ts=int(time.time())
    packed={"saved_at":now_ts,"expires_at":BROWSER_IDB_DAILY_FAR_FUTURE_EXPIRY,"result":ai_result}
    record={
        "id":"daily:"+cache_id,
        "kind":"daily",
        "sort_key":str((ai_result.get("archive_meta") or {}).get("date") or now_ts),
        "saved_at":now_ts,
        "payload":packed,
        "schema":BROWSER_IDB_SCHEMA_VERSION,
    }
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    legacy_key_js=json.dumps(_ai_browser_storage_key(cache_id))
    packed_js=json.dumps(json.dumps(packed,ensure_ascii=False,separators=(",",":")))
    body=(
        f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    )
    error_body=f"try{{localStorage.setItem({legacy_key_js},{packed_js});return 'legacy';}}catch(_e){{return 'fail';}}"
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_daily_write_{fp}")


def _read_daily_archive_entries():
    if streamlit_js_eval is None:
        return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='daily'&&x.payload&&x.payload.result&&x.payload.result.ok).map(x=>x.payload);"
        "out.sort((a,b)=>Number(b.saved_at||0)-Number(a.saved_at||0));return JSON.stringify(out);"
    )
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=(
        "try{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith("+json.dumps(AI_BROWSER_CACHE_PREFIX)+"))continue;"
        "try{const o=JSON.parse(localStorage.getItem(k)||'{}');if(o.result&&o.result.ok)out.push(o);}catch(e){}}"
        "out.sort((a,b)=>Number(b.saved_at||0)-Number(a.saved_at||0));return JSON.stringify(out);}catch(_e){return "+empty_js+";}"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_daily_archive_{nonce}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:
        return []


def _save_period_archive(kind,start_date,end_date,rows):
    if streamlit_js_eval is None or not rows or kind not in {"weekly","monthly"}:
        return None
    snapshot=_period_snapshot(kind,start_date,end_date,rows)
    fp=hashlib.sha256(json.dumps(snapshot,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    session_key=f"_idb_period_archive_written_{snapshot['id']}_{fp}"
    if st.session_state.get(session_key):
        return "ok"
    record={"id":"period_calc:"+snapshot["id"],"kind":"period_calc","subtype":kind,"sort_key":snapshot["start"],"saved_at":snapshot["saved_at"],"payload":snapshot,"schema":BROWSER_IDB_SCHEMA_VERSION}
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    legacy_key_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY)
    snap_js=json.dumps(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")))
    error_body=(
        f"try{{const key={legacy_key_js},snap=JSON.parse({snap_js});let arr=[];try{{arr=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{arr=[];}}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&x.id!==snap.id);arr.push(snap);localStorage.setItem(key,JSON.stringify(arr));return 'legacy';}catch(_e){return 'fail';}"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_calc_write_{fp}")
    if value is None:
        return None
    if str(value) in {"ok","legacy"}:
        st.session_state[session_key]=True
    return str(value)


def _read_period_archive_entries():
    if streamlit_js_eval is None:
        return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='period_calc'&&x.payload).map(x=>x.payload);out.sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));return JSON.stringify(out);"
    )
    key_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY);empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=f"try{{const v=localStorage.getItem({key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_archive_read_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _read_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level):
    if streamlit_js_eval is None:
        return ""
    period_id=_period_ai_id(kind,start_date,end_date)
    record_id_js=json.dumps("period_ai:"+period_id)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    hash_js=json.dumps(payload_hash);model_js=json.dumps(model);thinking_js=json.dumps(thinking_level)
    body=(
        f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({record_id_js}));db.close();"
        f"if(rec&&rec.payload&&rec.payload.payload_hash==={hash_js}&&rec.payload.model==={model_js}&&rec.payload.thinking_level==={thinking_js})return JSON.stringify(rec.payload);"
        f"return {empty_js};"
    )
    legacy_key_js=json.dumps(PERIOD_AI_STORAGE_KEY);id_js=json.dumps(period_id)
    error_body=(
        f"try{{let arr=[];try{{arr=JSON.parse(localStorage.getItem({legacy_key_js})||'[]');}}catch(e){{arr=[];}}"
        f"const x=Array.isArray(arr)?arr.find(v=>v&&v.id==={id_js}&&v.payload_hash==={hash_js}&&v.model==={model_js}&&v.thinking_level==={thinking_js}):null;return x?JSON.stringify(x):{empty_js};}}catch(_e){{return {empty_js};}}"
    )
    cache_key=hashlib.sha256(f"{kind}|{start_date}|{end_date}|{payload_hash}|{model}|{thinking_level}".encode("utf-8")).hexdigest()[:16]
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_ai_read_{cache_key}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return ""
    return value


def _write_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level,result):
    if streamlit_js_eval is None or not result or not result.get("ok"):
        return None
    item={"id":_period_ai_id(kind,start_date,end_date),"period":kind,"start":start_date.isoformat(),"end":end_date.isoformat(),"payload_hash":payload_hash,"model":model,"thinking_level":thinking_level,"saved_at":int(time.time()),"result":result}
    record={"id":"period_ai:"+item["id"],"kind":"period_ai","subtype":kind,"sort_key":item["start"],"saved_at":item["saved_at"],"payload":item,"schema":BROWSER_IDB_SCHEMA_VERSION}
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    legacy_key_js=json.dumps(PERIOD_AI_STORAGE_KEY);item_js=json.dumps(json.dumps(item,ensure_ascii=False,separators=(",",":")))
    error_body=(
        f"try{{const key={legacy_key_js},item=JSON.parse({item_js});let arr=[];try{{arr=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{arr=[];}}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&x.id!==item.id);arr.push(item);localStorage.setItem(key,JSON.stringify(arr));return 'legacy';}catch(_e){return 'fail';}"
    )
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_ai_write_{fp}")


def _read_period_ai_archive_entries():
    if streamlit_js_eval is None:return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='period_ai'&&x.payload).map(x=>x.payload);out.sort((a,b)=>Number(a.saved_at||0)-Number(b.saved_at||0));return JSON.stringify(out);"
    )
    key_js=json.dumps(PERIOD_AI_STORAGE_KEY);empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=f"try{{const v=localStorage.getItem({key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_ai_archive_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _read_annual_year_entry(year_value):
    if streamlit_js_eval is None:return ""
    record_id_js=json.dumps(f"annual:{int(year_value)}");empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL);year_js=json.dumps(int(year_value));legacy_key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    body=f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({record_id_js}));db.close();return rec&&rec.payload?JSON.stringify(rec.payload):{empty_js};"
    error_body=(
        f"try{{let arr=[];try{{arr=JSON.parse(localStorage.getItem({legacy_key_js})||'[]');}}catch(e){{arr=[];}}const x=Array.isArray(arr)?arr.find(v=>v&&Number(v.year)===Number({year_js})):null;return x?JSON.stringify(x):{empty_js};}}catch(_e){{return {empty_js};}}"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_annual_year_{int(year_value)}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return ""
    return value


def _write_annual_entry(year_value,payload,model,thinking_level,result):
    if streamlit_js_eval is None or not result or not result.get("ok"):
        return None
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    item={"id":f"annual:{int(year_value)}","period":"annual","year":int(year_value),"payload_hash":hashlib.sha256(payload_json.encode("utf-8")).hexdigest()[:24],"model":model,"thinking_level":thinking_level,"saved_at":int(time.time()),"payload":payload,"result":result}
    record={"id":item["id"],"kind":"annual","sort_key":str(item["year"]),"saved_at":item["saved_at"],"payload":item,"schema":BROWSER_IDB_SCHEMA_VERSION}
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    legacy_key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY);item_js=json.dumps(json.dumps(item,ensure_ascii=False,separators=(",",":")))
    error_body=(
        f"try{{const key={legacy_key_js},item=JSON.parse({item_js});let arr=[];try{{arr=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{arr=[];}}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&Number(x.year)!==Number(item.year));arr.push(item);localStorage.setItem(key,JSON.stringify(arr));return 'legacy';}catch(_e){return 'fail';}"
    )
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_annual_write_{fp}")


def _read_annual_archive_entries():
    if streamlit_js_eval is None:return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='annual'&&x.payload).map(x=>x.payload);out.sort((a,b)=>Number(b.year||0)-Number(a.year||0));return JSON.stringify(out);"
    )
    key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY);empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=f"try{{const v=localStorage.getItem({key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_annual_archive_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _read_browser_storage_estimate():
    if streamlit_js_eval is None:return None
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    expression=(
        "(async()=>{try{const e=(navigator.storage&&navigator.storage.estimate)?await navigator.storage.estimate():{};"
        "const p=(navigator.storage&&navigator.storage.persisted)?await navigator.storage.persisted():false;"
        "return JSON.stringify({ok:true,usage:Number(e.usage||0),quota:Number(e.quota||0),persisted:Boolean(p),indexedDB:Boolean(window.indexedDB)});"
        "}catch(err){return JSON.stringify({ok:false,error:String(err&&err.message||err),indexedDB:Boolean(window.indexedDB)});}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"idb_storage_estimate_{nonce}")
    if value is None:return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else None
    except Exception:return None


def _request_browser_persistent_storage():
    """브라우저에 IndexedDB 지속 저장(persistent storage)을 요청한다.

    허용 여부는 브라우저 정책이 최종 결정한다. None은 JS 컴포넌트 응답 대기 상태다.
    """
    if streamlit_js_eval is None:
        return {"ok":False,"supported":False,"granted":False,"reason":"streamlit_js_eval unavailable"}
    nonce=int(st.session_state.get("_fortune_persist_request_nonce",0) or 0)
    expression=(
        "(async()=>{try{"
        "if(!navigator.storage||!navigator.storage.persist){return JSON.stringify({ok:true,supported:false,granted:false});}"
        "const before=navigator.storage.persisted?await navigator.storage.persisted():false;"
        "const requested=before?true:await navigator.storage.persist();"
        "const after=navigator.storage.persisted?await navigator.storage.persisted():Boolean(requested);"
        "return JSON.stringify({ok:true,supported:true,granted:Boolean(after),already:Boolean(before)});"
        "}catch(err){return JSON.stringify({ok:false,supported:true,granted:false,error:String(err&&err.message||err)});}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"idb_persist_request_{nonce}")
    if value is None:
        return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else {"ok":False,"supported":True,"granted":False}
    except Exception:
        return {"ok":False,"supported":True,"granted":False,"error":"invalid browser response"}


def _read_browser_archive_backup():
    """Portable JSON backup of horoscope records only; secrets/meta are excluded."""
    if streamlit_js_eval is None:return None
    nonce=int(st.session_state.get("_fortune_backup_nonce",0) or 0)
    allowed_js=json.dumps(["daily","period_calc","period_ai","annual","outcome"])
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        f"const allowed=new Set({allowed_js});"
        "const records=all.filter(x=>x&&allowed.has(String(x.kind||''))&&x.id&&x.payload);"
        "records.sort((a,b)=>String(a.id).localeCompare(String(b.id)));"
        "return JSON.stringify({format:'astro-fortune-archive',version:1,exported_at:new Date().toISOString(),records:records});"
    )
    error_body="return JSON.stringify({format:'astro-fortune-archive',version:1,exported_at:new Date().toISOString(),records:[],warning:'IndexedDB backup unavailable'});"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_archive_backup_{nonce}")
    if value is None:return None
    return str(value)


def _validate_archive_backup(uploaded_bytes):
    if not uploaded_bytes:return None,"빈 파일이야."
    if len(uploaded_bytes)>25*1024*1024:return None,"백업 파일이 25MB를 넘어 복원을 중단했어."
    try:data=json.loads(uploaded_bytes.decode("utf-8"))
    except Exception:return None,"JSON 백업 파일을 읽지 못했어."
    if not isinstance(data,dict) or data.get("format")!="astro-fortune-archive":return None,"별빛의 운명 저장함 백업 형식이 아니야."
    records=data.get("records")
    if not isinstance(records,list):return None,"백업 records 형식이 잘못됐어."
    if len(records)>5000:return None,"백업 항목이 5,000개를 넘어 복원을 중단했어."
    allowed={"daily":"daily:","period_calc":"period_calc:","period_ai":"period_ai:","annual":"annual:","outcome":"outcome:"}
    clean=[]
    for rec in records:
        if not isinstance(rec,dict):continue
        kind=str(rec.get("kind") or ""); rid=str(rec.get("id") or "")
        if kind not in allowed or not rid.startswith(allowed[kind]) or "payload" not in rec:continue
        try:saved_at=int(rec.get("saved_at") or 0); schema=int(rec.get("schema") or 1)
        except Exception:continue
        clean.append({"id":rid,"kind":kind,"subtype":rec.get("subtype"),"sort_key":str(rec.get("sort_key") or ""),"saved_at":saved_at,"payload":rec.get("payload"),"schema":schema})
    if records and not clean:return None,"복원 가능한 운세 항목이 없어."
    return clean,None


def _restore_browser_archive_records(records):
    """Merge validated backup records into IndexedDB by record id."""
    if streamlit_js_eval is None:return {"ok":False,"error":"streamlit_js_eval unavailable"}
    nonce=int(st.session_state.get("_fortune_restore_nonce",0) or 0)
    records_json=json.dumps(records,ensure_ascii=False,separators=(",",":"))
    packed_js=json.dumps(records_json)
    body=(
        f"const records=JSON.parse({packed_js});"
        "const tx=db.transaction(STORE,'readwrite');const s=tx.objectStore(STORE);"
        "for(const rec of records){s.put(rec);}await txDone(tx);db.close();"
        "return JSON.stringify({ok:true,count:records.length});"
    )
    error_body="return JSON.stringify({ok:false,error:String(e&&e.message||e)});"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_archive_restore_{nonce}")
    if value is None:return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else {"ok":False,"error":"invalid browser response"}
    except Exception:return {"ok":False,"error":"invalid browser response"}


def _render_browser_storage_estimate():
    info=_read_browser_storage_estimate()
    if info is None:
        st.caption("💾 IndexedDB 저장공간을 확인하는 중...")
        return None
    if not info.get("indexedDB"):
        st.warning("이 브라우저에서는 IndexedDB를 사용할 수 없어 기존 저장소 fallback을 사용 중이야.")
        return info
    quota=float(info.get("quota",0) or 0);usage=float(info.get("usage",0) or 0)
    def human(n):
        if n>=1024**3:return f"{n/(1024**3):.1f} GB"
        if n>=1024**2:return f"{n/(1024**2):.1f} MB"
        return f"{n/1024:.1f} KB"
    if quota>0:
        st.caption(f"💾 IndexedDB 사용 중 · 이 사이트 전체 브라우저 저장공간 약 {human(usage)} / 허용량 약 {human(quota)} · {'지속 저장 모드' if info.get('persisted') else '브라우저 관리형 저장'}")
    else:
        st.caption("💾 IndexedDB 사용 중 · 브라우저가 정확한 quota(할당량)는 숨기고 있어.")
    return info


# ============================================================
# 9. RETURN / DAILY MOON EVENTS
# ============================================================
@st.cache_data(ttl=21600, show_spinner=False)
def cached_moon_ingresses(day_iso):
    """KST 하루 안 Moon 별자리 이동 시각을 약 1분 이내로 좁힌다. 개인 점수와는 별도인 전체 하늘 맥락."""
    day_value=date.fromisoformat(day_iso)
    start=KST.localize(datetime.combine(day_value,dt_time(0,0)))
    end=start+timedelta(days=1)
    points=[]; cur=start
    while cur<=end:
        points.append(cur); cur+=timedelta(minutes=30)

    sf_points=ts.from_datetimes([p.astimezone(UTC) for p in points])
    moon_lons=get_tropical_ecliptic_lons("Moon",sf_points)
    sign_indices=[int((float(lon)%360)//30) for lon in moon_lons]

    def sign_idx(dt_kst):
        lon=get_tropical_ecliptic_lon("Moon",sf_time(dt_kst.astimezone(UTC)))
        return int((lon%360)//30)

    events=[]
    prev=points[0]; prev_idx=sign_indices[0]
    for cur,cur_idx in zip(points[1:],sign_indices[1:]):
        if cur_idx!=prev_idx:
            lo,hi=prev,cur; lo_idx=prev_idx
            for _ in range(12):
                mid=lo+(hi-lo)/2
                if sign_idx(mid)==lo_idx: lo=mid
                else: hi=mid
            event_dt=hi.replace(second=0,microsecond=0)
            new_idx=sign_idx(hi)
            events.append((event_dt.isoformat(),SIGNS_KO[new_idx]))
        prev,prev_idx=cur,cur_idx
    return events

def make_sample_datetimes(start_dt_utc,end_dt_utc,step_hours):
    out=[]; cur=start_dt_utc.astimezone(UTC); end=end_dt_utc.astimezone(UTC); step=timedelta(hours=step_hours)
    while cur<end: out.append(cur); cur+=step
    if not out or out[-1]!=end: out.append(end)
    return out


def refine_longitude_crossing(body,target_lon,left_dt,right_dt):
    left_t,right_t=sf_time(left_dt),sf_time(right_dt)
    def objective(tt_jd): return circular_delta(get_tropical_ecliptic_lon(body,ts.tt_jd(tt_jd)),target_lon)
    fl,fr=objective(left_t.tt),objective(right_t.tt)
    if max(abs(fl),abs(fr))>60:return None
    if abs(fl)<1e-10:return left_dt.astimezone(UTC)
    if abs(fr)<1e-10:return right_dt.astimezone(UTC)
    if fl*fr>0:return None
    root=brentq(objective,left_t.tt,right_t.tt,xtol=1e-9,maxiter=100)
    return ts.tt_jd(root).utc_datetime().replace(tzinfo=UTC)


def find_longitude_crossings(body,target_lon,start_dt_utc,end_dt_utc,step_hours):
    samples=make_sample_datetimes(start_dt_utc,end_dt_utc,step_hours); times=ts.from_datetimes(samples)
    vals=circular_delta_array(get_tropical_ecliptic_lons(body,times),target_lon); roots=[]
    for i in range(len(samples)-1):
        a,b=float(vals[i]),float(vals[i+1])
        if max(abs(a),abs(b))>60: continue
        if a==0 or b==0 or a*b<0:
            root=refine_longitude_crossing(body,target_lon,samples[i],samples[i+1])
            if root is not None and (not roots or abs((root-roots[-1]).total_seconds())>30): roots.append(root)
    return roots


def find_returns_near(body,natal_lon,center_dt_utc):
    cfg=RETURN_CONFIG[body]; start=center_dt_utc-timedelta(days=cfg["window_days"]); end=center_dt_utc+timedelta(days=cfg["window_days"])
    roots=find_longitude_crossings(body,natal_lon,start,end,cfg["step_hours"])
    prev=[r for r in roots if r<=center_dt_utc]; fut=[r for r in roots if r>center_dt_utc]
    return {"previous":max(prev) if prev else None,"next":min(fut) if fut else None,"all":roots}

# ============================================================
# 9-C. AUTOMATION ALERT PROBE · V6.20
# ============================================================
# 개인 출생정보를 GitHub에 복제하지 않는다. 예약 작업은 PIN 인증 후 이 probe를 열고,
# 앱 내부에서 계산된 "알림 후보"만 읽는다. 점수/애스펙트는 사건 확률이 아니다.
ASTRO_ALERT_PROBE_VERSION = "v1"
ASTRO_ALERT_TRANSITS = ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]
ASTRO_ALERT_TARGETS = ["Sun","Moon","Mercury","Venus","Mars","ASC","MC"]
ASTRO_ALERT_ASPECTS = {"합":0.0,"육십분위":60.0,"사분위":90.0,"삼분위":120.0,"충":180.0}
ASTRO_ALERT_TARGET_KO = {"ASC":"ASC(상승점)","MC":"MC(중천점)"}


def _alert_planet_lon(body, dt_utc):
    return get_tropical_ecliptic_lon(body, sf_time(dt_utc.astimezone(UTC)))


def _alert_exact_roots(body, target_lon, angle, start_kst, end_kst):
    desired=[(target_lon+angle)%360.0]
    if angle not in {0.0,180.0}:
        desired.append((target_lon-angle)%360.0)
    roots=[]
    points=[]; cur=start_kst
    while cur<=end_kst:
        points.append(cur); cur+=timedelta(hours=1)
    if points[-1] < end_kst: points.append(end_kst)

    for target in desired:
        def f(ts_value):
            dt=datetime.fromtimestamp(float(ts_value),tz=UTC)
            return circular_delta(_alert_planet_lon(body,dt),target)
        for left,right in zip(points[:-1],points[1:]):
            a,b=left.timestamp(),right.timestamp()
            try: fa,fb=f(a),f(b)
            except Exception: continue
            # circular_delta의 ±180 경계에서 생기는 가짜 부호변화를 제외한다.
            if max(abs(fa),abs(fb))>35:
                continue
            root_ts=None
            if abs(fa)<1e-7: root_ts=a
            elif abs(fb)<1e-7: root_ts=b
            elif fa*fb<0:
                try: root_ts=brentq(f,a,b,xtol=.25,maxiter=60)
                except Exception: root_ts=None
            if root_ts is None: continue
            root=datetime.fromtimestamp(float(root_ts),tz=UTC).astimezone(KST)
            if not (start_kst<=root<=end_kst): continue
            if all(abs((root-x).total_seconds())>180 for x in roots):
                roots.append(root)
    roots.sort()
    return roots


def _personal_exact_alert_events(now_value,natal_lons,natal_houses):
    start=now_value.astimezone(KST); end=start+timedelta(hours=24)
    targets={k:float(natal_lons[k]) for k in ["Sun","Moon","Mercury","Venus","Mars"]}
    targets["ASC"]=float(natal_houses["asc"]); targets["MC"]=float(natal_houses["mc"])
    events=[]
    for body in ASTRO_ALERT_TRANSITS:
        for target in ASTRO_ALERT_TARGETS:
            target_lon=targets[target]
            for aspect_name,angle in ASTRO_ALERT_ASPECTS.items():
                for root in _alert_exact_roots(body,target_lon,angle,start,end):
                    rounded=int(round(root.timestamp()/900.0))
                    target_label=ASTRO_ALERT_TARGET_KO.get(target,PLANET_KO.get(target,target))
                    body_label=PLANET_KO.get(body,body)
                    events.append({
                        "id":f"personal:{body}:{target}:{aspect_name}:{rounded}",
                        "transit":body,"target":target,"aspect":aspect_name,
                        "label":f"{body_label} → {target_label} {aspect_name}",
                        "exact_kst":root.strftime("%Y-%m-%d %H:%M KST"),
                        "timestamp":int(root.timestamp()),
                    })
    # 같은 정확시각/조합이 양방향 target longitude 때문에 중복되면 제거한다.
    unique={}
    for e in events: unique[e["id"]]=e
    return sorted(unique.values(),key=lambda x:(x["timestamp"],x["label"]))[:12]


def _score_percentile(value, history):
    vals=[float(v) for v in history if isinstance(v,(int,float)) and not pd.isna(v)]
    if not vals or value is None:return None
    return round(100.0*sum(v<=float(value) for v in vals)/len(vals),1)


def _score_alert_candidates(natal_packed,houses_packed,now_value):
    today=now_value.astimezone(KST).date()
    start=today-timedelta(days=29)
    # 과거 29일 + 오늘 + 내일. Gemini 호출 없이 기존 결정론 점수만 계산한다.
    rows=cached_period_scores(start.isoformat(),31,natal_packed,houses_packed)
    if len(rows)<31:return []
    history=rows[:29]; current=rows[29]; tomorrow=rows[30]
    labels={
        "시험":"시험","학업":"학업","직장":"직장","이직":"이직","연애":"연애","재회":"재회",
        "연락":"연락·교류","수신신호":"수신 보조신호","발신적합":"발신 적합도","과거인연접점":"과거인연 접점",
        "금전":"금전","컨디션":"컨디션",
    }
    keys=list(labels)
    out=[]
    for when,row in [("today",current),("tomorrow",tomorrow)]:
        day_value=row.get("date")
        for key in keys:
            value=row.get(key)
            hist=[r.get(key) for r in history]
            vals=[float(v) for v in hist if isinstance(v,(int,float)) and not pd.isna(v)]
            if not vals or not isinstance(value,(int,float)) or pd.isna(value):continue
            avg=sum(vals)/len(vals); delta=float(value)-avg; pct=_score_percentile(value,vals)
            direction="high"
            qualifies=(pct is not None and pct>=90.0 and delta>=7.0)
            if key=="컨디션":
                low_pct=round(100.0*sum(v<=float(value) for v in vals)/len(vals),1)
                if low_pct<=10.0 and delta<=-7.0:
                    qualifies=True; direction="low"; pct=low_pct
                else:
                    qualifies=False
            if when=="tomorrow":
                today_value=current.get(key)
                # 내일 알림은 오늘보다도 의미 있게 움직일 때만 보낸다.
                if not isinstance(today_value,(int,float)) or abs(float(value)-float(today_value))<9.0:
                    qualifies=False
            if qualifies:
                out.append({
                    "id":f"score:{when}:{day_value}:{key}:{direction}",
                    "when":when,"date":day_value.isoformat() if hasattr(day_value,"isoformat") else str(day_value),
                    "key":key,"label":labels[key],"direction":direction,
                    "score":int(round(float(value))),"avg30":round(avg,1),"delta":round(delta,1),"percentile":pct,
                    "strength":round(abs(delta)+(pct if direction=="high" else 100-pct)/10.0,2),
                })
    out.sort(key=lambda x:-x["strength"])
    return out[:6]


def build_automation_alert_probe(now_value,natal_lons,natal_houses,natal_packed,houses_packed):
    return {
        "probe_version":ASTRO_ALERT_PROBE_VERSION,
        "generated_at":now_value.astimezone(KST).isoformat(),
        "personal_events":_personal_exact_alert_events(now_value,natal_lons,natal_houses),
        "score_alerts":_score_alert_candidates(natal_packed,houses_packed,now_value),
        "note":"개인 애스펙트/생활점수는 알림 후보용 보조지표이며 사건 발생 확률이 아니다.",
    }


# ============================================================
# 10. PROFILE / QUERY INPUTS
# ============================================================
def _profile_date_default():
    try:return date.fromisoformat(_secret_text("PROFILE_BIRTH_DATE","2000-01-01"))
    except ValueError:return date(2000,1,1)


def _profile_time_default():
    try:return dt_time.fromisoformat(_secret_text("PROFILE_BIRTH_TIME","12:00"))
    except ValueError:return dt_time(12,0)


def _profile_place_default():
    raw=_secret_text("PROFILE_BIRTH_PLACE","서울특별시")
    return raw if raw in KOREA_BIRTHPLACES else "서울특별시"


PROFILE_NAME_DEFAULT=_secret_text("PROFILE_NAME","사용자") or "사용자"
PROFILE_BIRTH_DATE_DEFAULT=_profile_date_default(); PROFILE_BIRTH_TIME_DEFAULT=_profile_time_default(); PROFILE_BIRTH_PLACE_DEFAULT=_profile_place_default()

now_kst=datetime.now(KST)
today_kst=now_kst.date()


# ============================================================
# RELATIONSHIP DIRECTION SIGNALS + PERSONAL CALIBRATION · V6.10
# ============================================================
# 기존 '연락' 점수는 수신/발신을 합친 커뮤니케이션 활성도다.
# 아래 세 값은 동일 계산 근거를 방향성 관점으로 재조합한 실험 보조지표이며
# 사건 확률이 아니다. 실제 결과 기록을 쌓아 개인별 유효성을 나중에 검증한다.
RELATIONSHIP_SIGNAL_VERSION = "v1.0"
RELATIONSHIP_OBSERVATION_VERSION = "v1.1"
RELATIONSHIP_OUTCOME_KIND = "outcome"
RELATIONSHIP_OUTCOME_MIN_COMPARE = 5
RELATIONSHIP_OUTCOME_CALIBRATION_READY = 20

DISPLAY_LABELS["연락"] = "연락·교류 활성도"
DISPLAY_LABELS["소식"] = "일반 소식·문서운"

TOPIC_STATE_COPY["연락"].update({
    "strong":"메시지·전화·대화처럼 접촉과 커뮤니케이션 축이 강하게 활성화되는 흐름이야. 누가 먼저 움직이는지는 이 점수 하나로 정하지 않아.",
    "upper":"연락·대화 축이 비교적 살아 있는 날이야. 받는 연락과 먼저 보내는 행동은 아래 방향 보조지표를 따로 봐.",
    "mid":"연락·대화 흐름은 중간 정도야. 실제 접점이 생길 수 있지만 방향과 상대를 이 점수만으로 단정하진 않아.",
    "lower":"커뮤니케이션 축의 전반적인 활성도가 낮은 편이야. 그래도 개별 연락 한 건의 발생 여부를 막는 확률값은 아니야.",
    "weak":"연락축이 상대적으로 조용한 날이야. 특정 연락의 부재를 뜻하는 예언값이 아니라 다른 날짜와 비교한 내부 상대지수야.",
})
TOPIC_STATE_COPY["소식"].update({
    "strong":"기관 공지·결과 통보·메일·문서·업무 정보처럼 일반 외부 소식 축이 활발한 흐름이야.",
    "upper":"공식 안내·문서·결과 통보처럼 일반적인 외부 정보 흐름을 확인해볼 만한 날이야.",
    "mid":"일반 소식·문서 흐름은 중간 정도야. 연애 연락과는 별도 축으로 봐야 해.",
    "lower":"공식 소식·문서·결과 통보 쪽 움직임이 상대적으로 약한 편이야. 개인 연락의 발생 여부와는 같은 뜻이 아니야.",
    "weak":"새로운 공식 소식보다 기존 메일·문서·일정을 재확인하는 쪽에 가까운 흐름이야. 사적 연락 여부를 대신 판정하지 않아.",
})


def relationship_direction_scores(topic_results):
    """Experimental heuristics derived only from already-computed topic activation/favorability."""
    contact = topic_results.get("연락") or {"activation":0,"favorability":50}
    reunion = topic_results.get("재회") or {"activation":0,"favorability":50}
    news = topic_results.get("소식") or {"activation":0,"favorability":50}
    romance = topic_results.get("연애") or {"activation":0,"favorability":50}

    # 수신: 연락축 활성 + 외부에서 들어오는 정보축 + 과거인연 재활성 배경을 조금 더 본다.
    inbound = clamp(
        .42*contact["activation"] + .18*contact["favorability"]
        + .18*news["activation"] + .14*reunion["activation"]
        + .08*romance["activation"]
    )
    # 발신 적합: '움직임'보다 내가 먼저 말을 걸었을 때의 매끄러움(우호도)을 더 크게 본다.
    outbound = clamp(
        .28*contact["activation"] + .46*contact["favorability"]
        + .12*romance["favorability"] + .08*reunion["favorability"]
        + .06*news["favorability"]
    )
    # 과거인연 접점: 재회 테마가 실제 연락축과 동시에 활성화되는 정도만 본다.
    past_link = clamp(
        .40*reunion["activation"] + .24*reunion["favorability"]
        + .26*contact["activation"] + .10*contact["favorability"]
    )
    return {
        "수신신호":int(round(inbound)),
        "발신적합":int(round(outbound)),
        "과거인연접점":int(round(past_link)),
    }


_derived_action_scores_before_relationship_v610 = derived_action_scores

def derived_action_scores(topic_results):
    out = _derived_action_scores_before_relationship_v610(topic_results)
    out.update(relationship_direction_scores(topic_results))
    return out


_build_ai_daily_payload_before_relationship_v610 = build_ai_daily_payload

def build_ai_daily_payload(query_date, daily_scores, topic_results, timing_rows, market_rows, moon_ingresses):
    payload = _build_ai_daily_payload_before_relationship_v610(
        query_date, daily_scores, topic_results, timing_rows, market_rows, moon_ingresses
    )
    signals = relationship_direction_scores(topic_results)
    payload["relationship_signals"] = {
        "contact_activity": daily_scores.get("연락"),
        "incoming_support": signals["수신신호"],
        "outgoing_fit": signals["발신적합"],
        "past_connection_contact": signals["과거인연접점"],
        "note":"실험 보조지표. 사건 확률이 아니며 특정 상대의 행동을 예측하지 않는다. 연락 점수는 수신/발신을 합친 교류 활성도다.",
    }
    return payload


_build_ai_period_payload_before_relationship_v610 = build_ai_period_payload

def build_ai_period_payload(kind,start_date,end_date,rows):
    payload = _build_ai_period_payload_before_relationship_v610(kind,start_date,end_date,rows)
    rel = {}
    for key in ["수신신호","발신적합","과거인연접점"]:
        stats = _period_topic_stats(rows,key)
        if stats:
            rel[key] = stats
    payload["relationship_signals"] = {
        "note":"실험 보조지표. 연락 원점수는 교류 활성도이며 수신/발신 확률이 아니다.",
        "metrics":rel,
    }
    for packed,row in zip(payload.get("days",[]), rows or []):
        for key in ["수신신호","발신적합","과거인연접점"]:
            packed[key] = _period_json_scalar(row.get(key)) if isinstance(row,dict) else None
    return payload


# New payload semantics must invalidate old daily browser/server interpretation caches.
AI_INTERPRETER_VERSION = "v6.10.0"
AI_SYSTEM_PROMPT += """

[연락 방향 해석 규칙]
- topics.연락 점수는 '연락·교류 활성도'다. 받는 연락 확률이나 먼저 보내야 한다는 지시가 아니다.
- relationship_signals.incoming_support는 '수신 쪽 보조신호', outgoing_fit은 '내가 먼저 연락할 때의 적합도', past_connection_contact는 '과거인연 테마와 연락축의 동시 활성'을 보는 실험 보조지표다.
- 이 세 값 역시 사건 확률이 아니고 특정인의 행동을 보장하지 않는다.
- 연락 topic의 verdict/reason에서는 수신과 발신을 분리해 설명한다. contact_activity가 높다는 이유만으로 action을 '먼저 연락해'로 만들지 마라.
- incoming_support가 높아도 '연락이 온다'고 단정하지 말고, 외부에서 접점이 생기는 방향의 상징적 신호가 상대적으로 살아 있다고 표현한다.
- past_connection_contact가 높아도 특정 과거 인연을 지목하거나 재회를 보장하지 않는다.
- 소식은 일반 소식·문서·기관 공지 축이다. 낮은 소식 점수를 사적인 연락 부재와 동일시하지 마라.
"""
PERIOD_AI_SYSTEM_PROMPT += """

연락 점수는 기간 내 '교류 활성도'이며 수신/발신 확률이 아니다. relationship_signals가 있으면 수신 보조신호·발신 적합도·과거인연 접점을 분리해서 읽고, 연락 활성도만 보고 '먼저 연락하라'고 결론내리지 마라. 소식은 일반 소식·문서·기관 공지 축으로 사적 연락과 구분한다.
"""
try:
    ANNUAL_AI_SYSTEM_PROMPT += """

연간의 연락 점수는 교류 활성도다. 받는 연락과 먼저 보내는 행동을 같은 뜻으로 쓰지 말고, 특정 상대의 연락을 예언하지 마라. 소식은 일반 소식·문서 축으로 사적 연락과 구분한다.
"""
except NameError:
    pass


_topic_action_before_relationship_v610 = topic_action

def topic_action(topic, score):
    if topic == "연락":
        return "연락이 들어오면 실제 내용과 후속 대화를 먼저 봐. 네가 먼저 보낼지는 연락 활성도 하나가 아니라 아래 '발신 적합도'를 따로 확인해."
    if topic == "소식":
        return "기관 공지·메일·문서·결과 통보를 확인해. 이 항목은 사적인 연애 연락 여부를 대신 판단하지 않아."
    return _topic_action_before_relationship_v610(topic, score)


_topic_decision_note_before_relationship_v610 = topic_decision_note

def topic_decision_note(topic, score, timing=None):
    if topic == "연락":
        return "연락축 해석 → 이 점수는 받는 연락과 보내는 연락을 합친 교류 활성도야. 먼저 보낼지는 아래 '발신 적합도', 외부에서 접점이 들어오는 쪽은 '수신 보조신호'를 따로 봐."
    if topic == "소식":
        return "소식축 해석 → 일반 소식·문서·기관 공지용 지수야. 사적인 연애 연락이 오느냐와는 별도 축이야."
    return _topic_decision_note_before_relationship_v610(topic, score, timing)


_period_topic_text_before_relationship_v610 = period_topic_text

def period_topic_text(rows,key):
    if key in {"연락","소식"}:
        avg=period_avg(rows,key); best=period_extreme(rows,key,True); worst=period_extreme(rows,key,False)
        if avg is None:return "해당 기간에 계산할 수 있는 데이터가 없습니다."
        if key=="연락":
            return (
                f"기간 평균 <strong>{avg} · {score_band(avg)}</strong>. 이 값은 연락의 수신·발신을 합친 교류 활성도야. "
                f"상대적으로 활성도가 높은 날은 <strong>{best['label']} {best[key]}</strong>, 조용한 날은 <strong>{worst['label']} {worst[key]}</strong>이야. "
                "누가 먼저 연락하는지나 특정 연락의 발생 확률로 읽지 말고, 아래 방향 보조지표를 함께 봐."
            )
        return (
            f"기간 평균 <strong>{avg} · {score_band(avg)}</strong>. 일반 소식·문서·기관 공지 흐름을 보는 축이야. "
            f"상대적으로 활발한 날은 <strong>{best['label']} {best[key]}</strong>, 조용한 날은 <strong>{worst['label']} {worst[key]}</strong>이야. "
            "사적인 연애 연락의 발생 여부와는 별도로 해석해."
        )
    return _period_topic_text_before_relationship_v610(rows,key)


def _relationship_outcome_id(day_value):
    return "outcome:" + day_value.isoformat()


def _read_relationship_outcome(day_value):
    if streamlit_js_eval is None:
        return None
    rid_js=json.dumps(_relationship_outcome_id(day_value))
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    nonce=int(st.session_state.get("_relationship_outcome_read_nonce",0) or 0)
    body=(
        f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({rid_js}));db.close();"
        f"return rec&&rec.payload?JSON.stringify(rec.payload):{empty_js};"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,f"return {empty_js};"),key=f"rel_outcome_read_{day_value.isoformat()}_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return {}
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else {}
    except Exception:return {}


def _read_relationship_outcomes():
    if streamlit_js_eval is None:
        return None
    nonce=int(st.session_state.get("_relationship_outcome_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='outcome'&&x.payload).map(x=>x.payload);"
        "out.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));return JSON.stringify(out);"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,"return '[]';"),key=f"rel_outcomes_all_{nonce}")
    if value is None:return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _write_relationship_outcome(payload):
    if streamlit_js_eval is None:return "unavailable"
    record={
        "id":"outcome:"+str(payload.get("date") or ""),
        "kind":"outcome",
        "sort_key":str(payload.get("date") or ""),
        "saved_at":int(time.time()),
        "payload":payload,
        "schema":BROWSER_IDB_SCHEMA_VERSION,
    }
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,"return 'fail';"),key=f"rel_outcome_write_{fp}")


def _mean_metric(items,key):
    vals=[]
    for item in items:
        try:
            v=(item.get("scores") or {}).get(key)
            if isinstance(v,(int,float)) and not pd.isna(v):vals.append(float(v))
        except Exception:
            pass
    return round(sum(vals)/len(vals),1) if vals else None


def _relationship_calibration_summary(entries):
    rows=[x for x in (entries or []) if isinstance(x,dict) and x.get("event") in {"none","received","sent","both"}]
    recv_yes=[x for x in rows if x.get("event") in {"received","both"}]
    recv_no=[x for x in rows if x.get("event") in {"none","sent"}]
    sent_yes=[x for x in rows if x.get("event") in {"sent","both"}]
    sent_no=[x for x in rows if x.get("event") in {"none","received"}]
    past_yes=[x for x in rows if bool(x.get("past_connection")) and x.get("event")!="none"]
    past_no=[x for x in rows if not bool(x.get("past_connection"))]
    occurred=[x for x in rows if x.get("event")!="none"]
    time_counts={}
    channel_counts={}
    for item in occurred:
        time_key=str(item.get("event_time_bucket") or "").strip()
        channel_key=str(item.get("channel") or "").strip()
        if time_key:time_counts[time_key]=time_counts.get(time_key,0)+1
        if channel_key:channel_counts[channel_key]=channel_counts.get(channel_key,0)+1
    return {
        "n":len(rows),
        "event_time_counts":time_counts,
        "channel_counts":channel_counts,
        "recv_yes_n":len(recv_yes),"recv_no_n":len(recv_no),
        "recv_yes":_mean_metric(recv_yes,"수신신호"),"recv_no":_mean_metric(recv_no,"수신신호"),
        "sent_yes_n":len(sent_yes),"sent_no_n":len(sent_no),
        "sent_yes":_mean_metric(sent_yes,"발신적합"),"sent_no":_mean_metric(sent_no,"발신적합"),
        "past_yes_n":len(past_yes),"past_no_n":len(past_no),
        "past_yes":_mean_metric(past_yes,"과거인연접점"),"past_no":_mean_metric(past_no,"과거인연접점"),
    }


def render_relationship_signal_panel(query_date,daily_scores,daily_topic_results):
    signals=relationship_direction_scores(daily_topic_results)
    cards=[
        ("💌","교류 활성도",daily_scores.get("연락"),"수신+발신 전체 연락축"),
        ("📥","수신 보조신호",signals["수신신호"],"외부에서 접점이 들어오는 쪽의 실험 보조값"),
        ("📤","발신 적합도",signals["발신적합"],"내가 먼저 말을 걸 때의 매끄러움 보조값"),
        ("🔄","과거인연 접점",signals["과거인연접점"],"과거인연 테마와 연락축의 동시 활성 보조값"),
    ]
    html_grid="<div class='score-grid'>"
    for icon,label,value,desc in cards:
        html_grid+=(f"<div class='score-card'><div class='score-name'>{icon} {label}</div>"
                   f"<div class='score-num'>{value}</div><div class='score-band'>{score_band(value)}</div>"
                   f"<div class='ast-sub' style='margin-top:7px'>{desc}</div></div>")
    html_grid+="</div>"
    st.markdown("#### 💌 연락 방향 보조지표")
    st.markdown(html_grid,unsafe_allow_html=True)
    st.caption("🧪 실험 보조지표야. 모두 사건 확률이 아니고 특정 상대의 행동을 보장하지 않아. 실제 결과를 쌓아서 개인별로 맞는지 검증하는 용도야.")

    existing=_read_relationship_outcome(query_date)
    existing=existing if isinstance(existing,dict) else {}
    event_options=["기록 안 함","연락 없음","연락 받음","내가 먼저 보냄","서로 주고받음"]
    code_by_label={"기록 안 함":"","연락 없음":"none","연락 받음":"received","내가 먼저 보냄":"sent","서로 주고받음":"both"}
    label_by_code={v:k for k,v in code_by_label.items()}
    default_label=label_by_code.get(existing.get("event"),"기록 안 함")
    time_options=["시간 기록 안 함","새벽(00~06)","오전(06~12)","오후(12~18)","저녁(18~22)","밤(22~24)"]
    time_code={"시간 기록 안 함":"","새벽(00~06)":"dawn","오전(06~12)":"morning","오후(12~18)":"afternoon","저녁(18~22)":"evening","밤(22~24)":"night"}
    time_label={v:k for k,v in time_code.items()}
    default_time=time_label.get(existing.get("event_time_bucket"),"시간 기록 안 함")
    channel_options=["경로 기록 안 함","문자·메신저","DM·SNS","전화","직접 만남","기타"]
    channel_code={"경로 기록 안 함":"","문자·메신저":"message","DM·SNS":"dm","전화":"call","직접 만남":"in_person","기타":"other"}
    channel_label={v:k for k,v in channel_code.items()}
    default_channel=channel_label.get(existing.get("channel"),"경로 기록 안 함")

    with st.expander("🧪 실제 결과 기록 · 개인보정",expanded=False):
        st.caption("연락이 있었던 날뿐 아니라 '연락 없음'인 날도 같이 기록해야 비교가 덜 치우쳐. 기록은 이 기기 IndexedDB에만 저장되고 저장함 JSON 백업에도 포함돼.")
        with st.form(f"relationship_outcome_form_{query_date.isoformat()}"):
            event_label=st.selectbox("이 날 실제 연락 결과",event_options,index=event_options.index(default_label))
            past_connection=st.checkbox("과거 인연 관련 연락",value=bool(existing.get("past_connection",False)))
            meta_cols=st.columns(2)
            with meta_cols[0]:
                event_time_label=st.selectbox("연락 시각대(선택)",time_options,index=time_options.index(default_time))
            with meta_cols[1]:
                channel_label_value=st.selectbox("연락 경로(선택)",channel_options,index=channel_options.index(default_channel))
            note=st.text_input("짧은 메모(선택)",value=str(existing.get("note") or "")[:200],placeholder="예: 저녁에 먼저 전화 옴")
            st.caption("시각대·경로는 나중에 일중 트랜짓 패턴을 검증하기 위한 메타데이터야. 현재 운세 점수나 가중치를 즉시 바꾸지는 않아.")
            save=st.form_submit_button("💾 실제 결과 저장",use_container_width=True)
        if save:
            event=code_by_label.get(event_label,"")
            if not event:
                st.warning("결과를 하나 선택해줘.")
            else:
                payload={
                    "version":RELATIONSHIP_SIGNAL_VERSION,
                    "date":query_date.isoformat(),
                    "event":event,
                    "past_connection":bool(past_connection and event!="none"),
                    "event_time_bucket":time_code.get(event_time_label,"") if event!="none" else "",
                    "channel":channel_code.get(channel_label_value,"") if event!="none" else "",
                    "note":note.strip()[:200],
                    "recorded_at":int(time.time()),
                    "scores":{
                        "연락":daily_scores.get("연락"),
                        "수신신호":signals.get("수신신호"),
                        "발신적합":signals.get("발신적합"),
                        "과거인연접점":signals.get("과거인연접점"),
                        "재회":daily_scores.get("재회"),
                        "연애":daily_scores.get("연애"),
                        "소식":daily_scores.get("소식"),
                    },
                }
                st.session_state["_relationship_outcome_pending"]=payload

        pending=st.session_state.get("_relationship_outcome_pending")
        if isinstance(pending,dict) and pending.get("date")==query_date.isoformat():
            result=_write_relationship_outcome(pending)
            if result is None:
                st.caption("IndexedDB에 결과를 저장하는 중...")
            elif str(result)=="ok":
                st.session_state.pop("_relationship_outcome_pending",None)
                st.session_state["_relationship_outcome_read_nonce"]=int(st.session_state.get("_relationship_outcome_read_nonce",0) or 0)+1
                st.success("✅ 실제 결과 저장 완료. 이후 개인보정 비교에 포함할게.")
            else:
                st.session_state.pop("_relationship_outcome_pending",None)
                st.error("실제 결과 저장에 실패했어. 브라우저 저장공간을 확인해줘.")

        entries=_read_relationship_outcomes()
        if isinstance(entries,list):
            summary=_relationship_calibration_summary(entries)
            n=summary["n"]
            st.markdown(f"**개인보정 기록 · {n}일**")
            time_names={"dawn":"새벽","morning":"오전","afternoon":"오후","evening":"저녁","night":"밤"}
            channel_names={"message":"문자·메신저","dm":"DM·SNS","call":"전화","in_person":"직접 만남","other":"기타"}
            time_counts=summary.get("event_time_counts") or {}
            channel_counts=summary.get("channel_counts") or {}
            if time_counts:
                time_text=" · ".join(f"{time_names.get(k,k)} {v}회" for k,v in sorted(time_counts.items(),key=lambda x:(-x[1],x[0])))
                st.caption("⏱ 기록된 연락 시각대 · "+time_text)
            if channel_counts:
                channel_text=" · ".join(f"{channel_names.get(k,k)} {v}회" for k,v in sorted(channel_counts.items(),key=lambda x:(-x[1],x[0])))
                st.caption("📨 기록된 연락 경로 · "+channel_text)
            if n < RELATIONSHIP_OUTCOME_MIN_COMPARE:
                st.caption(f"아직 표본이 적어. 최소 {RELATIONSHIP_OUTCOME_MIN_COMPARE}일 이상부터 발생일/비발생일 평균을 참고용으로 비교할게.")
            else:
                cols=st.columns(3)
                def show_compare(col,title,yes,no,yn,nn):
                    with col:
                        st.caption(title)
                        if yes is None or no is None:
                            st.write("비교 표본 부족")
                        else:
                            st.metric("발생일 평균",yes,delta=round(yes-no,1),help=f"발생 {yn}일 · 비교 {nn}일. 적중률이 아니라 평균 차이야.")
                            st.caption(f"비발생/비해당 평균 {no}")
                show_compare(cols[0],"📥 수신신호",summary["recv_yes"],summary["recv_no"],summary["recv_yes_n"],summary["recv_no_n"])
                show_compare(cols[1],"📤 발신 적합도",summary["sent_yes"],summary["sent_no"],summary["sent_yes_n"],summary["sent_no_n"])
                show_compare(cols[2],"🔄 과거인연 접점",summary["past_yes"],summary["past_no"],summary["past_yes_n"],summary["past_no_n"])
                st.caption("이 비교는 자기기록 기반 관찰값이라 통계적 검증이나 사건 확률이 아니야. 연락 없는 날도 기록해야 선택편향이 줄어들어.")
            if n < RELATIONSHIP_OUTCOME_CALIBRATION_READY:
                st.progress(min(1.0,n/RELATIONSHIP_OUTCOME_CALIBRATION_READY),text=f"자동 가중치 보정 후보까지 {n}/{RELATIONSHIP_OUTCOME_CALIBRATION_READY}일 · 아직 엔진 가중치는 자동 변경하지 않아")
            else:
                st.success("🧪 20일 이상 기록됐어. 이 단계부터는 발생/비발생 표본 균형을 확인한 뒤 별도 검증을 거쳐 개인 가중치 보정을 검토할 수 있어. 자동으로 과적합시키지는 않아.")
    return signals

# ============================================================
# PUSH DEEP-LINK ROUTING · V6.8
# ============================================================
# GitHub Pages 홈 화면 런처가 OneSignal 알림의 목적지를 query param으로 전달한다.
# 한 Streamlit 세션에서 같은 알림 파라미터를 매 rerun마다 다시 강제하지 않도록 signature를 기억한다.
PUSH_ROUTE_TO_VIEW={"daily":"오늘","weekly":"주간","monthly":"월간","annual":"연간","precision":"정밀분석"}


def _query_param_text(name):
    try:
        value=st.query_params.get(name,"")
        if isinstance(value,(list,tuple)):
            return str(value[-1]) if value else ""
        return str(value or "")
    except Exception:
        try:
            values=st.experimental_get_query_params().get(name,[])
            return str(values[-1]) if values else ""
        except Exception:
            return ""


push_kind=_query_param_text("push_kind").strip().lower()
push_date_text=_query_param_text("push_date").strip()
push_year_text=_query_param_text("push_year").strip()
push_month_text=_query_param_text("push_month").strip()
push_signature="|".join([push_kind,push_date_text,push_year_text,push_month_text])

if push_kind in PUSH_ROUTE_TO_VIEW and st.session_state.get("_push_route_applied")!=push_signature:
    st.session_state["main_view"]=PUSH_ROUTE_TO_VIEW[push_kind]
    if push_kind in {"daily","weekly"} and push_date_text:
        try:
            pushed_date=date.fromisoformat(push_date_text)
            st.session_state["profile_query_date"]=pushed_date
        except ValueError:
            pass
    if push_kind=="monthly" and push_year_text and push_month_text:
        try:
            pushed_year=int(push_year_text); pushed_month=int(push_month_text)
            if 1<=pushed_month<=12:
                st.session_state["monthly_year"]=pushed_year
                st.session_state["monthly_month"]=pushed_month
                st.session_state["monthly_year_select"]=pushed_year
                st.session_state["monthly_month_select"]=pushed_month
                st.session_state["_push_monthly_autocalc"]=True
        except ValueError:
            pass
    st.session_state["_push_route_applied"]=push_signature
    st.session_state["_push_route_notice"]=push_kind

st.markdown("""
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
""",unsafe_allow_html=True)
st.caption(f"{EPHEMERIS_USED} · Tropical · Whole Sign 주 기준 · Placidus 보조")

with st.expander("👤 나의 출생 프로필", expanded=False):
    user_name=st.text_input("호칭",value=PROFILE_NAME_DEFAULT,key="profile_name")
    birth_gender=st.selectbox("성별 · 사주 대운 계산용",["여성","남성"],index=0,key="profile_birth_gender")
    birth_date=st.date_input("출생일",PROFILE_BIRTH_DATE_DEFAULT,key="profile_birth_date")
    birth_time=st.time_input("출생 시간",PROFILE_BIRTH_TIME_DEFAULT,step=60,key="profile_birth_time")
    _place_groups={}
    for _place_name in KOREA_BIRTHPLACES:
        _province=_place_name.split()[0]
        _place_groups.setdefault(_province,[]).append(_place_name)
    _default_province=PROFILE_BIRTH_PLACE_DEFAULT.split()[0]
    _province_options=list(_place_groups)+["해외·직접 좌표"]
    _province_index=_province_options.index(_default_province) if _default_province in _province_options else 0
    birth_province=st.selectbox("출생 시·도",_province_options,index=_province_index,key="profile_birth_province")
    if birth_province=="해외·직접 좌표":
        place_label=st.text_input("출생 지역명",value="",placeholder="예: Tokyo, Japan",key="profile_birth_place_direct") or "직접 좌표"
        lat=st.number_input("출생지 위도(N)",value=34.7604,format="%.6f",key="_direct_lat")
        lon=st.number_input("출생지 경도(E)",value=127.6622,format="%.6f",key="_direct_lon")
        birth_place="직접 좌표 입력(고급)"
    else:
        _city_options=_place_groups[birth_province]
        _default_city=PROFILE_BIRTH_PLACE_DEFAULT if PROFILE_BIRTH_PLACE_DEFAULT in _city_options else _city_options[0]
        birth_place=st.selectbox(
            "출생 시·군·구",_city_options,index=_city_options.index(_default_city),
            format_func=lambda x:(x[len(birth_province):].strip() or x),key="profile_birth_place"
        )
        lat,lon=KOREA_BIRTHPLACES[birth_place]; place_label=birth_place
# 날짜는 오늘 자동. 사용자가 원할 때만 바꾼다.
query_date=st.date_input("기준 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택돼. 다른 날짜를 볼 때만 바꿔.")
query_ref_time=now_kst.time().replace(second=0,microsecond=0) if query_date==today_kst else dt_time(12,0)
query_dt_kst=KST.localize(datetime.combine(query_date,query_ref_time)); query_dt_utc=query_dt_kst.astimezone(UTC)

birth_dt_kst=KST.localize(datetime.combine(birth_date,birth_time)); birth_dt_utc=birth_dt_kst.astimezone(UTC)
t_birth=sf_time(birth_dt_utc)

try:
    natal_houses=compute_houses(birth_dt_utc,lat,lon)
except Exception as exc:
    st.error(f"ASC/하우스 계산 실패: {exc}"); st.stop()

natal_lons={body:get_tropical_ecliptic_lon(body,t_birth) for body in PLANET_KEYS}
birth_is_day=is_day_chart(birth_dt_utc,lat,lon)
pof_lon=calculate_pof(natal_houses["asc"],natal_lons["Sun"],natal_lons["Moon"],birth_is_day)
natal_packed=pack_natal_lons(natal_lons); houses_packed=pack_houses(natal_houses)

# Headless alert watcher: 인증을 통과한 뒤에만 개인 알림 후보를 계산한다.
try:
    _alert_probe_value=st.query_params.get("alert_probe","")
    if isinstance(_alert_probe_value,(list,tuple)):_alert_probe_value=_alert_probe_value[-1] if _alert_probe_value else ""
except Exception:
    _alert_probe_value=""
if str(_alert_probe_value or "").strip()=="1":
    st.caption("ASTRO_ALERT_PROBE_V1")
    with st.spinner("개인 트랜짓과 30일 기준선을 계산하는 중..."):
        _alert_payload=build_automation_alert_probe(now_kst,natal_lons,natal_houses,natal_packed,houses_packed)
    st.code("ASTRO_ALERT_JSON="+json.dumps(_alert_payload,ensure_ascii=False,separators=(",",":")),language="json")
    st.stop()

asc_sign,asc_deg,_=get_sign_and_degree(natal_houses["asc"])
st.markdown(f"<div class='profile-strip'><strong>{user_name}</strong> · {birth_date:%Y.%m.%d} {birth_time:%H:%M} · {place_label}<br>ASC <strong>{asc_sign} {asc_deg:.2f}°</strong></div>",unsafe_allow_html=True)

# ============================================================
# 11. TABS
# ============================================================
_main_views=["오늘","주간","월간","연간","통합운세","궁합운","저장함","정밀분석"]
if st.session_state.get("main_view") not in _main_views:
    st.session_state["main_view"]="오늘"
main_view=st.session_state["main_view"]

st.markdown('<div class="astro-nav-label">기간 선택</div>',unsafe_allow_html=True)
with st.container(key="astro_period_nav_group"):
    _nav_period=st.columns(4,gap="small")
    _period_items=[("오늘","☀ 오늘"),("주간","▣ 주간"),("월간","☾ 월간"),("연간","◎ 연간")]
    for _i,(_route,_display) in enumerate(_period_items):
        if _nav_period[_i].button(_display,key=f"main_nav_period_{_i}",use_container_width=True,type="primary" if main_view==_route else "secondary"):
            if main_view!=_route:
                st.session_state["main_view"]=_route
                st.rerun()

st.markdown('<div class="astro-nav-label astro-nav-tools">분석 도구</div>',unsafe_allow_html=True)
with st.container(key="astro_tool_nav_group"):
    _nav_tools=st.columns(4,gap="small")
    _tool_items=[
        ("통합운세","✦ 통합운세"),
        ("궁합운","♥ 궁합운"),
        ("저장함","▣ 저장함"),
        ("정밀분석","⌕ 정밀분석"),
    ]
    for _i,(_route,_display) in enumerate(_tool_items):
        if _nav_tools[_i].button(_display,key=f"main_nav_tool_{_i}",use_container_width=True,type="primary" if main_view==_route else "secondary"):
            if main_view!=_route:
                st.session_state["main_view"]=_route
                st.rerun()
if st.session_state.pop("_push_route_notice",None):
    st.caption("🔔 운세 알림에서 해당 리포트로 바로 이동했어.")

# ------------------------------------------------------------
# DAILY
# ------------------------------------------------------------
if main_view=="오늘":
    st.markdown(f"### 🌙 {query_date:%Y년 %m월 %d일}({WEEKDAY_KO[query_date.weekday()]}) 일일 리포트")
    if query_date==today_kst: st.caption("앱을 열었을 때 오늘 날짜를 자동으로 계산합니다. 기준 시각 입력은 필요 없습니다.")
    else: st.caption("선택한 날짜의 하루 전체 흐름을 여러 시간대로 나눠 계산합니다.")

    moon_ingresses=cached_moon_ingresses(query_date.isoformat())
    if moon_ingresses:
        moon_text=" · ".join(f"{datetime.fromisoformat(ts).strftime('%H:%M')} {sign} 진입" for ts,sign in moon_ingresses)
        st.markdown(f"<div class='astro-note'>🌙 <strong>오늘 달의 별자리 전환</strong> · {moon_text}<br>이건 모두에게 공통인 하늘의 분위기 변화이고, 개인 운세 점수는 네이탈 트랜짓·하우스 계산을 우선해.</div>",unsafe_allow_html=True)

    with st.spinner("하루 전체 흐름을 계산하는 중..."):
        # 기존 일일 점수(07:00~23:30)는 그대로 유지하고, 새벽 00:00~06:30은 시간대 탐색에만 추가한다.
        life_rows=cached_intraday_scan(query_date.isoformat(),"07:00:00","23:30:00",30,natal_packed,houses_packed)
        early_rows=cached_intraday_scan(query_date.isoformat(),"00:00:00","06:30:00",30,natal_packed,houses_packed)
        timing_rows=early_rows+life_rows
        market_rows=cached_intraday_scan(query_date.isoformat(),"09:00:00","15:30:00",15,natal_packed,houses_packed) if is_krx_session(query_date) else []

    daily_scores={k:rows_avg(life_rows,k) for k in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]}
    daily_topic_results={topic: aggregate_topic_result(life_rows, topic) for topic in AI_TOPIC_ORDER}
    st.markdown("<div class='section-kicker'>오늘의 분야별 지수 · 서로 다른 분야의 원점수를 단순 순위화하지 않습니다</div>",unsafe_allow_html=True)
    grid="<div class='score-grid'>"
    for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
        score=daily_scores[key]
        grid+=f"<div class='score-card'><div class='score-name'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='score-num'>{score}</div><div class='score-band'>{score_band(score)}</div></div>"
    grid+="</div>"; st.markdown(grid,unsafe_allow_html=True)
    st.caption("숫자는 사건 확률이 아니라 같은 분야 안에서 흐름을 비교하기 위한 내부 상대지수야.")
    relationship_signals=render_relationship_signal_panel(query_date,daily_scores,daily_topic_results)

    # V6.2: AI 정밀해설을 메인 해석층으로 사용하고 기본 규칙문은 검산용으로 내린다.
    # daily_topic_results는 위 연락 방향 패널과 AI가 함께 재사용한다.
    ai_payload=build_ai_daily_payload(query_date,daily_scores,daily_topic_results,timing_rows,market_rows,moon_ingresses)

    configured_ai_model=_ai_model()
    ai_model_options=list(AI_SUPPORTED_MODELS.keys())
    ai_model_index=ai_model_options.index(configured_ai_model) if configured_ai_model in ai_model_options else 0
    selected_ai_model=st.selectbox(
        "✨ AI 해설 모델",
        ai_model_options,
        index=ai_model_index,
        format_func=lambda m: AI_SUPPORTED_MODELS[m],
        help="3.7 Flash는 정밀 해설 기본값이고, 호출 실패 시 3.6 Flash로 자동 대체돼. 3.6을 직접 고르면 3.6만 사용해.",
        key="ai_daily_model_choice",
    )
    with st.spinner(f"✨ {AI_SUPPORTED_MODELS[selected_ai_model]}가 계산 근거를 종합 해석하는 중..."):
        ai_result=get_ai_daily_interpretation(ai_payload,selected_ai_model)

    if ai_result and ai_result.get("cache_waiting"):
        st.caption("⚡ 이 기기에 저장된 AI 해설이 있는지 확인하는 중...")
        ai_data={}
    else:
        ai_data=render_ai_overview(ai_result) or {}
    ai_topic_analysis=ai_data.get("topic_analysis",{}) if isinstance(ai_data,dict) else {}

    st.markdown("#### 💵 돈 · 공부 · 진로")
    for topic in ["금전","학업","시험","직장","이직"]:
        result=daily_topic_results[topic]
        render_topic_card(topic,daily_scores[topic],result,result["evidence"],"daily",daily_scores,timing_rows,ai_topic_analysis.get(topic,{}))

    st.markdown("#### 💖 관계 · 연락 · 소식")
    for topic in ["연애","연락","재회","소식"]:
        result=daily_topic_results[topic]
        render_topic_card(topic,daily_scores[topic],result,result["evidence"],"daily",daily_scores,timing_rows,ai_topic_analysis.get(topic,{}))

    st.markdown("#### 🌿 컨디션")
    result=daily_topic_results["컨디션"]
    render_topic_card("컨디션",daily_scores["컨디션"],result,result["evidence"],"daily",daily_scores,timing_rows,ai_topic_analysis.get("컨디션",{}))
    st.caption("컨디션·회복 지수는 점성술상의 활동 리듬 참고값이며 질병·진단·치료 예측이 아닙니다.")

    st.markdown("#### 📈 주식·투자")
    if not market_rows:
        nxt=next_krx_session(query_date)
        nxt_text=f" · 다음 KRX 거래일 <strong>{nxt:%m/%d}({WEEKDAY_KO[nxt.weekday()]})</strong>" if nxt else ""
        st.markdown(f"<div class='ast-card market-closed'><div class='ast-title'>📵 국내 증시 휴장</div><div class='ast-body'>대주주님, 오늘은 KRX 거래일이 아니므로 <strong>신규진입·수익실현·장중 매매 지수는 산출·표시하지 않습니다.</strong>{nxt_text}<br>대신 아래 시간대는 실제 주문 시간이 아니라 <strong>매매일지 복기·보유종목 기준 정리·관심종목 조사</strong> 같은 준비 작업용 상대값입니다.</div></div>",unsafe_allow_html=True)
        prep_rows=investment_prep_rows(timing_rows)
        prep_w=rolling_top_windows(prep_rows,"투자준비",3,2)
        prep_risk=rolling_top_windows(prep_rows,"투자주의",3,1)
        render_windows("🗂️ 휴장일 투자 준비·검토 시간대",prep_w,"투자준비")
        st.markdown("<div class='event-pill'><strong>휴장일에 해둘 일</strong> · 지난 거래일 매매일지 복기 → 보유종목 익절·손절 기준을 숫자로 적기 → 관심종목 후보를 줄이고 다음 거래일 주문 조건을 미리 정리해두세요.</div>",unsafe_allow_html=True)
        render_windows("⚠️ 과열·확증편향 주의 시간대",prep_risk,"투자주의","risk")
        st.caption("휴장일 준비 지수는 금전 판단·정보 정리·과열 억제를 묶은 점성술 상대값이며 매매 수익확률이나 가격 방향 예측이 아닙니다.")
    else:
        realize=rows_avg(market_rows,"수익실현"); entry=rows_avg(market_rows,"신규진입"); risk=rows_avg(market_rows,"투자주의")
        st.markdown(f"<div class='ast-card'><div class='ast-title'>📈 오늘의 투자 지수</div><div class='ast-body'>수익실현 <strong>{realize}</strong> · 신규진입 <strong>{entry}</strong> · 과열주의 <strong>{risk}</strong><br>점성술 내부 상대지수일 뿐 실제 가격 방향이나 수익확률은 아닙니다.</div></div>",unsafe_allow_html=True)
        realize_w=rolling_top_windows(market_rows,"수익실현",3,2); entry_w=rolling_top_windows(market_rows,"신규진입",3,2); risk_w=rolling_top_windows(market_rows,"투자주의",3,2)
        render_windows("💰 수익실현 상대 우호 시간대",realize_w,"수익실현")
        render_windows("🎯 신규진입 상대 우호 시간대",entry_w,"신규진입")
        render_windows("⚠️ 과열·뇌동매매 주의 시간대",risk_w,"투자주의","risk")
        st.warning("대주주님, 투자 지수보다 실제 가격·수급·거래량·손절 기준이 우선입니다.")

    with st.expander("🪐 계산 기준 보기"):
        noon=life_rows[len(life_rows)//2]
        moon_lon=noon["topics"] and get_tropical_ecliptic_lon("Moon",sf_time(noon["dt"].astimezone(UTC)))
        moon_sign,moon_deg,_=get_sign_and_degree(moon_lon)
        st.write(f"Ephemeris: **{EPHEMERIS_USED}**")
        st.write("Tropical · true ecliptic/equinox of date · Whole Sign 주 기준 + Placidus 보조")
        st.write(f"대표 시각 달: **{moon_sign} {moon_deg:.2f}°**")
        st.write("일일 대표점수는 기존과 동일하게 07:00~23:30 KST 다중 시각 평균이며, 시간대 탐색만 00:00~23:30까지 확장합니다.")

# ------------------------------------------------------------
# WEEKLY
# ------------------------------------------------------------
elif main_view=="주간":
    week_end=query_date+timedelta(days=6)
    st.markdown("### 📅 7일 주간 정밀 리포트")
    week_sessions=krx_sessions_in_range(query_date,week_end)
    st.markdown(f"<div class='period-range'><strong>{query_date:%Y.%m.%d}({WEEKDAY_KO[query_date.weekday()]}) ~ {week_end:%m.%d}({WEEKDAY_KO[week_end.weekday()]})</strong><br>선택일 기준 7일 전망 · KRX 거래일 <strong>{len(week_sessions)}일</strong></div>",unsafe_allow_html=True)
    with st.spinner("7일을 날짜별 다중 시각으로 계산하는 중..."):
        week_rows=cached_period_scores(query_date.isoformat(),7,natal_packed,houses_packed)
    _save_period_archive("weekly",query_date,week_end,week_rows)

    weekly_ai_options=list(AI_SUPPORTED_MODELS.keys())
    weekly_ai_default=_ai_model()
    weekly_ai_index=weekly_ai_options.index(weekly_ai_default) if weekly_ai_default in weekly_ai_options else 0
    weekly_ai_model=st.selectbox(
        "✨ 주간 AI 해설 모델",
        weekly_ai_options,
        index=weekly_ai_index,
        format_func=lambda m:AI_SUPPORTED_MODELS[m],
        key="weekly_ai_model_choice",
    )
    with st.spinner(f"✨ {AI_SUPPORTED_MODELS[weekly_ai_model]}가 7일 계산값을 종합하는 중..."):
        weekly_ai_result=get_ai_period_interpretation("weekly",query_date,week_end,week_rows,weekly_ai_model)
    if weekly_ai_result and weekly_ai_result.get("cache_waiting"):
        st.caption("⚡ 이 기기에 저장된 주간 AI 해설이 있는지 확인하는 중...")
    else:
        render_ai_period_overview(weekly_ai_result,f"{query_date:%Y.%m.%d} ~ {week_end:%Y.%m.%d}")

    st.markdown("#### 🧭 분야별 주간 흐름")
    for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
        st.markdown(f"<div class='ast-card'><div class='ast-title'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='ast-body'>{period_topic_text(week_rows,key)}</div></div>",unsafe_allow_html=True)

    st.markdown("#### 📈 주식·투자 · 거래일만 집계")
    if week_sessions:
        for key,label in [("수익실현","수익실현"),("신규진입","신규진입"),("투자주의","과열주의")]:
            st.markdown(f"<div class='event-pill'><strong>{label}</strong> · {period_topic_text(week_rows,key)}</div>",unsafe_allow_html=True)
    else:
        st.info("이 7일 범위에는 KRX 거래일이 없습니다.")

    st.markdown("#### 📆 하루씩 보면")
    for row in week_rows:
        trade=" · 📵 휴장" if not row["market_open"] else " · 📈 거래일"
        st.markdown(f"<div class='event-pill'><strong>{row['label']}</strong>{trade}<br>시험 {row['시험']} · 공부 {row['학업']} · 직장 {row['직장']} · 이직 {row['이직']} · 연애 {row['연애']} · 연락 {row['연락']} · 소식 {row['소식']} · 컨디션 {row['컨디션']}</div>",unsafe_allow_html=True)

    with st.expander("📊 주간 숫자표 보기 · 검산용"):
        st.dataframe(pd.DataFrame(week_rows)[["label","market_open","금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션","수익실현","신규진입","투자주의"]],use_container_width=True,hide_index=True)
        st.caption("투자 항목의 빈칸은 휴장일이며 평균에서 제외됩니다.")

# ------------------------------------------------------------
# MONTHLY
# ------------------------------------------------------------
elif main_view=="월간":
    st.markdown("### 🌕 월간 정밀 리포트")
    if "monthly_year" not in st.session_state: st.session_state["monthly_year"]=query_date.year
    if "monthly_month" not in st.session_state: st.session_state["monthly_month"]=query_date.month

    c1,c2=st.columns(2)
    with c1:
        month_year=st.selectbox("연도",list(range(query_date.year-3,query_date.year+5)),index=list(range(query_date.year-3,query_date.year+5)).index(st.session_state["monthly_year"]),key="monthly_year_select")
    with c2:
        month_month=st.selectbox("월",list(range(1,13)),index=st.session_state["monthly_month"]-1,key="monthly_month_select")
    st.session_state["monthly_year"],st.session_state["monthly_month"]=month_year,month_month
    month_first=date(month_year,month_month,1); month_days=calendar.monthrange(month_year,month_month)[1]; month_last=date(month_year,month_month,month_days)
    sessions=krx_sessions_in_range(month_first,month_last)
    st.markdown(f"<div class='period-range'><strong>{month_year}년 {month_month}월</strong> · {month_days}일 · KRX 거래일 <strong>{len(sessions)}일</strong></div>",unsafe_allow_html=True)

    calc=st.button("🌕 선택한 달 전체 흐름 계산",type="primary",use_container_width=True,key="monthly_calc")
    if st.session_state.pop("_push_monthly_autocalc",False):
        calc=True
        st.caption("🔔 월간 알림에서 들어와 선택된 달을 자동 계산해.")
    monthly_key=(month_year,month_month,natal_packed,houses_packed)
    if calc:
        with st.spinner("월간을 날짜별 다중 시각으로 계산하는 중..."):
            st.session_state["monthly_rows_v5"]=cached_period_scores(month_first.isoformat(),month_days,natal_packed,houses_packed)
            st.session_state["monthly_rows_key_v5"]=monthly_key
    month_rows=st.session_state.get("monthly_rows_v5") if st.session_state.get("monthly_rows_key_v5")==monthly_key else None

    if month_rows:
        _save_period_archive("monthly",month_first,month_last,month_rows)

        monthly_ai_options=list(AI_SUPPORTED_MODELS.keys())
        monthly_ai_default=_ai_model()
        monthly_ai_index=monthly_ai_options.index(monthly_ai_default) if monthly_ai_default in monthly_ai_options else 0
        monthly_ai_model=st.selectbox(
            "✨ 월간 AI 해설 모델",
            monthly_ai_options,
            index=monthly_ai_index,
            format_func=lambda m:AI_SUPPORTED_MODELS[m],
            key="monthly_ai_model_choice",
        )
        with st.spinner(f"✨ {AI_SUPPORTED_MODELS[monthly_ai_model]}가 한 달 계산값을 종합하는 중..."):
            monthly_ai_result=get_ai_period_interpretation("monthly",month_first,month_last,month_rows,monthly_ai_model)
        if monthly_ai_result and monthly_ai_result.get("cache_waiting"):
            st.caption("⚡ 이 기기에 저장된 월간 AI 해설이 있는지 확인하는 중...")
        else:
            render_ai_period_overview(monthly_ai_result,f"{month_year}년 {month_month}월")

        st.markdown("#### 🧭 분야별 월간 흐름")
        for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
            st.markdown(f"<div class='ast-card'><div class='ast-title'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='ast-body'>{period_topic_text(month_rows,key)}</div></div>",unsafe_allow_html=True)
        st.markdown("#### 📈 월간 주식·투자 · 거래일만 집계")
        for key,label in [("수익실현","수익실현"),("신규진입","신규진입"),("투자주의","과열주의")]:
            st.markdown(f"<div class='event-pill'><strong>{label}</strong> · {period_topic_text(month_rows,key)}</div>",unsafe_allow_html=True)

        st.markdown("#### 🏆 분야별 TOP 날짜")
        top_topic=st.selectbox("분야",["시험","학업","직장","이직","연애","연락","재회","소식","금전","컨디션","수익실현","신규진입"],key="monthly_top_topic")
        tops=top_period_days(month_rows,top_topic,5)
        if tops:
            for i,row in enumerate(tops,1): st.write(f"{i}. **{row['label']}** · {row[top_topic]}")
        else: st.info("해당 분야의 계산 가능한 날짜가 없습니다.")

        with st.expander("📊 월간 숫자표 보기 · 검산용"):
            st.dataframe(pd.DataFrame(month_rows),use_container_width=True,hide_index=True,height=430)
            st.caption("주식 관련 빈칸은 KRX 휴장일로, 월간 평균에서 제외됩니다.")
    else:
        st.info("연도와 월을 고른 뒤 ‘선택한 달 전체 흐름 계산’을 눌러줘.")


# ------------------------------------------------------------
# ANNUAL
# ------------------------------------------------------------
elif main_view=="연간":
    st.markdown("### 🌌 연간 정밀운세")
    annual_years=list(range(query_date.year-2,query_date.year+5))
    default_year=query_date.year+1 if query_date.month>=8 and query_date.year+1 in annual_years else query_date.year
    annual_year=st.selectbox("연도",annual_years,index=annual_years.index(default_year),key="annual_year_select")
    st.caption("첫 생성은 12개월 전체를 날짜별 다중시각으로 계산해서 시간이 조금 걸릴 수 있어. 한 번 저장되면 다음부터는 천체 재계산과 Gemini 재호출 없이 바로 열려.")

    raw_saved=_read_annual_year_entry(annual_year)
    if raw_saved is None:
        st.caption("🌌 이 기기에 저장된 연간운세가 있는지 확인하는 중...")
    else:
        saved_entry=None
        if str(raw_saved)!=REMEMBER_EMPTY_SENTINEL:
            try:
                parsed=json.loads(str(raw_saved))
                if isinstance(parsed,dict) and isinstance(parsed.get("result"),dict) and parsed["result"].get("ok"):
                    saved_entry=parsed
            except Exception:
                saved_entry=None

        force_key=f"_annual_force_regen_{annual_year}"
        if saved_entry and not st.session_state.get(force_key):
            saved_result=dict(saved_entry.get("result",{})); saved_result["cache_source"]="archive"
            render_ai_annual_overview(saved_result,saved_entry.get("payload",{}),archive=True)
            if st.button("♻️ 이 연도 운세 새로 계산",use_container_width=True,key=f"annual_regen_{annual_year}"):
                st.session_state[force_key]=True
                st.rerun()
        else:
            annual_ai_options=list(AI_SUPPORTED_MODELS.keys())
            annual_ai_default=_ai_model()
            annual_ai_index=annual_ai_options.index(annual_ai_default) if annual_ai_default in annual_ai_options else 0
            annual_ai_model=st.selectbox(
                "✨ 연간 AI 해설 모델",
                annual_ai_options,
                index=annual_ai_index,
                format_func=lambda m:AI_SUPPORTED_MODELS[m],
                key="annual_ai_model_choice",
            )
            make_annual=st.button("🌌 선택한 연도 정밀운세 생성",type="primary",use_container_width=True,key="annual_generate")
            if make_annual:
                with st.spinner("🌌 12개월 전체 흐름 + Solar Return + 장기 트랜짓을 계산하는 중..."):
                    annual_payload=cached_annual_payload(annual_year,natal_packed,houses_packed)
                with st.spinner(f"✨ {AI_SUPPORTED_MODELS[annual_ai_model]}가 한 해의 패턴을 종합 해석하는 중..."):
                    annual_ai_result=generate_ai_annual_interpretation(annual_payload,annual_ai_model)
                if annual_ai_result and annual_ai_result.get("ok"):
                    st.session_state.pop(force_key,None)
                    render_ai_annual_overview(annual_ai_result,annual_payload,archive=False)
                    st.success("🌌 연간운세 생성·저장 완료. 다음부터는 저장본을 바로 열어.")
                else:
                    render_ai_annual_overview(annual_ai_result,annual_payload,archive=False)

# ------------------------------------------------------------
# FORTUNE LAB · SAJU × WESTERN × THAI BASELINE
# ------------------------------------------------------------
elif main_view in ("통합운세","궁합운"):
    render_fortune_lab({
        "mode":"compatibility" if main_view=="궁합운" else "general",
        "birth_date":birth_date,
        "birth_time":birth_time,
        "birth_lon":lon,
        "birth_lat":lat,
        "birth_gender":birth_gender,
        "birthplace_options":KOREA_BIRTHPLACES,
        "query_date":query_date,
        "natal_packed":natal_packed,
        "houses_packed":houses_packed,
        "cached_period_scores":cached_period_scores,
        "period_topic_stats":_period_topic_stats,
        "ai_api_key":_ai_api_key,
        "ai_model":_ai_model,
        "ai_thinking_level":_ai_thinking_level,
        "ai_supported_models":AI_SUPPORTED_MODELS,
        "gemini_usage_summary":_gemini_usage_summary,
    })

# ------------------------------------------------------------
# ARCHIVE
# ------------------------------------------------------------
elif main_view=="저장함":
    _render_fortune_archive()

# ------------------------------------------------------------
# PRECISION / TRANSITS / RETURNS / VALIDATION
# ------------------------------------------------------------
elif main_view=="정밀분석":
    detail_view=st.radio("정밀분석 메뉴",["⏰ 시간대","🪐 트랜짓","🔄 리턴","⚙️ 검증"],horizontal=True,label_visibility="collapsed",key="detail_view")
    if detail_view=="⏰ 시간대":
        st.markdown("### ⏰ 선택 날짜 정밀 시간대")
        life_topic=st.selectbox("일상 분야",["시험","학업","직장","이직","연애","연락","재회","소식","금전","컨디션"],key="precision_topic")
        with st.spinner("30분 단위로 계산하는 중..."):
            precision_rows=cached_intraday_scan(query_date.isoformat(),"00:00:00","23:30:00",30,natal_packed,houses_packed)
        render_windows(f"{TOPIC_SPECS[life_topic]['icon']} {DISPLAY_LABELS[life_topic]} TOP 시간대",rolling_top_windows(precision_rows,life_topic,3,3),life_topic)
        render_windows(f"⚠️ {DISPLAY_LABELS[life_topic]} 상대적으로 덜 유리한 시간대",rolling_bottom_windows(precision_rows,life_topic,3,2),life_topic,"risk")
        if is_krx_session(query_date):
            mrows=cached_intraday_scan(query_date.isoformat(),"09:00:00","15:30:00",15,natal_packed,houses_packed)
            render_windows("📈 수익실현 TOP 시간대",rolling_top_windows(mrows,"수익실현",3,3),"수익실현")
        else: st.info("선택 날짜는 KRX 휴장일이라 장중 투자 시간대를 계산하지 않습니다.")

    elif detail_view=="🪐 트랜짓":
        st.markdown("### 🪐 트랜짓 → 네이탈")
        snapshots,records=build_transit_records(query_dt_utc,natal_lons,natal_houses)
        table=[]
        for r in records:
            table.append({"레이어":r["layer"],"트랜짓":PLANET_KO.get(r["transit"],r["transit"]),"네이탈":PLANET_KO.get(r["target"],r["target"]),"애스펙트":r["name"],"오브":round(r["orb"],2),"상태":r["motion"],"운동":r["direction"],"Whole":r["whole_house"],"Placidus":r["placidus_house"]})
        st.dataframe(pd.DataFrame(table),use_container_width=True,hide_index=True)

    elif detail_view=="🔄 리턴":
        st.markdown("### 🔄 정밀 Return Solver")
        body=st.selectbox("리턴 천체",["Moon","Sun","Mercury","Venus","Mars"],key="return_body")
        if st.button("정밀 리턴 계산",key="return_calc"):
            with st.spinner("회귀점 탐색 중..."):
                st.session_state["return_result_v5"]=(body,find_returns_near(body,natal_lons[body],query_dt_utc))
        stored=st.session_state.get("return_result_v5")
        if stored and stored[0]==body:
            result=stored[1]; prev=result["previous"].astimezone(KST) if result["previous"] else None; nxt=result["next"].astimezone(KST) if result["next"] else None
            st.write("직전:",prev.strftime("%Y-%m-%d %H:%M:%S KST") if prev else "없음")
            st.write("다음:",nxt.strftime("%Y-%m-%d %H:%M:%S KST") if nxt else "없음")

    elif detail_view=="⚙️ 검증":
        st.markdown("### ⚙️ 엔진 검증")
        mc_sign,mc_deg,_=get_sign_and_degree(natal_houses["mc"]); vx_sign,vx_deg,_=get_sign_and_degree(natal_houses["vertex"]); pof_sign,pof_deg,_=get_sign_and_degree(pof_lon)
        st.write(f"ASC **{asc_sign} {asc_deg:.4f}°** · MC **{mc_sign} {mc_deg:.4f}°** · Vertex **{vx_sign} {vx_deg:.4f}°**")
        st.write(f"Sect: **{'주간 차트' if birth_is_day else '야간 차트'}** · Part of Fortune **{pof_sign} {pof_deg:.4f}°**")
        st.write("✅ 일일 대표값: 하루 다중시각 평균")
        st.write("✅ 주간/월간: 날짜별 다중시각 평균 → 기간 집계")
        st.write("✅ 연간: 12개월 전체 일별 다중시각 계산 → 월/분기 압축 + Solar Return 정확시각 + 월별 장기트랜짓 스냅샷")
        st.write("✅ Whole Sign 주 가중치 + Placidus 독립 보조 가중치")
        st.write("✅ Applying/Separating + 순행/역행/정지권 반영")
        st.write("✅ 분야별 가변 오브")
        st.write("✅ KRX 휴장일 투자 지수 = N/A, 평균 제외")
        st.write(f"✅ 2026-08-22 KRX 세션 여부: **{is_krx_session(date(2026,8,22))}** (정상값 False)")
        if KRX is None:
            st.warning("exchange_calendars를 불러오지 못해 평일/주말 fallback을 사용 중입니다. requirements.txt 설치 상태를 확인해 주세요.")
        else:
            st.success("XKRX 거래소 캘린더 연결 정상")
        if EPHEMERIS_FALLBACK_REASON: st.warning("DE440s 로드 실패로 DE421 fallback: "+EPHEMERIS_FALLBACK_REASON)
        st.caption("점수는 점성술 해석을 일관되게 만들기 위한 내부 지수이며 사실·사건·수익률의 확률값이 아닙니다.")
