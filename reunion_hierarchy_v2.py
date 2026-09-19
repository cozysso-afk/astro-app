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
from reunion_dimension_v1 import (
    daily_dimension_scores,
    DIMENSIONS,
    DIMENSION_LABELS as LEGACY_LABELS,
    TARGET_WEIGHTS,
    TRANSIT_WEIGHTS,
    ASPECT_WEIGHTS,
)

DIMENSION_LABELS = {**LEGACY_LABELS, 'relationship_rebuilding': '관계 재정의'}

VERSION = 'reunion-hierarchy-v2.1-selectivity'
WEIGHTS = dict(long_term=.35, mid_term=.25, event_trigger=.25, cross_system=.15)
THRESHOLDS = dict(long_term=35.0, mid_term=25.0, event_trigger=12.0)
PEAK_RADIUS_DAYS = 7
SELECTIVITY_WARNING_RATIO = .50
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
PRIMARY_TRIGGER_BY_STAGE = {
    'emotional_reactivation': {'Venus', 'Moon'},
    'contact_recontact': {'Mercury'},
    'in_person_meeting': {'Mars'},
    'relationship_rebuilding': {'Venus', 'Sun'},
}
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


def _contacts(source, target, stage, family, direction, *, sources=None, targets=None, limit=1.5):
    out = []
    for a, lon in source.items():
        if sources is not None and a not in sources:
            continue
        for b, natal in target.items():
            if targets is not None and b not in targets:
                continue
            dist = rw._angle_distance(lon, natal)
            for aspect, angle in rw.ASPECTS.items():
                orb = abs(dist - angle)
                if orb >= limit:
                    continue
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


def _return_evidence(support, instant, stage, natal):
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
                f'{side}:{key}:{e["exact_utc"]}',
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
                        'event_id': f'return_house:{side}:{key}:{e["exact_utc"]}:{h["planet"]}',
                        'family': 'return_house',
                        'system': 'western',
                        'a': h['planet'],
                        'house_system': 'Whole Sign',
                        'house': h['whole_sign'],
                        'strength': 12.0,
                        'tone': 'context',
                    })
    return rows, active


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
        offset = p.get('utc_offset_hours', 9)
        coords = p.get('latitude'), p.get('longitude')
        check(
            side + '_coordinates',
            all(isinstance(v, (int, float)) and math.isfinite(v) for v in coords)
            and abs(coords[0]) <= 90 and abs(coords[1]) <= 180,
            'named latitude/longitude; in-range swaps cannot be inferred without a place identifier',
        )
        if coords == (None, None):
            checks[-1].update(status='SKIP', detail='coordinates absent; no angle/house evidence admitted')
        check(
            side + '_offset',
            isinstance(offset, (int, float)) and math.isfinite(offset) and -14 <= offset <= 14,
            'fixed entered historical UTC offset; no automatic DST inference',
        )
        if p.get('birth_time') is not None:
            utc = rw._utc_datetime(p['birth_date'], p['birth_time'], offset)
            local = utc.astimezone(timezone(timedelta(hours=offset)))
            check(
                side + '_time_roundtrip',
                local.replace(tzinfo=None) == datetime.combine(p['birth_date'], p['birth_time']),
                'UTC applied exactly once; includes fractional/zero offsets',
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
        {'name': 'historical_dst_provenance', 'status': 'UNVERIFIED', 'detail': 'profile provides fixed UTC offset, not IANA zone or historical DST provenance'},
        {'name': 'conventions', 'status': 'PASS', 'detail': 'Swiss tropical longitude in degrees; True Node; Whole Sign primary, quadrant houses kept separate; secondary day/year=365.2422; solar arc=true progressed Sun arc'},
    ])
    return {
        'status': 'PASS' if not any(c['status'] == 'FAIL' for c in checks) else 'FAIL',
        'scope': 'implemented numerical checks; UNVERIFIED provenance is not a pass',
        'checks': checks,
    }


def _stage_trigger_ok(stage, evidence):
    """Require at least one stage-defining fast planet, not merely any fast hit."""
    required = PRIMARY_TRIGGER_BY_STAGE[stage]
    return any(e.get('a') in required for e in evidence)


