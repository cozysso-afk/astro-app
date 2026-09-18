from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'patched {path}: {old[:80]!r}')


path = 'web/src/RelationshipInterpretationPanel.tsx'
replace_once(
    path,
    "import { AlertTriangle, Orbit, Sparkles } from 'lucide-react'",
    "import { AlertTriangle, ImageDown, LoaderCircle, Orbit, Sparkles } from 'lucide-react'",
)
replace_once(
    path,
    "import type { ReactNode } from 'react'",
    "import { useRef, useState, type ReactNode } from 'react'",
)
replace_once(
    path,
    "import { firstSentences, relationshipGenerationCost, reunionSajuCopy } from './lib/reunionPresentation'",
    "import { firstSentences, relationshipGenerationCost, reunionSajuCopy } from './lib/reunionPresentation'\nimport { exportReadingImages } from './lib/readingImageExport'\nimport './reading-image-export.css'",
)
replace_once(
    path,
    "}) {\n  const reunion = analysisMode === 'reunion'\n  const view = buildRelationshipUserSummary",
    "}) {\n  const reunion = analysisMode === 'reunion'\n  const exportRef = useRef<HTMLElement | null>(null)\n  const [imageExporting, setImageExporting] = useState(false)\n  const [imageExportStatus, setImageExportStatus] = useState('')\n  const imageExportLabel = reunion ? '재회 결과' : analysisMode === 'marriage_married' ? '결혼생활 결과' : analysisMode === 'marriage_unmarried' ? '결혼궁합 결과' : '궁합 결과'\n  const saveResultImages = async () => {\n    if (!exportRef.current || imageExporting) return\n    setImageExporting(true)\n    setImageExportStatus('')\n    try {\n      const result = await exportReadingImages(exportRef.current, imageExportLabel)\n      if (!result.cancelled) setImageExportStatus(result.shared ? `${result.pages}장 공유 화면을 열었어.` : `${result.pages}장 이미지로 저장했어.`)\n    } catch (error) {\n      setImageExportStatus(error instanceof Error ? error.message : '이미지 저장 중 문제가 생겼어.')\n    } finally {\n      setImageExporting(false)\n    }\n  }\n  const view = buildRelationshipUserSummary",
)
replace_once(
    path,
    '  return <section className="relationship-experience reading-experience" data-mode={analysisMode}>',
    '  return <section ref={exportRef} className="relationship-experience reading-experience" data-mode={analysisMode} data-reading-export-root="relationship">',
)
replace_once(
    path,
    "</p></header>\n\n    {ai?.ok && ai.data ? <section",
    "</p></header>\n    <div className=\"reading-export-toolbar\" data-reading-export-ignore=\"true\">\n      <button type=\"button\" onClick={saveResultImages} disabled={imageExporting} aria-busy={imageExporting}>\n        {imageExporting ? <LoaderCircle className=\"reading-export-spinner\" size={17} aria-hidden=\"true\"/> : <ImageDown size={17} aria-hidden=\"true\"/>}\n        {imageExporting ? '이미지 만드는 중…' : '결과 이미지 저장'}\n      </button>\n      {!!imageExportStatus && <small role=\"status\">{imageExportStatus}</small>}\n    </div>\n\n    {ai?.ok && ai.data ? <section",
)

replace_once(
    'web/src/lib/readingImageExport.ts',
    "  let canvas: HTMLCanvasElement\n  let ctx: CanvasRenderingContext2D",
    "  let canvas = document.createElement('canvas')\n  let ctx = canvas.getContext('2d')!",
)

print('relationship image export patch complete')
