from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor missing in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "relationship_western_v1.py",
    "from reunion_dimension_v1 import DIMENSIONS, FAST_TRIGGER_PLANETS, daily_dimension_scores, secondary_support\n",
    "from reunion_dimension_v1 import DIMENSIONS, FAST_TRIGGER_PLANETS, daily_dimension_scores, secondary_support\nfrom relationship_evidence_contract_v1 import build_reunion_evidence_contract\n",
)
replace_once(
    "relationship_western_v1.py",
    'ENGINE_VERSION = "relationship-western-v1.13-four-stage-gated-dates"',
    'ENGINE_VERSION = "relationship-western-v1.14-reunion-evidence-contract"',
)
replace_once(
    "relationship_western_v1.py",
    '''            row["progressed_synastry"] = {"available": True, "precision": progressed_precision, **ps}\n            layer_aspects.update({f"progressed_synastry.{k}": v for k, v in ps.items()})\n\n            prog_comp = _midpoint_chart(up, cp)''',
    '''            row["progressed_synastry"] = {"available": True, "precision": progressed_precision, **ps}\n            row["progressed_house_overlays"] = {\n                "available": bool(user_clock_ready and cp_clock_ready),\n                "precision": progressed_precision if user_clock_ready and cp_clock_ready else "unavailable",\n                "user_progressed_in_counterpart": _house_overlays(up, cp_natal, "user_progressed", "counterpart") if cp_clock_ready else {"available": False, "reason": "counterpart entered birth time/place required"},\n                "counterpart_progressed_in_user": _house_overlays(cp, user_natal, "counterpart_progressed", "user") if user_clock_ready else {"available": False, "reason": "user entered birth time/place required"},\n                "policy": "Progressed planets are placed into the other person's natal Whole Sign + quadrant houses. House labels inherit the target person's birth-time precision and are provisional unless provenance-verified exact.",\n            }\n            layer_aspects.update({f"progressed_synastry.{k}": v for k, v in ps.items()})\n\n            prog_comp = _midpoint_chart(up, cp)''',
)
replace_once(
    "relationship_western_v1.py",
    '''            row["progressed_synastry"] = {"available": False, "reason": "A concrete birth time is required for both people; unknown-time noon proxies are not used for progressed synastry."}\n            row["progressed_composite"] = {"available": False, "reason": "A concrete birth time is required for both people; unknown-time noon proxies are not used for progressed composite."}''',
    '''            row["progressed_synastry"] = {"available": False, "reason": "A concrete birth time is required for both people; unknown-time noon proxies are not used for progressed synastry."}\n            row["progressed_house_overlays"] = {"available": False, "reason": "Progressed house overlays require concrete entered birth times and coordinates."}\n            row["progressed_composite"] = {"available": False, "reason": "A concrete birth time is required for both people; unknown-time noon proxies are not used for progressed composite."}''',
)
replace_once(
    "relationship_western_v1.py",
    '''    result["months"] = monthly\n    if analysis_mode == "reunion":\n        result["reunion_secondary_support"] = {''',
    '''    result["months"] = monthly\n    if analysis_mode == "reunion":\n        result["reunion_evidence_contract"] = build_reunion_evidence_contract(monthly)\n        result["reunion_secondary_support"] = {''',
)
replace_once(
    "relationship_western_v1.py",
    '''        "reunion_dates": "Secondary progression is period context. Exact dates require fast Sun/Mercury/Venus/Mars transit evidence. Planetary return is deduplicated from the same transit phenomenon and cannot add an independent convergence vote.",''',
    '''        "reunion_dates": "Secondary progression is period context. Exact dates require fast Sun/Mercury/Venus/Mars transit evidence. Planetary return is deduplicated from the same transit phenomenon and cannot add an independent convergence vote.",\n        "reunion_evidence_contract": "Progressed synastry is kept directional (user→counterpart, counterpart→user, progressed↔progressed) and progressed composite is relationship-level. Monthly orb trend may label applying/separating, but unresolved exact dates remain null; progressed house overlays inherit birth-time precision.",''',
)

replace_once(
    "web/src/appTypes.ts",
    '''  event_probability?: string | null\n}''',
    '''  event_probability?: string | null\n  direction?: 'user_to_counterpart' | 'counterpart_to_user' | 'shared' | 'relationship_itself' | string\n  phase?: 'applying' | 'separating' | 'exact' | 'indeterminate' | string\n  phase_basis?: string | null\n  exact_at?: string | null\n  exact_at_basis?: string | null\n  reference_date?: string | null\n  source_path?: string | null\n  relationship_domains?: string[]\n  stage_hints?: string[]\n  target_house?: { whole_house?: number | null; quadrant_house?: number | null; quadrant_system?: string | null } | null\n}''',
)
replace_once(
    "web/src/appTypes.ts",
    '''    reunion_hierarchy?: Record<string, unknown>\n    reunion_return_support?: Record<string, unknown>''',
    '''    reunion_hierarchy?: Record<string, unknown>\n    reunion_evidence_contract?: { version?: string; available?: boolean; evidence?: Aspect[]; policy?: Record<string, string> }\n    reunion_return_support?: Record<string, unknown>''',
)

