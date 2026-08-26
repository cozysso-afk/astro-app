from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected exactly 1 match, got {count}")
    text = text.replace(old, new, 1)


replace_once(
'''AI_INTERPRETER_VERSION = "v6.2.3"
AI_SUPPORTED_MODELS = {
    "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
    "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
}
AI_DEFAULT_MODEL = "gemini-3.7-flash"
AI_FALLBACK_MODEL = "gemini-3.6-flash"
AI_DEFAULT_THINKING_LEVEL = "high"
AI_ALLOWED_THINKING_LEVELS = {"low", "medium", "high"}
AI_MAX_OUTPUT_TOKENS = 16384
AI_BROWSER_CACHE_PREFIX = "astro_ai_daily_v1_"
AI_BROWSER_CACHE_TTL_SECONDS = 86400
AI_TOPIC_ORDER = ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]
''',
'''AI_INTERPRETER_VERSION = "v6.3.0"
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
''',
"AI constants",
)

replace_once(
'''def _call_gemini_once(payload_json, model_name, thinking_level, api_key):
''',
'''def _gemini_price_for_date(model_name, day_value=None):
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
''',
"usage helpers",
)

replace_once(
'''        return {"ok":True,"data":valid,"model":model_name}
''',
'''        usage=_gemini_usage_summary(raw,model_name)
        return {"ok":True,"data":valid,"model":model_name,"usage":usage}
''',
"usage return",
)

replace_once(
'''@st.cache_data(ttl=86400, show_spinner=False)
def cached_ai_daily_interpretation(payload_json, preferred_model, thinking_level, key_fingerprint):
''',
'''@st.cache_data(ttl=AI_BROWSER_CACHE_TTL_SECONDS, show_spinner=False)
def cached_ai_daily_interpretation(payload_json, preferred_model, thinking_level, key_fingerprint):
''',
"server cache ttl",
)

replace_once(
'''    검증이 끝난 AI 결과를 이 기기에 24시간 보관한다.
''',
'''    검증이 끝난 AI 결과를 이 기기에 장기 보관한다.
''',
"cache docstring",
)

replace_once(
'''        f"const prefix={prefix_js};"
        "const now=Math.floor(Date.now()/1000);"
        "for(let i=localStorage.length-1;i>=0;i--){"
        " const k=localStorage.key(i);"
        " if(!k||!k.startsWith(prefix)) continue;"
        " try{const o=JSON.parse(localStorage.getItem(k)||'{}');"
        " if(!o.expires_at||Number(o.expires_at)<=now) localStorage.removeItem(k);}catch(e){localStorage.removeItem(k);}"
        "}"
        f"localStorage.setItem({storage_key_js},{packed_js});"
        "return 'ok';"
''',
'''        f"const prefix={prefix_js};"
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
''',
"cache size cap",
)

replace_once(
'''    result=cached_ai_daily_interpretation(payload_json,model,thinking_level,key_fp)
    if result and result.get("ok"):
        result=dict(result)
        result["cache_source"]=result.get("cache_source","server_or_api")
        _write_ai_browser_cache(cache_id,result)
    return result


def render_ai_overview(ai_result):
''',
'''    result=cached_ai_daily_interpretation(payload_json,model,thinking_level,key_fp)
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


def render_ai_overview(ai_result):
''',
"archive storage functions",
)

replace_once(
'''    cache_source=ai_result.get("cache_source","")
    if cache_source=="browser":
        st.caption("⚡ 이 기기에 저장된 24시간 AI 해설을 사용했어.")
    else:
        st.caption("⚡ 같은 계산값의 AI 해설은 서버 + 이 기기에 24시간 캐시해.")
''',
'''    cache_source=ai_result.get("cache_source","")
    if cache_source in {"browser","archive"}:
        st.caption("⚡ 이 기기에 저장된 해설을 사용했어 · Gemini API 재호출 0회.")
    else:
        st.caption("⚡ 새 해설은 서버 + 이 기기에 최대 90일 보관해. 같은 계산값을 다시 열면 API를 재호출하지 않아.")

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
''',
"cost caption",
)

