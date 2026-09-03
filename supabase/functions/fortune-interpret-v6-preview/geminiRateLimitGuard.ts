const GUARD_KEY = "__lunea_gemini_rate_guard_v1__";
const MIN_START_GAP_MS = 1400;
const SAME_MODEL_RETRY_FLOOR_MS = 1800;
const SAME_MODEL_RETRY_CAP_MS = 6500;
const EMERGENCY_MODEL = "gemini-3.5-flash";

type GuardGlobal = typeof globalThis & {
  [GUARD_KEY]?: boolean;
  __luneaGeminiNextStartAt?: number;
};

function sleep(ms: number, signal?: AbortSignal | null) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isGeminiGenerateContent(input: RequestInfo | URL) {
  const url = requestUrl(input);
  return url.includes("generativelanguage.googleapis.com") && url.includes(":generateContent");
}

function modelFromUrl(url: string) {
  return decodeURIComponent(url.match(/\/models\/([^/:]+):generateContent/)?.[1] ?? "");
}

function withModel(input: RequestInfo | URL, model: string): RequestInfo | URL {
  const rewrite = (url: string) => url.replace(/\/models\/[^/:]+:generateContent/, `/models/${encodeURIComponent(model)}:generateContent`);
  if (typeof input === "string") return rewrite(input);
  if (input instanceof URL) return new URL(rewrite(input.toString()));
  return new Request(rewrite(input.url), input);
}

async function retryDelayMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  try {
    const text = await response.clone().text();
    const match = text.match(/"retryDelay"\s*:\s*"([0-9.]+)s"/);
    if (match) return Number(match[1]) * 1000;
  } catch {
    // The caller still owns the original response body.
  }
  return SAME_MODEL_RETRY_FLOOR_MS;
}

async function waitForStart(signal?: AbortSignal | null) {
  const g = globalThis as GuardGlobal;
  const now = Date.now();
  const startAt = Math.max(now, Number(g.__luneaGeminiNextStartAt ?? 0));
  g.__luneaGeminiNextStartAt = startAt + MIN_START_GAP_MS;
  await sleep(startAt - now, signal);
}

export function installGeminiRateLimitGuard() {
  const g = globalThis as GuardGlobal;
  if (g[GUARD_KEY]) return;
  g[GUARD_KEY] = true;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isGeminiGenerateContent(input)) return originalFetch(input, init);

    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const send = async (target: RequestInfo | URL) => {
      await waitForStart(signal);
      return originalFetch(target, init);
    };

    let response = await send(input);
    if (response.status !== 429) return response;

    const requestedModel = modelFromUrl(requestUrl(input));
    const advised = await retryDelayMs(response);
    const sameModelWait = Math.max(SAME_MODEL_RETRY_FLOOR_MS, Math.min(advised, SAME_MODEL_RETRY_CAP_MS));
    await sleep(sameModelWait, signal);

    response = await send(input);
    if (response.status !== 429) return response;

    if (requestedModel && requestedModel !== EMERGENCY_MODEL) {
      await sleep(MIN_START_GAP_MS, signal);
      const fallbackInput = withModel(input, EMERGENCY_MODEL);
      const fallback = await send(fallbackInput);
      if (fallback.status !== 429) {
        console.warn(`[gemini-rate-guard] ${requestedModel} quota-limited; recovered with ${EMERGENCY_MODEL}`);
      }
      return fallback;
    }

    return response;
  }) as typeof fetch;
}

installGeminiRateLimitGuard();
