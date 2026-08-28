from pathlib import Path
import re

APP = Path("app.py")
FORTUNE = Path("fortune_lab_v71.py")
app = APP.read_text(encoding="utf-8")
fortune = FORTUNE.read_text(encoding="utf-8")
changed = False

# ------------------------------------------------------------
# 1) Main navigation: replace the horizontally scrolling radio row
#    with two explicit 4-button groups (period reports / analysis tools).
# ------------------------------------------------------------
old_nav = 'main_view=st.radio("메뉴",["오늘","주간","월간","연간","포춘랩","궁합운","저장함","정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")'
new_nav = '''_main_views=["오늘","주간","월간","연간","포춘랩","궁합운","저장함","정밀분석"]
if st.session_state.get("main_view") not in _main_views:
    st.session_state["main_view"]="오늘"
main_view=st.session_state["main_view"]

st.markdown('<div class="astro-nav-label">기간 운세</div>',unsafe_allow_html=True)
_nav_period=st.columns(4,gap="small")
for _i,_label in enumerate(["오늘","주간","월간","연간"]):
    if _nav_period[_i].button(_label,key=f"main_nav_period_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):
        if main_view!=_label:
            st.session_state["main_view"]=_label
            st.rerun()

st.markdown('<div class="astro-nav-label astro-nav-tools">분석 도구</div>',unsafe_allow_html=True)
_nav_tools=st.columns(4,gap="small")
for _i,_label in enumerate(["포춘랩","궁합운","저장함","정밀분석"]):
    if _nav_tools[_i].button(_label,key=f"main_nav_tool_{_i}",use_container_width=True,type="primary" if main_view==_label else "secondary"):
        if main_view!=_label:
            st.session_state["main_view"]=_label
            st.rerun()'''
if old_nav in app:
    app = app.replace(old_nav, new_nav, 1)
    changed = True
elif 'main_nav_period_' not in app:
    raise SystemExit("main navigation marker not found")

# The dedicated compatibility page controls its own counterpart mode.
old_mode_ctx = '        "forced_mode":"💞 특정 상대" if main_view=="궁합운" else None,\n'
new_mode_ctx = '        "mode":"compatibility" if main_view=="궁합운" else "general",\n'
if old_mode_ctx in app:
    app = app.replace(old_mode_ctx, new_mode_ctx, 1)
    changed = True
elif new_mode_ctx not in app:
    raise SystemExit("Fortune Lab mode ctx marker not found")

# Add v7.3 navigation + monthly timeline styles after the v7.2 style layer.
if "ASTRO_DESIGN_V73_CSS" not in app:
    marker = 'st.markdown(ASTRO_DESIGN_V72_CSS, unsafe_allow_html=True)\n'
    if marker not in app:
        raise SystemExit("v7.2 CSS render marker not found")
    css = r'''

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
'''
    app = app.replace(marker, marker + css, 1)
    changed = True

# ------------------------------------------------------------
# 2) Fortune Lab data vocabulary: dedicated compatibility topics.
# ------------------------------------------------------------
if 'import html\n' not in fortune:
    fortune = fortune.replace('import hashlib\n', 'import hashlib\nimport html\n', 1)
    changed = True

fortune = fortune.replace('FORTUNE_LAB_VERSION = "v0.1.5"', 'FORTUNE_LAB_VERSION = "v0.1.6"')

old_specific_topic = '    "💞 특정 상대와 재회": {"western":"재회", "focus":"입력한 특정 상대와의 관계 재활성 가능 구간, 접점 환경, 반복 패턴. 상대의 행동·감정을 확정하지 않음"},\n'
new_specific_topics = '''    "궁합 전체": {"western":"연애", "focus":"두 사람의 기본 관계 패턴, 잘 맞는 축과 마찰 축, 관계를 지속할 때의 장단점. 계산되지 않은 상대 심리·행동은 확정하지 않음"},
    "관계 흐름": {"western":"연애", "focus":"입력한 상대와 관계가 가까워지거나 멀어지는 환경, 상호작용의 리듬, 반복 패턴"},
    "재회 흐름": {"western":"재회", "focus":"입력한 상대와 과거 관계가 다시 활성화될 수 있는 환경, 접점과 재검토 흐름. 실제 연락·재회를 확정하지 않음"},
'''
if old_specific_topic in fortune:
    fortune = fortune.replace(old_specific_topic, new_specific_topics, 1)
    changed = True
