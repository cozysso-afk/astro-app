import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";
const USD_KRW = 1384;
const INTRO_END = new Date("2026-12-31T23:59:59Z");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type Purpose = "compatibility" | "reunion" | "marriage_unmarried" | "marriage_married";
const TIME_SENSITIVE = new Set(["Moon", "ASC", "DSC", "MC", "IC"]);

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
function clean(v: unknown, max: number) { return String(v ?? "").trim().slice(0, max); }
function compactAspect(a: any) {
  if (!a || typeof a !== "object") return null;
  const orb = Number(a.orb ?? 99);
  if (!Number.isFinite(orb)) return null;
  return { a: String(a.a ?? ""), aspect: String(a.aspect ?? ""), b: String(a.b ?? ""), orb, tone: a.tone ?? "mixed", layer: a.layer ?? null };
}
function byOrb(a: any, b: any) { return Number(a?.orb ?? 99) - Number(b?.orb ?? 99); }
function hasAny(a: any, names: string[]) { return names.includes(a?.a) || names.includes(a?.b); }
function compactStat(s: any) {
  if (!s || typeof s !== "object") return null;
  return {
    average: Number(s.average ?? 0), band: s.band ?? "", spread: Number(s.spread ?? 0),
    best_days: Array.isArray(s.best_days) ? s.best_days.slice(0, 6) : [],
    caution_days: Array.isArray(s.caution_days) ? s.caution_days.slice(0, 6) : [],
  };
}
function compactReunionContext(ctx: any) {
  if (!ctx || typeof ctx !== "object") return null;
  return {
    period: ctx.period ?? null,
    incoming: compactStat(ctx.incoming), outgoing: compactStat(ctx.outgoing), reconnection: compactStat(ctx.reconnection),
    months: Array.isArray(ctx.months) ? ctx.months.slice(0, 18).map((m: any) => ({
      calendar_month: m?.calendar_month, start: m?.start, end: m?.end,
      incoming: compactStat(m?.incoming), outgoing: compactStat(m?.outgoing), reconnection: compactStat(m?.reconnection),
    })) : [],
  };
}
function compactRelationship(calculation: any) {
  const result = calculation?.result ?? {};
  const natal = result?.natal_synastry ?? {};
  const partnerExact = Boolean(natal?.partner_time_exact);
  const raw = (Array.isArray(natal?.aspects) ? natal.aspects : []).map(compactAspect).filter(Boolean).sort(byOrb);
  const usable = partnerExact ? raw : raw.filter((a: any) => !TIME_SENSITIVE.has(a.a) && !TIME_SENSITIVE.has(a.b));
  const removed = raw.length - usable.length;
  const months = Array.isArray(result?.months) ? result.months : [];
  return {
    api_version: calculation?.api_version,
    engine: calculation?.engine,
    relationship_status: calculation?.relationship_status,
    period: calculation?.period,
    limitations: Array.isArray(result?.limitations) ? result.limitations : [],
    precision: { partner_time_exact: partnerExact, time_sensitive_aspects_removed: removed },
    natal_synastry: {
      available: Boolean(natal?.available), partner_time_exact: partnerExact, note: natal?.note ?? "",
      aspects: usable.slice(0, 36),
    },
    evidence: {
      strongest: usable.slice(0, 12),
      supportive: usable.filter((a: any) => a.tone === "supportive").slice(0, 10),
      challenging: usable.filter((a: any) => a.tone === "challenging").slice(0, 10),
      communication: usable.filter((a: any) => hasAny(a, ["Mercury"])).slice(0, 10),
      chemistry: usable.filter((a: any) => hasAny(a, ["Venus", "Mars", "Pluto"])).slice(0, 10),
      emotional: usable.filter((a: any) => hasAny(a, ["Moon", "Venus", "Sun", "Neptune"])).slice(0, 10),
      power_boundaries: usable.filter((a: any) => hasAny(a, ["Saturn", "Mars", "Pluto", "Uranus"])).slice(0, 10),
      long_term: usable.filter((a: any) => hasAny(a, ["Saturn", "Jupiter", "Sun", "Venus", "True Node"])).slice(0, 10),
    },
    davison: { available: Boolean(result?.davison?.available), reason: result?.davison?.reason ?? "" },
    marks: { available: Boolean(result?.marks?.available), reason: result?.marks?.reason ?? "" },
    months: months.slice(0, 24).map((m: any) => ({
      calendar_month: m?.calendar_month, representative_date: m?.representative_date,
      signal_summary: {
        exact_contacts: Number(m?.signal_summary?.exact_contacts ?? 0),
        supportive_contacts: Number(m?.signal_summary?.supportive_contacts ?? 0),
        challenging_contacts: Number(m?.signal_summary?.challenging_contacts ?? 0),
        tightest: (Array.isArray(m?.signal_summary?.tightest) ? m.signal_summary.tightest : []).map(compactAspect).filter(Boolean).sort(byOrb).slice(0, 8),
      },
    })),
  };
}

