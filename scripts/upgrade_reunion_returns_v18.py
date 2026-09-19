from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# API integration -----------------------------------------------------------
main_path = Path("api/main.py")
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    'from relationship_western_v1 import build_relationship_western\n',
    'from relationship_western_v1 import build_relationship_western\nfrom relationship_return_v1 import ENGINE_VERSION as REL_RETURN_ENGINE_VERSION, augment_relationship_with_returns\n',
    "api return import",
)
main = replace_once(
    main,
    'APP_VERSION = "api-fortune-v5.8-integrated-precision-v2"',
    'APP_VERSION = "api-fortune-v5.9-reunion-solar-lunar-return-v1"',
    "api version",
)
main = replace_once(
    main,
    '        "relationship_engine": REL_ENGINE_VERSION,\n',
    '        "relationship_engine": REL_ENGINE_VERSION,\n        "relationship_return_engine": REL_RETURN_ENGINE_VERSION,\n',
    "api meta return engine",
)
main = replace_once(
    main,
    '        except Exception as saju_exc:\n            result["saju_relationship"] = {"available": False, "engine": REL_SAJU_ENGINE_VERSION, "error": str(saju_exc)}\n',
    '        except Exception as saju_exc:\n            result["saju_relationship"] = {"available": False, "engine": REL_SAJU_ENGINE_VERSION, "error": str(saju_exc)}\n        if request.analysis_mode == "reunion":\n            try:\n                result = augment_relationship_with_returns(\n                    result, user_payload, cp_payload, request.start_date, request.end_date\n                )\n            except Exception as return_exc:\n                result["reunion_return_support"] = {\n                    "available": False,\n                    "engine": REL_RETURN_ENGINE_VERSION,\n                    "error": str(return_exc),\n                    "policy": "Solar/Lunar Return is an optional background cross-check and does not block the core reunion calculation.",\n                    "event_probability": "not_calculated",\n                }\n',
    "api reunion return augmentation",
)
main_path.write_text(main, encoding="utf-8")


# Evidence contract ---------------------------------------------------------
ev_path = Path("supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.ts")
ev = ev_path.read_text(encoding="utf-8")
ev = replace_once(
    ev,
    "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.2-four-stage-direction-gate'",
    "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.3-solar-lunar-return-context'",
    "evidence version",
)
ev = replace_once(
    ev,
    "const family = ({natal:90,secondary:100,relationship_chart:82,house:76,transit:68,tertiary:58,metric:64} as Record<string,number>)[e.family] ?? 50",
    "const family = ({natal:90,secondary:100,relationship_chart:82,house:76,transit:68,return:66,tertiary:58,metric:64} as Record<string,number>)[e.family] ?? 50",
    "return family priority",
)
return_helper = r'''
function addReturnContext(items: Evidence[], packet: any) {
  const support = packet?.reunion_return_support
  if (!support || typeof support !== 'object' || support?.available === false) return
  const directionFor = (person: string): Evidence['direction'] => person === 'counterpart' ? 'incoming' : person === 'user' ? 'outgoing' : 'shared'
  const addEvents = (kind: 'solar_return'|'lunar_return', group: string, question: QuestionKey) => {
    const block = support?.[kind] ?? {}
    for (const person of ['user','counterpart']) {
      for (const row of arr(block?.[person]?.events).slice(0,8)) {
        const score = num(row?.activation_score)
        const start = short(row?.window_start, 16)
        const end = short(row?.window_end_exclusive, 16)
        const facts = [
          `${kind} background=${score === null ? '-' : score.toFixed(1)}`,
          `balance=${short(row?.balance,24)}`,
          `precision=${short(row?.precision,24)}`,
          `independent_bonus_eligible=false`,
          ...arr(row?.top_aspects).slice(0,3).map((a:any)=>`${aspectText(a)} orb=${Number(a?.orb ?? 0).toFixed(2)}°`),
        ]
        items.push(makeEvidence({
          question, layer:`return.${kind}.${person}`, family:'return', independence_group:group,
          role:'context', direction:directionFor(person), period:start && end ? `${start}..${end}` : start || null,
          date:null, aspect:null, orb:null, tone:row?.balance ?? null, facts,
        }, items.length+1))
      }
    }
  }
  addEvents('solar_return','solar_return_context','why_reconnect')
  addEvents('solar_return','solar_return_context','rebuild')
  addEvents('lunar_return','lunar_return_context','timing')

  for (const row of arr(support?.candidate_dates).slice(0,10)) {
    if (!row?.date || row?.exact_date_basis !== 'fast_transit_trigger') continue
    const bg = num(row?.return_context?.background_score)
    items.push(makeEvidence({
      question:'timing', layer:'return.candidate_context', family:'return', independence_group:'return_context_annotation',
      role:'context', direction:'shared', period:null, date:short(row.date,16), aspect:null, orb:null, tone:null,
      facts:[
        `fast_trigger_score=${Number(row?.fast_trigger_score ?? 0).toFixed(1)}`,
        `return_background=${bg === null ? '-' : bg.toFixed(1)}`,
        `priority_index=${Number(row?.priority_index ?? 0).toFixed(1)}`,
        'return_role=background_tiebreaker_only',
        'independent_bonus_eligible=false',
      ],
    }, items.length+1))
  }
}

'''
ev = replace_once(ev, "function compact(items: Evidence[]) {", return_helper + "function compact(items: Evidence[]) {", "insert return helper")
ev = replace_once(
    ev,
    "  const evidence = compact(items)\n",
    "  addReturnContext(items, packet)\n\n  const evidence = compact(items)\n",
    "call return helper",
)
ev = replace_once(
    ev,
    "    progressed_synastry: arr(adv?.months).some(m=>m?.progressed_synastry?.available), progressed_composite:arr(adv?.months).some(m=>m?.progressed_composite?.available), marks_tertiary:arr(adv?.months).some(m=>m?.marks_tertiary?.available), daily_transit:arr(packet?.transit_triggers?.top_days).length>0,\n",
    "    progressed_synastry: arr(adv?.months).some(m=>m?.progressed_synastry?.available), progressed_composite:arr(adv?.months).some(m=>m?.progressed_composite?.available), marks_tertiary:arr(adv?.months).some(m=>m?.marks_tertiary?.available), daily_transit:arr(packet?.transit_triggers?.top_days).length>0,\n    solar_return: Boolean(packet?.reunion_return_support?.solar_return?.user?.available || packet?.reunion_return_support?.solar_return?.counterpart?.available),\n    lunar_return: Boolean(packet?.reunion_return_support?.lunar_return?.user?.available || packet?.reunion_return_support?.lunar_return?.counterpart?.available),\n",
    "return coverage",
)
ev = replace_once(
    ev,
    "Progression is period context; exact dates require fast triggers. Return labels that restate the same transit phenomenon do not add an independent vote.",
    "Progression is period context; exact dates require fast triggers. Solar Return is annual background and Lunar Return is monthly/emotional background. Return context may cross-check or break ties among dates that already passed the fast-trigger gate, but never creates an exact date and never adds an independent convergence vote against the same underlying transit phenomenon.",
    "return evidence policy",
)
ev_path.write_text(ev, encoding="utf-8")


