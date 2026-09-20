from __future__ import annotations

from pathlib import Path

patcher = Path(__file__).with_name("apply_reunion_v28_precision_audit.py")
source = patcher.read_text()

old = "tests += r'''\\n\\ndef test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
new = "tests += '''\n\ndef test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
if source.count(old) != 1:
    raise RuntimeError("v2.8 test append adapter: guarded source shape changed")
source = source.replace(old, new, 1)

anchor = '''tests = TESTS.read_text()
marker = "def test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
'''
injected = '''tests = TESTS.read_text()
tests = replace_once(
    tests,
    "assert hierarchy['version']=='reunion-hierarchy-v2.5-iana-timezone-provenance'",
    "assert hierarchy['version']=='reunion-hierarchy-v2.8-birth-time-precision-audit'",
    "test hierarchy version",
)
marker = "def test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
'''
if source.count(anchor) != 1:
    raise RuntimeError("v2.8 version assertion adapter: guarded source shape changed")
source = source.replace(anchor, injected, 1)

exec(compile(source, str(patcher), "exec"), {"__file__": str(patcher), "__name__": "__main__"})
