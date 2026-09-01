export const THAI_CONTRACT_VERSION = "thai-web-ai-contract-v1.0";
export const THAI_FALLBACK_NOTE = "태국점성 설명은 출력 안전검증을 통과하지 못해 이번 해설에서는 제외했어.";

const PRODUCT_ENGINE = "thai-lagna-product-promotion-v1.1-fail-closed";
const PRODUCT_METHOD = "common_anto_0600_lmt";
const PRODUCT_SCOPE = "descriptive_nonpredictive_house_context_only";
const MIN_WORLD_CHECKS = 16;
const PRODUCT_SIGNS = [
  ["Aries", "เมษ", "양자리"], ["Taurus", "พฤษภ", "황소자리"],
  ["Gemini", "มิถุน", "쌍둥이자리"], ["Cancer", "กรกฎ", "게자리"],
  ["Leo", "สิงห์", "사자자리"], ["Virgo", "กันย์", "처녀자리"],
  ["Libra", "ตุล", "천칭자리"], ["Scorpio", "พิจิก", "전갈자리"],
  ["Sagittarius", "ธนู", "사수자리"], ["Capricorn", "มกร", "염소자리"],
  ["Aquarius", "กุมภ์", "물병자리"], ["Pisces", "มีน", "물고기자리"],
] as const;
const ROUTE_KEY_RE = /^H([1-9]|1[0-2]):[a-z][a-z0-9_]*->H([1-9]|1[0-2])$/;
const BLOCKED_GATES = [
  "school_policy_allowed", "exception_application_allowed", "net_valence_allowed",
  "final_good_bad_judgement_allowed", "event_judgement_allowed",
  "timing_prediction_allowed", "probability_allowed", "scores_allowed",
] as const;

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function packedIdentity(longitude: number) {
  const totalArcmin = longitude * 60;
  let signIndex = Math.floor(totalArcmin / 1800) % 12;
  const withinArcmin = totalArcmin - signIndex * 1800;
  let degree = Math.floor(withinArcmin / 60);
  const minuteFloat = withinArcmin - degree * 60;
  let minute = Math.floor(minuteFloat);
  let second = Math.round((minuteFloat - minute) * 60);
  if (second >= 60) { minute += 1; second -= 60; }
  if (minute >= 60) { degree += 1; minute -= 60; }
  if (degree >= 30) { signIndex = (signIndex + 1) % 12; degree -= 30; }
  return { signIndex, degree, minute, second };
}

export function productLagnaIsValid(value: unknown) {
  const row = object(value);
  const validation = object(row.validation);
  const longitude = row.longitude_deg;
  if (
    row.available !== true || row.engine !== PRODUCT_ENGINE || row.method !== PRODUCT_METHOD ||
    row.method_key !== PRODUCT_METHOD || row.interpretation_scope !== PRODUCT_SCOPE ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360 ||
    ![row.sign_index, row.degree, row.minute, row.second].every(Number.isInteger) ||
    validation.numeric_position_validated !== true ||
    validation.global_coordinates_independently_validated !== true ||
    !Number.isInteger(validation.world_numeric_checks) || validation.world_numeric_checks < MIN_WORLD_CHECKS
  ) return false;
  const packed = packedIdentity(longitude);
  if (
    row.sign_index !== packed.signIndex || row.degree !== packed.degree ||
    row.minute !== packed.minute || row.second !== packed.second
  ) return false;
  const sign = PRODUCT_SIGNS[packed.signIndex];
  return row.sign_en === sign[0] && row.sign_th === sign[1] && row.sign_ko === sign[2] &&
    row.display === `${sign[2]} ${packed.degree}°${String(packed.minute).padStart(2, "0")}′${String(packed.second).padStart(2, "0")}″`;
}

function routesAreComplete(value: unknown) {
  if (!Array.isArray(value) || value.length !== 12) return false;
  const houses = new Set<number>();
  const keys = new Set<string>();
  for (const item of value) {
    const route = object(item);
    const match = typeof route.route_key === "string" ? ROUTE_KEY_RE.exec(route.route_key) : null;
    if (!match || route.interpretation_level !== "descriptive_nonpredictive") return false;
    houses.add(Number(match[1]));
    keys.add(route.route_key);
  }
  return houses.size === 12 && keys.size === 12;
}

