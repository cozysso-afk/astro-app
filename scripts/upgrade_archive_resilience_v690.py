from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")
changed = False

# Persistent storage v6.7.1 may already be installed. Add backup/restore independently.
if "def _read_browser_archive_backup():" not in text:
    marker = "def _render_browser_storage_estimate():\n"
    if marker not in text:
        raise SystemExit("storage renderer marker not found")
    helpers = r'''def _read_browser_archive_backup():
    """Portable JSON backup of horoscope records only; secrets/meta are excluded."""
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
        try:saved_at=int(rec.get("saved_at") or 0); schema=int(rec.get("schema") or 1)
        except Exception:continue
        clean.append({"id":rid,"kind":kind,"subtype":rec.get("subtype"),"sort_key":str(rec.get("sort_key") or ""),"saved_at":saved_at,"payload":rec.get("payload"),"schema":schema})
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
    changed=True

if "저장함 JSON 백업 다운로드" not in text:
    refresh='''    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
'''
    if refresh not in text:
        raise SystemExit("archive refresh marker not found")
    ui='''    with st.expander("💾 저장함 백업 · 복원",expanded=False):
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
                mime="application/json",use_container_width=True,key="fortune_archive_backup_download",
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

'''
    text=text.replace(refresh,ui+refresh,1)
    changed=True

if changed:
    APP.write_text(text,encoding="utf-8")
    print("Applied archive resilience v6.9.1")
else:
    print("Archive resilience v6.9.1 already applied")
