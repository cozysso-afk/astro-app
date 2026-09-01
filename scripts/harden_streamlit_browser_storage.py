from pathlib import Path

APP = Path("app.py")
FORTUNE_LAB = Path("fortune_lab_v71.py")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one legacy block, found {count}")
    return text.replace(old, new, 1)


def patch_app(text: str) -> str:
    old_read = '''    expression = (\n        \"(()=>{\"\n        f\"const v=localStorage.getItem({storage_name_js});\"\n        f\"return v===null?{json.dumps(REMEMBER_EMPTY_SENTINEL)}:v;\"\n        \"})()\"\n    )\n'''
    new_read = '''    expression = (\n        \"(()=>{try{\"\n        f\"const v=localStorage.getItem({storage_name_js});\"\n        f\"return v===null?{json.dumps(REMEMBER_EMPTY_SENTINEL)}:v;\"\n        f\"}}catch(e){{return {json.dumps(REMEMBER_EMPTY_SENTINEL)};}}}})()\"\n    )\n'''

    old_write = '''    expression = (\n        \"(()=>{\"\n        f\"localStorage.setItem({storage_name_js},{token_js});\"\n        f\"return localStorage.getItem({storage_name_js})==={token_js}?'ok':'fail';\"\n        \"})()\"\n    )\n'''
    new_write = '''    expression = (\n        \"(()=>{try{\"\n        f\"localStorage.setItem({storage_name_js},{token_js});\"\n        f\"return localStorage.getItem({storage_name_js})==={token_js}?'ok':'fail';\"\n        \"}catch(e){return 'fail';}})()\"\n    )\n'''

    old_delete = '''    expression = (\n        \"(()=>{\"\n        f\"localStorage.removeItem({storage_name_js});\"\n        f\"return localStorage.getItem({storage_name_js})===null?'ok':'fail';\"\n        \"})()\"\n    )\n'''
    new_delete = '''    expression = (\n        \"(()=>{try{\"\n        f\"localStorage.removeItem({storage_name_js});\"\n        f\"return localStorage.getItem({storage_name_js})===null?'ok':'fail';\"\n        \"}catch(e){return 'fail';}})()\"\n    )\n'''

    text = replace_once(text, old_read, new_read, "remember localStorage read")
    text = replace_once(text, old_write, new_write, "remember localStorage write")
    text = replace_once(text, old_delete, new_delete, "remember localStorage delete")
    return text


def patch_fortune_lab(text: str) -> str:
    old = '''    value=streamlit_js_eval(js_expressions=f\"(()=>{{const v=localStorage.getItem({key_js});return v===null?'__EMPTY__':v;}})()\",key=f\"fortune_lab_read_{cache_id}_{suffix}\")\n'''
    new = '''    value=streamlit_js_eval(js_expressions=f\"(()=>{{try{{const v=localStorage.getItem({key_js});return v===null?'__EMPTY__':v;}}catch(e){{return '__EMPTY__';}}}})()\",key=f\"fortune_lab_read_{cache_id}_{suffix}\")\n'''
    return replace_once(text, old, new, "fortune lab localStorage read")


def main() -> None:
    app = APP.read_text(encoding="utf-8")
    fortune_lab = FORTUNE_LAB.read_text(encoding="utf-8")

    patched_app = patch_app(app)
    patched_fortune_lab = patch_fortune_lab(fortune_lab)

    required_app_markers = [
        'f"}}catch(e){{return {json.dumps(REMEMBER_EMPTY_SENTINEL)};}}}})()"',
        '"}catch(e){return \'fail\';}})()"',
    ]
    for marker in required_app_markers:
        if marker not in patched_app:
            raise SystemExit(f"app safety marker missing: {marker}")
    if "catch(e){{return '__EMPTY__';}}" not in patched_fortune_lab:
        raise SystemExit("fortune lab safety marker missing")

    APP.write_text(patched_app, encoding="utf-8")
    FORTUNE_LAB.write_text(patched_fortune_lab, encoding="utf-8")
    print("Applied Streamlit browser-storage resilience patch")


if __name__ == "__main__":
    main()
