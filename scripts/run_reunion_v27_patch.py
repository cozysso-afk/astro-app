from __future__ import annotations

from pathlib import Path

patcher = Path(__file__).with_name("apply_reunion_v27_patch.py")
source = patcher.read_text()
old = '''    count = text.count(old)\n    if count != 1:\n        raise RuntimeError(f"{label}: expected exactly one match, found {count}")\n    path.write_text(text.replace(old, new, 1))\n'''
new = '''    count = text.count(old)\n    expected = 2 if label == "solar event local date" else 1\n    if count != expected:\n        raise RuntimeError(f"{label}: expected exactly {expected} match(es), found {count}")\n    path.write_text(text.replace(old, new, 1))\n'''
if source.count(old) != 1:
    raise RuntimeError("replace_once adapter: guarded source shape changed")
source = source.replace(old, new, 1)
exec(compile(source, str(patcher), "exec"), {"__file__": str(patcher), "__name__": "__main__"})
