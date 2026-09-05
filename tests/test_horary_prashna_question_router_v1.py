from horary_prashna_router_v1 import (
    ROUTER_VERSION,
    build_classifier_system_prompt,
    classifier_contract,
    classify_question,
    get_policy,
    load_router_spec,
    seed_examples,
)


def test_router_seed_contract_has_exactly_50_examples_and_all_primary_types():
    spec = load_router_spec()
    assert spec["version"] == ROUTER_VERSION
    assert len(spec["examples"]) == 50
    expected = set(classifier_contract()["primary_types"])
    represented = {row["primary_type"] for row in spec["examples"]}
    assert represented == expected


def test_router_policy_references_and_multi_option_contract_are_valid():
    spec = load_router_spec()
    policies = spec["policies"]
    for row in spec["examples"]:
        assert row["policy_id"] in policies
        assert row["question"].strip()
        if row["option_count"] >= 2:
            assert "OPTION_RANKING" in row["intents"]


def test_lost_item_seed_includes_user_style_location_ranking_question():
    lost = seed_examples("LOST_ITEM")
    assert len(lost) == 8
    q1 = next(row for row in lost if row["id"] == "Q01")
    assert q1["policy_id"] == "H_LOST_ITEM"
    assert q1["option_count"] == 3
    assert q1["intents"] == ["LOCATION", "OPTION_RANKING"]
    assert "쿨픽스" in q1["question"]
    assert "전자기기" in q1["question"]


def test_sensitive_domains_have_explicit_non_factual_or_decision_support_scope():
    expected = {
        "H_RELATIONSHIP": "privacy_symbolic",
        "H_MONEY": "financial_decision_support_only",
        "H_BUSINESS_CONTRACT": "financial_legal_decision_support_only",
        "H_PROPERTY_MOVE": "financial_decision_support_only",
        "H_HEALTH": "medical_non_diagnostic",
        "H_LEGAL": "legal_decision_support_only",
    }
    for policy_id, safety in expected.items():
        assert get_policy(policy_id)["safety"] == safety


def test_western_and_prashna_policies_are_separate_for_every_domain():
    for policy in load_router_spec()["policies"].values():
        assert policy["western"]
        assert policy["prashna"]
        assert policy["default_outputs"]


def test_classifier_prompt_is_classification_only_and_contains_all_seed_examples():
    prompt = build_classifier_system_prompt()
    assert "차트를 해석하거나 답을 예측하지 마" in prompt
    assert "primary_type" in prompt
    assert "OPTION_RANKING" in prompt
    assert "Q01" not in prompt  # IDs are intentionally omitted from production few-shot prompt.
    for row in seed_examples():
        assert row["question"] in prompt


def test_domain_filtered_prompt_only_uses_requested_domain_examples():
    prompt = build_classifier_system_prompt(["LOST_ITEM"])
    assert "잃어버린 지갑" in prompt
    assert "이번 시험에 합격" not in prompt


def test_deterministic_classifier_routes_user_lost_item_question_and_preserves_option_order():
    result = classify_question(
        "현재 쿨픽스가 집 안에 있다면, 내 침실 수납 / 내 방 베란다 / 오래된 전자기기·서류·잡동사니 수납 중 어느 범주가 가장 강한가?"
    )
    assert result["primary_type"] == "LOST_ITEM"
    assert result["policy_id"] == "H_LOST_ITEM"
    assert "LOCATION" in result["intents"]
    assert "OPTION_RANKING" in result["intents"]
    assert result["subject"] == "쿨픽스"
    assert result["options"] == [
        "내 침실 수납",
        "내 방 베란다",
        "오래된 전자기기·서류·잡동사니 수납",
    ]
    assert result["confidence"] >= 0.8


def test_deterministic_classifier_handles_unseen_common_paraphrases():
    relationship = classify_question("헤어진 사람이 올해 안에 다시 연락한다면 언제쯤일까?")
    assert relationship["primary_type"] == "RELATIONSHIP"
    assert {"CONTACT", "RECONCILIATION", "TIMING"}.issubset(set(relationship["intents"]))

    career = classify_question("최종 면접 본 회사에서 채용 오퍼가 올까?")
    assert career["primary_type"] == "CAREER"
    assert "JOB_OFFER" in career["intents"]

    exam = classify_question("다음 국가시험에서 합격할 수 있을까?")
    assert exam["primary_type"] == "EXAM_EDUCATION"
    assert "PASS_FAIL" in exam["intents"]


def test_deterministic_classifier_marks_vague_general_question_for_one_clarification():
    result = classify_question("이거 잘 될까?")
    assert result["primary_type"] == "GENERAL_EVENT"
    assert result["needs_clarification"] is True
    assert result["clarification_question"]


def test_deterministic_classifier_keeps_sensitive_risk_profile_from_policy():
    health = classify_question("요즘 피로가 회복되는 시기는 언제일까?")
    assert health["primary_type"] == "HEALTH"
    assert health["risk_profile"] == "medical_non_diagnostic"

    legal = classify_question("진행 중인 소송이 합의로 끝날 가능성이 있을까?")
    assert legal["primary_type"] == "LEGAL_CONFLICT"
    assert legal["risk_profile"] == "legal_decision_support_only"
