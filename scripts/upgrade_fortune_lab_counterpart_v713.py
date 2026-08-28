from pathlib import Path

P=Path('fortune_lab_v71.py')
s=P.read_text(encoding='utf-8')

old='''    topic=st.selectbox("분석 주제",list(FORTUNE_LAB_TOPICS.keys()),key="fortune_lab_topic")
    gender=st.selectbox("사주 대운용 성별",["여성","남성"],index=0 if str(ctx.get("birth_gender","여성")).startswith("여") else 1,key="fortune_lab_gender")

    counterpart=None
    if topic=="💞 특정 상대와 재회":
'''
new='''    analysis_mode=st.radio(
        "분석 방식",
        ["🌙 일반 운세", "💞 특정 상대"],
        horizontal=True,
        key="fortune_lab_analysis_mode",
    )
    if analysis_mode=="💞 특정 상대":
        topic="💞 특정 상대와 재회"
        st.info("특정 상대 정보를 아래에 입력하면, 아는 데이터만 사용해서 재회 흐름을 계산해.")
    else:
        general_topics=[k for k in FORTUNE_LAB_TOPICS.keys() if k!="💞 특정 상대와 재회"]
        topic=st.selectbox("분석 주제",general_topics,key="fortune_lab_topic")

    gender=st.selectbox("사주 대운용 성별",["여성","남성"],index=0 if str(ctx.get("birth_gender","여성")).startswith("여") else 1,key="fortune_lab_gender")

    counterpart=None
    if analysis_mode=="💞 특정 상대":
'''
if s.count(old)!=1:
    raise SystemExit(f'expected exactly one UI block, got {s.count(old)}')
s=s.replace(old,new,1)
s=s.replace('FORTUNE_LAB_VERSION = "v0.1.2"','FORTUNE_LAB_VERSION = "v0.1.3"',1)
P.write_text(s,encoding='utf-8')
print('Applied visible specific-counterpart mode v0.1.3')
