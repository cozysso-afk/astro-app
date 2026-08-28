# -*- coding: utf-8 -*-
"""FORTUNE LAB v7.1

Topic-first fortune analysis layer for 별빛의 운명.
- Western: reuse the app's already-calculated period scores.
- Saju: calculate natal pillars, DaYun, LiuNian and representative solar-term month pillars with lunar_python.
- Thai: calculate the traditional weekday/ruler baseline with the 06:00 day boundary and Wednesday-night Rahu split.
- AI: Gemini is optional/default convenience. A complete deep-analysis prompt is always available for copy/paste into Opus/GPT/etc.

Important: Thai predictive Suriyayat/transit is NOT implemented in this phase and therefore is never counted as a timing consensus signal.
"""

import calendar
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time as dt_time, timedelta

import streamlit as st
import swisseph as swe

try:
    from streamlit_js_eval import streamlit_js_eval
except Exception:
    streamlit_js_eval = None

try:
    from lunar_python import Solar
except Exception:
    Solar = None


FORTUNE_LAB_VERSION = "v0.1.4"
FORTUNE_LAB_TRUE_SOLAR_V711 = True
FORTUNE_LAB_STORAGE_PREFIX = "astro_fortune_lab_v1_"
FORTUNE_LAB_MAX_DAYS = 366
FORTUNE_LAB_MAX_ARCHIVE = 36

FORTUNE_LAB_TOPICS = {
    "💘 연애·새 인연": {"western":"연애", "focus":"새 인연 유입, 내가 끌리는 흐름, 상호 진전, 관계 재검토"},
    "🔄 재회·과거 인연": {"western":"재회", "focus":"과거 인연 재활성, 접점, 관계 재검토, 반복 패턴"},
    "💞 특정 상대와 재회": {"western":"재회", "focus":"입력한 특정 상대와의 관계 재활성 가능 구간, 접점 환경, 반복 패턴. 상대의 행동·감정을 확정하지 않음"},
    "📝 시험·합격": {"western":"시험", "focus":"흡수, 출력, 평가 압박, 실수 위험, 성과 회수"},
    "📚 공부·학업": {"western":"학업", "focus":"집중, 이해, 기억, 루틴, 학습 지속성"},
    "💼 취업·직장": {"western":"직장", "focus":"지원, 평가, 조직 적응, 책임, 성과 가시화"},
    "🚪 이직·변화": {"western":"이직", "focus":"이동, 기회 유입, 조건 비교, 전환 압력"},
    "💰 재물·수입": {"western":"금전", "focus":"수입·지출 흐름, 현실 판단, 재정 압박과 여유"},
    "💌 연락·소식": {"western":"연락", "focus":"교류 활성도, 접점, 메시지·대화 흐름. 특정인의 연락을 확정하지 않음"},
    "🌿 컨디션·생활리듬": {"western":"컨디션", "focus":"활동 리듬, 소모, 회복, 일정 배치. 의료 예측 금지"},
}

_STEM_INFO = {
    "甲":("木",1), "乙":("木",0), "丙":("火",1), "丁":("火",0), "戊":("土",1),
    "己":("土",0), "庚":("金",1), "辛":("金",0), "壬":("水",1), "癸":("水",0),
}
_GENERATES = {"木":"火", "火":"土", "土":"金", "金":"水", "水":"木"}
_CONTROLS = {"木":"土", "土":"水", "水":"火", "火":"金", "金":"木"}
_LIUHE = {frozenset(x) for x in [("子","丑"),("寅","亥"),("卯","戌"),("辰","酉"),("巳","申"),("午","未")]}
_LIUCHONG = {frozenset(x) for x in [("子","午"),("丑","未"),("寅","申"),("卯","酉"),("辰","戌"),("巳","亥")]}

_THAI_DAY = {
    6:("일요일","Sun(태양)","일요일 출생층"),
    0:("월요일","Moon(달)","월요일 출생층"),
    1:("화요일","Mars(화성)","화요일 출생층"),
    2:("수요일 낮","Mercury(수성)","수요일 06:00~17:59 출생층"),
    3:("목요일","Jupiter(목성)","목요일 출생층"),
    4:("금요일","Venus(금성)","금요일 출생층"),
    5:("토요일","Saturn(토성)","토요일 출생층"),
}


def _jsonable(v):
    if v is None or isinstance(v,(str,int,float,bool)):
        return v
    if isinstance(v,(date,datetime,dt_time)):
        return v.isoformat()
    if isinstance(v,dict):
        return {str(k):_jsonable(x) for k,x in v.items()}
    if isinstance(v,(list,tuple)):
        return [_jsonable(x) for x in v]
    try:
        return float(v)
    except Exception:
        return str(v)


