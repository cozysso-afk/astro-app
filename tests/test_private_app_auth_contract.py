from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_web_auth_does_not_create_new_anonymous_users():
    supabase_source = (ROOT / "web/src/lib/supabase.ts").read_text(encoding="utf-8")
    gate_source = (ROOT / "web/src/AuthGate.tsx").read_text(encoding="utf-8")
    assert "signInAnonymously" not in supabase_source
    assert "shouldCreateUser: false" in supabase_source
    assert "linkAnonymousSessionToEmail" in supabase_source
    assert "isPermanentEmailSession" in supabase_source
    assert "countCurrentCloudRecords" in supabase_source
    assert "pendingAnonymousUserId" in gate_source
    assert "nextSession.user.id !== pendingAnonymousUserId" in gate_source
    assert "cloudRecordCount > 0" in gate_source


def test_private_api_wrapper_guards_every_v1_route_and_fails_closed():
    source = (ROOT / "api/private_app.py").read_text(encoding="utf-8")
    assert 'request.url.path.startswith("/v1/")' in source
    assert "status_code=401" in source
    assert "status_code=403" in source
    assert "status_code=503" in source
    assert '@app.get("/v1/auth/me")' in source
    assert "/rest/v1/app_access" in source


def test_access_allowlist_is_rls_protected_without_enabling_paid_guard_too_early():
    sql = (ROOT / "supabase/migrations/20260905_private_app_access.sql").read_text(encoding="utf-8")
    assert "alter table public.app_access enable row level security" in sql.lower()
    assert "auth.jwt() ->> 'email'" in sql
    assert "is_anonymous" in sql
    assert "before insert on public.ai_interpret_jobs" not in sql.lower()


def test_paid_ai_guard_requires_seeded_owner_and_blocks_unapproved_job_inserts():
    sql = (ROOT / "supabase/migrations/20260905_private_app_paid_ai_guard.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "role = 'owner'" in lowered
    assert "private app owner must be seeded" in lowered
    assert "before insert on public.ai_interpret_jobs" in lowered
    assert "enforce_private_app_ai_job_access" in sql
    assert "raise insufficient_privilege" in lowered
    assert "is_anonymous" in sql


def test_owner_email_is_not_committed_to_source():
    access_sql = (ROOT / "supabase/migrations/20260905_private_app_access.sql").read_text(encoding="utf-8")
    paid_guard_sql = (ROOT / "supabase/migrations/20260905_private_app_paid_ai_guard.sql").read_text(encoding="utf-8")
    combined = f"{access_sql}\n{paid_guard_sql}".lower()
    assert "owner@example.com" in combined
    assert "@gmail.com" not in combined
    assert "@naver.com" not in combined
    assert "@icloud.com" not in combined
