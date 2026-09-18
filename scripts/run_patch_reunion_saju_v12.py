from pathlib import Path

source_path = Path('scripts/patch_reunion_saju_v12.py')
text = source_path.read_text(encoding='utf-8')

# Remove the accidental smart-quote/no-op block before compiling the one-shot patcher.
start = text.find('old="    conclusion: `이번 흐름은 다시 연락이 닿는 계기')
if start >= 0:
    marker = 'old2="    conclusion: `이번 흐름은 다시 연락이 닿는 계기'
    end = text.find(marker, start)
    if end < 0:
        raise SystemExit('could not locate valid reunion conclusion patch after accidental block')
    text = text[:start] + text[end:]

# The generated node test must contain real line breaks, not a raw literal \n stream.
text = text.replace("Path('web/src/lib/reunionSajuExperienceV12.test.mjs').write_text(r'''", "Path('web/src/lib/reunionSajuExperienceV12.test.mjs').write_text('''")

ns = {'__name__': '__main__', '__file__': str(source_path)}
exec(compile(text, str(source_path), 'exec'), ns, ns)

# Defensive cleanup in case the source string still emitted escaped newlines.
test_path = Path('web/src/lib/reunionSajuExperienceV12.test.mjs')
if test_path.exists():
    generated = test_path.read_text(encoding='utf-8')
    if '\\n' in generated and generated.count('\n') <= 2:
        test_path.write_text(generated.replace('\\n', '\n'), encoding='utf-8')
