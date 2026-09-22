from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor missing in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    "reunion_secondary_support:base.reunion_secondary_support,reunion_timing_windows:base.reunion_timing_windows",
    "reunion_secondary_support:base.reunion_secondary_support,reunion_evidence_contract:base.reunion_evidence_contract,reunion_timing_windows:base.reunion_timing_windows",
)

replace_once(
    "web/src/lib/relationshipEvidencePipeline.test.mjs",
    "for (const field of ['composite','progressed_synastry','progressed_composite','marks_tertiary','timing_timezone_policy']) {",
    "for (const field of ['composite','progressed_synastry','progressed_composite','marks_tertiary','timing_timezone_policy','reunion_evidence_contract']) {",
)
replace_once(
    "web/src/lib/relationshipEvidencePipeline.test.mjs",
    "assert.match(edge, /reunion_timing_windows:base\\.reunion_timing_windows/)",
    "assert.match(edge, /reunion_evidence_contract:base\\.reunion_evidence_contract/)\n  assert.match(edge, /reunion_timing_windows:base\\.reunion_timing_windows/)",
)

print("internal reunion evidence contract threaded")
