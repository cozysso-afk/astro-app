export type ReunionComponents = {
  long_term:number; mid_term:number; event_trigger:number; cross_system:number; final:number;
}
export type ReunionPeriod = {
  start:string; end:string; date:string; stage:string; label:string; final:number; components:ReunionComponents;
}
export type ReunionHierarchy = {
  version:string; as_of_date:string; score_meaning:string;
  validation:{status:string; checks:Array<{name:string;status:string;detail:string}>};
  stages:Record<string,{label:string;activation:number|null;candidate_count:number}>;
  top_periods:ReunionPeriod[]; nearest_window:ReunionPeriod|null; past_windows:ReunionPeriod[]; current_windows:ReunionPeriod[];
  limitations:string[];
  stability_structure?:{support:unknown[];obstacles:unknown[];policy:string};
}

const isoDay = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
const futurePeriod = (row: ReunionPeriod, asOf: string) => !asOf || (!!isoDay(row.date) && row.date >= asOf)

export function hierarchyView(raw: Record<string,unknown>|null|undefined):ReunionHierarchy|null {
  if(!raw || typeof raw.version!=='string' || !Array.isArray(raw.top_periods) || !raw.validation) return null
  const value = raw as unknown as ReunionHierarchy
  const asOf = isoDay(value.as_of_date)
  const topPeriods = value.top_periods.filter((row)=>futurePeriod(row,asOf)).slice(0,3)
  const nearest = value.nearest_window && futurePeriod(value.nearest_window,asOf)
    ? value.nearest_window
    : [...topPeriods].sort((a,b)=>a.date.localeCompare(b.date) || b.final-a.final)[0] ?? null
  const pastWindows = Array.isArray(value.past_windows)
    ? value.past_windows.filter((row)=>!asOf || row.date < asOf).sort((a,b)=>b.final-a.final || b.date.localeCompare(a.date)).slice(0,3)
    : []
  const currentWindows = Array.isArray(value.current_windows)
    ? value.current_windows.filter((row)=>!asOf || (row.start <= asOf && row.end >= asOf)).sort((a,b)=>b.final-a.final || a.date.localeCompare(b.date)).slice(0,3)
    : []
  return {
    ...value,
    top_periods: topPeriods,
    nearest_window: nearest,
    past_windows: pastWindows,
    current_windows: currentWindows,
  }
}
