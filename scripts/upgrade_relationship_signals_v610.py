from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

if 'RELATIONSHIP_SIGNAL_VERSION = "v1.0"' in text:
    print("relationship signal v6.10 already applied")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected exactly 1 match, got {count}")
    text = text.replace(old, new, 1)


# Keep the original core topic for historical comparability, but make the labels explicit.
text = text.replace('"연락":"연락운"', '"연락":"연락·교류 활성도"')
text = text.replace('"소식":"소식·문서운"', '"소식":"일반 소식·문서운"')

# Weekly/monthly rows should also carry the experimental directional helpers.
old_period_keys = '    keys=["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]\n'
new_period_keys = '    keys=["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션","수신신호","발신적합","과거인연접점"]\n'
replace_once(old_period_keys, new_period_keys, "period directional keys")

# Outcome records belong in the portable archive backup too.
text = text.replace(
    'allowed_js=json.dumps(["daily","period_calc","period_ai","annual"])',
    'allowed_js=json.dumps(["daily","period_calc","period_ai","annual","outcome"])',
)
text = text.replace(
    'allowed={"daily":"daily:","period_calc":"period_calc:","period_ai":"period_ai:","annual":"annual:"}',
    'allowed={"daily":"daily:","period_calc":"period_calc:","period_ai":"period_ai:","annual":"annual:","outcome":"outcome:"}',
)

marker = '''# ============================================================
# PUSH DEEP-LINK ROUTING · V6.8
# ============================================================
'''
if marker not in text:
    raise SystemExit("push routing marker not found")

block = r'''
# ============================================================
# RELATIONSHIP DIRECTION SIGNALS + PERSONAL CALIBRATION · V6.10
# ============================================================
# 기존 '연락' 점수는 수신/발신을 합친 커뮤니케이션 활성도다.
# 아래 세 값은 동일 계산 근거를 방향성 관점으로 재조합한 실험 보조지표이며
# 사건 확률이 아니다. 실제 결과 기록을 쌓아 개인별 유효성을 나중에 검증한다.
RELATIONSHIP_SIGNAL_VERSION = "v1.0"
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
    return {
        "n":len(rows),
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

    with st.expander("🧪 실제 결과 기록 · 개인보정",expanded=False):
        st.caption("연락이 있었던 날뿐 아니라 '연락 없음'인 날도 같이 기록해야 비교가 덜 치우쳐. 기록은 이 기기 IndexedDB에만 저장되고 저장함 JSON 백업에도 포함돼.")
        with st.form(f"relationship_outcome_form_{query_date.isoformat()}"):
            event_label=st.selectbox("이 날 실제 연락 결과",event_options,index=event_options.index(default_label))
            past_connection=st.checkbox("과거 인연 관련 연락",value=bool(existing.get("past_connection",False)))
            note=st.text_input("짧은 메모(선택)",value=str(existing.get("note") or "")[:200],placeholder="예: 저녁에 먼저 전화 옴")
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

'''

text = text.replace(marker, block + marker, 1)

# Compute the topic aggregates before the score grid so the new directional panel can reuse them.
old_daily_scores = '''    daily_scores={k:rows_avg(life_rows,k) for k in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]}\n'''
new_daily_scores = old_daily_scores + '''    daily_topic_results={topic: aggregate_topic_result(life_rows, topic) for topic in AI_TOPIC_ORDER}\n'''
replace_once(old_daily_scores, new_daily_scores, "daily topic pre-aggregation")

caption = '''    st.caption("숫자는 사건 확률이 아니라 같은 분야 안에서 흐름을 비교하기 위한 내부 상대지수야.")\n'''
insert_panel = caption + '''    relationship_signals=render_relationship_signal_panel(query_date,daily_scores,daily_topic_results)\n'''
replace_once(caption, insert_panel, "relationship daily panel")

# Remove the old duplicate aggregation that followed the grid.
old_dup = '''    daily_topic_results={topic:aggregate_topic_result(life_rows,topic) for topic in AI_TOPIC_ORDER}\n'''
replace_once(old_dup, '''    # daily_topic_results는 위 연락 방향 패널과 AI가 함께 재사용한다.\n''', "daily duplicate aggregation")

APP.write_text(text, encoding="utf-8")
print("Applied relationship direction + calibration v6.10")
