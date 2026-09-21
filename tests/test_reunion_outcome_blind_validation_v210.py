import json

import pytest

from scripts.reunion_outcome_blind_validation import (
    PROTOCOL_VERSION,
    evaluate_frozen_predictions,
    freeze_predictions,
    register_cases,
)


SECRET = 'test-validation-secret-0123456789'
ENGINE_REF = {
    'commit_sha': 'a' * 40,
    'engine_version': 'reunion-hierarchy-v2.8-birth-time-precision-audit',
}


def profile(name='PRIVATE-NAME', birth_date='1990-01-01', birth_time='12:00', lat=37.5, lon=127.0):
    return {
        'name': name,
        'birth_date': birth_date,
        'birth_time': birth_time,
        'latitude': lat,
        'longitude': lon,
        'utc_offset_hours': 9,
        'time_known': True,
        'time_confidence': 'exact',
        'time_source': 'user',
    }


def request(user=None, counterpart=None):
    return {
        'user': user or profile('USER-PRIVATE', birth_date='1991-01-01', birth_time='07:26'),
        'counterpart': counterpart or profile('COUNTERPART-PRIVATE', birth_date='1992-02-02', birth_time='19:55'),
        'start_date': '2027-01-01',
        'end_date': '2027-12-31',
        'as_of_date': '2027-06-01',
        'analysis_mode': 'reunion',
        'relationship_status': 'past_relationship',
    }


def window(stage='contact_recontact', peak='2027-07-10', start='2027-07-03', end='2027-07-17', final=66.0):
    return {'date': peak, 'start': start, 'end': end, 'stage': stage, 'final': final}


def manifest_for(*requests):
    return register_cases(list(requests), secret=SECRET, engine_ref=ENGINE_REF)


def test_registration_is_alias_invariant_but_birth_time_sensitive():
    a = request(counterpart=profile('ALIAS-A', birth_date='1992-02-02', birth_time='19:55'))
    b = request(counterpart=profile('ALIAS-B', birth_date='1992-02-02', birth_time='19:55'))
    c = request(counterpart=profile('ALIAS-C', birth_date='1992-02-02', birth_time='19:33'))
    ma = manifest_for(a)
    mb = manifest_for(b)
    mc = manifest_for(c)
    assert ma['cases'][0]['case_id'] == mb['cases'][0]['case_id']
    assert ma['cases'][0]['request_commitment'] == mb['cases'][0]['request_commitment']
    assert ma['cases'][0]['case_id'] != mc['cases'][0]['case_id']


def test_registration_rejects_outcome_bearing_context_before_freeze():
    leaked = request()
    leaked['reunion_context'] = {'actual_contact_date': '2027-07-10'}
    with pytest.raises(ValueError):
        manifest_for(leaked)


def test_registration_rejects_nested_observed_or_actual_fields():
    leaked = request()
    leaked['counterpart']['observed_events'] = [{'date': '2027-07-10'}]
    with pytest.raises(ValueError):
        manifest_for(leaked)


def test_manifest_does_not_emit_raw_names_birth_data_or_coordinates():
    raw = request(
        user=profile('USER-SENTINEL-XYZ', birth_date='1987-04-05', lat=12.345678, lon=98.765432),
        counterpart=profile('COUNTERPART-SENTINEL-XYZ', birth_date='1986-06-07', lat=22.222222, lon=88.888888),
    )
    dumped = json.dumps(manifest_for(raw), sort_keys=True)
    for sentinel in (
        'USER-SENTINEL-XYZ', 'COUNTERPART-SENTINEL-XYZ',
        '1987-04-05', '1986-06-07', '12.345678', '98.765432', '22.222222', '88.888888',
    ):
        assert sentinel not in dumped


