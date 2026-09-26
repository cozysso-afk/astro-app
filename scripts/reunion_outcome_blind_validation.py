"""Outcome-blind validation protocol for reunion forecasts.

This module freezes case registration and public-candidate predictions before
observed outcomes are introduced. It never tunes the reunion engine and never
turns descriptive validation metrics into a predictive-generalization claim.
"""
from __future__ import annotations

from datetime import date
import hashlib
import hmac
import json
import os
import re
import sys
from typing import Any


PROTOCOL_VERSION = 'reunion-validation-v2.10-outcome-blind'
STAGES = {
    'emotional_reactivation',
    'contact_recontact',
    'in_person_meeting',
    'relationship_rebuilding',
}
REQUEST_ALLOWLIST = {
    'user',
    'counterpart',
    'start_date',
    'end_date',
    'as_of_date',
    'query_utc_offset_hours',
    'analysis_mode',
    'relationship_status',
}
FORBIDDEN_OUTCOME_KEYS = {
    'outcome',
    'outcomes',
    'label',
    'labels',
    'ground_truth',
    'event_history',
    'reunion_context',
    'observed_events',
    'actual_event',
    'actual_contact_date',
    'actual_meeting_date',
    'actual_reunion_date',
}
METRIC_SPEC = {
    'id': 'reunion-v210-fixed-descriptive-metrics',
    'event_metrics': [
        'event_inside_any_public_window',
        'event_inside_stage_matched_public_window',
    ],
    'negative_case_metrics': [
        'no_event_case_with_any_public_candidate',
    ],
    'selectivity_context': [
        'public_windows_per_case',
        'cases_with_any_public_candidate',
    ],
    'window_policy': 'use engine public candidate start/end exactly; no post-hoc tolerance',
    'claim_policy': 'descriptive evaluation only; no automatic generalization claim',
}


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def _sha(value: Any) -> str:
    return hashlib.sha256(_canonical(value).encode('utf-8')).hexdigest()


def _hmac(secret: str, value: Any) -> str:
    if not isinstance(secret, str) or len(secret) < 16:
        raise ValueError('validation secret must be at least 16 characters')
    return hmac.new(secret.encode('utf-8'), _canonical(value).encode('utf-8'), hashlib.sha256).hexdigest()


def _parse_date(value: Any, field: str) -> date:
    if not isinstance(value, str):
        raise ValueError(f'{field} must be ISO date text')
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f'{field} must be ISO date text') from None


def _request_from_item(item: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError('case must be an object')
    if isinstance(item.get('request'), dict):
        return item['request']
    calculation_json = item.get('calculation_json')
    if isinstance(calculation_json, dict) and isinstance(calculation_json.get('request'), dict):
        return calculation_json['request']
    return item


def _assert_no_outcome_fields(value: Any, path: str = 'request') -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).strip().lower()
            if normalized in FORBIDDEN_OUTCOME_KEYS or normalized.startswith('actual_') or normalized.startswith('observed_'):
                raise ValueError(f'outcome-bearing field is forbidden before prediction freeze: {path}.{key}')
            _assert_no_outcome_fields(child, f'{path}.{key}')
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _assert_no_outcome_fields(child, f'{path}[{index}]')


def _profile_without_alias(profile: Any) -> dict[str, Any]:
    if not isinstance(profile, dict):
        raise ValueError('user/counterpart profile must be an object')
    cleaned = {key: value for key, value in profile.items() if key != 'name'}
    if not cleaned.get('birth_date'):
        raise ValueError('profile requires birth_date')
    if cleaned.get('latitude') is None or cleaned.get('longitude') is None:
        raise ValueError('profile requires latitude/longitude')
    if cleaned.get('timezone_id') in (None, '') and cleaned.get('utc_offset_hours') in (None, ''):
        raise ValueError('profile requires timezone_id or utc_offset_hours')
    return cleaned


def _project_request(raw: dict[str, Any]) -> dict[str, Any]:
    _assert_no_outcome_fields(raw)
    extra = set(raw) - REQUEST_ALLOWLIST
    if extra:
        raise ValueError('pre-registration request contains non-protocol fields')
    missing = {'user', 'counterpart', 'start_date', 'end_date', 'as_of_date'} - set(raw)
    if missing:
        raise ValueError('pre-registration request is incomplete')

    start = _parse_date(raw['start_date'], 'start_date')
    end = _parse_date(raw['end_date'], 'end_date')
    as_of = _parse_date(raw['as_of_date'], 'as_of_date')
    if not (start <= as_of <= end):
        raise ValueError('as_of_date must lie inside the requested validation range')

    projected = {key: raw[key] for key in REQUEST_ALLOWLIST if key in raw}
    projected['user'] = _profile_without_alias(raw['user'])
    projected['counterpart'] = _profile_without_alias(raw['counterpart'])
    return projected


