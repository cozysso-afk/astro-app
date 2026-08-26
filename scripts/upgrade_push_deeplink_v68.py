from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")
changed = False

route_present = "PUSH_ROUTE_TO_VIEW={" in text or "PUSH_ROUTE_TO_VIEW =" in text
if not route_present:
    needle = '''now_kst=datetime.now(KST)
today_kst=now_kst.date()

st.markdown('<div class="top-nav">✦ ASTROLOGY · HOROSCOPE · PRIVATE ✦</div>',unsafe_allow_html=True)
'''
    replacement = '''now_kst=datetime.now(KST)
today_kst=now_kst.date()

# ============================================================
# PUSH DEEP-LINK ROUTING · V6.8
# ============================================================
# GitHub Pages 홈 화면 런처가 OneSignal 알림의 목적지를 query param으로 전달한다.
# 한 Streamlit 세션에서 같은 알림 파라미터를 매 rerun마다 다시 강제하지 않도록 signature를 기억한다.
PUSH_ROUTE_TO_VIEW={"daily":"🌙 일일","weekly":"📅 주간","monthly":"🌕 월간","annual":"🌌 연간"}


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

st.markdown('<div class="top-nav">✦ ASTROLOGY · HOROSCOPE · PRIVATE ✦</div>',unsafe_allow_html=True)
'''
    if needle not in text:
        raise SystemExit("profile routing insertion marker not found")
    text=text.replace(needle,replacement,1)
    changed=True
else:
    # Older v6.8 runs may have routed monthly without setting the auto-calc flag.
    monthly_route_needle='''                st.session_state["monthly_year_select"]=pushed_year
                st.session_state["monthly_month_select"]=pushed_month
'''
    monthly_route_replacement='''                st.session_state["monthly_year_select"]=pushed_year
                st.session_state["monthly_month_select"]=pushed_month
                st.session_state["_push_monthly_autocalc"]=True
'''
    if "st.session_state[\"_push_monthly_autocalc\"]=True" not in text:
        if monthly_route_needle not in text:
            raise SystemExit("monthly route upgrade marker not found")
        text=text.replace(monthly_route_needle,monthly_route_replacement,1)
        changed=True

main_needle='''main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")
'''
main_replacement='''main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")
if st.session_state.pop("_push_route_notice",None):
    st.caption("🔔 운세 알림에서 해당 리포트로 바로 이동했어.")
'''
if "운세 알림에서 해당 리포트로 바로 이동했어" not in text:
    if main_needle not in text:
        raise SystemExit("main view marker not found")
    text=text.replace(main_needle,main_replacement,1)
    changed=True

monthly_needle='''    calc=st.button("🌕 선택한 달 전체 흐름 계산",type="primary",use_container_width=True,key="monthly_calc")
    monthly_key=(month_year,month_month,natal_packed,houses_packed)
'''
monthly_replacement='''    calc=st.button("🌕 선택한 달 전체 흐름 계산",type="primary",use_container_width=True,key="monthly_calc")
    if st.session_state.pop("_push_monthly_autocalc",False):
        calc=True
        st.caption("🔔 월간 알림에서 들어와 선택된 달을 자동 계산해.")
    monthly_key=(month_year,month_month,natal_packed,houses_packed)
'''
if 'st.session_state.pop("_push_monthly_autocalc",False)' not in text:
    if monthly_needle not in text:
        raise SystemExit("monthly auto-calc marker not found")
    text=text.replace(monthly_needle,monthly_replacement,1)
    changed=True

if changed:
    APP.write_text(text,encoding="utf-8")
    print("Applied or completed push deep-link routing v6.8.1")
else:
    print("Push deep-link routing v6.8.1 already complete")
