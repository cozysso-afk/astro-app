from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'
s = p.read_text(encoding='utf-8')

old = '''function allowedTimingDates(payload: any) {
  return new Set(arr(payload?.reunion_timing_windows?.windows).map((x:any)=>text(x?.date)).filter((x:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x)))
}

function timingWindowAllowed(window: any, allowed: Set<string>) {
  if (!allowed.size) return true
  const found = text(window?.period).match(/\\d{4}-\\d{2}-\\d{2}/g) ?? []
  return !found.length || found.every((x:string)=>allowed.has(x))
}
'''
new = '''function allowedTimingDateGate(payload: any) {
  const present = Boolean(payload?.reunion_timing_windows && Array.isArray(payload?.reunion_timing_windows?.windows))
  const dates = new Set(arr(payload?.reunion_timing_windows?.windows).map((x:any)=>text(x?.date)).filter((x:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x)))
  return { present, dates }
}

function timingWindowAllowed(window: any, gate: {present:boolean;dates:Set<string>}) {
  if (!gate.present) return true
  const found = text(window?.period).match(/\\d{4}-\\d{2}-\\d{2}/g) ?? []
  return !found.length || found.every((x:string)=>gate.dates.has(x))
}
'''
if s.count(old) != 1:
    raise RuntimeError(f'timing allowlist helper: expected 1, got {s.count(old)}')
s = s.replace(old, new, 1)

old2 = '''  const allowedDates = allowedTimingDates(payload)
  v2.timing = { ...v2.timing, windows: arr(v2?.timing?.windows).filter((w:any)=>timingWindowAllowed(w, allowedDates)) }
'''
new2 = '''  const timingDateGate = allowedTimingDateGate(payload)
  v2.timing = { ...v2.timing, windows: arr(v2?.timing?.windows).filter((w:any)=>timingWindowAllowed(w, timingDateGate)) }
'''
if s.count(old2) != 1:
    raise RuntimeError(f'timing gate use: expected 1, got {s.count(old2)}')
s = s.replace(old2, new2, 1)
p.write_text(s, encoding='utf-8')
print('empty exact-date allowlist now fails closed')