elif '"궁합 전체"' not in fortune:
    raise SystemExit("specific counterpart topic marker not found")

if 'COMPATIBILITY_TOPICS = {' not in fortune:
    marker = '}\n\n_STEM_INFO = {'
    if marker not in fortune:
        raise SystemExit("topic dict end marker not found")
    fortune = fortune.replace(marker, '}\n\nCOMPATIBILITY_TOPICS = {"궁합 전체", "관계 흐름", "재회 흐름"}\n\n_STEM_INFO = {', 1)
    changed = True

fortune = fortune.replace('if topic=="💞 특정 상대와 재회" and isinstance(counterpart,dict):', 'if topic in COMPATIBILITY_TOPICS and isinstance(counterpart,dict):')

# More accurate compatibility scope wording.
fortune = fortune.replace(
    '"scope_note":"현재 Western 월별 값은 사용자의 재회 활성 환경이다. 상대의 행동 시기나 연락일로 바꾸지 않는다.",',
    '"scope_note":"현재 두 사람의 정적 궁합 근거는 사주 원국 교차관계까지 계산한다. Western 월별 값은 사용자의 관계 환경이며, 상대의 Western 시너스트리·트랜짓은 아직 미계산이므로 상대 행동 시기로 바꾸지 않는다.",'
)
fortune = fortune.replace(
    '"counterpart":"natal Saju context only in v0.1.2; no partner-specific Western timing vote",',
    '"counterpart":"two-person Saju natal cross-context available; partner Western synastry/transit is not calculated yet",'
)

# ------------------------------------------------------------
# 3) Monthly result: dataframe -> visual timeline cards.
# ------------------------------------------------------------
month_start = fortune.find('def _render_month_table(bundle):')
month_end = fortune.find('\n\ndef _select_birthplace_from_options', month_start)
if month_start >= 0 and month_end > month_start:
    new_month_fn = r'''def _fmt_month_day_items(items):
    out=[]
    for item in (items or [])[:2]:
        if not isinstance(item,dict):
            continue
        raw=str(item.get("date") or item.get("label") or "").strip()
        shown=raw
        try:
            d=date.fromisoformat(raw[:10])
            shown=f"{d.month}.{d.day}"
        except Exception:
            shown=raw[:20] if raw else "-"
        score=item.get("score")
        if score is not None:
            try: shown+=f" · {float(score):.1f}"
            except Exception: pass
        out.append(shown)
    return " / ".join(out) if out else "자료 없음"


def _render_month_timeline(bundle):
    western={x.get("calendar_month"):x for x in bundle.get("western",{}).get("months",[]) if isinstance(x,dict)}
    saju={x.get("calendar_month"):x for x in bundle.get("saju",{}).get("monthly",[]) if isinstance(x,dict)}
    months=sorted(set(western)|set(saju))
    if not months:
        st.info("표시할 월별 계산자료가 없어.")
        return

    cards=[]
    for month in months:
        w=western.get(month,{})
        s=saju.get(month,{})
        try:
            y,m=[int(x) for x in month.split("-")[:2]]
            month_name=f"{y}년 {m}월"
        except Exception:
            month_name=str(month)
        period=f"{w.get('start') or s.get('segment_start') or ''} ~ {w.get('end') or s.get('segment_end') or ''}"
        avg=w.get("average")
        try: score_text=f"{float(avg):.1f}" if avg is not None else "—"
        except Exception: score_text=html.escape(str(avg)) if avg is not None else "—"
        band=html.escape(str(w.get("band") or "상대 흐름"))
        ganzhi=html.escape(str(s.get("ganzhi") or "—"))
        ten=html.escape(str(s.get("stem_ten_god") or "—"))
        links=html.escape(" · ".join(s.get("branch_links") or []) or "특기할 육합·육충 없음")
        best=html.escape(_fmt_month_day_items(w.get("best_days")))
        caution=html.escape(_fmt_month_day_items(w.get("caution_days")))
        cards.append(f"""<div class="fortune-month-card">
  <div class="fortune-month-head">
    <div><div class="fortune-month-name">{html.escape(month_name)}</div><div class="fortune-month-period">{html.escape(period)}</div></div>
    <div class="fortune-month-band">{band}</div>
  </div>
  <div class="fortune-month-score"><span>서양점성술 · 같은 주제 안의 상대지수</span><strong>{score_text}</strong></div>
  <div class="fortune-month-facts">
    <div class="fortune-month-fact"><span>사주 월운</span><b>{ganzhi}</b></div>
    <div class="fortune-month-fact"><span>월간 십성</span><b>{ten}</b></div>
    <div class="fortune-month-fact"><span>원국 교차</span><b>{links}</b></div>
  </div>
  <div class="fortune-month-days">
    <div class="fortune-month-day"><small>상대적으로 강한 날짜</small><span>{best}</span></div>
    <div class="fortune-month-day caution"><small>상대적으로 주의할 날짜</small><span>{caution}</span></div>
  </div>
</div>""")
    st.markdown('<div class="fortune-month-stack">'+''.join(cards)+'</div>',unsafe_allow_html=True)
    st.caption("월별 숫자는 사건 발생 확률이 아니라 같은 주제 안에서 시기를 비교하는 상대지수야.")
'''
    fortune = fortune[:month_start] + new_month_fn + fortune[month_end:]
    changed = True
