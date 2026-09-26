from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_archive_index_contract():
    source = (ROOT / 'web/src/lib/archive.ts').read_text(encoding='utf-8')
    assert "from('archive_index_v1')" in source
    assert 'export async function hydrateArchiveItem' in source
    assert 'getAuthorizedSessionSnapshot' in source
    assert 'hydrated: false' in source
    assert 'cloudSource: source' in source


def test_reunion_direct_authorized_contract():
    auth = (ROOT / 'web/src/lib/auth.ts').read_text(encoding='utf-8')
    app = (ROOT / 'web/src/AppNext.tsx').read_text(encoding='utf-8')
    assert 'export async function fetchAuthorizedReunionRelationship' in auth
    assert 'const session = authorizedApiSession' in auth
    assert "supabase.auth.onAuthStateChange" in auth
    assert 'fetchAuthorizedReunionRelationship(relationshipInit)' in app
    assert 'hydrateArchiveItem(item)' in app


def test_archive_index_migration_security():
    migration = (ROOT / 'supabase/migrations/20260924_archive_index_v1.sql').read_text(encoding='utf-8')
    assert 'security_invoker = true' in migration
    assert "calculation_json->>'archive_v' = '1'" in migration
    assert 'grant select on public.archive_index_v1 to authenticated' in migration
