"""Deterministic reunion timing selection policy, not a calibrated event predictor.

Weights and thresholds are versioned product settings. Event history is deliberately
absent from this API. Every day is scored only after long/medium activation has been
computed; fast transits never pre-truncate the candidate pool.
"""
from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta, timezone

import swisseph as swe
import relationship_western_v1 as rw
from timezone_provenance_v1 import resolve_local_datetime, resolve_profile_birth_datetime
from reunion_dimension_v1 import (
    daily_dimension_scores,
    DIMENSIONS,
    DIMENSION_LABELS as LEGACY_LABELS,
    TARGET_WEIGHTS,
    TRANSIT_WEIGHTS,
    ASPECT_WEIGHTS,
)

DIMENSION_LABELS = {**LEGACY_LABELS, 'relationship_rebuilding': '관계 재정의'}

VERSION = 'reunion-hierarchy-v2.8-birth-time-precision-audit'
RUNTIME_REVISION = 'reunion-runtime-v2.9-efficiency'
WEIGHTS = dict(long_term=.35, mid_term=.25, event_trigger=.25, cross_system=.15)
THRESHOLDS = dict(long_term=35.0, mid_term=25.0, event_trigger=12.0)
PEAK_RADIUS_DAYS = 7
SELECTIVITY_WARNING_RATIO = .50
FAST_SAMPLE_HOURS = (0, 3, 6, 9, 12, 15, 18, 21, 23.999)
PERSONAL = {'Sun', 'Moon', 'Mercury', 'Venus'}
TARGETS = {'Sun', 'Moon', 'Mercury', 'Venus', 'ASC', 'DSC'}
SLOW = {'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'}
RETURN_KEYS = ('solar_return', 'lunar_return', 'mercury_return', 'venus_return', 'mars_return')
FAST_BY_STAGE = {
    'emotional_reactivation': {'Venus', 'Moon', 'Sun'},
    'contact_recontact': {'Mercury', 'Moon', 'Mars'},
    'in_person_meeting': {'Mars', 'Mercury', 'Venus'},
    'relationship_rebuilding': {'Venus', 'Moon', 'Sun', 'Mercury'},
}
DIRECT_TRIGGER_ASPECTS = {'conjunction', 'square', 'opposition'}
CONTEXT_ONLY_ASPECTS = {'sextile', 'trine', 'quincunx'}
EXACT_TRIGGER_FAMILIES = {'natal_trigger', 'progressed_trigger'}
STAGE_LONG_POLICY = {
    'emotional_reactivation': {
        'directed_planets': {'Moon', 'Venus', 'Sun'},
        'directed_targets': {'Moon', 'Venus', 'Sun'},
        'slow_planets': SLOW,
        'slow_targets': {'Moon', 'Venus', 'Sun'},
    },
    'contact_recontact': {
        'directed_planets': {'Mercury'},
        'directed_targets': {'Mercury', 'Moon', 'Venus', 'Sun', 'DSC'},
        'slow_planets': {'Jupiter', 'Saturn', 'Uranus'},
        'slow_targets': {'Mercury', 'Venus', 'DSC'},
    },
    'in_person_meeting': {
        'directed_planets': {'Moon', 'Venus', 'Sun'},
        'directed_targets': {'ASC', 'DSC', 'Venus', 'Mars'},
        'slow_planets': {'Jupiter', 'Saturn', 'Uranus'},
        'slow_targets': {'ASC', 'DSC', 'Venus', 'Mars'},
    },
    'relationship_rebuilding': {
        'directed_planets': {'Venus', 'Sun'},
        'directed_targets': {'Moon', 'Venus', 'Sun', 'DSC', 'Saturn'},
        'slow_planets': {'Jupiter', 'Saturn'},
        'slow_targets': {'Moon', 'Venus', 'Sun', 'DSC', 'Saturn'},
    },
}
STAGE_TRIGGER_POLICY = {
    'emotional_reactivation': {
        'primary_planets': {'Moon', 'Venus'},
        'targets': {'Moon', 'Venus', 'Sun'},
        'direct_aspects': DIRECT_TRIGGER_ASPECTS,
        'exact_families': EXACT_TRIGGER_FAMILIES,
        'moon_requires_venus_context': True,
    },
    'contact_recontact': {
        'primary_planets': {'Mercury'},
        'targets': {'Mercury', 'Moon', 'Venus', 'DSC'},
        'direct_aspects': DIRECT_TRIGGER_ASPECTS,
        'exact_families': EXACT_TRIGGER_FAMILIES,
    },
    'in_person_meeting': {
        'primary_planets': {'Mars'},
        'targets': {'ASC', 'DSC', 'Venus', 'Mars'},
        'direct_aspects': DIRECT_TRIGGER_ASPECTS,
        'exact_families': EXACT_TRIGGER_FAMILIES,
    },
    'relationship_rebuilding': {
        'primary_planets': {'Venus', 'Sun'},
        'support_planets': {'Mercury'},
        'targets': {'DSC', 'Venus', 'Saturn'},
        'direct_aspects': DIRECT_TRIGGER_ASPECTS,
        'exact_families': EXACT_TRIGGER_FAMILIES,
    },
}
PRIMARY_TRIGGER_BY_STAGE = {stage: policy['primary_planets'] for stage, policy in STAGE_TRIGGER_POLICY.items()}
MID_GATE_RETURN_KEYS = {'lunar_return'}
MID_CONTEXT_RETURN_KEYS_BY_STAGE = {
    'emotional_reactivation': ('lunar_return', 'venus_return'),
    'contact_recontact': ('lunar_return', 'mercury_return'),
    'in_person_meeting': ('lunar_return', 'venus_return', 'mars_return'),
    'relationship_rebuilding': ('lunar_return', 'venus_return', 'solar_return'),
}
PRIMARY_TRIGGER_TARGETS_BY_STAGE = {stage: policy['targets'] for stage, policy in STAGE_TRIGGER_POLICY.items()}
PRIMARY_TRIGGER_ASPECTS = DIRECT_TRIGGER_ASPECTS
# Performance-only body subsets. They are derived from the canonical stage policies,
# so changing a policy automatically widens the calculation set instead of silently
# dropping a required body. Longitude math, sample hours, gates, weights and orbs stay unchanged.
FAST_TRANSIT_BODIES = frozenset().union(*FAST_BY_STAGE.values())
PROGRESSED_BODIES = frozenset(
    set().union(*(policy['directed_planets'] for policy in STAGE_LONG_POLICY.values()))
    | (set().union(*(policy['targets'] for policy in STAGE_TRIGGER_POLICY.values())) & set(rw.BODIES))
    | {'Sun'}
)
DISCLAIMER = '점수는 해당 기간의 점성·명리적 상대 활성도를 비교하기 위한 값이며, 실제 연락·만남·재회의 확률을 의미하지 않습니다.'