elif 'def _render_month_timeline(bundle):' not in fortune:
    raise SystemExit("monthly renderer marker not found")

fortune = fortune.replace('_render_month_table(bundle)', '_render_month_timeline(bundle)')

# ------------------------------------------------------------
# 4) Fortune Lab IA: general Fortune Lab and dedicated 궁합운 are separate.
# ------------------------------------------------------------
render_start = fortune.find('def render_fortune_lab(ctx):')
default_marker = '    default_start=date(ctx["query_date"].year,ctx["query_date"].month,1)'
default_pos = fortune.find(default_marker, render_start)
if render_start >= 0 and default_pos > render_start:
    new_render_head = r'''def render_fortune_lab(ctx):
    mode=str(ctx.get("mode") or "general").strip().lower()
    is_compat=(mode=="compatibility")

    st.markdown('<div class="fortune-kicker">FORTUNE LAB</div>',unsafe_allow_html=True)
    if is_compat:
        st.markdown('<div class="fortune-title">두 사람의 궁합과 관계 흐름</div>',unsafe_allow_html=True)
        st.markdown('<div class="fortune-lead">궁합의 기본 패턴과 선택한 기간의 관계 흐름을 분리해서 봐. 상대 정보는 아는 범위까지만 사용해.</div>',unsafe_allow_html=True)
    else:
        st.markdown('<div class="fortune-title">운의 흐름을 겹쳐보기</div>',unsafe_allow_html=True)
        st.markdown('<div class="fortune-lead">서양점성술의 시간축과 사주 대운·세운·월운, 태국 출생층을 한 화면에서 비교해.</div>',unsafe_allow_html=True)
    st.caption(f"운영 버전 · {FORTUNE_LAB_VERSION}")

    gender=str(ctx.get("birth_gender") or "여성")
    counterpart=None

    if is_compat:
        topic=st.selectbox(
            "궁합운에서 볼 것",
            ["궁합 전체","관계 흐름","재회 흐름"],
            key="fortune_lab_compat_topic",
            help="궁합 전체는 기본 관계 패턴을 먼저 보고, 관계/재회 흐름은 선택 기간의 활성도를 더 강조해.",
        )
        st.markdown('<div class="fortune-scope-card"><strong>현재 계산 범위</strong><br>사주: 두 사람 원국의 기본 교차관계까지 실제 계산 · 서양점성술: 내 기간 흐름 계산 · 상대 Western 시너스트리/트랜짓: 아직 미계산. 그래서 상대의 연락일이나 행동을 확정하지 않아.</div>',unsafe_allow_html=True)
        st.markdown("#### 상대 프로필")
        st.caption("출생시간은 몰라도 돼. 시간이 없으면 상대 시주·ASC(상승점)·하우스는 만들지 않아.")
        cp_name=st.text_input("상대 호칭 · 선택",value="",placeholder="예: A",key="fortune_lab_cp_name")
        cp_birth_date=st.date_input("상대 출생일",value=date(1990,1,1),key="fortune_lab_cp_birth_date")
        cp_time_known=st.checkbox("상대 출생시간을 알고 있음",value=False,key="fortune_lab_cp_time_known")
        cp_birth_time=st.time_input("상대 출생시간",value=dt_time(12,0),step=60,key="fortune_lab_cp_birth_time",disabled=not cp_time_known)
        cp_place,cp_lon=_select_birthplace_from_options(ctx.get("birthplace_options") or {},"fortune_lab_cp")
        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점, 현재 단절 여부 정도",key="fortune_lab_cp_context")
        counterpart={"name":cp_name.strip(),"birth_date":cp_birth_date,"time_known":cp_time_known,"birth_time":cp_birth_time if cp_time_known else None,"birth_place":cp_place.strip(),"longitude":cp_lon,"context":cp_context.strip()}
    else:
        general_topics=[k for k in FORTUNE_LAB_TOPICS.keys() if k not in COMPATIBILITY_TOPICS]
        topic=st.selectbox("분석 주제",general_topics,key="fortune_lab_topic")

    st.caption(f"사주 대운 계산 성별 · {gender} · 나의 출생 프로필 기준")
'''
    fortune = fortune[:render_start] + new_render_head + fortune[default_pos:]
    changed = True
