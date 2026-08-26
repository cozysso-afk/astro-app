from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

if 'PERIOD_AI_INTERPRETER_VERSION = "v1.0"' in text:
    print("period AI v6.4 already applied")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected exactly 1 match, got {count}")
    text = text.replace(old, new, 1)


PERIOD_AI_BLOCK = r'''
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


'''

replace_once(
    'def render_ai_overview(ai_result):\n',
    PERIOD_AI_BLOCK + 'def render_ai_overview(ai_result):\n',
    'insert period AI engine',
)

replace_once(
'''    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    if daily is None or periods is None:
        st.caption("📚 이 기기에 저장된 운세를 확인하는 중...")
        return
''',
'''    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    period_ai=_read_period_ai_archive_entries()
    if daily is None or periods is None or period_ai is None:
        st.caption("📚 이 기기에 저장된 운세와 AI 해설을 확인하는 중...")
        return
''',
    'archive read period AI',
)

replace_once(
'''    items=[]
    for entry in daily or []:
''',
'''    period_ai_by_id={}
    for saved in period_ai or []:
        if not isinstance(saved,dict):
            continue
        sid=str(saved.get("id") or "")
        result=saved.get("result",{}) if isinstance(saved.get("result"),dict) else {}
        if sid and result.get("ok"):
            period_ai_by_id[sid]=saved

    items=[]
    for entry in daily or []:
''',
    'archive period AI map',
)

replace_once(
'''    entry=item["entry"]
    st.markdown(f"<div class='period-range'><strong>{html.escape(item['label'])}</strong></div>",unsafe_allow_html=True)
''',
'''    entry=item["entry"]
    saved_period_ai=period_ai_by_id.get(str(entry.get("id") or ""))
    if saved_period_ai:
        saved_result=saved_period_ai.get("result",{}) if isinstance(saved_period_ai,dict) else {}
        if isinstance(saved_result,dict) and saved_result.get("ok"):
            saved_result=dict(saved_result)
            saved_result["cache_source"]="archive"
            render_ai_period_overview(saved_result,item["label"])

    st.markdown(f"<div class='period-range'><strong>{html.escape(item['label'])}</strong></div>",unsafe_allow_html=True)
''',
    'archive render period AI',
)

replace_once(
'''    _save_period_archive("weekly",query_date,week_end,week_rows)

    st.markdown("#### 🧭 분야별 주간 흐름")
''',
'''    _save_period_archive("weekly",query_date,week_end,week_rows)

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
''',
    'weekly AI integration',
)

replace_once(
'''    if month_rows:
        _save_period_archive("monthly",month_first,month_last,month_rows)
        st.markdown("#### 🧭 분야별 월간 흐름")
''',
'''    if month_rows:
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
''',
    'monthly AI integration',
)

APP.write_text(text,encoding="utf-8")
print("weekly/monthly period AI v6.4 patch applied")
