from __future__ import annotations

from pathlib import Path

AI_PATH = Path("ai_interpret_v1.py")
WORKFLOW_PATH = Path(".github/workflows/thai-phase2g5-product-promotion-once.yml")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {text.count(old)}")
    return text.replace(old, new, 1)


def patch_ai() -> None:
    text = AI_PATH.read_text(encoding="utf-8")

    old_import = (
        "from thai_lagna_product_v1 import (\n"
        "    ENGINE_VERSION as THAI_LAGNA_PRODUCT_ENGINE_VERSION,\n"
        "    lagna_numeric_identity_is_valid,\n"
        "    product_routes_are_complete,\n"
        ")\n"
    )
    new_import = old_import + (
        "from thai_ai_output_guard_v1 import (\n"
        "    build_thai_output_fallback,\n"
        "    inspect_thai_output_safety,\n"
        "    strict_thai_retry_instruction,\n"
        "    thai_output_guard_required,\n"
        ")\n"
    )
    text = replace_once(text, old_import, new_import, "Thai output guard imports")

    text = replace_once(
        text,
        'AI_INTERPRETER_VERSION = "mobile-ai-v2.7-thai-lagna-fail-closed"',
        'AI_INTERPRETER_VERSION = "mobile-ai-v2.8-thai-output-guard-retry-fallback"',
        "AI interpreter version",
    )

    text = replace_once(
        text,
        'def _call_model(calculation: dict[str, Any], model_name: str, api_key: str, *, timeout_seconds: float = 24.0, thinking_level: str = "high") -> dict[str, Any]:',
        'def _call_model(calculation: dict[str, Any], model_name: str, api_key: str, *, timeout_seconds: float = 24.0, thinking_level: str = "high", strict_thai_output_guard: bool = False) -> dict[str, Any]:',
        "_call_model signature",
    )

    prompt_anchor = (
        '    safe_model = urllib.parse.quote(model_name, safe="-._")\n'
        '    url = f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"\n'
        "    prompt = (\n"
    )
    prompt_replacement = (
        '    safe_model = urllib.parse.quote(model_name, safe="-._")\n'
        '    url = f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"\n'
        "    compact_calculation = _compact_calculation(calculation)\n"
        '    strict_instruction = strict_thai_retry_instruction() if strict_thai_output_guard else ""\n'
        "    prompt = (\n"
    )
    text = replace_once(text, prompt_anchor, prompt_replacement, "prompt setup")

    payload_anchor = (
        '        + json.dumps(_compact_calculation(calculation), ensure_ascii=False, separators=(",", ":"), default=str)\n'
        "    )\n"
    )
    payload_replacement = (
        '        + json.dumps(compact_calculation, ensure_ascii=False, separators=(",", ":"), default=str)\n'
        "        + strict_instruction\n"
        "    )\n"
    )
    text = replace_once(text, payload_anchor, payload_replacement, "prompt compact payload")

    usage_anchor = '        usage = raw.get("usageMetadata", {}) if isinstance(raw, dict) else {}\n'
    guard_block = (
        "        guard = inspect_thai_output_safety(\n"
        "            validated,\n"
        "            thai_packet_present=thai_output_guard_required(compact_calculation),\n"
        "        )\n"
        '        if not guard.get("safe"):\n'
        "            return {\n"
        '                "ok": False,\n'
        '                "error": "Thai 출력 안전검증에서 금지된 예측 표현을 감지했어.",\n'
        '                "model": model_name,\n'
        '                "interpreter_version": AI_INTERPRETER_VERSION,\n'
        '                "thinking_level": thinking_level,\n'
        '                "output_guard_failed": True,\n'
        '                "guard_violations": guard.get("violations") or [],\n'
        '                "guard_engine": guard.get("guard_engine"),\n'
        '                "unsafe_data": validated,\n'
        "            }\n"
    )
    text = replace_once(text, usage_anchor, guard_block + usage_anchor, "output guard insertion")

    interpret_anchor = "\n\ndef interpret_integrated_fortune(calculation: dict[str, Any], preferred_model: str | None = None) -> dict[str, Any]:\n"
    wrapper = '''

def _call_model_with_thai_output_safety(
    calculation: dict[str, Any],
    model_name: str,
    api_key: str,
    *,
    timeout_seconds: float,
    thinking_level: str,
) -> dict[str, Any]:
    """Retry a Thai output violation once, then omit Thai explanation safely."""
    first = _call_model(
        calculation,
        model_name,
        api_key,
        timeout_seconds=timeout_seconds,
        thinking_level=thinking_level,
        strict_thai_output_guard=False,
    )
    if first.get("output_guard_failed") is not True:
        return first

    retry = _call_model(
        calculation,
        model_name,
        api_key,
        timeout_seconds=timeout_seconds,
        thinking_level=thinking_level,
        strict_thai_output_guard=True,
    )
    if retry.get("ok"):
        retry["thai_safety_retry"] = True
        retry["thai_safety_retry_reason"] = "output_guard"
        return retry

    unsafe = retry.get("unsafe_data") if isinstance(retry.get("unsafe_data"), dict) else first.get("unsafe_data")
    fallback = build_thai_output_fallback(unsafe)
    fallback_validated = _validate_output(fallback) if isinstance(fallback, dict) else None
    fallback_guard = (
        inspect_thai_output_safety(fallback_validated, thai_packet_present=True)
        if fallback_validated
        else {"safe": False}
    )
    if fallback_validated and fallback_guard.get("safe"):
        return {
            "ok": True,
            "data": fallback_validated,
            "model": retry.get("model") or first.get("model") or model_name,
            "interpreter_version": AI_INTERPRETER_VERSION,
            "thinking_level": retry.get("thinking_level") or first.get("thinking_level") or thinking_level,
            "thai_safety_retry": True,
            "thai_safety_fallback": True,
            "thai_safety_retry_error": retry.get("error"),
            "thai_safety_guard_violations": retry.get("guard_violations") or first.get("guard_violations") or [],
        }

    retry["thai_safety_retry"] = True
    retry["thai_safety_fallback_failed"] = True
    return retry
'''
    text = replace_once(text, interpret_anchor, wrapper + interpret_anchor, "safe call wrapper")

    text = replace_once(
        text,
        '    primary = _call_model(calculation, model, api_key, timeout_seconds=22.0, thinking_level="high")',
        '    primary = _call_model_with_thai_output_safety(calculation, model, api_key, timeout_seconds=22.0, thinking_level="high")',
        "primary guarded call",
    )
    text = replace_once(
        text,
        '    fallback = _call_model(calculation, AI_FALLBACK_MODEL, api_key, timeout_seconds=16.0, thinking_level="medium")',
        '    fallback = _call_model_with_thai_output_safety(calculation, AI_FALLBACK_MODEL, api_key, timeout_seconds=16.0, thinking_level="medium")',
        "fallback guarded call",
    )

    AI_PATH.write_text(text, encoding="utf-8")