else:
    if '궁합운에서 볼 것' not in fortune:
        raise SystemExit("render_fortune_lab head markers not found")

# Rename old counterpart wording in the results section.
fortune = fortune.replace('with st.expander("💞 특정 상대 계산 범위",expanded=True):', 'with st.expander("두 사람 궁합 계산 범위",expanded=True):')
fortune = fortune.replace('st.caption("현재는 상대 원국 일부 + 내 사주와의 육합·육충 보조맥락까지만 사용해. 상대 Western 시너스트리·트랜짓은 다음 단계라 특정 연락일을 만들지 않아.")', 'st.caption("현재 정적 궁합은 두 사람 사주 원국의 육합·육충 교차관계까지 계산해. 상대 Western 시너스트리·트랜짓은 아직 미계산이라 상대의 특정 연락일·행동 시기로 바꾸지 않아.")')
fortune = fortune.replace('st.markdown("#### 📆 월별 계산 요약")', 'st.markdown("#### 월별 흐름")')

# Add compatibility-specific instructions to the deep prompt without inventing unavailable calculations.
old_prompt_data = 'def _deep_prompt(bundle):\n    data=json.dumps(_jsonable(bundle),ensure_ascii=False,indent=2)\n    return f"""'
if old_prompt_data in fortune:
    new_prompt_data = '''def _deep_prompt(bundle):
    data=json.dumps(_jsonable(bundle),ensure_ascii=False,indent=2)
    compatibility_extra=""
    if isinstance(bundle.get("counterpart"),dict):
        compatibility_extra="""\n[궁합운 추가 규칙]\n- 먼저 두 사람의 정적 관계 패턴(잘 맞는 축/마찰 축/반복되는 관계 습관)을 CALCULATED_DATA 범위 안에서 분리해 요약한다.\n- 그 다음 선택 기간의 관계 흐름을 별도로 본다. 정적 궁합과 시기운을 섞어 같은 것으로 말하지 않는다.\n- partner Western synastry/transit가 미계산이면 서양점성술로 두 사람의 궁합을 계산했다고 말하지 않는다.\n"""
    return f"""'''
    fortune = fortune.replace(old_prompt_data, new_prompt_data, 1)
    # Insert the optional block immediately before the analysis topic.
    fortune = fortune.replace('\n[분석 주제]\n{bundle[\'topic\']}', '\n{compatibility_extra}\n[분석 주제]\n{bundle[\'topic\']}', 1)
    changed = True

if not changed:
    print("No changes needed; v0.1.6 refinement already applied.")
else:
    APP.write_text(app,encoding="utf-8")
    FORTUNE.write_text(fortune,encoding="utf-8")
    print("Applied Fortune Lab v0.1.6 UI refinement.")
