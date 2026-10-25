export type ReadingClaimKind = 'observed' | 'calculated' | 'interpretive' | 'advisory'
export type ReadingTone = 'supportive' | 'mixed' | 'caution' | 'insufficient'

export type ReadingClaimV4 = {
  id: string
  kind: ReadingClaimKind
  text: string
  evidenceRefs: string[]
}

export type ReaderManuscriptV4 = {
  topic: string
  verdict: {
    title: string
    answer: string
    tone: ReadingTone
  }
  reasons: ReadingClaimV4[]
  limitingFactor?: ReadingClaimV4
  nextCheckpoint: ReadingClaimV4
  risesWhen: string[]
  fallsWhen: string[]
  scopeNote?: string
}

export type ReadingSystem = 'western' | 'saju' | 'thai' | 'observation'
export type EvidenceRole = 'dated_trigger' | 'period_context' | 'behavioral_condition' | 'descriptive_baseline'
export type EvidenceStance = 'supportive' | 'challenging' | 'mixed' | 'neutral' | 'non_directional'

export type InterpretationEvidenceV4 = {
  id: string
  system: ReadingSystem
  topic: string
  questionKey: string
  role: EvidenceRole
  stance: EvidenceStance
  period?: { start: string; end: string }
  claim: string
  livedMeaning: string
  disallowedInference: string[]
  precision: {
    grade: 'high' | 'medium' | 'low' | 'withheld'
    birthTimeDependency: 'none' | 'low' | 'high' | 'required'
    stabilityChecked: boolean
    reason: string
  }
  provenance: {
    engine: string
    engineVersion?: string
    sourcePath: string
    rawEvidenceId: string
  }
}

export type SynthesisRelation = 'reinforces' | 'tension' | 'complements' | 'single_source' | 'withheld'

