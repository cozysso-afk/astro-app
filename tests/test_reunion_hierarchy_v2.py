from datetime import date, datetime, time, timedelta, timezone
from copy import deepcopy
import inspect
import math

import pytest
import relationship_return_v1 as rr
import reunion_hierarchy_v2 as h
from reunion_dimension_v1 import secondary_support


def test_fast_exact_cannot_win_without_long_and_mid_gates():
    fast_only = h.score_components(0,100,100,['western','saju'])
    weak_mid = h.score_components(100,0,100,['western','saju'])
    supported = h.score_components(40,30,20,['western'])
    assert not fast_only['eligible'] and not weak_mid['eligible']
    assert supported['eligible']
    assert fast_only['convergence_bonus']==0
    assert fast_only['gate_multiplier']==.55


def test_same_astronomical_event_is_not_an_independent_system():
    a = h.score_components(60,50,70,['western','western','secondary','return','transit'])
    assert a['cross_system']==0
    assert a['independent_systems']==['western']
    b = h.score_components(60,50,70,['western','saju'])
    assert b['cross_system']==100
    assert b['final']-a['final']==15


@pytest.mark.parametrize('bad',[math.nan,math.inf,-1,101])
def test_invalid_components_fail_closed(bad):
    with pytest.raises(ValueError): h.score_components(bad,50,50)


def test_zero_orb_secondary_not_lost_under_nonzero_aspects():
    hits=[{'a':'Venus','b':'Sun','orb':i/10,'layer_priority':2} for i in range(10)]
    out=secondary_support({'progressed_synastry':{'available':True,'user_progressed_to_partner_natal':hits}})
    assert out['emotional_reactivation']['evidence'][0]['orb']==0


def test_exact_progressed_mercury_preserved_and_direction_is_distinct():
    x=h._contacts({'Mercury':10},{'Sun':10},'contact_recontact','secondary','user->counterpart',sources=h.PERSONAL,targets=h.TARGETS)
    y=h._contacts({'Mercury':10},{'Sun':10},'contact_recontact','secondary','counterpart->user',sources=h.PERSONAL,targets=h.TARGETS)
    assert x[0]['orb']==0 and y[0]['orb']==0
    assert x[0]['event_id']!=y[0]['event_id']


def _row(day,score):
    return {
        'date':day,'stage':'contact_recontact','eligible':True,'stage_trigger_ok':True,
        'components':{'final':score,'event_trigger':score,'event_trigger_raw':score,'long_term':60,'mid_term':50,'independent_systems':['western']},
        'fast_evidence':[],'period_support':[],'mid_evidence':[]
    }


def _peak_row(day,event,final=None,stage='contact_recontact',trigger=True,raw=None):
    final = event if final is None else final
    raw = event if raw is None else raw
    return {
        'date':day,'stage':stage,'eligible':True,'stage_trigger_ok':trigger,
        'components':{
            'final':final,'event_trigger':event,'event_trigger_raw':raw,
            'primary_trigger_strength':event if trigger else 0,'primary_trigger_orb':0.1 if trigger else None,
            'long_term':60,'mid_term':50,'independent_systems':['western']
        },
        'fast_evidence':[],'period_support':[],'mid_evidence':[],
    }


def test_active_window_peak_reselected_after_asof_not_past_maximum():
    rows=[_row('2026-09-18',99),_row('2026-09-19',60),_row('2026-09-20',55),_row('2026-10-01',70)]
    out=h._group_windows(rows,date(2026,9,19))
    current=next(w for w in out if w['temporal_status']=='current')
    assert current['start']=='2026-09-18' and current['date']=='2026-09-19'
    assert current['final']==60
    past=h._group_windows(rows,date(2026,10,2))
    assert all(w['temporal_status']=='past' for w in past)


def test_local_peak_selector_does_not_treat_every_gate_day_as_candidate():
    start=date(2026,1,1)
    scores=[10,20,30,40,50,60,70,100,70,60,50,40,30,20,10]
    rows=[_peak_row((start+timedelta(days=i)).isoformat(),score) for i,score in enumerate(scores)]
    h._mark_local_peaks(rows)
    selected=[r for r in rows if r['selection_eligible']]
    assert [r['date'] for r in selected]==['2026-01-08']
    assert sum(r['eligible'] for r in rows)==15


