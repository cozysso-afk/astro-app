import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import swisseph as swe
from playwright.sync_api import sync_playwright

from prewarm_streamlit_horoscope import APP_URL, all_scopes, body_text, login_if_needed, maybe_wake_streamlit
from send_onesignal_horoscope_push import _active_web_subscription_ids, _notification_succeeded, _send_payload

KST = ZoneInfo("Asia/Seoul")
UTC = timezone.utc
LAUNCHER_URL = "https://cozysso-afk.github.io/astro-app/"
FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED
LOOKAHEAD_HOURS = 26

PLANET_IDS = {
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
}
PLANET_KO = {
    "Mercury": "수성", "Venus": "금성", "Mars": "화성", "Jupiter": "목성",
    "Saturn": "토성", "Uranus": "천왕성", "Neptune": "해왕성", "Pluto": "명왕성",
}
PLANET_SYMBOL = {
    "Mercury": "☿", "Venus": "♀", "Mars": "♂", "Jupiter": "♃",
    "Saturn": "♄", "Uranus": "♅", "Neptune": "♆", "Pluto": "♇",
}
SIGNS_KO = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리","천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"]
STATION_BODIES = ["Mercury", "Venus", "Mars"]
INGRESS_BODIES = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]


def _dt_to_jd(dt_value):
    dt_value = dt_value.astimezone(UTC)
    hour = dt_value.hour + dt_value.minute / 60 + dt_value.second / 3600 + dt_value.microsecond / 3_600_000_000
    return swe.julday(dt_value.year, dt_value.month, dt_value.day, hour, swe.GREG_CAL)


def _jd_to_dt(jd):
    year, month, day, hour = swe.revjul(float(jd), swe.GREG_CAL)
    total_seconds = int(round(hour * 3600))
    total_seconds = max(0, min(total_seconds, 86399))
    hh, rem = divmod(total_seconds, 3600)
    mm, ss = divmod(rem, 60)
    return datetime(year, month, day, hh, mm, ss, tzinfo=UTC)


def _planet_state_jd(body, jd):
    xx, _ = swe.calc_ut(float(jd), PLANET_IDS[body], FLAGS)
    return float(xx[0] % 360.0), float(xx[3])


def _sun_moon_lons_jd(jd):
    sun, _ = swe.calc_ut(float(jd), swe.SUN, FLAGS)
    moon, _ = swe.calc_ut(float(jd), swe.MOON, FLAGS)
    return float(sun[0] % 360.0), float(moon[0] % 360.0)


def _circular_delta(a, b):
    return (float(a) - float(b) + 180.0) % 360.0 - 180.0


def _bisect_zero(fn, left, right, iterations=64):
    fl, fr = fn(left), fn(right)
    if abs(fl) < 1e-10:
        return left
    if abs(fr) < 1e-10:
        return right
    if fl * fr > 0:
        return None
    lo, hi = float(left), float(right)
    for _ in range(iterations):
        mid = (lo + hi) / 2.0
        fm = fn(mid)
        if abs(fm) < 1e-10:
            return mid
        if fl * fm <= 0:
            hi, fr = mid, fm
        else:
            lo, fl = mid, fm
    return (lo + hi) / 2.0


def _sample_jds(start_dt, end_dt, step_hours):
    out=[]; cur=start_dt
    while cur < end_dt:
        out.append(_dt_to_jd(cur)); cur += timedelta(hours=step_hours)
    out.append(_dt_to_jd(end_dt))
    return out


def detect_stations(start_dt, end_dt):
    events=[]
    jds=_sample_jds(start_dt,end_dt,2)
    for body in STATION_BODIES:
        def speed(jd): return _planet_state_jd(body,jd)[1]
        for a,b in zip(jds[:-1],jds[1:]):
            sa,sb=speed(a),speed(b)
            if sa==0 or sb==0 or sa*sb<0:
                root=_bisect_zero(speed,a,b)
                if root is None: continue
                exact=_jd_to_dt(root).astimezone(KST)
                before=speed(root-1/24); after=speed(root+1/24)
                if before>0 and after<0:
                    kind="retrograde"; action="역행 시작"
                elif before<0 and after>0:
                    kind="direct"; action="순행 복귀"
                else:
                    continue
                rounded=int(round(exact.timestamp()/900.0))
                events.append({
                    "id":f"station:{body}:{kind}:{rounded}",
                    "kind":"station","timestamp":int(exact.timestamp()),"exact":exact,
                    "label":f"{PLANET_SYMBOL[body]} {PLANET_KO[body]} {action}",
                })
    return _dedupe_events(events)


