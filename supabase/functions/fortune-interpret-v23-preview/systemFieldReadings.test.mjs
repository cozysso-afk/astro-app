import assert from 'node:assert/strict'
import test from 'node:test'
import {buildSystemFieldSources,validSystemFieldReadings} from './systemFieldReadings.ts'
test('each independently authored field cites an applicable fact within the selected period',()=>{
  const ids=['S:daily:new','S:daily:old','T:taksajorn:1','T:daily:position']
  const packet={period:{start:'2026-11-14',end:'2026-11-14'}}
  const payload={evidence_ledger:ids.map(id=>({id})),saju:{daily:[{date:'2026-11-13',ganzhi:'庚寅',stem_ten_god:'正財(정재)',evidence_id:ids[1]},{date:'2026-11-14',ganzhi:'庚寅',stem_ten_god:'正印(정인)',evidence_id:ids[0]}]},
    thai:{taksajorn:{segments:[{start:'2026-05-01',end:'2027-05-01',evidence_id:ids[2],wheel:[{bhumi_key:'ayu',planet:{label:'금성'}}]}]},suriyayat_daily:[{evidence_id:ids[3]}]}}
  const sources=buildSystemFieldSources(payload,packet)
  assert.deepEqual(sources.map(s=>s.topic),['학업','연애','컨디션'])
  const valid={system:'saju',topic:'학업',reading:'정인 맥락에서는 배운 내용을 다시 이해하는 과정에 주목해.',evidence_refs:[ids[0]]}
  for(const bad of [{...valid,evidence_refs:[ids[1]]},{...valid,system:'thai'},{...valid,topic:'금전'}]){
    assert.deepEqual(validSystemFieldReadings([bad],sources),[])
  }
  assert.deepEqual(validSystemFieldReadings([valid],sources),[valid])
  assert.deepEqual(validSystemFieldReadings([valid,valid],sources),[])
  assert.deepEqual(buildSystemFieldSources({saju:null,thai:null,evidence_ledger:[]},packet),[])
})
