from pathlib import Path

APP = Path("app.py")
text = APP.read_text(encoding="utf-8")
changed = False

helper_marker = "# ============================================================\n# 10. PROFILE / QUERY INPUTS\n# ============================================================\n"
helper_block = r'''# ============================================================
# 9-C. AUTOMATION ALERT PROBE · V6.20
# ============================================================
# 개인 출생정보를 GitHub에 복제하지 않는다. 예약 작업은 PIN 인증 후 이 probe를 열고,
# 앱 내부에서 계산된 "알림 후보"만 읽는다. 점수/애스펙트는 사건 확률이 아니다.
ASTRO_ALERT_PROBE_VERSION = "v1"
ASTRO_ALERT_TRANSITS = ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]
ASTRO_ALERT_TARGETS = ["Sun","Moon","Mercury","Venus","Mars","ASC","MC"]
ASTRO_ALERT_ASPECTS = {"합":0.0,"육십분위":60.0,"사분위":90.0,"삼분위":120.0,"충":180.0}
ASTRO_ALERT_TARGET_KO = {"ASC":"ASC(상승점)","MC":"MC(중천점)"}


def _alert_planet_lon(body, dt_utc):
    return get_tropical_ecliptic_lon(body, sf_time(dt_utc.astimezone(UTC)))


def _alert_exact_roots(body, target_lon, angle, start_kst, end_kst):
    desired=[(target_lon+angle)%360.0]
    if angle not in {0.0,180.0}:
        desired.append((target_lon-angle)%360.0)
    roots=[]
    points=[]; cur=start_kst
    while cur<=end_kst:
        points.append(cur); cur+=timedelta(hours=1)
    if points[-1] < end_kst: points.append(end_kst)

    for target in desired:
        def f(ts_value):
            dt=datetime.fromtimestamp(float(ts_value),tz=UTC)
            return circular_delta(_alert_planet_lon(body,dt),target)
        for left,right in zip(points[:-1],points[1:]):
            a,b=left.timestamp(),right.timestamp()
            try: fa,fb=f(a),f(b)
            except Exception: continue
            # circular_delta의 ±180 경계에서 생기는 가짜 부호변화를 제외한다.
            if max(abs(fa),abs(fb))>35:
                continue
            root_ts=None
            if abs(fa)<1e-7: root_ts=a
            elif abs(fb)<1e-7: root_ts=b
            elif fa*fb<0:
                try: root_ts=brentq(f,a,b,xtol=.25,maxiter=60)
                except Exception: root_ts=None
            if root_ts is None: continue
            root=datetime.fromtimestamp(float(root_ts),tz=UTC).astimezone(KST)
            if not (start_kst<=root<=end_kst): continue
            if all(abs((root-x).total_seconds())>180 for x in roots):
                roots.append(root)
    roots.sort()
    return roots


def _personal_exact_alert_events(now_value,natal_lons,natal_houses):
    start=now_value.astimezone(KST); end=start+timedelta(hours=24)
    targets={k:float(natal_lons[k]) for k in ["Sun","Moon","Mercury","Venus","Mars"]}
    targets["ASC"]=float(natal_houses["asc"]); targets["MC"]=float(natal_houses["mc"])
    events=[]
    for body in ASTRO_ALERT_TRANSITS:
        for target in ASTRO_ALERT_TARGETS:
            target_lon=targets[target]
            for aspect_name,angle in ASTRO_ALERT_ASPECTS.items():
                for root in _alert_exact_roots(body,target_lon,angle,start,end):
                    rounded=int(round(root.timestamp()/900.0))
                    target_label=ASTRO_ALERT_TARGET_KO.get(target,PLANET_KO.get(target,target))
                    body_label=PLANET_KO.get(body,body)
                    events.append({
                        "id":f"personal:{body}:{target}:{aspect_name}:{rounded}",
                        "transit":body,"target":target,"aspect":aspect_name,
                        "label":f"{body_label} → {target_label} {aspect_name}",
                        "exact_kst":root.strftime("%Y-%m-%d %H:%M KST"),
                        "timestamp":int(root.timestamp()),
                    })
    # 같은 정확시각/조합이 양방향 target longitude 때문에 중복되면 제거한다.
    unique={}
    for e in events: unique[e["id"]]=e
    return sorted(unique.values(),key=lambda x:(x["timestamp"],x["label"]))[:12]


def _score_percentile(value, history):
    vals=[float(v) for v in history if isinstance(v,(int,float)) and not pd.isna(v)]
    if not vals or value is None:return None
    return round(100.0*sum(v<=float(value) for v in vals)/len(vals),1)


def _score_alert_candidates(natal_packed,houses_packed,now_value):
    today=now_value.astimezone(KST).date()
    start=today-timedelta(days=29)
    # 과거 29일 + 오늘 + 내일. Gemini 호출 없이 기존 결정론 점수만 계산한다.
    rows=cached_period_scores(start.isoformat(),31,natal_packed,houses_packed)
    if len(rows)<31:return []
    history=rows[:29]; current=rows[29]; tomorrow=rows[30]
    labels={
        "시험":"시험","학업":"학업","직장":"직장","이직":"이직","연애":"연애","재회":"재회",
        "연락":"연락·교류","수신신호":"수신 보조신호","발신적합":"발신 적합도","과거인연접점":"과거인연 접점",
        "금전":"금전","컨디션":"컨디션",
    }
    keys=list(labels)
    out=[]
    for when,row in [("today",current),("tomorrow",tomorrow)]:
        day_value=row.get("date")
        for key in keys:
            value=row.get(key)
            hist=[r.get(key) for r in history]
            vals=[float(v) for v in hist if isinstance(v,(int,float)) and not pd.isna(v)]
            if not vals or not isinstance(value,(int,float)) or pd.isna(value):continue
            avg=sum(vals)/len(vals); delta=float(value)-avg; pct=_score_percentile(value,vals)
            direction="high"
            qualifies=(pct is not None and pct>=90.0 and delta>=7.0)
            if key=="컨디션":
                low_pct=round(100.0*sum(v<=float(value) for v in vals)/len(vals),1)
                if low_pct<=10.0 and delta<=-7.0:
                    qualifies=True; direction="low"; pct=low_pct
                else:
                    qualifies=False
            if when=="tomorrow":
                today_value=current.get(key)
                # 내일 알림은 오늘보다도 의미 있게 움직일 때만 보낸다.
                if not isinstance(today_value,(int,float)) or abs(float(value)-float(today_value))<9.0:
                    qualifies=False
            if qualifies:
                out.append({
                    "id":f"score:{when}:{day_value}:{key}:{direction}",
                    "when":when,"date":day_value.isoformat() if hasattr(day_value,"isoformat") else str(day_value),
                    "key":key,"label":labels[key],"direction":direction,
                    "score":int(round(float(value))),"avg30":round(avg,1),"delta":round(delta,1),"percentile":pct,
                    "strength":round(abs(delta)+(pct if direction=="high" else 100-pct)/10.0,2),
                })
    out.sort(key=lambda x:-x["strength"])
    return out[:6]


def build_automation_alert_probe(now_value,natal_lons,natal_houses,natal_packed,houses_packed):
    return {
        "probe_version":ASTRO_ALERT_PROBE_VERSION,
        "generated_at":now_value.astimezone(KST).isoformat(),
        "personal_events":_personal_exact_alert_events(now_value,natal_lons,natal_houses),
        "score_alerts":_score_alert_candidates(natal_packed,houses_packed,now_value),
        "note":"개인 애스펙트/생활점수는 알림 후보용 보조지표이며 사건 발생 확률이 아니다.",
    }


'''

