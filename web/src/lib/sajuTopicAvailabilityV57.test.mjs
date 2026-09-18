import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('./systemReading.ts', import.meta.url), 'utf8')

test('Saju life-topic tabs are views over the same calculated ten-god evidence', () => {
  assert.match(source, /const ALL_TEN_GOD_KEYS = Object\.keys\(TEN_GOD_LENSES\)/)
  assert.match(source, /SAJU_LIFE_KEYS:[\s\S]*전체:ALL_TEN_GOD_KEYS[\s\S]*애정:ALL_TEN_GOD_KEYS[\s\S]*대인:ALL_TEN_GOD_KEYS[\s\S]*학업:ALL_TEN_GOD_KEYS[\s\S]*직업:ALL_TEN_GOD_KEYS[\s\S]*금전:ALL_TEN_GOD_KEYS[\s\S]*컨디션:ALL_TEN_GOD_KEYS/)
  assert.doesNotMatch(source, /컨디션:\s*\[\s*\]/)
})

test('Saju topic translation has dedicated condition and daily-life wording', () => {
  assert.match(source, /컨디션:\s*\{[\s\S]*회복과 받아들이는 시간[\s\S]*일정 부담과 긴장[\s\S]*생활 자원과 체력 배분[\s\S]*활동량과 표현[\s\S]*내 페이스 유지/)
  assert.match(source, /질병이나 건강 상태를 진단하는 자료는 아니야/)
  assert.match(source, /export function lensForTopic\(lens: Lens, topic: LifeTopic\)/)
  assert.match(source, /TOPIC_TEN_GOD_COPY\[topic\]\?\.\[lens\.key\]/)
})