def score_components(long_term, mid_term, event_trigger, systems=()):
    """Strict gate eligibility is separate from the final ranking score."""
    values = (long_term, mid_term, event_trigger)
    if not all(isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 100 for v in values):
        raise ValueError('activation components must be finite scores in [0,100]')
    independent = sorted(set(systems) & {'western', 'saju', 'ziwei'})
    cross = 100.0 if len(independent) >= 2 else 0.0
    parts = dict(long_term=long_term, mid_term=mid_term, event_trigger=event_trigger, cross_system=cross)
    gates = {key: parts[key] >= threshold for key, threshold in THRESHOLDS.items()}
    eligible = all(gates.values())
    base = sum(parts[k] * v for k, v in WEIGHTS.items())
    penalty = (1 if gates['long_term'] else .55) * (1 if gates['mid_term'] else .65)
    bonus = 5.0 if eligible else 0.0
    return {
        **{k: round(v, 2) for k, v in parts.items()},
        'weighted_sum': round(base, 2),
        'gate_multiplier': round(penalty, 4),
        'convergence_bonus': bonus,
        'final': round(min(100, base * penalty + bonus), 2),
        'gates': gates,
        'eligible': eligible,
        'independent_systems': independent,
        'event_probability': 'not_calculated',
    }


def _ranked_score(evidence):
    """Bounded top-three pooling, deduplicated by physical source identity."""
    unique = {}
    for e in evidence:
        key = e['event_id']
        if key not in unique or e['strength'] > unique[key]['strength']:
            unique[key] = e
    rows = sorted(unique.values(), key=lambda e: (-e['strength'], e['event_id']))
    weights = (1, .25, .10)
    return round(min(100, sum(e['strength'] * w for e, w in zip(rows, weights))), 2), rows


def _raw_ranked_score(rows):
    """Uncapped top-three signal used only to break public-peak score plateaus."""
    weights = (1, .25, .10)
    return round(sum(float(e.get('strength', 0)) * w for e, w in zip(rows, weights)), 3)


def _contacts(source, target, stage, family, direction, *, sources=None, targets=None, limit=1.5, geometry_cache=None):
    out = []
    for a, lon in source.items():
        if sources is not None and a not in sources:
            continue
        for b, natal in target.items():
            if targets is not None and b not in targets:
                continue
            geometry_key = (lon, natal, limit)
            matches = geometry_cache.get(geometry_key) if geometry_cache is not None else None
            if matches is None:
                dist = rw._angle_distance(lon, natal)
                matches = tuple((aspect, abs(dist - angle)) for aspect, angle in rw.ASPECTS.items() if abs(dist - angle) < limit)
                if geometry_cache is not None:
                    geometry_cache[geometry_key] = matches
            for aspect, orb in matches:
                weight = TARGET_WEIGHTS[stage].get(b, .2)
                source_weight = 1.0 if family in {'secondary', 'solar_arc'} else TRANSIT_WEIGHTS[stage].get(a, 0)
                strength = 100 * source_weight * weight * ASPECT_WEIGHTS[aspect] * (1 - orb / limit)
                if strength <= 0:
                    continue
                identity_family = 'directed_sun' if family in {'secondary', 'solar_arc'} and a == 'Sun' else family
                out.append({
                    'event_id': f'{identity_family}:{direction}:{a}:{aspect}:{b}',
                    'family': family,
                    'system': 'western',
                    'direction': direction,
                    'a': a,
                    'b': b,
                    'aspect': aspect,
                    'transit': a,
                    'target': b,
                    'person': direction.split(':')[0],
                    'score': round(strength, 3),
                    'orb': round(orb, 6),
                    'orb_unit': 'degree',
                    'strength': round(strength, 3),
                    'tone': 'challenging' if aspect in rw.CHALLENGING else 'supportive' if aspect in rw.SUPPORTIVE else 'mixed',
                })
    return out


def _selected_planet_points(jd, names):
    """Return the same rounded Swiss longitudes as rw._planet_positions for selected bodies only."""
    flags = swe.FLG_SWIEPH | swe.FLG_SPEED
    wanted = set(names)
    out = {}
    # Preserve relationship_western_v1.BODIES iteration order for deterministic traces.
    for name, pid in rw.BODIES.items():
        if name not in wanted:
            continue
        xx, _ = swe.calc_ut(float(jd), pid, flags)
        out[name] = round(rw._norm(xx[0]), 6)
    missing = wanted - set(out)
    if missing:
        raise ValueError(f'unknown Swiss body names: {sorted(missing)}')
    return out


def _secondary_progressed_points(profile, target_dt, birth_utc, names=PROGRESSED_BODIES):
    """Day-for-year progression equivalent to rw._secondary_progressed_chart without unused bodies."""
    age_days = (target_dt.astimezone(timezone.utc) - birth_utc).total_seconds() / 86400.0
    progressed_days = age_days / rw.YEAR_DAYS
    jd = rw._jd_from_utc(birth_utc) + progressed_days
    return jd, _selected_planet_points(jd, names)


def _points(chart, allow_angles=True):
    points = {k: float(v['lon']) for k, v in chart.get('positions', {}).items()}
    if allow_angles and rw._chart_time_exact(chart):
        points.update({k: float(v) for k, v in chart.get('angles', {}).items() if k in {'ASC', 'DSC'}})
    return points


def _active_return(events, instant):
    for e in reversed(events):
        start = datetime.fromisoformat(e['exact_utc'])
        end = datetime.fromisoformat(e['next_exact_utc']) if e.get('next_exact_utc') else None
        if start <= instant and end and instant < end:
            return e
    return None


def _return_evidence(support, instant, stage, natal, cache=None):
    # Request-scoped: a return chart and its natal contacts are invariant until
    # the exact UTC cycle boundary. Never cache across profiles or requests.
    if cache is not None:
        signature = tuple(
            (key, side, (event or {}).get('exact_utc'))
            for key in MID_CONTEXT_RETURN_KEYS_BY_STAGE[stage]
            for side in ('user', 'counterpart')
            for event in [_active_return(support.get(key, {}).get(side, {}).get('events', []), instant)]
        )
        cache_key = (stage, signature)
        if cache_key not in cache:
            cache[cache_key] = _return_evidence(support, instant, stage, natal)
        return cache[cache_key]
    """Return stage-relevant context; Lunar Return is the required medium-window anchor."""
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
                f'{side}:{key}:{e["exact_utc"]}',
                sources=PERSONAL | {'Mars'},
                targets=TARGETS,
                limit=1.5,
            )
            for hit in hits:
                hit['return_type'] = key
                hit['mid_gate'] = key in MID_GATE_RETURN_KEYS
                hit['return_precision'] = e.get('precision') or 'unknown'
                hit['return_side'] = side
            rows.extend(hits)
            for h in e.get('house_activations', []):
                if h.get('whole_sign') in {3, 5, 7, 8}:
                    rows.append({
                        'event_id': f'return_house:{side}:{key}:{e["exact_utc"]}:{h["planet"]}',
                        'family': 'return_house',
                        'system': 'western',
                        'a': h['planet'],
                        'return_type': key,
                        'mid_gate': key in MID_GATE_RETURN_KEYS,
                        'return_precision': e.get('precision') or 'unknown',
                        'return_side': side,
                        'house_system': 'Whole Sign',
                        'house': h['whole_sign'],
                        'strength': 12.0,
                        'tone': 'context',
                    })
    return rows, active


