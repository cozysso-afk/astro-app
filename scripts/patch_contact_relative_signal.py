from pathlib import Path

# Temporary branch-only helper. Removed before merge.

def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'missing patch target in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'web/src/lib/fortuneEditorialV3.ts',
    '''  if (Math.abs(diff) < 5) {\n    const micro = diff > 0 ? '상대 → 나' : '나 → 상대'\n    return `${micro}가 ${Math.abs(roundedA - roundedB)}점 높지만 판정상 동률권이야. 상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}라 어느 쪽이 실제로 먼저 연락한다고 밀어 읽을 정도는 아니야.`\n  }''',
    '''  if (Math.abs(diff) < 5) {\n    const micro = diff > 0 ? '상대 → 나' : '나 → 상대'\n    const pointGap = Math.round(Math.abs(diff) * 10) / 10\n    return `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 연락 자체의 강도와 별개로 상대 비교에서는 ${micro}가 ${pointGap}점 앞서 근소 우세야. 차이가 작아 실제 선연락 주체를 확정하는 뜻은 아니야.`\n  }''',
)

replace_once(
    'web/src/lib/fortuneUserSummary.ts',
    "  const band = (stat: FortuneStat | null | undefined) => !stat ? '정보 부족' : flowLevel(stat) === 'low' ? '약함' : flowLevel(stat) === 'high' ? '강함' : '보통'",
    "  const band = (stat: FortuneStat | null | undefined) => !stat || !Number.isFinite(stat.average) ? '정보 부족' : displayFlowBand(stat.average, stat.band ?? '보통')",
)

replace_once(
    'web/src/lib/fortuneUserSummary.ts',
    "    summary: '수신은 다른 쪽에서 오는 연락, 발신은 내가 먼저 말을 꺼내는 흐름이야. 특정 상대가 있다는 뜻은 아니며, 공식 발표 여부와도 구분해.',",
    "    summary: '수신은 다른 쪽에서 오는 연락, 발신은 내가 먼저 말을 꺼내는 방향의 차트상 활성도야. 강약은 실제 연락이 오느냐 마느냐의 확률이 아니고, 두 방향의 상대 비교는 별도로 읽어.',",
)

replace_once(
    'web/src/lib/fortuneUserSummary.ts',
    "      : incomingLevel === 'low' ? '먼저 연락이 오길 크게 기대하기보다는, 연락이 와도 내용이 구체적인지를 보는 편이 좋아.'",
    "      : incomingLevel === 'low' ? '수신 활성도는 낮게 잡혀 있지만, 이 값만으로 실제 연락이 없다고 보지는 않아. 연락이 왔다면 내용이 구체적인지와 대화가 이어지는지를 봐.'",
)

replace_once(
    'web/src/lib/fortuneUserSummary.ts',
    "      : outgoingLevel === 'low' ? '먼저 연락을 밀어붙이기보다 꼭 할 말만 짧게 전하고 기다리는 편이 좋아.'",
    "      : outgoingLevel === 'low' ? '발신 적합도는 낮게 잡혀 있어. 먼저 보낼 필요가 있다면 꼭 할 말만 짧게 전하고, 이 값으로 상대의 수신 의향까지 낮다고 보지는 마.'",
)

replace_once(
    'web/src/lib/fortuneUserSummary.ts',
    "      ? (directions.outgoingBand === '강함' ? '먼저 전할 말이 있다면 용건과 질문을 분명히 해봐. 기다리는 연락이라면 수신 흐름을 기준으로 읽어.' : directions.outgoingBand === '약함' ? '답을 재촉하거나 여러 번 보내기보다 필요한 말만 정리해. 기다리는 동안의 무응답을 관계의 최종 결론으로 단정하지는 마.' : '기다리는 연락과 내가 보낼 연락을 나눠 생각해. 먼저 보낼 필요가 있을 때만 짧고 명확하게 전해.')",
    "      ? (/강/.test(directions.outgoingBand ?? '') ? '먼저 전할 말이 있다면 용건과 질문을 분명히 해봐. 기다리는 연락이라면 수신 흐름을 기준으로 읽어.' : /약/.test(directions.outgoingBand ?? '') ? '답을 재촉하거나 여러 번 보내기보다 필요한 말만 정리해. 기다리는 동안의 무응답을 관계의 최종 결론으로 단정하지는 마.' : '기다리는 연락과 내가 보낼 연락을 나눠 생각해. 먼저 보낼 필요가 있을 때만 짧고 명확하게 전해.')",
)