def patch_workflow() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    replacements = (
        ("name: Thai Phase 2G5.1 fail-closed regression", "name: Thai Phase 2G5.2 output safety regression", "workflow name"),
        ("      - 'ai_interpret_v1.py'", "      - 'ai_interpret_v1.py'\n      - 'thai_ai_output_guard_v1.py'", "workflow guard path"),
        ("      - name: Run Phase 2G5.1 exact 221-test regression matrix", "      - name: Run Phase 2G5.2 exact 239-test regression matrix", "workflow test step"),
        (
            "              'test_thai_lagna_product_v1.py', 'test_thai_lagna_product_integration.py',",
            "              'test_thai_ai_output_guard_v1.py', 'test_thai_ai_output_guard_integration.py',\n              'test_thai_lagna_product_v1.py', 'test_thai_lagna_product_integration.py',",
            "workflow test patterns",
        ),
        ("          print(f'PHASE2G51_DISCOVERED_TESTS={total}')", "          print(f'PHASE2G52_DISCOVERED_TESTS={total}')", "workflow discovery marker"),
        ("          if total != 221:", "          if total != 239:", "workflow expected count"),
        ("              raise SystemExit(f'expected 221 tests, discovered {total}')", "              raise SystemExit(f'expected 239 tests, discovered {total}')", "workflow count error"),
        ("          print(f'PHASE2G51_RESULT={result.testsRun}/{total}')", "          print(f'PHASE2G52_RESULT={result.testsRun}/{total}')", "workflow result marker"),
        ("thai_lagna_product_v1.py thai_astrology_v2.py ai_interpret_v1.py", "thai_lagna_product_v1.py thai_ai_output_guard_v1.py thai_astrology_v2.py ai_interpret_v1.py", "workflow compile list"),
        ("          print('PHASE2G51_FAIL_CLOSED_PRODUCT_SCOPE_PASS')", "          print('PHASE2G52_OUTPUT_GUARD_PRODUCT_SCOPE_PASS')", "workflow scope marker"),
    )
    for old, new, label in replacements:
        text = replace_once(text, old, new, label)
    WORKFLOW_PATH.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_ai()
    patch_workflow()
    print("THAI_G52_PATCH_APPLIED")