def _mid_gate_evidence(rows):
    """Only Lunar Return evidence opens the medium-term gate; other returns remain context."""
    return [row for row in rows if row.get('mid_gate') and row.get('return_type') in MID_GATE_RETURN_KEYS]


def _medium_precision_audit(rows):
    """Expose provisional-time dependency without changing gate scores or ranking."""
    gate_rows = _mid_gate_evidence(rows)
    all_score, _ = _ranked_score(gate_rows)
    exact_rows = [row for row in gate_rows if row.get('return_precision') == 'exact']
    provisional_rows = [row for row in gate_rows if row.get('return_precision') == 'provisional']
    unknown_rows = [
        row for row in gate_rows
        if row.get('return_precision') not in {'exact', 'provisional'}
    ]
    exact_score, _ = _ranked_score(exact_rows)
    threshold = THRESHOLDS['mid_term']
    if unknown_rows:
        status = 'unknown_precision_present'
    elif provisional_rows and all_score >= threshold and exact_score < threshold:
        status = 'gate_depends_on_provisional'
    elif provisional_rows and exact_score >= threshold:
        status = 'provisional_contributes_but_exact_gate_passes'
    elif gate_rows:
        status = 'exact_only'
    else:
        status = 'no_lunar_anchor'
    return {
        'status': status,
        'all_score': all_score,
        'exact_only_score': exact_score,
        'gate_pass': all_score >= threshold,
        'exact_only_gate_pass': exact_score >= threshold,
        'exact_evidence_count': len(exact_rows),
        'provisional_evidence_count': len(provisional_rows),
        'unknown_precision_evidence_count': len(unknown_rows),
        'policy': 'audit_only; provisional evidence is not reweighted or suppressed in v2.8',
    }


def _saju_context(user, counterpart, start, end, offset):
    from integrated_fortune_v1 import _month_jie_segments, _annual_lichun_segments
    from relationship_saju_v1 import _pillars
    return {
        'available': True,
        'months': _month_jie_segments(start, end, offset),
        'years': _annual_lichun_segments(start, end, offset),
        'natal': [_pillars(user), _pillars(counterpart)],
        'policy': '절입 시각으로 연운·월운을 구분. 월운은 배경, 일진은 날짜별 교차 보강에만 사용.',
    }


def _saju_for_instant(ctx, instant):
    from relationship_saju_v1 import _branch_relation
    from lunar_python import Solar
    if not ctx.get('available'):
        return {'supports': False, 'daily_support': False, 'cross_support': False, 'evidence': []}

    def active(rows):
        return next((r for r in rows if datetime.fromisoformat(r['segment_start']) <= instant < datetime.fromisoformat(r['segment_end_exclusive'])), None)

    year, month = active(ctx['years']), active(ctx['months'])
    evidence = []
    for label, row in (('year', year), ('month', month)):
        if not row:
            continue
        for idx, natal in enumerate(ctx['natal']):
            rel = _branch_relation(row['ganzhi'][1], natal['day_branch'])
            evidence.append({
                'layer': label,
                'person': idx,
                'relations': rel,
                'segment_start': row['segment_start'],
                'segment_end_exclusive': row['segment_end_exclusive'],
            })
    local = instant
    lunar = Solar.fromYmdHms(local.year, local.month, local.day, local.hour, local.minute, local.second).getLunar()
    day = lunar.getDayInGanZhiExact2()
    daily = [_branch_relation(day[1], n['day_branch']) for n in ctx['natal']]
    has_month_support = any(e['layer'] == 'month' and '六合(육합)' in e['relations'] for e in evidence)
    has_conflict = any(
        '六沖(육충)' in e['relations'] or '六害(육해)' in e['relations'] or '六破(육파)' in e['relations']
        for e in evidence
    )
    daily_support = any('六合(육합)' in rel for rel in daily)
    daily_conflict = any(
        '六沖(육충)' in rel or '六害(육해)' in rel or '六破(육파)' in rel
        for rel in daily
    )
    background_support = has_month_support and not has_conflict
    cross_support = background_support and daily_support and not daily_conflict
    return {
        'supports': background_support,
        'daily_support': daily_support and not daily_conflict,
        'cross_support': cross_support,
        'evidence': evidence,
        'day_trigger': daily,
        'day_role': 'cross_system_tiebreak_only',
        'initiative_use': 'forbidden',
    }


def _validate(user, counterpart, support):
    checks = []

    def check(name, ok, detail):
        checks.append({'name': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})

    for side, p in (('user', user), ('counterpart', counterpart)):
        coords = p.get('latitude'), p.get('longitude')
        check(
            side + '_coordinates',
            all(isinstance(v, (int, float)) and math.isfinite(v) for v in coords)
            and abs(coords[0]) <= 90 and abs(coords[1]) <= 180,
            'named latitude/longitude; in-range swaps cannot be inferred without a place identifier',
        )
        if coords == (None, None):
            checks[-1].update(status='SKIP', detail='coordinates absent; no angle/house evidence admitted')
        resolved = resolve_profile_birth_datetime(p, noon_proxy=p.get('birth_time') is None)
        checks.append({
            'name': side + '_timezone_resolution',
            'status': 'PASS' if resolved.timezone_source == 'iana' else 'UNVERIFIED',
            'detail': (
                'IANA historical offset resolved exactly once'
                if resolved.timezone_source == 'iana'
                else 'legacy fixed offset applied exactly once; historical DST cannot be inferred'
            ),
        })
        if p.get('birth_time') is not None:
            utc = resolved.utc
            local = utc.astimezone(resolved.tzinfo)
            check(
                side + '_time_roundtrip',
                local.replace(tzinfo=None) == datetime.combine(p['birth_date'], p['birth_time']),
                'birth local civil time round-trips after one timezone conversion',
            )
            jd = rw._jd_from_utc(utc)
            check(
                side + '_julian_roundtrip',
                abs((rw._utc_from_jd(jd) - utc).total_seconds()) < .001,
                'Julian day / UTC roundtrip',
            )
    events = [
        e for key in RETURN_KEYS for side in ('user', 'counterpart')
        for e in support.get(key, {}).get(side, {}).get('events', [])
    ]
    check(
        'return_residual',
        bool(events) and all(float(e.get('orb', 99)) <= 1e-5 for e in events),
        'exact longitude crossing residual <= 0.00001 degrees',
    )
    check(
        'return_order',
        all(es == sorted(es) for key in RETURN_KEYS for side in ('user', 'counterpart')
            for es in [[e['exact_utc'] for e in support.get(key, {}).get(side, {}).get('events', [])]]),
        'all direct/retrograde crossings retained in chronological order',
    )
    checks.extend([
        {'name': 'coordinate_semantics', 'status': 'UNVERIFIED', 'detail': 'in-range coordinate swaps require a geocoded place identifier'},
        {
            'name': 'historical_dst_provenance',
            'status': 'PASS' if all(p.get('timezone_id') for p in (user, counterpart)) else 'UNVERIFIED',
            'detail': 'valid IANA timezone takes priority; legacy fixed offset remains explicit fallback',
        },
        {'name': 'conventions', 'status': 'PASS', 'detail': 'Swiss tropical longitude in degrees; True Node; Whole Sign primary, quadrant houses kept separate; secondary day/year=365.2422; solar arc=true progressed Sun arc'},
    ])
    return {
        'status': 'PASS' if not any(c['status'] == 'FAIL' for c in checks) else 'FAIL',
        'scope': 'implemented numerical checks; UNVERIFIED provenance is not a pass',
        'checks': checks,
    }