def test_asof_future_peak_is_not_suppressed_by_past_maximum():
    asof=date(2026,9,19)
    rows=[_peak_row('2026-09-18',100)]
    rows += [_peak_row((asof+timedelta(days=i)).isoformat(),89-i) for i in range(8)]
    h._mark_local_peaks(rows,min_date=asof,max_date=date(2026,9,26))
    selected=[r['date'] for r in rows if r['selection_eligible']]
    assert selected==['2026-09-19']
    assert not rows[0]['selection_eligible']


def test_guard_band_compares_query_external_future_peaks_and_clips_public_dates():
    rows=[_peak_row('2026-12-31',100),_peak_row('2027-01-01',80),
          _peak_row('2027-12-31',80),_peak_row('2028-01-01',100)]
    h._mark_requested_peaks(rows,date(2027,1,1),date(2027,12,31),date(2026,9,19))
    assert not any(r['selection_eligible'] for r in rows)
    # With Jan 1 as-of, Dec 31 is past and must not suppress Jan 1.
    h._mark_requested_peaks(rows,date(2027,1,1),date(2027,12,31),date(2027,1,1))
    assert [r['date'] for r in rows if r['selection_eligible']]==['2027-01-01']


def test_stage_specific_trigger_must_materially_contribute_with_relevant_target_and_aspect():
    base={'family':'natal_trigger'}
    moon=[{**base,'a':'Moon','b':'Venus','aspect':'square','strength':80,'orb':0.1,'event_id':'moon'}]
    weak_mercury=[{**base,'a':'Mercury','b':'Moon','aspect':'conjunction','strength':0.1,'orb':0.01,'event_id':'weak-mercury'}]
    mercury=[{**base,'a':'Mercury','b':'Moon','aspect':'conjunction','strength':12,'orb':0.9,'event_id':'mercury'}]
    wrong_target=[{**base,'a':'Mercury','b':'Mars','aspect':'conjunction','strength':90,'orb':0.01,'event_id':'wrong-target'}]
    quincunx=[{**base,'a':'Mercury','b':'Moon','aspect':'quincunx','strength':90,'orb':0.01,'event_id':'quincunx'}]
    mars=[{**base,'a':'Mars','b':'DSC','aspect':'opposition','strength':12.1,'orb':0.8,'event_id':'mars'}]
    assert not h._stage_trigger_ok('contact_recontact',moon)
    assert not h._stage_trigger_ok('contact_recontact',moon+weak_mercury)
    assert h._stage_trigger_ok('contact_recontact',moon+mercury)
    assert not h._stage_trigger_ok('contact_recontact',wrong_target)
    assert not h._stage_trigger_ok('contact_recontact',quincunx)
    assert h._stage_trigger_ok('in_person_meeting',mars)


def test_display_fast_evidence_always_contains_material_primary_trigger():
    base={'family':'natal_trigger'}
    evidence=[
        {**base,'a':'Moon','b':'Venus','aspect':'square','strength':90,'orb':0.1,'event_id':'a'},
        {**base,'a':'Moon','b':'Moon','aspect':'trine','strength':80,'orb':0.2,'event_id':'b'},
        {**base,'a':'Mars','b':'DSC','aspect':'opposition','strength':70,'orb':0.3,'event_id':'c'},
        {**base,'a':'Moon','b':'Sun','aspect':'sextile','strength':60,'orb':0.4,'event_id':'d'},
        {**base,'a':'Mercury','b':'Moon','aspect':'conjunction','strength':12.5,'orb':0.5,'event_id':'primary'},
    ]
    shown=h._display_fast_evidence('contact_recontact',evidence,4)
    assert shown[0]['event_id']=='primary'
    assert len(shown)==4



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