const SYSTEM = `너는 '별빛의 운명'의 관계점성술 해설 엔진이다. 사용자가 긴 프롬프트를 직접 쓰지 않아도 계산 자료를 정확히 읽게 만드는 역할이다.

절대 규칙:
1) CALCULATED_RELATIONSHIP과 REUNION_TIMING_CONTEXT 안에 실제로 존재하는 값만 쓴다. 없는 애스펙트, 날짜, 하우스, 사건, 상대 속마음, 연락 의도, 결혼 결심을 만들지 마라.
2) 좋은 말만 하려고 균형을 인위적으로 맞추지 마라. 조화보다 긴장이 강하면 그렇게 말하고, 반대면 반대로 말한다. 단, 공포를 부풀리지도 마라.
3) 숫자·접점 개수를 결론처럼 반복하지 말고, 그 계산이 실제 관계에서 어떤 장면으로 체감되기 쉬운지 번역한다.
4) 각 핵심 문단은 가능하면 1~2개의 실제 애스펙트 또는 실제 기간값을 근거로 삼는다. 근거가 부족하면 '이 데이터만으로는 강하게 말하기 어렵다'고 쓴다.
5) raw JSON 키, true/false, market_open 같은 구현 변수, 영어 내부 필드명을 사용자 문장에 노출하지 마라.
6) '대화해라/배려해라/5분 쉬어라' 같은 일반 조언은 금지한다. 행동 조언이 필요하면 반드시 계산 근거와 연결한다.
7) 사용자의 과거 대화, 희망사항, 이전 상담내용을 아는 척하지 마라. 이 요청에 전달된 계산 자료만 본다.
8) 상대 출생시간이 정확하지 않은 경우, 입력 단계에서 Moon/ASC/DSC/MC/IC 같은 시간 민감 애스펙트가 제거되어 있다. 제거된 요소를 다시 추측하지 마라. 데이비슨/마크스/정밀 진행층도 사용 가능하다고 표시된 경우에만 쓴다.
9) 점성술 해석을 과학적 확률이나 사건 보장처럼 표현하지 않는다. 시기 점수도 실제 연락 확률 %가 아니다.

compatibility:
- 먼저 이 관계의 핵심을 직설적으로 요약한다.
- 끌림/신체적 자극, 정서적 친화와 거리감, 대화와 오해, 갈등 트리거, 통제·경계·힘의 균형, 장기 지속성과 반복 패턴을 따로 읽는다.
- '좋은 궁합/나쁜 궁합' 한 줄 판정 대신, 잘 맞는 축과 소모되는 축을 동시에 분리한다.
- felt_scenarios에는 사용자가 실제 관계에서 '아 이거' 하고 알아볼 법한 구체적 장면 3개를 짧게 쓴다. 없는 사건을 예언하지 말고 패턴을 예시화한다.

reunion:
- 일반 궁합보다 시기 분석이 우선이다.
- incoming은 상대가 먼저 연락한다는 보장이 아니라 내 쪽으로 소식이 들어오는 상대 활성도, outgoing은 내가 먼저 움직일 때의 적합도, reconnection은 과거 인연 재활성 신호다. 셋을 절대 섞지 마라.
- 강한 날짜/월, 두 번째 후보, 약한 구간을 실제 수치와 함께 비교한다.

marriage_unmarried:
- 결혼한다/안 한다를 예언하지 않는다.
- 결혼생활로 들어갔을 때의 결속, 정서적 집, 생활·돈·역할, 갈등 후 회복, 책임과 장기 지속성, 결혼 결정을 서두르면 안 되는 구조를 읽는다.

marriage_married:
- 이미 결혼한 관계로 읽는다. 결혼 가능성 표현은 금지한다.
- 현재 결속, 정서적 거리, 역할분담, 생활 리듬, 반복 갈등, 회복력, 시기별 긴장/완화 흐름을 읽는다.

문체:
- 한국어 반말. 차분하지만 단정적이고 군더더기 없이 쓴다.
- 전문용어는 '수성-화성 스퀘어(말과 반응이 충돌하는 각)'처럼 바로 뜻을 붙인다.
- 긴 벽글 대신 각 필드를 3~5문장 안팎으로 밀도 있게 쓴다.
- 출력은 JSON만 반환한다.`;

