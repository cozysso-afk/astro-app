import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BirthProfile, TimeConfidence, TimeSource } from './appTypes'
import { rememberBirthTimeReliability } from './lib/precisionTransport'
import {
  backgroundDiagnosticsEnabled,
  captureBackgroundDiagnostic,
  formatBackgroundDiagnostic,
  type BackgroundDiagnosticSnapshot,
} from './lib/backgroundDiagnostics'

type ReliabilityValue = BirthProfile

type Props = {
  value: ReliabilityValue
  onChange: (patch: Partial<Pick<BirthProfile, 'timeSource' | 'timeConfidence' | 'rectifiedWindowStart' | 'rectifiedWindowEnd'>>) => void
  disabled?: boolean
  compact?: boolean
}

type StableChoiceChangeContext = {
  preserveRenderedResults: boolean
}

type StableChoiceProps = {
  value: string
  options: ReadonlyArray<readonly [string, string, boolean?]>
  onChange: (value: string, context: StableChoiceChangeContext) => void
  disabled?: boolean
  ariaLabel: string
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const exactSources = new Set<TimeSource>(['official_record', 'rectified'])

export const timeSourceLabels: Array<[TimeSource, string]> = [
  ['official_record', '공식 출생기록 / 출생증명'],
  ['family_memory', '가족의 기억'],
  ['user_estimate', '사용자 추정'],
  ['arbitrary_input', '계산을 위한 임시 입력'],
  ['rectified', '사건 검증으로 보정한 시각'],
  ['unknown', '출처 모름'],
]

export const timeConfidenceLabels: Array<[TimeConfidence, string]> = [
  ['exact', 'Exact · 정확 검증'],
  ['high', 'High · 높은 신뢰'],
  ['medium', 'Medium · 중간'],
  ['low', 'Low · 낮음'],
  ['unknown', 'Unknown · 확인 안 됨'],
]

function shouldPreserveRenderedResults(root: HTMLElement | null) {
  if (!root?.closest('.tool-panel')) return false
  return Boolean(document.querySelector('.results-wrap'))
}

function StableChoice({ value, options, onChange, disabled = false, ariaLabel }: StableChoiceProps) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [diagnostic, setDiagnostic] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const diagnosticBeforeRef = useRef<BackgroundDiagnosticSnapshot | null>(null)
  const listboxId = useId()
  const selectedLabel = options.find(([key]) => key === value)?.[1] ?? ''
  const diagnosticMode = backgroundDiagnosticsEnabled()

  const updateMenuPosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewport = window.visualViewport
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportWidth = viewport?.width ?? window.innerWidth
    const viewportBottom = viewportTop + viewportHeight
    const belowSpace = Math.max(0, viewportBottom - rect.bottom - 8)
    const aboveSpace = Math.max(0, rect.top - viewportTop - 8)
    const placeAbove = belowSpace < 220 && aboveSpace > belowSpace
    const available = placeAbove ? aboveSpace : belowSpace
    const maxHeight = Math.max(120, Math.min(320, available - 6))
    const width = Math.min(rect.width, Math.max(0, viewportWidth - 16))
    const left = Math.min(
      Math.max(rect.left, viewportLeft + 8),
      viewportLeft + viewportWidth - width - 8,
    )
    const top = placeAbove
      ? Math.max(viewportTop + 8, rect.top - maxHeight - 6)
      : Math.min(rect.bottom + 6, viewportBottom - 128)
    setMenuPosition({ top, left, width, maxHeight })
  }

  useEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }
    updateMenuPosition()
    const update = () => updateMenuPosition()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const captureAfterSelection = (before: BackgroundDiagnosticSnapshot, selectedKey: string) => {
    const reports: string[] = []
    const sample = (label: string) => {
      reports.push(formatBackgroundDiagnostic(`${ariaLabel}/${selectedKey}/${label}`, before, captureBackgroundDiagnostic()))
      setDiagnostic(reports.join('\n\n'))
      try { localStorage.setItem('starlight-bgdiag-v73', reports.join('\n\n')) } catch { /* diagnostic only */ }
    }
    window.setTimeout(() => sample('t0'), 0)
    window.setTimeout(() => sample('t60'), 60)
    window.setTimeout(() => sample('t300'), 300)
  }

  const menu = open && menuPosition && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="stable-choice-menu stable-choice-menu-portal"
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        style={{
          position: 'fixed',
          zIndex: 10000,
          top: menuPosition.top,
          left: menuPosition.left,
          right: 'auto',
          width: menuPosition.width,
          maxHeight: menuPosition.maxHeight,
        }}
      >
        {options.map(([key, label, optionDisabled]) => <button
          key={key}
          type="button"
          className="stable-choice-option"
          role="option"
          aria-selected={key === value}
          disabled={optionDisabled}
          onPointerDown={(event) => {
            event.preventDefault()
            if (diagnosticMode) diagnosticBeforeRef.current = captureBackgroundDiagnostic()
          }}
          onClick={() => {
            const before = diagnosticMode
              ? diagnosticBeforeRef.current ?? captureBackgroundDiagnostic()
              : null
            onChange(key, {
              preserveRenderedResults: shouldPreserveRenderedResults(rootRef.current),
            })
            setOpen(false)
            if (before) captureAfterSelection(before, key)
          }}
        >{label}</button>)}
      </div>,
      document.body,
    )
    : null

  return <div className={`stable-choice ${open ? 'is-open' : ''}`} ref={rootRef}>
    <button
      ref={triggerRef}
      type="button"
      className="stable-choice-trigger"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
    >
      <span className="stable-choice-value">{selectedLabel}</span>
      <span className="stable-choice-chevron" aria-hidden="true">⌄</span>
    </button>
    {menu}
    {diagnosticMode && diagnostic && <div
      data-bgdiag="v73"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 10,
        border: '1px solid rgba(23, 32, 58, .18)',
        background: '#fff',
        color: '#17203a',
        fontSize: 11,
        lineHeight: 1.35,
        position: 'relative',
        zIndex: 30,
      }}
    >
      <strong style={{display:'block', marginBottom:6}}>배경 진단 v73 · 캡처 완료</strong>
      <button
        type="button"
        onClick={() => { void navigator.clipboard?.writeText(diagnostic) }}
        style={{minHeight:34, padding:'6px 10px', marginBottom:6}}
      >진단값 복사</button>
      <pre style={{margin:0, maxHeight:160, overflow:'auto', whiteSpace:'pre-wrap', fontSize:10}}>{diagnostic}</pre>
    </div>}
  </div>
}

