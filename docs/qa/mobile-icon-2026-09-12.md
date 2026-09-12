# Mobile layout and installed icon follow-up

Baseline: e1d3fdfa156884d1fc24c855e0c86c285e0baef1 (PR 121).

Changed the Apple touch icon, legacy precomposed link, favicon, and PWA manifest to versioned lavender glass moon/star assets. PNG dimensions are 32, 180, 192, and 512 pixels. The built-in image generator produced the source; deployment assets are deterministic resized PNGs. No external image generation API or Gemini calls.

The specialist tools group now expands from one compact row. Field/Western/Saju/Thai direct entries remain visible. Interpretation code, scores, API, auth, DB and cache contracts are unchanged.

## Browser verification

Actual HomeControls, FortuneFieldHub, AppChrome and PeriodAiInterpretationPanel components rendered in an isolated local fixture harness with the production CSS import order. Chromium 153 mobile contexts at widths 375, 393, and 430px, height 852px. Field entry and love field selection clicked; all four single-context disclosures opened. No horizontal overflow at any tested width, no page errors. Screenshots inspected for home navigation and expanded single-context text. Korean Noto Sans supplied only to the fixture harness because the Linux environment lacks Korean fonts; transitions disabled for stable captures. Harness and fonts are not shipped.

This is mobile Chromium component verification, not a physical iPhone/Safari or authenticated end-to-end session. Installed iOS home-screen icons are OS-managed and cannot be remotely replaced by the site. New installation metadata and assets must first be verified on Production. Do not delete local app data as an update workaround.
