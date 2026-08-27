from pathlib import Path

P=Path('fortune_lab_v71.py')
s=P.read_text(encoding='utf-8')


def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)

replace_once('FORTUNE_LAB_VERSION = "v0.1.1"','FORTUNE_LAB_VERSION = "v0.1.2"','version')
replace_once(
'    "🔄 재회·과거 인연": {"western":"재회", "focus":"과거 인연 재활성, 접점, 관계 재검토, 반복 패턴"},\n',
'    "🔄 재회·과거 인연": {"western":"재회", "focus":"과거 인연 재활성, 접점, 관계 재검토, 반복 패턴"},\n'
'    "💞 특정 상대와 재회": {"western":"재회", "focus":"입력한 특정 상대와의 관계 재활성 가능 구간, 접점 환경, 반복 패턴. 상대의 행동·감정을 확정하지 않음"},\n',
'topic')

anchor='''\n\ndef _thai_payload(birth_date,birth_time):\n'''
helper=r'''\n\ndef _counterpart_saju_payload(birth_date,time_known=False,birth_time=None,longitude=None):
    if Solar is None:
        return {"ok":False,"error":"lunar_python 미설치"}
    try:
        time_known=bool(time_known and birth_time is not None)
        true_solar_meta=None
        if time_known and longitude is not None:
            use_dt,true_solar_meta=_true_solar_datetime(birth_date,birth_time,float(longitude))
            time_policy="known_time_true_solar"
        else:
            # 정오를 임시 계산시각으로 사용하지만, 시주는 결과에 노출하지 않는다.
            # 출생시간 미상에서는 절입 당일/23시 일진 경계 같은 정밀 판정을 하지 않는다.
            use_dt=datetime.combine(birth_date,dt_time(12,0))
            time_policy="unknown_or_unlocated_time_three_pillars_only"
        e=Solar.fromYmdHms(use_dt.year,use_dt.month,use_dt.day,use_dt.hour,use_dt.minute,use_dt.second).getLunar().getEightChar()
        try: e.setSect(2)
        except Exception: pass
        pillars={"year":e.getYear(),"month":e.getMonth(),"day":e.getDay(),"hour":e.getTime() if (time_known and longitude is not None) else None}
        return {
            "ok":True,
            "engine":"lunar_python 1.4.8" + (" + Swiss Ephemeris true-solar correction" if true_solar_meta else ""),
            "time_policy":time_policy,
            "true_solar":true_solar_meta,
            "pillars":pillars,
            "day_master":pillars["day"][:1] if pillars.get("day") else None,
            "precision_limits":[
                "출생시간 미상 또는 경도 미입력 시 시주 미사용",
                "출생시간 미상에서는 절입 당일·23시 전후 경계 판정 불가",
                "상대 대운·세운·월운은 이번 단계에서 계산하지 않음",
            ],
        }
    except Exception as exc:
        return {"ok":False,"error":f"{type(exc).__name__}: {exc}"}
'''
if anchor not in s:
    raise SystemExit('counterpart helper anchor not found')
s=s.replace(anchor,helper+anchor,1)

