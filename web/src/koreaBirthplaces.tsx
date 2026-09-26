import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Coordinate = { lat: string; lon: string }

type BirthplaceValue = {
  placeKey: string
  latitude: string
  longitude: string
  utcOffset: string
}

type Props = {
  value: BirthplaceValue
  onChange: (next: BirthplaceValue) => void
  disabled?: boolean
}

type ChoiceContext = {
  preserveRenderedResults: boolean
}

type ChoicePosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type PlacePreset = never

type LocationChoiceProps = {
  value: string
  options: ReadonlyArray<readonly [string, string]>
  onChange: (value: string, context: ChoiceContext) => void
  disabled?: boolean
  ariaLabel: string
}

export const KOREA_ADMIN_VERSION = '20260701'
export const KOREA_ADMIN_COUNT = 230

export const KOREA_ADMIN_20260701: Record<string, string[]> = {
  '서울특별시': ['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'],
  '부산광역시': ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'],
  '대구광역시': ['중구','동구','서구','남구','북구','수성구','달서구','달성군','군위군'],
  '인천광역시': ['강화군','옹진군','제물포구','영종구','미추홀구','연수구','남동구','부평구','계양구','서해구','검단구'],
  '대전광역시': ['동구','중구','서구','유성구','대덕구'],
  '울산광역시': ['중구','남구','동구','북구','울주군'],
  '세종특별자치시': ['세종특별자치시'],
  '경기도': ['수원시','성남시','의정부시','안양시','부천시','광명시','평택시','동두천시','안산시','고양시','과천시','구리시','남양주시','오산시','시흥시','군포시','의왕시','하남시','용인시','파주시','이천시','안성시','김포시','화성시','광주시','양주시','포천시','여주시','연천군','가평군','양평군'],
  '강원특별자치도': ['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군','평창군','정선군','철원군','화천군','양구군','인제군','고성군','양양군'],
  '충청북도': ['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'],
  '충청남도': ['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군'],
  '전북특별자치도': ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'],
  '경상북도': ['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시','의성군','청송군','영양군','영덕군','청도군','고령군','성주군','칠곡군','예천군','봉화군','울진군','울릉군'],
  '경상남도': ['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군','창녕군','고성군','남해군','하동군','산청군','함양군','거창군','합천군'],
  '제주특별자치도': ['제주시','서귀포시'],
  '전남광주통합특별시': ['동구','서구','남구','북구','광산구','목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군','화순군','장흥군','강진군','해남군','영암군','무안군','함평군','영광군','장성군','완도군','진도군','신안군'],
}

const FALLBACK_COORDINATES: Record<string, Coordinate> = {
  '세종특별자치시::세종특별자치시': { lat: '36.4800', lon: '127.2890' },
  '인천광역시::제물포구': { lat: '37.4786', lon: '126.6292' },
  '인천광역시::영종구': { lat: '37.4934', lon: '126.5310' },
  '인천광역시::서해구': { lat: '37.5450', lon: '126.6760' },
  '인천광역시::검단구': { lat: '37.5940', lon: '126.6750' },
}

function normalizeRegion(name: string) {
  if (name === '광주광역시' || name === '전라남도') return '전남광주통합특별시'
  if (name === '강원도') return '강원특별자치도'
  if (name === '전라북도') return '전북특별자치도'
  return name
}

function ringCentroid(ring: number[][]) {
  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    const cross = x1 * y2 - x2 * y1
    twiceArea += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const valid = ring.filter((point) => point.length >= 2)
    const lon = valid.reduce((sum, point) => sum + point[0], 0) / Math.max(valid.length, 1)
    const lat = valid.reduce((sum, point) => sum + point[1], 0) / Math.max(valid.length, 1)
    return { area: 0, lat, lon }
  }
  return {
    area: Math.abs(twiceArea / 2),
    lon: cx / (3 * twiceArea),
    lat: cy / (3 * twiceArea),
  }
}

function representativePoint(geometry: any): Coordinate | null {
  if (!geometry?.coordinates) return null
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  let best: { area: number; lat: number; lon: number } | null = null
  for (const polygon of polygons) {
    const outer = polygon?.[0]
    if (!Array.isArray(outer) || outer.length < 3) continue
    const candidate = ringCentroid(outer)
    if (!best || candidate.area > best.area) best = candidate
  }
  if (!best || !Number.isFinite(best.lat) || !Number.isFinite(best.lon)) return null
  return { lat: best.lat.toFixed(6), lon: best.lon.toFixed(6) }
}

async function loadCoordinateMap(): Promise<Record<string, Coordinate>> {
  const output: Record<string, Coordinate> = { ...FALLBACK_COORDINATES }
  try {
    const adk = await import('admdongkor')
    const collection: any = await adk.get(KOREA_ADMIN_VERSION, 'sgg')
    for (const feature of collection?.features ?? []) {
      const properties = feature?.properties ?? {}
      const region = normalizeRegion(String(properties.sidonm ?? '').trim())
      const district = String(properties.sggnm ?? '').trim()
      if (!region || !district) continue
      const point = representativePoint(feature.geometry)
      if (point) output[`${region}::${district}`] = point
    }
  } catch (error) {
    console.warn('행정구역 대표좌표 로딩 실패', error)
  }
  return output
}

