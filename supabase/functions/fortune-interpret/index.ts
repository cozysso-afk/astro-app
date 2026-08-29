import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODELS: Record<string, string> = {
  "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
  "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
};
const DEFAULT_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";
const INTERPRETER_VERSION = "supabase-ai-v3-evidence-first";
const TOPICS = ["금전", "학업", "시험", "직장", "이직", "연애", "재회", "소식", "컨디션", "투자심리", "수익실현", "신규진입", "투자주의"];
const REL_SIGNALS = ["수신신호", "발신적합", "과거인연접점"];
const INTRO_END = new Date("2026-12-31T23:59:59Z");
const USD_KRW = 1384;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function cleanText(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}

function compactStat(stat: any) {
  if (!stat || typeof stat !== "object") return null;
  const points = (key: string) => Array.isArray(stat[key])
    ? stat[key].slice(0, 4).map((x: any) => ({ date: x?.date, label: x?.label, score: x?.score }))
    : [];
  return {
    average: stat.average,
    band: stat.band,
    spread: stat.spread,
    best_days: points("best_days"),
    caution_days: points("caution_days"),
  };
}

function compactCalculation(calculation: any) {
  const western = calculation?.western ?? {};
  const overall: Record<string, unknown> = {};
  for (const topic of TOPICS) {
    const stat = compactStat(western?.overall?.[topic]);
    if (stat) overall[topic] = stat;
  }
  const relationshipSignals: Record<string, unknown> = {};
  for (const key of REL_SIGNALS) {
    const stat = compactStat(western?.relationship_signals?.[key]);
    if (stat) relationshipSignals[key] = stat;
  }

  const interestingDates = new Set<string>();
  for (const stat of Object.values(overall) as any[]) {
    for (const row of [...(stat?.best_days ?? []), ...(stat?.caution_days ?? [])]) {
      if (row?.date) interestingDates.add(String(row.date));
    }
  }
  const rawDetails = Array.isArray(western?.detail_days) ? western.detail_days : [];
  let selectedDetails = rawDetails.filter((row: any) => interestingDates.has(String(row?.date)));
  if (!selectedDetails.length && rawDetails.length) selectedDetails = rawDetails.slice(0, 2);
  selectedDetails = selectedDetails.slice(0, 20).map((row: any) => {
    const topics: Record<string, unknown> = {};
    for (const topic of TOPICS) {
      const item = row?.topics?.[topic];
      if (!item) continue;
      topics[topic] = {
        best_window: item.best_window ?? null,
        caution_window: item.caution_window ?? null,
        evidence: Array.isArray(item.evidence) ? item.evidence.slice(0, 6) : [],
      };
    }
    return { date: row?.date, market_open: Boolean(row?.market_open), topics };
  });

  const saju = calculation?.saju ?? {};
  const thai = calculation?.thai ?? {};
  return {
    api_version: calculation?.api_version,
    engine: calculation?.engine,
    period: calculation?.period,
    western: {
      engine: western?.engine,
      ephemeris: western?.ephemeris,
      score_policy: western?.score_policy,
      method: western?.method,
      overall,
      relationship_signals: relationshipSignals,
      market: western?.market ?? null,
      detail_days: selectedDetails,
    },
    saju: {
      engine: saju?.engine,
      pillars: saju?.pillars ?? null,
      day_master: saju?.day_master ?? null,
      elements: saju?.elements ?? null,
      true_solar: saju?.true_solar ?? null,
      dayun: Array.isArray(saju?.dayun) ? saju.dayun : [],
      annual: Array.isArray(saju?.annual) ? saju.annual : [],
      monthly: Array.isArray(saju?.monthly) ? saju.monthly : [],
      not_calculated: Array.isArray(saju?.not_calculated) ? saju.not_calculated : [],
    },
    thai: {
      engine: thai?.engine,
      thai_day: thai?.thai_day,
      ruler: thai?.ruler,
      rule: thai?.rule,
      predictive_status: thai?.predictive_status,
      consensus_policy: thai?.consensus_policy,
    },
  };
}

