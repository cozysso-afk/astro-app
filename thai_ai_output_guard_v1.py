# -*- coding: utf-8 -*-
"""Phase 2-G5.2 output guard for promoted Thai descriptive context.

The product-side Lagna packet is deliberately descriptive/non-predictive.  This
module enforces that contract *after* Gemini returns JSON so prompt drift cannot
turn Thai evidence into probabilities, event promises, invented exact timing,
or Thai good/bad scores.

The guard activates only when the curated Gemini input actually contains the
promoted ``ai_safe_descriptive_packet``.  Legacy interpretations without that
packet retain their previous behavior.
"""

from __future__ import annotations

import copy
import re
from typing import Any, Iterable

ENGINE_VERSION = "thai-ai-output-guard-v1.0-phase2g5-2"
FALLBACK_NOTE = "태국점성 설명은 출력 안전검증을 통과하지 못해 이번 해설에서는 제외했어."

_THAI_MARKER_RE = re.compile(
    r"(?:Thai|태국(?:점성술|점성)?|Suriyayat|수리야얏|สุริยยาตร์|Lagna|라그나|ลัคนา)",
    re.IGNORECASE,
)
_PERCENT_RE = re.compile(r"(?<!\d)(?:100|\d{1,2})(?:\.\d+)?\s*%")
_NUMERIC_PROBABILITY_RE = re.compile(
    r"(?:확률|가능성|성공률|재회율|연락률)\s*(?:은|는|이|가|:)?\s*(?:약\s*)?(?:100|\d{1,2})(?:\.\d+)?\s*%?"
)
_THAI_SCORE_RE = re.compile(
    r"(?:점수\s*(?:은|는|이|가|:)?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*점)"
)
_EXACT_DATE_RE = re.compile(
    r"(?:\b20\d{2}[-./]\d{1,2}[-./]\d{1,2}\b|\b\d{1,2}[-./]\d{1,2}[-./]\d{1,2}\b|\d{1,2}월\s*\d{1,2}일)"
)
_EXACT_TIME_RE = re.compile(
    r"(?:(?:오전|오후)\s*\d{1,2}(?::\d{2})?\s*시?|(?<!\d)\d{1,2}:\d{2}(?!\d)|\d{1,2}시\s*\d{1,2}분)"
)
_EVENT_ASSERTION_RE = re.compile(
    r"(?:"
    r"연락(?:이|가)?\s*(?:온다|올\s*(?:거야|것이다)|오게\s*된다)|"
    r"재회(?:한다|하게\s*된다|할\s*(?:거야|것이다))|"
    r"결혼(?:한다|하게\s*된다|할\s*(?:거야|것이다))|"
    r"합격(?:한다|하게\s*된다|할\s*(?:거야|것이다))|"
    r"취업(?:한다|하게\s*된다|할\s*(?:거야|것이다))|"
    r"이직(?:한다|하게\s*된다|할\s*(?:거야|것이다))|"
    r"수익(?:이|가)?\s*(?:난다|발생한다|확정된다)|"
    r"돈(?:을)?\s*번다|"
    r"사건(?:이|가)?\s*발생한다"
    r")"
)
_CERTAINTY_RE = re.compile(r"(?:반드시|확실히|무조건|틀림없이|분명히|100\s*%\s*확실)")
_DENIAL_RE = re.compile(
    r"(?:단정(?:할|하)\s*수\s*없|보장(?:할|하)\s*수\s*없|확정(?:할|하)\s*수\s*없|"
    r"예측(?:할|하)\s*수\s*없|의미하지\s*않|보장하지\s*않|단정하지\s*않)"
)
_GOOD_BAD_RE = re.compile(r"(?:대길|대흉|길흉\s*점수|길운\s*확정|흉운\s*확정|길하다|흉하다)")


def thai_output_guard_required(compact_calculation: Any) -> bool:
    if not isinstance(compact_calculation, dict):
        return False
    thai = compact_calculation.get("thai")
    if not isinstance(thai, dict):
        return False
    suri = thai.get("suriyayat")
    if not isinstance(suri, dict):
        return False
    packet = suri.get("ai_safe_descriptive_packet")
    return bool(
        isinstance(packet, dict)
        and packet.get("mode") == "descriptive_nonpredictive"
        and int(packet.get("route_count") or 0) == 12
        and isinstance(packet.get("routes"), list)
        and len(packet.get("routes") or []) == 12
    )


def _iter_text(value: Any, path: tuple[str, ...] = ()) -> Iterable[tuple[tuple[str, ...], str]]:
    if isinstance(value, str):
        yield path, value
        return
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _iter_text(item, path + (str(key),))
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            yield from _iter_text(item, path + (str(index),))


def _is_thai_system_path(path: tuple[str, ...]) -> bool:
    return len(path) >= 2 and path[0] == "systems" and path[1] == "thai"


def _has_denial(text: str) -> bool:
    return bool(_DENIAL_RE.search(text))


