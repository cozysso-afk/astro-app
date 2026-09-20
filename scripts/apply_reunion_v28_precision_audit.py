from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "reunion_hierarchy_v2.py"
TESTS = ROOT / "tests" / "test_reunion_hierarchy_v2.py"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


engine = ENGINE.read_text()
engine = replace_once(
    engine,
    "VERSION = 'reunion-hierarchy-v2.5-iana-timezone-provenance'",
    "VERSION = 'reunion-hierarchy-v2.8-birth-time-precision-audit'",
    "version",
)
engine = replace_once(
    engine,
    """            for hit in hits:\n                hit['return_type'] = key\n                hit['mid_gate'] = key in MID_GATE_RETURN_KEYS\n            rows.extend(hits)\n""",
    """            for hit in hits:\n                hit['return_type'] = key\n                hit['mid_gate'] = key in MID_GATE_RETURN_KEYS\n                hit['return_precision'] = e.get('precision') or 'unknown'\n                hit['return_side'] = side\n            rows.extend(hits)\n""",
    "return hit precision",
)
engine = replace_once(
    engine,
    """                        'return_type': key,\n                        'mid_gate': key in MID_GATE_RETURN_KEYS,\n                        'house_system': 'Whole Sign',\n""",
    """                        'return_type': key,\n                        'mid_gate': key in MID_GATE_RETURN_KEYS,\n                        'return_precision': e.get('precision') or 'unknown',\n                        'return_side': side,\n                        'house_system': 'Whole Sign',\n""",
    "return house precision",
)
engine = replace_once(
    engine,
    """def _mid_gate_evidence(rows):\n    \"\"\"Only Lunar Return evidence opens the medium-term gate; other returns remain context.\"\"\"\n    return [row for row in rows if row.get('mid_gate') and row.get('return_type') in MID_GATE_RETURN_KEYS]\n\n\n""",
    """def _mid_gate_evidence(rows):\n    \"\"\"Only Lunar Return evidence opens the medium-term gate; other returns remain context.\"\"\"\n    return [row for row in rows if row.get('mid_gate') and row.get('return_type') in MID_GATE_RETURN_KEYS]\n\n\ndef _medium_precision_audit(rows):\n    \"\"\"Expose provisional-time dependency without changing gate scores or ranking.\"\"\"\n    gate_rows = _mid_gate_evidence(rows)\n    all_score, _ = _ranked_score(gate_rows)\n    exact_rows = [row for row in gate_rows if row.get('return_precision') == 'exact']\n    provisional_rows = [row for row in gate_rows if row.get('return_precision') == 'provisional']\n    unknown_rows = [\n        row for row in gate_rows\n        if row.get('return_precision') not in {'exact', 'provisional'}\n    ]\n    exact_score, _ = _ranked_score(exact_rows)\n    threshold = THRESHOLDS['mid_term']\n    if unknown_rows:\n        status = 'unknown_precision_present'\n    elif provisional_rows and all_score >= threshold and exact_score < threshold:\n        status = 'gate_depends_on_provisional'\n    elif provisional_rows and exact_score >= threshold:\n        status = 'provisional_contributes_but_exact_gate_passes'\n    elif gate_rows:\n        status = 'exact_only'\n    else:\n        status = 'no_lunar_anchor'\n    return {\n        'status': status,\n        'all_score': all_score,\n        'exact_only_score': exact_score,\n        'gate_pass': all_score >= threshold,\n        'exact_only_gate_pass': exact_score >= threshold,\n        'exact_evidence_count': len(exact_rows),\n        'provisional_evidence_count': len(provisional_rows),\n        'unknown_precision_evidence_count': len(unknown_rows),\n        'policy': 'audit_only; provisional evidence is not reweighted or suppressed in v2.8',\n    }\n\n\n""",
    "medium precision helper",
)
engine = replace_once(
    engine,
    """            mid_score, mid_rows = _ranked_score(_mid_gate_evidence(mid_context_rows))\n            mid_context_score, mid_context_ranked = _ranked_score(mid_context_rows)\n""",
    """            mid_score, mid_rows = _ranked_score(_mid_gate_evidence(mid_context_rows))\n            mid_context_score, mid_context_ranked = _ranked_score(mid_context_rows)\n            medium_precision_audit = _medium_precision_audit(mid_context_rows)\n""",
    "medium precision evaluation",
)
engine = replace_once(
    engine,
    """                'mid_evidence': mid_rows[:4],\n                'mid_context_evidence': mid_context_ranked[:4],\n""",
    """                'mid_evidence': mid_rows[:4],\n                'mid_context_evidence': mid_context_ranked[:4],\n                'medium_precision_audit': medium_precision_audit,\n""",
    "daily trace precision audit",
)
engine = replace_once(
    engine,
    """                'mid_evidence': peak['mid_evidence'],\n                'independent_systems': peak['components']['independent_systems'],\n""",
    """                'mid_evidence': peak['mid_evidence'],\n                'medium_precision_audit': peak.get('medium_precision_audit'),\n                'independent_systems': peak['components']['independent_systems'],\n""",
    "group window precision audit",
)
engine = replace_once(
    engine,
    """            'mid_evidence': r['mid_evidence'],\n            'independent_systems': r['components']['independent_systems'],\n""",
    """            'mid_evidence': r['mid_evidence'],\n            'medium_precision_audit': r.get('medium_precision_audit'),\n            'independent_systems': r['components']['independent_systems'],\n""",
    "peak window precision audit",
)
engine = replace_once(
    engine,
    """            'medium_gate_return': 'lunar_return',\n            'gate_evaluation': 'sequential: medium only after long; fast only after medium; skipped scores are zero, not measured counterfactuals',\n""",
    """            'medium_gate_return': 'lunar_return',\n            'birth_time_precision_policy': 'provisional Lunar Return remains calculable; each candidate reports exact-only gate counterfactual without reweighting or suppressing evidence',\n            'gate_evaluation': 'sequential: medium only after long; fast only after medium; skipped scores are zero, not measured counterfactuals',\n""",
    "selection policy precision",
)
engine = replace_once(
    engine,
    """            '중기 관문은 월 단위 Lunar Return을 필수 앵커로 사용하며 다른 행성 회귀는 단계별 배경 문맥으로만 유지',\n""",
    """            '중기 관문은 월 단위 Lunar Return을 필수 앵커로 사용하며 다른 행성 회귀는 단계별 배경 문맥으로만 유지',\n            '추정 출생시간의 Lunar Return은 provisional 근거로 계산하되 public candidate에 exact-only gate 비교를 함께 기록하며 v2.8에서는 임의 감점하지 않음',\n""",
    "precision limitation",
)
ENGINE.write_text(engine)

