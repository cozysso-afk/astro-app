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
  top_periods:ReunionPeriod[]; nearest_window:ReunionPeriod|null; past_windows:ReunionPeriod[];
  limitations:string[];
  stability_structure?:{support:unknown[];obstacles:unknown[];policy:string};
}
export function hierarchyView(raw: Record<string,unknown>|null|undefined):ReunionHierarchy|null {
  if(!raw || typeof raw.version!=='string' || !Array.isArray(raw.top_periods) || !raw.validation) return null
  return raw as unknown as ReunionHierarchy
}
