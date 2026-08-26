// Public browser-side push configuration.
// OneSignal App ID is public by design. NEVER put the OneSignal App API Key here.
window.ASTRO_PUSH_CONFIG = Object.freeze({
  oneSignalAppId: "",
  serviceWorkerPath: "OneSignalSDKWorker.js",
  serviceWorkerScope: "/astro-app/",
  streamlitUrl: "https://astro-app-wmz23ohfhmhrhrz2gg3kej.streamlit.app/"
});