def _month_segments(start_date,end_date):
    cur=date(start_date.year,start_date.month,1)
    out=[]
    while cur<=end_date:
        last=date(cur.year,cur.month,calendar.monthrange(cur.year,cur.month)[1])
        seg_start=max(start_date,cur)
        seg_end=min(end_date,last)
        if seg_start<=seg_end:
            out.append((seg_start,seg_end))
        cur=date(cur.year+1,1,1) if cur.month==12 else date(cur.year,cur.month+1,1)
    return out


def _true_solar_datetime(birth_date,birth_time,longitude):
    """KST legal time -> local apparent/true solar time.

    Korea standard meridian is 135E. Local mean solar time differs by
    4 minutes per degree of longitude; Swiss Ephemeris swe.time_equ returns
    equation of time E = LAT - LMT in days.
    """
    legal=datetime.combine(birth_date,birth_time)
    longitude=float(longitude)
    utc=legal-timedelta(hours=9)
    ut_hour=utc.hour+utc.minute/60+utc.second/3600+utc.microsecond/3_600_000_000
    jd_ut=swe.julday(utc.year,utc.month,utc.day,ut_hour,swe.GREG_CAL)
    eot_days=float(swe.time_equ(jd_ut))
    longitude_minutes=4.0*(longitude-135.0)
    eot_minutes=eot_days*1440.0
    total_minutes=longitude_minutes+eot_minutes
    apparent=legal+timedelta(minutes=total_minutes)
    return apparent,{
        "legal_kst":legal.strftime("%Y-%m-%d %H:%M:%S"),
        "longitude_east":round(longitude,6),
        "kst_standard_meridian_east":135.0,
        "longitude_correction_minutes":round(longitude_minutes,4),
        "equation_of_time_minutes":round(eot_minutes,4),
        "total_correction_minutes":round(total_minutes,4),
        "true_solar_time":apparent.strftime("%Y-%m-%d %H:%M:%S"),
        "formula":"KST + 4*(longitude-135E) minutes + Swiss Ephemeris equation_of_time(LAT-LMT)",
    }


def _ten_god(day_stem,target_stem):
    if day_stem not in _STEM_INFO or target_stem not in _STEM_INFO:
        return ""
    de,dy=_STEM_INFO[day_stem]; te,ty=_STEM_INFO[target_stem]
    same=(dy==ty)
    if de==te:
        return "比肩(비견)" if same else "劫財(겁재)"
    if _GENERATES[de]==te:
        return "食神(식신)" if same else "傷官(상관)"
    if _CONTROLS[de]==te:
        return "偏財(편재)" if same else "正財(정재)"
    if _CONTROLS[te]==de:
        return "七殺(칠살·편관)" if same else "正官(정관)"
    if _GENERATES[te]==de:
        return "偏印(편인)" if same else "正印(정인)"
    return ""


def _branch_links(target_branch,natal_branches):
    links=[]
    for label,branch in natal_branches.items():
        pair=frozenset((target_branch,branch))
        if len(pair)<2:
            continue
        if pair in _LIUHE:
            links.append(f"{label} {branch}와 六合(육합)")
        if pair in _LIUCHONG:
            links.append(f"{label} {branch}와 六沖(육충)")
    return links