tests = TESTS.read_text()
marker = "def test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
if marker in tests:
    raise RuntimeError("v2.8 tests already present")
tests += r'''\n\ndef test_medium_precision_audit_flags_provisional_dependency_without_reweighting():
    rows = [
        {'return_type':'lunar_return','mid_gate':True,'event_id':'p','strength':40,'return_precision':'provisional'},
        {'return_type':'lunar_return','mid_gate':True,'event_id':'e','strength':20,'return_precision':'exact'},
    ]
    audit = h._medium_precision_audit(rows)
    assert audit['all_score'] == h._ranked_score(h._mid_gate_evidence(rows))[0] == 45.0
    assert audit['exact_only_score'] == 20.0
    assert audit['gate_pass'] is True and audit['exact_only_gate_pass'] is False
    assert audit['status'] == 'gate_depends_on_provisional'


def test_medium_precision_audit_does_not_downgrade_exact_gate():
    rows = [
        {'return_type':'lunar_return','mid_gate':True,'event_id':'e','strength':40,'return_precision':'exact'},
        {'return_type':'lunar_return','mid_gate':True,'event_id':'p','strength':20,'return_precision':'provisional'},
    ]
    audit = h._medium_precision_audit(rows)
    assert audit['gate_pass'] is True and audit['exact_only_gate_pass'] is True
    assert audit['status'] == 'provisional_contributes_but_exact_gate_passes'


def test_return_evidence_preserves_provisional_lunar_precision():
    event = {
        'exact_utc':'2026-01-01T00:00:00+00:00',
        'next_exact_utc':'2026-02-01T00:00:00+00:00',
        'precision':'provisional',
        'positions':{'Mercury':10.0},
        'angles':{},
        'house_activations':[],
    }
    support = {'lunar_return':{'user':{'events':[event]},'counterpart':{'events':[]}}}
    natal = {'user':{'Moon':10.0},'counterpart':{'Moon':20.0}}
    rows, active = h._return_evidence(
        support, datetime(2026,1,15,tzinfo=timezone.utc), 'contact_recontact', natal
    )
    lunar = [row for row in rows if row.get('return_type') == 'lunar_return']
    assert lunar and all(row['return_precision'] == 'provisional' for row in lunar)
    assert all(row['return_side'] == 'user' for row in lunar)
    assert active and active[0][0] == 'lunar_return'
'''
TESTS.write_text(tests)
print("v2.8 precision audit patch applied")
