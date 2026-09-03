"""API package bootstrap.

`uvicorn api.main:app` imports this package before `api.main`. Keep the core
Streamlit-compatible engine untouched while the API opts into the evidence-
enriched wrapper. This avoids duplicating the large deterministic engine and
keeps the enrichment reversible until V2 validation is complete.
"""

import integrated_fortune_v1 as _integrated_engine
from integrated_fortune_api_v2 import ENGINE_VERSION, build_integrated_fortune

# api.main imports these names from integrated_fortune_v1 after this bootstrap
# has executed, so both synchronous and background calculation routes use the
# same enriched result without changing the legacy engine's public file.
_integrated_engine.ENGINE_VERSION = ENGINE_VERSION
_integrated_engine.build_integrated_fortune = build_integrated_fortune