@pytest.mark.parametrize('stage,planet,target',[
    ('contact_recontact','Mercury','Moon'),
    ('in_person_meeting','Mars','DSC'),
])
def test_semantic_gate_rejects_missing_target_minor_aspect_and_invalid_orb(stage,planet,target):
    hit={'a':planet,'b':target,'aspect':'conjunction','strength':30,'orb':.2,'event_id':'synthetic','family':'natal_trigger'}
    assert h._stage_trigger_ok(stage,[hit])
    for invalid in ({'b':'Pluto'},{'aspect':'quincunx'},{'orb':1.0},{'orb':-1},{'orb':math.nan},{'strength':math.inf}):
        assert not h._stage_trigger_ok(stage,[{**hit,**invalid}])


def _policy_hit(planet,target,aspect='conjunction',family='natal_trigger',strength=60,orb=.1,event_id='hit'):
    return {'a':planet,'b':target,'aspect':aspect,'family':family,'strength':strength,'orb':orb,'event_id':event_id}


def test_direct_aspect_triggers_but_supportive_aspect_is_context_only():
    direct=_policy_hit('Mercury','Moon')
    support=_policy_hit('Mercury','Moon',aspect='trine',event_id='support')
    assert h._stage_trigger_ok('contact_recontact',[direct])
    evaluated=h._stage_policy_evaluation('contact_recontact',[support])
    assert evaluated['primary'] is None
    assert evaluated['context']==[support]
    assert evaluated['rejection_counts']['context_only_aspect']==1


def test_return_angle_only_contact_is_context_and_cannot_create_exact_date():
    angle=_policy_hit('Mercury','DSC',family='return_angle_trigger')
    evaluated=h._stage_policy_evaluation('contact_recontact',[angle])
    assert evaluated['primary'] is None
    assert evaluated['rejection_counts']['context_only_family']==1


def test_emotional_moon_requires_natal_contact_and_independent_venus_context():
    moon=_policy_hit('Moon','Venus',event_id='moon')
    progressed={**moon,'family':'progressed_trigger','event_id':'progressed-moon'}
    venus_context=_policy_hit('Venus','Moon',aspect='trine',event_id='venus-context')
    assert not h._stage_trigger_ok('emotional_reactivation',[moon])
    assert not h._stage_trigger_ok('emotional_reactivation',[progressed,venus_context])
    assert h._stage_trigger_ok('emotional_reactivation',[moon,venus_context])


def test_stage_evidence_does_not_promote_to_unrelated_stages():
    emotional=[_policy_hit('Venus','Moon')]
    contact=[_policy_hit('Mercury','Moon')]
    meeting=[_policy_hit('Mars','DSC')]
    assert h._stage_trigger_ok('emotional_reactivation',emotional)
    assert not h._stage_trigger_ok('contact_recontact',emotional)
    assert not h._stage_trigger_ok('in_person_meeting',emotional)
    assert h._stage_trigger_ok('contact_recontact',contact)
    assert not h._stage_trigger_ok('relationship_rebuilding',contact)
    assert not h._stage_trigger_ok('relationship_rebuilding',[_policy_hit('Mercury','DSC')])
    assert h._stage_trigger_ok('in_person_meeting',meeting)
    assert not h._stage_trigger_ok('relationship_rebuilding',meeting)


def test_contact_and_meeting_targets_are_semantically_distinct():
    assert not h._stage_trigger_ok('contact_recontact',[_policy_hit('Mercury','Sun')])
    assert h._stage_trigger_ok('contact_recontact',[_policy_hit('Mercury','DSC')])
    assert not h._stage_trigger_ok('in_person_meeting',[_policy_hit('Mars','Moon')])
    assert h._stage_trigger_ok('in_person_meeting',[_policy_hit('Mars','ASC')])


def test_rebuilding_fast_venus_alone_cannot_bypass_long_gate():
    trigger=h._stage_policy_evaluation('relationship_rebuilding',[_policy_hit('Venus','DSC')])
    event_score,_=h._ranked_score(trigger['accepted'])
    assert trigger['primary'] is not None
    assert not h.score_components(0,100,event_score,['western'])['eligible']
    assert h.score_components(60,40,event_score,['western'])['eligible']


def test_stage_long_policies_do_not_reuse_mercury_sun_for_every_stage():
    assert 'Mercury' in h.STAGE_LONG_POLICY['contact_recontact']['directed_planets']
    assert 'Sun' in h.STAGE_LONG_POLICY['contact_recontact']['directed_targets']
    for stage in ('emotional_reactivation','in_person_meeting','relationship_rebuilding'):
        assert not (
            'Mercury' in h.STAGE_LONG_POLICY[stage]['directed_planets']
            and 'Sun' in h.STAGE_LONG_POLICY[stage]['directed_targets']
        )


