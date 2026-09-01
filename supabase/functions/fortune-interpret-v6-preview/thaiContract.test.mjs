import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThaiOutputFallback,
  compactThaiProductSuriyayat,
  inspectThaiOutputSafety,
  runWithThaiOutputSafety,
  thaiOutputGuardRequired,
} from "./thaiContract.ts";
import { compactCalculation, SCHEMA, TOPICS, validateOutput } from "./core.ts";

function route(house) {
  return {
    route_key: `H${house}:mars->H10`,
    source_topic_domains: ["self"],
    carrier_planet: { key: "mars", archetype_domains: ["action"] },
    destination_context_domains: ["career"],
    basic_status_modifiers: [{ status_key: "kaset", functional_direction: "stable_self_supported" }],
    interpretation_level: "descriptive_nonpredictive",
  };
}

function suriyayat() {
  return {
    available: true,
    engine: "suriyayat-test",
    natal: { positions: {} },
    period_start: { positions: {} },
    period_end: { positions: {} },
    lagna: {
      available: true,
      engine: "thai-lagna-product-promotion-v1.1-fail-closed",
      method_key: "common_anto_0600_lmt",
      method: "common_anto_0600_lmt",
      method_thai: "อันโตนาทีสามัญ 06:00 ปรับเวลาท้องถิ่น",
      longitude_deg: 123.456,
      sign_index: 4,
      sign_en: "Leo",
      sign_th: "สิงห์",
      sign_ko: "사자자리",
      degree: 3,
      minute: 27,
      second: 22,
      display: "사자자리 3°27′22″",
      validation: {
        numeric_position_validated: true,
        global_coordinates_independently_validated: true,
        world_numeric_checks: 16,
      },
      interpretation_scope: "descriptive_nonpredictive_house_context_only",
    },
    ai_safe_packet_product: {
      eligible_for_gemini: true,
      research_only: false,
      engine: "thai-ai-safe-packet-research-v1.0-lagna-gated",
      product_promotion_engine: "thai-lagna-product-promotion-v1.1-fail-closed",
      route_count: 12,
      routes: Array.from({ length: 12 }, (_, index) => route(index + 1)),
      promotion_gate: {
        gemini_interpretation_allowed: true,
        school_policy_allowed: false,
        exception_application_allowed: false,
        net_valence_allowed: false,
        final_good_bad_judgement_allowed: false,
        event_judgement_allowed: false,
        timing_prediction_allowed: false,
        probability_allowed: false,
        scores_allowed: false,
      },
    },
  };
}

function safeOutput() {
  return {
    headline: "차분한 흐름",
    overall: { summary: "사건을 단정할 수 없어." },
    clusters: { relationship: "현실 신호를 확인해." },
    systems: { western: "계산 근거", saju: "계산 근거", thai: "하우스 연결 맥락만 설명해." },
    limits: "미래 사건은 확정할 수 없어.",
  };
}

test("validated product packet is exposed under the safe transport name", () => {
  const compact = compactThaiProductSuriyayat(suriyayat());
  assert.equal(compact.lagna.display, "사자자리 3°27′22″");
  assert.equal(compact.ai_safe_descriptive_packet.route_count, 12);
  assert.equal(thaiOutputGuardRequired({ thai: { suriyayat: compact } }), true);
  assert.doesNotMatch(JSON.stringify(compact), /school_policy_research|dignity_exceptions_research|prediction|"score"/i);
});

test("full calculation compaction activates the promoted Thai guard", () => {
  const calculation = { western: {}, saju: {}, thai: { suriyayat: suriyayat() } };
  const compact = compactCalculation(calculation);
  assert.equal(compact.thai.suriyayat.lagna.available, true);
  assert.equal(compact.thai.suriyayat.ai_safe_descriptive_packet.route_count, 12);
  assert.equal(thaiOutputGuardRequired(compact), true);
});

test("topic contract is unified and every topic is structurally required", () => {
  assert.ok(TOPICS.includes("대인관계"));
  assert.ok(TOPICS.includes("연락"));
  assert.deepEqual(SCHEMA.properties.topic_analysis.required, [...TOPICS]);
  assert.equal(validateOutput({ overall: {}, clusters: {}, contact_flow: {}, investment_reading: {}, systems: {}, topic_analysis: {} }), null);
});