def _saju_payload(birth_date,birth_time,longitude,gender,start_date,end_date):
    if Solar is None:
        return {"ok":False,"error":"lunar_python 미설치"}
    try:
        true_solar,true_solar_meta=_true_solar_datetime(birth_date,birth_time,longitude)
        solar=Solar.fromYmdHms(true_solar.year,true_solar.month,true_solar.day,true_solar.hour,true_solar.minute,true_solar.second)
        lunar=solar.getLunar()
        eight=lunar.getEightChar()
        # sect=2 only affects the late-night day-boundary convention. Make it explicit.
        try: eight.setSect(2)
        except Exception: pass
        pillars={
            "year":eight.getYear(),"month":eight.getMonth(),"day":eight.getDay(),"hour":eight.getTime(),
        }
        day_master=eight.getDayGan() if hasattr(eight,"getDayGan") else pillars["day"][:1]
        branches={"년지":pillars["year"][1:2],"월지":pillars["month"][1:2],"일지":pillars["day"][1:2],"시지":pillars["hour"][1:2]}
        elements=[]
        for getter in ["getYearWuXing","getMonthWuXing","getDayWuXing","getTimeWuXing"]:
            try: elements.extend(list(getattr(eight,getter)()))
            except Exception: pass
        element_count={e:elements.count(e) for e in ["木","火","土","金","水"]}
        natal_ten_gods={}
        for label,getter in [("년간","getYearShiShenGan"),("월간","getMonthShiShenGan"),("시간","getTimeShiShenGan")]:
            try: natal_ten_gods[label]=getattr(eight,getter)()
            except Exception: pass

        gender_code=1 if str(gender).startswith("남") else 0
        yun=eight.getYun(gender_code,1)
        dayuns=[]
        for dy in yun.getDaYun(12):
            try:
                sy=int(dy.getStartYear()); ey=int(dy.getEndYear())
                if ey < start_date.year or sy > end_date.year:
                    continue
                dayuns.append({
                    "start_year":sy,"end_year":ey,"start_age":int(dy.getStartAge()),"end_age":int(dy.getEndAge()),"ganzhi":dy.getGanZhi(),
                })
            except Exception:
                continue

        years=[]
        for y in range(start_date.year,end_date.year+1):
            rep=Solar.fromYmdHms(y,7,1,12,0,0).getLunar()
            gz=rep.getYearInGanZhiExact()
            years.append({"year":y,"ganzhi":gz,"stem_ten_god":_ten_god(day_master,gz[:1]),"branch_links":_branch_links(gz[1:2],branches)})

        months=[]
        for seg_start,seg_end in _month_segments(start_date,end_date):
            rep_date=seg_start + (seg_end-seg_start)//2
            rep=Solar.fromYmdHms(rep_date.year,rep_date.month,rep_date.day,12,0,0).getLunar()
            gz=rep.getMonthInGanZhiExact()
            months.append({
                "calendar_month":f"{seg_start.year}-{seg_start.month:02d}",
                "segment_start":seg_start.isoformat(),"segment_end":seg_end.isoformat(),
                "representative_date":rep_date.isoformat(),"ganzhi":gz,
                "stem_ten_god":_ten_god(day_master,gz[:1]),"branch_links":_branch_links(gz[1:2],branches),
                "boundary_note":"월 중 대표일의 절기월 간지. 절입 전후의 정확 경계시각은 1차 버전에서 별도 노출하지 않음.",
            })

        try: start_solar=yun.getStartSolar().toYmdHms()
        except Exception: start_solar=""
        return {
            "ok":True,"engine":"lunar_python 1.4.8 + Swiss Ephemeris true-solar correction","calendar_input":"legal KST corrected to local apparent solar time",
            "true_solar":true_solar_meta,
            "pillars":pillars,"day_master":day_master,"elements":element_count,"natal_ten_gods":natal_ten_gods,
            "yun_policy":"gender 1=male/0=female, sect=1 (3 days=1 year convention)","yun_start_solar":start_solar,
            "dayun":dayuns,"annual":years,"monthly":months,
            "not_calculated":["신강·신약","용신·희신·기신","형·파·해 전체 규칙"],
        }
    except Exception as exc:
        return {"ok":False,"error":f"{type(exc).__name__}: {exc}"}


def _counterpart_saju_payload(birth_date,time_known=False,birth_time=None,longitude=None):
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


def _thai_payload(birth_date,birth_time):
    dt=datetime.combine(birth_date,birth_time)
    shifted=dt-timedelta(hours=6)
    thai_date=shifted.date()
    weekday=thai_date.weekday()
    start=datetime.combine(thai_date,dt_time(6,0))
    if weekday==2 and dt>=start+timedelta(hours=12):
        label,ruler,note="수요일 밤","Rahu(라후)","수요일 18:00~다음날 05:59 라후 출생층"
    else:
        label,ruler,note=_THAI_DAY[weekday]
    return {
        "ok":True,"engine":"Thai weekday baseline v1","thai_day":label,"ruler":ruler,"rule":note,
        "day_boundary":"06:00 local; Wednesday night split at 18:00",
        "predictive_status":"natal_baseline_only",
        "consensus_policy":"Suriyayat/Thai transit 미구현이므로 기간·날짜 합의 점수에는 사용하지 않음",
    }