function compactSafePacket(value: unknown) {
  const packet = object(value);
  const gate = object(packet.promotion_gate);
  if (
    packet.eligible_for_gemini !== true || packet.research_only !== false ||
    packet.product_promotion_engine !== PRODUCT_ENGINE ||
    gate.gemini_interpretation_allowed !== true ||
    BLOCKED_GATES.some((key) => gate[key] !== false) || !routesAreComplete(packet.routes)
  ) return null;
  const routes = packet.routes.map((item: unknown) => {
    const route = object(item);
    const carrier = object(route.carrier_planet);
    return {
      route_key: route.route_key,
      source_topic_domains: Array.isArray(route.source_topic_domains) ? route.source_topic_domains : [],
      carrier_planet: {
        key: carrier.key,
        archetype_domains: Array.isArray(carrier.archetype_domains) ? carrier.archetype_domains : [],
      },
      destination_context_domains: Array.isArray(route.destination_context_domains) ? route.destination_context_domains : [],
      basic_status_modifiers: Array.isArray(route.basic_status_modifiers)
        ? route.basic_status_modifiers.map((entry: unknown) => {
            const modifier = object(entry);
            return { status_key: modifier.status_key, functional_direction: modifier.functional_direction };
          })
        : [],
      interpretation_level: "descriptive_nonpredictive",
    };
  });
  return { engine: packet.engine, mode: "descriptive_nonpredictive", route_count: routes.length, routes };
}

function compactPositionSnapshot(value: unknown) {
  const snapshot = object(value);
  const positions = object(snapshot.positions);
  return {
    instant: snapshot.instant,
    suriyayat_reference_time: snapshot.suriyayat_reference_time,
    positions: Object.fromEntries(Object.entries(positions).map(([key, raw]) => {
      const row = object(raw);
      return [key, { display: row.display, longitude_deg: row.longitude_deg }];
    })),
  };
}

export function compactThaiProductSuriyayat(value: unknown) {
  const sy = object(value);
  if (sy.available !== true) return null;
  const lagna = productLagnaIsValid(sy.lagna) ? object(sy.lagna) : null;
  const compact: Record<string, any> = {
    available: true,
    engine: sy.engine,
    time_basis: sy.time_basis,
    validation: sy.validation ?? null,
    natal: compactPositionSnapshot(sy.natal),
    period_start: compactPositionSnapshot(sy.period_start),
    period_end: compactPositionSnapshot(sy.period_end),
    lagna: lagna ? {
      available: true, engine: lagna.engine, method_key: lagna.method_key, method: lagna.method,
      method_thai: lagna.method_thai, longitude_deg: lagna.longitude_deg, sign_index: lagna.sign_index,
      sign_en: lagna.sign_en, sign_th: lagna.sign_th, sign_ko: lagna.sign_ko,
      degree: lagna.degree, minute: lagna.minute, second: lagna.second, display: lagna.display,
      validation: lagna.validation, interpretation_scope: lagna.interpretation_scope,
    } : { available: false },
    interpretation_status: sy.interpretation_status,
    policy: sy.policy,
  };
  if (lagna) {
    const packet = compactSafePacket(sy.ai_safe_packet_product);
    if (packet) compact.ai_safe_descriptive_packet = packet;
  }
  return compact;
}