test("packet fails closed when a predictive gate opens or routes are incomplete", () => {
  const openGate = suriyayat();
  openGate.ai_safe_packet_product.promotion_gate.probability_allowed = true;
  assert.equal(compactThaiProductSuriyayat(openGate).ai_safe_descriptive_packet, undefined);
  const missingRoute = suriyayat();
  missingRoute.ai_safe_packet_product.routes.pop();
  assert.equal(compactThaiProductSuriyayat(missingRoute).ai_safe_descriptive_packet, undefined);
});

test("invalid numeric Lagna identity is not transported", () => {
  const invalid = suriyayat();
  invalid.lagna.sign_index = 11;
  const compact = compactThaiProductSuriyayat(invalid);
  assert.deepEqual(compact.lagna, { available: false });
  assert.equal(compact.ai_safe_descriptive_packet, undefined);
});

test("safe descriptive output passes", () => {
  const result = inspectThaiOutputSafety(safeOutput(), true);
  assert.equal(result.safe, true, JSON.stringify(result.violations));
});

test("probability, deterministic contact, exact Thai date, score and valence are rejected", () => {
  const samples = [
    ["재회 가능성은 80%야.", "numeric_probability"],
    ["이번에는 반드시 연락이 온다.", "deterministic_event"],
    ["Suriyayat 기준 9월 3일에 관계 사건이 생겨.", "thai_exact_timing"],
    ["Thai 점수는 88점이야.", "thai_score"],
    ["Lagna 기준 대길이야.", "thai_final_good_bad"],
  ];
  for (const [text, expected] of samples) {
    const output = safeOutput();
    output.systems.thai = text;
    const codes = inspectThaiOutputSafety(output, true).violations.map((item) => item.code);
    assert.ok(codes.includes(expected), `${text}: ${codes.join(",")}`);
  }
});

test("fallback removes unsafe Thai text and preserves Western and Saju", () => {
  const unsafe = safeOutput();
  unsafe.overall.summary = "Western 흐름은 점검이 필요해. Thai상 재회 가능성은 80%야.";
  unsafe.systems.thai = "반드시 연락이 온다.";
  const fallback = buildThaiOutputFallback(unsafe);
  assert.match(fallback.overall.summary, /Western 흐름/);
  assert.doesNotMatch(JSON.stringify(fallback), /80%|반드시 연락/);
  assert.equal(fallback.systems.thai, "");
  assert.match(fallback.limits, /출력 안전검증/);
});

test("unsafe output retries exactly once then returns a local safe fallback", async () => {
  const compact = compactThaiProductSuriyayat(suriyayat());
  const payload = { thai: { suriyayat: compact } };
  const unsafe = safeOutput();
  unsafe.systems.thai = "반드시 연락이 온다.";
  const calls = [];
  const result = await runWithThaiOutputSafety(payload, async (strict) => {
    calls.push(strict);
    if (!strict) return { ok: false, output_guard_failed: true, unsafe_data: unsafe, model: "primary", usage: { prompt_tokens: 10, candidate_tokens: 4, thought_tokens: 2, total_tokens: 16 } };
    return { ok: false, error: "transport timeout", model: "primary" };
  }, (value) => value);
  assert.deepEqual(calls, [false, true]);
  assert.equal(result.ok, true);
  assert.equal(result.thai_safety_retry, true);
  assert.equal(result.thai_safety_fallback, true);
  assert.equal(result.attempt_count, 2);
  assert.equal(result.usage.total_tokens, 16);
  assert.equal(result.data.systems.thai, "");
});

test("safe strict retry is returned without a third Gemini call", async () => {
  const compact = compactThaiProductSuriyayat(suriyayat());
  const payload = { thai: { suriyayat: compact } };
  const calls = [];
  const result = await runWithThaiOutputSafety(payload, async (strict) => {
    calls.push(strict);
    if (!strict) return { ok: false, output_guard_failed: true, unsafe_data: safeOutput(), usage: { total_tokens: 8 } };
    return { ok: true, data: safeOutput(), model: "primary", usage: { total_tokens: 7 } };
  }, (value) => value);
  assert.deepEqual(calls, [false, true]);
  assert.equal(result.ok, true);
  assert.equal(result.thai_safety_retry, true);
  assert.equal(result.thai_safety_fallback, undefined);
  assert.equal(result.usage.total_tokens, 15);
});
