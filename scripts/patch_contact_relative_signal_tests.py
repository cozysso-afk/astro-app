from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'missing target in {path}: {old!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'web/src/lib/systemReading.test.mjs',
    " assert.match(contact.conclusion,/받는|들어오는/)\n assert.match(contact.conclusion,/먼저 말을 꺼내/)\n assert.match(contact.conclusion,/온다는 뜻은 아니야/)",
    " assert.match(contact.conclusion,/수신 활성도/)\n assert.match(contact.conclusion,/실제 연락이 오거나 안 온다고 판단하지 않아/)\n assert.match(contact.conclusion,/먼저 말을 꺼내/)\n assert.match(contact.conclusion,/수신 의향은 아니야/)",
)

replace_once(
    'web/src/lib/interpretationUiContract.test.mjs',
    "  assert.match(summary.relationship.incoming,/먼저 연락이 오길 크게 기대하기보다는/)\n  assert.match(summary.relationship.outgoing,/내가 먼저 가볍게 말을 꺼내보기 좋은/)",
    "  assert.match(summary.relationship.incoming,/이 값만으로 실제 연락이 없다고 보지는 않아/)\n  assert.doesNotMatch(summary.relationship.incoming,/먼저 연락이 오길 크게 기대하기보다는/)\n  assert.match(summary.relationship.outgoing,/내가 먼저 가볍게 말을 꺼내보기 좋은/)",
)

print('contact regression expectations updated')