def _engine_ref(engine_ref: dict[str, Any]) -> dict[str, str]:
    if not isinstance(engine_ref, dict):
        raise ValueError('engine_ref must be an object')
    commit_sha = str(engine_ref.get('commit_sha') or '')
    engine_version = str(engine_ref.get('engine_version') or '')
    if not re.fullmatch(r'[0-9a-f]{40}', commit_sha):
        raise ValueError('engine_ref.commit_sha must be a full 40-char git SHA')
    if not engine_version:
        raise ValueError('engine_ref.engine_version is required')
    return {'commit_sha': commit_sha, 'engine_version': engine_version}


def _with_digest(payload: dict[str, Any], key: str) -> dict[str, Any]:
    unsigned = dict(payload)
    unsigned.pop(key, None)
    result = dict(unsigned)
    result[key] = _sha(unsigned)
    return result


def register_cases(items: list[dict[str, Any]], *, secret: str, engine_ref: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(items, list) or not items:
        raise ValueError('registration requires at least one case')
    ref = _engine_ref(engine_ref)
    cases = []
    seen = set()
    for item in items:
        projected = _project_request(_request_from_item(item))
        commitment = _hmac(secret, projected)
        case_id = f'case_{commitment[:24]}'
        if case_id in seen:
            raise ValueError('duplicate pre-registration case')
        seen.add(case_id)
        cases.append({
            'case_id': case_id,
            'request_commitment': commitment,
            'start_date': projected['start_date'],
            'end_date': projected['end_date'],
            'as_of_date': projected['as_of_date'],
        })
    cases.sort(key=lambda row: row['case_id'])
    manifest = {
        'protocol_version': PROTOCOL_VERSION,
        'engine_ref': ref,
        'metric_spec': METRIC_SPEC,
        'case_count': len(cases),
        'cases': cases,
        'blindness_policy': 'outcomes/event history are forbidden until predictions are frozen',
        'generalization_claim_allowed': False,
    }
    return _with_digest(manifest, 'manifest_digest')


def _verify_manifest(manifest: dict[str, Any]) -> None:
    if not isinstance(manifest, dict) or manifest.get('protocol_version') != PROTOCOL_VERSION:
        raise ValueError('invalid validation manifest')
    expected = manifest.get('manifest_digest')
    actual = _with_digest(manifest, 'manifest_digest')['manifest_digest']
    if not isinstance(expected, str) or not hmac.compare_digest(expected, actual):
        raise ValueError('manifest digest mismatch')
    if manifest.get('generalization_claim_allowed') is not False:
        raise ValueError('manifest claim policy is invalid')


def _sanitize_window(window: Any, rank: int) -> dict[str, Any]:
    if not isinstance(window, dict):
        raise ValueError('prediction window must be an object')
    _assert_no_outcome_fields(window, 'prediction')
    allowed = {'date', 'start', 'end', 'stage', 'final'}
    if set(window) - allowed:
        raise ValueError('prediction window contains non-protocol fields')
    stage = window.get('stage')
    if stage not in STAGES:
        raise ValueError('prediction window stage is invalid')
    peak = _parse_date(window.get('date'), 'prediction.date')
    start = _parse_date(window.get('start'), 'prediction.start')
    end = _parse_date(window.get('end'), 'prediction.end')
    if not (start <= peak <= end):
        raise ValueError('prediction peak must lie inside its public window')
    final = window.get('final')
    if final is not None and not isinstance(final, (int, float)):
        raise ValueError('prediction final score must be numeric')
    return {
        'rank': rank,
        'date': peak.isoformat(),
        'start': start.isoformat(),
        'end': end.isoformat(),
        'stage': stage,
        'final': final,
    }


def freeze_predictions(manifest: dict[str, Any], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    _verify_manifest(manifest)
    if not isinstance(predictions, list):
        raise ValueError('predictions must be a list')
    expected_ids = {row['case_id'] for row in manifest['cases']}
    actual_ids = {row.get('case_id') for row in predictions if isinstance(row, dict)}
    if actual_ids != expected_ids or len(predictions) != len(expected_ids):
        raise ValueError('prediction cases must exactly match the frozen manifest')

    frozen = []
    for row in predictions:
        if not isinstance(row, dict) or set(row) - {'case_id', 'windows'}:
            raise ValueError('prediction record contains non-protocol fields')
        _assert_no_outcome_fields(row, 'prediction')
        windows = row.get('windows')
        if not isinstance(windows, list):
            raise ValueError('prediction windows must be a list')
        frozen.append({
            'case_id': row['case_id'],
            'windows': [_sanitize_window(window, index + 1) for index, window in enumerate(windows)],
        })
    frozen.sort(key=lambda row: row['case_id'])
    bundle = {
        'protocol_version': PROTOCOL_VERSION,
        'manifest_digest': manifest['manifest_digest'],
        'engine_ref': manifest['engine_ref'],
        'metric_spec': manifest['metric_spec'],
        'predictions': frozen,
        'outcomes_present': False,
        'generalization_claim_allowed': False,
    }
    return _with_digest(bundle, 'prediction_digest')


def _verify_prediction_bundle(bundle: dict[str, Any]) -> None:
    if not isinstance(bundle, dict) or bundle.get('protocol_version') != PROTOCOL_VERSION:
        raise ValueError('invalid prediction bundle')
    expected = bundle.get('prediction_digest')
    actual = _with_digest(bundle, 'prediction_digest')['prediction_digest']
    if not isinstance(expected, str) or not hmac.compare_digest(expected, actual):
        raise ValueError('prediction digest mismatch')
    if bundle.get('outcomes_present') is not False or bundle.get('generalization_claim_allowed') is not False:
        raise ValueError('prediction bundle violates blindness policy')


def _event_inside(window: dict[str, Any], event_day: date) -> bool:
    return _parse_date(window['start'], 'window.start') <= event_day <= _parse_date(window['end'], 'window.end')


def evaluate_frozen_predictions(bundle: dict[str, Any], outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    _verify_prediction_bundle(bundle)
    if not isinstance(outcomes, list):
        raise ValueError('outcomes must be a list')
    prediction_by_id = {row['case_id']: row for row in bundle['predictions']}
    expected_ids = set(prediction_by_id)
    actual_ids = {row.get('case_id') for row in outcomes if isinstance(row, dict)}
    if actual_ids != expected_ids or len(outcomes) != len(expected_ids):
        raise ValueError('outcome cases must exactly match frozen predictions')

    total_windows = 0
    candidate_cases = 0
    event_count = 0
    any_window_hits = 0
    stage_matched_hits = 0
    no_event_cases = 0
    no_event_cases_with_candidate = 0
    incomplete = 0

    for outcome in outcomes:
        if not isinstance(outcome, dict) or set(outcome) - {'case_id', 'observation_complete', 'events'}:
            raise ValueError('outcome record contains non-protocol fields')
        case_id = outcome['case_id']
        complete = outcome.get('observation_complete')
        if not isinstance(complete, bool):
            raise ValueError('observation_complete must be boolean')
        events = outcome.get('events')
        if not isinstance(events, list):
            raise ValueError('events must be a list')
        if not complete:
            incomplete += 1
            continue

        windows = prediction_by_id[case_id]['windows']
        total_windows += len(windows)
        if windows:
            candidate_cases += 1
        if not events:
            no_event_cases += 1
            if windows:
                no_event_cases_with_candidate += 1
            continue

        for event in events:
            if not isinstance(event, dict) or set(event) != {'date', 'stage'}:
                raise ValueError('event must contain only date and stage')
            stage = event['stage']
            if stage not in STAGES:
                raise ValueError('event stage is invalid')
            event_day = _parse_date(event['date'], 'event.date')
            event_count += 1
            containing = [window for window in windows if _event_inside(window, event_day)]
            if containing:
                any_window_hits += 1
            if any(window['stage'] == stage for window in containing):
                stage_matched_hits += 1

    if incomplete:
        return {
            'protocol_version': PROTOCOL_VERSION,
            'status': 'INCOMPLETE_OUTCOME_SET',
            'incomplete_cases': incomplete,
            'metrics': None,
            'generalization_claim_allowed': False,
            'claim_policy': 'do not compute validation rates from an incomplete observation set',
        }

    case_count = len(expected_ids)
    metrics = {
        'cases': case_count,
        'cases_with_any_public_candidate': candidate_cases,
        'public_windows_total': total_windows,
        'public_windows_per_case': round(total_windows / case_count, 6) if case_count else None,
        'observed_events': event_count,
        'event_inside_any_public_window': any_window_hits,
        'event_inside_stage_matched_public_window': stage_matched_hits,
        'event_hit_rate_any_window': round(any_window_hits / event_count, 6) if event_count else None,
        'event_hit_rate_stage_matched': round(stage_matched_hits / event_count, 6) if event_count else None,
        'no_event_cases': no_event_cases,
        'no_event_case_with_any_public_candidate': no_event_cases_with_candidate,
        'no_event_candidate_case_rate': (
            round(no_event_cases_with_candidate / no_event_cases, 6) if no_event_cases else None
        ),
    }
    return {
        'protocol_version': PROTOCOL_VERSION,
        'status': 'DESCRIPTIVE_EVALUATION_ONLY',
        'manifest_digest': bundle['manifest_digest'],
        'prediction_digest': bundle['prediction_digest'],
        'engine_ref': bundle['engine_ref'],
        'metrics': metrics,
        'generalization_claim_allowed': False,
        'claim_policy': (
            'metrics are descriptive and must not be used to retune thresholds on the same cohort; '
            'independent replication is required before any generalization claim'
        ),
    }


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        mode = payload.get('mode')
        if mode == 'register':
            secret = os.environ.get('VALIDATION_HMAC_KEY', '')
            result = register_cases(payload.get('cases'), secret=secret, engine_ref=payload.get('engine_ref'))
        elif mode == 'freeze':
            result = freeze_predictions(payload.get('manifest'), payload.get('predictions'))
        elif mode == 'evaluate':
            result = evaluate_frozen_predictions(payload.get('bundle'), payload.get('outcomes'))
        else:
            raise ValueError('unsupported protocol mode')
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except Exception:
        print('{"status":"FAILED","detail":"outcome-blind validation failed; raw exception suppressed"}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
