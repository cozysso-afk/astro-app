from pathlib import Path

# Trigger v6.9.0 archive resilience workflow after the workflow exists on main.
APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1) Persistent storage + JSON backup/restore helpers
# ------------------------------------------------------------
if "def _request_browser_persistent_storage():" not in text:
    marker = "def _render_browser_storage_estimate():\n"
    if marker not in text:
        raise SystemExit("storage renderer marker not found")
    helpers = r'''def _request_browser_persistent_storage():
    """Ask the browser to keep IndexedDB data persistently when supported."""
    if streamlit_js_eval is None:
        return {"ok":False,"supported":False,"granted":False}
    nonce=int(st.session_state.get("_fortune_persist_request_nonce",0) or 0)
    expression=(
        "(async()=>{try{"
        "if(!navigator.storage||!navigator.storage.persist){return JSON.stringify({ok:true,supported:false,granted:false});}"
        "const before=navigator.storage.persisted?await navigator.storage.persisted():false;"
        "const requested=before?true:await navigator.storage.persist();"
        "const after=navigator.storage.persisted?await navigator.storage.persisted():Boolean(requested);"
        "return JSON.stringify({ok:true,supported:true,granted:Boolean(after),already:Boolean(before)});"
        "}catch(err){return JSON.stringify({ok:false,supported:true,granted:false,error:String(err&&err.message||err)});}})()"
    )
    value=streamlit_js_eval(js_expressions=expression,key=f"idb_persist_request_{nonce}")
    if value is None:return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else {"ok":False,"supported":True,"granted":False}
    except Exception:
        return {"ok":False,"supported":True,"granted":False,"error":"invalid browser response"}


def _read_browser_archive_backup():
    """Return a portable JSON backup containing horoscope records only (no secrets/meta)."""
    if streamlit_js_eval is None:return None
    nonce=int(st.session_state.get("_fortune_backup_nonce",0) or 0)
    allowed_js=json.dumps(["daily","period_calc","period_ai","annual"])
    body=(
        "const all=await reqP(db.transaction(STORE,'readonly').objectStore(STORE).getAll());db.close();"
        f"const allowed=new Set({allowed_js});"
        "const records=all.filter(x=>x&&allowed.has(String(x.kind||''))&&x.id&&x.payload);"
        "records.sort((a,b)=>String(a.id).localeCompare(String(b.id)));"
        "return JSON.stringify({format:'astro-fortune-archive',version:1,exported_at:new Date().toISOString(),records:records});"
    )
    error_body="return JSON.stringify({format:'astro-fortune-archive',version:1,exported_at:new Date().toISOString(),records:[],warning:'IndexedDB backup unavailable'});"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_archive_backup_{nonce}")
    if value is None:return None
    return str(value)


def _validate_archive_backup(uploaded_bytes):
    if not uploaded_bytes:return None,"빈 파일이야."
    if len(uploaded_bytes)>25*1024*1024:return None,"백업 파일이 25MB를 넘어 복원을 중단했어."
    try:data=json.loads(uploaded_bytes.decode("utf-8"))
    except Exception:return None,"JSON 백업 파일을 읽지 못했어."
    if not isinstance(data,dict) or data.get("format")!="astro-fortune-archive":return None,"별빛의 운명 저장함 백업 형식이 아니야."
    records=data.get("records")
    if not isinstance(records,list):return None,"백업 records 형식이 잘못됐어."
    if len(records)>5000:return None,"백업 항목이 5,000개를 넘어 복원을 중단했어."
    allowed={"daily":"daily:","period_calc":"period_calc:","period_ai":"period_ai:","annual":"annual:"}
    clean=[]
    for rec in records:
        if not isinstance(rec,dict):continue
        kind=str(rec.get("kind") or ""); rid=str(rec.get("id") or "")
        if kind not in allowed or not rid.startswith(allowed[kind]) or "payload" not in rec:continue
        clean.append({
            "id":rid,"kind":kind,"subtype":rec.get("subtype"),"sort_key":str(rec.get("sort_key") or ""),
            "saved_at":int(rec.get("saved_at") or 0),"payload":rec.get("payload"),"schema":int(rec.get("schema") or 1),
        })
    if records and not clean:return None,"복원 가능한 운세 항목이 없어."
    return clean,None


def _restore_browser_archive_records(records):
    """Merge validated backup records into IndexedDB by record id."""
    if streamlit_js_eval is None:return {"ok":False,"error":"streamlit_js_eval unavailable"}
    nonce=int(st.session_state.get("_fortune_restore_nonce",0) or 0)
    records_json=json.dumps(records,ensure_ascii=False,separators=(",",":"))
    packed_js=json.dumps(records_json)
    body=(
        f"const records=JSON.parse({packed_js});"
        "const tx=db.transaction(STORE,'readwrite');const s=tx.objectStore(STORE);"
        "for(const rec of records){s.put(rec);}await txDone(tx);db.close();"
        "return JSON.stringify({ok:true,count:records.length});"
    )
    error_body="return JSON.stringify({ok:false,error:String(e&&e.message||e)});"
    value=streamlit_js_eval(js_expressions=_idb_wrap(body,error_body),key=f"idb_archive_restore_{nonce}")
    if value is None:return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else {"ok":False,"error":"invalid browser response"}
    except Exception:return {"ok":False,"error":"invalid browser response"}


'''
    text=text.replace(marker,helpers+marker,1)

