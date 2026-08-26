// Public browser-side push configuration.
// OneSignal App ID is public by design. NEVER put the OneSignal App API Key here.
window.ASTRO_PUSH_CONFIG = Object.freeze({
  oneSignalAppId: "203c25c5-85da-4b51-bd33-b93476622e84",
  serviceWorkerPath: "astro-app/OneSignalSDKWorker.js",
  serviceWorkerScope: "/astro-app/",
  streamlitUrl: "https://astro-app-wmz23ohfhmhrhrz2gg3kej.streamlit.app/"
});
