import { sanitizeExternalFortuneText } from './precisionTransport'

/* Clipboard helper with iOS/private-browsing fallback. */

export async function copyToClipboard(text: string) {
  const safeText = sanitizeExternalFortuneText(text)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(safeText)
      return true
    }
  } catch {
    // iOS/private browsing fallback below.
  }

  let area: HTMLTextAreaElement | null = null
  try {
    area = document.createElement('textarea')
    area.value = safeText
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    if (area?.parentNode) {
      try { area.parentNode.removeChild(area) } catch { /* cleanup best effort */ }
    }
  }
}
