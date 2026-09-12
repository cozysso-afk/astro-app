// Synthetic, internally coherent Whole Sign house fixtures for symbolic diversity QA.
// Not forecasts for real people. Existing personal-love static_structure wire shape.
const exact={time_available:true,time_exact:true,time_source:'official_record',time_confidence:'exact'}
function house(n,sign,ruler,rulerSign,wholeHouse){return {house:n,whole_sign:sign,whole_ruler:ruler,whole_ruler_placement:{planet:ruler,sign:rulerSign,whole_house:wholeHouse}}}
function natal(venus,moon,fifth,seventh,dsc){return {scope:'single_person_natal_only',venus:{sign:venus},moon:{sign:moon},fifth_house:fifth,seventh_house:seventh,dsc,house_angle_layers_enabled:true,time_reliability:{...exact}}}
export const archetypeFixtures=[
 {id:'youthful',label:'경쾌한 연하·슬림',natal:natal('쌍둥이자리','천칭자리',house(5,'쌍둥이자리','Mercury','쌍둥이자리',5),house(7,'사자자리','Sun','처녀자리',8),135)},
 {id:'mature',label:'성숙·절제·골격',natal:natal('염소자리','염소자리',house(5,'염소자리','Saturn','염소자리',5),house(7,'물고기자리','Jupiter','염소자리',5),345)},
 {id:'tall',label:'긴 비율·시원한 존재감',natal:natal('사수자리','양자리',house(5,'사수자리','Jupiter','사수자리',5),house(7,'물병자리','Saturn','사수자리',5),315)},
 {id:'soft',label:'금성·달의 부드러운 인상',natal:natal('게자리','게자리',house(5,'물고기자리','Jupiter','게자리',9),house(7,'황소자리','Venus','게자리',9),45)},
 {id:'sharp',label:'화성·토성의 선명한 인상',natal:natal('전갈자리','양자리',house(5,'전갈자리','Mars','양자리',10),house(7,'염소자리','Saturn','염소자리',7),285)},
]
export const archetypeContext={birthDate:'1991-03-21',asOf:'2026-09-12'}
export const visualSettings={gender:'male',background:'korean',style:'real',frame:'half',scene:'meeting'}
