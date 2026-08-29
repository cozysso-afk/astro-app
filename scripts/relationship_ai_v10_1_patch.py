from pathlib import Path
p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
t=p.read_text(encoding='utf-8')
t=t.replace('VERSION="relationship-v10-compat-marriage-depth"','VERSION="relationship-v10.1-grounded-depth"')
needle='''- 서양점성술과 사주는 독립 근거로 읽고, 둘이 같은 주제를 가리킬 때만 '교차해서 보면'이라고 종합한다.\n- 일반론 조언 금지. 실제 접점과 연결된 반복 장면·관계 역학을 설명한다.'''
replacement='''- 서양점성술과 사주는 독립 근거로 읽고, 둘이 같은 주제를 가리킬 때만 '교차해서 보면'이라고 종합한다.\n- 사주는 CALCULATED_DATA.saju_relationship에 실제로 들어온 원주·day_master_relation(일간 상호관계·십성)·spouse_palace(일지·배우자궁 합충해파)·cross_branch_links(교차 지지관계)만 사용한다. 데이터에 없는 天干合(천간합: 갑기합·을경합·병신합·정임합·무계합), 신강·신약, 용신·희신·기신, 배우자성, 합혼점수, 도화/홍염은 절대 만들지 않는다.\n- 일반론 조언 금지. 실제 접점과 연결된 반복 장면·관계 역학을 설명한다.'''
if needle not in t: raise SystemExit('system marker missing')
t=t.replace(needle,replacement,1)
t=t.replace('''marriage_unmarried:\n- 결혼 성사 여부를 점치지 말고, 이 관계가 결혼생활로 들어갔을 때 결속/정서적 집/생활·돈·역할/갈등회복/결정 시기/장기 리스크를 접점 근거로 깊게 읽는다.''','''marriage_unmarried:\n- 결혼 성사 여부를 점치지 말고, 이 관계가 결혼생활로 들어갔을 때 결속/정서적 집/생활·돈·역할/갈등회복/결정 시기/장기 리스크를 접점 근거로 깊게 읽는다.\n- marriage_reading의 bottom_line/bond/emotional_home/daily_life/conflict_repair/commitment_or_current_cycle/timing/caution을 각각 최소 4문장 수준으로 충분히 쓴다.''')
marker='''async function generate(payload:any,purpose:Purpose,model:string,key:string,compactMode=false){'''
grounded='''function grounded(data:any,payload:any,p:Purpose){const all=JSON.stringify(data);const src=JSON.stringify(payload);const forbidden=["갑기합","을경합","병신합","정임합","무계합","신강","신약","용신","희신","기신","배우자성","합혼점수"];for(const word of forbidden)if(all.includes(word)&&!src.includes(word))return false;if(p==="compatibility"){if(data.overview.length<350)return false;for(const k of ["chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term"])if(String(data[k]??"").length<120)return false;if((data.felt_scenarios??[]).length<3)return false;}if(p.startsWith("marriage_")){const m=data.marriage_reading??{};if(data.overview.length<300)return false;if(String(m.bottom_line??"").length<260)return false;for(const k of ["bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution"])if(String(m[k]??"").length<170)return false;}if(p==="reunion"&&String(data.reunion_reading?.bottom_line??"").length<220)return false;return true;}\n'''
if marker not in t: raise SystemExit('generate marker missing')
t=t.replace(marker,grounded+marker,1)
old='''if(!data)return {ok:false,error:"관계 해설 구조 검증 실패",model};if(purpose==="reunion"&&data.reunion_reading.bottom_line.length<180)return {ok:false,error:"재회 해설이 지나치게 짧았어",model};return {ok:true,data,model,interpreter_version:VERSION,usage:usage(raw)};'''
if old in t:
    t=t.replace(old,'''if(!data||!grounded(data,payload,purpose))return {ok:false,error:"관계 해설이 깊이/근거 검증을 통과하지 못했어",model};return {ok:true,data,model,interpreter_version:VERSION,usage:usage(raw)};''',1)
else:
    old2='''if(!data)return {ok:false,error:"관계 해설 구조 검증 실패",model};if(purpose==="reunion"&&data.reunion_reading.bottom_line.length<180)return {ok:false,error:"재회 해설이 지나치게 짧았어",model};return {ok:true,data,model,interpreter_version:VERSION,usage:usage(raw)};'''
    if old2 not in t: raise SystemExit('validation marker missing')
p.write_text(t,encoding='utf-8')
print('relationship AI source synced to v10.1')