replace_once(
    "web/src/lib/resultFormatters.ts",
    '''    event_probability:row.event_probability ?? 'not_calculated',\n  }''',
    '''    event_probability:row.event_probability ?? 'not_calculated',\n    direction:row.direction ?? undefined, phase:row.phase ?? undefined, phase_basis:row.phase_basis ?? undefined,\n    exact_at:row.exact_at ?? null, exact_at_basis:row.exact_at_basis ?? undefined, reference_date:row.reference_date ?? undefined,\n    source_path:row.source_path ?? undefined, relationship_domains:Array.isArray(row.relationship_domains)?row.relationship_domains.slice(0,4):undefined,\n    stage_hints:Array.isArray(row.stage_hints)?row.stage_hints.slice(0,4):undefined, target_house:row.target_house ?? undefined,\n  }''',
)
replace_once(
    "web/src/lib/resultFormatters.ts",
    '''    reunion_hierarchy: rawResult.reunion_hierarchy ? Object.fromEntries(Object.entries(rawResult.reunion_hierarchy as Record<string,unknown>).filter(([key])=>!['daily_trace','long_term_daily','saju_boundaries'].includes(key))) : null,\n    reunion_timing_windows: rawResult.reunion_timing_windows ?? null,''',
    '''    reunion_hierarchy: rawResult.reunion_hierarchy ? Object.fromEntries(Object.entries(rawResult.reunion_hierarchy as Record<string,unknown>).filter(([key])=>!['daily_trace','long_term_daily','saju_boundaries'].includes(key))) : null,\n    reunion_evidence_contract: rawResult.reunion_evidence_contract && typeof rawResult.reunion_evidence_contract === 'object' ? {\n      version:(rawResult.reunion_evidence_contract as Record<string,unknown>).version ?? null,\n      available:(rawResult.reunion_evidence_contract as Record<string,unknown>).available ?? false,\n      evidence:(Array.isArray((rawResult.reunion_evidence_contract as Record<string,unknown>).evidence) ? ((rawResult.reunion_evidence_contract as Record<string,unknown>).evidence as unknown[]) : []).slice(0,48).map(compactAspectForExternal).filter(Boolean),\n      policy:(rawResult.reunion_evidence_contract as Record<string,unknown>).policy ?? null,\n    } : null,\n    reunion_timing_windows: rawResult.reunion_timing_windows ?? null,''',
)

replace_once(
    "tests/test_relationship_midpoints_v8.py",
    '''    assert out["months"][0]["progressed_composite"]["available"] is True\n    assert out["months"][0]["marks_tertiary"]["available"] is True''',
    '''    assert out["months"][0]["progressed_composite"]["available"] is True\n    assert out["months"][0]["progressed_house_overlays"]["available"] is True\n    assert out["months"][0]["marks_tertiary"]["available"] is True\n\n\ndef test_reunion_build_emits_normalized_directional_evidence_contract():\n    user = _profile(\n        birth_date=date(1991, 3, 21), birth_time=dt_time(9, 30), utc_offset_hours=9,\n        latitude=37.5665, longitude=126.9780,\n    )\n    counterpart = _profile(\n        birth_date=date(1992, 2, 29), birth_time=dt_time(18, 20), utc_offset_hours=9,\n        latitude=37.5665, longitude=126.9780,\n    )\n    out = build_relationship_western(\n        user, counterpart,\n        [(date(2026, 9, 1), date(2026, 9, 30)), (date(2026, 10, 1), date(2026, 10, 31))],\n        analysis_mode="reunion",\n    )\n    contract = out["reunion_evidence_contract"]\n    assert contract["version"] == "reunion-evidence-contract-v1"\n    assert contract["available"] is True\n    assert contract["evidence"]\n    assert {row["direction"] for row in contract["evidence"]} & {"user_to_counterpart", "counterpart_to_user", "shared", "relationship_itself"}\n    assert all(row["phase"] in {"applying", "separating", "exact", "indeterminate"} for row in contract["evidence"])\n    assert all("relationship_domains" in row for row in contract["evidence"])\n    assert all(row.get("event_probability") == "not_calculated" for row in contract["evidence"])''',
)

print("reunion evidence contract patch applied")
