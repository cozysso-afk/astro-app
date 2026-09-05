from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {text.count(old)} for {old[:100]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "api/main.py",
    "from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\n",
    "from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage\nfrom api.horary_prashna_v1 import router as horary_prashna_router\n",
)
replace_once(
    "api/main.py",
    'APP_VERSION = "api-fortune-v5.4-personal-marriage-forecast"',
    'APP_VERSION = "api-fortune-v5.5-horary-prashna-router"',
)
replace_once(
    "api/main.py",
    "app.add_middleware(\n    CORSMiddleware,\n    allow_origins=_allowed_origins,\n    allow_origin_regex=r\"https://.*\\.vercel\\.app\",\n    allow_credentials=True,\n    allow_methods=[\"GET\", \"POST\", \"OPTIONS\"],\n    allow_headers=[\"*\"],\n)\n",
    "app.add_middleware(\n    CORSMiddleware,\n    allow_origins=_allowed_origins,\n    allow_origin_regex=r\"https://.*\\.vercel\\.app\",\n    allow_credentials=True,\n    allow_methods=[\"GET\", \"POST\", \"OPTIONS\"],\n    allow_headers=[\"*\"],\n)\napp.include_router(horary_prashna_router)\n",
)
replace_once(
    "api/main.py",
    '            "marriage/personal",\n',
    '            "marriage/personal",\n            "horary-prashna/classify",\n',
)

replace_once(
    "web/src/appTypes.ts",
    "export type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'location' | 'precision'",
    "export type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'location' | 'horary' | 'precision'",
)

replace_once(
    "web/src/HomeControls.tsx",
    "  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },\n  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },",
    "  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },\n  { key: 'horary' as const, label: '호라리·프라슈나', desc: '질문한 시각과 현재 위치로 자유질문의 규칙을 잡아 분석', icon: Moon, tone: 'sage' },\n  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },",
)
replace_once(
    "web/src/HomeControls.tsx",
    "  const dateControlVisible = selectedTool !== 'integrated' && selectedTool !== 'location'",
    "  const dateControlVisible = selectedTool !== 'integrated' && selectedTool !== 'location' && selectedTool !== 'horary'",
)

replace_once(
    "web/src/AppNext.tsx",
    "import { LocationResults } from './LocationResults'\n",
    "import { LocationResults } from './LocationResults'\nimport { HoraryPrashnaPanel } from './HoraryPrashnaPanel'\n",
)
replace_once(
    "web/src/AppNext.tsx",
    "            onToolSelect={selectHomeTool}\n          />\n\n          {selectedTool === 'integrated'",
    "            onToolSelect={selectHomeTool}\n          />\n\n          {selectedTool === 'horary' && <HoraryPrashnaPanel apiBase={API_BASE} gender={birthProfile.gender}/>}\n\n          {selectedTool === 'integrated'",
)

replace_once(
    "web/src/main.tsx",
    "import './mobile-density-v29.css'\n",
    "import './mobile-density-v29.css'\nimport './horary-prashna.css'\n",
)

print("Horary/Prashna API + web entry patches applied")