const THAI_MARKER_RE = /(?:Thai|태국(?:점성술|점성)?|Suriyayat|수리야얏|สุริยยาตร์|Lagna|라그나|ลัคนา)/i;
const PERCENT_RE = /(?<!\d)(?:100|\d{1,2})(?:\.\d+)?\s*%/;
const NUMERIC_PROBABILITY_RE = /(?:확률|가능성|성공률|재회율|연락률)\s*(?:은|는|이|가|:)?\s*(?:약\s*)?(?:100|\d{1,2})(?:\.\d+)?\s*%?/;
const THAI_SCORE_RE = /(?:점수\s*(?:은|는|이|가|:)?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*점)/;
const EXACT_DATE_RE = /(?:\b20\d{2}[-./]\d{1,2}[-./]\d{1,2}\b|\b\d{1,2}[-./]\d{1,2}[-./]\d{1,2}\b|\d{1,2}월\s*\d{1,2}일)/;
const EXACT_TIME_RE = /(?:(?:오전|오후)\s*\d{1,2}(?::\d{2})?\s*시?|(?<!\d)\d{1,2}:\d{2}(?!\d)|\d{1,2}시\s*\d{1,2}분)/;
const EVENT_ASSERTION_RE = /(?:연락(?:이|가)?\s*(?:온다|올\s*(?:거야|것이다)|오게\s*된다)|재회(?:한다|하게\s*된다|할\s*(?:거야|것이다))|결혼(?:한다|하게\s*된다|할\s*(?:거야|것이다))|합격(?:한다|하게\s*된다|할\s*(?:거야|것이다))|취업(?:한다|하게\s*된다|할\s*(?:거야|것이다))|이직(?:한다|하게\s*된다|할\s*(?:거야|것이다))|수익(?:이|가)?\s*(?:난다|발생한다|확정된다)|돈(?:을)?\s*번다|사건(?:이|가)?\s*발생한다)/;
const CERTAINTY_RE = /(?:반드시|확실히|무조건|틀림없이|분명히|100\s*%\s*확실)/;
const DENIAL_RE = /(?:단정(?:할|하)\s*수\s*없|보장(?:할|하)\s*수\s*없|확정(?:할|하)\s*수\s*없|예측(?:할|하)\s*수\s*없|의미하지\s*않|보장하지\s*않|단정하지\s*않)/;
const GOOD_BAD_RE = /(?:대길|대흉|길흉\s*점수|길운\s*확정|흉운\s*확정|길하다|흉하다)/;

type Violation = { code: string; path: string; snippet: string };

function textEntries(value: unknown, path: string[] = []): Array<[string[], string]> {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => textEntries(item, [...path, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => textEntries(item, [...path, key]));
  }
  return [];
}

export function thaiOutputGuardRequired(payload: unknown) {
  const packet = object(object(object(payload).thai).suriyayat).ai_safe_descriptive_packet;
  const row = object(packet);
  return row.mode === "descriptive_nonpredictive" && row.route_count === 12 && routesAreComplete(row.routes);
}

export function inspectThaiOutputSafety(output: unknown, thaiPacketPresent: boolean) {
  if (!thaiPacketPresent) return { safe: true, violations: [] as Violation[], guard_engine: THAI_CONTRACT_VERSION };
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { safe: false, violations: [{ code: "invalid_output", path: "", snippet: "output is not an object" }], guard_engine: THAI_CONTRACT_VERSION };
  }
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const [path, raw] of textEntries(output)) {
    const text = raw.trim();
    if (!text) continue;
    const thaiContext = (path[0] === "systems" && path[1] === "thai") || THAI_MARKER_RE.test(text);
    const denied = DENIAL_RE.test(text);
    const add = (code: string) => {
      const key = `${code}:${path.join(".")}`;
      if (!seen.has(key)) {
        seen.add(key);
        violations.push({ code, path: path.join("."), snippet: text.replace(/\s+/g, " ").slice(0, 180) });
      }
    };
    if (PERCENT_RE.test(text) || NUMERIC_PROBABILITY_RE.test(text)) add("numeric_probability");
    if (EVENT_ASSERTION_RE.test(text) && !denied) add("deterministic_event");
    if (CERTAINTY_RE.test(text) && EVENT_ASSERTION_RE.test(text) && !denied) add("certainty_event");
    if (thaiContext && (EXACT_DATE_RE.test(text) || EXACT_TIME_RE.test(text))) add("thai_exact_timing");
    if (thaiContext && THAI_SCORE_RE.test(text)) add("thai_score");
    if (thaiContext && GOOD_BAD_RE.test(text)) add("thai_final_good_bad");
  }
  return { safe: violations.length === 0, violations, guard_engine: THAI_CONTRACT_VERSION };
}

