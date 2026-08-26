from pathlib import Path

APP = Path("app.py")
WORKER = Path("scripts/prewarm_streamlit_horoscope.py")

app = APP.read_text(encoding="utf-8")
worker = WORKER.read_text(encoding="utf-8")

marker = 'automation_mode = str(automation_value or "").strip() == "1"'

if marker not in app:
    old = '''    configured_pin = _configured_app_pin()\n    signing_secret = _remember_secret()\n\n    persistent_state = _try_persistent_unlock(configured_pin, signing_secret)\n    if persistent_state is None:\n        _render_auth_wait("이 기기의 자동 로그인 정보를 확인하는 중이야…")\n        st.stop()\n    if persistent_state is True:\n        return\n    if st.session_state.get("_astro_pending_logout_nonce"):\n        _process_pending_logout()\n'''
    new = '''    configured_pin = _configured_app_pin()\n    signing_secret = _remember_secret()\n\n    # GitHub Actions의 headless browser는 streamlit_js_eval localStorage component가\n    # 응답하지 않는 환경이 있을 수 있다. automation=1은 자동로그인 조회만 건너뛰며\n    # PIN 검증 자체는 그대로 유지한다.\n    automation_value = st.query_params.get("automation", "")\n    if isinstance(automation_value, (list, tuple)):\n        automation_value = automation_value[0] if automation_value else ""\n    automation_mode = str(automation_value or "").strip() == "1"\n\n    if automation_mode:\n        persistent_state = False\n    else:\n        persistent_state = _try_persistent_unlock(configured_pin, signing_secret)\n        if persistent_state is None:\n            _render_auth_wait("이 기기의 자동 로그인 정보를 확인하는 중이야…")\n            st.stop()\n        if persistent_state is True:\n            return\n        if st.session_state.get("_astro_pending_logout_nonce"):\n            _process_pending_logout()\n'''
    if old not in app:
        raise SystemExit("app auth block marker not found")
    app = app.replace(old, new, 1)

    old_remember = '    remember_enabled = streamlit_js_eval is not None and len(signing_secret) >= 32\n'
    new_remember = '    remember_enabled = (not automation_mode) and streamlit_js_eval is not None and len(signing_secret) >= 32\n'
    if old_remember not in app:
        raise SystemExit("remember_enabled marker not found")
    app = app.replace(old_remember, new_remember, 1)

if '"automation": "1"' not in worker:
    old_worker = '    params = {"push_kind": kind}\n'
    new_worker = '    params = {"push_kind": kind, "automation": "1"}\n'
    if old_worker not in worker:
        raise SystemExit("prewarm target params marker not found")
    worker = worker.replace(old_worker, new_worker, 1)

if marker not in app:
    raise SystemExit("automation auth patch missing after edit")
if '"automation": "1"' not in worker:
    raise SystemExit("prewarm automation query marker missing after edit")

APP.write_text(app, encoding="utf-8")
WORKER.write_text(worker, encoding="utf-8")
print("Applied headless automation auth compatibility v6.9.1")