def _western_payload(ctx,topic,start_date,end_date):
    key=FORTUNE_LAB_TOPICS[topic]["western"]
    cached_period_scores=ctx["cached_period_scores"]
    period_stats=ctx["period_topic_stats"]
    natal_packed=ctx["natal_packed"]; houses_packed=ctx["houses_packed"]
    months=[]
    for seg_start,seg_end in _month_segments(start_date,end_date):
        day_count=(seg_end-seg_start).days+1
        rows=cached_period_scores(seg_start.isoformat(),day_count,natal_packed,houses_packed)
        stats=period_stats(rows,key) or {}
        def slim(items):
            out=[]
            for x in (items or [])[:3]:
                if not isinstance(x,dict): continue
                out.append({"date":str(x.get("date") or x.get("label") or ""),"label":str(x.get("label") or ""),"score":x.get("score")})
            return out
        months.append({
            "calendar_month":f"{seg_start.year}-{seg_start.month:02d}","start":seg_start.isoformat(),"end":seg_end.isoformat(),
            "topic_key":key,"average":stats.get("average"),"band":stats.get("band"),"spread":stats.get("spread"),
            "best_days":slim(stats.get("best_days")),"caution_days":slim(stats.get("caution_days")),
        })
    return {"ok":True,"engine":"별빛의 운명 Western period engine","topic_key":key,"months":months,"score_policy":"점수는 사건 발생 확률이 아니라 같은 분야 안의 상대 흐름"}


def _build_bundle(ctx,topic,start_date,end_date,gender,counterpart=None):
    western=_western_payload(ctx,topic,start_date,end_date)
    saju=_saju_payload(ctx["birth_date"],ctx["birth_time"],ctx["birth_lon"],gender,start_date,end_date)
    thai=_thai_payload(ctx["birth_date"],ctx["birth_time"])
    counterpart_payload=None
    if topic=="💞 특정 상대와 재회" and isinstance(counterpart,dict):
        cp_saju=_counterpart_saju_payload(
            counterpart.get("birth_date"),counterpart.get("time_known",False),
            counterpart.get("birth_time"),counterpart.get("longitude"),
        )
        cross_links=[]
        if cp_saju.get("ok") and saju.get("ok"):
            up=saju.get("pillars") or {}; cp=cp_saju.get("pillars") or {}
            user_branches={"내 년지":str(up.get("year") or "")[1:2],"내 월지":str(up.get("month") or "")[1:2],"내 일지":str(up.get("day") or "")[1:2],"내 시지":str(up.get("hour") or "")[1:2]}
            for label in ("year","month","day","hour"):
                branch=str(cp.get(label) or "")[1:2]
                if branch:
                    for link in _branch_links(branch,user_branches):
                        cross_links.append(f"상대 {label}지 {branch} ↔ {link}")
        counterpart_payload={
            "input":_jsonable(counterpart),
            "saju":cp_saju,
            "cross_branch_links":cross_links,
            "western_status":"partner natal/synastry/transit not calculated yet",
            "scope_note":"현재 Western 월별 값은 사용자의 재회 활성 환경이다. 상대의 행동 시기나 연락일로 바꾸지 않는다.",
        }
    return {
        "version":FORTUNE_LAB_VERSION,"topic":topic,"topic_focus":FORTUNE_LAB_TOPICS[topic]["focus"],
        "period":{"start":start_date.isoformat(),"end":end_date.isoformat()},
        "western":western,"saju":saju,"thai":thai,"counterpart":counterpart_payload,
        "consensus_policy":{
            "western":"period timing evidence available for user",
            "saju":"DaYun/year/month cycle facts available; interpretation is separate",
            "thai":"natal baseline only; excluded from predictive consensus until Suriyayat transit is implemented",
            "counterpart":"natal Saju context only in v0.1.2; no partner-specific Western timing vote",
        },
    }


