from pathlib import Path
p=Path('web/src/lib/systemReading.test.mjs')
s=p.read_text(encoding='utf-8')
old="assert.match(contact.conclusion,/먼저 말을 꺼내/)"
new="assert.match(contact.conclusion,/먼저 말을 꺼낼/)"
if new not in s:
    if old not in s:
        raise SystemExit('target regex not found')
    p.write_text(s.replace(old,new,1),encoding='utf-8')
print('patched')