const SHAPE = {
  headline: "이 관계의 핵심 한 줄",
  overview: "전체 판단 5~7문장. 좋은 점과 어려운 점을 숨기지 말 것",
  chemistry: "끌림·호감·신체적 자극과 속도",
  emotional_dynamic: "정서적 친화·거리감·안전감. 데이터 부족 시 한계 명시",
  communication: "말의 방식·오해·논쟁·사과/수습 패턴",
  conflict_pattern: "갈등 트리거와 반복되는 충돌 장면",
  power_boundaries: "힘겨루기·통제·경계·자율성",
  long_term: "장기 지속성·책임·관계가 버티는 방식",
  timing: "정밀 시기층이 있을 때만 강/약 구간. 없으면 이유",
  reunion_context: "재회 모드일 때만 과거 인연 맥락, 아니면 빈 문자열",
  felt_scenarios: ["체감 장면 1", "체감 장면 2", "체감 장면 3"],
  reunion_reading: {
    bottom_line: "재회운 핵심 결론",
    incoming_contact: "수신 흐름과 강/약 시기",
    outgoing_contact: "발신 적합도와 강/약 시기",
    reconnection_windows: "재접점 강한 날짜/월 순위와 이유",
    low_windows: "약한 구간",
    relationship_filter: "정적 시너스트리가 재접점에 미치는 영향",
    precision_note: "정밀도 한계"
  },
  marriage_reading: {
    mode: "미혼 또는 기혼",
    bottom_line: "결혼운 핵심 결론",
    bond: "결속력·장기 지속성",
    emotional_home: "정서적 집과 안정감",
    daily_life: "생활·돈·역할·책임",
    conflict_repair: "갈등과 회복",
    commitment_or_current_cycle: "미혼이면 결혼 결정 흐름, 기혼이면 현재 결혼생활 주기",
    timing: "시기 활성 구간 또는 데이터 한계",
    caution: "장기적으로 특히 조심할 구조",
    precision_note: "출생시간에 따른 정밀도"
  },
  top_aspects: [{ label: "실제 애스펙트", meaning: "왜 핵심 근거인지" }],
  limits: "이번 해석에서 확실히 말할 수 없는 것"
};

function validate(o: any, partnerExact: boolean, reunionContext: any, purpose: Purpose) {
  if (!o || typeof o !== "object") return null;
  const rr = o?.reunion_reading ?? {};
  const mr = o?.marriage_reading ?? {};
  const out = {
    headline: clean(o.headline, 220), overview: clean(o.overview, 3200), chemistry: clean(o.chemistry, 1900),
    emotional_dynamic: clean(o.emotional_dynamic, 1900), communication: clean(o.communication, 1900),
    conflict_pattern: clean(o.conflict_pattern, 1900), power_boundaries: clean(o.power_boundaries, 1900),
    long_term: clean(o.long_term, 2000), timing: clean(o.timing, 1800), reunion_context: clean(o.reunion_context, 1500),
    felt_scenarios: Array.isArray(o.felt_scenarios) ? o.felt_scenarios.slice(0, 3).map((x: any) => clean(x, 500)).filter(Boolean) : [],
    reunion_reading: {
      bottom_line: clean(rr.bottom_line, 1800), incoming_contact: clean(rr.incoming_contact, 1800), outgoing_contact: clean(rr.outgoing_contact, 1800),
      reconnection_windows: clean(rr.reconnection_windows, 2100), low_windows: clean(rr.low_windows, 1500), relationship_filter: clean(rr.relationship_filter, 1800), precision_note: clean(rr.precision_note, 1100),
    },
    marriage_reading: {
      mode: clean(mr.mode, 80), bottom_line: clean(mr.bottom_line, 2000), bond: clean(mr.bond, 1800), emotional_home: clean(mr.emotional_home, 1800),
      daily_life: clean(mr.daily_life, 1800), conflict_repair: clean(mr.conflict_repair, 1800), commitment_or_current_cycle: clean(mr.commitment_or_current_cycle, 2000),
      timing: clean(mr.timing, 1800), caution: clean(mr.caution, 1600), precision_note: clean(mr.precision_note, 1100),
    },
    top_aspects: Array.isArray(o.top_aspects) ? o.top_aspects.slice(0, 8).map((x: any) => ({ label: clean(x?.label, 220), meaning: clean(x?.meaning, 900) })).filter((x: any) => x.label || x.meaning) : [],
    limits: clean(o.limits, 1600),
  };
  if (!out.headline || !out.overview) return null;
  if (purpose === "reunion" && reunionContext && !out.reunion_reading.bottom_line) return null;
  if (purpose.startsWith("marriage_") && !out.marriage_reading.bottom_line) return null;
  if (!partnerExact) {
    const note = "상대 출생시간이 정확하지 않아 달·ASC/DSC·MC/IC 같은 시간 민감 접점은 해설 근거에서 제거했고, 데이비슨·마크스·일부 정밀 진행층도 임의 추정하지 않았어.";
    if (!out.limits.includes("상대 출생시간")) out.limits = `${out.limits} ${note}`.trim();
    if (!out.reunion_reading.precision_note) out.reunion_reading.precision_note = note;
    if (!out.marriage_reading.precision_note) out.marriage_reading.precision_note = note;
  }
  return out;
}

