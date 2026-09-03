export type InterpretationPeriodKind = "day" | "week" | "month" | "annual";

function normalizeKind(value: unknown): InterpretationPeriodKind {
  const kind = String(value ?? "").trim();
  if (kind === "day" || kind === "week" || kind === "month" || kind === "annual") return kind;
  return "day";
}

const PERIOD_FOCUS: Record<InterpretationPeriodKind, string> = {
  day: [
    "하루 분석이다. 연간·월간 흐름처럼 일반화하지 마라.",
    "western.detail_days의 실제 시간대별 best_window·caution_window와 intraday evidence를 최우선으로 읽고, 같은 날짜의 daily_score_matrix와 key_dates/W:daily:* 근거로 교차 확인하라.",
    "시간대를 쓰는 decisions.timing에는 반드시 동일한 HH:MM~HH:MM을 가진 W:window:* 전용 근거를 evidence_refs에 붙이고, 같은 분야의 W:detail:* 근거가 있으면 그 근거도 같은 decision에 함께 붙여라.",
    "핵심 결론은 오늘 언제 움직이고 언제 피해야 하는지가 바로 보이게 쓰고, 시간대 근거가 있으면 decisions.timing과 key_windows에 날짜뿐 아니라 해당 시간대를 구체적으로 반영하라.",
    "사주·Thai는 하루 사건의 확률을 높이는 투표로 쓰지 말고 그 날짜가 속한 독립 기간 맥락만 설명하라.",
  ].join(" "),
  week: [
    "주간 분석이다. 7~9일 안의 daily_score_matrix 순서를 먼저 읽어 초반·중반·후반의 상승·하락과 전환을 구분하라.",
    "핵심 날짜 2~4개를 고르고, 해당 날짜에 detail_days 또는 W:daily:* 실제 근거가 있으면 우선 연결하라.",
    "하루짜리 피크를 주 전체 흐름으로 과장하지 말고, decisions와 key_windows는 이번 주 안에서 실제 행동 순서가 보이게 작성하라.",
    "사주·Thai는 해당 주간이 포함된 독립 기간 맥락으로만 교차 확인하라.",
  ].join(" "),
  month: [
    "월간 분석이다. 한 달의 일별 궤적과 daily_pattern_digest를 먼저 읽고, 초반·중반·후반 또는 실제 전환 구간을 점수 변화에 근거해 구분하라.",
    "western.months의 월평균은 배경으로 사용하되 평균 하나로 결론내리지 말고 key_dates와 W:daily:* 실제 근거가 있는 날짜를 핵심 시기로 뽑아라.",
    "좋은 날 목록만 나열하지 말고 어느 구간에서 흐름이 바뀌는지, 그 전환 전후에 무엇을 확인하고 피해야 하는지 decisions와 key_windows에 연결하라.",
    "사주 월운의 절입 구간과 Thai 기간층은 Western 점수에 합산하지 말고 독립 맥락으로만 비교하라.",
  ].join(" "),
  annual: [
    "연간 분석이다. 연평균만 요약하지 말고 최대 365일 daily_score_matrix → daily_pattern_digest의 상승·하락·변동성 → western.months의 12개월 변화 → key_dates의 실제 일별 트랜짓·하우스 근거 → cross_system_timeline의 독립 체계 맥락 순으로 분석하라.",
    "하루짜리 피크를 1년 전체 흐름처럼 과장하지 말고 year_phases 4구간과 핵심 전환점을 분리하라.",
    "중요한 날짜 문단에는 계산엔진이 보존한 실제 W:daily:* 근거를 우선 연결하라.",
  ].join(" "),
};

export function periodModeInstruction(payload: any, compactMode = false): string {
  const kind = normalizeKind(payload?.period_kind);
  const retry = compactMode
    ? "이전 생성이 검증을 끝까지 통과하지 못했다. 문장을 불필요하게 늘리지 말되 핵심 시기·근거 ID·행동·확인조건·회피조건을 빠뜨리지 말고 완전한 JSON으로 끝내라. "
    : "";
  return `${retry}${PERIOD_FOCUS[kind]}`;
}
