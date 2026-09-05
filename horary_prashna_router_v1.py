from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


ROUTER_VERSION = "horary-prashna-question-router-v1"
CLASSIFIER_VERSION = "horary-prashna-deterministic-classifier-v1"
DATA_PATH = Path(__file__).resolve().parent / "data" / "horary_prashna_question_router_v1.json"


@lru_cache(maxsize=1)
def load_router_spec() -> dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        spec = json.load(f)
    validate_router_spec(spec)
    return spec


def validate_router_spec(spec: dict[str, Any]) -> None:
    if spec.get("version") != ROUTER_VERSION:
        raise ValueError(f"unexpected router version: {spec.get('version')!r}")

    contract = spec.get("classifier_contract") or {}
    primary_types = set(contract.get("primary_types") or [])
    allowed_intents = set(contract.get("intents") or [])
    policies = spec.get("policies") or {}
    examples = spec.get("examples") or []

    if len(examples) != 50:
        raise ValueError(f"router seed must contain exactly 50 examples, got {len(examples)}")
    if len(primary_types) < 10:
        raise ValueError("primary type taxonomy is unexpectedly small")
    if not policies:
        raise ValueError("router policies are missing")

    seen_ids: set[str] = set()
    represented_types: set[str] = set()
    for row in examples:
        row_id = str(row.get("id") or "")
        if not row_id or row_id in seen_ids:
            raise ValueError(f"duplicate or missing example id: {row_id!r}")
        seen_ids.add(row_id)

        primary = row.get("primary_type")
        if primary not in primary_types:
            raise ValueError(f"{row_id}: unknown primary type {primary!r}")
        represented_types.add(primary)

        policy_id = row.get("policy_id")
        if policy_id not in policies:
            raise ValueError(f"{row_id}: unknown policy id {policy_id!r}")

        intents = row.get("intents") or []
        unknown_intents = [intent for intent in intents if intent not in allowed_intents]
        if unknown_intents:
            raise ValueError(f"{row_id}: unknown intents {unknown_intents!r}")

        option_count = int(row.get("option_count") or 0)
        if option_count >= 2 and "OPTION_RANKING" not in intents:
            raise ValueError(f"{row_id}: multi-option question must include OPTION_RANKING")

        if not str(row.get("question") or "").strip():
            raise ValueError(f"{row_id}: question text is empty")

    if represented_types != primary_types:
        missing = sorted(primary_types - represented_types)
        raise ValueError(f"primary types without seed examples: {missing}")


def get_policy(policy_id: str) -> dict[str, Any]:
    spec = load_router_spec()
    try:
        return spec["policies"][policy_id]
    except KeyError as exc:
        raise KeyError(f"unknown Horary/Prashna routing policy: {policy_id}") from exc


def seed_examples(primary_type: str | None = None) -> list[dict[str, Any]]:
    rows = list(load_router_spec()["examples"])
    if primary_type is None:
        return rows
    return [row for row in rows if row["primary_type"] == primary_type]


def classifier_contract() -> dict[str, Any]:
    return dict(load_router_spec()["classifier_contract"])


def compact_few_shot_rows(primary_types: list[str] | None = None) -> list[dict[str, Any]]:
    """Return only fields needed by an LLM question classifier, never chart-judgement prose."""
    wanted = set(primary_types or [])
    rows = seed_examples()
    if wanted:
        rows = [row for row in rows if row["primary_type"] in wanted]
    return [
        {
            "question": row["question"],
            "primary_type": row["primary_type"],
            "intents": row["intents"],
            "policy_id": row["policy_id"],
            "option_count": row["option_count"],
        }
        for row in rows
    ]


def build_classifier_system_prompt(primary_types: list[str] | None = None) -> str:
    """Build the classification-only prompt contract used before Horary/Prashna calculation."""
    spec = load_router_spec()
    contract = spec["classifier_contract"]
    examples = compact_few_shot_rows(primary_types)
    return (
        "너는 별빛의 운명 Horary+Prashna 질문 라우터다. 차트를 해석하거나 답을 예측하지 마. "
        "사용자 질문을 계산 규칙으로 보내기 위해 구조화만 한다. "
        "질문의 도메인(primary_type), 복수 의도(intents), policy_id, 대상, 상대방, 선택지를 추출한다. "
        "선택지가 2개 이상이면 OPTION_RANKING을 포함하고 원문 순서를 유지한다. "
        "하우스가 달라질 정도로 대상이 모호하면 needs_clarification=true로 하고 질문은 한 번만 짧게 한다. "
        "건강·법률·금융·제3자 사생활 질문도 분류는 하되 사실 단정이나 전문적 결정을 만들지 않는다. "
        "반환은 JSON 객체 하나만 사용한다.\n\n"
        f"허용 primary_type={json.dumps(contract['primary_types'], ensure_ascii=False)}\n"
        f"허용 intents={json.dumps(contract['intents'], ensure_ascii=False)}\n"
        f"필수 필드={json.dumps(contract['required_output_fields'], ensure_ascii=False)}\n\n"
        "few-shot examples=\n"
        f"{json.dumps(examples, ensure_ascii=False, separators=(',', ':'))}"
    )