replace_once(
    'web/src/lib/fortuneUserSummary.ts',
    '''export function contactReading(value: FortuneUserRelationship): string {\n  const incoming = value.incomingBand, outgoing = value.outgoingBand\n  const receive = incoming === '강함' ? '연락을 받는 쪽의 신호가 상대적으로 두드러져.' : incoming === '약함' ? '기다리는 연락이 먼저 들어오는 쪽의 신호는 약한 편이야.' : incoming === '보통' ? '연락을 받는 쪽은 뚜렷한 강세나 약세가 없어.' : '먼저 연락이 올 흐름은 독립 계산 정보가 부족해.'\n  const send = outgoing === '강함' ? '내가 먼저 말을 꺼내는 흐름은 비교적 수월하게 잡혀 있어.' : outgoing === '약함' ? '내가 먼저 대화를 밀어붙이는 흐름도 강하지 않아.' : outgoing === '보통' ? '내가 먼저 말을 꺼내는 쪽은 중간 흐름이야.' : '내가 먼저 보내기 좋은지도 계산 정보가 부족해.'\n  const contrast = incoming === '약함' && outgoing === '강함' ? '즉, 내가 연락하기 괜찮다는 말이 상대에게서 연락이 온다는 뜻은 아니야.' : incoming === '강함' && outgoing === '약함' ? '오는 연락을 살피는 흐름과 내가 먼저 재촉하는 흐름이 서로 달라.' : '이 흐름은 특정인의 연락 여부나 속마음을 확정하지 않아.'\n  return `${receive} ${send} ${contrast}`\n}''',
    '''export function contactReading(value: FortuneUserRelationship): string {\n  const incoming = value.incomingBand, outgoing = value.outgoingBand\n  const receive = !incoming || incoming === '정보 부족'\n    ? '상대 → 나 수신 활성도는 독립 계산 정보가 부족해.'\n    : `상대 → 나 수신 활성도는 ${incoming}이야. 이 강약만으로 실제 연락이 오거나 안 온다고 판단하지 않아.`\n  const send = !outgoing || outgoing === '정보 부족'\n    ? '나 → 상대 발신 적합도도 계산 정보가 부족해.'\n    : `나 → 상대 발신 적합도는 ${outgoing}이야. 이 값은 내가 먼저 말을 꺼낼 때의 상대적 적합도이지 상대의 수신 의향은 아니야.`\n  return `${receive} ${send} 두 방향의 점수 차이가 있으면 절대 강도와 별개로 어느 쪽이 상대적으로 앞서는지도 따로 봐.`\n}''',
)

replace_once(
    'web/src/lib/fortuneEditorialV3.test.mjs',
    "  assert.match(result.contact.directionSummary,/판정상 동률권/)\n  assert.match(result.contact.directionSummary,/상대 → 나 43/)\n  assert.match(result.contact.directionSummary,/나 → 상대 45/)",
    "  assert.doesNotMatch(result.contact.directionSummary,/판정상 동률권/)\n  assert.match(result.contact.directionSummary,/연락 자체의 강도와 별개로 상대 비교에서는/)\n  assert.match(result.contact.directionSummary,/나 → 상대.*근소 우세/)\n  assert.match(result.contact.directionSummary,/상대 → 나 43/)\n  assert.match(result.contact.directionSummary,/나 → 상대 45/)",
)

print('contact relative signal patch applied')