export function BirthTimeReliabilityFields({ value, onChange, disabled = false, compact = false }: Props) {
  const [, forceLocalRender] = useState(0)
  const firstFieldRef = useRef<HTMLDivElement>(null)
  const [stagedForRecalculation, setStagedForRecalculation] = useState(false)
  const exactAllowed = exactSources.has(value.timeSource)

  useEffect(() => { rememberBirthTimeReliability(value) }, [value])

  useEffect(() => {
    if (!stagedForRecalculation) return
    const handlePrimaryAction = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('button.primary-button')
      if (!button) return
      const ownPanel = firstFieldRef.current?.closest('.tool-panel')
      if (ownPanel && button.closest('.tool-panel') === ownPanel) setStagedForRecalculation(false)
    }
    document.addEventListener('click', handlePrimaryAction, true)
    return () => document.removeEventListener('click', handlePrimaryAction, true)
  }, [stagedForRecalculation])

  const emit = (
    patch: Partial<Pick<BirthProfile, 'timeSource' | 'timeConfidence' | 'rectifiedWindowStart' | 'rectifiedWindowEnd'>>,
    preserveRenderedResults = false,
  ) => {
    rememberBirthTimeReliability({ ...value, ...patch })
    if (preserveRenderedResults) {
      /* AppNext intentionally invalidates relationship outputs whenever the counterpart object is replaced.
         On iPhone that removed ~6-7kpx of rendered results about 60ms after selecting this control,
         which forced the fixed aurora through a visible recomposition. Keep the already-rendered result
         surface mounted, stage only these reliability fields in the existing counterpart object, and let
         the next explicit calculation read the updated fields from that same object. */
      Object.assign(value, patch)
      setStagedForRecalculation(true)
      forceLocalRender((revision) => revision + 1)
      return
    }
    onChange(patch)
  }

  return <>
    <div ref={firstFieldRef} className={`field ${compact ? '' : 'field-wide'}`}>
      <span>출생시간 출처</span>
      <StableChoice
        value={value.timeSource}
        disabled={disabled}
        ariaLabel="출생시간 출처"
        options={timeSourceLabels}
        onChange={(nextValue, context) => {
          const source = nextValue as TimeSource
          emit({
            timeSource: source,
            ...(value.timeConfidence === 'exact' && !exactSources.has(source) ? { timeConfidence: 'unknown' as TimeConfidence } : {}),
          }, context.preserveRenderedResults)
        }}
      />
    </div>
    <div className={`field ${compact ? '' : 'field-wide'}`}>
      <span>출생시간 신뢰도</span>
      <StableChoice
        value={value.timeConfidence}
        disabled={disabled}
        ariaLabel="출생시간 신뢰도"
        options={timeConfidenceLabels.map(([key, label]) => [key, label, key === 'exact' && !exactAllowed] as const)}
        onChange={(nextValue, context) => emit({ timeConfidence: nextValue as TimeConfidence }, context.preserveRenderedResults)}
      />
    </div>
    {value.timeSource === 'rectified' && <>
      <label className="field"><span>보정 범위 시작</span><input type="time" value={value.rectifiedWindowStart} disabled={disabled} onChange={(event)=>emit({rectifiedWindowStart:event.target.value}, shouldPreserveRenderedResults(event.currentTarget))}/></label>
      <label className="field"><span>보정 범위 끝</span><input type="time" value={value.rectifiedWindowEnd} disabled={disabled} onChange={(event)=>emit({rectifiedWindowEnd:event.target.value}, shouldPreserveRenderedResults(event.currentTarget))}/></label>
    </>}
    {stagedForRecalculation && <div className="privacy-note field-wide birth-time-reliability-note"><span>출생시간 설정이 바뀌었어. 현재 결과는 이전 계산 기준이야. 실제 계산 실행을 누르면 새 설정으로 갱신돼.</span></div>}
    {!disabled && <div className="privacy-note field-wide birth-time-reliability-note"><span>시각을 입력했다는 사실만으로 exact(정확 생시)로 보지 않아. 공식기록 또는 검증된 보정시각 + Exact일 때만 ASC(상승점)·하우스 등 생시 민감층을 exact로 사용해.</span></div>}
  </>
}