def _deep_prompt(bundle):
    data=json.dumps(_jsonable(bundle),ensure_ascii=False,indent=2)
    return f"""너는 사주명리·서양점성술·태국점성술의 서로 다른 전통을 구분해서 읽는 전문 해석자다.
아래 CALCULATED_DATA는 웹앱이 계산한 자료다. 이전 대화, MBTI, 사용자에 대한 기억은 사용하지 않는다.

[최우선 규칙]
1. 계산은 다시 추측하지 말고 CALCULATED_DATA에 있는 값만 근거로 쓴다. 없는 값은 만들지 않는다.
2. Western 점수는 사건 발생 확률이 아니다. 같은 주제 안에서 월별 상대강도와 변화를 비교하는 자료다.
3. Saju에는 진태양시로 보정한 원국·대운·연간 간지·월별 대표 절기월 간지가 있다. 신강·신약/용희기신/형파해가 not_calculated에 있으면 임의 생성하지 않는다.
4. Saju monthly의 대표 간지는 해당 달 중간 대표일 기준이다. 절입 경계 정확시각이 없으므로 경계일을 특정하지 않는다.
5. Thai는 현재 출생요일·요일행성 baseline뿐이다. Suriyayat/Thai transit가 없으므로 태국점성술로 특정 월·날짜를 예측하지 않는다.
6. 서로 다른 체계가 실제로 같은 주제를 지지할 때만 교차 보조 신호라고 말한다. 억지로 합의시키지 않는다.
7. 특정 타인의 속마음·연락·재회·합격을 확정하지 않는다. 확률 숫자를 지어내지 않는다.
8. counterpart가 있더라도 상대 출생시간이 없으면 시주·ASC·하우스·정확한 달 위치를 만들지 않는다. 현재 partner natal/synastry/transit가 미계산이면 Western 월별 값은 사용자의 재회 환경으로만 읽고 상대의 연락일로 바꾸지 않는다.
9. 상대 사주 원국 일부와 두 사람의 합·충은 관계 패턴의 보조 맥락이지 연락·재회 발생의 증명이 아니다.
10. 결과는 전문용어를 나열하지 말고 점성·사주를 모르는 사람이 이해할 현실 장면으로 번역한다.

[분석 주제]
{bundle['topic']} — {bundle['topic_focus']}
기간: {bundle['period']['start']} ~ {bundle['period']['end']}

[원하는 출력]
① 전체 흐름을 3~5문장으로 먼저 결론
② 월별로 '우세/가능성 있음/재검토/흐름 약함' 중 하나의 판정 문장
③ 각 월 1순위·2순위 테마
④ 현실에서 나타날 수 있는 장면, 사용자 감정·행동, 외부에서 관찰 가능한 변화
⑤ 상대적으로 강한 구간과 주의 구간. 근거 차이가 작으면 작다고 명시
⑥ 사주와 서양점성술이 같은 방향/다른 방향인지 월별로 짧게 표시
⑦ 마지막에 전체 타임라인 + 최선/현실적/주의 시나리오 + 결론 3문장

CALCULATED_DATA:
{data}
"""


def _cache_id(bundle,model):
    raw=json.dumps(_jsonable(bundle),ensure_ascii=False,sort_keys=True,separators=(",",":"))+"|"+str(model)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:28]


def _storage_key(cache_id,suffix="gemini"):
    return FORTUNE_LAB_STORAGE_PREFIX+cache_id+"_"+suffix


def _read_record(cache_id,suffix="gemini"):
    if streamlit_js_eval is None:
        return ""
    key_js=json.dumps(_storage_key(cache_id,suffix))
    value=streamlit_js_eval(js_expressions=f"(()=>{{const v=localStorage.getItem({key_js});return v===null?'__EMPTY__':v;}})()",key=f"fortune_lab_read_{cache_id}_{suffix}")
    if value is None:
        return None
    if str(value)=="__EMPTY__":
        return ""
    try:
        obj=json.loads(str(value)); return obj if isinstance(obj,dict) else ""
    except Exception:
        return ""


def _write_record(cache_id,record,suffix="gemini"):
    if streamlit_js_eval is None:
        return "unavailable"
    packed=dict(record); packed["saved_at"]=int(time.time()); packed["version"]=FORTUNE_LAB_VERSION
    key_js=json.dumps(_storage_key(cache_id,suffix))
    val_js=json.dumps(json.dumps(_jsonable(packed),ensure_ascii=False,separators=(",",":")))
    prefix_js=json.dumps(FORTUNE_LAB_STORAGE_PREFIX)
    expr=("(()=>{try{const kept=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);"
          f"if(k&&k.startsWith({prefix_js})){{try{{const o=JSON.parse(localStorage.getItem(k)||'{{}}');kept.push({{k:k,s:Number(o.saved_at||0)}});}}catch(e){{}}}}}}"
          "kept.sort((a,b)=>b.s-a.s);"
          f"kept.slice({FORTUNE_LAB_MAX_ARCHIVE-1}).forEach(x=>localStorage.removeItem(x.k));"
          f"localStorage.setItem({key_js},{val_js});return 'ok';}}catch(e){{return 'fail';}}}})()")
    return streamlit_js_eval(js_expressions=expr,key=f"fortune_lab_write_{cache_id}_{suffix}_{hashlib.sha256(val_js.encode()).hexdigest()[:8]}")