export function strictThaiRetryInstruction(violations: Violation[] = []) {
  const codes = [...new Set(violations.map((item) => item.code))].sort();
  return `\n\n[THAI OUTPUT SAFETY RETRY]\n이 재시도에서는 Thai/Lagna/Suriyayat의 promoted descriptive packet을 오직 비예측형 맥락 설명에만 써. 퍼센트·확률·점수로 바꾸지 말고, 연락/재회/합격/수익 등 사건을 단정하지 말고, Lagna/Suriyayat 근거로 정확한 날짜·시각을 만들지 말고, 대길/대흉 같은 최종 길흉판정을 만들지 마. 지킬 수 없으면 systems.thai를 빈 문자열로 둬.${codes.length ? ` 감지된 위반: ${codes.join(", ")}.` : ""}`;
}

function sentenceMustBeRemoved(text: string) {
  return THAI_MARKER_RE.test(text) || PERCENT_RE.test(text) || NUMERIC_PROBABILITY_RE.test(text) ||
    (EVENT_ASSERTION_RE.test(text) && !DENIAL_RE.test(text));
}

export function buildThaiOutputFallback<T>(output: T): T | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const scrub = (value: any, path: string[] = []): any => {
    if (typeof value === "string") {
      if (path[0] === "systems" && path[1] === "thai") return "";
      return value.split(/(?<=[.!?。！？])\s+|\n+/).map((part) => part.trim()).filter((part) => part && !sentenceMustBeRemoved(part)).join(" ");
    }
    if (Array.isArray(value)) return value.map((item, index) => scrub(item, [...path, String(index)]));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item, [...path, key])]));
    return value;
  };
  const cleaned = scrub(structuredClone(output));
  cleaned.systems = object(cleaned.systems);
  cleaned.systems.thai = "";
  cleaned.limits = `${String(cleaned.limits ?? "").trim()} ${THAI_FALLBACK_NOTE}`.trim();
  return cleaned as T;
}

export function addGeminiUsage(...values: any[]) {
  return values.reduce((sum, value) => ({
    prompt_tokens: sum.prompt_tokens + Number(value?.prompt_tokens ?? 0),
    candidate_tokens: sum.candidate_tokens + Number(value?.candidate_tokens ?? 0),
    thought_tokens: sum.thought_tokens + Number(value?.thought_tokens ?? 0),
    total_tokens: sum.total_tokens + Number(value?.total_tokens ?? 0),
  }), { prompt_tokens: 0, candidate_tokens: 0, thought_tokens: 0, total_tokens: 0 });
}

export async function runWithThaiOutputSafety(
  payload: unknown,
  generate: (strictThai: boolean) => Promise<any>,
  validate: (value: any) => any,
) {
  const first = await generate(false);
  if (first.output_guard_failed !== true) return { ...first, attempt_count: 1 };
  const retry = await generate(true);
  const combinedUsage = addGeminiUsage(first.usage, retry.usage);
  if (retry.ok) return {
    ...retry,
    usage: combinedUsage,
    attempt_count: 2,
    thai_safety_retry: true,
    thai_safety_retry_reason: "output_guard",
  };
  const unsafe = retry.unsafe_data ?? first.unsafe_data;
  const fallback = buildThaiOutputFallback(unsafe);
  const validated = fallback ? validate(fallback) : null;
  const fallbackGuard = validated ? inspectThaiOutputSafety(validated, thaiOutputGuardRequired(payload)) : { safe: false };
  if (validated && fallbackGuard.safe) return {
    ok: true,
    data: validated,
    model: retry.model ?? first.model,
    usage: combinedUsage,
    attempt_count: 2,
    thai_safety_retry: true,
    thai_safety_fallback: true,
    thai_safety_retry_error: retry.error,
    thai_safety_guard_violations: retry.guard_violations ?? first.guard_violations,
  };
  return { ...retry, usage: combinedUsage, attempt_count: 2, thai_safety_fallback_failed: true };
}
