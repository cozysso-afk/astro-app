from pathlib import Path

patcher = Path(__file__).with_name('apply_reunion_v23_patch.py')
source = patcher.read_text(encoding='utf-8')
needle = "for e in row['fast_evidence'])\n\"\"\",\n    \"\"\"        if row['selection_eligible']:"
replacement = "for e in row['fast_evidence'])\"\"\",\n    \"\"\"        if row['selection_eligible']:"
if source.count(needle) != 1:
    raise RuntimeError(f'EOF guard adapter expected one match, found {source.count(needle)}')
source = source.replace(needle, replacement, 1)
exec(compile(source, str(patcher), 'exec'), {'__name__': '__main__'})