def _call_gemini(prompt,model,thinking_level,api_key,usage_helper=None):
    if not api_key:
        return {"ok":False,"error":"GEMINI_API_KEY가 설정되지 않았어."}
    safe_model=urllib.parse.quote(str(model),safe="-._")
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"
    body={
        "systemInstruction":{"parts":[{"text":"너는 별빛의 운명 FORTUNE LAB의 해석자다. 계산값을 재계산하거나 없는 근거를 만들지 않는다. 한국어 반말로 자연스럽고 구체적으로 쓴다."}]},
        "contents":[{"role":"user","parts":[{"text":prompt}]}],
        "generationConfig":{"maxOutputTokens":12000,"thinkingConfig":{"thinkingLevel":thinking_level}},
    }
    req=urllib.request.Request(url,data=json.dumps(body,ensure_ascii=False).encode("utf-8"),headers={"Content-Type":"application/json","x-goog-api-key":api_key},method="POST")
    try:
        with urllib.request.urlopen(req,timeout=70) as resp:
            raw=json.loads(resp.read().decode("utf-8"))
        parts=raw.get("candidates",[{}])[0].get("content",{}).get("parts",[])
        text="".join(p.get("text","") for p in parts if isinstance(p,dict) and not p.get("thought")).strip()
        if not text:
            text="".join(p.get("text","") for p in parts if isinstance(p,dict)).strip()
        usage=usage_helper(raw,model) if callable(usage_helper) else {}
        return {"ok":bool(text),"text":text,"model":model,"usage":usage}
    except urllib.error.HTTPError as exc:
        try: detail=exc.read().decode("utf-8")[:500]
        except Exception: detail=""
        return {"ok":False,"error":f"Gemini API 오류({exc.code})","detail":detail}
    except Exception as exc:
        return {"ok":False,"error":f"Gemini 호출 실패: {type(exc).__name__}: {exc}"}


def _render_engine_summary(bundle):
    cols=st.columns(3)
    with cols[0]:
        w=bundle.get("western",{})
        st.metric("🌌 서양점성술","계산 완료" if w.get("ok") else "오류")
        st.caption("기존 별빛 기간 엔진 재사용")
    with cols[1]:
        s=bundle.get("saju",{})
        st.metric("🧧 사주","계산 완료" if s.get("ok") else "오류")
        if s.get("ok"):
            p=s.get("pillars",{}); st.caption(f"{p.get('year','')} / {p.get('month','')} / {p.get('day','')} / {p.get('hour','')}")
        else: st.caption(str(s.get("error") or ""))
    with cols[2]:
        t=bundle.get("thai",{})
        st.metric("🇹🇭 태국","출생층 완료" if t.get("ok") else "오류")
        st.caption(f"{t.get('thai_day','')} · {t.get('ruler','')}")
    st.caption("※ 태국 Suriyayat(수리야얏·태국식 행성 운행)는 아직 미연결이라 기간 합의에는 포함하지 않아.")


def _render_month_table(bundle):
    western={x.get("calendar_month"):x for x in bundle.get("western",{}).get("months",[]) if isinstance(x,dict)}
    saju={x.get("calendar_month"):x for x in bundle.get("saju",{}).get("monthly",[]) if isinstance(x,dict)}
    rows=[]
    for month in sorted(set(western)|set(saju)):
        w=western.get(month,{}); s=saju.get(month,{})
        rows.append({
            "월":month,"서양 상대지수":w.get("average"),"서양 밴드":w.get("band"),
            "월운 간지":s.get("ganzhi"),"월간 십성":s.get("stem_ten_god"),"합·충":", ".join(s.get("branch_links") or []) or "-",
        })
    if rows:
        st.dataframe(rows,use_container_width=True,hide_index=True)


