import assert from "node:assert/strict";
import test from "node:test";

import { periodModeInstruction } from "./periodInstruction.ts";

test("day instruction prioritizes intraday evidence and never asks for annual trajectory", () => {
  const text = periodModeInstruction({ period_kind: "day" });
  assert.match(text, /하루 분석/);
  assert.match(text, /detail_days/);
  assert.match(text, /시간대/);
  assert.match(text, /W:window:\*/);
  assert.match(text, /W:detail:\*/);
  assert.doesNotMatch(text, /365일/);
  assert.doesNotMatch(text, /12개월/);
});

test("all period prompts forbid percent conversion and deterministic future claims", () => {
  for (const period_kind of ["day", "week", "month", "annual"]) {
    const text = periodModeInstruction({ period_kind });
    assert.match(text, /숫자 뒤에 % 기호를 절대 붙이지 마라/);
    assert.match(text, /사건 발생 확률이나 투자 수익률로 변환하지 마라/);
    assert.match(text, /결정론적 미래 단정도 쓰지 마라/);
    assert.match(text, /78점/);
  }
});

test("week instruction follows daily sequence and key dates", () => {
  const text = periodModeInstruction({ period_kind: "week" });
  assert.match(text, /주간 분석/);
  assert.match(text, /daily_score_matrix/);
  assert.match(text, /초반·중반·후반/);
  assert.match(text, /핵심 날짜 2~4개/);
  assert.doesNotMatch(text, /365일/);
});

test("month instruction emphasizes intra-month transitions rather than one monthly average", () => {
  const text = periodModeInstruction({ period_kind: "month" });
  assert.match(text, /월간 분석/);
  assert.match(text, /초반·중반·후반/);
  assert.match(text, /평균 하나로 결론내리지 말고/);
  assert.match(text, /절입 구간/);
  assert.doesNotMatch(text, /365일/);
});

test("annual instruction keeps full 365-day to monthly to key-date hierarchy", () => {
  const text = periodModeInstruction({ period_kind: "annual" });
  assert.match(text, /연간 분석/);
  assert.match(text, /365일/);
  assert.match(text, /12개월/);
  assert.match(text, /year_phases 4구간/);
  assert.match(text, /W:daily:\*/);
});

test("compact retry preserves the original period focus with quality safety margins", () => {
  const day = periodModeInstruction({ period_kind: "day" }, true);
  const month = periodModeInstruction({ period_kind: "month" }, true);
  const annual = periodModeInstruction({ period_kind: "annual" }, true);
  assert.match(day, /이전 생성이 검증을 끝까지 통과하지 못했다/);
  assert.match(day, /하루 분석/);
  assert.match(day, /시간대/);
  assert.match(day, /overall\.summary는 최소 130자/);
  assert.match(month, /이전 생성이 검증을 끝까지 통과하지 못했다/);
  assert.match(month, /월간 분석/);
  assert.match(month, /overall\.summary는 최소 190자/);
  assert.match(month, /참고도 최소 30자/);
  assert.doesNotMatch(month, /365일/);
  assert.match(annual, /overall\.summary는 최소 270자/);
  assert.match(annual, /참고도 최소 35자/);
});

test("unknown period kind fails safe to day focus instead of annual focus", () => {
  const text = periodModeInstruction({ period_kind: "unexpected" });
  assert.match(text, /하루 분석/);
  assert.doesNotMatch(text, /365일/);
});