def _stage_policy_evaluation(stage, evidence):
    """Separate exact-date evidence from background context with auditable reasons."""
    policy = STAGE_TRIGGER_POLICY[stage]
    reasons = {}
    accepted, context = [], []

    def reject(row, reason, *, is_context=False):
        reasons[reason] = reasons.get(reason, 0) + 1
        if is_context:
            context.append(row)

    venus_context = any(
        e.get('a') == 'Venus'
        and e.get('b') in {'Moon', 'Venus', 'Sun'}
        and e.get('family') in EXACT_TRIGGER_FAMILIES
        and e.get('aspect') in DIRECT_TRIGGER_ASPECTS | CONTEXT_ONLY_ASPECTS
        and isinstance(e.get('strength'), (int, float))
        and math.isfinite(float(e['strength']))
        and float(e['strength']) >= THRESHOLDS['event_trigger']
        and isinstance(e.get('orb'), (int, float))
        and math.isfinite(float(e['orb']))
        and 0 <= float(e['orb']) < 1.0
        for e in evidence
    )
    for row in evidence:
        if row.get('a') not in policy['primary_planets']:
            if row.get('a') in policy.get('support_planets', set()) and row.get('b') in policy['targets']:
                reject(row, 'context_only_planet', is_context=True)
            else:
                reject(row, 'primary_planet_mismatch')
            continue
        if row.get('b') not in policy['targets']:
            reject(row, 'target_mismatch')
            continue
        if row.get('family') not in policy['exact_families']:
            reject(row, 'context_only_family', is_context=True)
            continue
        if row.get('aspect') in CONTEXT_ONLY_ASPECTS:
            reject(row, 'context_only_aspect', is_context=True)
            continue
        if row.get('aspect') not in policy['direct_aspects']:
            reject(row, 'aspect_mismatch')
            continue
        strength = row.get('strength')
        if not isinstance(strength, (int, float)) or not math.isfinite(float(strength)) or float(strength) < THRESHOLDS['event_trigger']:
            reject(row, 'insufficient_strength')
            continue
        orb = row.get('orb')
        if not isinstance(orb, (int, float)) or not math.isfinite(float(orb)) or not 0 <= float(orb) < 1.0:
            reject(row, 'orb_out_of_range')
            continue
        if stage == 'emotional_reactivation' and row.get('a') == 'Moon':
            if row.get('family') != 'natal_trigger':
                reject(row, 'moon_requires_natal_contact')
                continue
            if row.get('b') not in {'Moon', 'Venus'}:
                reject(row, 'moon_target_not_emotional')
                continue
            if not venus_context:
                reject(row, 'moon_requires_venus_context')
                continue
        accepted.append(row)

    accepted.sort(key=lambda e: (-float(e.get('strength', 0)), float(e.get('orb', 99)), str(e.get('event_id', ''))))
    context.sort(key=lambda e: (-float(e.get('strength', 0)), float(e.get('orb', 99)), str(e.get('event_id', ''))))
    primary = accepted[0] if accepted else None
    return {
        'accepted': accepted,
        'context': context,
        'primary': primary,
        'rejection_counts': reasons,
    }


def _stage_trigger_evidence(stage, evidence):
    return _stage_policy_evaluation(stage, evidence)['primary']


def _stage_trigger_ok(stage, evidence):
    """A stage-defining planet must itself contribute at least the event gate strength."""
    return _stage_trigger_evidence(stage, evidence) is not None


def _display_fast_evidence(stage, evidence, limit=4, evaluation=None):
    """Keep the stage-defining trigger visible even when it ranks below other fast hits."""
    evaluation = evaluation or _stage_policy_evaluation(stage, evidence)
    primary = evaluation['primary']
    accepted_ids = {row.get('event_id') for row in evaluation['accepted']}
    context_ids = {row.get('event_id') for row in evaluation['context']}

    def annotate(row):
        row = dict(row)
        row['accepted_by_stage_policy'] = row.get('event_id') in accepted_ids
        row['rejection_reason'] = None if row['accepted_by_stage_policy'] else (
            'context_only' if row.get('event_id') in context_ids else 'not_stage_defining'
        )
        return row

    out = []
    if primary is not None:
        out.append(annotate(primary))
    ordered = evaluation['accepted'] + evaluation['context'] + evidence
    for row in ordered:
        if primary is not None and row.get('event_id') == primary.get('event_id'):
            continue
        if any(existing.get('event_id') == row.get('event_id') for existing in out):
            continue
        out.append(annotate(row))
        if len(out) >= limit:
            break
    return out[:limit]


def _selection_key(row):
    c = row['components']
    d = date.fromisoformat(row['date'])
    return (
        c.get('event_trigger_raw', c.get('event_trigger', 0)),
        c.get('primary_trigger_strength', 0),
        -c.get('primary_trigger_orb', 99),
        c.get('final', 0),
        c.get('long_term', 0),
        c.get('mid_term', 0),
        -d.toordinal(),
    )


