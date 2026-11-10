export function relationshipLimitKo(text: string) {
  if (text.includes('Partner exact birth time/place missing')) return '상대의 정확한 출생시간·장소가 없어 데이비슨·마크스·마크스 3차 진행은 추정하지 않고 제외했어.'
  if (text.includes('Exact partner birth time')) return '상대의 정확한 출생시간이 없어 해당 정밀 진행 레이어는 계산하지 않았어.'
  if (text === 'Entered but unverified birth time/place: house, Davison and Marks layers are calculated as provisional reference only and may shift if the recorded time changes.') {
    return '출생시간과 장소를 입력했지만 정확성을 확인하지 못했어. 하우스·데이비슨·마크스는 입력값을 기준으로 계산한 참고 결과야. 출생시간이 달라지면 결과도 바뀔 수 있어.'
  }
  if (text === 'Concrete birth time/place missing for one or both people: Davison, Marks and Marks tertiary progression remain unavailable.') {
    return '두 사람 중 한 명 이상에게 출생시간이나 장소 정보가 부족해 데이비슨·마크스·마크스 3차 진행을 계산하지 못했어.'
  }
  const polar = /^Polar latitude house fallback: Swiss Ephemeris could not calculate Placidus for (user|counterpart|user, counterpart); Porphyry quadrant houses were used explicitly instead\.$/.exec(text)
  if (polar) {
    const who = polar[1] === 'user' ? '내' : polar[1] === 'counterpart' ? '상대의' : '두 사람의'
    return `극지방에 있는 ${who} 출생지에서는 스위스 천문력으로 플라시두스 하우스를 계산할 수 없어 포르피리 하우스를 사용했어.`
  }
  return text
}
