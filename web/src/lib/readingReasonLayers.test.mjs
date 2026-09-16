import assert from 'node:assert/strict'
import test from 'node:test'
import { splitReadingReason } from './readingReasonLayers.ts'

test('short reason stays fully visible', () => {
  const text='첫 문장이야. 두 번째 문장이야.'
  assert.deepEqual(splitReadingReason(text), { visible:text })
})

test('long reason keeps two complete sentences visible and preserves the rest', () => {
  const text='첫 번째 근거야. 두 번째 근거야. 세 번째 계산 설명이야. 네 번째 기술 설명이야.'
  assert.deepEqual(splitReadingReason(text), {
    visible:'첫 번째 근거야. 두 번째 근거야.',
    technical:'세 번째 계산 설명이야. 네 번째 기술 설명이야.',
  })
})

test('whitespace is normalized without inventing or dropping sentences', () => {
  const text='첫 문장.   둘째 문장.\n셋째 문장.'
  const layered=splitReadingReason(text)
  assert.equal(layered.visible,'첫 문장. 둘째 문장.')
  assert.equal(layered.technical,'셋째 문장.')
})
