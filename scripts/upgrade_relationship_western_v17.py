from pathlib import Path

APP=Path('app.py')
LAB=Path('fortune_lab_v71.py')
app=APP.read_text(encoding='utf-8')
lab=LAB.read_text(encoding='utf-8')


def once(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old,new,1)

# 1. Import engine + bump version.
if 'from relationship_western_v1 import build_relationship_western' not in lab:
    lab=once(lab,'import swisseph as swe\n','import swisseph as swe\nfrom relationship_western_v1 import build_relationship_western\n','relationship import')
lab=lab.replace('FORTUNE_LAB_VERSION = "v0.1.6"','FORTUNE_LAB_VERSION = "v0.1.7"',1)

# 2. Main user's latitude is already known by app.py; pass it into Fortune Lab.
route_marker='elif main_view in ("포춘랩","궁합운"):'
route_start=app.find(route_marker)
if route_start<0:
    raise SystemExit('fortune route marker not found')
route_end=app.find('\n# ------------------------------------------------------------\n# ARCHIVE',route_start)
if route_end<0:
    route_end=min(len(app),route_start+5000)
route=app[route_start:route_end]
if '"birth_lat":lat,' not in route:
    route=once(route,'        "birth_lon":lon,\n','        "birth_lon":lon,\n        "birth_lat":lat,\n','birth latitude ctx')
    app=app[:route_start]+route+app[route_end:]

# 3. Replace birthplace selector so advanced charts have both coordinates.
sel_start=lab.find('def _select_birthplace_from_options(options,key_prefix):')
sel_end=lab.find('\ndef render_fortune_lab(ctx):',sel_start)
if sel_start<0 or sel_end<0:
    raise SystemExit('birthplace selector boundaries not found')
new_selector=r'''def _select_birthplace_from_options(options,key_prefix):
    """Two-stage Korea selector with direct-input fallback. Returns (label, latitude, longitude, UTC offset)."""
    places=dict(options or {})
    if not places:
        label=st.text_input("상대 출생 지역",value="",placeholder="예: 광주광역시",key=f"{key_prefix}_direct_label")
        c1,c2=st.columns(2)
        lat_raw=c1.text_input("위도(N)",value="",placeholder="35.16",key=f"{key_prefix}_direct_lat")
        lon_raw=c2.text_input("경도(E)",value="",placeholder="126.85",key=f"{key_prefix}_direct_lon")
        utc_offset=st.number_input("출생 당시 UTC 오프셋",min_value=-12.0,max_value=14.0,value=9.0,step=0.5,key=f"{key_prefix}_utc_offset")
        try: lat=float(lat_raw.strip()) if lat_raw.strip() else None
        except Exception: lat=None; st.warning("위도는 숫자로 입력해줘.")
        try: lon=float(lon_raw.strip()) if lon_raw.strip() else None
        except Exception: lon=None; st.warning("경도는 숫자로 입력해줘.")
        return label.strip(),lat,lon,float(utc_offset)
    groups={}
    for name in places:
        province=name.split()[0]
        groups.setdefault(province,[]).append(name)
    province_options=list(groups)+["해외·직접 입력"]
    province=st.selectbox("상대 출생 시·도",province_options,key=f"{key_prefix}_province")
    if province=="해외·직접 입력":
        label=st.text_input("상대 출생 지역명",value="",placeholder="예: Tokyo, Japan",key=f"{key_prefix}_direct_label")
        c1,c2=st.columns(2)
        lat_raw=c1.text_input("위도(N)",value="",placeholder="35.68",key=f"{key_prefix}_direct_lat")
        lon_raw=c2.text_input("경도(E)",value="",placeholder="139.69",key=f"{key_prefix}_direct_lon")
        utc_offset=st.number_input("출생 당시 UTC 오프셋",min_value=-12.0,max_value=14.0,value=9.0,step=0.5,key=f"{key_prefix}_utc_offset")
        try: lat=float(lat_raw.strip()) if lat_raw.strip() else None
        except Exception: lat=None; st.warning("위도는 숫자로 입력해줘.")
        try: lon=float(lon_raw.strip()) if lon_raw.strip() else None
        except Exception: lon=None; st.warning("경도는 숫자로 입력해줘.")
        return label.strip(),lat,lon,float(utc_offset)
    city_options=groups[province]
    selected=st.selectbox("상대 출생 시·군·구",city_options,format_func=lambda x:(x[len(province):].strip() or x),key=f"{key_prefix}_city")
    coords=places.get(selected) or (None,None)
    lat=float(coords[0]) if len(coords)>0 and coords[0] is not None else None
    lon=float(coords[1]) if len(coords)>1 and coords[1] is not None else None
    return selected,lat,lon,9.0

'''
lab=lab[:sel_start]+new_selector+lab[sel_end+1:]