def render_fortune_lab(ctx):
    st.markdown("### 🧭 FORTUNE LAB · 다체계 운세 분석")
    st.caption("별빛의 서양 계산 + 사주 대운·세운·월운 + 태국 출생요일층을 한 번에 정리하고, 해석가는 Gemini 또는 외부 AI로 자유롭게 선택해.")

    forced_mode=str(ctx.get("forced_mode") or "").strip()
    if forced_mode=="💞 특정 상대":
        analysis_mode="💞 특정 상대"
        st.success("💞 특정 상대 재회 분석 · 상대 정보를 바로 입력해.")
    else:
        analysis_mode=st.radio(
            "분석 방식",
            ["🌙 일반 운세", "💞 특정 상대"],
            horizontal=True,
            key="fortune_lab_analysis_mode",
        )
    if analysis_mode=="💞 특정 상대":
        topic="💞 특정 상대와 재회"
        st.info("특정 상대 정보를 아래에 입력하면, 아는 데이터만 사용해서 재회 흐름을 계산해.")
    else:
        general_topics=[k for k in FORTUNE_LAB_TOPICS.keys() if k!="💞 특정 상대와 재회"]
        topic=st.selectbox("분석 주제",general_topics,key="fortune_lab_topic")

    gender=st.selectbox("사주 대운용 성별",["여성","남성"],index=0 if str(ctx.get("birth_gender","여성")).startswith("여") else 1,key="fortune_lab_gender")

    counterpart=None
    if analysis_mode=="💞 특정 상대":
        st.markdown("#### 💞 특정 상대 정보")
        st.caption("출생시간을 몰라도 가능해. 그 경우 상대 시주·ASC·하우스는 계산하지 않고, 아는 데이터만 사용해.")
        cp_name=st.text_input("상대 호칭 · 선택",value="",placeholder="예: A",key="fortune_lab_cp_name")
        cp_birth_date=st.date_input("상대 출생일",value=date(1990,1,1),key="fortune_lab_cp_birth_date")
        cp_time_known=st.checkbox("상대 출생시간을 알고 있음",value=False,key="fortune_lab_cp_time_known")
        cp_birth_time=st.time_input("상대 출생시간",value=dt_time(12,0),step=60,key="fortune_lab_cp_birth_time",disabled=not cp_time_known)
        cp_place=st.text_input("상대 출생지 · 선택",value="",placeholder="예: 광주",key="fortune_lab_cp_place")
        cp_lon_raw=st.text_input("상대 출생지 경도(E) · 시간 보정용 선택",value="",placeholder="시간을 정확히 알 때만 예: 126.85",key="fortune_lab_cp_lon")
        cp_context=st.text_area("현재 관계 상태 · 선택",value="",placeholder="예: 마지막 연락 시점/현재 단절 여부 정도만",key="fortune_lab_cp_context")
        cp_lon=None
        if cp_time_known and cp_lon_raw.strip():
            try: cp_lon=float(cp_lon_raw.strip())
            except Exception: st.warning("상대 경도는 숫자로 입력해줘. 경도를 비우면 상대 시주는 사용하지 않아.")
        counterpart={"name":cp_name.strip(),"birth_date":cp_birth_date,"time_known":cp_time_known,"birth_time":cp_birth_time if cp_time_known else None,"birth_place":cp_place.strip(),"longitude":cp_lon,"context":cp_context.strip()}
    default_start=date(ctx["query_date"].year,ctx["query_date"].month,1)
    default_end=date(default_start.year,12,31) if default_start.month>=8 else min(date(default_start.year,12,31),default_start+timedelta(days=150))
    c1,c2=st.columns(2)
    with c1: start_date=st.date_input("분석 시작",default_start,key="fortune_lab_start")
    with c2: end_date=st.date_input("분석 종료",default_end,key="fortune_lab_end")
    if end_date<start_date:
        st.error("분석 종료일이 시작일보다 빨라."); return
    day_count=(end_date-start_date).days+1
    if day_count>FORTUNE_LAB_MAX_DAYS:
        st.error(f"1차 버전은 한 번에 최대 {FORTUNE_LAB_MAX_DAYS}일까지 분석해."); return

    calc=st.button("🧭 세 체계 계산자료 만들기",type="primary",use_container_width=True,key="fortune_lab_calc")
    cp_fp=json.dumps(_jsonable(counterpart),ensure_ascii=False,sort_keys=True) if counterpart else ""
    fp=hashlib.sha256(f"{FORTUNE_LAB_VERSION}|{topic}|{start_date}|{end_date}|{gender}|{ctx['birth_date']}|{ctx['birth_time']}|{ctx['birth_lon']}|{ctx['natal_packed']}|{ctx['houses_packed']}|{cp_fp}".encode()).hexdigest()[:24]
    if calc:
        with st.spinner("서양 기간값 + 사주 대운·세운·월운 + 태국 출생층을 계산하는 중..."):
            st.session_state["fortune_lab_bundle"]=_build_bundle(ctx,topic,start_date,end_date,gender,counterpart=counterpart)
            st.session_state["fortune_lab_bundle_fp"]=fp
    bundle=st.session_state.get("fortune_lab_bundle") if st.session_state.get("fortune_lab_bundle_fp")==fp else None
    if not bundle:
        st.info("주제와 기간을 고른 뒤 계산자료 만들기를 눌러줘. Gemini를 안 써도 계산자료와 심층 프롬프트는 만들어져.")
        return

    _render_engine_summary(bundle)
    cp=bundle.get("counterpart")
    if isinstance(cp,dict):
        cps=cp.get("saju") or {}
        with st.expander("💞 특정 상대 계산 범위",expanded=True):
            if cps.get("ok"):
                p=cps.get("pillars") or {}
                st.write(f"상대 사주 자료 · {p.get('year','?')} / {p.get('month','?')} / {p.get('day','?')} / {p.get('hour') or '시간 미상'}")
                st.caption("현재는 상대 원국 일부 + 내 사주와의 육합·육충 보조맥락까지만 사용해. 상대 Western 시너스트리·트랜짓은 다음 단계라 특정 연락일을 만들지 않아.")
                if cp.get("cross_branch_links"):
                    st.write(" · ".join(cp.get("cross_branch_links")[:8]))
            else:
                st.warning(str(cps.get("error") or "상대 사주 계산 실패"))
    st.markdown("#### 📆 월별 계산 요약")
    _render_month_table(bundle)

    saju=bundle.get("saju",{})
    if saju.get("ok"):
        with st.expander("🧧 사주 계산 원자료"):
            st.json(_jsonable(saju),expanded=False)
            st.caption("원국은 출생지 경도 + Swiss Ephemeris 균시차로 진태양시를 보정한 뒤 lunar_python 절기 기준으로 계산해. 신강약·용희기신·형파해 전체는 아직 미계산이라 AI가 만들지 못하게 프롬프트에서 잠가뒀어.")

    prompt=_deep_prompt(bundle)
    st.markdown("#### 📋 Opus·GPT 등 심층 AI용 프롬프트")
    st.caption("아래 박스 우측 복사 아이콘으로 통째로 복사해서 원하는 AI 앱에 붙여넣으면 돼. 외부 AI가 계산을 다시 하지 못하게 이미 계산/금지 규칙을 포함했어.")
    st.code(prompt,language="text")

    models=list((ctx.get("ai_supported_models") or {}).keys())
    default_model=ctx.get("ai_model")() if callable(ctx.get("ai_model")) else (models[0] if models else "gemini-3.7-flash")
    model=st.selectbox("✨ 기본 Gemini 해설 모델",models or [default_model],index=(models.index(default_model) if default_model in models else 0),format_func=lambda m:(ctx.get("ai_supported_models") or {}).get(m,m),key="fortune_lab_model")
    cache_id=_cache_id(bundle,model)
    saved=_read_record(cache_id,"gemini")
    if isinstance(saved,dict) and saved.get("text"):
        st.markdown("#### ✨ 저장된 Gemini 해석")
        st.markdown(saved["text"])
        usage=saved.get("usage") or {}
        if usage.get("estimated_krw") is not None: st.caption(f"저장된 호출 예상 원가 · 약 {usage['estimated_krw']}원")
        regen=st.button("♻️ Gemini로 새로 해석",use_container_width=True,key="fortune_lab_regen")
    else:
        if saved is None: st.caption("이 기기에 같은 계산의 저장된 해석이 있는지 확인 중...")
        regen=st.button("✨ Gemini 기본 해석",use_container_width=True,key="fortune_lab_gemini")

    if regen:
        api_key=ctx.get("ai_api_key")() if callable(ctx.get("ai_api_key")) else ""
        thinking=ctx.get("ai_thinking_level")() if callable(ctx.get("ai_thinking_level")) else "high"
        with st.spinner("✨ Gemini가 계산자료를 해석하는 중..."):
            result=_call_gemini(prompt,model,thinking,api_key,ctx.get("gemini_usage_summary"))
        if result.get("ok"):
            st.session_state[f"fortune_lab_live_{cache_id}"]=result
            _write_record(cache_id,{"text":result.get("text",""),"model":model,"usage":result.get("usage",{}),"topic":topic,"period":bundle.get("period"),"prompt":prompt},"gemini")
            st.rerun()
        else:
            st.error(result.get("error") or "Gemini 해석 실패")

    st.markdown("#### 📥 외부 AI 해석 보관")
    st.caption("Opus/GPT에서 받은 답변을 붙여넣으면 이 기기에 계산 조건과 함께 저장해둘 수 있어. API 호출은 없어.")
    ext_saved=_read_record(cache_id,"external")
    if isinstance(ext_saved,dict) and ext_saved.get("text"):
        with st.expander("저장된 외부 AI 해석 보기"):
            st.markdown(ext_saved["text"])
    external_text=st.text_area("외부 AI 답변 붙여넣기",height=180,key=f"fortune_lab_external_text_{cache_id}")
    if st.button("💾 외부 AI 해석 저장",use_container_width=True,key=f"fortune_lab_external_save_{cache_id}"):
        if not external_text.strip(): st.warning("저장할 답변을 먼저 붙여넣어줘.")
        else:
            _write_record(cache_id,{"text":external_text.strip(),"topic":topic,"period":bundle.get("period"),"prompt":prompt},"external")
            st.success("이 기기에 저장했어.")


__all__=["render_fortune_lab","FORTUNE_LAB_VERSION"]
