import assert from 'node:assert/strict'
import test from 'node:test'
import {buildSystemFieldSources,validSystemFieldReadings,isDefinitionOnlyReading} from './systemFieldReadings.ts'

const FIELDS=['연애','대인관계','학업','직장','금전','컨디션']
const wheel=[{bhumi_key:'ayu',planet:{label:'금성'}},{bhumi_key:'boriwan',planet:{label:'토성'}},{bhumi_key:'sri',planet:{label:'목성'}},
  {bhumi_key:'utsaha',planet:{label:'달'}},{bhumi_key:'det',planet:{label:'라후'}}]

test('a day reads every field from that day, inside the selected period',()=>{
  const ids=['S:daily:new','S:daily:old','T:taksajorn:1','T:daily:position']
  const packet={period:{start:'2026-11-14',end:'2026-11-14'}}
  const payload={evidence_ledger:ids.map(id=>({id})),saju:{daily:[{date:'2026-11-13',ganzhi:'庚寅',stem_ten_god:'正財(정재)',evidence_id:ids[1]},{date:'2026-11-14',ganzhi:'庚寅',stem_ten_god:'正印(정인)',evidence_id:ids[0]}]},
    thai:{taksajorn:{segments:[{start:'2026-05-01',end:'2027-05-01',evidence_id:ids[2],wheel}]},suriyayat_daily:[{evidence_id:ids[3]}]}}
  const sources=buildSystemFieldSources(payload,packet)
  assert.deepEqual(sources.filter(s=>s.system==='saju').map(s=>s.topic),FIELDS)
  assert.ok(sources.filter(s=>s.system==='saju').every(s=>s.evidence_ref===ids[0]))
  assert.deepEqual(sources.filter(s=>s.system==='thai').map(s=>s.topic).sort(),[...FIELDS].sort())
  // Field-specific Thai places, not one place for every field.
  assert.match(sources.find(s=>s.system==='thai'&&s.topic==='금전').fact,/sri/)
  assert.match(sources.find(s=>s.system==='thai'&&s.topic==='컨디션').fact,/ayu/)
  const valid={system:'saju',topic:'학업',reading:'이날 일진에 정인이 들어와서 배운 내용을 다시 정리하기 좋아. 새 범위보다 어제 본 부분을 한 번 더 풀어 봐.',evidence_refs:[ids[0]]}
  for(const bad of [{...valid,evidence_refs:[ids[1]]},{...valid,system:'thai'},{...valid,topic:'운세'}]){
    assert.deepEqual(validSystemFieldReadings([bad],sources),[])
  }
  assert.deepEqual(validSystemFieldReadings([valid],sources),[valid])
  assert.deepEqual(validSystemFieldReadings([valid,valid],sources),[])
  assert.deepEqual(validSystemFieldReadings([{...valid,reading:'정인은 배움과 이해를 뜻해.'}],sources),[])
  assert.deepEqual(buildSystemFieldSources({saju:null,thai:null,evidence_ledger:[]},packet),[])
})

test('a month or a year is read from its own pillar, never from one day',()=>{
  const ledger=['S:daily:2026-01-08','S:month:1:2026-01-05','S:annual:1:2026-02-04','T:taksajorn:1'].map(id=>({id}))
  const payload={evidence_ledger:ledger,
    saju:{daily:[{date:'2026-01-08',ganzhi:'庚辰',stem_ten_god:'比肩(비견)',evidence_id:'S:daily:2026-01-08'}],
      monthly:[{segment_start:'2026-01-05T10:00:00',segment_end_exclusive:'2026-02-04T04:00:00',ganzhi:'己丑',stem_ten_god:'正印(정인)',evidence_id:'S:month:1:2026-01-05'}],
      annual:[{segment_start:'2026-02-04T04:00:00',segment_end_exclusive:'2027-02-04T10:00:00',ganzhi:'丙午',stem_ten_god:'偏官(편관)',evidence_id:'S:annual:1:2026-02-04'}]},
    thai:{taksajorn:{segments:[{start:'2025-05-01',end:'2026-12-31',evidence_id:'T:taksajorn:1',wheel}]}}}
  const year=buildSystemFieldSources(payload,{period_kind:'annual',period:{start:'2026-01-01',end:'2026-12-31'}}).filter(s=>s.system==='saju')
  assert.ok(year.length===6&&year.every(s=>s.evidence_ref==='S:annual:1:2026-02-04'))
  const month=buildSystemFieldSources(payload,{period_kind:'month',period:{start:'2026-01-01',end:'2026-01-31'}}).filter(s=>s.system==='saju')
  assert.ok(month.length===6&&month.every(s=>s.evidence_ref==='S:month:1:2026-01-05'))
})

test('a definition alone is not a reading',()=>{
  assert.equal(isDefinitionOnlyReading('브리완은 주변을 둘러싼 대인관계와 인연망을 상징해.'),true)
  assert.equal(isDefinitionOnlyReading('편재의 작용은 고정적인 수입 외에 굴리는 재물에 대한 관심을 뜻해.'),true)
  assert.equal(isDefinitionOnlyReading('올해 세운에 편재가 들어와서 월급 밖의 돈에 눈이 가. 작은 부수입 하나를 시험해 보고 큰돈은 묶어 둬.'),false)
})
