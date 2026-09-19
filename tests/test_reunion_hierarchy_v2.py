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
    return {'date':day,'stage':'contact_recontact','eligible':True,'components':{'final':score,'independent_systems':['western']},'fast_evidence':[],'period_support':[],'mid_evidence':[]}


def _peak_row(day,event,final=None,stage='contact_recontact',trigger=True):
    final = event if final is None else final
    return {
        'date':day,'stage':stage,'eligible':True,'stage_trigger_ok':trigger,
        'components':{'final':final,'event_trigger':event,'long_term':60,'mid_term':50,'independent_systems':['western']},
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


def test_stage_specific_trigger_is_required_before_local_peak_selection():
    moon=[{'a':'Moon'}]
    mercury=[{'a':'Mercury'}]
    mars=[{'a':'Mars'}]
    assert not h._stage_trigger_ok('contact_recontact',moon)
    assert h._stage_trigger_ok('contact_recontact',mercury)
    assert not h._stage_trigger_ok('in_person_meeting',mercury)
    assert h._stage_trigger_ok('in_person_meeting',mars)


def test_nearest_public_candidate_is_nearest_local_peak_not_first_gate_day():
    start=date(2027,1,1)
    rows=[]
    for i in range(20):
        score=100-abs(i-9)*5
        rows.append(_peak_row((start+timedelta(days=i)).isoformat(),score))
    h._mark_local_peaks(rows)
    peaks=h._peak_windows(rows,start,3)
    assert peaks[0]['date']=='2027-01-10'
    assert not rows[0]['selection_eligible']


def test_selectivity_reports_gate_ratio_separately_from_peak_ratio():
    rows=[_peak_row(f'2026-01-{i:02d}',50+i) for i in range(1,11)]
    h._mark_local_peaks(rows)
    summary=h._selectivity_summary(rows)['contact_recontact']
    assert summary['gate_pass_days']==10
    assert summary['local_peak_days']<summary['gate_pass_days']
    assert summary['status']=='LOW_SELECTIVITY'


def test_return_crossing_handles_retrograde_repeats_and_wrap(monkeypatch):
    start=datetime(2026,1,1,tzinfo=timezone.utc); base=rr._jd(start)
    monkeypatch.setattr(rr,'_planet_lon',lambda jd,body: (0.1*math.sin((jd-base)*math.pi))%360)
    events=rr._find_returns('Mercury',0,start,start+timedelta(days=4))
    assert len(events)==5
    assert all(e['orb']<=1e-6 for e in events)
    assert [round(e['jd']-base) for e in events]==[0,1,2,3,4]


def test_continuous_activation_has_local_peaks_and_separate_past_slice():
    start=date(2026,1,1); asof=date(2026,9,19)
    rows=[_row((start+timedelta(days=i)).isoformat(),50+i/10) for i in range(365)]
    peaks=h._peak_windows(rows,asof,3)
    assert len(peaks)==3
    assert all((date.fromisoformat(w['end'])-date.fromisoformat(w['start'])).days<=2 for w in peaks)
    assert all(w['start']>=asof.isoformat() for w in peaks)
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
    hierarchy=one['result']['reunion_hierarchy']
    assert hierarchy['validation']['status']=='PASS'
    assert len(hierarchy['daily_trace'])==11*4
    assert len(hierarchy['long_term_daily'])==11*4
    assert hierarchy['version']=='reunion-hierarchy-v2.1-selectivity'
    assert 'selectivity' in hierarchy and 'selection_policy' in hierarchy
    assert all(r['date']>='2026-09-19' for r in one['result']['reunion_timing_windows']['windows'])
    assert all(r.get('local_peak') for r in one['result']['reunion_timing_windows']['windows'])
    for row in hierarchy['daily_trace']:
        c=row['components']
        expected=round(min(100,c['weighted_sum']*c['gate_multiplier']+c['convergence_bonus']),2)
        assert c['final']==expected or abs(c['final']-expected)<=.01
        if row['eligible']:
            assert all(c['gates'].values())
        if row['selection_eligible']:
            assert row['eligible'] and row['stage_trigger_ok'] and row['local_peak']
