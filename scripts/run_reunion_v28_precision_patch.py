from __future__ import annotations

from pathlib import Path

patcher = Path(__file__).with_name("apply_reunion_v28_precision_audit.py")
source = patcher.read_text()
old = "tests += r'''\\n\\ndef test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
new = "tests += '''\n\ndef test_medium_precision_audit_flags_provisional_dependency_without_reweighting():"
if source.count(old) != 1:
    raise RuntimeError("v2.8 test append adapter: guarded source shape changed")
source = source.replace(old, new, 1)
exec(compile(source, str(patcher), "exec"), {"__file__": str(patcher), "__name__": "__main__"})
