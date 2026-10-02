import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AppNext'
import { AuthGate } from './AuthGate'
import { EditorialQaPreview } from './EditorialQaPreview'
import { VisualQaPreview } from './VisualQaPreview'
import { installIntegratedPrecisionFetch } from './lib/precisionTransport'
import { installReadingPresentationV5 } from './lib/readingPresentationV5'
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
import './background-stability-v1.css'
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
import './reunion-reading-product-v13.css'
import './redline-layout-v55.css'
import './archive-mobile-polish-v57.css'
import './archive-mobile-polish-v59.css'
import './profile-form-aurora-v71.css'
import './reading-compact-v5.css'
import './reading-capture-polish-v6.css'
import './viewport-background-v60.css'
import './reading-font-fix-v54.css'

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const host = typeof window !== 'undefined' ? window.location.hostname : ''
const localQaHost = host === '127.0.0.1' || host === 'localhost'
const editorialQaHost = host.endsWith('.vercel.app') && host.includes('git-fix-reunion-hierarchy-v2')
const qaMode = params?.get('qa') ?? ''
const editorialQaPreview = editorialQaHost && qaMode === 'editorial'
const visualQaPreview = localQaHost && qaMode === 'visual'

if (!editorialQaPreview && !visualQaPreview) {
  installIntegratedPrecisionFetch()
  installReadingPresentationV5()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {visualQaPreview
      ? <VisualQaPreview/>
      : editorialQaPreview
        ? <EditorialQaPreview/>
        : <AuthGate><App /></AuthGate>}
  </React.StrictMode>,
)