def _mark_local_peaks(rows, radius=PEAK_RADIUS_DAYS, *, min_date=None, max_date=None):
    """Mark deterministic same-stage local peaks inside the public comparison interval.

    Gate-passing days remain available for long-term activation windows. Public peak
    selection is performed only inside [min_date, max_date], so a past maximum cannot
    suppress a valid as-of-or-later candidate.
    """
    min_iso = min_date.isoformat() if isinstance(min_date, date) else None
    max_iso = max_date.isoformat() if isinstance(max_date, date) else None
    for row in rows:
        row['local_peak'] = False
        row['selection_eligible'] = False
    for stage in DIMENSIONS:
        candidates = [
            r for r in rows
            if r['stage'] == stage
            and r.get('hierarchy_eligible', r['eligible'] and r.get('stage_trigger_ok', True))
            and (min_iso is None or r['date'] >= min_iso)
            and (max_iso is None or r['date'] <= max_iso)
        ]
        for row in candidates:
            d = date.fromisoformat(row['date'])
            neighborhood = [
                x for x in candidates
                if abs((date.fromisoformat(x['date']) - d).days) <= radius
            ]
            best = max(neighborhood, key=_selection_key)
            if best is row:
                row['local_peak'] = True
                row['selection_eligible'] = True
    return rows


def _selected(row):
    return bool(row.get('selection_eligible', False))


def _mark_requested_peaks(rows, start, end, as_of):
    # Include query-external future context, but never let a past peak suppress
    # an actionable future peak. Expose only the original requested interval.
    _mark_local_peaks(rows, min_date=max(start - timedelta(days=PEAK_RADIUS_DAYS), as_of),
                      max_date=end + timedelta(days=PEAK_RADIUS_DAYS))
    for row in rows:
        if not start.isoformat() <= row['date'] <= end.isoformat():
            row['local_peak'] = row['selection_eligible'] = False


def _group_windows(rows, as_of):
    windows = []
    for stage in DIMENSIONS:
        selected = sorted(
            [r for r in rows if r['stage'] == stage and r.get('hierarchy_eligible', r['eligible'])],
            key=lambda r: r['date'],
        )
        groups = []
        for row in selected:
            if not groups or (date.fromisoformat(row['date']) - date.fromisoformat(groups[-1][-1]['date'])).days > 1:
                groups.append([])
            groups[-1].append(row)
        for group in groups:
            future = [r for r in group if r['date'] >= as_of.isoformat()]
            visible = future or group
            peak = min(visible, key=lambda r: (-r['components']['final'], r['date']))
            windows.append({
                'start': group[0]['date'],
                'end': group[-1]['date'],
                'date': peak['date'],
                'stage': stage,
                'label': DIMENSION_LABELS[stage],
                'components': peak['components'],
                'temporal_status': 'past' if not future else 'current' if group[0]['date'] <= as_of.isoformat() else 'future',
                'fast_evidence': peak['fast_evidence'],
                'period_support': peak['period_support'],
                'mid_evidence': peak['mid_evidence'],
                'medium_precision_audit': peak.get('medium_precision_audit'),
                'independent_systems': peak['components']['independent_systems'],
                'final': peak['components']['final'],
                'eligible': True,
            })
    return sorted(windows, key=lambda r: (-r['final'], r['date'], r['stage']))


def _peak_windows(rows, as_of, limit=24):
    """Display three-day neighborhoods around every selected stage-local peak."""
    eligible = [r for r in rows if _selected(r) and r['date'] >= as_of.isoformat()]
    by_key = {(r['date'], r['stage']): r for r in rows if r.get('hierarchy_eligible', r['eligible'] and r.get('stage_trigger_ok', True))}
    chosen = []
    for r in sorted(eligible, key=lambda r: (-r['components']['final'], r['date'], r['stage'])):
        d = date.fromisoformat(r['date'])
        start = d - timedelta(days=1) if ((d - timedelta(days=1)).isoformat(), r['stage']) in by_key else d
        end = d + timedelta(days=1) if ((d + timedelta(days=1)).isoformat(), r['stage']) in by_key else d
        if start < as_of:
            start = as_of
        chosen.append({
            'start': start.isoformat(),
            'end': end.isoformat(),
            'date': r['date'],
            'stage': r['stage'],
            'label': DIMENSION_LABELS[r['stage']],
            'components': r['components'],
            'fast_evidence': r['fast_evidence'],
            'period_support': r['period_support'],
            'mid_evidence': r['mid_evidence'],
            'medium_precision_audit': r.get('medium_precision_audit'),
            'independent_systems': r['components']['independent_systems'],
            'final': r['components']['final'],
            'eligible': True,
            'local_peak': True,
            'temporal_status': 'current' if start <= as_of <= end else 'future',
            'window_role': 'local_peak_three_day_neighborhood; not long-term boundaries',
        })
        if limit is not None and len(chosen) >= limit:
            break
    return chosen


def _bounded_with_nearest(rows, nearest, limit):
    """Keep the nearest public peak in bounded downstream lists without inventing a row."""
    bounded = list(rows[:limit])
    if nearest is None or any(r['date'] == nearest['date'] and r['stage'] == nearest['stage'] for r in bounded):
        return bounded
    if not bounded:
        return [nearest]
    return bounded[:-1] + [nearest]


def _selectivity_summary(rows, as_of=None):
    """Counts are sequential gates, not counterfactual scores for skipped layers."""
    as_of_iso = as_of.isoformat() if isinstance(as_of, date) else None
    def counts(items):
        n = len(items)
        values = {
            'total_days': n,
            'long_term_pass_days': sum(bool(r.get('components', {}).get('gates', {}).get('long_term', r.get('eligible', False))) for r in items),
            'medium_anchor_evaluated_days': sum(r.get('medium_anchor_evaluated', False) for r in items),
            'medium_anchor_pass_days': sum(r.get('medium_anchor_pass', False) for r in items),
            'raw_numeric_gate_pass_days': sum(r.get('raw_numeric_gate_pass', r.get('eligible', False)) for r in items),
            'semantic_stage_trigger_pass_days': sum(r.get('stage_trigger_ok', False) for r in items),
            'hierarchy_eligible_days': sum(r.get('hierarchy_eligible', False) for r in items),
            'local_peak_days': sum(_selected(r) for r in items),
        }
        for key, value in list(values.items()):
            if key != 'total_days':
                values[key.removesuffix('_days') + '_ratio'] = round(value / n, 4) if n else 0.0
        return values
    out = {}
    for stage in DIMENSIONS:
        stage_rows = [r for r in rows if r['stage'] == stage]
        values = counts(stage_rows)
        future = counts([r for r in stage_rows if as_of_iso is None or r['date'] >= as_of_iso])
        warnings = []
        if values['raw_numeric_gate_pass_ratio'] > SELECTIVITY_WARNING_RATIO:
            warnings.append('LOW_NUMERIC_GATE_SELECTIVITY')
        if values['hierarchy_eligible_ratio'] > SELECTIVITY_WARNING_RATIO:
            warnings.append('LOW_HIERARCHY_SELECTIVITY')
        if future['raw_numeric_gate_pass_days'] and not future['hierarchy_eligible_days']:
            warnings.append('NO_FUTURE_HIERARCHY_PASS')
        if future['hierarchy_eligible_days'] and not future['local_peak_days']:
            warnings.append('NO_FUTURE_PEAK')
        # Preserve v2.2/v2.3 guarded-patch aliases for downstream consumers.
        values.update(
            gate_pass_days=values['raw_numeric_gate_pass_days'],
            numeric_gate_pass_days=values['raw_numeric_gate_pass_days'],
            stage_trigger_pass_days=values['semantic_stage_trigger_pass_days'],
            hierarchy_pass_days=values['hierarchy_eligible_days'],
            gate_pass_ratio=values['raw_numeric_gate_pass_ratio'],
            hierarchy_pass_ratio=values['hierarchy_eligible_ratio'],
            future_gate_pass_days=future['raw_numeric_gate_pass_days'],
            future_numeric_gate_pass_days=future['raw_numeric_gate_pass_days'],
            future_stage_trigger_pass_days=future['semantic_stage_trigger_pass_days'],
            future_hierarchy_pass_days=future['hierarchy_eligible_days'],
        )
        out[stage] = {
            **values, **{'future_' + k: v for k, v in future.items()},
            'status': 'LOW_SELECTIVITY' if values['hierarchy_eligible_ratio'] > SELECTIVITY_WARNING_RATIO else 'OK',
            'warnings': warnings,
        }
    return out


