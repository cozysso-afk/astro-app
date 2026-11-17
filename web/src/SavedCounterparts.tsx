import { useState } from 'react'
import type { CounterpartProfile } from './appTypes'
import { counterpartId, readSavedCounterparts, removeCounterpart, saveCounterpart, toCounterpartProfile, type SavedCounterpart } from './lib/savedCounterparts'

/** Saved people for 궁합·재회·결혼. Pick one to fill the form, save the current one. */
export function SavedCounterparts({ value, onPick }: { value: CounterpartProfile; onPick: (profile: CounterpartProfile) => void }) {
  const [rows, setRows] = useState<SavedCounterpart[]>(() => readSavedCounterparts())
  const [notice, setNotice] = useState('')
  const currentId = value.birthDate ? counterpartId(value) : ''
  const saved = rows.some(row => row.id === currentId)
  return <div className="saved-counterparts field-wide" aria-label="저장한 상대">
    {rows.length > 0 && <div className="saved-counterpart-list" role="group" aria-label="저장한 상대 고르기">
      {rows.map(row => <span className="saved-counterpart-chip" key={row.id} data-selected={row.id === currentId}>
        <button type="button" onClick={() => { onPick(toCounterpartProfile(row)); setNotice('') }}>
          {row.name || '상대'} · {row.birthDate}
        </button>
        <button type="button" className="saved-counterpart-remove" aria-label={`${row.name || '상대'} 삭제`} onClick={() => setRows(removeCounterpart(row.id))}>×</button>
      </span>)}
    </div>}
    <button type="button" className="saved-counterpart-save" disabled={!value.birthDate} onClick={() => {
      setRows(saveCounterpart(value))
      setNotice(saved ? '저장한 정보를 지금 입력으로 바꿨어.' : '이 기기에 저장했어. 다음엔 위 목록에서 고르면 돼.')
    }}>{saved ? '저장한 정보 업데이트' : '이 상대 저장'}</button>
    {notice && <p className="saved-counterpart-notice" role="status">{notice}</p>}
  </div>
}
