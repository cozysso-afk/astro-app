export type ReadingDateSemantics = {
  selectedDate: string
  actualToday: string
  isActualToday: boolean
  dayLabel: '오늘' | '선택한 운세일'
  subjectLabel: '오늘은' | '선택한 운세일에는'
}

export function browserLocalDateIso(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function readingDateSemantics(selectedDate: string, actualToday = browserLocalDateIso()): ReadingDateSemantics {
  const isActualToday = selectedDate === actualToday
  return {
    selectedDate,
    actualToday,
    isActualToday,
    dayLabel: isActualToday ? '오늘' : '선택한 운세일',
    subjectLabel: isActualToday ? '오늘은' : '선택한 운세일에는',
  }
}
