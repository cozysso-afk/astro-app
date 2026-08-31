from pathlib import Path
import re

APP=Path('web/src/AppNext.tsx')
CSS=Path('web/src/fortune-ux-v14.css')
EDGE=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
app=APP.read_text(encoding='utf-8')
css=CSS.read_text(encoding='utf-8')
edge=EDGE.read_text(encoding='utf-8')

# Precision copy must not claim birthplace is missing when only birth time is unknown.
app=app.replace(
    '상대 출생시간·정확 장소가 없어 진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층은 추정하지 않았어. 이 상태에서 0은 재회 가능성 0%나 관계 점수 0점을 뜻하지 않아.',
    '상대 출생시간을 몰라 진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층은 추정하지 않았어. 입력한 출생지역은 기록에 보존하지만 시간민감 각도·하우스 계산에는 사용하지 않아. 이 상태에서 0은 재회 가능성 0%나 관계 점수 0점을 뜻하지 않아.'
)
app=app.replace(
    '상대 출생시간/장소가 없어 데이비슨·마크스·3차 진행은 임의 추정하지 않고 제외했어.',
    '상대 출생시간을 몰라 데이비슨·마크스·3차 진행은 임의 추정하지 않고 제외했어.'
)

# iOS native time value needs the same true vertical-centering treatment as date.
marker='/* v17 · iOS native time centering + standalone safe area */'
if marker not in css:
    css += r'''

/* v17 · iOS native time centering + standalone safe area */
.birth-time-field input[type="time"]{
  height:52px!important;
  min-height:52px!important;
  box-sizing:border-box!important;
  padding-top:0!important;
  padding-bottom:0!important;
  line-height:normal!important;
}
.birth-time-field input[type="time"]::-webkit-date-and-time-value{
  display:flex!important;
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
  line-height:normal!important;
}
.birth-time-field input[type="time"]::-webkit-datetime-edit,
.birth-time-field input[type="time"]::-webkit-datetime-edit-fields-wrapper{
  display:flex!important;
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  align-items:center!important;
  justify-content:center!important;
  line-height:normal!important;
}
.birth-time-field input[type="time"]::-webkit-datetime-edit-hour-field,
.birth-time-field input[type="time"]::-webkit-datetime-edit-minute-field,
.birth-time-field input[type="time"]::-webkit-datetime-edit-ampm-field,
.birth-time-field input[type="time"]::-webkit-datetime-edit-text{
  padding-top:0!important;
  padding-bottom:0!important;
  line-height:normal!important;
}
@media (display-mode: standalone) and (max-width:600px){
  .page-content{padding-top:max(58px,calc(env(safe-area-inset-top) + 14px))!important}
}
'''

# Relationship AI: unknown-time readings have fewer legal evidence layers, so validation
# must be evidence-aware. Keep strict validation for exact-time readings, and allow the
# retry to pass a complete but shorter structured answer rather than failing wholesale.
edge=edge.replace('VERSION="relationship-v10.2-purpose-schema"','VERSION="relationship-v10.3-unknown-time-resilient"')
pattern=r'function grounded\(data:any,payload:any,p:Purpose\)\{.*?return true;\}'
replacement='''function grounded(data:any,payload:any,p:Purpose,relaxed=false){
 const all=JSON.stringify(data),src=JSON.stringify(payload);
 const forbidden=["갑기합","을경합","병신합","정임합","무계합","신강","신약","용신","희신","기신","배우자성","합혼점수"];
 for(const word of forbidden)if(all.includes(word)&&!src.includes(word))return false;
 const unknownTime=payload?.precision?.partner_time_exact===false;
 const scale=relaxed?.60:(unknownTime?.72:1);
 const need=(n:number)=>Math.max(40,Math.floor(n*scale));
 if(p==="compatibility"){
   if(String(data.overview??"").length<need(350))return false;
   for(const k of ["chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term"])
     if(String(data[k]??"").length<need(120))return false;
   const scenarioMin=(unknownTime||relaxed)?2:3;
   if((data.felt_scenarios??[]).length<scenarioMin)return false;
 }
 if(p.startsWith("marriage_")){
   const m=data.marriage_reading??{};
   if(String(data.overview??"").length<need(300))return false;
   if(String(m.bottom_line??"").length<need(260))return false;
   for(const k of ["bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution"])
     if(String(m[k]??"").length<need(170))return false;
 }
 if(p==="reunion"&&String(data.reunion_reading?.bottom_line??"").length<need(220))return false;
 return true;
}'''
edge,n=re.subn(pattern,replacement,edge,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'grounded replacement count={n}')
edge=edge.replace('if(!data||!grounded(data,payload,purpose))return {ok:false,error:"관계 해설이 깊이/근거 검증을 통과하지 못했어",model};','if(!data||!grounded(data,payload,purpose,compactMode))return {ok:false,error:"관계 해설이 깊이/근거 검증을 통과하지 못했어",model};')

# Guardrails
for token in [
    'today: 180','week: 370','month: 730','year: 1825',
    '<KoreaBirthplaceSelector value={counterpart}',
    '출생지역은 그대로 기록 가능',
]:
    if token not in app: raise SystemExit(f'missing prior fix: {token}')
for token in [
    'relationship-v10.3-unknown-time-resilient',
    'const unknownTime=payload?.precision?.partner_time_exact===false;',
    'grounded(data,payload,purpose,compactMode)',
]:
    if token not in edge: raise SystemExit(f'missing edge fix: {token}')
for token in [
    '.birth-time-field input[type="time"]::-webkit-date-and-time-value',
    '@media (display-mode: standalone) and (max-width:600px)',
    'padding-top:max(58px,calc(env(safe-area-inset-top) + 14px))',
]:
    if token not in css: raise SystemExit(f'missing css fix: {token}')
if '상대 출생시간·정확 장소가 없어' in app: raise SystemExit('stale precision copy remains')

APP.write_text(app,encoding='utf-8')
CSS.write_text(css,encoding='utf-8')
EDGE.write_text(edge,encoding='utf-8')
