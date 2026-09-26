from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_background_resumable_reunion_transport_contract():
    backend = (ROOT / 'api/relationship_async_v1.py').read_text(encoding='utf-8')
    auth = (ROOT / 'web/src/lib/auth.ts').read_text(encoding='utf-8')

    # Keep the direct route only for compatibility/diagnostics; the mobile client must use jobs.
    assert '@app.post("/v1/relationship/western/direct")' in backend
    assert '@app.post("/v1/relationship/western/start")' in backend
    assert '@app.get("/v1/relationship/western/jobs/{job_id}")' in backend
    assert 'return runAsyncReunionRelationship(fetcher, PRIVATE_API_BASE, init, headers)' in auth
    assert 'return runAsyncReunionRelationship(originalFetch!, base, init ?? {}, headers)' in auth
    assert '/v1/relationship/western/direct' not in auth
    assert 'DIRECT_REUNION_TIMEOUT_MS' not in auth
    assert 'REUNION_PENDING_STORAGE_PREFIX' in auth
    assert 'window.localStorage.setItem' in auth
    assert 'readPendingReunionJob(body)' in auth
    assert 'pollReunionJob' in auth


def test_archive_local_first_and_bounded_cloud_contract():
    archive = (ROOT / 'web/src/lib/archive.ts').read_text(encoding='utf-8')
    app = (ROOT / 'web/src/AppNext.tsx').read_text(encoding='utf-8')

    assert 'const CLOUD_PAGE_SIZE = 10' in archive
    assert 'ARCHIVE_AUTH_TIMEOUT_MS = 4_000' in archive
    assert 'ARCHIVE_QUERY_TIMEOUT_MS = 8_000' in archive
    assert 'export function listLocalArchive()' in archive
    assert 'withArchiveTimeout(fetchPage()' in archive
    assert 'void Promise.allSettled' in archive
    assert 'listLocalArchive' in app
    assert '이 기기 기록 ${visibleLocal.length}개 표시 · 클라우드 확인 중' in app