const SYSTEM_PROMPT = `너는 '별빛의 운명' 앱의 점성술 해설자다.
입력은 이미 계산 엔진이 만든 Western(서양점성술), 사주, Thai(태국점성술) 결과다. 너는 계산자가 아니라 해설자다.
반드시 CALCULATED_DATA 안에 실제로 존재하는 값만 근거로 사용한다. 없는 행성 위치, 애스펙트, 하우스, 특정 시각, 사건, 확률을 만들지 마라.
Western 점수는 사건 확률이 아니라 같은 분야 안에서 비교하는 상대 활성도다. 확률처럼 말하지 마라.
사주의 not_calculated 항목은 임의 추정하지 마라. Thai predictive_status가 미구현이면 출생요일 baseline만 설명하고 날짜별 합의에 섞지 마라.
연애·연락·재회는 특정 상대의 속마음이나 미래 행동을 단정하지 마라. 금전·투자는 수익률이나 가격 방향을 보장하지 마라.
detail_days에 시간창과 evidence가 있으면 적극 사용해 왜/언제를 설명하고, 시간 근거가 없으면 특정 시각을 만들지 마라.
직장과 이직, 학업과 시험, 금전과 소식을 반드시 구분한다.
연락은 generic '연락운' 하나로 쓰지 마라. relationship_signals의 수신신호(상대→나), 발신적합(나→상대), 과거인연접점(재활성)을 세 방향으로 반드시 분리한다. 세 값은 실제 연락 확률이 아니다.
투자심리·수익실현·신규진입·투자주의는 역할이 다르다. 투자심리는 판단의 열기/과열, 수익실현은 기존 포지션 정리 적합도, 신규진입은 새 진입 적합도, 투자주의는 높을수록 위험 경계가 큰 지수로 해석한다. 네 문단을 같은 말로 반복하지 마라.
market_open, has_open_session, true/false, JSON 키 이름 같은 내부 구현값을 사용자 문장에 절대 노출하지 마라. 필요하면 'KRX 거래일', '휴장일', '거래일 포함 여부'처럼 자연어로 번역한다.
단순 점수 낭독을 금지한다. 각 분야는 계산 근거와 실제 체감 의미를 연결하되 뻔한 조언을 반복하지 마라.
한국어 반말로 자연스럽고 읽기 쉽게 쓴다. 희망고문과 공포 조장을 피한다. 출력은 JSON만 반환한다.`;

const OUTPUT_SHAPE = {
  headline: "기간 핵심 제목",
  overall: {
    summary: "전체 흐름 5~8문장",
    dominant_pattern: "서로 충돌하거나 같이 움직이는 핵심 축 3~5문장",
    best_phase: "상대적으로 활용할 날짜/시간 구간과 이유",
    caution_phase: "상대적으로 보수적으로 볼 날짜/시간 구간과 이유",
  },
  clusters: {
    relationship: "연애·재회 전체 맥락. 연락 방향은 contact_flow에서 따로 쓸 것",
    work_study: "학업·시험·직장·이직 교차 해석",
    money_news: "금전·소식 교차 해석",
    investment: "주식 4축 전체 비교 요약. 각 축 상세는 investment_reading에서 분리",
    condition: "컨디션과 일정 배치 해석",
  },
  contact_flow: {
    incoming: "수신신호 근거, 강한 날짜/시간, 약한 구간. 상대가 실제 연락한다고 단정 금지",
    outgoing: "발신적합 근거, 내가 먼저 움직이기 상대적으로 좋은/나쁜 시기",
    reconnection: "과거인연접점의 강약과 시기. 재회 확률로 표현 금지",
  },
  investment_reading: {
    psychology: "투자심리: 판단 열기·과열·흔들림",
    realization: "수익실현: 보유분 정리/실현 적합도",
    entry: "신규진입: 새 포지션 진입 적합도",
    risk: "투자주의: 높을수록 경계가 큰 위험 지수",
  },
  systems: {
    western: "Western 계산 핵심",
    saju: "사주 계산 범위 핵심",
    thai: "Thai baseline 의미와 한계",
  },
  priorities: ["현실 행동 1", "현실 행동 2", "현실 행동 3"],
  topic_analysis: Object.fromEntries(TOPICS.map((topic) => [topic, {
    verdict: "이 분야 결론",
    reason: "계산 근거를 연결한 이유",
    timing: "근거가 있는 날짜/시간 흐름",
    action: "현실 행동",
    avoid: "피할 행동",
    confidence: "높음|보통|낮음",
    confidence_reason: "확신도 이유",
  }])),
  limits: "단정할 수 없는 부분과 데이터 한계",
};

