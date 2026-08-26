from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

if 'RELATIONSHIP_OBSERVATION_VERSION = "v1.1"' in text:
    print("relationship observation v6.10.1 already applied")
    raise SystemExit(0)

old = 'RELATIONSHIP_SIGNAL_VERSION = "v1.0"\nRELATIONSHIP_OUTCOME_KIND = "outcome"'
new = 'RELATIONSHIP_SIGNAL_VERSION = "v1.0"\nRELATIONSHIP_OBSERVATION_VERSION = "v1.1"\nRELATIONSHIP_OUTCOME_KIND = "outcome"'
if old not in text:
    raise SystemExit("relationship version marker not found")
text = text.replace(old, new, 1)

old = '''    past_yes=[x for x in rows if bool(x.get("past_connection")) and x.get("event")!="none"]
    past_no=[x for x in rows if not bool(x.get("past_connection"))]
    return {
        "n":len(rows),
'''
new = '''    past_yes=[x for x in rows if bool(x.get("past_connection")) and x.get("event")!="none"]
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
'''
if old not in text:
    raise SystemExit("calibration summary marker not found")
text = text.replace(old, new, 1)

old = '''    label_by_code={v:k for k,v in code_by_label.items()}
    default_label=label_by_code.get(existing.get("event"),"기록 안 함")

    with st.expander("🧪 실제 결과 기록 · 개인보정",expanded=False):
'''
new = '''    label_by_code={v:k for k,v in code_by_label.items()}
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
'''
if old not in text:
    raise SystemExit("outcome options marker not found")
text = text.replace(old, new, 1)

old = '''        with st.form(f"relationship_outcome_form_{query_date.isoformat()}"):
            event_label=st.selectbox("이 날 실제 연락 결과",event_options,index=event_options.index(default_label))
            past_connection=st.checkbox("과거 인연 관련 연락",value=bool(existing.get("past_connection",False)))
            note=st.text_input("짧은 메모(선택)",value=str(existing.get("note") or "")[:200],placeholder="예: 저녁에 먼저 전화 옴")
            save=st.form_submit_button("💾 실제 결과 저장",use_container_width=True)
'''
new = '''        with st.form(f"relationship_outcome_form_{query_date.isoformat()}"):
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
'''
if old not in text:
    raise SystemExit("outcome form marker not found")
text = text.replace(old, new, 1)

old = '''                    "event":event,
                    "past_connection":bool(past_connection and event!="none"),
                    "note":note.strip()[:200],
                    "recorded_at":int(time.time()),
'''
new = '''                    "event":event,
                    "past_connection":bool(past_connection and event!="none"),
                    "event_time_bucket":time_code.get(event_time_label,"") if event!="none" else "",
                    "channel":channel_code.get(channel_label_value,"") if event!="none" else "",
                    "note":note.strip()[:200],
                    "recorded_at":int(time.time()),
'''
if old not in text:
    raise SystemExit("outcome payload marker not found")
text = text.replace(old, new, 1)

old = '''            n=summary["n"]
            st.markdown(f"**개인보정 기록 · {n}일**")
            if n < RELATIONSHIP_OUTCOME_MIN_COMPARE:
'''
new = '''            n=summary["n"]
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
'''
if old not in text:
    raise SystemExit("calibration UI marker not found")
text = text.replace(old, new, 1)

APP.write_text(text, encoding="utf-8")
print("relationship observation v6.10.1 applied")
