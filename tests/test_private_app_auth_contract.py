from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_web_auth_does_not_create_new_anonymous_users():
    supabase_source = (ROOT / "web/src/lib/supabase.ts").read_text(encoding="utf-8")
    gate_source = (ROOT / "web/src/AuthGate.tsx").read_text(encoding="utf-8")
    assert "signInAnonymously" not in supabase_source
    assert "shouldCreateUser: false" in supabase_source
    assert "requestEmailMagicLink" in supabase_source
    assert "verifyOtp({" not in supabase_source
    assert "linkAnonymousSessionToEmail" in supabase_source
    assert "isPermanentEmailSession" in supabase_source
    assert "countCurrentCloudRecords" in supabase_source
    assert "rememberPendingAnonymousLink" in supabase_source
    assert "window.localStorage.setItem" in supabase_source
    assert "readPendingAnonymousLink" in gate_source
    assert "nextSession.user.id !== pending.userId" in gate_source
    assert "authenticatedEmail !== pending.email" in gate_source
    assert "cloudRecordCount > 0" in gate_source
    assert "6자리 인증 코드" not in gate_source
    assert "onAuthStateChange" not in gate_source


def test_private_api_wrapper_guards_every_v1_route_and_fails_closed():
    source = (ROOT / "api/private_app.py").read_text(encoding="utf-8")
    assert 'path.startswith("/v1/")' in source
    assert "status_code=401" in source
    assert "status_code=403" in source
    assert "status_code=503" in source
    assert '@app.get("/v1/auth/me")' in source
    assert "/rest/v1/app_access" in source
    assert "select=email,role,user_id" in source
    assert "bound_user_id != user_id" in source
    assert 'os.getenv("SUPABASE_URL", "")' in source
    assert 'os.getenv("SUPABASE_PUBLISHABLE_KEY", "")' in source


def test_private_api_hides_fastapi_schema_routes():
    source = (ROOT / "api/private_app.py").read_text(encoding="utf-8")
    assert '"/openapi.json"' in source
    assert '"/docs"' in source
    assert '"/redoc"' in source
    assert "status_code=404" in source


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


def test_bound_user_migration_preserves_archive_identity_and_tightens_ai_guard():
    sql = (ROOT / "supabase/migrations/20260906_private_app_access_user_binding.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "add column if not exists user_id uuid references auth.users(id)" in lowered
    assert "user_id = auth.uid()" in lowered
    assert "a.user_id is null or a.user_id = new.user_id" in lowered
    assert "revoke execute on function public.enforce_private_app_ai_job_access() from anon, authenticated" in lowered


def test_transition_guard_allows_only_the_prebound_anonymous_owner():
    sql = (ROOT / "supabase/migrations/20260906_private_app_bound_anonymous_owner_transition.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "if user_is_anonymous then" in lowered
    assert "a.role = 'owner'" in lowered
    assert "a.user_id = new.user_id" in lowered
    assert "raise insufficient_privilege" in lowered
    assert "return new" in lowered
    assert "revoke execute on function public.enforce_private_app_ai_job_access() from anon, authenticated" in lowered


def test_owner_email_is_not_committed_to_source():
    migration_paths = [
        ROOT / "supabase/migrations/20260905_private_app_access.sql",
        ROOT / "supabase/migrations/20260905_private_app_paid_ai_guard.sql",
        ROOT / "supabase/migrations/20260906_private_app_paid_ai_guard_acl.sql",
        ROOT / "supabase/migrations/20260906_private_app_access_user_binding.sql",
        ROOT / "supabase/migrations/20260906_private_app_bound_anonymous_owner_transition.sql",
    ]
    combined = "\n".join(path.read_text(encoding="utf-8") for path in migration_paths).lower()
    assert "owner@example.com" in combined
    assert "@gmail.com" not in combined
    assert "@naver.com" not in combined
    assert "@icloud.com" not in combined


def run_contract() -> None:
    tests = [
        test_web_auth_does_not_create_new_anonymous_users,
        test_private_api_wrapper_guards_every_v1_route_and_fails_closed,
        test_private_api_hides_fastapi_schema_routes,
        test_access_allowlist_is_rls_protected_without_enabling_paid_guard_too_early,
        test_paid_ai_guard_requires_seeded_owner_and_blocks_unapproved_job_inserts,
        test_bound_user_migration_preserves_archive_identity_and_tightens_ai_guard,
        test_transition_guard_allows_only_the_prebound_anonymous_owner,
        test_owner_email_is_not_committed_to_source,
    ]
    for test in tests:
        test()
    print("private app auth server/db contract: ok")


if __name__ == "__main__":
    run_contract()
