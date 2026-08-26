from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")

if "def _request_browser_persistent_storage():" in text:
    print("Persistent storage v6.7.1 already applied")
    raise SystemExit(0)

needle = '''def _render_browser_storage_estimate():
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

replacement = '''def _request_browser_persistent_storage():
    """브라우저에 IndexedDB 지속 저장(persistent storage)을 요청한다.

    허용 여부는 브라우저 정책이 최종 결정한다. None은 JS 컴포넌트 응답 대기 상태다.
    """
    if streamlit_js_eval is None:
        return {"ok":False,"supported":False,"granted":False,"reason":"streamlit_js_eval unavailable"}
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
    if value is None:
        return None
    try:
        parsed=json.loads(str(value));return parsed if isinstance(parsed,dict) else {"ok":False,"supported":True,"granted":False}
    except Exception:
        return {"ok":False,"supported":True,"granted":False,"error":"invalid browser response"}


def _render_browser_storage_estimate():
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

if needle not in text:
    raise SystemExit("storage estimate render block not found")
text = text.replace(needle, replacement, 1)

archive_needle = '''    _render_browser_storage_estimate()
    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
'''

archive_replacement = '''    storage_info=_render_browser_storage_estimate()
    if storage_info and storage_info.get("indexedDB") and not storage_info.get("persisted"):
        st.caption("🛡️ 브라우저 관리형 저장은 기기 저장공간이 매우 부족할 때 정리될 수 있어. 아래 버튼으로 지속 저장을 요청할 수 있어.")
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
                    st.session_state["_fortune_archive_read_nonce"]=int(st.session_state.get("_fortune_archive_read_nonce",0) or 0)+1
                elif not persist_result.get("supported",True):
                    st.info("이 브라우저는 지속 저장 요청 API를 제공하지 않아. IndexedDB 자체 저장은 그대로 정상 동작해.")
                else:
                    st.info("브라우저가 이번에는 지속 저장을 허용하지 않았어. IndexedDB 데이터는 그대로 유지되며, 허용 여부는 브라우저 정책이 결정해.")
    elif storage_info and storage_info.get("persisted"):
        st.success("🛡️ 이 브라우저는 현재 지속 저장 모드야.")
    if st.button("↻ 저장함 새로고침",use_container_width=True,key="fortune_archive_refresh"):
'''

if archive_needle not in text:
    raise SystemExit("archive storage UI marker not found")
text = text.replace(archive_needle, archive_replacement, 1)

APP.write_text(text, encoding="utf-8")
print("Applied persistent IndexedDB storage request v6.7.1")
