from pathlib import Path
p=Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
s=p.read_text(encoding='utf-8')
old='''    rr.focus_timing=String(rr?.focus_timing??"").trim()||timingParts.length?(singleDay?"선택한 날에 세 방향의 직접 계산근거가 연결돼 있어. 실제 답변·약속·만남 제안이 뒤따르는지 확인해.":`${timingParts.join(" · ")}. 각 날짜는 해당 방향의 직접 계산상 두드러지는 시기이며 관계 결과 자체를 뜻하지 않아.`):`${singleDay?"이날":"직접 관계 날짜 근거가 있는 구간에서"} 실제 답변·약속·만남 제안이 뒤따르는지 확인해.`;'''
new='''    rr.focus_timing=String(rr?.focus_timing??"").trim()||(timingParts.length?(singleDay?"선택한 날에 세 방향의 직접 계산근거가 연결돼 있어. 실제 답변·약속·만남 제안이 뒤따르는지 확인해.":`${timingParts.join(" · ")}. 각 날짜는 해당 방향의 직접 계산상 두드러지는 시기이며 관계 결과 자체를 뜻하지 않아.`):`${singleDay?"이날":"직접 관계 날짜 근거가 있는 구간에서"} 실제 답변·약속·만남 제안이 뒤따르는지 확인해.`);'''
if old not in s:
    raise SystemExit('focus_timing precedence target not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

t=Path('supabase/functions/fortune-interpret-v23-preview/proseOwnershipV23.contract.test.mjs')
s=t.read_text(encoding='utf-8')
needle="  assert.match(stabilizer,/rr\\.context=String\\(rr\\?\\.context/)\n"
insert=needle+"  assert.match(stabilizer,/rr\\.focus_timing=String\\(rr\\?\\.focus_timing.*\\|\\|\\(timingParts\\.length/)\n"
if needle not in s:
    raise SystemExit('contract insertion point not found')
s=s.replace(needle,insert,1)
t.write_text(s,encoding='utf-8')
print('follow-up prose ownership fix applied')
