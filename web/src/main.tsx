import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AppNext'
import { AuthGate } from './AuthGate'
import { installIntegratedPrecisionFetch } from './lib/precisionTransport'
import './styles.css'
import './relationship.css'
import './birthplace.css'
import './integrated.css'
import './archive.css'
import './precision.css'
import './celestial-theme.css'
import './celestial-pastel.css'
import './settings.css'
import './ai-interpret.css'
import './annual-daily-scores.css'
import './ai-interpret-v2.css'
import './relationship-analysis.css'
import './visual-overhaul-v5.css'
import './visual-overhaul-v6.css'
import './mobile-spacing-v11.css'
import './fortune-ux-v14.css'
import './period-ai-v18.css'
import './ux-readability-v22.css'
import './mobile-design-v27.css'
import './mobile-type-v28.css'
import './mobile-density-v29.css'
import './auth.css'
import './home-moonlit.css'
import './ios-viewport-stability.css'
import './mobile-viewport-v31.css'
import './vertical-density-v32.css'
import './reading-type-hierarchy-v33.css'
import './home-information-architecture-v35.css'
import './system-reading-ux-v40.css'
import './reunion-location-mobile-v42.css'
import './basic-fortune-v43.css'
import './ai-cost-preview-v47.css'
import './reading-legibility-v49.css'
import './reading-polish-v50.css'
import './reading-experience.css'
import './reading-font-fix-v54.css'

installIntegratedPrecisionFetch()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>,
)