# The deterministic baseline handles common Korean questions at zero model cost.  A later
# LLM fallback may be used only for low-confidence cases; it must keep the same contract.
_DOMAIN_HINTS: dict[str, dict[str, float]] = {
    "LOST_ITEM": {
        "잃어버": 4.0, "분실": 4.0, "없어진": 3.2, "찾을": 2.5, "찾게": 2.5,
        "어디에": 1.0, "어디 있": 1.8, "위치": 1.2, "수납": 1.5, "지갑": 2.0,
        "열쇠": 2.0, "차 키": 2.0, "이어폰": 2.0, "카메라": 1.7, "반지": 1.7,
        "내 물건": 1.8, "잘못 둔": 2.3, "가져간": 1.7,
    },
    "RELATIONSHIP": {
        "재회": 4.0, "헤어진": 3.5, "연애": 3.0, "사귀": 3.2, "우리 관계": 3.0,
        "이 관계": 2.5, "상대가": 1.5, "상대방": 1.5, "만나고 있는 사람": 2.5,
        "과거 인연": 3.0, "제3자": 2.0, "다른 연애": 2.5,
    },
    "CAREER": {
        "이직": 4.0, "취업": 4.0, "직장": 3.2, "회사": 1.7, "승진": 4.0,
        "직위": 3.0, "오퍼": 3.5, "채용": 3.5, "면접": 1.8,
    },
    "EXAM_EDUCATION": {
        "시험": 4.0, "합격": 4.0, "불합격": 4.0, "공부": 3.0, "필기": 2.2,
        "재응시": 3.5, "교육": 2.0, "학교": 2.0, "수험": 3.0,
    },
    "MONEY": {
        "빌려준 돈": 4.0, "대출": 4.0, "환불": 3.5, "정산금": 3.5, "입금": 3.0,
        "보유 자산": 3.0, "돈을": 2.5, "대금": 3.0, "수익": 1.2,
    },
    "BUSINESS_CONTRACT": {
        "계약서": 4.0, "계약": 3.5, "서명": 4.0, "사업": 3.2, "파트너십": 3.5,
        "재협상": 3.5, "협상": 2.6, "구매자": 2.8, "거래": 2.2,
    },
    "PROPERTY_MOVE": {
        "이사": 4.0, "전세": 4.0, "보증금": 3.2, "부동산": 4.0, "아파트": 3.0,
        "거주지": 3.0, "집을 계약": 3.0, "집을 매수": 3.0, "A집": 2.4, "B집": 2.4,
    },
    "TRAVEL_FOREIGN": {
        "여행": 4.0, "해외": 3.5, "출국": 3.5, "귀국": 3.0, "비행": 2.0,
        "장기 이동": 1.8,
    },
    "HEALTH": {
        "건강": 4.0, "컨디션": 3.5, "피로": 3.5, "회복": 2.5, "아프": 3.0,
        "병원": 2.5, "증상": 3.0,
    },
    "LEGAL_CONFLICT": {
        "소송": 4.0, "분쟁": 4.0, "합의": 3.5, "중재": 3.5, "법원": 4.0,
        "고소": 4.0, "법적": 3.5, "갈등": 1.8,
    },
    "FAMILY_CHILDREN": {
        "가족": 4.0, "아이": 3.5, "자녀": 4.0, "부모": 3.0, "형제": 3.0,
        "자매": 3.0,
    },
    "COMMUNICATION_NEWS": {
        "답장": 4.0, "회신": 4.0, "심사 결과": 3.5, "공식 소식": 3.5,
        "소식": 2.8, "연락": 1.3, "결과가 도착": 3.0,
    },
    "GENERAL_EVENT": {},
}

_POLICY_BY_PRIMARY = {
    "LOST_ITEM": "H_LOST_ITEM",
    "RELATIONSHIP": "H_RELATIONSHIP",
    "CAREER": "H_CAREER",
    "EXAM_EDUCATION": "H_EXAM",
    "MONEY": "H_MONEY",
    "BUSINESS_CONTRACT": "H_BUSINESS_CONTRACT",
    "PROPERTY_MOVE": "H_PROPERTY_MOVE",
    "TRAVEL_FOREIGN": "H_TRAVEL",
    "HEALTH": "H_HEALTH",
    "LEGAL_CONFLICT": "H_LEGAL",
    "FAMILY_CHILDREN": "H_FAMILY",
    "COMMUNICATION_NEWS": "H_COMMUNICATION",
    "GENERAL_EVENT": "H_GENERAL",
}

