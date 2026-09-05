# -*- coding: utf-8 -*-
"""Deterministic Saju relationship facts for compatibility/marriage readings.

This module intentionally returns structural facts, not a single compatibility score.
Unknown birth time omits the hour pillar and marks the day pillar as lower precision near day boundaries.
"""
from __future__ import annotations

from datetime import date, time as dt_time
from lunar_python import Solar

from integrated_fortune_v1 import _natal_saju_components, _ten_god

ENGINE_VERSION = "relationship-saju-v1"

STEM_ELEMENT = {
    "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水",
}
GENERATES = {"木":"火","火":"土","土":"金","金":"水","水":"木"}
CONTROLS = {"木":"土","土":"水","水":"火","火":"金","金":"木"}
LIUHE = {frozenset(x) for x in [("子","丑"),("寅","亥"),("卯","戌"),("辰","酉"),("巳","申"),("午","未")]}
LIUCHONG = {frozenset(x) for x in [("子","午"),("丑","未"),("寅","申"),("卯","酉"),("辰","戌"),("巳","亥")]}
LIUHAI = {frozenset(x) for x in [("子","未"),("丑","午"),("寅","巳"),("卯","辰"),("申","亥"),("酉","戌")]}
LIUPO = {frozenset(x) for x in [("子","酉"),("丑","辰"),("寅","亥"),("卯","午"),("巳","申"),("未","戌")]}


def _pillars(profile: dict) -> dict:
    known = bool(profile.get("time_known", True) and profile.get("birth_time") is not None)
    bt = profile.get("birth_time") or dt_time(12, 0)
    bd: date = profile["birth_date"]
    lon = profile.get("longitude")
    offset = float(profile.get("utc_offset_hours", 9.0))
    effective_lon = float(lon) if known and lon is not None else None
    natal = _natal_saju_components(bd, bt, offset, effective_lon)
    pillars = natal["pillars"]
    day = pillars["day"]
    precision = (
        "exact_true_solar" if known and lon is not None
        else "legal_time_no_longitude" if known
        else "date_noon_proxy"
    )
    return {
        "year": pillars["year"], "month": pillars["month"], "day": day,
        "hour": pillars["hour"] if known else None,
        "day_stem": day[:1], "day_branch": day[1:2],
        "precision": precision,
        "true_solar": natal["true_solar_meta"] if known and natal["true_solar_meta"] else None,
        "pillar_boundary_policy": natal["boundary_policy"],
        "time_known": known,
    }


def _stem_relation(a: str, b: str) -> str:
    ea, eb = STEM_ELEMENT.get(a), STEM_ELEMENT.get(b)
    if not ea or not eb:
        return "미분류"
    if ea == eb:
        return f"같은 오행({ea})"
    if GENERATES.get(ea) == eb:
        return f"A가 B를 생함({ea}→{eb})"
    if GENERATES.get(eb) == ea:
        return f"B가 A를 생함({eb}→{ea})"
    if CONTROLS.get(ea) == eb:
        return f"A가 B를 극함({ea}→{eb})"
    if CONTROLS.get(eb) == ea:
        return f"B가 A를 극함({eb}→{ea})"
    return f"오행 관계 {ea}·{eb}"


def _branch_relation(a: str, b: str) -> list[str]:
    pair = frozenset((a,b))
    out=[]
    if len(pair) < 2:
        return ["동일 지지"]
    if pair in LIUHE: out.append("六合(육합)")
    if pair in LIUCHONG: out.append("六沖(육충)")
    if pair in LIUHAI: out.append("六害(육해)")
    if pair in LIUPO: out.append("六破(육파)")
    return out or ["주요 합충해파 없음"]


def build_relationship_saju(user_profile: dict, counterpart_profile: dict) -> dict:
    a = _pillars(user_profile)
    b = _pillars(counterpart_profile)
    a_tg = _ten_god(a["day_stem"], b["day_stem"])
    b_tg = _ten_god(b["day_stem"], a["day_stem"])
    cross = []
    for a_label, a_p in (("A일지", a["day"]),("A월지",a["month"]),("A년지",a["year"])):
        for b_label, b_p in (("B일지",b["day"]),("B월지",b["month"]),("B년지",b["year"])):
            rel = _branch_relation(a_p[1:2], b_p[1:2])
            if rel != ["주요 합충해파 없음"]:
                cross.append({"a": a_label, "a_branch": a_p[1:2], "b": b_label, "b_branch": b_p[1:2], "relations": rel})
    limitations=[]
    if not a["time_known"]: limitations.append("A 출생시간 미상: 시주 제외, 일주는 경계시각 출생이면 달라질 수 있음")
    if not b["time_known"]: limitations.append("B 출생시간 미상: 시주 제외, 일주는 경계시각 출생이면 달라질 수 있음")
    return {
        "available": True,
        "engine": ENGINE_VERSION,
        "policy": "관계 구조 비교용. 궁합 점수나 결혼/재회 확률이 아님",
        "user": a,
        "counterpart": b,
        "day_master_relation": {
            "user_to_counterpart_ten_god": a_tg,
            "counterpart_to_user_ten_god": b_tg,
            "element_relation": _stem_relation(a["day_stem"], b["day_stem"]),
        },
        "spouse_palace": {
            "user_day_branch": a["day_branch"],
            "counterpart_day_branch": b["day_branch"],
            "relations": _branch_relation(a["day_branch"], b["day_branch"]),
        },
        "cross_branch_links": cross[:18],
        "limitations": limitations,
    }
