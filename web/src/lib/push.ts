const ONESIGNAL_APP_ID = '203c25c5-85da-4b51-bd33-b93476622e84'
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'

type PushSnapshot = {
  configured: boolean
  supported: boolean
  standalone: boolean
  permission: boolean
  optedIn: boolean
  status: 'checking' | 'ready' | 'needs_install' | 'needs_permission' | 'unsupported' | 'error'
  message: string
}

type OneSignalLike = {
  init: (options: Record<string, unknown>) => Promise<void>
  Notifications: {
    isPushSupported: () => boolean
    permission: boolean
    requestPermission: () => Promise<void>
  }
  User: {
    PushSubscription: {
      optedIn: boolean
      optIn: () => Promise<void>
      optOut?: () => Promise<void>
    }
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalLike) => void | Promise<void>>
    __starlightOneSignal?: OneSignalLike
    __starlightOneSignalLoading?: Promise<OneSignalLike>
  }
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return navigatorWithStandalone.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

function loadSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저 환경이 아니야.'))
  if (window.__starlightOneSignal) return Promise.resolve(window.__starlightOneSignal)
  if (window.__starlightOneSignalLoading) return window.__starlightOneSignalLoading

  const loading = new Promise<OneSignalLike>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
    let timer = 0
    let settled = false
    let deferred: ((oneSignal: OneSignalLike) => void | Promise<void>) | null = null
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      if (timer) window.clearTimeout(timer)
      if (deferred && window.OneSignalDeferred) {
        window.OneSignalDeferred = window.OneSignalDeferred.filter((callback) => callback !== deferred)
      }
      if (!window.__starlightOneSignal) script?.remove()
      reject(error)
    }
    if (!script) {
      script = document.createElement('script')
      script.src = SDK_URL
      script.defer = true
      script.onerror = () => fail(new Error('알림 서비스를 불러오지 못했어.'))
      document.head.appendChild(script)
    } else {
      script.onerror = () => fail(new Error('알림 서비스를 불러오지 못했어.'))
    }

    timer = window.setTimeout(() => fail(new Error('알림 서비스 연결 시간이 초과됐어.')), 12000)
    deferred = async (OneSignal) => {
      if (settled) return
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          autoResubscribe: true,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        })
        if (settled) return
        settled = true
        window.__starlightOneSignal = OneSignal
        window.clearTimeout(timer)
        resolve(OneSignal)
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    }
    window.OneSignalDeferred.push(deferred)
  })
  window.__starlightOneSignalLoading = loading
  void loading.catch(() => {
    if (window.__starlightOneSignalLoading === loading) window.__starlightOneSignalLoading = undefined
  })
  return loading
}

function snapshot(OneSignal: OneSignalLike): PushSnapshot {
  const supported = Boolean(OneSignal.Notifications.isPushSupported())
  const standalone = isStandalonePwa()
  const permission = Boolean(OneSignal.Notifications.permission)
  const optedIn = Boolean(OneSignal.User.PushSubscription.optedIn)
  if (!supported) return { configured: true, supported, standalone, permission, optedIn, status: 'unsupported', message: '이 환경에서는 웹 푸시를 지원하지 않아.' }
  if (!standalone) return { configured: true, supported, standalone, permission, optedIn, status: 'needs_install', message: 'iPhone에서는 홈 화면에 추가한 앱에서 알림을 켤 수 있어.' }
  if (permission && optedIn) return { configured: true, supported, standalone, permission, optedIn, status: 'ready', message: '운세 알림 구독이 켜져 있어.' }
  return { configured: true, supported, standalone, permission, optedIn, status: 'needs_permission', message: '알림 권한을 허용하면 일일·주간·월간 운세 알림을 받을 수 있어.' }
}

export async function getPushState(): Promise<PushSnapshot> {
  try {
    const OneSignal = await loadSdk()
    return snapshot(OneSignal)
  } catch (error) {
    return {
      configured: true,
      supported: false,
      standalone: isStandalonePwa(),
      permission: false,
      optedIn: false,
      status: 'error',
      message: error instanceof Error ? error.message : '알림 상태를 확인하지 못했어.',
    }
  }
}

export async function enablePush(): Promise<PushSnapshot> {
  try {
    const OneSignal = await loadSdk()
    if (!OneSignal.Notifications.isPushSupported()) return snapshot(OneSignal)
    if (!isStandalonePwa()) return snapshot(OneSignal)
    await OneSignal.Notifications.requestPermission()
    if (OneSignal.Notifications.permission && !OneSignal.User.PushSubscription.optedIn) {
      await OneSignal.User.PushSubscription.optIn()
    }
    return snapshot(OneSignal)
  } catch (error) {
    return {
      configured: true,
      supported: false,
      standalone: isStandalonePwa(),
      permission: false,
      optedIn: false,
      status: 'error',
      message: error instanceof Error ? error.message : '알림 설정에 실패했어.',
    }
  }
}

export async function disablePush(): Promise<PushSnapshot> {
  try {
    const OneSignal = await loadSdk()
    if (OneSignal.User.PushSubscription.optOut) await OneSignal.User.PushSubscription.optOut()
    return snapshot(OneSignal)
  } catch (error) {
    return {
      configured: true,
      supported: false,
      standalone: isStandalonePwa(),
      permission: false,
      optedIn: false,
      status: 'error',
      message: error instanceof Error ? error.message : '알림 해제에 실패했어.',
    }
  }
}

export type { PushSnapshot }