let coordinatePromise: Promise<Record<string, Coordinate>> | null = null
function getCoordinateMap() {
  if (!coordinatePromise) coordinatePromise = loadCoordinateMap()
  return coordinatePromise
}

function splitKey(placeKey: string) {
  if (!placeKey.includes('::')) return { region: '', district: '' }
  const [region, district] = placeKey.split('::')
  return { region, district }
}

function shouldPreserveRenderedResults(root: HTMLElement | null) {
  if (!root?.closest('.tool-panel')) return false
  return Boolean(document.querySelector('.results-wrap'))
}

function LocationChoice({ value, options, onChange, disabled = false, ariaLabel }: LocationChoiceProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<ChoicePosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedLabel = options.find(([key]) => key === value)?.[1] ?? ''

  const updatePosition = () => {
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
    const left = Math.min(Math.max(rect.left, viewportLeft + 8), viewportLeft + viewportWidth - width - 8)
    const top = placeAbove
      ? Math.max(viewportTop + 8, rect.top - maxHeight - 6)
      : Math.min(rect.bottom + 6, viewportBottom - 128)
    setPosition({ top, left, width, maxHeight })
  }

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
    const update = () => updatePosition()
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
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const menu = open && position && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="stable-choice-menu stable-choice-menu-portal birthplace-choice-menu"
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        style={{ position: 'fixed', zIndex: 10000, top: position.top, left: position.left, right: 'auto', width: position.width, maxHeight: position.maxHeight }}
      >
        {options.map(([key, label]) => <button
          key={key || '__empty__'}
          type="button"
          className="stable-choice-option"
          role="option"
          aria-selected={key === value}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(key, { preserveRenderedResults: shouldPreserveRenderedResults(rootRef.current) })
            setOpen(false)
          }}
        >{label}</button>)}
      </div>,
      document.body,
    )
    : null

  return <div className={`stable-choice birthplace-stable-choice ${open ? 'is-open' : ''}`} ref={rootRef}>
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
  </div>
}

export function KoreaBirthplaceSelector({ value, onChange, disabled = false }: Props) {
  const initial = splitKey(value.placeKey)
  const [region, setRegion] = useState(initial.region)
  const [district, setDistrict] = useState(initial.district)
  const [coordinateMap, setCoordinateMap] = useState<Record<string, Coordinate>>(FALLBACK_COORDINATES)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')

  useEffect(() => {
    let cancelled = false
    getCoordinateMap().then((map) => {
      if (cancelled) return
      setCoordinateMap(map)
      setStatus(Object.keys(map).length > Object.keys(FALLBACK_COORDINATES).length ? 'ready' : 'fallback')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const parsed = splitKey(value.placeKey)
    if (parsed.region !== region) setRegion(parsed.region)
    if (parsed.district !== district) setDistrict(parsed.district)
  }, [value.placeKey, region, district])

  const districts = useMemo(() => region ? KOREA_ADMIN_20260701[region] ?? [] : [], [region])

  const commit = (next: BirthplaceValue, context: ChoiceContext) => {
    if (context.preserveRenderedResults) {
      // Keep the rendered reading mounted on iOS. Removing a several-thousand-pixel result tree
      // while the picker closes forces the fixed aurora through a visible recomposition. The next
      // explicit calculation reads these staged values from the same profile object.
      Object.assign(value, next)
      return
    }
    onChange(next)
  }

  const chooseRegion = (nextRegion: string, context: ChoiceContext) => {
    setRegion(nextRegion)
    setDistrict('')
    commit({ placeKey: '', latitude: '', longitude: '', utcOffset: '9' }, context)
  }

  const chooseDistrict = (nextDistrict: string, context: ChoiceContext) => {
    setDistrict(nextDistrict)
    if (!region || !nextDistrict) {
      commit({ placeKey: '', latitude: '', longitude: '', utcOffset: '9' }, context)
      return
    }
    const placeKey = `${region}::${nextDistrict}`
    const point = coordinateMap[placeKey] ?? FALLBACK_COORDINATES[placeKey]
    commit({
      placeKey,
      latitude: point?.lat ?? '',
      longitude: point?.lon ?? '',
      utcOffset: '9',
    }, context)
  }

  return (
    <div className="birthplace-selector field-wide">
      <div className="birthplace-two-step">
        <div className="field">
          <span>시·도</span>
          <LocationChoice
            value={region}
            disabled={disabled}
            ariaLabel="출생 시·도"
            options={[["", "시·도 선택"], ...Object.keys(KOREA_ADMIN_20260701).map((name) => [name, name] as const)]}
            onChange={chooseRegion}
          />
        </div>
        <div className="field">
          <span>시·군·구</span>
          <LocationChoice
            value={district}
            disabled={disabled || !region}
            ariaLabel="출생 시·군·구"
            options={[["", "시·군·구 선택"], ...districts.map((name) => [name, name] as const)]}
            onChange={chooseDistrict}
          />
        </div>
      </div>
      <div className={`location-data-status ${status}`}>
        <span>2026.07.01 현행 행정체계 · {KOREA_ADMIN_COUNT}개 시·군·구</span>
        <b>{status === 'ready' ? '대표좌표 자동 적용' : status === 'loading' ? '좌표 불러오는 중' : '좌표 원본 연결 제한'}</b>
      </div>
    </div>
  )
}