function validateOutput(obj: any) {
  if (!obj || typeof obj !== "object") return null;
  const overall = obj.overall && typeof obj.overall === "object" ? obj.overall : {};
  const clusters = obj.clusters && typeof obj.clusters === "object" ? obj.clusters : {};
  const systems = obj.systems && typeof obj.systems === "object" ? obj.systems : {};
  const analyses = obj.topic_analysis && typeof obj.topic_analysis === "object" ? obj.topic_analysis : {};
  const out: any = {
    headline: cleanText(obj.headline, 180),
    overall: {
      summary: cleanText(overall.summary, 2200),
      dominant_pattern: cleanText(overall.dominant_pattern, 1200),
      best_phase: cleanText(overall.best_phase, 1400),
      caution_phase: cleanText(overall.caution_phase, 1400),
    },
    clusters: {
      relationship: cleanText(clusters.relationship, 1500),
      work_study: cleanText(clusters.work_study, 1600),
      money_news: cleanText(clusters.money_news, 1400),
      investment: cleanText(clusters.investment, 1600),
      condition: cleanText(clusters.condition, 1200),
    },
    contact_flow: {
      incoming: cleanText(obj?.contact_flow?.incoming, 1500),
      outgoing: cleanText(obj?.contact_flow?.outgoing, 1500),
      reconnection: cleanText(obj?.contact_flow?.reconnection, 1500),
    },
    investment_reading: {
      psychology: cleanText(obj?.investment_reading?.psychology, 1400),
      realization: cleanText(obj?.investment_reading?.realization, 1400),
      entry: cleanText(obj?.investment_reading?.entry, 1400),
      risk: cleanText(obj?.investment_reading?.risk, 1400),
    },
    systems: {
      western: cleanText(systems.western, 1800),
      saju: cleanText(systems.saju, 1800),
      thai: cleanText(systems.thai, 1400),
    },
    priorities: Array.isArray(obj.priorities)
      ? obj.priorities.slice(0, 3).map((x: unknown) => cleanText(x, 420)).filter(Boolean)
      : [],
    topic_analysis: {},
    limits: cleanText(obj.limits, 1400),
  };
  for (const topic of TOPICS) {
    const item = analyses[topic];
    if (!item || typeof item !== "object") continue;
    const confidenceRaw = cleanText(item.confidence, 20);
    out.topic_analysis[topic] = {
      verdict: cleanText(item.verdict, 800),
      reason: cleanText(item.reason, 2200),
      timing: cleanText(item.timing, 1300),
      action: cleanText(item.action, 800),
      avoid: cleanText(item.avoid, 800),
      confidence: ["높음", "보통", "낮음"].includes(confidenceRaw) ? confidenceRaw : "보통",
      confidence_reason: cleanText(item.confidence_reason, 900),
    };
  }
  if (!out.overall.summary && !Object.keys(out.topic_analysis).length) return null;
  return out;
}

function usageSummary(raw: any) {
  const usage = raw?.usageMetadata ?? {};
  const prompt = Number(usage.promptTokenCount ?? 0);
  const candidate = Number(usage.candidatesTokenCount ?? 0);
  const thought = Number(usage.thoughtsTokenCount ?? 0);
  const total = Number(usage.totalTokenCount ?? 0);
  const billableOutput = candidate + thought;
  const intro = new Date() <= INTRO_END;
  const inputPerM = intro ? 0.75 : 1.50;
  const outputPerM = intro ? 3.75 : 7.50;
  const usd = (prompt / 1_000_000) * inputPerM + (billableOutput / 1_000_000) * outputPerM;
  return {
    prompt_tokens: prompt,
    candidate_tokens: candidate,
    thought_tokens: thought,
    billable_output_tokens: billableOutput,
    total_tokens: total,
    estimated_usd: Number(usd.toFixed(6)),
    estimated_krw: Number((usd * USD_KRW).toFixed(1)),
    price_phase: intro ? "intro_2026" : "standard",
  };
}

