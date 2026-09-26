"""Privacy-preserving cohort diversity audit for reunion validation cases.

This module does not score reunion candidates and does not modify engine outputs.
It only answers whether a batch contains meaningfully distinct profile cores.
Raw names, birth data, coordinates, offsets, and fingerprints are never emitted.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, InvalidOperation
import hashlib
import json
import sys
from typing import Any


PROFILE_CORE_KEYS = ('birth_date', 'latitude', 'longitude')
TIME_VARIANT_KEYS = (
    'birth_time', 'time_known', 'time_confidence', 'time_source', 'rectified_window'
)


def _request_from_item(item: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError('each audit item must be an object')
    if isinstance(item.get('request'), dict):
        return item['request']
    calculation_json = item.get('calculation_json')
    if isinstance(calculation_json, dict) and isinstance(calculation_json.get('request'), dict):
        return calculation_json['request']
    return item


def _normal_number(value: Any) -> str:
    try:
        number = Decimal(str(value)).quantize(Decimal('0.000001'))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError('profile coordinates/offsets must be numeric') from None
    return format(number.normalize(), 'f')


def _profile_core(profile: dict[str, Any]) -> dict[str, str]:
    if not isinstance(profile, dict):
        raise ValueError('profile must be an object')
    missing = [key for key in PROFILE_CORE_KEYS if profile.get(key) in (None, '')]
    if missing:
        raise ValueError('profile core is incomplete')
    timezone_id = profile.get('timezone_id')
    offset = profile.get('utc_offset_hours')
    if timezone_id in (None, '') and offset in (None, ''):
        raise ValueError('profile core requires timezone_id or utc_offset_hours')
    core = {
        'birth_date': str(profile['birth_date']),
        'latitude': _normal_number(profile['latitude']),
        'longitude': _normal_number(profile['longitude']),
    }
    if timezone_id not in (None, ''):
        core['timezone_id'] = str(timezone_id)
    else:
        core['utc_offset_hours'] = _normal_number(offset)
    return core


def _digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def _time_variant(profile: dict[str, Any]) -> str:
    return _digest({key: profile.get(key) for key in TIME_VARIANT_KEYS})


def audit_requests(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(items, list) or not items:
        raise ValueError('audit requires at least one request')

    user_cores: set[str] = set()
    counterpart_cores: set[str] = set()
    couple_cores: set[str] = set()
    names_by_core: dict[tuple[str, str], set[str]] = defaultdict(set)
    times_by_core: dict[tuple[str, str], set[str]] = defaultdict(set)

    for item in items:
        request = _request_from_item(item)
        user = request.get('user')
        counterpart = request.get('counterpart')
        if not isinstance(user, dict) or not isinstance(counterpart, dict):
            raise ValueError('request requires user and counterpart profiles')

        user_key = _digest(_profile_core(user))
        counterpart_key = _digest(_profile_core(counterpart))
        couple_key = _digest({'user': user_key, 'counterpart': counterpart_key})
        user_cores.add(user_key)
        counterpart_cores.add(counterpart_key)
        couple_cores.add(couple_key)

        for side, profile, core_key in (
            ('user', user, user_key), ('counterpart', counterpart, counterpart_key)
        ):
            name = profile.get('name')
            if name not in (None, ''):
                names_by_core[(side, core_key)].add(_digest(str(name)))
            times_by_core[(side, core_key)].add(_time_variant(profile))

    user_count = len(user_cores)
    counterpart_count = len(counterpart_cores)
    couple_count = len(couple_cores)
    if couple_count == 1:
        diversity_class = 'single_pair'
    elif user_count == 1:
        diversity_class = 'same_user_multiple_counterparts'
    elif counterpart_count == 1:
        diversity_class = 'multiple_users_same_counterpart'
    else:
        diversity_class = 'multi_user_multi_counterpart'

    status = (
        'AUDITABLE_DIVERSE_COHORT'
        if diversity_class == 'multi_user_multi_counterpart'
        else 'INSUFFICIENT_DIVERSITY'
    )
    alias_variant_groups = sum(1 for values in names_by_core.values() if len(values) > 1)
    time_variant_groups = sum(1 for values in times_by_core.values() if len(values) > 1)

    return {
        'status': status,
        'diversity_class': diversity_class,
        'rows': len(items),
        'distinct_user_cores': user_count,
        'distinct_counterpart_cores': counterpart_count,
        'distinct_couple_cores': couple_count,
        'profile_groups_with_name_aliases': alias_variant_groups,
        'profile_groups_with_birth_time_variants': time_variant_groups,
        'criteria': {
            'multiple_couples': couple_count > 1,
            'multiple_users': user_count > 1,
            'multiple_counterparts': counterpart_count > 1,
        },
        'generalization_claim_allowed': False,
        'claim_policy': (
            'cohort diversity is necessary but never sufficient to claim predictive '
            'generalization; outcome validation on independent cases is required'
        ),
        'privacy_policy': 'aggregate counts only; raw profile values and fingerprints are not emitted',
    }


def main() -> int:
    try:
        items = json.load(sys.stdin)
        report = audit_requests(items)
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except Exception:
        print('{"status":"FAILED","detail":"generalization audit failed; raw exception suppressed"}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