# ------------------------------------------------------------
# 2) Make storage renderer return its state to the archive UI
# ------------------------------------------------------------
old='''def _render_browser_storage_estimate():
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
new='''def _render_browser_storage_estimate():
    info=_read_browser_storage_estimate()
    if info is None:
        st.caption("💾 IndexedDB 저장공간을 확인하는 중...")
        return None
    if not info.get("indexedDB"):
        st.warning("이 브라우저에서는 IndexedDB를 사용할 수 없어 기존 저장소 fallback을 사용 중이야.")
        return info
    quota=float(info.get("quota",0) or 0);usage=float(info.get("usage",0) or 0)
    def human(n):
        if n>=1024**3:return f"{n/(1024**3):.1f} GB"
        if n>=1024**2:return f"{n/(1024**2):.1f} MB"
        return f"{n/1024:.1f} KB"
    if quota>0:
        st.caption(f"💾 IndexedDB 사용 중 · 이 사이트 전체 브라우저 저장공간 약 {human(usage)} / 허용량 약 {human(quota)} · {'지속 저장 모드' if info.get('persisted') else '브라우저 관리형 저장'}")
    else:
        st.caption("💾 IndexedDB 사용 중 · 브라우저가 정확한 quota(할당량)는 숨기고 있어.")
    return info
'''
if old in text:
    text=text.replace(old,new,1)
elif "def _render_browser_storage_estimate():" not in text:
    raise SystemExit("storage renderer missing after helper insertion")

# ------------------------------------------------------------
# 3) Archive UI: persistence request + backup/export/import
# ------------------------------------------------------------
archive_old='''    _render_browser_storage_estimate()
    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
'''
archive_new='''    storage_info=_render_browser_storage_estimate()
    if storage_info and storage_info.get("indexedDB") and not storage_info.get("persisted"):
        st.caption("🛡️ 브라우저 관리형 저장은 기기 저장공간이 매우 부족할 때 정리될 수 있어. 가능하면 지속 저장을 요청해둘 수 있어.")
        if st.button("🛡️ IndexedDB 오래 보관 요청",use_container_width=True,key="fortune_persist_storage"):
            st.session_state["_fortune_persist_request_nonce"]=int(st.session_state.get("_fortune_persist_request_nonce",0) or 0)+1
            st.session_state["_fortune_persist_request_pending"]=True
        if st.session_state.get("_fortune_persist_request_pending"):
            persist_result=_request_browser_persistent_storage()
            if persist_result is None:
                st.caption("🛡️ 브라우저에 지속 저장을 요청하는 중...")
            else:
                st.session_state["_fortune_persist_request_pending"]=False
                if persist_result.get("granted"):
                    st.success("🛡️ 지속 저장 모드가 허용됐어. 저장공간 압박 때 자동 정리될 가능성을 더 낮췄어.")
                elif not persist_result.get("supported",True):
                    st.info("이 브라우저는 지속 저장 요청 API를 제공하지 않아. IndexedDB 자체 저장은 정상 동작해.")
                else:
                    st.info("브라우저가 이번에는 지속 저장을 허용하지 않았어. 운세 데이터는 그대로 유지되고, 허용 여부는 브라우저 정책이 결정해.")
    elif storage_info and storage_info.get("persisted"):
        st.success("🛡️ 이 브라우저는 현재 지속 저장 모드야.")

    with st.expander("💾 저장함 백업 · 복원",expanded=False):
        st.caption("백업 파일에는 운세/AI 해설 문장이 들어가므로 개인 파일처럼 보관해. Gemini 키·PIN 같은 비밀값은 포함하지 않아.")
        backup_text=_read_browser_archive_backup()
        if backup_text is None:
            st.caption("백업 데이터를 준비하는 중...")
        else:
            try:
                backup_obj=json.loads(backup_text); backup_count=len(backup_obj.get("records",[])) if isinstance(backup_obj,dict) else 0
            except Exception: backup_count=0
            st.download_button(
                f"⬇️ 저장함 JSON 백업 다운로드 · {backup_count}개",
                data=backup_text.encode("utf-8"),
                file_name=f"astro-fortune-backup-{datetime.now(KST):%Y%m%d-%H%M}.json",
                mime="application/json",
                use_container_width=True,
                key="fortune_archive_backup_download",
            )
        restore_file=st.file_uploader("백업 JSON 복원",type=["json"],key="fortune_archive_restore_file")
        if restore_file is not None and st.button("⬆️ 이 백업을 저장함에 병합",use_container_width=True,key="fortune_archive_restore_button"):
            clean_records,restore_error=_validate_archive_backup(restore_file.getvalue())
            if restore_error:
                st.error(restore_error)
            else:
                st.session_state["_fortune_restore_payload"]=clean_records
                st.session_state["_fortune_restore_nonce"]=int(st.session_state.get("_fortune_restore_nonce",0) or 0)+1
                st.session_state["_fortune_restore_pending"]=True
        if st.session_state.get("_fortune_restore_pending"):
            restore_result=_restore_browser_archive_records(st.session_state.get("_fortune_restore_payload") or [])
            if restore_result is None:
                st.caption("복원 데이터를 IndexedDB에 병합하는 중...")
            else:
                st.session_state["_fortune_restore_pending"]=False
                if restore_result.get("ok"):
                    st.success(f"✅ 저장함 복원 완료 · {int(restore_result.get('count',0) or 0)}개 항목을 병합했어.")
                    st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
                else:
                    st.error("복원 실패 · "+str(restore_result.get("error") or "브라우저 저장 오류"))

    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
'''
if archive_old in text:
    text=text.replace(archive_old,archive_new,1)
elif "IndexedDB 오래 보관 요청" not in text or "저장함 JSON 백업 다운로드" not in text:
    raise SystemExit("archive UI marker not found")

APP.write_text(text,encoding="utf-8")
print("Applied archive resilience v6.9.0")