def detect_slow_ingresses(start_dt, end_dt):
    events=[]
    jds=_sample_jds(start_dt,end_dt,6)
    for body in INGRESS_BODIES:
        for boundary in [i*30.0 for i in range(12)]:
            def f(jd):
                lon,_=_planet_state_jd(body,jd)
                return _circular_delta(lon,boundary)
            for a,b in zip(jds[:-1],jds[1:]):
                fa,fb=f(a),f(b)
                if max(abs(fa),abs(fb))>12:
                    continue
                if fa==0 or fb==0 or fa*fb<0:
                    root=_bisect_zero(f,a,b)
                    if root is None: continue
                    exact=_jd_to_dt(root).astimezone(KST)
                    _,speed=_planet_state_jd(body,root)
                    after_lon,_=_planet_state_jd(body,root+(5/1440.0))
                    sign=SIGNS_KO[int(after_lon//30)%12]
                    direction="역행으로 재진입" if speed<0 else "진입"
                    rounded=int(round(exact.timestamp()/900.0))
                    events.append({
                        "id":f"ingress:{body}:{int(boundary)}:{rounded}",
                        "kind":"ingress","timestamp":int(exact.timestamp()),"exact":exact,
                        "label":f"{PLANET_SYMBOL[body]} {PLANET_KO[body]} {sign} {direction}",
                    })
    return _dedupe_events(events)


def detect_moon_phases(start_dt, end_dt):
    events=[]
    jds=_sample_jds(start_dt,end_dt,2)
    for phase,target,symbol in [("신월",0.0,"🌑"),("보름달",180.0,"🌕")]:
        def f(jd):
            sun,moon=_sun_moon_lons_jd(jd)
            return _circular_delta((moon-sun)%360.0,target)
        for a,b in zip(jds[:-1],jds[1:]):
            fa,fb=f(a),f(b)
            if max(abs(fa),abs(fb))>25:
                continue
            if fa==0 or fb==0 or fa*fb<0:
                root=_bisect_zero(f,a,b)
                if root is None: continue
                exact=_jd_to_dt(root).astimezone(KST)
                rounded=int(round(exact.timestamp()/900.0))
                events.append({
                    "id":f"phase:{phase}:{rounded}","kind":"phase",
                    "timestamp":int(exact.timestamp()),"exact":exact,"label":f"{symbol} {phase}",
                })
    return _dedupe_events(events)


def _eclipse_type_name(flag, solar):
    if flag & swe.ECL_TOTAL: return "개기일식" if solar else "개기월식"
    if solar and flag & swe.ECL_ANNULAR_TOTAL: return "혼성일식"
    if solar and flag & swe.ECL_ANNULAR: return "금환일식"
    if flag & swe.ECL_PARTIAL: return "부분일식" if solar else "부분월식"
    if (not solar) and flag & swe.ECL_PENUMBRAL: return "반영월식"
    return "일식" if solar else "월식"


def detect_eclipses(start_dt, end_dt):
    events=[]; start_jd=_dt_to_jd(start_dt)
    try:
        flag,tret=swe.sol_eclipse_when_glob(start_jd,swe.FLG_MOSEPH,0,False)
        exact=_jd_to_dt(tret[0]).astimezone(KST)
        if start_dt.astimezone(KST)<=exact<=end_dt.astimezone(KST):
            label="🌘 "+_eclipse_type_name(flag,True)
            events.append({"id":f"eclipse:solar:{int(round(exact.timestamp()/900))}","kind":"eclipse","timestamp":int(exact.timestamp()),"exact":exact,"label":label})
    except Exception as exc:
        print(f"Solar eclipse lookup skipped: {type(exc).__name__}")
    try:
        flag,tret=swe.lun_eclipse_when(start_jd,swe.FLG_MOSEPH,0,False)
        exact=_jd_to_dt(tret[0]).astimezone(KST)
        if start_dt.astimezone(KST)<=exact<=end_dt.astimezone(KST):
            label="🌒 "+_eclipse_type_name(flag,False)
            events.append({"id":f"eclipse:lunar:{int(round(exact.timestamp()/900))}","kind":"eclipse","timestamp":int(exact.timestamp()),"exact":exact,"label":label})
    except Exception as exc:
        print(f"Lunar eclipse lookup skipped: {type(exc).__name__}")
    return _dedupe_events(events)


def _dedupe_events(events):
    unique={}
    for item in events:
        unique[item["id"]]=item
    return sorted(unique.values(),key=lambda x:(x["timestamp"],x["label"]))


def detect_celestial_events(now_kst):
    start=now_kst.astimezone(KST); end=start+timedelta(hours=LOOKAHEAD_HOURS)
    eclipses=detect_eclipses(start,end)
    phases=detect_moon_phases(start,end)
    if eclipses:
        phases=[p for p in phases if all(abs(p["timestamp"]-e["timestamp"])>18*3600 for e in eclipses)]
    events=detect_stations(start,end)+detect_slow_ingresses(start,end)+eclipses+phases
    return _dedupe_events(events)


def fetch_personal_probe(pin):
    url=APP_URL+"?"+urlencode({"automation":"1","alert_probe":"1"})
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(locale="ko-KR",timezone_id="Asia/Seoul",viewport={"width":1280,"height":1400})
        page=context.new_page(); page.set_default_timeout(15000)
        page.goto(url,wait_until="domcontentloaded",timeout=120000); page.wait_for_timeout(4500)
        login_if_needed(page,pin)
        deadline=time.time()+420
        decoder=json.JSONDecoder()
        while time.time()<deadline:
            maybe_wake_streamlit(page)
            combined="\n".join(body_text(scope,timeout=3000) for scope in all_scopes(page))
            marker="ASTRO_ALERT_JSON="
            if marker in combined:
                tail=combined.split(marker,1)[1].lstrip()
                try:
                    payload,_=decoder.raw_decode(tail)
                    context.close(); browser.close()
                    if isinstance(payload,dict) and payload.get("probe_version")=="v1":
                        return payload
                except Exception:
                    pass
            if "PIN이 맞지 않습니다" in combined:
                raise RuntimeError("ASTRO_APP_PIN does not match Streamlit APP_PIN")
            page.wait_for_timeout(2000)
        context.close(); browser.close()
    raise RuntimeError("Timed out waiting for ASTRO_ALERT_JSON probe payload")


def _push_url(kind):
    params={"from":"push","kind":kind}
    if kind=="daily": params["date"]=datetime.now(KST).date().isoformat()
    return LAUNCHER_URL+"?"+urlencode(params)


def _idempotency_key(event_id):
    return str(uuid.uuid5(uuid.NAMESPACE_URL,"astro-app-alert:"+event_id))


def _safe_name(event_id):
    digest=hashlib.sha256(event_id.encode("utf-8")).hexdigest()[:16]
    return "astro-alert-"+digest


def send_notification(app_id,api_key,subscription_ids,title,body,event_id,kind):
    payload={
        "app_id":app_id,
        "target_channel":"push",
        "name":_safe_name(event_id),
        "headings":{"en":title},
        "contents":{"en":body},
        "url":_push_url(kind),
        "data":{"astro_kind":kind,"astro_alert":True},
        "include_subscription_ids":subscription_ids,
        "idempotency_key":_idempotency_key(event_id),
    }
    status,data=_send_payload(api_key,payload)
    if not _notification_succeeded(status,data):
        raise RuntimeError(f"OneSignal alert was not accepted as deliverable (HTTP {status})")


def _time_text(event):
    exact=event.get("exact")
    if hasattr(exact,"strftime"): return exact.strftime("%m/%d %H:%M")
    raw=str(event.get("exact_kst") or "")
    return raw.replace(" KST","")[-11:] if raw else ""


def celestial_notification(events):
    if not events:return None
    pieces=[f"{e['label']} {_time_text(e)}".strip() for e in events[:3]]
    if len(events)==1:
        title=events[0]["label"]
        body=f"정확 시각 {_time_text(events[0])} KST · 별빛의 운명에서 흐름을 확인해봐."
    else:
        title=f"🪐 24시간 천체 이벤트 {len(events)}건"
        body=" · ".join(pieces)+(f" 외 {len(events)-3}건" if len(events)>3 else "")
    event_id="celestial:"+"|".join(sorted(e["id"] for e in events))
    return title,body,event_id,"precision"


def personal_notification(events):
    if not events:return None
    pieces=[f"{e.get('label','개인 정확각')} {_time_text(e)}".strip() for e in events[:3]]
    if len(events)==1:
        title="🪐 개인 트랜짓 정확각"
        body=pieces[0]+" · 특정 사건을 보장하는 의미는 아니야."
    else:
        title=f"🪐 개인 트랜짓 정확각 {len(events)}건"
        body=" · ".join(pieces)+(f" 외 {len(events)-3}건" if len(events)>3 else "")
    event_id="personal:"+"|".join(sorted(str(e.get("id")) for e in events))
    return title,body,event_id,"precision"


def score_notification(items):
    if not items:return None
    top=items[0]; when="내일" if top.get("when")=="tomorrow" else "오늘"
    label=str(top.get("label") or top.get("key") or "생활지표")
    score=int(top.get("score") or 0); avg=top.get("avg30")
    direction=top.get("direction")
    if direction=="low":
        title=f"⚠️ {when} {label}가 최근 30일 하위권"
        body=f"{label} {score} · 최근 평균 {avg}. 무리한 일정은 조금 줄여도 좋아."
    else:
        title=f"✨ {when} {label}가 최근 30일 상위권"
        body=f"{label} {score} · 최근 평균 {avg}. 상대지수라 사건 확률은 아니야."
    if len(items)>1:
        extras=[]
        for x in items[1:3]:
            w="내일" if x.get("when")=="tomorrow" else "오늘"
            extras.append(f"{w} {x.get('label')} {x.get('score')}")
        if extras: body += " · 함께 뜬 지표: "+", ".join(extras)
    day=top.get("date") or datetime.now(KST).date().isoformat()
    event_id=f"score:{day}"
    return title,body,event_id,"daily"


def main():
    app_id=(os.getenv("ONESIGNAL_APP_ID") or "").strip()
    api_key=(os.getenv("ONESIGNAL_APP_API_KEY") or "").strip()
    pin=(os.getenv("ASTRO_APP_PIN") or "").strip()
    mode=(os.getenv("ASTRO_ALERT_MODE") or "").strip().lower()
    dry_run=mode=="dry_run" or (os.getenv("ASTRO_ALERT_DRY_RUN") or "").strip()=="1"
    if not app_id or not api_key or not pin:
        print("Required alert secrets are not configured; skipping.")
        return 0

    now=datetime.now(KST)
    celestial=detect_celestial_events(now)
    print(f"Celestial alert candidates: {len(celestial)}")

    try:
        probe=fetch_personal_probe(pin)
    except Exception as exc:
        print(f"Personal alert probe failed: {type(exc).__name__}: {exc}",file=sys.stderr)
        return 1
    personal=probe.get("personal_events") if isinstance(probe.get("personal_events"),list) else []
    scores=probe.get("score_alerts") if isinstance(probe.get("score_alerts"),list) else []
    print(f"Personal exact-aspect candidates: {len(personal)}")
    print(f"Score anomaly candidates: {len(scores)}")

    notifications=[]
    for candidate in [celestial_notification(celestial),personal_notification(personal),score_notification(scores)]:
        if candidate: notifications.append(candidate)
    print(f"Notification bundles ready: {len(notifications)}")
    if dry_run:
        print("Dry-run mode: no push sent.")
        return 0
    if not notifications:
        print("No meaningful astrology alert today; no push sent.")
        return 0

    subscription_ids=_active_web_subscription_ids(app_id,api_key)
    print(f"Active OneSignal web push subscriptions discovered: {len(subscription_ids)}")
    if not subscription_ids:
        print("No active web push subscriptions are messageable.",file=sys.stderr)
        return 1

    for title,body,event_id,kind in notifications[:3]:
        send_notification(app_id,api_key,subscription_ids,title,body,event_id,kind)
    print(f"Astrology alerts accepted: {min(len(notifications),3)} bundle(s).")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
