import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const exporter=readFileSync(new URL('./readingImageExport.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../reading-image-export.css',import.meta.url),'utf8')
const reunionCss=readFileSync(new URL('../reunion-v3.css',import.meta.url),'utf8')

test('fortune export uses an iPhone-readable 4:5 aurora glass renderer instead of flat DOM pagination',()=>{
  assert.match(exporter,/PAGE_WIDTH\s*=\s*1206/)
  assert.match(exporter,/PAGE_HEIGHT\s*=\s*1508/)
  assert.match(exporter,/HEADER_HEIGHT\s*=\s*148/)
  assert.match(exporter,/BODY_SIZE\s*=\s*\d+/)
  assert.match(exporter,/BODY_LINE\s*=\s*\d+/)
  assert.match(exporter,/CARD_GAP\s*=\s*\d+/)
  assert.match(exporter,/Noto Sans CJK KR/)
  assert.match(exporter,/drawAuroraBackground/)
  assert.match(exporter,/drawGlassCard/)
  assert.match(exporter,/toneGradient/)
  assert.match(exporter,/layoutCards/)
  assert.match(exporter,/pageVisualSpacing/)
  assert.match(exporter,/내 상황에 맞춰 읽기/)
  assert.match(exporter,/연락 전체/)
  assert.match(exporter,/선연락 방향/)
  assert.match(exporter,/핵심 판단/)
  assert.match(exporter,/기억할 시기/)
  assert.match(exporter,/canvas\.toBlob/)
  assert.match(exporter,/new File\(/)
  assert.match(exporter,/navigator\.share/)
  assert.match(exporter,/navigator\.canShare/)
  assert.match(exporter,/anchor\.download\s*=\s*file\.name/)
})

test('export keeps UI labels sans but renders editorial reading prose in Myeongjo after fonts load',()=>{
  assert.match(exporter,/editorial\?: boolean/)
  assert.match(exporter,/function readingFont/)
  assert.match(exporter,/"Nanum Myeongjo", "Noto Serif KR", AppleMyungjo, Batang, serif/)
  assert.match(exporter,/async function ensureExportFonts/)
  assert.match(exporter,/document\.fonts\.load\('500 38px "Nanum Myeongjo"'\)/)
  assert.match(exporter,/document\.fonts\.load\('700 38px "Nanum Myeongjo"'\)/)
  assert.match(exporter,/periodTopicCards[\s\S]*editorial:\s*true/)
  assert.match(exporter,/전체를 통틀어 보면[\s\S]*editorial:\s*true/)
  assert.match(exporter,/if \(card\.editorial\) readingFont\(ctx, metrics\.bodySize, 500\)/)
  assert.match(exporter,/await ensureExportFonts\(\)[\s\S]*const canvases = renderPages\(model\)/)
})

test('short flow and timing cards use compact geometry instead of wasting vertical space',()=>{
  assert.match(exporter,/compact\?: boolean/)
  assert.match(exporter,/compact:\s*true/)
  assert.match(exporter,/function cardMetrics/)
  assert.match(exporter,/titleSize:\s*compact\s*\?\s*31\s*:\s*34/)
  assert.match(exporter,/bodySize:\s*compact\s*\?\s*34\s*:\s*BODY_SIZE/)
  assert.match(exporter,/maxBodyLines:\s*compact\s*\?\s*3/)
})

test('export filters empty cards and includes both primary and reference period sectors',()=>{
  assert.match(exporter,/function meaningfulCard/)
  assert.match(exporter,/normalizeText\(card\.title\)/)
  assert.match(exporter,/normalizeText\(card\.body\)/)
  assert.match(exporter,/\.period-ai-user-focus \.period-ai-topic/)
  assert.match(exporter,/\.period-ai-user-reference \.period-ai-topic/)
  assert.match(exporter,/if \(!body\) continue/)
  assert.match(exporter,/dedupeCards\(dates\)/)
})

test('export keeps a stable rhythm and actively rebalances sparse tail pages',()=>{
  assert.match(exporter,/function itemHeight/)
  assert.match(exporter,/SECTION_HEIGHT/)
  assert.match(exporter,/function pageUsedHeight/)
  assert.match(exporter,/function pageFits/)
  assert.match(exporter,/currentFill\s*>=\s*\.64/)
  assert.match(exporter,/previous\.pop\(\)/)
  assert.match(exporter,/current\.unshift\(candidate\)/)
  assert.match(exporter,/topOffset\s*=\s*spare\s*>\s*250\s*\?\s*8\s*:\s*0/)
  assert.match(exporter,/Math\.min\(8,/)
  assert.match(exporter,/CARD_GAP\s*\+\s*spacing\.extraGap/)
  assert.match(exporter,/drawFooter/)
  assert.doesNotMatch(exporter,/sections\.push\(\{\s*title:\s*['"](?:면책|주의사항)/)
})

test('canvas wrapping keeps common closing punctuation attached to the previous line',()=>{
  assert.match(exporter,/function wrap\(/)
  assert.match(exporter,/，。！？、/)
  assert.match(exporter,/line\s*\+=\s*ch/)
  assert.match(exporter,/out\.push\(line\.trimEnd\(\)\)/)
})

test('relationship result still exposes image save and excludes its toolbar from exported content',()=>{
  assert.match(panel,/exportReadingImages/)
  assert.match(panel,/data-reading-export-root="relationship"/)
  assert.match(panel,/data-reading-export-ignore="true"/)
  assert.match(panel,/결과 이미지 저장/)
  assert.match(panel,/이미지 만드는 중/)
})

test('screen cards and reunion cards use translucent jelly glass materials',()=>{
  assert.match(css,/backdrop-filter: blur\(22px\)/)
  assert.match(css,/--v3-lilac/)
  assert.match(css,/--v3-mint/)
  assert.match(css,/--v3-sky/)
  assert.match(css,/--v3-blush/)
  assert.match(reunionCss,/--rv3-lilac/)
  assert.match(reunionCss,/backdrop-filter:blur\(22px\)/)
})

test('image export control is mobile-safe and reduced-motion aware',()=>{
  assert.match(css,/min-height:\s*44px/)
  assert.match(css,/@media \(max-width: 640px\)/)
  assert.match(css,/width:\s*100%/)
  assert.match(css,/prefers-reduced-motion:\s*reduce/)
})