def _selection_key(row):
    c = row['components']
    d = date.fromisoformat(row['date'])
    return (
        c.get('event_trigger', 0),
        c.get('final', 0),
        c.get('long_term', 0),
        c.get('mid_term', 0),
        -d.toordinal(),
    )


def _mark_local_peaks(rows, radius=PEAK_RADIUS_DAYS):
    """Mark one deterministic local peak per same-stage ±radius neighborhood.

    This is a structural selector, not another score cutoff. Gate-passing days can
    remain visible as long-term activation, but only local fast-trigger maxima are
    admitted to public timing candidates.
    """
    for row in rows:
        row['local_peak'] = False
        row['selection_eligible'] = False
    for stage in DIMENSIONS:
        candidates = [
            r for r in rows
            if r['stage'] == stage and r['eligible'] and r.get('stage_trigger_ok', True)
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
    return row.get('selection_eligible', row.get('eligible', False))


def _group_windows(rows, as_of):
    windows = []
    for stage in DIMENSIONS:
        selected = sorted([r for r in rows if r['stage'] == stage and r['eligible']], key=lambda r: r['date'])
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
                'independent_systems': peak['components']['independent_systems'],
                'final': peak['components']['final'],
                'eligible': True,
            })
    return sorted(windows, key=lambda r: (-r['final'], r['date'], r['stage']))


def _peak_windows(rows, as_of, limit=24):
    """Display local three-day neighborhoods around selected local peaks."""
    eligible = [r for r in rows if _selected(r) and r['date'] >= as_of.isoformat()]
    by_key = {(r['date'], r['stage']): r for r in rows if r['eligible']}
    chosen = []
    for r in sorted(eligible, key=lambda r: (-r['components']['final'], r['date'], r['stage'])):
        d = date.fromisoformat(r['date'])
        if any(abs((d - date.fromisoformat(w['date'])).days) <= 2 for w in chosen):
            continue
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
            'independent_systems': r['components']['independent_systems'],
            'final': r['components']['final'],
            'eligible': True,
            'local_peak': True,
            'temporal_status': 'current' if start <= as_of <= end else 'future',
            'window_role': 'local_peak_three_day_neighborhood; not long-term boundaries',
        })
        if len(chosen) >= limit:
            break
    return chosen


def _selectivity_summary(rows):
    total_days = max(1, len({r['date'] for r in rows}))
    out = {}
    for stage in DIMENSIONS:
        stage_rows = [r for r in rows if r['stage'] == stage]
        gate_count = sum(1 for r in stage_rows if r['eligible'])
        peak_count = sum(1 for r in stage_rows if _selected(r))
        gate_ratio = gate_count / total_days
        out[stage] = {
            'gate_pass_days': gate_count,
            'local_peak_days': peak_count,
            'total_days': total_days,
            'gate_pass_ratio': round(gate_ratio, 4),
            'status': 'LOW_SELECTIVITY' if gate_ratio > SELECTIVITY_WARNING_RATIO else 'OK',
        }
    return out