if "ASTRO_ALERT_PROBE_VERSION = \"v1\"" not in text:
    if helper_marker not in text:
        raise SystemExit("profile marker not found")
    text=text.replace(helper_marker,helper_block+helper_marker,1)
    changed=True

# 이벤트 알림을 누르면 정밀분석으로 바로 보낼 수 있게 한다.
old_route='PUSH_ROUTE_TO_VIEW={"daily":"🌙 일일","weekly":"📅 주간","monthly":"🌕 월간","annual":"🌌 연간"}'
new_route='PUSH_ROUTE_TO_VIEW={"daily":"🌙 일일","weekly":"📅 주간","monthly":"🌕 월간","annual":"🌌 연간","precision":"🔬 정밀분석"}'
if old_route in text:
    text=text.replace(old_route,new_route,1); changed=True

probe_marker='natal_packed=pack_natal_lons(natal_lons); houses_packed=pack_houses(natal_houses)\n\nasc_sign,asc_deg,_=get_sign_and_degree(natal_houses["asc"])'
probe_replacement='''natal_packed=pack_natal_lons(natal_lons); houses_packed=pack_houses(natal_houses)\n\n# Headless alert watcher: 인증을 통과한 뒤에만 개인 알림 후보를 계산한다.\ntry:\n    _alert_probe_value=st.query_params.get("alert_probe","")\n    if isinstance(_alert_probe_value,(list,tuple)):_alert_probe_value=_alert_probe_value[-1] if _alert_probe_value else ""\nexcept Exception:\n    _alert_probe_value=""\nif str(_alert_probe_value or "").strip()=="1":\n    st.caption("ASTRO_ALERT_PROBE_V1")\n    with st.spinner("개인 트랜짓과 30일 기준선을 계산하는 중..."):\n        _alert_payload=build_automation_alert_probe(now_kst,natal_lons,natal_houses,natal_packed,houses_packed)\n    st.code("ASTRO_ALERT_JSON="+json.dumps(_alert_payload,ensure_ascii=False,separators=(",",":")),language="json")\n    st.stop()\n\nasc_sign,asc_deg,_=get_sign_and_degree(natal_houses["asc"])'''
if "ASTRO_ALERT_JSON=" not in text:
    if probe_marker not in text:
        raise SystemExit("natal pack marker not found")
    text=text.replace(probe_marker,probe_replacement,1)
    changed=True

if changed:
    APP.write_text(text,encoding="utf-8")
    print("Applied astrology alert probe v6.20")
else:
    print("Astrology alert probe v6.20 already applied")
