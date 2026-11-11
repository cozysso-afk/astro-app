import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fortuneFixture} from './readingExperience.fixtures.mjs'

test('the local daily reader works without a manuscript and limits situational answers to the available indicators',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}})
  try {
    const {CalculatedDailyReading}=await server.ssrLoadModule('/src/CalculatedDailyReading.tsx')
    const {fortuneGroup}=await server.ssrLoadModule('/src/lib/fortuneFields.ts')
    const {calculation}=fortuneFixture('today')
    const date=calculation.period.start
    calculation.period={start:date,end:date,day_count:1}
    calculation.western.relationship_signals['과거인연접점']={average:39,band:'약함'}
    const show=(c,field)=>renderToStaticMarkup(createElement(CalculatedDailyReading,{calculation:c,field}))
    const love=show(calculation,fortuneGroup('애정'))
    assert.match(love,/계산값으로 읽는 일간 애정운/)
    for(const label of ['솔로 · 새 인연','짝사랑','썸','애매한 관계','연애 중','재회']) assert.ok(love.includes('<summary>'+label+'</summary>'),label)
    assert.match(love,/39점/)
    delete calculation.western.relationship_signals['과거인연접점']
    const general=show(calculation,fortuneGroup('애정'))
    assert.match(general,/<summary>재회<\/summary>/)
    assert.match(general,/이날의 재회 지표/)
    assert.doesNotMatch(general,/재접촉 계산값으로 본 재회/)
    delete calculation.western.overall['재회']
    assert.doesNotMatch(show(calculation,fortuneGroup('애정')),/<summary>재회<\/summary>/)
    assert.doesNotMatch(show(calculation,fortuneGroup('학업')),/내 상황에 맞춰 보기/)
    assert.equal(show({...calculation,period:{...calculation.period,day_count:7}}),'')
  } finally {await server.close()}
})
