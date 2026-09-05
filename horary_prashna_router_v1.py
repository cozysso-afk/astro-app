from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


ROUTER_VERSION = "horary-prashna-question-router-v1"
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
