from horary_prashna_router_v1 import (
    ROUTER_VERSION,
    build_classifier_system_prompt,
    classifier_contract,
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