_INTENT_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("LOCATION", ("어디", "위치", "장소", "수납", "집 안")),
    ("RECOVERY", ("찾을", "찾게", "돌려받", "회복")),
    ("CONTACT", ("연락", "답장", "회신")),
    ("RECONCILIATION", ("재회", "다시 관계", "다시 만나", "헤어진")),
    ("COMMITMENT", ("관계를 명확", "관계 정의", "사귀", "결혼", "약혼")),
    ("ACTION_ADVICE", ("게 나을까", "것이 나을까", "하는 게 좋을까", "하는 것이 좋을까", "선택", "실행하는 게", "기다리는 게")),
    ("OUTCOME", ("결과", "이어질", "지속될", "정리될", "안정되", "성사될", "될 흐름")),
    ("CAUSE", ("왜", "원인", "누가 옮긴", "잘못 둔", "정황")),
    ("THIRD_PARTY_SYMBOLISM", ("제3자", "다른 연애", "다른 사람")),
    ("THEFT_SYMBOLISM", ("도난", "가져간", "훔")),
    ("JOB_OFFER", ("오퍼", "채용")),
    ("PROMOTION", ("승진", "직위 상승")),
    ("PASS_FAIL", ("합격", "불합격", "시험")),
    ("PURCHASE_SALE", ("매수", "매도", "구매", "판매", "구매자")),
    ("SIGNING", ("서명",)),
    ("PAYMENT", ("입금", "환불", "정산", "보증금", "돌려받")),
    ("MOVE", ("이사", "거주지", "옮기는")),
    ("TRAVEL", ("여행", "출국", "해외로", "해외 이동")),
    ("CONFLICT_RESOLUTION", ("합의", "갈등", "분쟁", "중재", "해결")),
    ("NEWS_RESULT", ("소식", "회신", "심사 결과", "공식", "결과가 도착")),
    ("TIMING", ("언제", "시기", "몇 월", "이번 주", "이번 달", "다음 달", "올해 안", "3개월 안", "가까운 시기")),
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip()).lower()


def _char_ngrams(text: str, n: int = 3) -> set[str]:
    compact = re.sub(r"[^0-9a-z가-힣]", "", _normalize(text))
    if not compact:
        return set()
    if len(compact) <= n:
        return {compact}
    return {compact[i : i + n] for i in range(len(compact) - n + 1)}


def _similarity(a: str, b: str) -> float:
    left, right = _char_ngrams(a), _char_ngrams(b)
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _extract_options(question: str) -> list[str]:
    """Conservatively extract explicit alternatives while preserving source order."""
    text = re.sub(r"\s+", " ", question.strip())
    before_jung = re.split(r"\s+중(?:\s|에서|에|어느|어디|어떤)", text, maxsplit=1)[0]
    if "/" in before_jung:
        pieces = [part.strip(" ,:·") for part in before_jung.split("/")]
        if len(pieces) >= 2:
            # The first slash option often carries an introductory clause.  Keep the text
            # after the last comma/colon, which preserves the user's option wording.
            first = re.split(r"[,：:]", pieces[0])[-1].strip()
            pieces[0] = first or pieces[0]
            cleaned = [re.sub(r"^(?:그리고|또는|혹은)\s*", "", part).strip() for part in pieces]
            return [part for part in cleaned if 1 <= len(part) <= 80]

    match = re.search(r"([^?。.!]{1,55}?)\s*(?:와|과)\s*([^?。.!]{1,55}?)\s+중", text)
    if match:
        left = re.split(r"[,：:]", match.group(1))[-1].strip()
        right = match.group(2).strip()
        if left and right:
            return [left, right]

    # Common Korean comparison construction: "A하는 것과 B하는 것 중".
    match = re.search(r"([^?。.!]{2,70}?)\s*것과\s*([^?。.!]{2,70}?)\s*것\s+중", text)
    if match:
        return [match.group(1).strip() + " 것", match.group(2).strip() + " 것"]
    return []


def _has_option_language(question: str, options: list[str]) -> bool:
    text = _normalize(question)
    return len(options) >= 2 or "/" in text or bool(re.search(r"(?:와|과).{1,50}\s중", text)) or "중 어느" in text or "중 어디" in text