function usage(raw: any) {
  const u = raw?.usageMetadata ?? {};
  const prompt = Number(u.promptTokenCount ?? 0), candidate = Number(u.candidatesTokenCount ?? 0), thought = Number(u.thoughtsTokenCount ?? 0), total = Number(u.totalTokenCount ?? 0);
  const intro = new Date() <= INTRO_END;
  const usd = (prompt / 1e6) * (intro ? 0.75 : 1.50) + ((candidate + thought) / 1e6) * (intro ? 3.75 : 7.50);
  return { prompt_tokens: prompt, candidate_tokens: candidate, thought_tokens: thought, total_tokens: total, estimated_usd: Number(usd.toFixed(6)), estimated_krw: Number((usd * USD_KRW).toFixed(1)) };
}

async function callGemini(relationship: any, reunionContext: any, purpose: Purpose, model: string, key: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const prompt = `분석 목적: ${purpose}\n선택 기간: ${JSON.stringify(relationship?.period ?? null)}\nOUTPUT_SHAPE:\n${JSON.stringify(SHAPE)}\nCALCULATED_RELATIONSHIP:\n${JSON.stringify(relationship)}\nREUNION_TIMING_CONTEXT:\n${JSON.stringify(reunionContext)}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 9000, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: model === DEFAULT_MODEL ? "high" : "medium" } },
      }),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: `Gemini HTTP ${response.status} · ${text.slice(0, 500)}` };
    const raw = JSON.parse(text);
    const parts = raw?.candidates?.[0]?.content?.parts ?? [];
    let body = parts.filter((p: any) => !p?.thought).map((p: any) => p?.text ?? "").join("").trim();
    if (!body) body = parts.map((p: any) => p?.text ?? "").join("").trim();
    if (body.startsWith("```")) body = body.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const data = validate(JSON.parse(body), Boolean(relationship?.natal_synastry?.partner_time_exact), reunionContext, purpose);
    if (!data) return { ok: false, error: "Gemini JSON validation failed" };
    return { ok: true, data, usage: usage(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respond({ ok: false, error: "POST required" }, 405);
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) return respond({ ok: false, missing_key: true, error: "GEMINI_API_KEY missing" }, 503);
  let body: any;
  try { body = await req.json(); } catch { return respond({ ok: false, error: "invalid JSON" }, 400); }
  if (!body?.calculation) return respond({ ok: false, error: "calculation required" }, 422);

  const allowed: Purpose[] = ["compatibility", "reunion", "marriage_unmarried", "marriage_married"];
  const purpose: Purpose = allowed.includes(body?.purpose) ? body.purpose : "compatibility";
  const relationship = compactRelationship(body.calculation);
  const reunionContext = compactReunionContext(body?.reunion_context);
  let model = String(body?.model ?? DEFAULT_MODEL);
  if (![DEFAULT_MODEL, FALLBACK_MODEL].includes(model)) model = DEFAULT_MODEL;
  let output = await callGemini(relationship, reunionContext, purpose, model, key, 95_000);
  let fallback_from: string | undefined;
  if (!output.ok && model === DEFAULT_MODEL) {
    fallback_from = model; model = FALLBACK_MODEL;
    output = await callGemini(relationship, reunionContext, purpose, model, key, 65_000);
  }
  if (!output.ok) return respond({ ok: false, error: output.error, model, fallback_from }, 502);
  return respond({ ok: true, model, fallback_from, interpreter_version: "relationship-ai-v7-evidence-first-preview", usage: output.usage, data: output.data });
});