old_build='''def _build_bundle(ctx,topic,start_date,end_date,gender):\n    western=_western_payload(ctx,topic,start_date,end_date)\n    saju=_saju_payload(ctx["birth_date"],ctx["birth_time"],ctx["birth_lon"],gender,start_date,end_date)\n    thai=_thai_payload(ctx["birth_date"],ctx["birth_time"])\n    return {\n        "version":FORTUNE_LAB_VERSION,"topic":topic,"topic_focus":FORTUNE_LAB_TOPICS[topic]["focus"],\n        "period":{"start":start_date.isoformat(),"end":end_date.isoformat()},\n        "western":western,"saju":saju,"thai":thai,\n        "consensus_policy":{\n            "western":"period timing evidence available",\n            "saju":"DaYun/year/month cycle facts available; interpretation is separate",\n            "thai":"natal baseline only; excluded from predictive consensus until Suriyayat transit is implemented",\n        },\n    }\n'''
new_build='''def _build_bundle(ctx,topic,start_date,end_date,gender,counterpart=None):\n    western=_western_payload(ctx,topic,start_date,end_date)\n    saju=_saju_payload(ctx["birth_date"],ctx["birth_time"],ctx["birth_lon"],gender,start_date,end_date)\n    thai=_thai_payload(ctx["birth_date"],ctx["birth_time"])\n    counterpart_payload=None\n    if topic=="💞 특정 상대와 재회" and isinstance(counterpart,dict):\n        cp_saju=_counterpart_saju_payload(\n            counterpart.get("birth_date"),counterpart.get("time_known",False),\n            counterpart.get("birth_time"),counterpart.get("longitude"),\n        )\n        cross_links=[]\n        if cp_saju.get("ok") and saju.get("ok"):\n            up=saju.get("pillars") or {}; cp=cp_saju.get("pillars") or {}\n            user_branches={"내 년지":str(up.get("year") or "")[1:2],"내 월지":str(up.get("month") or "")[1:2],"내 일지":str(up.get("day") or "")[1:2],"내 시지":str(up.get("hour") or "")[1:2]}\n            for label in ("year","month","day","hour"):\n                branch=str(cp.get(label) or "")[1:2]\n                if branch:\n                    for link in _branch_links(branch,user_branches):\n                        cross_links.append(f"상대 {label}지 {branch} ↔ {link}")\n        counterpart_payload={\n            "input":_jsonable(counterpart),\n            "saju":cp_saju,\n            "cross_branch_links":cross_links,\n            "western_status":"partner natal/synastry/transit not calculated yet",\n            "scope_note":"현재 Western 월별 값은 사용자의 재회 활성 환경이다. 상대의 행동 시기나 연락일로 바꾸지 않는다.",\n        }\n    return {\n        "version":FORTUNE_LAB_VERSION,"topic":topic,"topic_focus":FORTUNE_LAB_TOPICS[topic]["focus"],\n        "period":{"start":start_date.isoformat(),"end":end_date.isoformat()},\n        "western":western,"saju":saju,"thai":thai,"counterpart":counterpart_payload,\n        "consensus_policy":{\n            "western":"period timing evidence available for user",\n            "saju":"DaYun/year/month cycle facts available; interpretation is separate",\n            "thai":"natal baseline only; excluded from predictive consensus until Suriyayat transit is implemented",\n            "counterpart":"natal Saju context only in v0.1.2; no partner-specific Western timing vote",\n        },\n    }\n'''
replace_once(old_build,new_build,'build bundle')

replace_once(
'7. 특정 타인의 속마음·연락·재회·합격을 확정하지 않는다. 확률 숫자를 지어내지 않는다.\n8. 결과는 전문용어를 나열하지 말고 점성·사주를 모르는 사람이 이해할 현실 장면으로 번역한다.\n',
'7. 특정 타인의 속마음·연락·재회·합격을 확정하지 않는다. 확률 숫자를 지어내지 않는다.\n8. counterpart가 있더라도 상대 출생시간이 없으면 시주·ASC·하우스·정확한 달 위치를 만들지 않는다. 현재 partner natal/synastry/transit가 미계산이면 Western 월별 값은 사용자의 재회 환경으로만 읽고 상대의 연락일로 바꾸지 않는다.\n9. 상대 사주 원국 일부와 두 사람의 합·충은 관계 패턴의 보조 맥락이지 연락·재회 발생의 증명이 아니다.\n10. 결과는 전문용어를 나열하지 말고 점성·사주를 모르는 사람이 이해할 현실 장면으로 번역한다.\n',
'prompt rules')