# Gemini relationship interpretation contract ------------------------------
idx_path = Path("supabase/functions/relationship-interpret-v9-preview/index.ts")
idx = idx_path.read_text(encoding="utf-8")
idx = replace_once(
    idx,
    'const REUNION_VERSION="relationship-v11.11-four-stage-gated-dates";',
    'const REUNION_VERSION="relationship-v11.12-solar-lunar-return-context";',
    "reunion interpreter version",
)
needle = "- 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 네 단계로 분리하고 한 단계의 강함을 다음 단계의 성립으로 자동 승격하지 않는다."
replacement = needle + "\n- CALCULATED_DATA.reunion_return_support의 Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경으로만 사용한다. Return만으로 구체 날짜를 만들지 말고, 이미 fast transit trigger를 통과한 날짜들 사이에서 배경 교차검증/동률 해소에만 사용한다. 같은 천문 현상을 transit과 Return으로 중복 가산하지 않는다."
idx = replace_once(idx, needle, replacement, "reunion return prompt policy")
idx_path.write_text(idx, encoding="utf-8")


# External-copy prompt should follow the same rules -------------------------
fmt_path = Path("web/src/lib/resultFormatters.ts")
fmt = fmt_path.read_text(encoding="utf-8")
old_rule = "kind === 'reunion' ? '- 재회운은 reunion_dimensions의 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 분리한다. incoming/outgoing은 상대측/내측 활성이지 행동 방향이 아니다. reunion_secondary_support는 기간 배경이며 exact date를 만들지 않는다.' : '',"
new_rule = "kind === 'reunion' ? '- 재회운은 reunion_dimensions의 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 분리한다. incoming/outgoing은 상대측/내측 활성이지 행동 방향이 아니다. reunion_secondary_support는 진행계열 기간 배경이며 exact date를 만들지 않는다. reunion_return_support의 Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경이다. Return은 fast trigger를 통과한 날짜를 교차검증하는 보조층일 뿐 날짜를 새로 만들거나 같은 transit을 중복 가산하지 않는다.' : '',"
fmt = replace_once(fmt, old_rule, new_rule, "external prompt return policy")
fmt_path.write_text(fmt, encoding="utf-8")

print("reunion return v18 integration applied")
