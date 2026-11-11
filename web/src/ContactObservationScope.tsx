import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { IntegratedApiResponse } from './appTypes'
import type { DailyOutcomeRecord } from './DailyOutcomeCard'
import type { FortuneField } from './lib/fortuneFields'
import { listLocalArchive, readCloudContactOutcomes } from './lib/archive'
import { browserLocalDateIso } from './lib/readingDateSemantics'
import { observedContactRows, observedRelationshipPassage } from './lib/contactOutcomeReading'

type ObservationContext = {
  observations: DailyOutcomeRecord[]
  remote: { failed: boolean } | null
  calculation: IntegratedApiResponse
}
const Observation = createContext<ObservationContext | null>(null)
export function useContactObservations() { return useContext(Observation) }

export function useObservedPassage(period:string, scope:string) {
  const shared = useContactObservations()
  return shared ? observedRelationshipPassage(shared.observations,shared.calculation,period,scope) : null
}

type ScopeProps = {calculation: IntegratedApiResponse; field?: FortuneField; localRecords?: unknown[]; children: ReactNode}
export function ContactObservationScope(props: ScopeProps) {
  const weeklyOverview = !props.field && props.calculation.period.day_count === 7
  if (!props.localRecords || (!weeklyOverview && !['love','contact','social'].includes(props.field?.id ?? ''))) return <>{props.children}</>
  return <LoadObservations {...props} localRecords={props.localRecords}/>
}
function LoadObservations({calculation,field,localRecords,children}: ScopeProps & {localRecords:unknown[]}) {
  const {start,end} = calculation.period
  const today = browserLocalDateIso()
  const through = end < today ? end : today
  const day = start === end
  const hasRelationshipContext = !field || field.id === 'love' || field.id === 'contact'
  const from = day || hasRelationshipContext ? new Date(Date.parse(start + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0,10) : start
  const [cloud,setCloud] = useState<{from:string;end:string;values:unknown[];failed:boolean} | null>(null)
  useEffect(()=>{
    let active = true
    setCloud(null)
    if (from > through) {
      setCloud({from,end:through,values:[],failed:false})
      return
    }
    readCloudContactOutcomes(from,through).then(values=>{
      if (active) setCloud({from,end:through,values,failed:false})
    }).catch(()=>{
      if (active) setCloud({from,end:through,values:[],failed:true})
    })
    return ()=>{active = false}
  },[from,through,localRecords])
  const remote = cloud?.from === from && cloud.end === through ? cloud : null
  const archived = listLocalArchive().filter(row=>row.kind === 'outcome').map(row=>row.result)
  const observations = observedContactRows([...archived,...(remote?.values ?? []),...localRecords],from,through)
  return <Observation.Provider value={{observations,remote,calculation}}>{children}</Observation.Provider>
}
