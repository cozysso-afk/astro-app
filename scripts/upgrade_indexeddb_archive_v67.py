from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

if 'BROWSER_IDB_SCHEMA_VERSION = 1' in text:
    print("IndexedDB archive v6.7 already applied")
    raise SystemExit(0)

marker = '''# ============================================================
# 9. RETURN / DAILY MOON EVENTS
# ============================================================
'''
if marker not in text:
    raise SystemExit("section 9 marker not found")

block = r'''
# ============================================================
# 8-E. INDEXEDDB PRIMARY FORTUNE STORAGE · V6.7
# ============================================================
# 운세 데이터(일일/주간/월간/연간)는 IndexedDB를 주 저장소로 사용한다.
# 로그인 유지 토큰은 작고 민감도가 다른 상태값이므로 기존 localStorage 방식을 유지한다.
# 기존 localStorage 운세는 첫 IndexedDB 접근 시 자동 마이그레이션하며, 실패 시 fallback으로 남긴다.
BROWSER_IDB_SCHEMA_VERSION = 1
BROWSER_IDB_DB_NAME = "astro_fortune_db_v1"
BROWSER_IDB_STORE_NAME = "records"
BROWSER_IDB_MIGRATION_ID = "meta:migrated_localstorage_v1"
BROWSER_IDB_DAILY_FAR_FUTURE_EXPIRY = 4102444800  # 2100-01-01 UTC


def _idb_js_prelude():
    db_js=json.dumps(BROWSER_IDB_DB_NAME)
    store_js=json.dumps(BROWSER_IDB_STORE_NAME)
    migration_js=json.dumps(BROWSER_IDB_MIGRATION_ID)
    daily_prefix_js=json.dumps(AI_BROWSER_CACHE_PREFIX)
    period_archive_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY)
    period_ai_js=json.dumps(PERIOD_AI_STORAGE_KEY)
    annual_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    far_expiry=int(BROWSER_IDB_DAILY_FAR_FUTURE_EXPIRY)
    return (
        f"const DB_NAME={db_js},STORE={store_js},DB_VERSION={BROWSER_IDB_SCHEMA_VERSION},MIGRATION_ID={migration_js};"
        f"const LEGACY_DAILY_PREFIX={daily_prefix_js},LEGACY_PERIOD_KEY={period_archive_js},LEGACY_PERIOD_AI_KEY={period_ai_js},LEGACY_ANNUAL_KEY={annual_js};"
        "const reqP=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed'));});"
        "const txDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve(true);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));});"
        "const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);"
        "r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('kind','kind',{unique:false});s.createIndex('sort_key','sort_key',{unique:false});}};"
        "r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB open failed'));});"
        "const ensureMigration=async(db)=>{"
        "const checkTx=db.transaction(STORE,'readonly');const marker=await reqP(checkTx.objectStore(STORE).get(MIGRATION_ID));if(marker)return;"
        "const tx=db.transaction(STORE,'readwrite');const s=tx.objectStore(STORE);const now=Math.floor(Date.now()/1000);"
        "for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith(LEGACY_DAILY_PREFIX))continue;try{const p=JSON.parse(localStorage.getItem(k)||'{}');const r=p.result||{};const m=r.archive_meta||{};if(!r.ok)continue;p.expires_at="+str(far_expiry)+";const cid=k.slice(LEGACY_DAILY_PREFIX.length);s.put({id:'daily:'+cid,kind:'daily',sort_key:String(m.date||p.saved_at||''),saved_at:Number(p.saved_at||now),payload:p,schema:1});}catch(e){}}"
        "try{let arr=JSON.parse(localStorage.getItem(LEGACY_PERIOD_KEY)||'[]');if(Array.isArray(arr)){arr.forEach(x=>{if(!x||!x.id)return;s.put({id:'period_calc:'+x.id,kind:'period_calc',subtype:String(x.period||''),sort_key:String(x.start||''),saved_at:Number(x.saved_at||now),payload:x,schema:1});});}}catch(e){}"
        "try{let arr=JSON.parse(localStorage.getItem(LEGACY_PERIOD_AI_KEY)||'[]');if(Array.isArray(arr)){arr.forEach(x=>{if(!x||!x.id)return;s.put({id:'period_ai:'+x.id,kind:'period_ai',subtype:String(x.period||''),sort_key:String(x.start||''),saved_at:Number(x.saved_at||now),payload:x,schema:1});});}}catch(e){}"
        "try{let arr=JSON.parse(localStorage.getItem(LEGACY_ANNUAL_KEY)||'[]');if(Array.isArray(arr)){arr.forEach(x=>{if(!x||!x.year)return;s.put({id:'annual:'+String(x.year),kind:'annual',sort_key:String(x.year),saved_at:Number(x.saved_at||now),payload:x,schema:1});});}}catch(e){}"
        "s.put({id:MIGRATION_ID,kind:'meta',sort_key:'',saved_at:now,payload:{migrated_at:now},schema:1});await txDone(tx);};"
    )


def _idb_wrap(body,error_body):
    return "(async()=>{try{"+_idb_js_prelude()+"const db=await openDb();await ensureMigration(db);"+body+"}catch(e){"+error_body+"}})()"


def _read_ai_browser_cache(cache_id):
    """IndexedDB 우선 일일 AI 캐시. None=component 대기, ''=저장본 없음."""
    if streamlit_js_eval is None:
        return ""
    record_id_js=json.dumps("daily:"+cache_id)
    legacy_key_js=json.dumps(_ai_browser_storage_key(cache_id))
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    body=(
        f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({record_id_js}));db.close();"
        "if(rec&&rec.payload)return JSON.stringify(rec.payload);"
        f"const legacy=localStorage.getItem({legacy_key_js});return legacy===null?{empty_js}:legacy;"
    )
    error_body=f"try{{const v=localStorage.getItem({legacy_key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_daily_read_{cache_id}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return ""
    return value


def _write_ai_browser_cache(cache_id,ai_result):
    if streamlit_js_eval is None or not ai_result or not ai_result.get("ok"):
        return None
    now_ts=int(time.time())
    packed={"saved_at":now_ts,"expires_at":BROWSER_IDB_DAILY_FAR_FUTURE_EXPIRY,"result":ai_result}
    record={
        "id":"daily:"+cache_id,
        "kind":"daily",
        "sort_key":str((ai_result.get("archive_meta") or {}).get("date") or now_ts),
        "saved_at":now_ts,
        "payload":packed,
        "schema":BROWSER_IDB_SCHEMA_VERSION,
    }
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    legacy_key_js=json.dumps(_ai_browser_storage_key(cache_id))
    packed_js=json.dumps(json.dumps(packed,ensure_ascii=False,separators=(",",":")))
    body=(
        f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    )
    error_body=f"try{{localStorage.setItem({legacy_key_js},{packed_js});return 'legacy';}}catch(_e){{return 'fail';}}"
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_daily_write_{fp}")


def _read_daily_archive_entries():
    if streamlit_js_eval is None:
        return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='daily'&&x.payload&&x.payload.result&&x.payload.result.ok).map(x=>x.payload);"
        "out.sort((a,b)=>Number(b.saved_at||0)-Number(a.saved_at||0));return JSON.stringify(out);"
    )
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=(
        "try{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith("+json.dumps(AI_BROWSER_CACHE_PREFIX)+"))continue;"
        "try{const o=JSON.parse(localStorage.getItem(k)||'{}');if(o.result&&o.result.ok)out.push(o);}catch(e){}}"
        "out.sort((a,b)=>Number(b.saved_at||0)-Number(a.saved_at||0));return JSON.stringify(out);}catch(_e){return "+empty_js+";}"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_daily_archive_{nonce}")
    if value is None:
        return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:
        return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:
        return []


def _save_period_archive(kind,start_date,end_date,rows):
    if streamlit_js_eval is None or not rows or kind not in {"weekly","monthly"}:
        return None
    snapshot=_period_snapshot(kind,start_date,end_date,rows)
    fp=hashlib.sha256(json.dumps(snapshot,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    session_key=f"_idb_period_archive_written_{snapshot['id']}_{fp}"
    if st.session_state.get(session_key):
        return "ok"
    record={"id":"period_calc:"+snapshot["id"],"kind":"period_calc","subtype":kind,"sort_key":snapshot["start"],"saved_at":snapshot["saved_at"],"payload":snapshot,"schema":BROWSER_IDB_SCHEMA_VERSION}
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    legacy_key_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY)
    snap_js=json.dumps(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")))
    error_body=(
        f"try{{const key={legacy_key_js},snap=JSON.parse({snap_js});let arr=[];try{{arr=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{arr=[];}}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&x.id!==snap.id);arr.push(snap);localStorage.setItem(key,JSON.stringify(arr));return 'legacy';}catch(_e){return 'fail';}"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_calc_write_{fp}")
    if value is None:
        return None
    if str(value) in {"ok","legacy"}:
        st.session_state[session_key]=True
    return str(value)


def _read_period_archive_entries():
    if streamlit_js_eval is None:
        return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='period_calc'&&x.payload).map(x=>x.payload);out.sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));return JSON.stringify(out);"
    )
    key_js=json.dumps(PERIOD_ARCHIVE_STORAGE_KEY);empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=f"try{{const v=localStorage.getItem({key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_archive_read_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _read_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level):
    if streamlit_js_eval is None:
        return ""
    period_id=_period_ai_id(kind,start_date,end_date)
    record_id_js=json.dumps("period_ai:"+period_id)
    empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    hash_js=json.dumps(payload_hash);model_js=json.dumps(model);thinking_js=json.dumps(thinking_level)
    body=(
        f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({record_id_js}));db.close();"
        f"if(rec&&rec.payload&&rec.payload.payload_hash==={hash_js}&&rec.payload.model==={model_js}&&rec.payload.thinking_level==={thinking_js})return JSON.stringify(rec.payload);"
        f"return {empty_js};"
    )
    legacy_key_js=json.dumps(PERIOD_AI_STORAGE_KEY);id_js=json.dumps(period_id)
    error_body=(
        f"try{{let arr=[];try{{arr=JSON.parse(localStorage.getItem({legacy_key_js})||'[]');}}catch(e){{arr=[];}}"
        f"const x=Array.isArray(arr)?arr.find(v=>v&&v.id==={id_js}&&v.payload_hash==={hash_js}&&v.model==={model_js}&&v.thinking_level==={thinking_js}):null;return x?JSON.stringify(x):{empty_js};}}catch(_e){{return {empty_js};}}"
    )
    cache_key=hashlib.sha256(f"{kind}|{start_date}|{end_date}|{payload_hash}|{model}|{thinking_level}".encode("utf-8")).hexdigest()[:16]
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_ai_read_{cache_key}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return ""
    return value


def _write_period_ai_cache(kind,start_date,end_date,payload_hash,model,thinking_level,result):
    if streamlit_js_eval is None or not result or not result.get("ok"):
        return None
    item={"id":_period_ai_id(kind,start_date,end_date),"period":kind,"start":start_date.isoformat(),"end":end_date.isoformat(),"payload_hash":payload_hash,"model":model,"thinking_level":thinking_level,"saved_at":int(time.time()),"result":result}
    record={"id":"period_ai:"+item["id"],"kind":"period_ai","subtype":kind,"sort_key":item["start"],"saved_at":item["saved_at"],"payload":item,"schema":BROWSER_IDB_SCHEMA_VERSION}
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    legacy_key_js=json.dumps(PERIOD_AI_STORAGE_KEY);item_js=json.dumps(json.dumps(item,ensure_ascii=False,separators=(",",":")))
    error_body=(
        f"try{{const key={legacy_key_js},item=JSON.parse({item_js});let arr=[];try{{arr=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{arr=[];}}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&x.id!==item.id);arr.push(item);localStorage.setItem(key,JSON.stringify(arr));return 'legacy';}catch(_e){return 'fail';}"
    )
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_ai_write_{fp}")


def _read_period_ai_archive_entries():
    if streamlit_js_eval is None:return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='period_ai'&&x.payload).map(x=>x.payload);out.sort((a,b)=>Number(a.saved_at||0)-Number(b.saved_at||0));return JSON.stringify(out);"
    )
    key_js=json.dumps(PERIOD_AI_STORAGE_KEY);empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=f"try{{const v=localStorage.getItem({key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_period_ai_archive_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _read_annual_year_entry(year_value):
    if streamlit_js_eval is None:return ""
    record_id_js=json.dumps(f"annual:{int(year_value)}");empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL);year_js=json.dumps(int(year_value));legacy_key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY)
    body=f"const rec=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).get({record_id_js}));db.close();return rec&&rec.payload?JSON.stringify(rec.payload):{empty_js};"
    error_body=(
        f"try{{let arr=[];try{{arr=JSON.parse(localStorage.getItem({legacy_key_js})||'[]');}}catch(e){{arr=[];}}const x=Array.isArray(arr)?arr.find(v=>v&&Number(v.year)===Number({year_js})):null;return x?JSON.stringify(x):{empty_js};}}catch(_e){{return {empty_js};}}"
    )
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_annual_year_{int(year_value)}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return ""
    return value


def _write_annual_entry(year_value,payload,model,thinking_level,result):
    if streamlit_js_eval is None or not result or not result.get("ok"):
        return None
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    item={"id":f"annual:{int(year_value)}","period":"annual","year":int(year_value),"payload_hash":hashlib.sha256(payload_json.encode("utf-8")).hexdigest()[:24],"model":model,"thinking_level":thinking_level,"saved_at":int(time.time()),"payload":payload,"result":result}
    record={"id":item["id"],"kind":"annual","sort_key":str(item["year"]),"saved_at":item["saved_at"],"payload":item,"schema":BROWSER_IDB_SCHEMA_VERSION}
    record_js=json.dumps(json.dumps(record,ensure_ascii=False,separators=(",",":")))
    body=f"const rec=JSON.parse({record_js});const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(rec);await txDone(tx);db.close();return 'ok';"
    legacy_key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY);item_js=json.dumps(json.dumps(item,ensure_ascii=False,separators=(",",":")))
    error_body=(
        f"try{{const key={legacy_key_js},item=JSON.parse({item_js});let arr=[];try{{arr=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{arr=[];}}"
        "if(!Array.isArray(arr))arr=[];arr=arr.filter(x=>x&&Number(x.year)!==Number(item.year));arr.push(item);localStorage.setItem(key,JSON.stringify(arr));return 'legacy';}catch(_e){return 'fail';}"
    )
    fp=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_annual_write_{fp}")


def _read_annual_archive_entries():
    if streamlit_js_eval is None:return []
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        "const out=all.filter(x=>x&&x.kind==='annual'&&x.payload).map(x=>x.payload);out.sort((a,b)=>Number(b.year||0)-Number(a.year||0));return JSON.stringify(out);"
    )
    key_js=json.dumps(ANNUAL_ARCHIVE_STORAGE_KEY);empty_js=json.dumps(REMEMBER_EMPTY_SENTINEL)
    error_body=f"try{{const v=localStorage.getItem({key_js});return v===null?{empty_js}:v;}}catch(_e){{return {empty_js};}}"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_annual_archive_{nonce}")
    if value is None:return None
    if str(value)==REMEMBER_EMPTY_SENTINEL:return []
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,list) else []
    except Exception:return []


def _read_browser_storage_estimate():
    if streamlit_js_eval is None:return None
    nonce=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)
    expression=(
        "(async()=>{try{const e=(navigator.storage&&navigator.storage.estimate)?await navigator.storage.estimate():{};"
        "const p=(navigator.storage&&navigator.storage.persisted)?await navigator.storage.persisted():false;"
        "return JSON.stringify({ok:true,usage:Number(e.usage||0),quota:Number(e.quota||0),persisted:Boolean(p),indexedDB:Boolean(window.indexedDB)});"
        "}catch(err){return JSON.stringify({ok:false,error:String(err&&err.message||err),indexedDB:Boolean(window.indexedDB)});}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"idb_storage_estimate_{nonce}")
    if value is None:return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else None
    except Exception:return None


def _render_browser_storage_estimate():
    info=_read_browser_storage_estimate()
    if info is None:
        st.caption("💾 IndexedDB 저장공간을 확인하는 중...")
        return
    if not info.get("indexedDB"):
        st.warning("이 브라우저에서는 IndexedDB를 사용할 수 없어 기존 저장소 fallback을 사용 중이야.")
        return
    quota=float(info.get("quota",0) or 0);usage=float(info.get("usage",0) or 0)
    def human(n):
        if n>=1024**3:return f"{n/(1024**3):.1f} GB"
        if n>=1024**2:return f"{n/(1024**2):.1f} MB"
        return f"{n/1024:.1f} KB"
    if quota>0:
        st.caption(f"💾 IndexedDB 사용 중 · 이 사이트 전체 브라우저 저장공간 약 {human(usage)} / 허용량 약 {human(quota)} · {'지속 저장 모드' if info.get('persisted') else '브라우저 관리형 저장'}")
    else:
        st.caption("💾 IndexedDB 사용 중 · 브라우저가 정확한 quota(할당량)는 숨기고 있어.")


'''

