/* Shared UI/API type contracts extracted from AppNext.tsx. */

export type PeriodKey = 'today' | 'week' | 'month' | 'year'
export type ApiStatus = 'warming' | 'online' | 'offline'
export type MainView = 'home' | 'profile' | 'history' | 'settings'
export type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'location' | 'precision'
export type RelationshipStatus = 'single' | 'dating' | 'long_term' | 'cohabiting' | 'engaged' | 'married'
export type RelationshipPurpose = 'compatibility' | 'reunion'
export type MarriageMode = 'unmarried' | 'married'
export type RelationshipAnalysisMode = RelationshipPurpose | 'marriage_unmarried' | 'marriage_married'
export type Gender = 'female' | 'male'

export type BirthProfile = {
  name: string
  birthDate: string
  birthTime: string
  placeKey: string
  latitude: string
  longitude: string
  utcOffset: string
  gender: Gender
}

export type CounterpartProfile = BirthProfile & { timeKnown: boolean }

export type Aspect = {
  a: string
  aspect: string
  b: string
  orb: number
  tone: 'supportive' | 'challenging' | 'mixed'
  layer?: string
}

export type SignalSummary = {
  exact_contacts: number
  supportive_contacts: number
  challenging_contacts: number
  tightest: Aspect[]
}

export type RelationshipMonth = {
  calendar_month: string
  representative_date: string
  signal_summary: SignalSummary
}

export type RelationshipApiResponse = {
  ok: boolean
  api_version: string
  engine: string
  relationship_status: RelationshipStatus
  period: { start: string; end: string; month_segments: number }
  result: {
    limitations?: string[]
    natal_synastry?: { available: boolean; partner_time_exact: boolean; aspects: Aspect[]; note?: string }
    house_overlays?: {
      available: boolean
      precision_note?: string
      user_in_counterpart?: { available: boolean; relationship_houses?: Array<{ source:string; planet:string; target:string; house?:number|null; placidus_house?:number|null; whole_house?:number|null }> }
      counterpart_in_user?: { available: boolean; relationship_houses?: Array<{ source:string; planet:string; target:string; house?:number|null; placidus_house?:number|null; whole_house?:number|null }> }
    }
    davison?: { available: boolean; reason?: string }
    marks?: { available: boolean; reason?: string }
    months?: RelationshipMonth[]
    reunion_transits?: {
      available: boolean
      period: { start: string; end: string }
      policy: string
      top_days: Array<{
        date: string; score: number; user_score: number; counterpart_score: number; shared_activation: boolean
        hits: Array<{ person: 'user'|'counterpart'; transit: string; aspect: string; target: string; orb: number; tone: string; score: number }>
      }>
      top_months: Array<{ calendar_month: string; score: number; top_dates: string[] }>
      directional_context?: ReunionTimingContext
    }
  }
}

export type RelationshipAiResponse = {
  ok: boolean
  error?: string
  model?: string
  fallback_from?: string
  interpreter_version?: string
  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number }
  data?: {
    headline: string
    overview: string
    chemistry: string
    emotional_dynamic?: string
    communication: string
    conflict_pattern?: string
    power_boundaries?: string
    long_term?: string
    stability?: string
    tensions?: string
    timing: string
    reunion_context: string
    felt_scenarios?: string[]
    reunion_reading?: {
      bottom_line: string
      incoming_contact: string
      outgoing_contact: string
      reconnection_windows: string
      low_windows: string
      relationship_filter: string
      precision_note: string
    }
    marriage_reading?: {
      mode: string
      bottom_line: string
      bond: string
      emotional_home: string
      daily_life: string
      conflict_repair: string
      commitment_or_current_cycle: string
      timing: string
      caution: string
      precision_note: string
    }
    practical_advice?: string[]
    top_aspects: Array<{ label: string; meaning: string }>
    limits: string
  }
}

export type FortunePoint = { date: string; label: string; score: number }
export type FortuneStat = {
  average: number
  band: string
  spread: number
  best_days: FortunePoint[]
  caution_days: FortunePoint[]
}
export type FortuneMonth = {
  calendar_month: string
  start: string
  end: string
  topics: Record<string, FortuneStat | null>
  relationship_signals: Record<string, FortuneStat | null>
}
export type ReunionTimingContext = {
  period: { start: string; end: string }
  incoming: FortuneStat | null
  outgoing: FortuneStat | null
  reconnection: FortuneStat | null
  months: Array<{
    calendar_month: string
    start: string
    end: string
    incoming: FortuneStat | null
    outgoing: FortuneStat | null
    reconnection: FortuneStat | null
  }>
}

