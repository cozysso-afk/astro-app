from pathlib import Path
import sys

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
ENGINE = ROOT / 'reunion_hierarchy_v2.py'
TESTS = ROOT / 'tests/test_reunion_hierarchy_v2.py'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "VERSION = 'reunion-hierarchy-v2.2-selectivity-boundaries'",
    "VERSION = 'reunion-hierarchy-v2.3-medium-anchor'",
    'version',
)
engine = replace_once(
    engine,
    """PRIMARY_TRIGGER_BY_STAGE = {
    'emotional_reactivation': {'Venus', 'Moon'},
    'contact_recontact': {'Mercury'},
    'in_person_meeting': {'Mars'},
    'relationship_rebuilding': {'Venus', 'Sun'},
}
DISCLAIMER""",
    """PRIMARY_TRIGGER_BY_STAGE = {
    'emotional_reactivation': {'Venus', 'Moon'},
    'contact_recontact': {'Mercury'},
    'in_person_meeting': {'Mars'},
    'relationship_rebuilding': {'Venus', 'Sun'},
}
MID_GATE_RETURN_KEYS = {'lunar_return'}
MID_CONTEXT_RETURN_KEYS_BY_STAGE = {
    'emotional_reactivation': ('lunar_return', 'venus_return'),
    'contact_recontact': ('lunar_return', 'mercury_return'),
    'in_person_meeting': ('lunar_return', 'venus_return', 'mars_return'),
    'relationship_rebuilding': ('lunar_return', 'venus_return', 'solar_return'),
}
PRIMARY_TRIGGER_TARGETS_BY_STAGE = {
    'emotional_reactivation': {'Sun', 'Moon', 'Venus'},
    'contact_recontact': {'Sun', 'Moon', 'Mercury', 'Venus'},
    'in_person_meeting': {'Moon', 'Venus', 'Mars', 'ASC', 'DSC'},
    'relationship_rebuilding': {'Sun', 'Moon', 'Venus', 'DSC'},
}
PRIMARY_TRIGGER_ASPECTS = {'conjunction', 'sextile', 'square', 'trine', 'opposition'}
DISCLAIMER""",
    'policy constants',
)
old_return = """def _return_evidence(support, instant, stage, natal):
    rows, active = [], []
    for key in RETURN_KEYS:
        for side in ('user', 'counterpart'):
            e = _active_return(support.get(key, {}).get(side, {}).get('events', []), instant)
            if not e or e.get('precision') == 'date_noon_proxy':
                continue
            active.append((key, side, e))
            anchor = {
                'solar_return': 'Sun',
                'lunar_return': 'Moon',
                'mercury_return': 'Mercury',
                'venus_return': 'Venus',
                'mars_return': 'Mars',
            }[key]
            positions = {k: v for k, v in e.get('positions', {}).items() if k != anchor}
            hits = _contacts(
                positions,
                natal[side],
                stage,
                'return',
                f'{side}:{key}:{e[\"exact_utc\"]}',
                sources=PERSONAL | {'Mars'},
                targets=TARGETS,
                limit=1.5,
            )
            for hit in hits:
                hit['return_type'] = key
            rows.extend(hits)
            for h in e.get('house_activations', []):
                if h.get('whole_sign') in {3, 5, 7, 8}:
                    rows.append({
                        'event_id': f'return_house:{side}:{key}:{e[\"exact_utc\"]}:{h[\"planet\"]}',
                        'family': 'return_house',
                        'system': 'western',
                        'a': h['planet'],
                        'house_system': 'Whole Sign',
                        'house': h['whole_sign'],
                        'strength': 12.0,
                        'tone': 'context',
                    })
    return rows, active
"""
new_return = """def _return_evidence(support, instant, stage, natal):
    \"\"\"Return stage-relevant context; Lunar Return is the required medium-window anchor.\"\"\"
    rows, active = [], []
    for key in MID_CONTEXT_RETURN_KEYS_BY_STAGE[stage]:
        for side in ('user', 'counterpart'):
            e = _active_return(support.get(key, {}).get(side, {}).get('events', []), instant)
            if not e or e.get('precision') == 'date_noon_proxy':
                continue
            if key in MID_GATE_RETURN_KEYS:
                active.append((key, side, e))
            anchor = {
                'solar_return': 'Sun',
                'lunar_return': 'Moon',
                'mercury_return': 'Mercury',
                'venus_return': 'Venus',
                'mars_return': 'Mars',
            }[key]
            positions = {k: v for k, v in e.get('positions', {}).items() if k != anchor}
            hits = _contacts(
                positions,
                natal[side],
                stage,
                'return',
                f'{side}:{key}:{e[\"exact_utc\"]}',
                sources=PERSONAL | {'Mars'},
                targets=TARGETS,
                limit=1.5,
            )
            for hit in hits:
                hit['return_type'] = key
                hit['mid_gate'] = key in MID_GATE_RETURN_KEYS
            rows.extend(hits)
            for h in e.get('house_activations', []):
                if h.get('whole_sign') in {3, 5, 7, 8}:
                    rows.append({
                        'event_id': f'return_house:{side}:{key}:{e[\"exact_utc\"]}:{h[\"planet\"]}',
                        'family': 'return_house',
                        'system': 'western',
                        'a': h['planet'],
                        'return_type': key,
                        'mid_gate': key in MID_GATE_RETURN_KEYS,
                        'house_system': 'Whole Sign',
                        'house': h['whole_sign'],
                        'strength': 12.0,
                        'tone': 'context',
                    })
    return rows, active


def _mid_gate_evidence(rows):
    \"\"\"Only Lunar Return evidence opens the medium-term gate; other returns remain context.\"\"\"
    return [row for row in rows if row.get('mid_gate') and row.get('return_type') in MID_GATE_RETURN_KEYS]
"""
engine = replace_once(engine, old_return, new_return, 'return evidence')
old_trigger = """def _stage_trigger_evidence(stage, evidence):
    \"\"\"Return the strongest materially contributing stage-defining fast contact.\"\"\"
    required = PRIMARY_TRIGGER_BY_STAGE[stage]
    qualifying = [
        e for e in evidence
        if e.get('a') in required and float(e.get('strength', 0)) >= THRESHOLDS['event_trigger']
    ]
"""
new_trigger = """def _stage_trigger_evidence(stage, evidence):
    \"\"\"Return a material fast contact whose planet, target and aspect fit the stage.\"\"\"
    required = PRIMARY_TRIGGER_BY_STAGE[stage]
    targets = PRIMARY_TRIGGER_TARGETS_BY_STAGE[stage]
    qualifying = [
        e for e in evidence
        if e.get('a') in required
        and e.get('b') in targets
        and e.get('aspect') in PRIMARY_TRIGGER_ASPECTS
        and float(e.get('strength', 0)) >= THRESHOLDS['event_trigger']
    ]
"""
engine = replace_once(engine, old_trigger, new_trigger, 'stage trigger semantics')
engine = replace_once(
    engine,
    """            and r['eligible']
            and r.get('stage_trigger_ok', True)
""",
    """            and r.get('hierarchy_eligible', r['eligible'] and r.get('stage_trigger_ok', True))
""",
    'local peak hierarchy eligibility',
)
engine = replace_once(
    engine,
    "by_key = {(r['date'], r['stage']): r for r in rows if r['eligible']}",
    "by_key = {(r['date'], r['stage']): r for r in rows if r.get('hierarchy_eligible', r['eligible'] and r.get('stage_trigger_ok', True))}",
    'peak neighborhood hierarchy eligibility',
)
old_selectivity = """def _selectivity_summary(rows, as_of=None):
    total_days = max(1, len({r['date'] for r in rows}))
    as_of_iso = as_of.isoformat() if isinstance(as_of, date) else None
    out = {}
    for stage in DIMENSIONS:
        stage_rows = [r for r in rows if r['stage'] == stage]
        gate_count = sum(1 for r in stage_rows if r['eligible'])
        trigger_count = sum(1 for r in stage_rows if r['eligible'] and r.get('stage_trigger_ok', False))
        peak_count = sum(1 for r in stage_rows if _selected(r))
        gate_ratio = gate_count / total_days
        future_rows = [r for r in stage_rows if as_of_iso is None or r['date'] >= as_of_iso]
        future_gate = sum(1 for r in future_rows if r['eligible'])
        future_trigger = sum(1 for r in future_rows if r['eligible'] and r.get('stage_trigger_ok', False))
        future_peak = sum(1 for r in future_rows if _selected(r))
        warnings = []
        if gate_ratio > SELECTIVITY_WARNING_RATIO:
            warnings.append('LOW_GATE_SELECTIVITY')
        if future_gate and not future_trigger:
            warnings.append('NO_FUTURE_STAGE_TRIGGER')
        if future_trigger and not future_peak:
            warnings.append('NO_FUTURE_PEAK')
        out[stage] = {
            'gate_pass_days': gate_count,
            'stage_trigger_pass_days': trigger_count,
            'local_peak_days': peak_count,
            'future_gate_pass_days': future_gate,
            'future_stage_trigger_pass_days': future_trigger,
            'future_local_peak_days': future_peak,
            'total_days': total_days,
            'gate_pass_ratio': round(gate_ratio, 4),
            'status': 'LOW_SELECTIVITY' if gate_ratio > SELECTIVITY_WARNING_RATIO else 'OK',
            'warnings': warnings,
        }
    return out
"""
new_selectivity = """def _selectivity_summary(rows, as_of=None):
    total_days = max(1, len({r['date'] for r in rows}))
    as_of_iso = as_of.isoformat() if isinstance(as_of, date) else None
    out = {}
    for stage in DIMENSIONS:
        stage_rows = [r for r in rows if r['stage'] == stage]
        numeric_gate = sum(1 for r in stage_rows if r['eligible'])
        trigger_count = sum(1 for r in stage_rows if r['eligible'] and r.get('stage_trigger_ok', False))
        hierarchy_count = sum(1 for r in stage_rows if r.get('hierarchy_eligible', False))
        peak_count = sum(1 for r in stage_rows if _selected(r))
        numeric_ratio = numeric_gate / total_days
        hierarchy_ratio = hierarchy_count / total_days
        future_rows = [r for r in stage_rows if as_of_iso is None or r['date'] >= as_of_iso]
        future_numeric = sum(1 for r in future_rows if r['eligible'])
        future_trigger = sum(1 for r in future_rows if r['eligible'] and r.get('stage_trigger_ok', False))
        future_hierarchy = sum(1 for r in future_rows if r.get('hierarchy_eligible', False))
        future_peak = sum(1 for r in future_rows if _selected(r))
        warnings = []
        if numeric_ratio > SELECTIVITY_WARNING_RATIO:
            warnings.append('LOW_NUMERIC_GATE_SELECTIVITY')
        if hierarchy_ratio > SELECTIVITY_WARNING_RATIO:
            warnings.append('LOW_HIERARCHY_SELECTIVITY')
        if future_numeric and not future_hierarchy:
            warnings.append('NO_FUTURE_HIERARCHY_PASS')
        if future_hierarchy and not future_peak:
            warnings.append('NO_FUTURE_PEAK')
        out[stage] = {
            'gate_pass_days': numeric_gate,
            'numeric_gate_pass_days': numeric_gate,
            'stage_trigger_pass_days': trigger_count,
            'hierarchy_pass_days': hierarchy_count,
            'local_peak_days': peak_count,
            'future_gate_pass_days': future_numeric,
            'future_numeric_gate_pass_days': future_numeric,
            'future_stage_trigger_pass_days': future_trigger,
            'future_hierarchy_pass_days': future_hierarchy,
            'future_local_peak_days': future_peak,
            'total_days': total_days,
            'gate_pass_ratio': round(numeric_ratio, 4),
            'hierarchy_pass_ratio': round(hierarchy_ratio, 4),
            'status': 'LOW_SELECTIVITY' if hierarchy_ratio > SELECTIVITY_WARNING_RATIO else 'OK',
            'warnings': warnings,
        }
    return out
"""
engine = replace_once(engine, old_selectivity, new_selectivity, 'selectivity summary')
engine = replace_once(
    engine,
    """            mid_rows, active_returns = _return_evidence(support, instant, stage, natal)
            mid_score, mid_rows = _ranked_score(mid_rows)
            fast_rows = []
""",
    """            mid_context_rows, active_returns = _return_evidence(support, instant, stage, natal)
            mid_score, mid_rows = _ranked_score(_mid_gate_evidence(mid_context_rows))
            mid_context_score, mid_context_ranked = _ranked_score(mid_context_rows)
            fast_rows = []
""",
    'medium gate anchor',
)
engine = replace_once(
    engine,
    """            components = score_components(long_score, mid_score, event_score, systems)
            components['event_trigger_raw'] = event_raw_score
""",
    """            components = score_components(long_score, mid_score, event_score, systems)
            components['mid_context_score'] = mid_context_score
            components['event_trigger_raw'] = event_raw_score
""",
    'mid context component',
)
engine = replace_once(
    engine,
    """            eligible = components['eligible'] and validation['status'] == 'PASS'
            rows.append({
                'date': cursor.isoformat(),
                'stage': stage,
                'eligible': eligible,
                'stage_trigger_ok': stage_trigger_ok,
""",
    """            eligible = components['eligible'] and validation['status'] == 'PASS'
            hierarchy_eligible = eligible and stage_trigger_ok
            rows.append({
                'date': cursor.isoformat(),
                'stage': stage,
                'eligible': eligible,
                'hierarchy_eligible': hierarchy_eligible,
                'stage_trigger_ok': stage_trigger_ok,
""",
    'hierarchy eligibility',
)
engine = replace_once(
    engine,
    """                'mid_evidence': mid_rows[:4],
                'saju_context': saju_day,
""",
    """                'mid_evidence': mid_rows[:4],
                'mid_context_evidence': mid_context_ranked[:4],
                'saju_context': saju_day,
""",
    'mid context trace',
)
engine = replace_once(
    engine,
    "'fast_trigger': eligible and stage_trigger_ok,",
    "'fast_trigger': hierarchy_eligible,",
    'dimension hierarchy trigger',
)
engine = replace_once(
    engine,
    """        gate_upcoming = [
            r for r in rows
            if r['stage'] == stage and r['date'] >= as_of_date.isoformat() and r['eligible']
        ]
        stage_summary[stage] = {
            'label': DIMENSION_LABELS[stage],
            'activation': max((r['components']['final'] for r in upcoming), default=None),
            'candidate_count': len(upcoming),
            'gate_pass_count': len(gate_upcoming),
        }
""",
    """        gate_upcoming = [
            r for r in rows
            if r['stage'] == stage and r['date'] >= as_of_date.isoformat() and r['eligible']
        ]
        hierarchy_upcoming = [
            r for r in rows
            if r['stage'] == stage and r['date'] >= as_of_date.isoformat() and r.get('hierarchy_eligible', False)
        ]
        stage_summary[stage] = {
            'label': DIMENSION_LABELS[stage],
            'activation': max((r['components']['final'] for r in upcoming), default=None),
            'candidate_count': len(upcoming),
            'gate_pass_count': len(gate_upcoming),
            'hierarchy_pass_count': len(hierarchy_upcoming),
        }
""",
    'stage summary hierarchy count',
)
engine = replace_once(
    engine,
    """            'stage_primary_triggers': {k: sorted(v) for k, v in PRIMARY_TRIGGER_BY_STAGE.items()},
            'primary_trigger_min_strength': THRESHOLDS['event_trigger'],
            'fast_sample_hours': FAST_SAMPLE_HOURS,
""",
    """            'stage_primary_triggers': {k: sorted(v) for k, v in PRIMARY_TRIGGER_BY_STAGE.items()},
            'stage_primary_targets': {k: sorted(v) for k, v in PRIMARY_TRIGGER_TARGETS_BY_STAGE.items()},
            'stage_primary_aspects': sorted(PRIMARY_TRIGGER_ASPECTS),
            'primary_trigger_min_strength': THRESHOLDS['event_trigger'],
            'medium_gate_return': 'lunar_return',
            'medium_context_returns': {k: list(v) for k, v in MID_CONTEXT_RETURN_KEYS_BY_STAGE.items()},
            'fast_sample_hours': FAST_SAMPLE_HOURS,
""",
    'selection policy metadata',
)
engine = replace_once(
    engine,
    """            '일별 빠른 촉발점은 3시간 간격 표본이며 정확한 사건 발생 시각을 뜻하지 않음',
            '조회 시작·끝 바깥의 ±7일 피크 비교 문맥은 현재 계산하지 않으므로 경계 피크는 범위 제한을 가짐',
            '문턱·가중치는 버전 관리되는 비교 규칙이며 적중률로 보정하지 않음',
            '장기·중기 관문 통과일 중 단계별 필수 촉발이 실제 문턱 이상 기여한 ±7일 국소 피크만 공개 후보로 사용',
""",
    """            '일별 빠른 촉발점은 3시간 간격 표본이며 정확한 사건 발생 시각을 뜻하지 않음',
            '중기 관문은 월 단위 Lunar Return을 필수 앵커로 사용하며 다른 행성 회귀는 단계별 배경 문맥으로만 유지',
            '조회 시작·끝 바깥의 ±7일 피크 비교 문맥은 현재 계산하지 않으므로 경계 피크는 범위 제한을 가짐',
            '문턱·가중치는 버전 관리되는 비교 규칙이며 적중률로 보정하지 않음',
            '장기·중기 관문 통과 후 단계별 관련 대상·주요 각에 대한 필수 촉발이 실제 문턱 이상 기여한 ±7일 국소 피크만 공개 후보로 사용',
""",
    'limitations policy',
)
engine = engine.replace(
    'hierarchical_gates_then_material_stage_trigger_then_future_local_peak',
    'hierarchical_gates_with_lunar_medium_anchor_then_semantic_stage_trigger_then_future_local_peak',
)
engine = replace_once(
    engine,
    """        'meaning': 'long and medium gates precede materially contributing stage-specific fast triggers; public dates are future-only local peaks; no 85/15 fallback',
""",
    """        'meaning': 'long gate + Lunar Return medium anchor precede materially contributing semantic stage triggers; other returns stay context; public dates are future-only local peaks',
""",
    'weight policy meaning',
)
engine = replace_once(
    engine,
    """    support['policy'] = '장기·중기 관문과 단계별 필수 촉발이 실제 문턱 이상 기여한 뒤 기준일 이후 주변 대비 국소 피크인 날짜만 최종 후보. 회귀는 서양 내부 근거이며 독립 체계로 중복 가산하지 않음.'
""",
    """    support['policy'] = '장기 관문 뒤 Lunar Return을 월 단위 중기 앵커로 사용하고, 단계별 관련 대상·주요 각의 필수 촉발이 실제 문턱 이상 기여한 뒤 기준일 이후 국소 피크만 최종 후보. 다른 행성 회귀는 배경 문맥이며 독립 체계로 중복 가산하지 않음.'
""",
    'support policy',
)
ENGINE.write_text(engine, encoding='utf-8')