def apply_reunion_hierarchy(result, user, counterpart, start, end, *, as_of_date, query_utc_offset_hours=None):
    """Canonical API finalizer. Inputs intentionally exclude remembered events."""
    offset = user.get('utc_offset_hours', 9) if query_utc_offset_hours is None else query_utc_offset_hours
    tz = timezone(timedelta(hours=offset))
    support = result.get('reunion_return_support') or {}
    validation = _validate(user, counterpart, support)
    natal_charts = {
        s: rw._profile_chart(p, allow_unknown_time=True)
        for s, p in (('user', user), ('counterpart', counterpart))
    }
    natal = {s: _points(c) for s, c in natal_charts.items()}
    profiles = {'user': user, 'counterpart': counterpart}
    try:
        saju = _saju_context(user, counterpart, start, end, offset)
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
    cursor = start
    while cursor <= end:
        instant = datetime.combine(cursor, time(12), tzinfo=tz)
        transits = _points(rw._chart_from_jd(rw._jd_from_utc(instant), include_angles=False))
        progression, arc = {}, {}
        for side, p in profiles.items():
            if not p.get('birth_time') or not rw.resolve_birth_time_reliability(p)['time_available']:
                continue
            pc = rw._secondary_progressed_chart(p, instant, include_angles=False)
            progression[side] = _points(pc, False)
            birth = rw._utc_datetime(p['birth_date'], p['birth_time'], p.get('utc_offset_hours', 9))
            expected = rw._jd_from_utc(birth) + (instant - birth).total_seconds() / 86400 / rw.YEAR_DAYS
            if abs(pc['jd_ut'] - expected) > 1e-6:
                raise ValueError('secondary progression epoch mismatch')
            delta = (progression[side]['Sun'] - natal[side]['Sun']) % 360
            arc[side] = {k: (v + delta) % 360 for k, v in natal[side].items()}

        saju_day = _saju_for_instant(saju, instant)
        side_chart = {'positions': {k: {'lon': v} for k, v in transits.items()}, 'angles': {}}
        side_dimensions = daily_dimension_scores(
            rw._transit_hits(side_chart, natal_charts['user'], 'user'),
            rw._transit_hits(side_chart, natal_charts['counterpart'], 'counterpart'),
        )
        dims = {}
        for stage in DIMENSIONS:
            long_evidence = []
            for side, other in (('user', 'counterpart'), ('counterpart', 'user')):
                for family, charts in (('secondary', progression), ('solar_arc', arc)):
                    if side in charts:
                        long_evidence.extend(_contacts(
                            charts[side], natal[other], stage, family, side + '->' + other,
                            sources=PERSONAL, targets=TARGETS,
                            limit=1.5 if family == 'secondary' else 1.0,
                        ))
                long_evidence.extend(_contacts(
                    transits, natal[side], stage, 'slow_transit', side,
                    sources=SLOW, targets=TARGETS, limit=1.4,
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

            mid_rows, active_returns = _return_evidence(support, instant, stage, natal)
            mid_score, mid_rows = _ranked_score(mid_rows)
            fast_rows = []
            if long_score >= THRESHOLDS['long_term'] and mid_score >= THRESHOLDS['mid_term']:
                for hour in (0, 6, 12, 18, 23.999):
                    sample = datetime.combine(cursor, time(), tzinfo=tz) + timedelta(hours=hour)
                    tr = _points(rw._chart_from_jd(rw._jd_from_utc(sample), include_angles=False))
                    for side in ('user', 'counterpart'):
                        for family, points in (
                            ('natal_trigger', natal[side]),
                            ('progressed_trigger', progression.get(side, {})),
                        ):
                            fast_rows.extend(_contacts(
                                tr, points, stage, family, side,
                                sources=FAST_BY_STAGE[stage], targets=TARGETS | {'Mars'}, limit=1.0,
                            ))
                    for key, side, e in active_returns:
                        angles = {k: v for k, v in e.get('angles', {}).items() if k in {'ASC', 'DSC'}}
                        fast_rows.extend(_contacts(
                            tr, angles, stage, 'return_angle_trigger', f'{side}:{key}:{e["exact_utc"]}',
                            sources=FAST_BY_STAGE[stage], limit=1.0,
                        ))
            event_score, fast_rows = _ranked_score(fast_rows)
            stage_trigger_ok = _stage_trigger_ok(stage, fast_rows)
            systems = ['western'] if long_score >= 35 and mid_score >= 25 and event_score >= 12 else []
            if stage in {'emotional_reactivation', 'relationship_rebuilding'} and saju_day['cross_support']:
                systems.append('saju')
            components = score_components(long_score, mid_score, event_score, systems)
            eligible = components['eligible'] and validation['status'] == 'PASS'
            rows.append({
                'date': cursor.isoformat(),
                'stage': stage,
                'eligible': eligible,
                'stage_trigger_ok': stage_trigger_ok,
                'components': components,
                'fast_evidence': fast_rows[:4],
                'period_support': long_rows[:5],
                'mid_evidence': mid_rows[:4],
                'saju_context': saju_day,
            })
            dims[stage] = {
                'label': DIMENSION_LABELS[stage],
                'score': components['final'],
                'user_score': side_dimensions[stage]['user_score'],
                'counterpart_score': side_dimensions[stage]['counterpart_score'],
                'fast_trigger': eligible and stage_trigger_ok,
                'fast_evidence': fast_rows[:4],
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

    _mark_local_peaks(rows)
    windows = _group_windows(rows, as_of_date)
    current_future = _peak_windows(rows, as_of_date)
    past = _group_windows([r for r in rows if r['date'] < as_of_date.isoformat()], as_of_date)
    future_selected = [r for r in rows if _selected(r) and r['date'] >= as_of_date.isoformat()]
    nearest_row = min(future_selected, key=lambda r: (r['date'], -r['components']['final'], r['stage']), default=None)
    nearest = (_peak_windows([nearest_row], as_of_date, 1) or [None])[0] if nearest_row else None

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
        stage_summary[stage] = {
            'label': DIMENSION_LABELS[stage],
            'activation': max((r['components']['final'] for r in upcoming), default=None),
            'candidate_count': len(upcoming),
            'gate_pass_count': len(gate_upcoming),
        }

    static = result.get('natal_synastry', {}).get('aspects', [])
    stability = [
        e for e in static
        if e.get('a') in {'Saturn', 'Venus', 'Moon'} or e.get('b') in {'Saturn', 'Venus', 'Moon'}
    ]
    selectivity = _selectivity_summary(rows)
    hierarchy = {
        'version': VERSION,
        'as_of_date': as_of_date.isoformat(),
        'query_utc_offset_hours': offset,
        'validation': validation,
        'weights': WEIGHTS,
        'thresholds': THRESHOLDS,
        'selection_policy': {
            'local_peak_radius_days': PEAK_RADIUS_DAYS,
            'stage_primary_triggers': {k: sorted(v) for k, v in PRIMARY_TRIGGER_BY_STAGE.items()},
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
            '일별 촉발점은 6시간 간격 표본; 정확한 사건 발생 시각을 뜻하지 않음',
            '문턱·가중치는 버전 관리되는 비교 규칙이며 적중률로 보정하지 않음',
            '장기·중기 관문 통과일 중 단계별 빠른 촉발의 ±7일 국소 피크만 공개 후보로 사용',
        ],
        'saju_boundaries': {k: saju.get(k, []) for k in ('years', 'months')},
        'event_probability': 'not_calculated',
    }
    result['reunion_hierarchy'] = hierarchy

    future_views = [d for d in day_views if d['date'] >= as_of_date.isoformat()]
    result['reunion_dimensions'] = rw._reunion_dimension_context(future_views, max(start, as_of_date), end)
    canonical = [
        {
            **w,
            'activation': w['final'],
            'rank_weight': w['final'],
            'independent_system_count': len(w['independent_systems']),
            'convergence': len(w['independent_systems']) >= 2,
            'exact_date_basis': 'hierarchical_gates_then_stage_trigger_then_local_peak',
            'event_probability': 'not_calculated',
        }
        for w in current_future
    ]
    if nearest and not any(w['date'] == nearest['date'] and w['stage'] == nearest['stage'] for w in canonical):
        canonical = canonical[:23] + [{
            **nearest,
            'activation': nearest['final'],
            'rank_weight': nearest['final'],
            'exact_date_basis': 'hierarchical_gates_then_stage_trigger_then_local_peak',
        }]
    result['reunion_timing_windows'] = {
        'windows': canonical[:24],
        'as_of_date': as_of_date.isoformat(),
        'validation': validation['status'],
        'policy': 'long term → medium window → stage-specific event trigger → local peak → independent-system support; past excluded; score is not probability',
    }

    tr = result.get('reunion_transits') or {}
    tr['top_days'] = [
        {'date': w['date'], 'score': w['final'], 'components': w['components'], 'hits': w['fast_evidence']}
        for w in current_future[:18]
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

    support['candidate_dates'] = [
        {
            'date': w['date'],
            'stages': [w['stage']],
            'priority_index': w['final'],
            'components': w['components'],
            'exact_date_basis': 'hierarchical_gates_then_stage_trigger_then_local_peak',
            'event_probability': 'not_calculated',
        }
        for w in current_future[:16]
    ]
    support['weight_policy'] = {
        'weights': WEIGHTS,
        'thresholds': THRESHOLDS,
        'meaning': 'long and medium gates precede stage-specific fast triggers; public dates are local peaks; no 85/15 fallback',
    }
    support['policy'] = '장기·중기 관문과 단계별 촉발을 통과한 뒤 주변 대비 국소 피크인 날짜만 최종 후보. 회귀는 서양 내부 근거이며 독립 체계로 중복 가산하지 않음.'
    support['as_of_date'] = as_of_date.isoformat()
    result['reunion_return_support'] = support
    return result