def test_policy_trace_has_explicit_acceptance_and_rejection_semantics():
    rows=[_policy_hit('Mercury','Moon'),_policy_hit('Mercury','Moon',aspect='sextile',event_id='context')]
    evaluated=h._stage_policy_evaluation('contact_recontact',rows)
    shown=h._display_fast_evidence('contact_recontact',rows,evaluation=evaluated)
    assert shown[0]['accepted_by_stage_policy'] is True
    assert shown[0]['rejection_reason'] is None
    assert any(row['rejection_reason']=='context_only' for row in shown)


def _synthetic_pipeline(monkeypatch, return_key, *, long_strength=60, fast_planet='Mercury'):
    # Artificial positions/profiles; no saved personal information.
    p={'birth_date':date(1980,1,1),'birth_time':time(12),'utc_offset_hours':0,
       'latitude':0,'longitude':0,'time_source':'official_record','time_confidence':'exact'}
    event={'exact_utc':'2026-01-01T00:00:00+00:00','next_exact_utc':'2026-02-01T00:00:00+00:00',
           'precision':'exact','positions':{'Mercury':10},'angles':{},'house_activations':[]}
    original=h._contacts
    def contacts(source,target,stage,family,direction,**kwargs):
        if family=='return':
            return original({'Mercury':10},{'Moon':10},stage,family,direction,**kwargs)
        if family in {'secondary','natal_trigger'}:
            return [{'event_id':family+direction,'family':family,'a':fast_planet,'b':'Moon',
                     'aspect':'conjunction','orb':.1,'strength':long_strength if family=='secondary' else 60}]
        return []
    monkeypatch.setattr(h,'_contacts',contacts)
    monkeypatch.setattr(h,'_validate',lambda *_:{'status':'PASS','checks':[]})
    result={'reunion_return_support':{return_key:{'user':{'events':[event]},'counterpart':{'events':[]}}}}
    h.apply_reunion_hierarchy(result,p,p,date(2026,1,15),date(2026,1,15),as_of_date=date(2026,1,15))
    return result['reunion_hierarchy']


@pytest.mark.parametrize('key',['solar_return','mercury_return','venus_return','mars_return','missing'])
def test_non_lunar_returns_cannot_create_hierarchy_candidate(monkeypatch,key):
    result=_synthetic_pipeline(monkeypatch,key)
    assert not result['top_periods']
    assert all(not r['medium_anchor_pass'] and not r['fast_trigger_evaluated'] for r in result['daily_trace'])


def test_lunar_anchor_and_valid_contact_trigger_pass_without_promoting_meeting(monkeypatch):
    result=_synthetic_pipeline(monkeypatch,'lunar_return')
    rows={r['stage']:r for r in result['daily_trace']}
    assert rows['contact_recontact']['hierarchy_eligible']
    assert rows['contact_recontact']['selection_eligible']
    assert not rows['in_person_meeting']['hierarchy_eligible']
    for r in rows.values():
        if r['selection_eligible']: assert r['hierarchy_eligible'] and all(r['components']['gates'].values())


def test_emotion_does_not_automatically_promote_contact_or_meeting(monkeypatch):
    result=_synthetic_pipeline(monkeypatch,'lunar_return',fast_planet='Moon')
    assert all(not r['hierarchy_eligible'] for r in result['daily_trace'] if r['stage'] in {'contact_recontact','in_person_meeting'})


def test_long_failure_skips_medium_evidence_and_fast_sampling(monkeypatch):
    def forbidden(*args,**kwargs): raise AssertionError('medium evaluated despite failed long gate')
    monkeypatch.setattr(h,'_return_evidence',forbidden)
    result=_synthetic_pipeline(monkeypatch,'lunar_return',long_strength=0)
    assert all(not r['medium_anchor_evaluated'] and not r['fast_trigger_evaluated'] for r in result['daily_trace'])


