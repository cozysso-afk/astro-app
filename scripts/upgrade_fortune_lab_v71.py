from pathlib import Path

APP=Path("app.py")
REQ=Path("requirements.txt")
text=APP.read_text(encoding="utf-8")

MARKER='from fortune_lab_v71 import render_fortune_lab'
if MARKER in text:
    print("Fortune Lab v7.1 already applied to app.py")
else:
    def replace_once(old,new,label):
        global text
        count=text.count(old)
        if count!=1:
            raise SystemExit(f"[{label}] expected exactly 1 match, got {count}")
        text=text.replace(old,new,1)

    replace_once(
        'from skyfield.framelib import ecliptic_frame\n',
        'from skyfield.framelib import ecliptic_frame\nfrom fortune_lab_v71 import render_fortune_lab\n',
        'fortune lab import',
    )

    replace_once(
        '    user_name=st.text_input("성함 또는 호칭",value=PROFILE_NAME_DEFAULT,key="profile_name")\n    birth_date=st.date_input("출생일",PROFILE_BIRTH_DATE_DEFAULT,key="profile_birth_date")\n',
        '    user_name=st.text_input("성함 또는 호칭",value=PROFILE_NAME_DEFAULT,key="profile_name")\n    birth_gender=st.selectbox("성별 · 사주 대운 계산용",["여성","남성"],index=0,key="profile_birth_gender")\n    birth_date=st.date_input("출생일",PROFILE_BIRTH_DATE_DEFAULT,key="profile_birth_date")\n',
        'profile gender input',
    )

    replace_once(
        'main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")\n',
        'main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","🧭 포춘랩","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")\n',
        'main menu',
    )

    archive_anchor='''# ------------------------------------------------------------\n# ARCHIVE\n# ------------------------------------------------------------\nelif main_view=="📚 저장함":\n    _render_fortune_archive()\n'''
    fortune_branch='''# ------------------------------------------------------------\n# FORTUNE LAB · SAJU × WESTERN × THAI BASELINE\n# ------------------------------------------------------------\nelif main_view=="🧭 포춘랩":\n    render_fortune_lab({\n        "birth_date":birth_date,\n        "birth_time":birth_time,\n        "birth_lon":lon,\n        "birth_gender":birth_gender,\n        "query_date":query_date,\n        "natal_packed":natal_packed,\n        "houses_packed":houses_packed,\n        "cached_period_scores":cached_period_scores,\n        "period_topic_stats":_period_topic_stats,\n        "ai_api_key":_ai_api_key,\n        "ai_model":_ai_model,\n        "ai_thinking_level":_ai_thinking_level,\n        "ai_supported_models":AI_SUPPORTED_MODELS,\n        "gemini_usage_summary":_gemini_usage_summary,\n    })\n\n# ------------------------------------------------------------\n# ARCHIVE\n# ------------------------------------------------------------\nelif main_view=="📚 저장함":\n    _render_fortune_archive()\n'''
    replace_once(archive_anchor,fortune_branch,'fortune lab branch')

    APP.write_text(text,encoding="utf-8")
    print("Applied Fortune Lab v7.1 to app.py")

req=REQ.read_text(encoding="utf-8") if REQ.exists() else ""
line="lunar_python==1.4.8"
if line not in req.splitlines():
    req=req.rstrip()+"\n"+line+"\n"
    REQ.write_text(req,encoding="utf-8")
    print("Added lunar_python 1.4.8 to requirements.txt")
else:
    print("lunar_python requirement already present")