export type FortuneDailyEvidence = {
  kind: string
  sample_time?: string
  source_topics?: string[]
  contribution?: number
  text: string
  transit?: string
  target?: string
  aspect?: string
  orb?: number
  motion?: string
  direction?: string
  whole_house?: number
  placidus_house?: number | null
  polarity?: number
}
export type FortuneDailyScore = {
  date: string
  label: string
  market_open: boolean
  scores: Record<string, number | null>
  evidence?: FortuneDailyEvidence[]
}

export type IntegratedApiResponse = {
  ok: boolean
  api_version: string
  engine: string
  period: { start: string; end: string; day_count: number; month_segments: number }
  western: {
    ok: boolean
    engine: string
    ephemeris: string
    score_policy: string
    natal: { asc: number; mc: number }
    overall: Record<string, FortuneStat | null>
    relationship_signals: Record<string, FortuneStat | null>
    market?: { has_open_session: boolean; session_count: number; session_dates: string[]; calendar_mode?: string; calendar_exact_range?: string[] | null; calendar_warning?: string | null }
    detail_days?: Array<{ date: string; market_open: boolean; topics: Record<string, { best_window?: { start: string; end: string; score: number }; caution_window?: { start: string; end: string; score: number }; evidence?: string[] }> }>
    daily_scores?: FortuneDailyScore[]
    key_dates?: Array<{ date:string; salience?:number; topics?:Record<string,unknown>|string[]; evidence?:string[]; samples?:unknown[] }>
    months: FortuneMonth[]
  }
  saju: {
    ok: boolean
    engine: string
    error?: string
    pillars?: { year: string; month: string; day: string; hour: string }
    day_master?: string
    elements?: Record<string, number>
    true_solar?: {
      legal_local_time: string
      true_solar_time: string
      total_correction_minutes: number
    }
    dayun?: Array<{ start_year: number; end_year: number; start_age: number; end_age: number; ganzhi: string }>
    annual?: Array<{ year: number; ganzhi: string; stem_ten_god: string; branch_links: string[]; segment_start?: string; segment_end_exclusive?: string; start_jie?: string; start_jie_ko?: string; representative_time?: string; boundary_note?: string }>
    monthly?: Array<{ calendar_month: string; ganzhi: string; stem_ten_god: string; branch_links: string[]; segment_start?: string; segment_end_exclusive?: string; representative_time?: string; jie_name?: string; jie_name_ko?: string; next_jie?: string; next_jie_ko?: string; boundary_note?: string }>
    not_calculated?: string[]
  }
  thai: {
    ok: boolean
    engine: string
    thai_day: string
    birth_planet?: { key:string; number:number; thai_name:string; label:string }
    ruler: string
    rule: string
    mahathaksa?: { available:boolean; method:string; wheel:Array<{ bhumi_key:string; bhumi_thai:string; bhumi_label:string; planet:{ key:string; number:number; thai_name:string; label:string } }> }
    taksajorn?: { available:boolean; method:string; method_variance_note?:string; segments:Array<{ start:string; end:string; age_in_progress:number; annual_boriwan:{ key:string; number:number; thai_name:string; label:string }; landed_center:boolean; wheel:Array<{ bhumi_key:string; bhumi_thai:string; bhumi_label:string; planet:{ key:string; number:number; thai_name:string; label:string } }> }> }
    suriyayat?: { available:boolean; engine:string; source_commit?:string; time_basis:string; validation?:{status:string;reference?:string;vectors?:number;dates?:number;max_delta_arcmin?:number;within_1_arcmin?:number}; natal?:{instant:string;suriyayat_reference_time:string;positions:Record<string,{arcmin:number;longitude_deg:number;sign_index:number;sign_ko:string;degree:number;minute:number;display:string}>}; period_start?:{instant:string;suriyayat_reference_time:string;positions:Record<string,{arcmin:number;longitude_deg:number;sign_index:number;sign_ko:string;degree:number;minute:number;display:string}>}; period_end?:{instant:string;suriyayat_reference_time:string;positions:Record<string,{arcmin:number;longitude_deg:number;sign_index:number;sign_ko:string;degree:number;minute:number;display:string}>}; lagna?:{available:boolean;reason?:string;display?:string;longitude_deg?:number;sign_index?:number;sign_ko?:string;degree?:number;minute?:number;second?:number;interpretation_scope?:string;validation?:{numeric_position_validated?:boolean;global_coordinates_independently_validated?:boolean;world_numeric_checks?:number}}; ai_safe_packet_product?:{eligible_for_gemini?:boolean;research_only?:boolean;route_count?:number;routes?:Array<{route_key?:string;interpretation_level?:string}>}; interpretation_status?:string; policy?:string }
    predictive_status: string
    consensus_policy: string
    reliability?: Record<string,string>
    not_calculated?: string[]
  }
}