# 4. Counterpart UI now carries lat/lon/timezone and explains advanced layers.
old='''        cp_place,cp_lon=_select_birthplace_from_options(ctx.get("birthplace_options") or {},"fortune_lab_cp")
        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점, 현재 단절 여부 정도",key="fortune_lab_cp_context")
        counterpart={"name":cp_name.strip(),"birth_date":cp_birth_date,"time_known":cp_time_known,"birth_time":cp_birth_time if cp_time_known else None,"birth_place":cp_place.strip(),"longitude":cp_lon,"context":cp_context.strip()}
'''
new='''        cp_place,cp_lat,cp_lon,cp_utc_offset=_select_birthplace_from_options(ctx.get("birthplace_options") or {},"fortune_lab_cp")
        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점, 현재 단절 여부 정도",key="fortune_lab_cp_context")
        counterpart={"name":cp_name.strip(),"birth_date":cp_birth_date,"time_known":cp_time_known,"birth_time":cp_birth_time if cp_time_known else None,"birth_place":cp_place.strip(),"latitude":cp_lat,"longitude":cp_lon,"utc_offset_hours":cp_utc_offset,"context":cp_context.strip()}
'''
lab=once(lab,old,new,'counterpart coordinates')
lab=lab.replace(
    'st.caption("출생시간은 몰라도 돼. 시간이 없으면 상대 시주·ASC(상승점)·하우스는 만들지 않아.")',
    'st.caption("기본 사주 궁합은 출생시간이 없어도 가능해. 시너스트리 일부도 제한적으로 계산하지만, 다빈슨·마크스·프로그레션 계열은 정확한 출생시간과 좌표가 있어야 활성화돼.")',1)
lab=lab.replace(
    '<strong>현재 계산 범위</strong><br>사주: 두 사람 원국의 기본 교차관계까지 실제 계산 · 서양점성술: 내 기간 흐름 계산 · 상대 Western 시너스트리/트랜짓: 아직 미계산. 그래서 상대의 연락일이나 행동을 확정하지 않아.',
    '<strong>관계 점성 계산</strong><br>시너스트리 · 2차진행 시너스트리 · 프로그레스드 컴포짓 · 다빈슨 · 양방향 마크스 · 마크스 3차진행을 함께 계산해. 단, 출생시간 미상인 상대는 정확도가 필요한 레이어를 자동으로 비활성화해.',1)

# 5. Build advanced Western bundle after counterpart Saju payload.
needle='''        counterpart_payload={
            "input":_jsonable(counterpart),
            "saju":cp_saju,
            "cross_branch_links":cross_links,
            "western_status":"partner natal/synastry/transit not calculated yet",
            "scope_note":"현재 두 사람의 정적 궁합 근거는 사주 원국 교차관계까지 계산한다. Western 월별 값은 사용자의 관계 환경이며, 상대의 Western 시너스트리·트랜짓은 아직 미계산이므로 상대 행동 시기로 바꾸지 않는다.",
        }
'''
replacement='''        user_profile={
            "birth_date":ctx["birth_date"],"birth_time":ctx["birth_time"],"time_known":True,
            "latitude":ctx.get("birth_lat"),"longitude":ctx.get("birth_lon"),"utc_offset_hours":9.0,
        }
        relationship_western=build_relationship_western(user_profile,counterpart,_month_segments(start_date,end_date))
        counterpart_payload={
            "input":_jsonable(counterpart),
            "saju":cp_saju,
            "cross_branch_links":cross_links,
            "western_status":"advanced relationship layers calculated; exact-time layers auto-disabled when required inputs are missing",
            "relationship_western":relationship_western,
            "scope_note":"Western 관계층은 시너스트리·2차진행 시너스트리·프로그레스드 컴포짓·다빈슨·마크스·마크스 3차진행을 서로 다른 레이어로 보존한다. 여러 레이어의 반복 접점은 수렴 신호일 뿐 상대 행동이나 재회를 확정하지 않는다.",
        }
'''
lab=once(lab,needle,replacement,'advanced western bundle')
lab=lab.replace(
    '"counterpart":"two-person Saju natal cross-context available; partner Western synastry/transit is not calculated yet",',
    '"counterpart":"two-person Saju + advanced Western relationship layers; timing layers remain descriptive and are not event probabilities",',1)

# 6. Deep prompt: teach AI exactly what each layer means and prevent double-counting.
old_rule='''- partner Western synastry/transit가 미계산이면 서양점성술로 두 사람의 궁합을 계산했다고 말하지 않는다.
'''
new_rule='''- Western 관계층은 각각 질문이 다르다: natal synastry=두 사람의 기본 상호작용, progressed synastry=현재 두 사람의 진행된 접점, progressed composite=관계 자체의 현재 단계, Davison=시간·공간 중간점의 관계 차트, Marks A/B=각 방향에서 관계를 경험하는 구조, Marks tertiary=그 Marks 구조의 단기 진행 리듬이다.
- 같은 접점이 여러 독립 레이어에서 반복될 때만 '수렴'이라고 표현한다. 같은 원자료에서 파생된 접점을 여러 표에 반복해서 사건확률처럼 합산하지 않는다.
- Marks A와 Marks B는 반드시 방향을 구분한다. 한쪽 Marks를 상대방의 감정 사실로 단정하지 않는다.
- 3차진행은 Tertiary I(1 ephemeris day = 27.32158218 life days) 방식이며, 이 앱은 각 완결된 lunar month 단위와 행성 접점을 사용한다. 각도 진행법이 갈리는 문제 때문에 3차진행 ASC/MC는 계산하지 않는다.
'''
lab=once(lab,old_rule,new_rule,'compat prompt rules')
lab=lab.replace(
    '8. counterpart가 있더라도 상대 출생시간이 없으면 시주·ASC·하우스·정확한 달 위치를 만들지 않는다. 현재 partner natal/synastry/transit가 미계산이면 Western 월별 값은 사용자의 재회 환경으로만 읽고 상대의 연락일로 바꾸지 않는다.',
    '8. counterpart 출생시간이 없으면 상대 시주·ASC·하우스·정확한 Moon 및 exact-time 관계차트를 만들지 않는다. relationship_western에서 available=false인 레이어는 절대 추정하지 않는다.',1)