tests = TESTS.read_text(encoding='utf-8')
tests = replace_once(
    tests,
    """def test_stage_specific_trigger_must_materially_contribute():
    moon=[{'a':'Moon','strength':80,'orb':0.1,'event_id':'moon'}]
    weak_mercury=[{'a':'Mercury','strength':0.1,'orb':0.01,'event_id':'weak-mercury'}]
    mercury=[{'a':'Mercury','strength':12,'orb':0.9,'event_id':'mercury'}]
    mars=[{'a':'Mars','strength':12.1,'orb':0.8,'event_id':'mars'}]
    assert not h._stage_trigger_ok('contact_recontact',moon)
    assert not h._stage_trigger_ok('contact_recontact',moon+weak_mercury)
    assert h._stage_trigger_ok('contact_recontact',moon+mercury)
    assert not h._stage_trigger_ok('in_person_meeting',mercury)
    assert h._stage_trigger_ok('in_person_meeting',mars)
""",
    """def test_stage_specific_trigger_must_materially_contribute_with_relevant_target_and_aspect():
    moon=[{'a':'Moon','b':'Venus','aspect':'square','strength':80,'orb':0.1,'event_id':'moon'}]
    weak_mercury=[{'a':'Mercury','b':'Moon','aspect':'conjunction','strength':0.1,'orb':0.01,'event_id':'weak-mercury'}]
    mercury=[{'a':'Mercury','b':'Moon','aspect':'conjunction','strength':12,'orb':0.9,'event_id':'mercury'}]
    wrong_target=[{'a':'Mercury','b':'Mars','aspect':'conjunction','strength':90,'orb':0.01,'event_id':'wrong-target'}]
    quincunx=[{'a':'Mercury','b':'Moon','aspect':'quincunx','strength':90,'orb':0.01,'event_id':'quincunx'}]
    mars=[{'a':'Mars','b':'DSC','aspect':'opposition','strength':12.1,'orb':0.8,'event_id':'mars'}]
    assert not h._stage_trigger_ok('contact_recontact',moon)
    assert not h._stage_trigger_ok('contact_recontact',moon+weak_mercury)
    assert h._stage_trigger_ok('contact_recontact',moon+mercury)
    assert not h._stage_trigger_ok('contact_recontact',wrong_target)
    assert not h._stage_trigger_ok('contact_recontact',quincunx)
    assert h._stage_trigger_ok('in_person_meeting',mars)
""",
    'stage trigger test',
)
tests = replace_once(
    tests,
    """        {'a':'Moon','strength':90,'orb':0.1,'event_id':'a'},
        {'a':'Moon','strength':80,'orb':0.2,'event_id':'b'},
        {'a':'Mars','strength':70,'orb':0.3,'event_id':'c'},
        {'a':'Moon','strength':60,'orb':0.4,'event_id':'d'},
        {'a':'Mercury','strength':12.5,'orb':0.5,'event_id':'primary'},
""",
    """        {'a':'Moon','b':'Venus','aspect':'square','strength':90,'orb':0.1,'event_id':'a'},
        {'a':'Moon','b':'Moon','aspect':'trine','strength':80,'orb':0.2,'event_id':'b'},
        {'a':'Mars','b':'DSC','aspect':'opposition','strength':70,'orb':0.3,'event_id':'c'},
        {'a':'Moon','b':'Sun','aspect':'sextile','strength':60,'orb':0.4,'event_id':'d'},
        {'a':'Mercury','b':'Moon','aspect':'conjunction','strength':12.5,'orb':0.5,'event_id':'primary'},
""",
    'display evidence fixture',
)
insert_after = """def test_display_fast_evidence_always_contains_material_primary_trigger():
"""
idx = tests.index(insert_after)
next_def = tests.index('\ndef test_nearest_public_candidate', idx)
new_tests = """

def test_medium_gate_uses_lunar_return_only_while_other_returns_remain_context():
    rows=[
        {'return_type':'lunar_return','mid_gate':True,'event_id':'lunar','strength':30},
        {'return_type':'venus_return','mid_gate':False,'event_id':'venus','strength':100},
    ]
    gate=h._mid_gate_evidence(rows)
    assert [r['event_id'] for r in gate]==['lunar']
    assert h._ranked_score(gate)[0]==30
    assert h._ranked_score(rows)[0]>30


def test_medium_context_return_families_are_stage_specific_and_keep_lunar_anchor():
    assert all('lunar_return' in keys for keys in h.MID_CONTEXT_RETURN_KEYS_BY_STAGE.values())
    assert 'mercury_return' in h.MID_CONTEXT_RETURN_KEYS_BY_STAGE['contact_recontact']
    assert 'mars_return' in h.MID_CONTEXT_RETURN_KEYS_BY_STAGE['in_person_meeting']
    assert 'solar_return' in h.MID_CONTEXT_RETURN_KEYS_BY_STAGE['relationship_rebuilding']
    assert h.MID_GATE_RETURN_KEYS=={'lunar_return'}
"""
tests = tests[:next_def] + new_tests + tests[next_def:]
tests = replace_once(
    tests,
    """    assert summary['gate_pass_days']==10
    assert summary['stage_trigger_pass_days']==10
    assert summary['local_peak_days']<summary['gate_pass_days']
    assert summary['status']=='LOW_SELECTIVITY'
    assert 'LOW_GATE_SELECTIVITY' in summary['warnings']
""",
    """    assert summary['numeric_gate_pass_days']==10
    assert summary['stage_trigger_pass_days']==10
    assert summary['hierarchy_pass_days']==0
    assert summary['local_peak_days']<summary['numeric_gate_pass_days']
    assert summary['status']=='OK'
    assert 'LOW_NUMERIC_GATE_SELECTIVITY' in summary['warnings']
""",
    'selectivity test expectations',
)
# Synthetic rows omit the production hierarchy flag. Give the selectivity test explicit false hierarchy rows.
tests = replace_once(
    tests,
    """    rows=[_peak_row(f'2026-01-{i:02d}',50+i) for i in range(1,11)]
    h._mark_local_peaks(rows,min_date=date(2026,1,1),max_date=date(2026,1,10))
    summary=h._selectivity_summary(rows,date(2026,1,1))['contact_recontact']
""",
    """    rows=[_peak_row(f'2026-01-{i:02d}',50+i) for i in range(1,11)]
    for row in rows:
        row['hierarchy_eligible']=False
    h._mark_local_peaks(rows,min_date=date(2026,1,1),max_date=date(2026,1,10))
    summary=h._selectivity_summary(rows,date(2026,1,1))['contact_recontact']
""",
    'selectivity fixture hierarchy flag',
)
tests = replace_once(
    tests,
    "assert hierarchy['version']=='reunion-hierarchy-v2.2-selectivity-boundaries'",
    "assert hierarchy['version']=='reunion-hierarchy-v2.3-medium-anchor'",
    'api version test',
)
tests = replace_once(
    tests,
    """        if row['selection_eligible']:
            assert row['eligible'] and row['stage_trigger_ok'] and row['local_peak']
            required=h.PRIMARY_TRIGGER_BY_STAGE[row['stage']]
            assert any(e.get('a') in required and e.get('strength',0)>=h.THRESHOLDS['event_trigger'] for e in row['fast_evidence'])
""",
    """        if row['selection_eligible']:
            assert row['eligible'] and row['hierarchy_eligible'] and row['stage_trigger_ok'] and row['local_peak']
            required=h.PRIMARY_TRIGGER_BY_STAGE[row['stage']]
            targets=h.PRIMARY_TRIGGER_TARGETS_BY_STAGE[row['stage']]
            assert any(
                e.get('a') in required
                and e.get('b') in targets
                and e.get('aspect') in h.PRIMARY_TRIGGER_ASPECTS
                and e.get('strength',0)>=h.THRESHOLDS['event_trigger']
                for e in row['fast_evidence']
            )
""",
    'api selected evidence semantics',
)
TESTS.write_text(tests, encoding='utf-8')
print('v2.3 patch applied')