def _violation(code: str, path: tuple[str, ...], text: str) -> dict[str, str]:
    compact = " ".join(text.strip().split())
    return {"code": code, "path": ".".join(path), "snippet": compact[:180]}


def inspect_thai_output_safety(output: Any, *, thai_packet_present: bool) -> dict[str, Any]:
    """Return deterministic violations for a validated Gemini output object."""
    if not thai_packet_present:
        return {"safe": True, "violations": [], "guard_engine": ENGINE_VERSION}
    if not isinstance(output, dict):
        return {
            "safe": False,
            "violations": [{"code": "invalid_output", "path": "", "snippet": "output is not an object"}],
            "guard_engine": ENGINE_VERSION,
        }

    violations: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for path, raw_text in _iter_text(output):
        text = raw_text.strip()
        if not text:
            continue
        thai_context = _is_thai_system_path(path) or bool(_THAI_MARKER_RE.search(text))

        def add(code: str) -> None:
            key = (code, ".".join(path))
            if key not in seen:
                seen.add(key)
                violations.append(_violation(code, path, text))

        # Probability conversion and deterministic future-event claims are
        # forbidden globally once the promoted Thai packet participates in the
        # interpretation. This prevents cross-section laundering of Thai claims.
        if _PERCENT_RE.search(text) or _NUMERIC_PROBABILITY_RE.search(text):
            add("numeric_probability")
        if _EVENT_ASSERTION_RE.search(text) and not _has_denial(text):
            add("deterministic_event")
        if _CERTAINTY_RE.search(text) and _EVENT_ASSERTION_RE.search(text) and not _has_denial(text):
            add("certainty_event")

        # Exact timing and final status/score rules are specifically blocked for
        # promoted Lagna/Suriyayat descriptive context. Broad period language is
        # intentionally allowed; only fabricated exact day/time is rejected.
        if thai_context and (_EXACT_DATE_RE.search(text) or _EXACT_TIME_RE.search(text)):
            add("thai_exact_timing")
        if thai_context and _THAI_SCORE_RE.search(text):
            add("thai_score")
        if thai_context and _GOOD_BAD_RE.search(text):
            add("thai_final_good_bad")

    return {"safe": not violations, "violations": violations, "guard_engine": ENGINE_VERSION}


def strict_thai_retry_instruction(violations: Any = None) -> str:
    codes: list[str] = []
    if isinstance(violations, list):
        for item in violations:
            if isinstance(item, dict) and item.get("code"):
                codes.append(str(item["code"]))
    suffix = f" 감지된 위반: {', '.join(sorted(set(codes)))}." if codes else ""
    return (
        "\n\n[THAI OUTPUT SAFETY RETRY]\n"
        "이 재시도에서는 Thai/Lagna/Suriyayat의 promoted descriptive packet을 오직 비예측형 맥락 설명에만 써. "
        "퍼센트·확률·점수로 바꾸지 말고, 연락/재회/합격/수익 등 사건이 일어난다고 단정하지 말고, "
        "Lagna/Suriyayat 근거로 정확한 날짜·시각을 만들지 말고, 대길/대흉 같은 최종 길흉판정을 만들지 마. "
        "해당 규칙을 지킬 수 없으면 systems.thai를 빈 문자열로 두고 다른 계산 시스템만 설명해."
        + suffix
    )


def _split_sentences(text: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?。！？])\s+|\n+", text.strip())
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def _sentence_must_be_removed(text: str) -> bool:
    if _THAI_MARKER_RE.search(text):
        return True
    if _PERCENT_RE.search(text) or _NUMERIC_PROBABILITY_RE.search(text):
        return True
    if _EVENT_ASSERTION_RE.search(text) and not _has_denial(text):
        return True
    return False


def build_thai_output_fallback(output: Any) -> dict[str, Any] | None:
    """Preserve non-Thai explanation while removing unsafe Thai-derived text.

    This is used only after one strict retry also fails.  It never fabricates a
    replacement Thai reading: the Thai section is blanked and Thai-attributed or
    globally prohibited predictive sentences are removed from the remaining
    text fields.
    """
    if not isinstance(output, dict):
        return None
    cleaned = copy.deepcopy(output)

    def scrub(value: Any, path: tuple[str, ...] = ()) -> Any:
        if isinstance(value, str):
            if _is_thai_system_path(path):
                return ""
            kept = [sentence for sentence in _split_sentences(value) if not _sentence_must_be_removed(sentence)]
            return " ".join(kept).strip()
        if isinstance(value, dict):
            return {key: scrub(item, path + (str(key),)) for key, item in value.items()}
        if isinstance(value, list):
            return [scrub(item, path + (str(index),)) for index, item in enumerate(value)]
        return value

    cleaned = scrub(cleaned)
    systems = cleaned.get("systems") if isinstance(cleaned.get("systems"), dict) else {}
    systems["thai"] = ""
    cleaned["systems"] = systems
    limits = str(cleaned.get("limits") or "").strip()
    cleaned["limits"] = f"{limits} {FALLBACK_NOTE}".strip()
    return cleaned
