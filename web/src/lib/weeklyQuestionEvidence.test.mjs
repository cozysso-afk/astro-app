import test from 'node:test'
import assert from 'node:assert/strict'
import {weeklyQuestionSections} from './weeklyQuestionEvidence.ts'
const period={start:'2026-11-09',end:'2026-11-15',day_count:7}
const item=(id,state='insufficient')=>({id:'question:'+id,state,label:id,blocks:[]})
const doc={date:'2026-11-09 → 2026-11-15',state:'ready',sections:[item('연애:timing'),item('연락:activation_direction'),item('재회:contact_meeting'),item('시험:performance_error'),item('학업:timing','ready')]}
const calc={period,western:{overall:{연애:{best_days:[{date:'2026-11-08',score:99}],caution_days:[]}},
  daily_scores:[{date:'2026-11-10',scores:{연애:62}},{date:'2026-11-14',scores:{연애:39}}],
  relationship_signals:{수신신호:{average:33,band:'약함'},발신적합:{average:50,band:'보통'},과거인연접점:{average:31,band:'약함'}}}}
test('only directly supported parts receive calculated explanations',()=>{
 const rows=weeklyQuestionSections(doc,calc)
 assert.match(rows[0].blocks[0].text,/11월 10일에 62점, 11월 14일에 39점/)
 assert.doesNotMatch(rows[0].blocks[0].text,/99점/)
 assert.match(rows[1].blocks[0].text,/내가 말을 꺼낼 조건이 더/)
 assert.match(rows[2].blocks[0].text,/31점/)
 assert.equal(rows[3],doc.sections[3])
 assert.equal(rows[4],doc.sections[4])
 assert.equal(doc.sections[0].state,'insufficient')
})
test('wrong week, unverified archive and missing signals make no partial claim',()=>{
 assert.equal(weeklyQuestionSections({...doc,date:'other'},calc),doc.sections)
 assert.equal(weeklyQuestionSections({...doc,state:'unverified'},calc),doc.sections)
 const blank=weeklyQuestionSections(doc,{period,western:{}})
 assert.deepEqual(blank,doc.sections)
})
