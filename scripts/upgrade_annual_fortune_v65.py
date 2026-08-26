from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

if 'ANNUAL_AI_INTERPRETER_VERSION = "v1.0"' in text:
    print("annual fortune v6.5 already applied")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected exactly 1 match, got {count}")
    text = text.replace(old, new, 1)


ANNUAL_BLOCK = r'''
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
    exact=min(roots,key=lambda x:abs((x-KST.localize(datetime(int(year_value),birth_month_for_return(natal_lons),1))).total_seconds()) if False else x.timetuple().tm_yday)
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

'''

# NOTE: remove a dead expression from the annual solar-return helper before insertion.
ANNUAL_BLOCK = ANNUAL_BLOCK.replace(
    '    exact=min(roots,key=lambda x:abs((x-KST.localize(datetime(int(year_value),birth_month_for_return(natal_lons),1))).total_seconds()) if False else x.timetuple().tm_yday)\n',
    ''
)

replace_once(
    'def render_ai_overview(ai_result):\n',
    ANNUAL_BLOCK + 'def render_ai_overview(ai_result):\n',
    'insert annual engine',
)

replace_once(
'''    st.caption("일일 AI 해설은 최대 90일 · 주간은 최근 26개 · 월간은 최근 18개를 이 기기에 보관해. 저장본을 읽는 동안 Gemini API 비용은 들지 않아.")
''',
'''    st.caption("일일 AI 해설은 최대 90일 · 주간은 최근 26개 · 월간은 최근 18개 · 연간은 최근 8개 연도를 이 기기에 보관해. 저장본을 읽는 동안 Gemini API 비용은 들지 않아.")
''',
    'archive caption annual',
)

replace_once(
'''    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    period_ai=_read_period_ai_archive_entries()
    if daily is None or periods is None or period_ai is None:
        st.caption("📚 이 기기에 저장된 운세와 AI 해설을 확인하는 중...")
        return
''',
'''    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    period_ai=_read_period_ai_archive_entries()
    annual=_read_annual_archive_entries()
    if daily is None or periods is None or period_ai is None or annual is None:
        st.caption("📚 이 기기에 저장된 운세와 AI 해설을 확인하는 중...")
        return
''',
    'archive read annual',
)

replace_once(
'''    for entry in periods or []:
        if not isinstance(entry,dict):
            continue
        kind=entry.get("period")
''',
'''    for saved in annual or []:
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
''',
    'archive annual items',
)

replace_once(
'''    filter_label=st.selectbox("종류",["일일","주간","월간","전체"],key="fortune_archive_filter")
    wanted={"일일":"daily","주간":"weekly","월간":"monthly"}.get(filter_label)
''',
'''    filter_label=st.selectbox("종류",["일일","주간","월간","연간","전체"],key="fortune_archive_filter")
    wanted={"일일":"daily","주간":"weekly","월간":"monthly","연간":"annual"}.get(filter_label)
''',
    'archive annual filter',
)

replace_once(
'''    elif filter_label=="월간":
        year=choose_year(scoped,"monthly")
        year_rows=[x for x in scoped if x["date_obj"].year==year]
        year_rows.sort(key=lambda x:x["date_obj"].month,reverse=True)
        months=[x["date_obj"].month for x in year_rows]
        month=st.selectbox("월",months,format_func=lambda m:f"{m}월",key="fortune_archive_month_monthly")
        item=next(x for x in year_rows if x["date_obj"].month==month)

    else:
''',
'''    elif filter_label=="월간":
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
''',
    'archive annual selector',
)

replace_once(
'''    if item["type"]=="daily":
        result=dict(item["entry"].get("result",{}))
        result["cache_source"]="archive"
        render_ai_overview(result)
        return

    entry=item["entry"]
''',
'''    if item["type"]=="daily":
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
''',
    'archive render annual',
)

replace_once(
'''main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")
''',
'''main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🌌 연간","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")
''',
    'main menu annual',
)

ANNUAL_VIEW = r'''
# ------------------------------------------------------------
# ANNUAL
# ------------------------------------------------------------
elif main_view=="🌌 연간":
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

'''

replace_once(
'''# ------------------------------------------------------------
# ARCHIVE
# ------------------------------------------------------------
elif main_view=="📚 저장함":
''',
ANNUAL_VIEW + '''# ------------------------------------------------------------
# ARCHIVE
# ------------------------------------------------------------
elif main_view=="📚 저장함":
''',
    'annual main view',
)

replace_once(
'''        st.write("✅ 주간/월간: 날짜별 다중시각 평균 → 기간 집계")
''',
'''        st.write("✅ 주간/월간: 날짜별 다중시각 평균 → 기간 집계")
        st.write("✅ 연간: 12개월 전체 일별 다중시각 계산 → 월/분기 압축 + Solar Return 정확시각 + 월별 장기트랜짓 스냅샷")
''',
    'validation annual marker',
)

APP.write_text(text,encoding="utf-8")
print("annual fortune v6.5 patch applied")