def test_request_scoped_return_cache_preserves_exact_boundary_results():
    event={'exact_utc':'2026-01-01T00:00:00+00:00','next_exact_utc':'2026-01-20T12:00:00+00:00',
           'precision':'exact','positions':{'Mercury':10},'angles':{},'house_activations':[]}
    next_event={**event,'exact_utc':event['next_exact_utc'],'next_exact_utc':'2026-02-20T00:00:00+00:00','positions':{'Mercury':20}}
    support={'lunar_return':{'user':{'events':[event,next_event]}}}
    natal={'user':{'Moon':10},'counterpart':{}}
    cache={}
    for instant in (datetime(2026,1,10,tzinfo=timezone.utc),datetime(2026,1,20,11,59,tzinfo=timezone.utc),datetime(2026,1,20,12,tzinfo=timezone.utc)):
        assert h._return_evidence(support,instant,'contact_recontact',natal,cache)==h._return_evidence(support,instant,'contact_recontact',natal)
    assert len(cache)==2


def test_shared_geometry_cache_keeps_all_stage_weights_and_orbs_identical():
    cache={}
    source={'Moon':10.1,'Venus':70.2,'Mercury':130.3,'Mars':190.4}
    target={'Moon':10,'Venus':70,'DSC':190}
    for stage in h.DIMENSIONS:
        for family in ('secondary','solar_arc','natal_trigger'):
            assert h._contacts(source,target,stage,family,'user',geometry_cache=cache)==h._contacts(source,target,stage,family,'user')
    assert len(cache)==len(source)*len(target)

def test_nearest_public_candidate_is_nearest_local_peak_not_first_gate_day():
    start=date(2027,1,1)
    rows=[]
    for i in range(20):
        score=100-abs(i-9)*5
        rows.append(_peak_row((start+timedelta(days=i)).isoformat(),score))
    h._mark_local_peaks(rows,min_date=start,max_date=date(2027,1,20))
    peaks=h._peak_windows(rows,start,3)
    assert peaks[0]['date']=='2027-01-10'
    assert not rows[0]['selection_eligible']


def test_stage_local_peaks_are_not_cross_stage_suppressed_within_two_days():
    start=date(2026,1,1)
    rows=[
        _peak_row('2026-01-01',50,stage='contact_recontact'),
        _peak_row('2026-01-02',98,stage='emotional_reactivation'),
        _peak_row('2026-01-20',40,stage='in_person_meeting'),
    ]
    h._mark_local_peaks(rows,min_date=start,max_date=date(2026,1,31))
    public=h._peak_windows(rows,start,limit=None)
    keys={(r['date'],r['stage']) for r in public}
    assert ('2026-01-01','contact_recontact') in keys
    assert ('2026-01-02','emotional_reactivation') in keys
    nearest=min(public,key=lambda r:(r['date'],-r['final'],r['stage']))
    assert nearest['date']=='2026-01-01'


def test_same_stage_seven_days_collapses_but_eight_days_survives():
    start=date(2026,1,1)
    rows=[
        _peak_row('2026-01-01',80),
        _peak_row('2026-01-08',90),
        _peak_row('2026-01-16',85),
    ]
    h._mark_local_peaks(rows,min_date=start,max_date=date(2026,1,31))
    selected=[r['date'] for r in rows if r['selection_eligible']]
    assert selected==['2026-01-08','2026-01-16']


def test_capped_plateau_uses_raw_trigger_signal_before_date_tiebreak():
    start=date(2026,1,1)
    rows=[
        _peak_row('2026-01-01',100,final=100,raw=101),
        _peak_row('2026-01-02',100,final=100,raw=105),
        _peak_row('2026-01-03',100,final=100,raw=102),
    ]
    h._mark_local_peaks(rows,min_date=start,max_date=date(2026,1,3))
    assert [r['date'] for r in rows if r['selection_eligible']]==['2026-01-02']


def test_flat_plateau_after_asof_keeps_one_future_representative():
    asof=date(2026,9,19)
    rows=[_peak_row('2026-09-18',100,raw=120)]
    rows += [_peak_row((asof+timedelta(days=i)).isoformat(),100,raw=120) for i in range(8)]
    h._mark_local_peaks(rows,min_date=asof,max_date=date(2026,9,26))
    assert [r['date'] for r in rows if r['selection_eligible']]==['2026-09-19']