text = text.replace(marker, block + marker, 1)

old_caption = '    st.caption("일일 AI 해설은 최대 90일 · 주간은 최근 26개 · 월간은 최근 18개 · 연간은 최근 8개 연도를 이 기기에 보관해. 저장본을 읽는 동안 Gemini API 비용은 들지 않아.")\n'
new_caption = '    st.caption("운세 저장함은 IndexedDB를 주 저장소로 써서 일일·주간·월간·연간을 장기 보관해. 앱에서 임의로 90일/26주/18개월 제한을 두지 않고, 저장본 재열람은 Gemini API 0회야.")\n    _render_browser_storage_estimate()\n'
if old_caption not in text:
    raise SystemExit("archive caption anchor not found")
text = text.replace(old_caption, new_caption, 1)

old_daily = '        st.caption("⚡ 새 해설은 서버 + 이 기기에 최대 90일 보관해. 같은 계산값을 다시 열면 API를 재호출하지 않아.")'
new_daily = '        st.caption("⚡ 새 해설은 서버 캐시 + 이 기기 IndexedDB에 장기 보관해. 같은 계산값을 다시 열면 API를 재호출하지 않아.")'
if old_daily not in text:
    raise SystemExit("daily retention caption anchor not found")
text = text.replace(old_daily, new_daily, 1)

APP.write_text(text, encoding="utf-8")
print("IndexedDB primary fortune storage v6.7 patch applied")
