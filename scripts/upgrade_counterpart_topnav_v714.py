from pathlib import Path

APP=Path('app.py')
LAB=Path('fortune_lab_v71.py')
app=APP.read_text(encoding='utf-8')
lab=LAB.read_text(encoding='utf-8')


def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old,new,1)

# Fortune Lab version + forced route support.
lab=replace_once(lab,'FORTUNE_LAB_VERSION = "v0.1.3"','FORTUNE_LAB_VERSION = "v0.1.4"','lab version')
old_mode='''    analysis_mode=st.radio(\n        "분석 방식",\n        ["🌙 일반 운세", "💞 특정 상대"],\n        horizontal=True,\n        key="fortune_lab_analysis_mode",\n    )\n    if analysis_mode=="💞 특정 상대":\n        topic="💞 특정 상대와 재회"\n        st.info("특정 상대 정보를 아래에 입력하면, 아는 데이터만 사용해서 재회 흐름을 계산해.")\n    else:\n        general_topics=[k for k in FORTUNE_LAB_TOPICS.keys() if k!="💞 특정 상대와 재회"]\n        topic=st.selectbox("분석 주제",general_topics,key="fortune_lab_topic")\n'''
new_mode='''    forced_mode=str(ctx.get("forced_mode") or "").strip()\n    if forced_mode=="💞 특정 상대":\n        analysis_mode="💞 특정 상대"\n        st.success("💞 특정 상대 재회 분석 · 상대 정보를 바로 입력해.")\n    else:\n        analysis_mode=st.radio(\n            "분석 방식",\n            ["🌙 일반 운세", "💞 특정 상대"],\n            horizontal=True,\n            key="fortune_lab_analysis_mode",\n        )\n    if analysis_mode=="💞 특정 상대":\n        topic="💞 특정 상대와 재회"\n        st.info("특정 상대 정보를 아래에 입력하면, 아는 데이터만 사용해서 재회 흐름을 계산해.")\n    else:\n        general_topics=[k for k in FORTUNE_LAB_TOPICS.keys() if k!="💞 특정 상대와 재회"]\n        topic=st.selectbox("분석 주제",general_topics,key="fortune_lab_topic")\n'''
lab=replace_once(lab,old_mode,new_mode,'forced mode block')

# Make counterpart a first-class top navigation item, not a hidden dropdown/radio choice.
old_nav='main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","🧭 포춘랩","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")'
new_nav='main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","🧭 포춘랩","💞 상대재회","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")'
app=replace_once(app,old_nav,new_nav,'main nav')

old_route='elif main_view=="🧭 포춘랩":\n    render_fortune_lab({'
new_route='elif main_view in ("🧭 포춘랩","💞 상대재회"):\n    render_fortune_lab({'
app=replace_once(app,old_route,new_route,'fortune route')

# Force counterpart mode when the dedicated top-level tab is selected.
anchor='''        "birth_date":birth_date,\n        "birth_time":birth_time,\n'''
replacement='''        "forced_mode":"💞 특정 상대" if main_view=="💞 상대재회" else None,\n        "birth_date":birth_date,\n        "birth_time":birth_time,\n'''
# The anchor can occur elsewhere in app.py. Limit the patch to the Fortune Lab route region.
route_start=app.index('elif main_view in ("🧭 포춘랩","💞 상대재회"):')
route_end=app.index('\n# ------------------------------------------------------------\n# ARCHIVE',route_start)
route=app[route_start:route_end]
if route.count(anchor)!=1:
    raise SystemExit(f'fortune ctx anchor: expected 1 match, got {route.count(anchor)}')
route=route.replace(anchor,replacement,1)
app=app[:route_start]+route+app[route_end:]

LAB.write_text(lab,encoding='utf-8')
APP.write_text(app,encoding='utf-8')
print('Applied counterpart top-level route v0.1.4')