def test_selectivity_reports_gate_trigger_and_peak_counts_separately():
    rows=[_peak_row(f'2026-01-{i:02d}',50+i) for i in range(1,11)]
    for row in rows:
        row['hierarchy_eligible']=False
    h._mark_local_peaks(rows,min_date=date(2026,1,1),max_date=date(2026,1,10))
    summary=h._selectivity_summary(rows,date(2026,1,1))['contact_recontact']
    assert summary['numeric_gate_pass_days']==10
    assert summary['stage_trigger_pass_days']==10
    assert summary['hierarchy_pass_days']==0
    assert summary['local_peak_days']<summary['numeric_gate_pass_days']
    assert summary['status']=='OK'
    assert 'LOW_NUMERIC_GATE_SELECTIVITY' in summary['warnings']


def test_selected_requires_explicit_selection_flag_not_gate_fallback():
    assert not h._selected({'eligible':True})
    assert h._selected({'eligible':True,'selection_eligible':True})


def test_bounded_public_lists_keep_nearest_candidate():
    rows=[{'date':f'2026-01-{i:02d}','stage':'contact_recontact','final':100-i} for i in range(1,8)]
    nearest=rows[-1]
    bounded=h._bounded_with_nearest(rows,nearest,3)
    assert len(bounded)==3
    assert nearest in bounded


def test_fast_sampling_is_three_hour_grid_with_end_of_day_sample():
    assert h.FAST_SAMPLE_HOURS[:3]==(0,3,6)
    assert h.FAST_SAMPLE_HOURS[-1]==23.999
    assert max(b-a for a,b in zip(h.FAST_SAMPLE_HOURS,h.FAST_SAMPLE_HOURS[1:]))<=3


def test_return_crossing_handles_retrograde_repeats_and_wrap(monkeypatch):
    start=datetime(2026,1,1,tzinfo=timezone.utc); base=rr._jd(start)
    monkeypatch.setattr(rr,'_planet_lon',lambda jd,body: (0.1*math.sin((jd-base)*math.pi))%360)
    events=rr._find_returns('Mercury',0,start,start+timedelta(days=4))
    assert len(events)==5
    assert all(e['orb']<=1e-6 for e in events)
    assert [round(e['jd']-base) for e in events]==[0,1,2,3,4]


def test_continuous_activation_has_one_future_local_peak_and_separate_past_slice():
    start=date(2026,1,1); asof=date(2026,9,19)
    rows=[_row((start+timedelta(days=i)).isoformat(),50+i/10) for i in range(365)]
    h._mark_local_peaks(rows,min_date=asof,max_date=date(2026,12,31))
    peaks=h._peak_windows(rows,asof,limit=None)
    assert len(peaks)==1
    assert peaks[0]['date']=='2026-12-31'
    assert (date.fromisoformat(peaks[0]['end'])-date.fromisoformat(peaks[0]['start'])).days<=2
    assert peaks[0]['start']>=asof.isoformat()
    past=h._group_windows([r for r in rows if r['date']<asof.isoformat()],asof)
    assert past[0]['end']=='2026-09-18'


def test_progressed_sun_and_solar_arc_sun_are_one_physical_contact():
    kwargs=dict(source={'Sun':10},target={'Venus':10},stage='emotional_reactivation',direction='user->counterpart')
    secondary=h._contacts(**kwargs,family='secondary')
    arc=h._contacts(**kwargs,family='solar_arc')
    assert h._ranked_score(secondary+arc)[0]==h._ranked_score(secondary)[0]


def test_return_cycle_switches_at_exact_utc_not_calendar_midnight():
    events=[{'exact_utc':'2026-09-18T12:00:00+00:00','next_exact_utc':'2026-09-19T15:00:00+00:00','id':1},
            {'exact_utc':'2026-09-19T15:00:00+00:00','next_exact_utc':'2026-10-18T15:00:00+00:00','id':2}]
    instant=datetime(2026,9,20,0,tzinfo=timezone(timedelta(hours=9)))
    assert h._active_return(events,instant-timedelta(seconds=1))['id']==1
    assert h._active_return(events,instant)['id']==2


