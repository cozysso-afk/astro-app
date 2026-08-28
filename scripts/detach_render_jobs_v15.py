from pathlib import Path

p=Path(__file__).resolve().parents[1]/'api'/'main.py'
s=p.read_text(encoding='utf-8')
s=s.replace('from fastapi import BackgroundTasks, FastAPI, HTTPException','from fastapi import FastAPI, HTTPException')
s=s.replace('APP_VERSION = "api-fortune-v4.2-async"','APP_VERSION = "api-fortune-v4.3-detached"')
s=s.replace('def integrated_fortune_start(request: IntegratedFortuneRequest, background_tasks: BackgroundTasks) -> dict:', 'def integrated_fortune_start(request: IntegratedFortuneRequest) -> dict:')
s=s.replace('    background_tasks.add_task(_run_calc_job, job_id, request.model_dump(mode="json"))\n', '    threading.Thread(target=_run_calc_job, args=(job_id, request.model_dump(mode="json")), daemon=True, name=f"fortune-calc-{job_id[:8]}").start()\n')
s=s.replace('def fortune_interpret_start(request: IntegratedInterpretRequest, background_tasks: BackgroundTasks) -> dict:', 'def fortune_interpret_start(request: IntegratedInterpretRequest) -> dict:')
s=s.replace('    background_tasks.add_task(_run_ai_job, job_id, request.calculation, request.model)\n', '    threading.Thread(target=_run_ai_job, args=(job_id, request.calculation, request.model), daemon=True, name=f"fortune-ai-{job_id[:8]}").start()\n')
if 'BackgroundTasks' in s:
    raise SystemExit('BackgroundTasks remains')
for marker in ['threading.Thread(target=_run_calc_job','threading.Thread(target=_run_ai_job','api-fortune-v4.3-detached']:
    if marker not in s: raise SystemExit(marker)
p.write_text(s,encoding='utf-8')
print('detached Render jobs from request lifecycle')