replace_once(
'    topic=st.selectbox("분석 주제",list(FORTUNE_LAB_TOPICS.keys()),key="fortune_lab_topic")\n    gender=st.selectbox("사주 대운용 성별",["여성","남성"],index=0 if str(ctx.get("birth_gender","여성")).startswith("여") else 1,key="fortune_lab_gender")\n',
'''    topic=st.selectbox("분석 주제",list(FORTUNE_LAB_TOPICS.keys()),key="fortune_lab_topic")\n    gender=st.selectbox("사주 대운용 성별",["여성","남성"],index=0 if str(ctx.get("birth_gender","여성")).startswith("여") else 1,key="fortune_lab_gender")\n\n    counterpart=None\n    if topic=="💞 특정 상대와 재회":\n        st.markdown("#### 💞 특정 상대 정보")\n        st.caption("출생시간을 몰라도 가능해. 그 경우 상대 시주·ASC·하우스는 계산하지 않고, 아는 데이터만 사용해.")\n        cp_name=st.text_input("상대 호칭 · 선택",value="",placeholder="예: A",key="fortune_lab_cp_name")\n        cp_birth_date=st.date_input("상대 출생일",value=date(1990,1,1),key="fortune_lab_cp_birth_date")\n        cp_time_known=st.checkbox("상대 출생시간을 알고 있음",value=False,key="fortune_lab_cp_time_known")\n        cp_birth_time=st.time_input("상대 출생시간",value=dt_time(12,0),step=60,key="fortune_lab_cp_birth_time",disabled=not cp_time_known)\n        cp_place=st.text_input("상대 출생지 · 선택",value="",placeholder="예: 광주",key="fortune_lab_cp_place")\n        cp_lon_raw=st.text_input("상대 출생지 경도(E) · 시간 보정용 선택",value="",placeholder="시간을 정확히 알 때만 예: 126.85",key="fortune_lab_cp_lon")\n        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점/현재 단절 여부 정도만",key="fortune_lab_cp_context")\n        cp_lon=None\n        if cp_time_known and cp_lon_raw.strip():\n            try: cp_lon=float(cp_lon_raw.strip())\n            except Exception: st.warning("상대 경도는 숫자로 입력해줘. 경도를 비우면 상대 시주는 사용하지 않아.")\n        counterpart={"name":cp_name.strip(),"birth_date":cp_birth_date,"time_known":cp_time_known,"birth_time":cp_birth_time if cp_time_known else None,"birth_place":cp_place.strip(),"longitude":cp_lon,"context":cp_context.strip()}\n''',
'render counterpart inputs')

replace_once(
'    fp=hashlib.sha256(f"{FORTUNE_LAB_VERSION}|{topic}|{start_date}|{end_date}|{gender}|{ctx[\'birth_date\']}|{ctx[\'birth_time\']}|{ctx[\'birth_lon\']}|{ctx[\'natal_packed\']}|{ctx[\'houses_packed\']}".encode()).hexdigest()[:24]\n',
'    cp_fp=json.dumps(_jsonable(counterpart),ensure_ascii=False,sort_keys=True) if counterpart else ""\n    fp=hashlib.sha256(f"{FORTUNE_LAB_VERSION}|{topic}|{start_date}|{end_date}|{gender}|{ctx[\'birth_date\']}|{ctx[\'birth_time\']}|{ctx[\'birth_lon\']}|{ctx[\'natal_packed\']}|{ctx[\'houses_packed\']}|{cp_fp}".encode()).hexdigest()[:24]\n',
'fingerprint')
replace_once(
'            st.session_state["fortune_lab_bundle"]=_build_bundle(ctx,topic,start_date,end_date,gender)\n',
'            st.session_state["fortune_lab_bundle"]=_build_bundle(ctx,topic,start_date,end_date,gender,counterpart=counterpart)\n',
'build call')

needle='''    _render_engine_summary(bundle)\n    st.markdown("#### 📆 월별 계산 요약")\n'''
insert='''    _render_engine_summary(bundle)\n    cp=bundle.get("counterpart")\n    if isinstance(cp,dict):\n        cps=cp.get("saju") or {}\n        with st.expander("💞 특정 상대 계산 범위",expanded=True):\n            if cps.get("ok"):\n                p=cps.get("pillars") or {}\n                st.write(f"상대 사주 자료 · {p.get('year','?')} / {p.get('month','?')} / {p.get('day','?')} / {p.get('hour') or '시간 미상'}")\n                st.caption("현재는 상대 원국 일부 + 내 사주와의 육합·육충 보조맥락까지만 사용해. 상대 Western 시너스트리·트랜짓은 다음 단계라 특정 연락일을 만들지 않아.")\n                if cp.get("cross_branch_links"):\n                    st.write(" · ".join(cp.get("cross_branch_links")[:8]))\n            else:\n                st.warning(str(cps.get("error") or "상대 사주 계산 실패"))\n    st.markdown("#### 📆 월별 계산 요약")\n'''
replace_once(needle,insert,'counterpart summary')

P.write_text(s,encoding='utf-8')
print('Applied Fortune Lab counterpart reunion v0.1.2')