def test_manifest_digest_detects_tampering_before_prediction_freeze():
    manifest = manifest_for(request())
    tampered = dict(manifest)
    tampered['engine_ref'] = dict(tampered['engine_ref'])
    tampered['engine_ref']['engine_version'] = 'changed-after-registration'
    case_id = manifest['cases'][0]['case_id']
    with pytest.raises(ValueError):
        freeze_predictions(tampered, [{'case_id': case_id, 'windows': [window()]}])


def test_prediction_freeze_requires_exact_manifest_case_coverage():
    manifest = manifest_for(request())
    with pytest.raises(ValueError):
        freeze_predictions(manifest, [])


def test_prediction_bundle_detects_tampering_before_evaluation():
    manifest = manifest_for(request())
    case_id = manifest['cases'][0]['case_id']
    bundle = freeze_predictions(manifest, [{'case_id': case_id, 'windows': [window()]}])
    bundle['predictions'][0]['windows'][0]['start'] = '2027-07-04'
    outcomes = [{'case_id': case_id, 'observation_complete': True, 'events': []}]
    with pytest.raises(ValueError):
        evaluate_frozen_predictions(bundle, outcomes)


def test_complete_evaluation_uses_frozen_windows_and_reports_selectivity_burden():
    r1 = request()
    r2 = request(counterpart=profile('OTHER', birth_date='1993-03-03', birth_time='08:10'))
    manifest = manifest_for(r1, r2)
    ids = [row['case_id'] for row in manifest['cases']]
    bundle = freeze_predictions(manifest, [
        {'case_id': ids[0], 'windows': [window()]},
        {'case_id': ids[1], 'windows': [window(stage='emotional_reactivation', peak='2027-09-01', start='2027-08-25', end='2027-09-08')]},
    ])
    outcomes = [
        {'case_id': ids[0], 'observation_complete': True, 'events': [{'date': '2027-07-10', 'stage': 'contact_recontact'}]},
        {'case_id': ids[1], 'observation_complete': True, 'events': []},
    ]
    report = evaluate_frozen_predictions(bundle, outcomes)
    metrics = report['metrics']
    assert report['protocol_version'] == PROTOCOL_VERSION
    assert report['status'] == 'DESCRIPTIVE_EVALUATION_ONLY'
    assert report['generalization_claim_allowed'] is False
    assert metrics['observed_events'] == 1
    assert metrics['event_inside_any_public_window'] == 1
    assert metrics['event_inside_stage_matched_public_window'] == 1
    assert metrics['no_event_cases'] == 1
    assert metrics['no_event_case_with_any_public_candidate'] == 1
    assert metrics['public_windows_per_case'] == 1.0


def test_wrong_stage_counts_any_window_hit_but_not_stage_matched_hit():
    manifest = manifest_for(request())
    case_id = manifest['cases'][0]['case_id']
    bundle = freeze_predictions(manifest, [{'case_id': case_id, 'windows': [window(stage='contact_recontact')]}])
    report = evaluate_frozen_predictions(bundle, [
        {'case_id': case_id, 'observation_complete': True, 'events': [{'date': '2027-07-10', 'stage': 'in_person_meeting'}]},
    ])
    assert report['metrics']['event_inside_any_public_window'] == 1
    assert report['metrics']['event_inside_stage_matched_public_window'] == 0


def test_incomplete_observation_set_suppresses_validation_rates():
    manifest = manifest_for(request())
    case_id = manifest['cases'][0]['case_id']
    bundle = freeze_predictions(manifest, [{'case_id': case_id, 'windows': [window()]}])
    report = evaluate_frozen_predictions(bundle, [
        {'case_id': case_id, 'observation_complete': False, 'events': []},
    ])
    assert report['status'] == 'INCOMPLETE_OUTCOME_SET'
    assert report['metrics'] is None
    assert report['generalization_claim_allowed'] is False


def test_registration_order_is_deterministic():
    a = request(counterpart=profile('A', birth_date='1992-02-02'))
    b = request(counterpart=profile('B', birth_date='1993-03-03'))
    assert manifest_for(a, b) == manifest_for(b, a)
