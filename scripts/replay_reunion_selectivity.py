"""Read private requests from stdin; emit aggregate audit metrics only.

No raw profiles, exceptions, charts, or event histories are written or printed.
Run in an isolated process against a pinned checkout. The caller owns encrypted
input transport; plaintext exists only in process memory and stdin pipes.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import statistics
import sys
import time


def replay(checkout, requests):
    sys.path.insert(0, str(Path(checkout).resolve()))
    from api.main import RelationshipRequest, relationship_western
    output = []
    for index, request in enumerate(requests):
        # Never accept event history or prompt/context as a scoring input.
        allowed = ('user', 'counterpart', 'start_date', 'end_date', 'as_of_date',
                   'query_utc_offset_hours', 'analysis_mode', 'relationship_status')
        body = {key: request[key] for key in allowed if key in request}
        begin = time.perf_counter()
        result = relationship_western(RelationshipRequest(**body))['result']
        elapsed = time.perf_counter() - begin
        h = result['reunion_hierarchy']
        trace = h['daily_trace']
        by_stage = {}
        for stage in h['stages']:
            rows = [r for r in trace if r['stage'] == stage]
            def counts(items):
                return {
                    'total_days': len(items),
                    'long_term_pass': sum(r['components']['gates']['long_term'] for r in items),
                    'medium_anchor_pass': sum(r['medium_anchor_pass'] for r in items) if all('medium_anchor_pass' in r for r in items) else None,
                    'raw_numeric_gate_pass': sum(r.get('raw_numeric_gate_pass', all(r['components']['gates'].values())) for r in items),
                    'semantic_stage_trigger_pass': sum(r['stage_trigger_ok'] for r in items),
                    'hierarchy_eligible': sum(r.get('hierarchy_eligible', r['eligible'] and r['stage_trigger_ok']) for r in items),
                    'local_peaks': sum(r['selection_eligible'] for r in items),
                }
            future = [r for r in rows if r['date'] >= h['as_of_date']]
            values = counts(rows)
            values.update({'future_' + k: v for k, v in counts(future).items()})
            values['raw_pass_ratio'] = round(values['raw_numeric_gate_pass'] / max(1, len(rows)), 4)
            values['hierarchy_pass_ratio'] = round(values['hierarchy_eligible'] / max(1, len(rows)), 4)
            scored = [r['components']['final'] for r in future if r.get('hierarchy_eligible', r['eligible'] and r['stage_trigger_ok'])]
            values['future_hierarchy_score_median'] = statistics.median(scored) if scored else None
            by_stage[stage] = values
        def compact(window):
            if window is None:
                return None
            return {key: window[key] for key in ('date', 'start', 'end', 'stage', 'final', 'components')}
        nearest = compact(h['nearest_window'])
        top = [compact(w) for w in h['top_periods']]
        public = result['reunion_timing_windows']['windows']
        selected = [(r['date'], r['stage'], r['components']) for r in trace if r['selection_eligible']]
        signature = {'top': top, 'nearest': nearest, 'stages': h['stages'], 'selectivity': h['selectivity'], 'selected': selected}
        totals = {}
        for key in ('total_days', 'long_term_pass', 'medium_anchor_pass', 'raw_numeric_gate_pass',
                    'semantic_stage_trigger_pass', 'hierarchy_eligible', 'local_peaks', 'future_local_peaks'):
            values = [s[key] for s in by_stage.values()]
            totals[key] = sum(values) if all(v is not None for v in values) else None
        output.append({
            'case_index': index + 1, 'version': h['version'],
            'requested_range': [body['start_date'], body['end_date']], 'as_of_date': h['as_of_date'],
            'runtime_seconds': round(elapsed, 3), 'validation_status': h['validation']['status'],
            'totals': totals, 'by_stage': by_stage, 'top3': top, 'nearest': nearest,
            'nearest_in_public': nearest is None or any(w['date'] == nearest['date'] and w['stage'] == nearest['stage'] for w in public),
            'selection_implies_hierarchy_and_numeric': all(
                not r['selection_eligible'] or (r.get('hierarchy_eligible', r['eligible'] and r['stage_trigger_ok']) and all(r['components']['gates'].values())) for r in trace),
            'determinism_digest': hashlib.sha256(json.dumps(signature, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        })
    return output


if __name__ == '__main__':
    try:
        requests = json.load(sys.stdin)
        data = replay(sys.argv[1], requests)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception:
        # A Pydantic/HTTP exception can embed an input profile. Never print it.
        print('{"status":"FAILED","detail":"private replay failed; raw exception suppressed"}')
        sys.exit(1)
