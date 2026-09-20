import json

import pytest

from scripts.reunion_generalization_audit import audit_requests


def profile(name, birth_date='1990-01-01', birth_time='12:00', lat=37.5, lon=127.0, offset=9):
    return {
        'name': name,
        'birth_date': birth_date,
        'birth_time': birth_time,
        'latitude': lat,
        'longitude': lon,
        'utc_offset_hours': offset,
        'time_known': True,
        'time_confidence': 'exact',
        'time_source': 'user',
    }


def request(user, counterpart):
    return {'user': user, 'counterpart': counterpart, 'start_date': '2027-01-01', 'end_date': '2027-12-31'}


def test_alias_and_birth_time_variants_collapse_to_one_profile_core():
    u1 = profile('USER-SENTINEL', birth_time='07:00')
    c1 = profile('ALIAS-A-SENTINEL', birth_date='1992-02-02', birth_time='08:00')
    c2 = profile('ALIAS-B-SENTINEL', birth_date='1992-02-02', birth_time='19:55')
    c2['time_confidence'] = 'rectified'
    c2['rectified_window'] = ['19:30', '20:10']
    report = audit_requests([request(u1, c1), request(u1, c2)])
    assert report['distinct_user_cores'] == 1
    assert report['distinct_counterpart_cores'] == 1
    assert report['distinct_couple_cores'] == 1
    assert report['diversity_class'] == 'single_pair'
    assert report['status'] == 'INSUFFICIENT_DIVERSITY'
    assert report['profile_groups_with_name_aliases'] == 1
    assert report['profile_groups_with_birth_time_variants'] == 1


def test_different_birth_profile_creates_distinct_counterpart_core():
    user = profile('U')
    a = profile('A', birth_date='1992-02-02')
    b = profile('B', birth_date='1993-03-03')
    report = audit_requests([request(user, a), request(user, b)])
    assert report['distinct_user_cores'] == 1
    assert report['distinct_counterpart_cores'] == 2
    assert report['distinct_couple_cores'] == 2
    assert report['diversity_class'] == 'same_user_multiple_counterparts'
    assert report['status'] == 'INSUFFICIENT_DIVERSITY'


def test_coordinate_change_creates_distinct_profile_core():
    user = profile('U')
    a = profile('A', birth_date='1992-02-02', lat=35.1, lon=129.1)
    b = profile('B', birth_date='1992-02-02', lat=35.2, lon=129.1)
    report = audit_requests([request(user, a), request(user, b)])
    assert report['distinct_counterpart_cores'] == 2


def test_multi_user_multi_counterpart_is_only_auditable_not_verified():
    pairs = [
        request(profile('U1', birth_date='1988-01-01'), profile('C1', birth_date='1989-01-01')),
        request(profile('U2', birth_date='1990-01-01'), profile('C2', birth_date='1991-01-01')),
    ]
    report = audit_requests(pairs)
    assert report['diversity_class'] == 'multi_user_multi_counterpart'
    assert report['status'] == 'AUDITABLE_DIVERSE_COHORT'
    assert report['generalization_claim_allowed'] is False


def test_report_never_emits_raw_profile_values_or_fingerprints():
    user = profile('PRIVATE-NAME-XYZ', birth_date='1987-04-05', lat=12.345678, lon=98.765432)
    counterpart = profile('PRIVATE-COUNTERPART-XYZ', birth_date='1986-06-07', lat=22.222222, lon=88.888888)
    dumped = json.dumps(audit_requests([request(user, counterpart)]), sort_keys=True)
    for sentinel in ('PRIVATE-NAME-XYZ', 'PRIVATE-COUNTERPART-XYZ', '1987-04-05', '1986-06-07', '12.345678', '98.765432'):
        assert sentinel not in dumped


def test_order_is_deterministic_for_aggregate_report():
    a = request(profile('U1', birth_date='1988-01-01'), profile('C1', birth_date='1989-01-01'))
    b = request(profile('U2', birth_date='1990-01-01'), profile('C2', birth_date='1991-01-01'))
    assert audit_requests([a, b]) == audit_requests([b, a])


def test_wrapped_saved_row_request_is_supported():
    wrapped = {'calculation_json': {'request': request(profile('U'), profile('C', birth_date='1992-02-02'))}}
    report = audit_requests([wrapped])
    assert report['rows'] == 1
    assert report['distinct_couple_cores'] == 1


def test_missing_profile_core_fails_closed():
    bad = request(profile('U'), {'name': 'C', 'birth_date': '1992-02-02'})
    with pytest.raises(ValueError):
        audit_requests([bad])


def test_empty_batch_fails_closed():
    with pytest.raises(ValueError):
        audit_requests([])