replace_once(
'''    return data


# ============================================================
# 9. RETURN / DAILY MOON EVENTS
''',
'''    return data


def _render_fortune_archive():
    st.markdown("### 📚 운세 저장함")
    st.caption("일일 AI 해설은 최대 90일 · 주간은 최근 26개 · 월간은 최근 18개를 이 기기에 보관해. 저장본을 읽는 동안 Gemini API 비용은 들지 않아.")
    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
        st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
        st.rerun()

    daily=_read_daily_archive_entries()
    periods=_read_period_archive_entries()
    if daily is None or periods is None:
        st.caption("📚 이 기기에 저장된 운세를 확인하는 중...")
        return

    items=[]
    for entry in daily or []:
        result=entry.get("result",{}) if isinstance(entry,dict) else {}
        meta=result.get("archive_meta",{}) if isinstance(result,dict) else {}
        d=str(meta.get("date") or "")
        if not d:
            continue
        items.append({"type":"daily","sort":d,"label":f"🌙 {d} · 일일 AI 해설","entry":entry})
    for entry in periods or []:
        if not isinstance(entry,dict):
            continue
        kind=entry.get("period")
        start=str(entry.get("start") or ""); end=str(entry.get("end") or "")
        if kind=="weekly":
            label=f"📅 {start} ~ {end} · 주간"
        elif kind=="monthly":
            try:
                dt=date.fromisoformat(start); label=f"🌕 {dt.year}년 {dt.month}월 · 월간"
            except Exception:
                label=f"🌕 {start} · 월간"
        else:
            continue
        items.append({"type":kind,"sort":start,"label":label,"entry":entry})

    if not items:
        st.info("아직 저장된 운세가 없어. 일일 AI 해설을 열거나 주간/월간 리포트를 보면 자동으로 저장돼.")
        return

    filter_label=st.selectbox("종류",["전체","일일","주간","월간"],key="fortune_archive_filter")
    wanted={"일일":"daily","주간":"weekly","월간":"monthly"}.get(filter_label)
    if wanted:
        items=[x for x in items if x["type"]==wanted]
    items.sort(key=lambda x:x["sort"],reverse=True)
    if not items:
        st.info("이 종류의 저장된 운세는 아직 없어.")
        return

    labels=[x["label"] for x in items]
    chosen=st.selectbox("저장된 운세",labels,key="fortune_archive_choice")
    item=items[labels.index(chosen)]

    if item["type"]=="daily":
        result=dict(item["entry"].get("result",{}))
        result["cache_source"]="archive"
        render_ai_overview(result)
        return

    entry=item["entry"]
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
# 9. RETURN / DAILY MOON EVENTS
''',
"archive renderer",
)

replace_once(
'''main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")
''',
'''main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","📚 저장함","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")
''',
"main menu",
)

replace_once(
'''    with st.spinner("7일을 날짜별 다중 시각으로 계산하는 중..."):
        week_rows=cached_period_scores(query_date.isoformat(),7,natal_packed,houses_packed)

    st.markdown("#### 🧭 분야별 주간 흐름")
''',
'''    with st.spinner("7일을 날짜별 다중 시각으로 계산하는 중..."):
        week_rows=cached_period_scores(query_date.isoformat(),7,natal_packed,houses_packed)
    _save_period_archive("weekly",query_date,week_end,week_rows)

    st.markdown("#### 🧭 분야별 주간 흐름")
''',
"weekly archive",
)

replace_once(
'''    if month_rows:
        st.markdown("#### 🧭 분야별 월간 흐름")
''',
'''    if month_rows:
        _save_period_archive("monthly",month_first,month_last,month_rows)
        st.markdown("#### 🧭 분야별 월간 흐름")
''',
"monthly archive",
)

replace_once(
'''# ------------------------------------------------------------
# PRECISION / TRANSITS / RETURNS / VALIDATION
# ------------------------------------------------------------
elif main_view=="🔬 정밀분석":
''',
'''# ------------------------------------------------------------
# ARCHIVE
# ------------------------------------------------------------
elif main_view=="📚 저장함":
    _render_fortune_archive()

# ------------------------------------------------------------
# PRECISION / TRANSITS / RETURNS / VALIDATION
# ------------------------------------------------------------
elif main_view=="🔬 정밀분석":
''',
"archive branch",
)

APP.write_text(text, encoding="utf-8")
print("fortune archive v6.3 patch applied")