async function callGemini(
  payload: any,
  model: string,
  apiKey: string,
  timeoutMs: number,
  thinkingLevel: "high" | "medium",
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const prompt = `아래 통합 계산 결과를 종합 해석해. 제공된 분야를 빠짐없이 채우고 계산값을 확률로 바꾸지 마.\n\nOUTPUT_SHAPE:\n${JSON.stringify(OUTPUT_SHAPE)}\n\nCALCULATED_DATA:\n${JSON.stringify(payload)}`;
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8200,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel },
          },
        }),
      },
    );
    const rawText = await upstream.text();
    if (!upstream.ok) {
      return { ok: false, error: `Gemini HTTP ${upstream.status} · ${rawText.slice(0, 700)}`, model, status: upstream.status };
    }
    const raw = JSON.parse(rawText);
    const parts = raw?.candidates?.[0]?.content?.parts ?? [];
    let text = parts.filter((p: any) => !p?.thought).map((p: any) => p?.text ?? "").join("").trim();
    if (!text) text = parts.map((p: any) => p?.text ?? "").join("").trim();
    if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);
    const data = validateOutput(parsed);
    if (!data) return { ok: false, error: "AI 해설 응답 구조를 검증하지 못했어.", model };
    return {
      ok: true,
      data,
      model,
      interpreter_version: INTERPRETER_VERSION,
      usage: usageSummary(raw),
    };
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? `Gemini ${model} 해설이 제한시간을 넘겼어.`
      : `Gemini 호출 실패: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, error: message, model };
  } finally {
    clearTimeout(timer);
  }
}

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
const SUPABASE_ANON_KEY = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function currentUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

async function calculateWithFallback(compact: any, preferred: string, apiKey: string) {
  const primary = await callGemini(
    compact,
    preferred,
    apiKey,
    preferred === DEFAULT_MODEL ? 85_000 : 120_000,
    preferred === DEFAULT_MODEL ? "high" : "medium",
  );
  if (primary.ok) return primary;
  if (preferred === DEFAULT_MODEL) {
    const fallback = await callGemini(compact, FALLBACK_MODEL, apiKey, 55_000, "medium");
    if (fallback.ok) return { ...fallback, fallback_from: preferred };
    return {
      ok: false,
      error: `${primary.error} / 자동대체도 실패: ${fallback.error}`,
      model: preferred,
    };
  }
  return primary;
}

async function runJob(jobId: string, compact: any, preferred: string, apiKey: string) {
  const admin = adminClient();
  await admin.from("ai_interpret_jobs").update({
    status: "running",
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
  try {
    const result: any = await calculateWithFallback(compact, preferred, apiKey);
    if (result.ok) {
      await admin.from("ai_interpret_jobs").update({
        status: "done",
        model: result.model ?? preferred,
        fallback_from: result.fallback_from ?? null,
        result_json: result.data ?? null,
        usage_json: result.usage ?? null,
        error: null,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    } else {
      await admin.from("ai_interpret_jobs").update({
        status: "failed",
        model: result.model ?? preferred,
        error: result.error ?? "AI 해설 실패",
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }
  } catch (error) {
    await admin.from("ai_interpret_jobs").update({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return response({ ok: false, error: "POST만 지원해." }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return response({ ok: false, error: "JSON 요청이 필요해." }, 400);
  }

  const apiKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
  if (body?.action === "meta") {
    return response({
      configured: Boolean(apiKey),
      interpreter_version: INTERPRETER_VERSION,
      default_model: DEFAULT_MODEL,
      models: MODELS,
      runtime: "supabase-edge",
      background_jobs: true,
    });
  }
  if (!apiKey) {
    return response({
      ok: false,
      missing_key: true,
      error: "Supabase Edge Function에 GEMINI_API_KEY가 설정되지 않았어.",
    }, 503);
  }

  const user = await currentUser(req);
  if (!user) return response({ ok: false, error: "인증 세션이 필요해." }, 401);

  if (body?.action === "status") {
    const jobId = cleanText(body?.job_id, 80);
    if (!jobId) return response({ ok: false, error: "job_id가 필요해." }, 400);
    const { data, error } = await adminClient()
      .from("ai_interpret_jobs")
      .select("id,status,model,fallback_from,result_json,usage_json,error,created_at,updated_at,completed_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return response({ ok: false, error: `job 조회 실패: ${error.message}` }, 500);
    if (!data) return response({ ok: false, error: "job을 찾지 못했어." }, 404);
    return response({
      ok: true,
      job_id: data.id,
      status: data.status,
      model: data.model,
      fallback_from: data.fallback_from,
      data: data.result_json,
      usage: data.usage_json,
      error: data.error,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
    });
  }

  if (!body?.calculation || typeof body.calculation !== "object") {
    return response({ ok: false, error: "calculation이 필요해." }, 400);
  }
  const preferred = MODELS[body.model] ? body.model : DEFAULT_MODEL;
  const compact = compactCalculation(body.calculation);

  if (body?.action === "start") {
    const admin = adminClient();
    const { data, error } = await admin.from("ai_interpret_jobs").insert({
      user_id: user.id,
      kind: "fortune",
      status: "queued",
      model: preferred,
    }).select("id").single();
    if (error || !data?.id) {
      return response({ ok: false, error: `job 생성 실패: ${error?.message ?? "unknown"}` }, 500);
    }
    const task = runJob(data.id, compact, preferred, apiKey);
    (globalThis as any).EdgeRuntime?.waitUntil?.(task);
    return response({
      ok: true,
      job_id: data.id,
      status: "queued",
      interpreter_version: INTERPRETER_VERSION,
    }, 202);
  }

  const direct: any = await calculateWithFallback(compact, preferred, apiKey);
  return response(direct, direct.ok ? 200 : 502);
});