def _extract_subject(question: str, primary_type: str) -> str | None:
    text = question.strip()
    if primary_type == "LOST_ITEM":
        patterns = [
            r"(?:현재\s+)?([A-Za-z0-9가-힣_-]{1,30})(?:가|이)\s+집\s*안",
            r"(?:잃어버린|없어진)\s+([A-Za-z0-9가-힣_-]{1,30})",
            r"([A-Za-z0-9가-힣_-]{1,30})(?:을|를)\s+(?:다시\s+)?찾",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
    return None


def _extract_counterparty(question: str, primary_type: str) -> str | None:
    if primary_type != "RELATIONSHIP":
        return None
    match = re.search(r"\b([A-Z])(?:가|와|와의|에게|한테)\b", question)
    if match:
        return match.group(1)
    return "특정 상대" if any(token in question for token in ("상대", "헤어진 사람", "만나고 있는 사람")) else None


def classify_question(question: str) -> dict[str, Any]:
    """Zero-cost Korean routing baseline; this never performs astrological judgement."""
    raw = str(question or "").strip()
    if len(raw) < 2:
        raise ValueError("question is too short")
    text = _normalize(raw)

    scores = {primary: 0.0 for primary in _POLICY_BY_PRIMARY}
    keyword_hits: dict[str, list[str]] = {primary: [] for primary in scores}
    for primary, hints in _DOMAIN_HINTS.items():
        for hint, weight in hints.items():
            if _normalize(hint) in text:
                scores[primary] += weight
                keyword_hits[primary].append(hint)

    seed_ranked: list[tuple[float, dict[str, Any]]] = []
    domain_seed_best = {primary: 0.0 for primary in scores}
    for row in seed_examples():
        sim = _similarity(raw, row["question"])
        seed_ranked.append((sim, row))
        domain_seed_best[row["primary_type"]] = max(domain_seed_best[row["primary_type"]], sim)
    seed_ranked.sort(key=lambda item: item[0], reverse=True)
    for primary, sim in domain_seed_best.items():
        scores[primary] += sim * 5.0

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_primary, best_score = ranked[0]
    second_score = ranked[1][1]
    top_seed_similarity = seed_ranked[0][0] if seed_ranked else 0.0

    if best_score < 1.5:
        best_primary = "GENERAL_EVENT"
        confidence = max(0.38, min(0.54, 0.4 + top_seed_similarity * 0.4))
    else:
        margin = max(0.0, best_score - second_score)
        confidence = 0.58 + min(0.20, best_score * 0.025) + min(0.10, margin * 0.025) + min(0.10, top_seed_similarity * 0.12)
        confidence = round(min(0.98, confidence), 3)

    options = _extract_options(raw)
    intents: list[str] = []
    for intent, patterns in _INTENT_PATTERNS:
        if any(_normalize(pattern) in text for pattern in patterns):
            intents.append(intent)
    if _has_option_language(raw, options) and "OPTION_RANKING" not in intents:
        intents.append("OPTION_RANKING")

    # A question mark/possibility construction is useful only as a secondary intent;
    # domain-specific intents remain separate.
    yes_no_markers = ("될까", "할까", "있는가", "있을까", "가능", "성사될까", "이어질까", "올까", "받을까", "받을 수")
    if ("?" in raw or any(marker in text for marker in yes_no_markers)) and "YES_NO" not in intents:
        intents.append("YES_NO")

    allowed_order = classifier_contract()["intents"]
    intents = [intent for intent in allowed_order if intent in set(intents)]
    if not intents:
        intents = ["OUTCOME"] if best_primary != "GENERAL_EVENT" else ["YES_NO"]

    policy_id = _POLICY_BY_PRIMARY[best_primary]
    policy = get_policy(policy_id)
    needs_clarification = bool(best_primary == "GENERAL_EVENT" and confidence < 0.55)
    clarification_question = "무엇에 관한 질문인지 대상이나 상황을 한 가지만 더 구체적으로 적어줘." if needs_clarification else ""

    matched_examples = [
        {
            "id": row["id"],
            "primary_type": row["primary_type"],
            "similarity": round(sim, 3),
        }
        for sim, row in seed_ranked[:3]
        if sim > 0
    ]
    return {
        "router_version": ROUTER_VERSION,
        "classifier_version": CLASSIFIER_VERSION,
        "primary_type": best_primary,
        "intents": intents,
        "policy_id": policy_id,
        "subject": _extract_subject(raw, best_primary),
        "counterparty": _extract_counterparty(raw, best_primary),
        "options": options,
        "confidence": confidence,
        "needs_clarification": needs_clarification,
        "clarification_question": clarification_question,
        "risk_profile": policy.get("safety", "standard"),
        "matched_examples": matched_examples,
        "routing_debug": {
            "keyword_hits": keyword_hits[best_primary],
            "top_score": round(best_score, 3),
            "score_margin": round(max(0.0, best_score - second_score), 3),
        },
    }