# 7. Add advanced relationship signal to monthly cards.
old='''    western={x.get("calendar_month"):x for x in bundle.get("western",{}).get("months",[]) if isinstance(x,dict)}
    saju={x.get("calendar_month"):x for x in bundle.get("saju",{}).get("monthly",[]) if isinstance(x,dict)}
    months=sorted(set(western)|set(saju))
'''
new='''    western={x.get("calendar_month"):x for x in bundle.get("western",{}).get("months",[]) if isinstance(x,dict)}
    saju={x.get("calendar_month"):x for x in bundle.get("saju",{}).get("monthly",[]) if isinstance(x,dict)}
    rw=((bundle.get("counterpart") or {}).get("relationship_western") or {}) if isinstance(bundle.get("counterpart"),dict) else {}
    relmonths={x.get("calendar_month"):x for x in rw.get("months",[]) if isinstance(x,dict)}
    months=sorted(set(western)|set(saju)|set(relmonths))
'''
lab=once(lab,old,new,'timeline relationship map')
old='''        links=html.escape(" · ".join(s.get("branch_links") or []) or "특기할 육합·육충 없음")
        best=html.escape(_fmt_month_day_items(w.get("best_days")))
'''
new='''        links=html.escape(" · ".join(s.get("branch_links") or []) or "특기할 육합·육충 없음")
        r=relmonths.get(month,{})
        rs=r.get("signal_summary") or {}
        rel_signal=(f"정밀접점 {rs.get('exact_contacts',0)} · 조화 {rs.get('supportive_contacts',0)} · 긴장 {rs.get('challenging_contacts',0)}" if r else "관계 점성 미계산")
        rel_signal=html.escape(rel_signal)
        best=html.escape(_fmt_month_day_items(w.get("best_days")))
'''
lab=once(lab,old,new,'timeline relationship signal')
old='''    <div class="fortune-month-fact"><span>원국 교차</span><b>{links}</b></div>
  </div>
'''
new='''    <div class="fortune-month-fact"><span>원국 교차</span><b>{links}</b></div>
    <div class="fortune-month-fact"><span>관계 점성</span><b>{rel_signal}</b></div>
  </div>
'''
lab=once(lab,old,new,'timeline relationship row')

# 8. Replace compatibility expander caption with an actual advanced-layer status summary.
old='''                st.caption("현재 정적 궁합은 두 사람 사주 원국의 육합·육충 교차관계까지 계산해. 상대 Western 시너스트리·트랜짓은 아직 미계산이라 상대의 특정 연락일·행동 시기로 바꾸지 않아.")
                if cp.get("cross_branch_links"):
                    st.write(" · ".join(cp.get("cross_branch_links")[:8]))
'''
new='''                if cp.get("cross_branch_links"):
                    st.write("사주 교차 · "+" · ".join(cp.get("cross_branch_links")[:8]))
                rw=cp.get("relationship_western") or {}
                if rw.get("ok"):
                    st.markdown("**서양 관계 점성 레이어**")
                    st.write("시너스트리 ✓ · 컴포짓 ✓ · 다빈슨 " + ("✓" if (rw.get("davison") or {}).get("available") else "—") + " · 마크스 " + ("✓" if (rw.get("marks") or {}).get("available") else "—"))
                    st.caption("월별: 2차진행 시너스트리 + 프로그레스드 컴포짓 + 마크스 3차진행. 여러 레이어가 같은 시기에 반복해서 좁혀질 때만 수렴 신호로 읽어.")
                    syn=(rw.get("natal_synastry") or {}).get("aspects") or []
                    if syn:
                        tight=[f"{x.get('a')} {x.get('aspect')} {x.get('b')} ({x.get('orb')}°)" for x in syn[:6]]
                        st.write("기본 시너스트리 주요 접점 · "+" / ".join(tight))
                    for lim in rw.get("limitations") or []:
                        st.warning(lim)
                else:
                    st.warning("서양 관계 점성 계산을 완료하지 못했어: "+str(rw.get("error") or "입력값 확인 필요"))
'''
lab=once(lab,old,new,'advanced western summary')

LAB.write_text(lab,encoding='utf-8')
APP.write_text(app,encoding='utf-8')
print('Applied advanced relationship Western v0.1.7')
