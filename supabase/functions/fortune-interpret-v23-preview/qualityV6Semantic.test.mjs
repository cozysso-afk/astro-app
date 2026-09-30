import assert from "node:assert/strict";
import test from "node:test";

import { inspectInterpretationQuality } from "../fortune-interpret-v6-preview/qualityV2.ts";

const cases = [
  ["friends", "친구운은 무난해요. 천천히 지켜보세요.", "친구 관계는 새 사람보다 기존 약속의 신뢰도를 다시 가르는 구간이야.", "먼저 잡은 약속을 상대가 날짜까지 확정하고, 취소할 때 대안을 함께 내는지가 현실 장면이야.", "이번 주 한 건만 먼저 제안하고 상대가 구체화하는지 기다려.", "상대가 두 번 연속 일정 확정이나 대안을 내면 관계 우선순위를 올리고, 반복 취소만 하면 낮춰."],
  ["coworkers", "동료와 소통을 잘해보세요.", "동료 관계는 호감보다 책임 범위를 분명히 할수록 유리해.", "요청한 업무의 담당자·마감·완료 기준이 회의 뒤 문서에 남는지가 판단 장면이야.", "다음 협업 요청에 담당과 완료 기준을 한 문장으로 확인해.", "상대가 합의한 마감을 지키면 협업 범위를 넓히고, 책임을 다시 미루면 범위를 줄여."],
  ["love_single", "새로운 인연이 올 수 있어요.", "솔로 상태의 결론은 만남 수보다 내가 받을 제안의 기준을 먼저 세우는 쪽이야.", "소개가 들어왔을 때 직업 같은 조건보다 대화 방식과 두 번째 만남 제안이 확인 장면이야.", "수락 전 꼭 확인할 기준 두 개와 거절 기준 한 개를 적어둬.", "첫 만남 뒤 상대가 구체적인 두 번째 일정을 제안하면 탐색을 이어가고, 모호한 연락만 남으면 멈춰."],
  ["love_crush", "짝사랑은 용기를 내보세요.", "짝사랑은 내 표현보다 상대가 대화를 자발적으로 확장하는지가 현재 결론을 가르는 단계야.", "답장 예의가 아니라 상대가 질문을 돌려주거나 먼저 새 화제를 여는지가 현실 근거야.", "부담 없는 질문을 한 번 보내고 추가 메시지 없이 반응의 질을 봐.", "상대의 자발적 질문과 만남 제안이 생기면 한 단계 올리고, 단답만 반복되면 기대를 낮춰."],
  ["love_flirting", "썸은 서두르지 마세요.", "썸은 호감 표현은 있지만 관계가 실제 일정으로 이어지는지 아직 조건부야.", "밤늦은 대화량보다 낮 시간의 만남 제안과 약속 확정이 이어지는지가 핵심 장면이야.", "이번 대화에서 가능한 날짜 두 개를 제시하고 상대가 선택하는지 봐.", "상대가 날짜를 고르고 만남 뒤 후속 약속까지 제안하면 진전으로 보고, 채팅만 늘면 보류해."],
  ["love_ambiguous", "애매한 관계는 시간을 두세요.", "애매한 관계는 감정 추측보다 관계 정의 질문을 회피하는지가 현재 결론이야.", "앞으로의 만남 의도를 물었을 때 농담으로 넘기지 않고 기대와 한계를 말하는지가 현실 장면이야.", "다음 만남 전에 원하는 관계와 기다릴 수 있는 기한을 짧게 밝혀.", "상대가 같은 기한 안에 의도와 행동을 맞추면 이어가고, 정의를 피한 채 친밀감만 요구하면 끝내."],
  ["love_couple", "연인은 대화가 필요해요.", "연인 관계는 사과의 크기보다 갈등 뒤 합의가 다음 상황에서도 지켜지는지가 결론이야.", "연락 두절 갈등 뒤 정한 사전 고지가 실제 바쁜 날에도 실행되는지가 판단 장면이야.", "합의할 행동 하나와 지키지 못할 때 알릴 방식을 함께 정해.", "같은 상황에서 합의 행동이 반복되면 회복으로 보고, 사과 뒤 같은 단절이 재발하면 구조 문제로 봐."],
  ["love_reunion_interest", "재회 가능성은 열려 있어요.", "재회 관심은 추억이나 미안함이 아니라 헤어진 원인을 바꿀 계획이 있는지로만 조건부 판단해야 해.", "상대가 과거 문제를 구체적으로 인정하고 일정·거리·소통 방식의 변경안을 제안하는지가 현실 장면이야.", "답을 주기 전에 바뀐 행동의 사례와 앞으로 지킬 계획을 한 번 물어봐.", "설명한 변화가 몇 주간 행동으로 이어지면 만남 검토로 올리고, 외로움과 추억만 말하면 재개하지 마."],
];

function reportFor([key, before, conclusion, real_scene, action, change_condition]) {
  const data = {
    overall: { summary: "지지 신호와 주의 신호를 함께 읽고 현실 행동으로 다음 판단을 갱신한다." },
    clusters: { relationship: { [key]: { conclusion, real_scene, action, change_condition, evidence_refs: [], applicability: "conditional" } } },
    topic_analysis: {}, key_windows: [], cross_checks: [], decisions: [], priorities: [],
  };
  return { before, after: data.clusters.relationship[key], report: inspectInterpretationQuality(data, { evidence_ledger: [] }) };
}

test("eight fixture results answer conclusion, action, and change condition in one read", () => {
  assert.equal(cases.length, 8);
  for (const sample of cases) {
    const { before, after, report } = reportFor(sample);
    assert.ok(before.length > 8);
    assert.ok(after.conclusion.length >= 10);
    assert.ok(after.action.length >= 8);
    assert.ok(after.change_condition.length >= 12);
    assert.equal(report.stages[5].passed, true, `${sample[0]}: ${report.stages[5].issues.join(" / ")}`);
  }
});

test("V6 rejects interchangeable interpersonal copy", () => {
  const section = { conclusion: "관계를 조건부로 읽어.", real_scene: "상대가 약속을 구체화하는지 봐.", action: "질문을 한 번 보내.", change_condition: "행동이 이어지면 올리고 아니면 낮춰.", evidence_refs: [], applicability: "conditional" };
  const data = { overall: { summary: "혼합 흐름" }, clusters: { relationship: { friends: section, coworkers: { ...section } } }, topic_analysis: {}, key_windows: [], cross_checks: [], decisions: [], priorities: [] };
  const report = inspectInterpretationQuality(data, { evidence_ledger: [] });
  assert.equal(report.stages[5].passed, false);
  assert.match(report.stages[5].issues.join(" "), /바꿔 붙일 수 있음/);
});