def apply_reunion_hierarchy(
    result, user, counterpart, start, end, *, as_of_date,
    query_utc_offset_hours=None, query_timezone_id=None,
):
    """Canonical API finalizer. Inputs intentionally exclude remembered events."""
    offset = user.get('utc_offset_hours', 9) if query_utc_offset_hours is None else query_utc_offset_hours
    query_resolution = resolve_local_datetime(
        start, time(12), timezone_id=query_timezone_id, utc_offset_hours=offset
    )
    tz = query_resolution.tzinfo
    support = result.get('reunion_return_support') or {}
    validation = _validate(user, counterpart, support)
    natal_charts = {
        s: rw._profile_chart(p, allow_unknown_time=True)
        for s, p in (('user', user), ('counterpart', counterpart))
    }
    natal = {s: _points(c) for s, c in natal_charts.items()}
    profiles = {'user': user, 'counterpart': counterpart}
    birth_resolutions = {
        side: resolve_profile_birth_datetime(profile, noon_proxy=profile.get('birth_time') is None)
        for side, profile in profiles.items()
    }
    calculation_start = start - timedelta(days=PEAK_RADIUS_DAYS)
    calculation_end = end + timedelta(days=PEAK_RADIUS_DAYS)
    try:
        saju = _saju_context(user, counterpart, calculation_start, calculation_end, offset)
        validation['checks'].append({
            'name': 'saju_jie_segments',
            'status': 'PASS',
            'detail': 'exact UTC+8 solar terms transformed into query offset; annual/month/day kept separate',
        })
    except Exception as exc:
        saju = {'available': False, 'reason': str(exc)}
        validation['checks'].append({'name': 'saju_jie_segments', 'status': 'FAIL', 'detail': str(exc)})
        validation['status'] = 'FAIL'

    rows, long_windows, day_views = [], [], []
    return_cache = {}
    cursor = calculation_start
    while cursor <= calculation_end:
        instant = datetime.combine(cursor, time(12), tzinfo=tz)
        transits = _points(rw._chart_from_jd(rw._jd_from_utc(instant), include_angles=False))
        progression, arc = {}, {}
        for side, p in profiles.items():
            if not p.get('birth_time') or not rw.resolve_birth_time_reliability(p)['time_available']:
                continue
            birth = birth_resolutions[side].utc
            progressed_jd, progression[side] = _secondary_progressed_points(p, instant, birth)
            expected = rw._jd_from_utc(birth) + (instant - birth).total_seconds() / 86400 / rw.YEAR_DAYS
            if abs(progressed_jd - expected) > 1e-6:
                raise ValueError('secondary progression epoch mismatch')
            delta = (progression[side]['Sun'] - natal[side]['Sun']) % 360
            arc[side] = {k: (v + delta) % 360 for k, v in natal[side].items()}

        saju_day = _saju_for_instant(saju, instant)
        side_chart = {'positions': {k: {'lon': v} for k, v in transits.items()}, 'angles': {}}
        side_dimensions = daily_dimension_scores(
            rw._transit_hits(side_chart, natal_charts['user'], 'user'),
            rw._transit_hits(side_chart, natal_charts['counterpart'], 'counterpart'),
        )
        fast_transit_cache = {12: transits}
        geometry_cache = {}
        dims = {}
        for stage in DIMENSIONS:
            long_policy = STAGE_LONG_POLICY[stage]
            long_evidence = []
            for side, other in (('user', 'counterpart'), ('counterpart', 'user')):
                for family, charts in (('secondary', progression), ('solar_arc', arc)):
                    if side in charts:
                        long_evidence.extend(_contacts(
                            charts[side], natal[other], stage, family, side + '->' + other,
                            sources=long_policy['directed_planets'], targets=long_policy['directed_targets'],
                            limit=1.5 if family == 'secondary' else 1.0,
                            geometry_cache=geometry_cache,
                        ))
                long_evidence.extend(_contacts(
                    transits, natal[side], stage, 'slow_transit', side,
                    sources=long_policy['slow_planets'], targets=long_policy['slow_targets'], limit=1.4,
                    geometry_cache=geometry_cache,
                ))
            long_score, long_rows = _ranked_score(long_evidence)
            preserved = sorted(
                [e for e in long_evidence if e['family'] == 'secondary'],
                key=lambda e: (e['orb'], e['event_id']),
            )
            long_windows.append({
                'date': cursor.isoformat(),
                'stage': stage,
                'score': long_score,
                'progression': preserved,
                'evidence': long_rows,
            })

            long_pass = long_score >= THRESHOLDS['long_term']
            mid_context_rows, active_returns = (
                _return_evidence(support, instant, stage, natal, cache=return_cache)
                if long_pass else ([], [])
            )
            mid_score, mid_rows = _ranked_score(_mid_gate_evidence(mid_context_rows))
            mid_context_score, mid_context_ranked = _ranked_score(mid_context_rows)
            medium_precision_audit = _medium_precision_audit(mid_context_rows)
            fast_rows = []
            if long_score >= THRESHOLDS['long_term'] and mid_score >= THRESHOLDS['mid_term']:
                for hour in FAST_SAMPLE_HOURS:
                    if hour not in fast_transit_cache:
                        sample = datetime.combine(cursor, time(), tzinfo=tz) + timedelta(hours=hour)
                        fast_transit_cache[hour] = _selected_planet_points(
                            rw._jd_from_utc(sample), FAST_TRANSIT_BODIES
                        )
                    tr = fast_transit_cache[hour]
                    for side in ('user', 'counterpart'):
                        for family, points in (
                            ('natal_trigger', natal[side]),
                            ('progressed_trigger', progression.get(side, {})),
                        ):
                            fast_rows.extend(_contacts(
                                tr, points, stage, family, side,
                                sources=FAST_BY_STAGE[stage], targets=STAGE_TRIGGER_POLICY[stage]['targets'], limit=1.0,
                                geometry_cache=geometry_cache,
                            ))
                    for key, side, e in active_returns:
                        angles = {k: v for k, v in e.get('angles', {}).items() if k in {'ASC', 'DSC'}}
                        fast_rows.extend(_contacts(
                            tr, angles, stage, 'return_angle_trigger', f'{side}:{key}:{e["exact_utc"]}',
                            sources=FAST_BY_STAGE[stage], limit=1.0,
                            geometry_cache=geometry_cache,
                        ))
            all_fast_score, fast_rows = _ranked_score(fast_rows)
            trigger_evaluation = _stage_policy_evaluation(stage, fast_rows)
            event_score, direct_trigger_rows = _ranked_score(trigger_evaluation['accepted'])
            event_context_score, context_trigger_rows = _ranked_score(trigger_evaluation['context'])
            event_raw_score = _raw_ranked_score(direct_trigger_rows)
            primary_trigger = trigger_evaluation['primary']
            stage_trigger_ok = primary_trigger is not None
            display_fast = _display_fast_evidence(stage, fast_rows, evaluation=trigger_evaluation)
            raw_systems = ['western'] if long_score >= 35 and mid_score >= 25 and all_fast_score >= 12 else []
            systems = ['western'] if long_score >= 35 and mid_score >= 25 and event_score >= 12 else []
            if stage in {'emotional_reactivation', 'relationship_rebuilding'} and saju_day['cross_support']:
                systems.append('saju')
                raw_systems.append('saju')
            raw_components = score_components(long_score, mid_score, all_fast_score, raw_systems)
            components = score_components(long_score, mid_score, event_score, systems)
            components['mid_context_score'] = mid_context_score
            components['event_trigger_raw'] = event_raw_score
            components['event_context_score'] = event_context_score
            components['all_fast_context_score'] = all_fast_score
            components['primary_trigger_strength'] = round(float(primary_trigger.get('strength', 0)), 3) if primary_trigger else 0.0
            components['primary_trigger_orb'] = round(float(primary_trigger.get('orb', 99)), 6) if primary_trigger else None
            eligible = components['eligible'] and validation['status'] == 'PASS'
            hierarchy_eligible = eligible and stage_trigger_ok
            rows.append({
                'date': cursor.isoformat(),
                'stage': stage,
                'eligible': eligible,
                'hierarchy_eligible': hierarchy_eligible,
                'raw_numeric_gate_pass': raw_components['eligible'],
                'raw_numeric_components': raw_components,
                'medium_anchor_evaluated': long_pass,
                'medium_anchor_pass': long_pass and mid_score >= THRESHOLDS['mid_term'],
                'fast_trigger_evaluated': long_pass and mid_score >= THRESHOLDS['mid_term'],
                'stage_trigger_ok': stage_trigger_ok,
                'trigger_policy_trace': {
                    'accepted_by_stage_policy': stage_trigger_ok,
                    'primary_trigger': display_fast[0] if stage_trigger_ok else None,
                    'accepted_evidence_count': len(direct_trigger_rows),
                    'context_evidence_count': len(context_trigger_rows),
                    'rejection_counts': trigger_evaluation['rejection_counts'],
                },
                'components': components,
                'fast_evidence': display_fast,
                'period_support': long_rows[:5],
                'mid_evidence': mid_rows[:4],
                'mid_context_evidence': mid_context_ranked[:4],
                'medium_precision_audit': medium_precision_audit,
                'saju_context': saju_day,
            })
            dims[stage] = {
                'label': DIMENSION_LABELS[stage],
                'score': components['final'],
                'user_score': side_dimensions[stage]['user_score'],
                'counterpart_score': side_dimensions[stage]['counterpart_score'],
                'fast_trigger': hierarchy_eligible,
                'fast_evidence': display_fast,
                'user_evidence': [],
                'counterpart_evidence': [],
                'event_probability': 'not_calculated',
            }
        day_views.append({
            'date': cursor.isoformat(),
            'dimensions': dims,
            'score': 0,
            'user_score': 0,
            'counterpart_score': 0,
            'date_trigger_eligible': any(d['fast_trigger'] for d in dims.values()),
            'hits': [],
        })
        cursor += timedelta(days=1)

    public_start = max(start, as_of_date)
    _mark_requested_peaks(rows, start, end, as_of_date)
    rows = [r for r in rows if start.isoformat() <= r['date'] <= end.isoformat()]
    long_windows = [r for r in long_windows if start.isoformat() <= r['date'] <= end.isoformat()]
    day_views = [r for r in day_views if start.isoformat() <= r['date'] <= end.isoformat()]
    windows = _group_windows(rows, as_of_date)
    current_future = _peak_windows(rows, as_of_date, limit=None)
    past = _group_windows([r for r in rows if r['date'] < as_of_date.isoformat()], as_of_date)
    nearest = min(current_future, key=lambda w: (w['date'], -w['final'], w['stage']), default=None)

    stage_summary = {}
    for stage in DIMENSIONS:
        upcoming = [
            r for r in rows
            if r['stage'] == stage and r['date'] >= as_of_date.isoformat() and _selected(r)
        ]
        gate_upcoming = [
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

    static = result.get('natal_synastry', {}).get('aspects', [])
    stability = [
        e for e in static
        if e.get('a') in {'Saturn', 'Venus', 'Moon'} or e.get('b') in {'Saturn', 'Venus', 'Moon'}
    ]
    selectivity = _selectivity_summary(rows, as_of_date)
    hierarchy = {
        'version': VERSION,
        'as_of_date': as_of_date.isoformat(),
        'query_utc_offset_hours': offset,
        'timezone_provenance': {
            'user': birth_resolutions['user'].provenance(),
            'counterpart': birth_resolutions['counterpart'].provenance(),
            'query': {
                'timezone_id': query_timezone_id,
                'source': query_resolution.timezone_source,
                'resolved_utc_offset_hours': query_resolution.resolved_utc_offset_hours,
                'policy': query_resolution.policy,
            },
        },
        'validation': validation,
        'weights': WEIGHTS,
        'thresholds': THRESHOLDS,
        'selection_policy': {
            'local_peak_radius_days': PEAK_RADIUS_DAYS,
            'public_peak_start': public_start.isoformat(),
            'guard_band_days': PEAK_RADIUS_DAYS,
            'comparison_range': {'start': max(calculation_start, as_of_date).isoformat(), 'end': calculation_end.isoformat()},
            'requested_range': {'start': start.isoformat(), 'end': end.isoformat()},
            'stage_primary_triggers': {k: sorted(v) for k, v in PRIMARY_TRIGGER_BY_STAGE.items()},
            'stage_primary_targets': {k: sorted(v) for k, v in PRIMARY_TRIGGER_TARGETS_BY_STAGE.items()},
            'stage_primary_aspects': sorted(PRIMARY_TRIGGER_ASPECTS),
            'context_only_aspects': sorted(CONTEXT_ONLY_ASPECTS),
            'exact_trigger_families': sorted(EXACT_TRIGGER_FAMILIES),
            'return_angle_role': 'context_only',
            'stage_long_policy': {
                stage: {key: sorted(value) for key, value in policy.items()}
                for stage, policy in STAGE_LONG_POLICY.items()
            },
            'stage_trigger_policy': {
                stage: {key: sorted(value) if isinstance(value, set) else value for key, value in policy.items()}
                for stage, policy in STAGE_TRIGGER_POLICY.items()
            },
            'primary_trigger_min_strength': THRESHOLDS['event_trigger'],
            'medium_gate_return': 'lunar_return',
            'birth_time_precision_policy': 'provisional Lunar Return remains calculable; each candidate reports exact-only gate counterfactual without reweighting or suppressing evidence',
            'gate_evaluation': 'sequential: medium only after long; fast only after medium; skipped scores are zero, not measured counterfactuals',
            'medium_context_returns': {k: list(v) for k, v in MID_CONTEXT_RETURN_KEYS_BY_STAGE.items()},
            'fast_sample_hours': FAST_SAMPLE_HOURS,
            'cross_system': 'saju month background + same-day spouse-palace support; ranking support only',
        },
        'selectivity': selectivity,
        'score_meaning': DISCLAIMER,
        'stages': stage_summary,
        'top_periods': current_future[:3],
        'nearest_window': nearest,
        'past_windows': past,
        'current_windows': [w for w in windows if w['temporal_status'] == 'current'],
        'long_term_daily': long_windows,
        'daily_trace': rows,
        'stability_structure': {
            'support': [e for e in stability if e.get('tone') == 'supportive'][:6],
            'obstacles': [e for e in stability if e.get('tone') == 'challenging'][:6],
            'policy': '안정적 재결합을 지지·방해하는 구조이며 실제 지속 여부는 판정하지 않음',
        },
        'initiative': {
            'available': False,
            'verdict': '판정 불가',
            'reason': '차트 활성은 행동 방향의 독립 근거가 아님',
        },
        'coverage': {'western': True, 'saju': saju.get('available', False), 'ziwei': False},
        'limitations': [
            '자미두수 계산기 미구현: 교차검증에서 제외',
            '회귀 위치는 입력 출생지 기준이며 현재 거주지와 다를 수 있음',
            '일별 빠른 촉발점은 3시간 간격 표본이며 정확한 사건 발생 시각을 뜻하지 않음',
            '중기 관문은 월 단위 Lunar Return을 필수 앵커로 사용하며 다른 행성 회귀는 단계별 배경 문맥으로만 유지',
            '추정 출생시간의 Lunar Return은 provisional 근거로 계산하되 public candidate에 exact-only gate 비교를 함께 기록하며 v2.8에서는 임의 감점하지 않음',
            '조회 범위 밖 ±7일을 내부 비교하되 과거 피크는 미래 후보를 억제하지 않고 표시 날짜는 요청 범위로 제한',
            '문턱·가중치는 버전 관리되는 비교 규칙이며 적중률로 보정하지 않음',
            '장기·중기 관문 통과 후 단계별 관련 대상의 직접 촉발각이 실제 문턱 이상 기여한 ±7일 국소 피크만 공개 후보로 사용',
            '삼합·육합·퀸컹스와 회귀각 접촉은 배경 문맥이며 단독으로 정확한 날짜 후보를 만들지 않음',
        ],
        'saju_boundaries': {k: saju.get(k, []) for k in ('years', 'months')},
        'event_probability': 'not_calculated',
    }
    result['reunion_hierarchy'] = hierarchy

    future_views = [d for d in day_views if d['date'] >= as_of_date.isoformat()]
    result['reunion_dimensions'] = rw._reunion_dimension_context(future_views, max(start, as_of_date), end)
    public24 = _bounded_with_nearest(current_future, nearest, 24)
    canonical = [
        {
            **w,
            'activation': w['final'],
            'rank_weight': w['final'],
            'independent_system_count': len(w['independent_systems']),
            'convergence': len(w['independent_systems']) >= 2,
            'exact_date_basis': 'stage_specific_long_gate_then_lunar_anchor_then_direct_semantic_trigger_then_future_local_peak',
            'event_probability': 'not_calculated',
        }
        for w in public24
    ]
    result['reunion_timing_windows'] = {
        'windows': canonical,
        'as_of_date': as_of_date.isoformat(),
        'validation': validation['status'],
        'policy': 'long term → medium window → materially contributing stage-specific event trigger → future-only local peak → independent-system support; past excluded; score is not probability',
    }

    tr = result.get('reunion_transits') or {}
    top_days = _bounded_with_nearest(current_future, nearest, 18)
    tr['top_days'] = [
        {'date': w['date'], 'score': w['final'], 'components': w['components'], 'hits': w['fast_evidence']}
        for w in top_days
    ]
    tr['top_months'] = []
    tr['directional_context'] = {
        'available': True,
        'period': {'start': max(start, as_of_date).isoformat(), 'end': end.isoformat()},
        'incoming': result['reunion_dimensions']['contact_recontact']['incoming'],
        'outgoing': result['reunion_dimensions']['contact_recontact']['outgoing'],
        'reconnection': result['reunion_dimensions']['contact_recontact']['reconnection'],
        'months': [],
        'initiative_gate': {'available': False, 'verdict': 'undetermined'},
    }
    result['reunion_transits'] = tr
    result['relationship_transits'] = tr

    candidate_windows = _bounded_with_nearest(current_future, nearest, 16)
    support['candidate_dates'] = [
        {
            'date': w['date'],
            'stages': [w['stage']],
            'priority_index': w['final'],
            'components': w['components'],
            'exact_date_basis': 'stage_specific_long_gate_then_lunar_anchor_then_direct_semantic_trigger_then_future_local_peak',
            'event_probability': 'not_calculated',
        }
        for w in candidate_windows
    ]
    support['weight_policy'] = {
        'weights': WEIGHTS,
        'thresholds': THRESHOLDS,
        'meaning': 'long gate + Lunar Return medium anchor precede materially contributing semantic stage triggers; other returns stay context; public dates are future-only local peaks',
    }
    support['policy'] = '장기 관문 뒤 Lunar Return을 월 단위 중기 앵커로 사용하고, 단계별 관련 대상·주요 각의 필수 촉발이 실제 문턱 이상 기여한 뒤 기준일 이후 국소 피크만 최종 후보. 다른 행성 회귀는 배경 문맥이며 독립 체계로 중복 가산하지 않음.'
    support['as_of_date'] = as_of_date.isoformat()
    result['reunion_return_support'] = support
    return result