export type LocationFitResponse = {
  ok: boolean
  api_version: string
  engine: string
  policy: { meaning: string; probability: boolean; guarantee: boolean; catalog_scope: string; distance_rule: string }
  map?: {
    projection: string
    latitude_limit: number
    line_policy: string
    lines: Array<{ planet:string; angle:'ASC'|'DC'|'MC'|'IC'; segments:Array<Array<{latitude:number;longitude:number}>> }>
  }
  countries: Array<{ country: string; score: number; best_city: string; evidence: Array<{planet:string;angle:string;separation_deg:number;tone:string}> }>
  purposes: Record<string,{ label:string; cities:Array<{city:string;country:string;latitude:number;longitude:number;score:number;evidence:Array<{planet:string;angle:string;separation_deg:number;tone:string}>}> }>
}

export type AiTopicInterpretation = {
  importance: '핵심' | '주목' | '참고'
  verdict: string
  reason: string
  timing: string
  action: string
  avoid: string
  confidence: '높음' | '보통' | '낮음'
  confidence_reason: string
  evidence_refs?: string[]
}

export type AiKeyWindow = {
  label: string
  start: string
  end: string
  signal: '활용' | '혼합' | '주의' | '배경'
  topics: string[]
  summary: string
  action: string
  avoid: string
  evidence_refs: string[]
}

export type AiYearPhase = {
  label: string
  start: string
  end: string
  theme: string
  change: string
  evidence_refs: string[]
}

export type AiCrossCheck = {
  label: string
  start: string
  end: string
  mode: '복수체계' | '상반맥락' | 'Western단독'
  western: string
  saju: string
  thai: string
  synthesis: string
  evidence_refs: string[]
}

export type AiDecision = {
  action: string
  timing: string
  reason: string
  watch: string
  avoid: string
  evidence_refs: string[]
}

export type AiQualityValidation = {
  version?: string
  score?: number
  stages?: Array<{ stage:number; name:string; passed:boolean }>
}

export type AiInterpretationResponse = {
  ok: boolean
  missing_key?: boolean
  error?: string
  model?: string
  fallback_from?: string
  interpreter_version?: string
  usage?: {
    prompt_tokens?: number
    candidate_tokens?: number
    thought_tokens?: number
    billable_output_tokens?: number
    total_tokens?: number
    estimated_usd?: number
    estimated_krw?: number
    price_phase?: string
    attempt_count?: number
    thai_safety_retry?: boolean
    thai_safety_fallback?: boolean
    quality_validation?: AiQualityValidation | null
  }
  data?: {
    headline: string
    overall: { summary: string; dominant_pattern: string; best_phase: string; caution_phase: string; evidence_refs?: string[] }
    key_windows?: AiKeyWindow[]
    year_phases?: AiYearPhase[]
    cross_checks?: AiCrossCheck[]
    decisions?: AiDecision[]
    clusters: { relationship: string; work_study: string; money_news: string; investment?: string; condition: string }
    relationship_reading?: { context: string; flow: string; focus_timing: string; watch: string; avoid: string; evidence_refs?: string[] }
    contact_flow?: { incoming?: string; outgoing?: string; reconnection?: string }
    investment_reading?: { psychology?: string; realization?: string; entry?: string; risk?: string }
    systems: { western: string; saju: string; thai: string }
    priorities: string[]
    topic_analysis: Record<string, AiTopicInterpretation>
    limits: string
  }
}