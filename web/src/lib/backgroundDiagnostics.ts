export type BackgroundDiagnosticSnapshot = {
  stamp: number
  scrollY: number
  viewport: { width: number; height: number; offsetTop: number; offsetLeft: number; scale: number } | null
  active: string
  stack: string[]
  nodes: Record<string, Record<string, string | number>>
}

const selectors: Array<[string, string]> = [
  ['html', 'html'],
  ['body', 'body'],
  ['aurora', '#app-aurora-layer'],
  ['root', '#root'],
  ['shell', '.app-shell'],
  ['content', '.page-content'],
  ['profile', '.profile-editor-surface'],
  ['profileField', '.profile-editor-surface .field'],
  ['choice', '.profile-editor-surface .stable-choice'],
  ['trigger', '.profile-editor-surface .stable-choice-trigger'],
]

function nodeName(value: Element | null) {
  if (!value) return 'none'
  const id = value.id ? `#${value.id}` : ''
  const classes = typeof value.className === 'string' && value.className.trim()
    ? `.${value.className.trim().replace(/\s+/g, '.')}`
    : ''
  return `${value.tagName.toLowerCase()}${id}${classes}`
}

function captureNode(element: Element | null): Record<string, string | number> {
  if (!element) return { missing: 'true' }
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return {
    node: nodeName(element),
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
    backgroundPosition: style.backgroundPosition,
    backgroundSize: style.backgroundSize,
    opacity: style.opacity,
    filter: style.filter,
    backdropFilter: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
    transform: style.transform,
    position: style.position,
    zIndex: style.zIndex,
    isolation: style.isolation,
    contain: style.contain,
    overflow: style.overflow,
    display: style.display,
    visibility: style.visibility,
    animationName: style.animationName,
    animationPlayState: style.animationPlayState,
    animationDuration: style.animationDuration,
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

export function backgroundDiagnosticsEnabled() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('bgdiag') === '1'
}

export function captureBackgroundDiagnostic(): BackgroundDiagnosticSnapshot {
  const viewport = window.visualViewport
  const centerX = Math.max(0, Math.min(window.innerWidth - 1, Math.round(window.innerWidth / 2)))
  const centerY = Math.max(0, Math.min(window.innerHeight - 1, Math.round(window.innerHeight / 2)))
  const stack = typeof document.elementsFromPoint === 'function'
    ? document.elementsFromPoint(centerX, centerY).slice(0, 8).map(nodeName)
    : []
  return {
    stamp: Date.now(),
    scrollY: Math.round(window.scrollY),
    viewport: viewport ? {
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      offsetTop: Math.round(viewport.offsetTop),
      offsetLeft: Math.round(viewport.offsetLeft),
      scale: Number(viewport.scale.toFixed(3)),
    } : null,
    active: nodeName(document.activeElement),
    stack,
    nodes: Object.fromEntries(selectors.map(([name, selector]) => [name, captureNode(document.querySelector(selector))])),
  }
}

function changed(before: unknown, after: unknown) {
  return JSON.stringify(before) !== JSON.stringify(after)
}

export function formatBackgroundDiagnostic(
  label: string,
  before: BackgroundDiagnosticSnapshot,
  after: BackgroundDiagnosticSnapshot,
) {
  const lines: string[] = [`BGDIAG ${label}`]
  if (before.scrollY !== after.scrollY) lines.push(`scrollY ${before.scrollY} -> ${after.scrollY}`)
  if (changed(before.viewport, after.viewport)) lines.push(`viewport ${JSON.stringify(before.viewport)} -> ${JSON.stringify(after.viewport)}`)
  if (before.active !== after.active) lines.push(`active ${before.active} -> ${after.active}`)
  if (changed(before.stack, after.stack)) lines.push(`stack ${before.stack.join(' > ')} -> ${after.stack.join(' > ')}`)

  const keys = new Set([...Object.keys(before.nodes), ...Object.keys(after.nodes)])
  for (const key of keys) {
    const prev = before.nodes[key] ?? {}
    const next = after.nodes[key] ?? {}
    const props = new Set([...Object.keys(prev), ...Object.keys(next)])
    for (const prop of props) {
      if (prev[prop] !== next[prop]) lines.push(`${key}.${prop} ${String(prev[prop])} -> ${String(next[prop])}`)
    }
  }
  if (lines.length === 1) lines.push('computed-style/layout diff: NONE')
  return lines.join('\n')
}
