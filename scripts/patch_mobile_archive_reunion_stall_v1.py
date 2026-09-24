from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]

# 1) Backend: expose the already-optimized reunion calculation as one direct request.
backend_path = root / "api" / "relationship_async_v1.py"
backend = backend_path.read_text(encoding="utf-8")
backend = replace_once(
    backend,
    '@app.post("/v1/relationship/western/start")\ndef relationship_western_start(request: RelationshipRequest) -> dict:\n',
    '''@app.post("/v1/relationship/western/direct")
def relationship_western_direct(request: RelationshipRequest) -> dict:
    """Single-request mobile path using the same optimized reunion semantics.

    The async job endpoints remain available as a fallback/diagnostic path, but
    iOS no longer has to keep a timer-driven polling loop alive for a calculation
    that now completes in a few seconds after runtime v2.9 optimization.
    """
    job_id = f"direct-{uuid.uuid4().hex}"
    try:
        return _calculate_reunion(job_id, request)
    finally:
        with _lock:
            _jobs.pop(job_id, None)


@app.post("/v1/relationship/western/start")
def relationship_western_start(request: RelationshipRequest) -> dict:
''',
    "direct reunion endpoint",
)
backend_path.write_text(backend, encoding="utf-8")

# 2) Frontend API transport: prefer one direct response, retain polling fallback.
auth_path = root / "web" / "src" / "lib" / "auth.ts"
auth = auth_path.read_text(encoding="utf-8")
auth = replace_once(
    auth,
    'const AUTH_SESSION_MIN_VALIDITY_MS = 30_000\n',
    'const AUTH_SESSION_MIN_VALIDITY_MS = 30_000\nconst DIRECT_REUNION_TIMEOUT_MS = 30_000\n',
    "direct reunion timeout constant",
)
anchor = 'export async function checkAppAccess(session: Session): Promise<AppAccess> {'
if 'async function runDirectReunionRelationship(' not in auth:
    direct_helper = '''async function runDirectReunionRelationship(
  fetcher: typeof window.fetch,
  base: string,
  init: RequestInit,
  headers: Headers,
): Promise<Response> {
  let timer: number | undefined
  try {
    const response = await Promise.race([
      fetcher(`${base}/v1/relationship/western/direct`, {
        ...init,
        method: 'POST',
        headers,
      }),
      new Promise<Response>((resolve) => {
        timer = window.setTimeout(
          () => resolve(jsonResponse({ detail: '재회운 계산 응답이 30초를 넘겼어. 잠시 후 다시 시도해줘.' }, 504)),
          DIRECT_REUNION_TIMEOUT_MS,
        )
      }),
    ])
    // Keep the proven job path as a deploy-skew fallback only.
    if (response.status === 404 || response.status === 405) {
      return runAsyncReunionRelationship(fetcher, base, init, headers)
    }
    return response
  } finally {
    if (timer !== undefined) window.clearTimeout(timer)
  }
}

'''
    if anchor not in auth:
        raise SystemExit('auth direct helper anchor missing')
    auth = auth.replace(anchor, direct_helper + anchor, 1)
auth = replace_once(
    auth,
    '''    if (reunionRequest && !(input instanceof Request)) {
      return runAsyncReunionRelationship(originalFetch!, base, init ?? {}, headers)
    }
''',
    '''    if (reunionRequest && !(input instanceof Request)) {
      return runDirectReunionRelationship(originalFetch!, base, init ?? {}, headers)
    }
''',
    "direct reunion transport",
)
auth_path.write_text(auth, encoding="utf-8")