def test_event_history_not_in_calculation_interface():
    params=inspect.signature(h.apply_reunion_hierarchy).parameters
    assert not {'event_dates','actual_events','history','outcomes'} & set(params)


def test_all_twelve_jie_boundaries_switch_month_at_exact_second():
    from integrated_fortune_v1 import _jie_boundaries_for_range,_aware_to_lunar_exact
    _,_,boundaries=_jie_boundaries_for_range(date(2026,1,1),date(2026,12,31),9)
    seen=set()
    for row in boundaries:
        instant=row['instant']
        if instant.year!=2026: continue
        before=_aware_to_lunar_exact(instant-timedelta(seconds=1))
        after=_aware_to_lunar_exact(instant)
        assert before.getMonthInGanZhiExact()!=after.getMonthInGanZhiExact(),row
        seen.add(row['name_ko'])
    assert len(seen)==12


def test_real_api_reproducibility_current_filter_and_component_trace():
    from api.main import RelationshipRequest,relationship_western
    body={'user':{'birth_date':'1988-06-12','birth_time':'09:30','latitude':37.5665,'longitude':126.978,'utc_offset_hours':9,'time_source':'official_record','time_confidence':'exact'},
          'counterpart':{'birth_date':'1990-11-08','birth_time':'16:20','latitude':35.1796,'longitude':129.0756,'utc_offset_hours':9,'time_source':'user_estimate','time_confidence':'medium'},
          'start_date':'2026-09-15','end_date':'2026-09-25','as_of_date':'2026-09-19','query_utc_offset_hours':9,'analysis_mode':'reunion'}
    one=relationship_western(RelationshipRequest(**body))
    body['actual_events']=['2026-09-20']; body['user']['actual_events']=['2026-09-21']
    two=relationship_western(RelationshipRequest(**body))
    assert one==two
    result=one['result']
    hierarchy=result['reunion_hierarchy']
    assert hierarchy['validation']['status']=='PASS'
    assert len(hierarchy['daily_trace'])==11*4
    assert len(hierarchy['long_term_daily'])==11*4
    assert hierarchy['version']=='reunion-hierarchy-v2.4-stage-semantics'
    assert 'selectivity' in hierarchy and 'selection_policy' in hierarchy
    assert hierarchy['selection_policy']['primary_trigger_min_strength']==h.THRESHOLDS['event_trigger']
    windows=result['reunion_timing_windows']['windows']
    assert all(r['date']>='2026-09-19' for r in windows)
    assert all(r.get('local_peak') for r in windows)
    if hierarchy['nearest_window']:
        nearest=hierarchy['nearest_window']
        assert any(r['date']==nearest['date'] and r['stage']==nearest['stage'] for r in windows)
    gate_count=sum(1 for r in hierarchy['daily_trace'] if r['eligible'])
    selected_count=sum(1 for r in hierarchy['daily_trace'] if r['selection_eligible'])
    assert selected_count<=gate_count
    for row in hierarchy['daily_trace']:
        c=row['components']
        expected=round(min(100,c['weighted_sum']*c['gate_multiplier']+c['convergence_bonus']),2)
        assert c['final']==expected or abs(c['final']-expected)<=.01
        if row['eligible']:
            assert all(c['gates'].values())
        if row['selection_eligible']:
            assert row['eligible'] and row['hierarchy_eligible'] and row['raw_numeric_gate_pass']
            assert row['stage_trigger_ok'] and row['local_peak']
            assert row['trigger_policy_trace']['accepted_by_stage_policy']
            required=h.PRIMARY_TRIGGER_BY_STAGE[row['stage']]
            targets=h.PRIMARY_TRIGGER_TARGETS_BY_STAGE[row['stage']]
            assert any(
                e.get('a') in required
                and e.get('b') in targets
                and e.get('aspect') in h.PRIMARY_TRIGGER_ASPECTS
                and e.get('family') in h.EXACT_TRIGGER_FAMILIES
                and e.get('strength',0)>=h.THRESHOLDS['event_trigger']
                and e.get('accepted_by_stage_policy')
                for e in row['fast_evidence']
            )