# 3) Archive transport: local-first, small cloud pages, bounded Supabase waits.
archive_path = root / "web" / "src" / "lib" / "archive.ts"
archive = archive_path.read_text(encoding="utf-8")
archive = replace_once(
    archive,
    "const CLOUD_PAGE_SIZE = 100\n",
    "const CLOUD_PAGE_SIZE = 10\nconst ARCHIVE_AUTH_TIMEOUT_MS = 4_000\nconst ARCHIVE_QUERY_TIMEOUT_MS = 8_000\n",
    "archive page size",
)
archive = replace_once(
    archive,
    "type SupabaseErrorLike = {\n  code?: unknown\n  message?: unknown\n  details?: unknown\n  hint?: unknown\n}\n",
    """type SupabaseErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

function withArchiveTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs)
    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        globalThis.clearTimeout(timer)
        reject(error)
      },
    )
  })
}
""",
    "archive timeout helper",
)
archive = replace_once(
    archive,
    "}\n\nfunction isQuotaExceeded(error: unknown) {\n",
    """}

export function listLocalArchive(): ArchiveItem[] {
  return loadLocal().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function isQuotaExceeded(error: unknown) {
""",
    "local archive export",
)
archive = replace_once(
    archive,
    """async function ensureArchiveUser() {
  try {
    const session = await ensureSupabaseSession()
""",
    """async function ensureArchiveUser() {
  try {
    const session = await withArchiveTimeout(
      ensureSupabaseSession(),
      ARCHIVE_AUTH_TIMEOUT_MS,
      '클라우드 로그인 세션 확인이 지연되고 있어.',
    )
""",
    "archive auth timeout",
)
archive = replace_once(
    archive,
    "    let page = await fetchPage()\n",
    "    let page = await withArchiveTimeout(fetchPage(), ARCHIVE_QUERY_TIMEOUT_MS, `${table} 기록 조회 시간이 길어지고 있어.`)\n",
    "archive first page timeout",
)
archive = replace_once(
    archive,
    "      if (session.user.id === userId) page = await fetchPage()\n",
    "      if (session.user.id === userId) page = await withArchiveTimeout(fetchPage(), ARCHIVE_QUERY_TIMEOUT_MS, `${table} 기록 재조회 시간이 길어지고 있어.`)\n",
    "archive retry timeout",
)
archive = replace_once(
    archive,
    """  let syncError: string | undefined
  for (const item of local.filter((row) => !row.cloudId)) {
    try {
      await uploadLocalItem(item, auth.userId)
    } catch (error) {
      syncError = error instanceof Error ? error.message : '일부 기록 동기화에 실패했어.'
      continue
    }
  }
  local = loadLocal()

  try {
""",
    """  const pendingUploads = local.filter((row) => !row.cloudId)
  if (pendingUploads.length) {
    void Promise.allSettled(pendingUploads.map((item) => withArchiveTimeout(
      uploadLocalItem(item, auth.userId!),
      ARCHIVE_QUERY_TIMEOUT_MS,
      '로컬 기록의 클라우드 동기화가 지연되고 있어.',
    )))
  }

  try {
""",
    "archive background sync",
)
archive = replace_once(
    archive,
    """    const cloud = await fetchCloudItems(auth.userId)
    const merged = new Map<string, ArchiveItem>()
""",
    """    const cloud = await withArchiveTimeout(
      fetchCloudItems(auth.userId),
      ARCHIVE_QUERY_TIMEOUT_MS * 2,
      '클라우드 기록 전체 조회가 지연되고 있어. 이 기기 기록을 먼저 보여줄게.',
    )
    local = loadLocal()
    const merged = new Map<string, ArchiveItem>()
""",
    "archive cloud aggregate timeout",
)
archive = replace_once(
    archive,
    """    const warnings = [
      syncError,
      ...cloud.warnings,
""",
    """    const warnings = [
      ...cloud.warnings,
""",
    "archive warning cleanup",
)
archive_path.write_text(archive, encoding="utf-8")

# 4) Archive UI: render local cache before waiting on cloud.
app_path = root / "web" / "src" / "AppNext.tsx"
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    "import { deleteArchive, importArchiveItems, listArchive, saveArchive, type ArchiveItem, type ArchiveSaveResult } from './lib/archive'\n",
    "import { deleteArchive, importArchiveItems, listArchive, listLocalArchive, saveArchive, type ArchiveItem, type ArchiveSaveResult } from './lib/archive'\n",
    "AppNext local archive import",
)
app = replace_once(
    app,
    """  async function refreshArchive() {
    setArchiveLoading(true)
    setArchiveError('')
    try {
      const data = await listArchive()
""",
    """  async function refreshArchive() {
    setArchiveLoading(true)
    setArchiveError('')
    const localItems = listLocalArchive()
    const initialPendingDeleteId = archiveUndoItemRef.current?.id
    const visibleLocal = initialPendingDeleteId ? localItems.filter((item) => item.id !== initialPendingDeleteId) : localItems
    setArchiveItems(visibleLocal)
    setArchiveStatus(visibleLocal.length ? `이 기기 기록 ${visibleLocal.length}개 표시 · 클라우드 확인 중` : '클라우드 기록 확인 중')
    try {
      const data = await listArchive()
""",
    "AppNext local-first archive refresh",
)
app_path.write_text(app, encoding="utf-8")

print('mobile archive/reunion stall patch applied')
